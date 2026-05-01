import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { apiLogs } from "@shared/schema";

const app = express();
const httpServer = createServer(app);

const isProd = process.env.NODE_ENV === "production";

app.use(helmet({
  contentSecurityPolicy: false,
  hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS — libera todas as origens (incluindo preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] as string ||
      "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const LOG_EXCLUDE_PATHS = ["/api/api-logs", "/api/auth/me", "/api/auth/refresh"];
const LOG_EXCLUDE_PREFIXES = ["/api/driver-evaluations/pending", "/api/transport-rate-approvals"];

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      const shouldSkip = LOG_EXCLUDE_PATHS.includes(path) ||
        LOG_EXCLUDE_PREFIXES.some(p => path.startsWith(p));
      if (!shouldSkip) {
        log(logLine);
        const authUser = (req as any).user;
        let bodyPreview: string | undefined;
        if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
          const sanitized = { ...req.body };
          if (sanitized.password) sanitized.password = "***";
          if (sanitized.passwordHash) sanitized.passwordHash = "***";
          if (sanitized.accessToken) sanitized.accessToken = "***";
          if (sanitized.refreshToken) sanitized.refreshToken = "***";
          bodyPreview = JSON.stringify(sanitized).slice(0, 500);
        }
        let responsePreview: string | undefined;
        if (capturedJsonResponse) {
          const sanitized = { ...capturedJsonResponse };
          if (sanitized.accessToken) sanitized.accessToken = "***";
          if (sanitized.refreshToken) sanitized.refreshToken = "***";
          if (sanitized.passwordHash) sanitized.passwordHash = "***";
          responsePreview = JSON.stringify(sanitized);
        }
        db.insert(apiLogs).values({
          method: req.method,
          path: path.slice(0, 500),
          statusCode: res.statusCode,
          durationMs: duration,
          userId: authUser?.userId || null,
          username: authUser?.username || null,
          userRole: authUser?.role || null,
          ipAddress: (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").slice(0, 100),
          requestBody: bodyPreview || null,
          responsePreview: responsePreview || null,
        }).catch(() => {});
      }
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
