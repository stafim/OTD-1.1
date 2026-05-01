import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, type User, type UserRole } from "@shared/models/auth";
import { drivers, passwordResetTokens, clients } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = "8h";
const REFRESH_TOKEN_EXPIRY = "30d";

// ─── Rate Limiter para login (in-memory, per IP) ─────────────────────────────
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_BLOCK_MS   = 15 * 60 * 1000; // bloqueia por 15 minutos

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]).trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 0, firstAttempt: now });
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip) ?? { count: 0, firstAttempt: now };

  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }

  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.blockedUntil = now + LOGIN_BLOCK_MS;
  }
  loginAttempts.set(ip, entry);
}

function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Limpeza periódica para evitar acúmulo de memória (a cada hora)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (now - entry.firstAttempt > LOGIN_WINDOW_MS * 2) loginAttempts.delete(ip);
  }
}, 60 * 60 * 1000);

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "default-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default-refresh-secret";

export interface JwtPayload {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  tokenVersion?: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  clientId?: string;
}

// ─── Client Portal Auth ───────────────────────────────────────────────────────
export interface ClientJwtPayload {
  clientId: string;
  clientName: string;
  username: string;
  type: "client";
}

const JWT_CLIENT_SECRET = process.env.JWT_CLIENT_SECRET || "default-client-portal-secret";

export function generateClientToken(payload: ClientJwtPayload): string {
  return jwt.sign(payload, JWT_CLIENT_SECRET, { expiresIn: "12h" });
}

export function verifyClientToken(token: string): ClientJwtPayload | null {
  try {
    return jwt.verify(token, JWT_CLIENT_SECRET) as ClientJwtPayload;
  } catch {
    return null;
  }
}

export function isAuthenticatedClientJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return rejectWithDrain(req, res, 401, "Token não fornecido");
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyClientToken(token);
  if (!payload || payload.type !== "client") {
    return rejectWithDrain(req, res, 401, "Token de cliente inválido ou expirado");
  }
  req.clientId = payload.clientId;
  next();
}

const registerSchema = z.object({
  username: z.string().min(3, "Username deve ter pelo menos 3 caracteres").max(100),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  email: z.string().email("Email inválido").optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().min(1, "Username é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function rejectWithDrain(req: AuthenticatedRequest, res: Response, status: number, message: string) {
  const send = () => {
    if (!res.headersSent) res.status(status).json({ message });
  };
  if (req.readableEnded) {
    send();
  } else {
    req.on("end", send);
    req.on("error", send);
    req.resume();
  }
}

export function isAuthenticatedJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return rejectWithDrain(req, res, 401, "Token não fornecido");
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    return rejectWithDrain(req, res, 401, "Token inválido ou expirado");
  }

  db.select().from(users).where(eq(users.id, payload.userId)).limit(1)
    .then(([user]) => {
      if (!user || user.isActive !== "true") {
        return rejectWithDrain(req, res, 401, "Usuário não encontrado ou inativo");
      }
      // Motoristas inaptos CONTINUAM podendo logar/usar o app — apenas não recebem
      // listas de coletas/transportes nem push (filtrado nos respectivos endpoints).
      req.user = user;
      next();
    })
    .catch(() => {
      return rejectWithDrain(req, res, 500, "Erro ao verificar autenticação");
    });
}

async function findDriverForUser(user: User): Promise<{ driverId: string; driverType: string; phone: string | null; cpf: string | null; profilePhoto: string | null; isApto: string | null; isActive: string | null } | null> {
  if (!user.email) return null;

  const [driver] = await db.select({
    id: drivers.id,
    driverType: drivers.driverType,
    phone: drivers.phone,
    cpf: drivers.cpf,
    profilePhoto: drivers.profilePhoto,
    isApto: drivers.isApto,
    isActive: drivers.isActive,
  })
    .from(drivers)
    .where(eq(drivers.email, user.email))
    .limit(1);

  if (!driver) return null;
  return {
    driverId: driver.id,
    driverType: driver.driverType,
    phone: driver.phone || null,
    cpf: driver.cpf || null,
    profilePhoto: driver.profilePhoto || null,
    isApto: driver.isApto || null,
    isActive: driver.isActive || null,
  };
}

export function registerJWTAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await db.select().from(users)
        .where(eq(users.username, data.username.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Username já está em uso" });
      }

      if (data.email) {
        const existingEmail = await db.select().from(users)
          .where(eq(users.email, data.email))
          .limit(1);
        if (existingEmail.length > 0) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      const passwordHash = await hashPassword(data.password);

      const [newUser] = await db.insert(users).values({
        username: data.username.toLowerCase(),
        passwordHash,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "visualizador",
        isActive: "true",
      }).returning();

      const { passwordHash: _, ...userWithoutPassword } = newUser;
      res.status(201).json({ 
        message: "Usuário criado com sucesso",
        user: userWithoutPassword 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const rateCheck = checkLoginRateLimit(ip);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `Muitas tentativas de login. Tente novamente em ${Math.ceil((rateCheck.retryAfterSeconds ?? 900) / 60)} minutos.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
      }

      const data = loginSchema.parse(req.body);
      const loginInput = data.username.toLowerCase();

      const [user] = await db.select().from(users)
        .where(or(
          eq(users.username, loginInput),
          eq(users.email, loginInput)
        ))
        .limit(1);

      if (!user) {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      if (user.isActive !== "true") {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Usuário inativo" });
      }

      if (!user.passwordHash) {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Usuário sem senha configurada" });
      }

      const isValidPassword = await verifyPassword(data.password, user.passwordHash);
      if (!isValidPassword) {
        recordFailedLogin(ip);
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      clearLoginAttempts(ip);

      const loginTokenVersion = new Date();
      await db.update(users)
        .set({ lastLogin: loginTokenVersion, refreshTokenVersion: loginTokenVersion })
        .where(eq(users.id, user.id));

      const payload: JwtPayload = {
        userId: user.id,
        username: user.username!,
        email: user.email || undefined,
        role: user.role as UserRole,
        tokenVersion: loginTokenVersion,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      const { passwordHash: _, ...userWithoutPassword } = user;

      res.json({
        message: "Login realizado com sucesso",
        accessToken,
        refreshToken,
        user: userWithoutPassword,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Erro ao realizar login" });
    }
  });

  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const refreshSchema = z.object({
        refreshToken: z.string().min(1, "Refresh token é obrigatório"),
      });
      
      const data = refreshSchema.parse(req.body);
      const payload = verifyRefreshToken(data.refreshToken);
      
      if (!payload) {
        return res.status(401).json({ message: "Refresh token inválido ou expirado" });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Usuário não encontrado" });
      }

      if (user.isActive !== "true") {
        return res.status(401).json({ message: "Usuário inativo" });
      }

      if (user.refreshTokenVersion) {
        const storedVersion = new Date(user.refreshTokenVersion).getTime();
        const tokenVersion = payload.tokenVersion ? new Date(payload.tokenVersion).getTime() : 0;
        if (tokenVersion < storedVersion) {
          return res.status(401).json({ message: "Token revogado. Faça login novamente." });
        }
      }

      // Motoristas inaptos podem renovar token normalmente; o filtro de
      // listas/push é feito nos respectivos endpoints.

      const newTokenVersion = new Date();
      await db.update(users)
        .set({ refreshTokenVersion: newTokenVersion })
        .where(eq(users.id, user.id));

      const newPayload: JwtPayload = {
        userId: user.id,
        username: user.username!,
        role: user.role as UserRole,
        tokenVersion: newTokenVersion,
      };

      const newAccessToken = generateAccessToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error refreshing token:", error);
      res.status(500).json({ message: "Erro ao renovar token" });
    }
  });

  app.post("/api/auth/logout", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const payload = verifyAccessToken(token);
        
        if (payload) {
          await db.update(users)
            .set({ refreshTokenVersion: new Date() })
            .where(eq(users.id, payload.userId));
        }
      }

      res.json({ message: "Logout realizado com sucesso" });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ message: "Erro ao realizar logout" });
    }
  });

  app.get("/api/auth/me", isAuthenticatedJWT, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const { passwordHash: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // ============ RECUPERAÇÃO DE SENHA ============

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email("E-mail inválido") }).parse(req.body);

      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        return res.json({ message: "Se este e-mail estiver cadastrado, você receberá o código em breve." });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.update(passwordResetTokens)
        .set({ used: "true" })
        .where(eq(passwordResetTokens.userId, user.id));

      await db.insert(passwordResetTokens).values({ userId: user.id, code, expiresAt });

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT || "587";
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort),
          secure: parseInt(smtpPort) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: smtpFrom,
          to: email,
          subject: "Código de Recuperação de Senha - OTD Logistics",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
              <div style="background-color: #f97316; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">OTD Logistics</h1>
              </div>
              <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827;">Recuperação de Senha</h2>
                <p style="color: #6b7280;">Olá, <strong>${user.firstName || user.username}</strong>!</p>
                <p style="color: #6b7280;">Use o código abaixo para redefinir sua senha. Ele é válido por <strong>15 minutos</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <span style="background-color: #f97316; color: white; font-size: 36px; font-weight: bold; padding: 16px 32px; border-radius: 8px; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="color: #6b7280; font-size: 13px;">Se você não solicitou a recuperação de senha, ignore este e-mail.</p>
              </div>
            </div>
          `,
        });
      } else {
        console.log(`[RESET CODE] User: ${user.username} | Code: ${code} | Expires: ${expiresAt}`);
      }

      res.json({ message: "Se este e-mail estiver cadastrado, você receberá o código em breve." });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error in forgot-password:", error);
      res.status(500).json({ message: "Erro ao processar a solicitação" });
    }
  });

  app.post("/api/auth/verify-reset-code", async (req: Request, res: Response) => {
    try {
      const { email, code } = z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }).parse(req.body);

      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        return res.status(400).json({ message: "Código inválido ou expirado" });
      }

      const [token] = await db.select().from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.code, code),
          eq(passwordResetTokens.used, "false")
        ));

      if (!token || token.expiresAt < new Date()) {
        return res.status(400).json({ message: "Código inválido ou expirado" });
      }

      res.json({ message: "Código válido", tokenId: token.id });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error in verify-reset-code:", error);
      res.status(500).json({ message: "Erro ao verificar código" });
    }
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, code, newPassword } = z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
      }).parse(req.body);

      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        return res.status(400).json({ message: "Código inválido ou expirado" });
      }

      const [token] = await db.select().from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.code, code),
          eq(passwordResetTokens.used, "false")
        ));

      if (!token || token.expiresAt < new Date()) {
        return res.status(400).json({ message: "Código inválido ou expirado" });
      }

      const passwordHash = await hashPassword(newPassword);
      await db.update(users).set({
        passwordHash,
        lastLogin: null,
        refreshTokenVersion: new Date(),
      }).where(eq(users.id, user.id));
      await db.update(passwordResetTokens).set({ used: "true" }).where(eq(passwordResetTokens.id, token.id));

      res.json({ message: "Senha redefinida com sucesso" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error in reset-password:", error);
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  app.post("/api/external/auth/token", async (req: Request, res: Response) => {
    try {
      const externalAuthSchema = z.object({
        username: z.string().min(1, "Username é obrigatório"),
        password: z.string().min(1, "Senha é obrigatória"),
      });

      const data = externalAuthSchema.parse(req.body);

      const loginInput = data.username.toLowerCase();
      const [user] = await db.select().from(users)
        .where(or(
          eq(users.username, loginInput),
          eq(users.email, loginInput)
        ))
        .limit(1);

      if (!user) {
        return res.status(401).json({ error: "invalid_credentials", message: "Credenciais inválidas" });
      }

      if (user.isActive !== "true") {
        return res.status(403).json({ error: "user_inactive", message: "Usuário inativo" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: "no_password", message: "Usuário sem senha configurada" });
      }

      const isValidPassword = await verifyPassword(data.password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "invalid_credentials", message: "Credenciais inválidas" });
      }

      const driverInfo = await findDriverForUser(user);

      // Motoristas inaptos podem logar normalmente; o filtro de listas/push
      // é aplicado nos endpoints de coletas/transportes/notificações.

      const loginTokenVersion = new Date();
      await db.update(users)
        .set({ lastLogin: loginTokenVersion, refreshTokenVersion: loginTokenVersion })
        .where(eq(users.id, user.id));

      const payload: JwtPayload = {
        userId: user.id,
        username: user.username!,
        email: user.email || undefined,
        role: user.role as UserRole,
        tokenVersion: loginTokenVersion,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: 900,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          driverId: driverInfo?.driverId || null,
          driverType: driverInfo?.driverType || null,
          phone: driverInfo?.phone || null,
          cpf: driverInfo?.cpf || null,
          profilePhoto: driverInfo?.profilePhoto || null,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "validation_error", message: error.errors[0].message });
      }
      console.error("Error in external auth:", error);
      res.status(500).json({ error: "server_error", message: "Erro interno do servidor" });
    }
  });

  app.post("/api/external/auth/refresh", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        refresh_token: z.string().min(1, "Refresh token é obrigatório"),
      });

      const data = schema.parse(req.body);
      const payload = verifyRefreshToken(data.refresh_token);

      if (!payload) {
        return res.status(401).json({ error: "invalid_token", message: "Refresh token inválido ou expirado" });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user || user.isActive !== "true") {
        return res.status(401).json({ error: "user_invalid", message: "Usuário não encontrado ou inativo" });
      }

      if (user.refreshTokenVersion) {
        const storedVersion = new Date(user.refreshTokenVersion).getTime();
        const tokenVersion = payload.tokenVersion ? new Date(payload.tokenVersion).getTime() : 0;
        if (tokenVersion < storedVersion) {
          return res.status(401).json({ error: "token_revoked", message: "Token revogado" });
        }
      }

      // Motoristas inaptos podem renovar token normalmente; o filtro
      // ocorre apenas nas listas de coletas/transportes/push.

      const newTokenVersion = new Date();
      await db.update(users)
        .set({ refreshTokenVersion: newTokenVersion })
        .where(eq(users.id, user.id));

      const newPayload: JwtPayload = {
        userId: user.id,
        username: user.username!,
        role: user.role as UserRole,
        tokenVersion: newTokenVersion,
      };

      res.json({
        access_token: generateAccessToken(newPayload),
        refresh_token: generateRefreshToken(newPayload),
        token_type: "Bearer",
        expires_in: 900,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "validation_error", message: error.errors[0].message });
      }
      console.error("Error refreshing external token:", error);
      res.status(500).json({ error: "server_error", message: "Erro interno do servidor" });
    }
  });

  app.get("/api/external/auth/validate", isAuthenticatedJWT, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ valid: false, error: "invalid_token" });
    }

    const driverInfo = await findDriverForUser(req.user);

    res.json({
      valid: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        driverId: driverInfo?.driverId || null,
        driverType: driverInfo?.driverType || null,
        phone: driverInfo?.phone || null,
        cpf: driverInfo?.cpf || null,
        profilePhoto: driverInfo?.profilePhoto || null,
      },
    });
  });

  // ── Client Portal Login ──────────────────────────────────────────────────────
  app.post("/api/auth/client-login", async (req: Request, res: Response) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }).parse(req.body);

      const [client] = await db.select().from(clients)
        .where(and(
          or(eq(clients.username, username), eq(clients.email, username)),
          eq(clients.isActive, "true")
        ))
        .limit(1);

      if (!client || !client.password) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      const isValid = await bcrypt.compare(password, client.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      const token = generateClientToken({
        clientId: client.id,
        clientName: client.name,
        username: client.username ?? username,
        type: "client",
      });

      return res.json({
        token,
        client: {
          id: client.id,
          name: client.name,
          username: client.username,
          email: client.email,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Client login error:", error);
      return res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  app.get("/api/auth/client-me", isAuthenticatedClientJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [client] = await db.select({
        id: clients.id,
        name: clients.name,
        username: clients.username,
        email: clients.email,
        phone: clients.phone,
        city: clients.city,
        state: clients.state,
      }).from(clients).where(eq(clients.id, req.clientId!)).limit(1);

      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      return res.json(client);
    } catch (error) {
      console.error("Client me error:", error);
      return res.status(500).json({ message: "Erro interno" });
    }
  });
}
