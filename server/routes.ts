import { z } from "zod";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { registerJWTAuthRoutes, isAuthenticatedJWT, isAuthenticatedClientJWT, verifyClientToken, verifyAccessToken, hashPassword, type AuthenticatedRequest } from "./auth-jwt";
import * as autentique from "./autentique";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { setupSwagger } from "./swagger";
import * as fs from "fs";
import * as path from "path";
import PDFDocument from "pdfkit";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { initializeApp as firebaseInitApp, cert as firebaseCert, deleteApp as firebaseDeleteApp } from "firebase-admin/app";
import { getMessaging as firebaseGetMessaging } from "firebase-admin/messaging";
import type { App as FirebaseApp } from "firebase-admin/app";
import multer from "multer";
import {
  insertDriverSchema,
  insertDriverDeletionRequestSchema,
  insertSystemVersionSchema,
  systemVersions,
  insertManufacturerSchema,
  insertYardSchema,
  insertClientSchema,
  insertDeliveryLocationSchema,
  insertVehicleSchema,
  insertCollectSchema,
  insertTransportSchema,
  insertSystemUserSchema,
  insertCheckpointSchema,
  insertRouteSchema,
  insertContractSchema,
  contracts,
  contractDrivers,
  type Contract,
  drivers,
  manufacturers,
  yards,
  clients,
  deliveryLocations,
  collects,
  featureKeys,
  systemUsers,
  transports,
  vehicles,
  checkpoints,
  transportCheckpoints,
  driverEvaluations,
  insertDriverEvaluationSchema,
  evaluationCriteria,
  insertEvaluationCriteriaSchema,
  evaluationScores,
  expenseSettlements,
  expenseSettlementItems,
  routes,
  truckModels,
  insertTruckModelSchema,
  travelRates,
  travelRateApprovers,
  insertTravelRateSchema,
  freightQuotes,
  insertFreightQuoteSchema,
  freightContracts,
  insertFreightContractSchema,
  transfers,
  yardMonthlyInvoices,
  yardMonthlyInvoiceItems,
  apiLogs,
  appSettings,
  transportProposals,
  transportProposalItems,
  transportProposalDrivers,
  transportProposalLogs,
  broadcasts,
  broadcastRecipients,
  driverRankingWeights,
  driverStatusLogs,
  chassisRequests,
  insertChassisRequestSchema,
  rolePermissions,
  userTypePermissions,
  type FeatureKey,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ne, desc, or, sql as drizzleSql, inArray, isNotNull, isNull } from "drizzle-orm";
import OpenAI from "openai";
import { users } from "@shared/models/auth";

async function createDefaultAdmin() {
  try {
    const existingAdmin = await db.select().from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (existingAdmin.length === 0) {
      const passwordHash = await hashPassword("admin123");
      await db.insert(users).values({
        username: "admin",
        passwordHash,
        email: "admin@otdentregas.com",
        firstName: "Administrador",
        lastName: "Sistema",
        role: "admin",
        isActive: "true",
      });
      console.log("Default admin user created: admin / admin123");
    }
  } catch (error) {
    console.error("Error creating default admin:", error);
  }
}

async function recalculateIsApto(driverId: string, storage: any): Promise<void> {
  try {
    const driver = await storage.getDriver(driverId);
    if (!driver) return;

    const hasAllDocs = !!(
      driver.cnhFrontPhoto &&
      driver.cnhBackPhoto &&
      driver.rgPhoto &&
      driver.addressProofPhoto
    );

    // Contrato ativo E assinado (via Autentique ou pelo app/manual).
    // Considera tanto vínculo legado (contracts.driverId) quanto N:N (contract_drivers).
    const [activeLegacy] = await db
      .select({ id: contracts.id })
      .from(contracts)
      .where(
        and(
          eq(contracts.driverId, driverId),
          eq(contracts.status, "ativo"),
          or(
            eq(contracts.autentiqueStatus, "assinado"),
            isNotNull(contracts.driverSignedAt)
          )
        )
      )
      .limit(1);
    let hasActiveContract = !!activeLegacy;
    if (!hasActiveContract) {
      const [activeJunction] = await db
        .select({ id: contracts.id })
        .from(contractDrivers)
        .innerJoin(contracts, eq(contractDrivers.contractId, contracts.id))
        .where(
          and(
            eq(contractDrivers.driverId, driverId),
            eq(contracts.status, "ativo"),
            or(
              eq(contractDrivers.autentiqueStatus, "assinado"),
              isNotNull(contractDrivers.driverSignedAt)
            )
          )
        )
        .limit(1);
      hasActiveContract = !!activeJunction;
    }

    const newIsApto = hasAllDocs && hasActiveContract ? "true" : "false";
    if (driver.isApto !== newIsApto) {
      await storage.updateDriver(driverId, { isApto: newIsApto });
    }
  } catch (err) {
    console.error("recalculateIsApto error:", err);
  }
}

// ── Firebase Admin SDK helper ─────────────────────────────────────────────────
let _adminApp: FirebaseApp | null = null;
let _adminSaFingerprint: string | null = null;

function getFirebaseAdminApp(serviceAccountJson: string): FirebaseApp {
  const fingerprint = serviceAccountJson.slice(0, 80);
  if (_adminApp && _adminSaFingerprint === fingerprint) return _adminApp;
  // Delete stale app if service account changed
  if (_adminApp) { try { firebaseDeleteApp(_adminApp); } catch { /* ignore */ } }
  const sa = JSON.parse(serviceAccountJson);
  _adminApp = firebaseInitApp(
    { credential: firebaseCert(sa) },
    `otd-${Date.now()}`
  );
  _adminSaFingerprint = fingerprint;
  return _adminApp;
}

async function sendPushViaAdminSDK(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  serviceAccountJson: string
): Promise<void> {
  const adminApp = getFirebaseAdminApp(serviceAccountJson);
  await firebaseGetMessaging(adminApp).send({ notification: { title, body }, data, token });
}
// ── Interpolate push template ─────────────────────────────────────────────────
function interpolateTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

const DEFAULT_NOVA_PROPOSTA_TITLE = "Nova Proposta de Transporte ({numero})";
const DEFAULT_NOVA_PROPOSTA_BODY = "Origem: {origem} → Destino: {destino}\nData: {data}\nDistância: {distancia}\nValor: {valor}";

async function buildProposalPushContent(proposal: {
  id: string; proposalNumber: string | null; originYardId: string;
  deliveryLocationId: string; startDate: Date | string | null;
  distanceKm: string | number | null; estimatedValue: string | number | null;
}, getYard: (id: string) => Promise<any>, getDeliveryLocation: (id: string) => Promise<any>
): Promise<{ title: string; body: string; data: Record<string, string> }> {
  const [templateRows, originYard, deliveryLocation] = await Promise.all([
    db.select().from(appSettings).where(
      drizzleSql`${appSettings.key} IN ('push_template_nova_proposta_title', 'push_template_nova_proposta_body')`
    ),
    getYard(proposal.originYardId),
    getDeliveryLocation(proposal.deliveryLocationId),
  ]);
  const tplMap = Object.fromEntries(templateRows.map(r => [r.key, r.value ?? ""]));

  const originLabel = originYard
    ? `${originYard.city}${originYard.state ? `/${originYard.state}` : ""}`
    : "—";
  const destLabel = deliveryLocation
    ? `${deliveryLocation.city}${deliveryLocation.state ? `/${deliveryLocation.state}` : ""}`
    : "—";
  const startDateFmt = proposal.startDate
    ? new Date(proposal.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const distanceLabel = proposal.distanceKm
    ? `${Number(proposal.distanceKm).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`
    : "—";
  const valueLabel = proposal.estimatedValue
    ? `R$ ${Number(proposal.estimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

  const vars: Record<string, string> = {
    numero: proposal.proposalNumber ?? "",
    origem: originLabel,
    destino: destLabel,
    data: startDateFmt,
    distancia: distanceLabel,
    valor: valueLabel,
  };

  const titleTpl = tplMap.push_template_nova_proposta_title || DEFAULT_NOVA_PROPOSTA_TITLE;
  const bodyTpl = tplMap.push_template_nova_proposta_body || DEFAULT_NOVA_PROPOSTA_BODY;

  return {
    title: interpolateTemplate(titleTpl, vars),
    body: interpolateTemplate(bodyTpl, vars),
    data: { type: "nova_proposta", proposalId: proposal.id, proposalNumber: proposal.proposalNumber ?? "" },
  };
}

// ── Send push to all active drivers (fire-and-forget) ─────────────────────────
async function sendPushToAllActiveDrivers(
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  try {
    const settingRows = await db.select().from(appSettings).where(
      drizzleSql`${appSettings.key} IN ('firebase_service_account_json', 'firebase_server_key')`
    );
    const settingsMap = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
    const saJson = settingsMap.firebase_service_account_json;
    const serverKey = settingsMap.firebase_server_key;

    if (!saJson && !serverKey) return; // Firebase not configured, skip silently

    const activeDrivers = await db.select({
      id: drivers.id, name: drivers.name, deviceToken: drivers.deviceToken,
    }).from(drivers).where(and(eq(drivers.isActive, "true"), eq(drivers.isApto, "true")));

    const eligible = activeDrivers.filter(d => d.deviceToken?.trim());
    if (eligible.length === 0) return;

    await Promise.allSettled(eligible.map(async (driver) => {
      try {
        if (saJson) {
          await sendPushViaAdminSDK(driver.deviceToken!, title, body, data, saJson);
        } else {
          const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: { "Authorization": `key=${serverKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ to: driver.deviceToken, notification: { title, body }, data }),
          });
          const fcmBody = await fcmRes.json() as any;
          if (!fcmRes.ok || (fcmBody.success ?? 0) === 0) {
            const errMsg = fcmBody.results?.[0]?.error ?? `HTTP ${fcmRes.status}`;
            throw new Error(errMsg);
          }
        }
      } catch (e: any) {
        console.warn(`Push failed for driver ${driver.name}:`, e?.message);
      }
    }));
  } catch (e: any) {
    console.warn("sendPushToAllActiveDrivers error:", e?.message);
  }
}
// ── Send push to a single driver (fire-and-forget) ────────────────────────────
async function sendPushToDriver(
  driverId: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  try {
    const settingRows = await db.select().from(appSettings).where(
      drizzleSql`${appSettings.key} IN ('firebase_service_account_json', 'firebase_server_key')`
    );
    const settingsMap = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
    const saJson = settingsMap.firebase_service_account_json;
    const serverKey = settingsMap.firebase_server_key;
    if (!saJson && !serverKey) return;

    const [driver] = await db.select({
      id: drivers.id,
      name: drivers.name,
      deviceToken: drivers.deviceToken,
      isActive: drivers.isActive,
      isApto: drivers.isApto,
    })
      .from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!driver?.deviceToken?.trim()) return;
    if (driver.isActive !== "true" || driver.isApto !== "true") return;

    try {
      if (saJson) {
        await sendPushViaAdminSDK(driver.deviceToken, title, body, data, saJson);
      } else {
        const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: { "Authorization": `key=${serverKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ to: driver.deviceToken, notification: { title, body }, data }),
        });
        const fcmBody = await fcmRes.json() as any;
        if (!fcmRes.ok || (fcmBody.success ?? 0) === 0) {
          throw new Error(fcmBody.results?.[0]?.error ?? `HTTP ${fcmRes.status}`);
        }
      }
    } catch (e: any) {
      console.warn(`Push failed for driver ${driver.name}:`, e?.message);
    }
  } catch (e: any) {
    console.warn("sendPushToDriver error:", e?.message);
  }
}

// ── Send push to all accepted-but-unassigned drivers of a proposal ─────────────
async function sendPushToUnassignedAcceptedDrivers(
  proposalId: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  try {
    const settingRows = await db.select().from(appSettings).where(
      drizzleSql`${appSettings.key} IN ('firebase_service_account_json', 'firebase_server_key')`
    );
    const settingsMap = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
    const saJson = settingsMap.firebase_service_account_json;
    const serverKey = settingsMap.firebase_server_key;
    if (!saJson && !serverKey) return;

    // Find all accepted but unassigned driver entries for this proposal
    const entries = await db.select().from(transportProposalDrivers).where(
      and(
        eq(transportProposalDrivers.proposalId, proposalId),
        eq(transportProposalDrivers.status, "aceito"),
        drizzleSql`${transportProposalDrivers.assignedTransportId} IS NULL`
      )
    );
    if (entries.length === 0) return;

    const driverIds = entries.map(e => e.driverId);
    const driverRows = await db.select({ id: drivers.id, name: drivers.name, deviceToken: drivers.deviceToken, isActive: drivers.isActive, isApto: drivers.isApto })
      .from(drivers)
      .where(drizzleSql`${drivers.id} = ANY(ARRAY[${drizzleSql.raw(driverIds.map(id => `'${id}'`).join(","))}]::text[])`);

    const eligible = driverRows.filter(d => d.deviceToken?.trim() && d.isActive === "true" && d.isApto === "true");
    if (eligible.length === 0) return;

    await Promise.allSettled(eligible.map(async (driver) => {
      try {
        if (saJson) {
          await sendPushViaAdminSDK(driver.deviceToken!, title, body, data, saJson);
        } else {
          const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: { "Authorization": `key=${serverKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ to: driver.deviceToken, notification: { title, body }, data }),
          });
          const fcmBody = await fcmRes.json() as any;
          if (!fcmRes.ok || (fcmBody.success ?? 0) === 0) {
            throw new Error(fcmBody.results?.[0]?.error ?? `HTTP ${fcmRes.status}`);
          }
        }
      } catch (e: any) {
        console.warn(`Push failed for driver ${driver.name}:`, e?.message);
      }
    }));
  } catch (e: any) {
    console.warn("sendPushToUnassignedAcceptedDrivers error:", e?.message);
  }
}

// ── Build push content: proposal closed, driver not selected ──────────────────
async function buildNotSelectedPushContent(proposal: {
  id: string; proposalNumber: string | null; originYardId: string;
  deliveryLocationId: string; startDate: Date | string | null;
  distanceKm: string | number | null;
},
  getYard: (id: string) => Promise<any>,
  getDeliveryLocation: (id: string) => Promise<any>
): Promise<{ title: string; body: string; data: Record<string, string> }> {
  const [originYard, deliveryLocation] = await Promise.all([
    getYard(proposal.originYardId),
    getDeliveryLocation(proposal.deliveryLocationId),
  ]);

  const originLabel = originYard
    ? `${originYard.city}${originYard.state ? `/${originYard.state}` : ""}`
    : "—";
  const destLabel = deliveryLocation
    ? `${deliveryLocation.city}${deliveryLocation.state ? `/${deliveryLocation.state}` : ""}`
    : "—";

  const title = `Proposta ${proposal.proposalNumber ?? ""} encerrada`;
  const body = `As vagas desta proposta foram preenchidas e você não foi selecionado.\nOrigem: ${originLabel} → Destino: ${destLabel}`;

  return {
    title,
    body,
    data: {
      type: "proposta_encerrada_nao_selecionado",
      proposalId: proposal.id,
      proposalNumber: proposal.proposalNumber ?? "",
    },
  };
}

// ── Build push content: driver removed from transport ─────────────────────────
async function buildRemovedFromTransportPushContent(proposal: {
  id: string; proposalNumber: string | null; originYardId: string;
  deliveryLocationId: string;
},
  transportRequestNumber: string | null,
  getYard: (id: string) => Promise<any>,
  getDeliveryLocation: (id: string) => Promise<any>
): Promise<{ title: string; body: string; data: Record<string, string> }> {
  const [originYard, deliveryLocation] = await Promise.all([
    getYard(proposal.originYardId),
    getDeliveryLocation(proposal.deliveryLocationId),
  ]);

  const originLabel = originYard
    ? `${originYard.city}${originYard.state ? `/${originYard.state}` : ""}`
    : "—";
  const destLabel = deliveryLocation
    ? `${deliveryLocation.city}${deliveryLocation.state ? `/${deliveryLocation.state}` : ""}`
    : "—";

  const title = `⚠️ Transporte cancelado — Proposta ${proposal.proposalNumber ?? ""}`;
  const body = [
    `Você foi removido do transporte ${transportRequestNumber ?? "—"}.`,
    `Origem: ${originLabel} → Destino: ${destLabel}`,
    `Entre em contato com a equipe OTD para mais informações.`,
  ].join("\n");

  return {
    title,
    body,
    data: {
      type: "motorista_removido_transporte",
      proposalId: proposal.id,
      proposalNumber: proposal.proposalNumber ?? "",
      transportNumber: transportRequestNumber ?? "",
    },
  };
}

// ── Build push content for driver assignment to proposal transport ─────────────
async function buildAssignedToPushContent(proposal: {
  id: string; proposalNumber: string | null; originYardId: string;
  deliveryLocationId: string; startDate: Date | string | null;
  distanceKm: string | number | null; estimatedValue: string | number | null;
  travelRateId?: string | null;
}, transportRequestNumber: string | null,
  getYard: (id: string) => Promise<any>,
  getDeliveryLocation: (id: string) => Promise<any>
): Promise<{ title: string; body: string; data: Record<string, string> }> {
  const [originYard, deliveryLocation] = await Promise.all([
    getYard(proposal.originYardId),
    getDeliveryLocation(proposal.deliveryLocationId),
  ]);

  const originLabel = originYard
    ? `${originYard.name} — ${originYard.city}${originYard.state ? `/${originYard.state}` : ""}`
    : "—";
  const destLabel = deliveryLocation
    ? `${deliveryLocation.name} — ${deliveryLocation.city}${deliveryLocation.state ? `/${deliveryLocation.state}` : ""}`
    : "—";
  const startDateFmt = proposal.startDate
    ? new Date(proposal.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
  const distanceLabel = proposal.distanceKm
    ? `${Number(proposal.distanceKm).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`
    : "—";

  const title = `✅ Você foi selecionado! Proposta ${proposal.proposalNumber ?? ""}`;
  const body = [
    `Transporte: ${transportRequestNumber ?? "—"}`,
    `Origem: ${originLabel}`,
    `Destino: ${destLabel}`,
    `Data prevista: ${startDateFmt}`,
    `Distância: ${distanceLabel}`,
  ].join("\n");

  return {
    title,
    body,
    data: {
      type: "motorista_atribuido",
      proposalId: proposal.id,
      proposalNumber: proposal.proposalNumber ?? "",
      transportNumber: transportRequestNumber ?? "",
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const INAPTO_MSG =
  "Motorista inapto. Você não pode receber novas coletas ou transportes. Entre em contato com a transportadora para regularizar sua situação.";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await createDefaultAdmin();
  registerJWTAuthRoutes(app);
  registerObjectStorageRoutes(app);
  setupSwagger(app);

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const multerStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  });
  const upload = multer({ storage: multerStorage, limits: { fileSize: 10 * 1024 * 1024 } });

  // Smart storage for driver registration: validates CPF/email before saving files to disk.
  // In multipart/form-data, text fields arrive before binary files, so by the time
  // the first _handleFile() is called, req.body already contains cpf/email.
  class RegistrationStorage {
    _handleFile(req: any, file: Express.Multer.File, cb: (error?: any, info?: Partial<Express.Multer.File>) => void) {
      // If a prior validation already failed, drain without saving
      if (req._registrationError) {
        (file as any).stream.resume();
        return cb(null, { fieldname: file.fieldname, filename: "", path: "", size: 0 } as any);
      }

      const checkAndSave = () => {
        const cpf = req.body?.cpf?.replace(/\D/g, "");
        const email = req.body?.email?.trim();

        const checks: Promise<void>[] = [];

        if (cpf && !req._cpfChecked) {
          req._cpfChecked = true;
          checks.push(
            db.select({ id: drivers.id }).from(drivers).where(eq(drivers.cpf, cpf)).limit(1).then(([existing]) => {
              if (existing) req._registrationError = { status: 409, message: "CPF já cadastrado no sistema" };
            })
          );
        }
        if (email && !req._emailChecked) {
          req._emailChecked = true;
          checks.push(
            db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).then(([existing]) => {
              if (existing) req._registrationError = { status: 409, message: "E-mail já cadastrado no sistema" };
            })
          );
        }

        Promise.all(checks).then(() => {
          if (req._registrationError) {
            (file as any).stream.resume();
            return cb(null, { fieldname: file.fieldname, filename: "", path: "", size: 0 } as any);
          }

          const ext = path.extname(file.originalname || "") || ".jpg";
          const filename = `${randomUUID()}${ext}`;
          const filepath = path.join(uploadsDir, filename);
          const outStream = fs.createWriteStream(filepath);
          (file as any).stream.pipe(outStream);
          outStream.on("finish", () => cb(null, { filename, path: filepath, size: outStream.bytesWritten } as any));
          outStream.on("error", cb);
        }).catch(cb);
      };

      checkAndSave();
    }

    _removeFile(_req: any, file: Express.Multer.File & { path?: string }, cb: (error: Error | null) => void) {
      if (file.path) {
        fs.unlink(file.path, (err) => cb(err || null));
      } else {
        cb(null);
      }
    }
  }

  const uploadForRegistration = multer({
    storage: new RegistrationStorage() as any,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.post("/api/uploads/local", isAuthenticatedJWT, async (req, res) => {
    try {
      const { data, filename, contentType } = req.body;
      if (!data || !filename) {
        return res.status(400).json({ error: "Missing data or filename" });
      }

      // Remove base64 prefix if present
      const base64Data = data.replace(/^data:.*;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const ext = path.extname(filename) || ".jpg";
      const uniqueFilename = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      fs.writeFileSync(filePath, buffer);

      res.json({
        objectPath: `/uploads/${uniqueFilename}`,
        filename: uniqueFilename,
      });
    } catch (error) {
      console.error("Error uploading file locally:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Serve uploaded files
  app.get("/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // Dashboard
  app.get("/api/dashboard/stats", isAuthenticatedJWT, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/indicadores", isAuthenticatedJWT, async (req, res) => {
    try {
      const period = (req.query.period as string) || "6";
      const monthsBack = parseInt(period, 10) || 6;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - monthsBack);

      const allTransports = await storage.getTransports();
      const allCollects = await storage.getCollects();

      const allDelivered = allTransports.filter((t: any) => t.status === "entregue");

      const delivered = allDelivered.filter((t: any) => {
        const checkout = t.checkoutDateTime ? new Date(t.checkoutDateTime) : null;
        return checkout && checkout >= cutoff;
      });

      const relevantTransports = allTransports.filter((t: any) => {
        const created = t.createdAt ? new Date(t.createdAt) : null;
        return created && created >= cutoff;
      });

      let onTimeCount = 0;
      let lateCount = 0;
      let insufficientDataCount = 0;
      let damageFreeCount = 0;
      let withDamageCount = 0;
      let otifCount = 0;
      let totalLeadTimeHours = 0;
      let leadTimeCount = 0;

      const monthlyData: Record<string, { total: number; onTime: number; damageFree: number; otif: number; totalLeadTime: number; leadTimeEntries: number }> = {};

      for (const t of delivered) {
        const checkoutTime = t.checkoutDateTime ? new Date(t.checkoutDateTime) : null;
        const deliveryDate = t.deliveryDate ? new Date(t.deliveryDate) : null;
        const transitStart = t.transitStartedAt ? new Date(t.transitStartedAt) : (t.checkinDateTime ? new Date(t.checkinDateTime) : null);

        const hasOtdData = checkoutTime && deliveryDate;
        const isOnTime = hasOtdData ? checkoutTime <= deliveryDate : false;
        const hasDamage = t.checkoutDamagePhotos && Array.isArray(t.checkoutDamagePhotos) && t.checkoutDamagePhotos.length > 0;
        const isDamageFree = !hasDamage;
        const isOtif = isOnTime && isDamageFree;

        if (!hasOtdData) {
          insufficientDataCount++;
        } else if (isOnTime) {
          onTimeCount++;
        } else {
          lateCount++;
        }
        if (isDamageFree) damageFreeCount++; else withDamageCount++;
        if (isOtif) otifCount++;

        if (checkoutTime && transitStart) {
          const diffHours = (checkoutTime.getTime() - transitStart.getTime()) / (1000 * 60 * 60);
          if (diffHours > 0 && diffHours < 720) {
            totalLeadTimeHours += diffHours;
            leadTimeCount++;
          }
        }

        const monthKey = checkoutTime
          ? `${checkoutTime.getFullYear()}-${String(checkoutTime.getMonth() + 1).padStart(2, "0")}`
          : null;
        if (monthKey) {
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, onTime: 0, damageFree: 0, otif: 0, totalLeadTime: 0, leadTimeEntries: 0 };
          }
          monthlyData[monthKey].total++;
          if (isOnTime) monthlyData[monthKey].onTime++;
          if (isDamageFree) monthlyData[monthKey].damageFree++;
          if (isOtif) monthlyData[monthKey].otif++;
          if (checkoutTime && transitStart) {
            const diffH = (checkoutTime.getTime() - transitStart.getTime()) / (1000 * 60 * 60);
            if (diffH > 0 && diffH < 720) {
              monthlyData[monthKey].totalLeadTime += diffH;
              monthlyData[monthKey].leadTimeEntries++;
            }
          }
        }
      }

      const totalDelivered = delivered.length;
      const otdEligible = onTimeCount + lateCount;
      const otdRate = otdEligible > 0 ? (onTimeCount / otdEligible) * 100 : 0;
      const damageFreeRate = totalDelivered > 0 ? (damageFreeCount / totalDelivered) * 100 : 0;
      const otifEligible = otdEligible;
      const otifRate = otifEligible > 0 ? (otifCount / otifEligible) * 100 : 0;
      const avgLeadTimeHours = leadTimeCount > 0 ? totalLeadTimeHours / leadTimeCount : 0;

      const monthNames: Record<string, string> = {
        "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
        "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
        "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
      };

      const sortedMonths = Object.keys(monthlyData).sort();
      const monthlyTrend = sortedMonths.map((key) => {
        const d = monthlyData[key];
        const [, mm] = key.split("-");
        return {
          name: monthNames[mm] || mm,
          otd: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0,
          damageFree: d.total > 0 ? Math.round((d.damageFree / d.total) * 100) : 0,
          otif: d.total > 0 ? Math.round((d.otif / d.total) * 100) : 0,
          leadTime: d.leadTimeEntries > 0 ? Math.round((d.totalLeadTime / d.leadTimeEntries) * 10) / 10 : 0,
          total: d.total,
        };
      });

      const collectDamage = allCollects.filter((c: any) => {
        const created = c.createdAt ? new Date(c.createdAt) : null;
        return created && created >= cutoff;
      });
      const collectsFinished = collectDamage.filter((c: any) => c.status === "finalizada");
      const collectsWithDamage = collectsFinished.filter((c: any) =>
        c.checkoutDamagePhotos && Array.isArray(c.checkoutDamagePhotos) && c.checkoutDamagePhotos.length > 0
      );

      res.json({
        summary: {
          totalDelivered,
          totalTransports: relevantTransports.length,
          otdRate: Math.round(otdRate * 10) / 10,
          damageFreeRate: Math.round(damageFreeRate * 10) / 10,
          otifRate: Math.round(otifRate * 10) / 10,
          avgLeadTimeHours: Math.round(avgLeadTimeHours * 10) / 10,
          onTimeCount,
          lateCount,
          damageFreeCount,
          withDamageCount,
          otifCount,
          collectsTotal: collectsFinished.length,
          collectsWithDamage: collectsWithDamage.length,
          insufficientDataCount,
        },
        monthlyTrend,
      });
    } catch (error) {
      console.error("Error fetching indicators:", error);
      res.status(500).json({ message: "Failed to fetch indicators" });
    }
  });

  app.get("/api/dashboard/analytics", isAuthenticatedJWT, async (req, res) => {
    try {
      const period = req.query.period as string || "all";
      
      const [allTransports, allCollects, drivers, vehicles, expenseSettlements] = await Promise.all([
        storage.getTransports(),
        storage.getCollects(),
        storage.getDrivers(),
        storage.getVehicles(),
        storage.getExpenseSettlements(),
      ]);

      const now = new Date();
      let startDate: Date | null = null;
      
      if (period === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === "quarter") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      } else if (period === "semester") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      }

      const filterByPeriod = (item: { createdAt?: Date | string | null }) => {
        if (!startDate) return true;
        if (!item.createdAt) return false;
        const itemDate = new Date(item.createdAt);
        return itemDate >= startDate;
      };

      const transports = allTransports.filter(filterByPeriod);
      const collects = allCollects.filter(filterByPeriod);

      const transportsByStatus = {
        pendente: transports.filter(t => t.status === "pendente").length,
        aguardando_saida: transports.filter(t => t.status === "aguardando_saida").length,
        em_transito: transports.filter(t => t.status === "em_transito").length,
        entregue: transports.filter(t => t.status === "entregue").length,
        cancelado: transports.filter(t => t.status === "cancelado").length,
      };

      const collectsByStatus = {
        pendente: collects.filter(c => c.status === "pendente").length,
        em_transito: collects.filter(c => c.status === "em_transito").length,
        entregue: collects.filter(c => c.status === "entregue").length,
        cancelado: collects.filter(c => c.status === "cancelado").length,
      };

      const currentDate = new Date();
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - i), 1);
        return { month: d.toLocaleString("pt-BR", { month: "short" }), year: d.getFullYear() };
      });

      const transportsByMonth = last6Months.map(({ month, year }) => {
        const count = transports.filter(t => {
          if (!t.createdAt) return false;
          const d = new Date(t.createdAt);
          return d.toLocaleString("pt-BR", { month: "short" }) === month && d.getFullYear() === year;
        }).length;
        return { name: month.charAt(0).toUpperCase() + month.slice(1), transportes: count };
      });

      const collectsByMonth = last6Months.map(({ month, year }) => {
        const count = collects.filter(c => {
          if (!c.createdAt) return false;
          const d = new Date(c.createdAt);
          return d.toLocaleString("pt-BR", { month: "short" }) === month && d.getFullYear() === year;
        }).length;
        return { name: month.charAt(0).toUpperCase() + month.slice(1), coletas: count };
      });

      const driverPerformance = drivers.filter(d => d.active).map(driver => {
        const driverTransports = transports.filter(t => t.driverId === driver.id);
        const completed = driverTransports.filter(t => t.status === "entregue").length;
        const inProgress = driverTransports.filter(t => ["em_transito", "aguardando_saida"].includes(t.status)).length;
        return {
          name: driver.name.split(" ")[0],
          entregues: completed,
          emAndamento: inProgress,
          total: driverTransports.length,
        };
      }).sort((a, b) => b.total - a.total).slice(0, 8);

      const totalExpenses = expenseSettlements.reduce((sum, s) => sum + parseFloat(s.totalAmount || "0"), 0);
      const approvedSettlements = expenseSettlements.filter(s => s.status === "aprovado").length;
      const pendingSettlements = expenseSettlements.filter(s => ["rascunho", "enviado"].includes(s.status)).length;

      const totalDistanceKm = transports.reduce((sum, t) => sum + parseFloat(t.routeDistanceKm || "0"), 0);
      const avgDeliveryTime = transports.filter(t => t.status === "entregue" && t.deliveredAt && t.exitAt)
        .reduce((acc, t, _, arr) => {
          const diff = (new Date(t.deliveredAt!).getTime() - new Date(t.exitAt!).getTime()) / (1000 * 60 * 60);
          return acc + diff / arr.length;
        }, 0);

      const deliveredTransports = transports.filter(t => t.status === "entregue" && t.deliveryDate && t.checkoutDateTime);
      const onTimeDeliveries = deliveredTransports.filter(t => {
        const checkoutDate = new Date(t.checkoutDateTime!);
        const plannedDate = new Date(t.deliveryDate!);
        checkoutDate.setHours(0, 0, 0, 0);
        plannedDate.setHours(0, 0, 0, 0);
        return checkoutDate <= plannedDate;
      });
      const deliveryRate = deliveredTransports.length > 0
        ? Math.round((onTimeDeliveries.length / deliveredTransports.length) * 100)
        : 0;

      res.json({
        transportsByStatus,
        collectsByStatus,
        transportsByMonth,
        collectsByMonth,
        driverPerformance,
        financials: {
          totalExpenses,
          approvedSettlements,
          pendingSettlements,
          totalSettlements: expenseSettlements.length,
        },
        metrics: {
          totalTransports: transports.length,
          totalCollects: collects.length,
          totalDrivers: drivers.filter(d => d.active).length,
          totalVehicles: vehicles.length,
          vehiclesInStock: vehicles.filter(v => v.status === "em_estoque").length,
          totalDistanceKm: Math.round(totalDistanceKm),
          avgDeliveryTimeHours: Math.round(avgDeliveryTime * 10) / 10,
          deliveryRate,
          onTimeDeliveries: onTimeDeliveries.length,
          totalDeliveredWithDate: deliveredTransports.length,
        },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Dashboard - Yard Stats
  app.get("/api/dashboard/yard-stats", isAuthenticatedJWT, async (req, res) => {
    try {
      const [allYards, allVehicles] = await Promise.all([
        db.select().from(yards),
        db.select().from(vehicles),
      ]);

      const statusLabels: Record<string, string> = {
        pre_estoque: "Pré-Estoque",
        em_estoque: "Em Estoque",
        em_transferencia: "Em Transferência",
        despachado: "Despachado",
        entregue: "Entregue",
        retirado: "Retirado",
      };

      const yardStats = allYards.map((yard) => {
        const yardVehicles = allVehicles.filter((v) => v.yardId === yard.id);
        const byStatus: Record<string, string[]> = {};
        for (const v of yardVehicles) {
          const st = v.status ?? "pre_estoque";
          if (!byStatus[st]) byStatus[st] = [];
          byStatus[st].push(v.chassi);
        }
        const statusBreakdown = Object.entries(byStatus).map(([status, chassis]) => ({
          status,
          label: statusLabels[status] ?? status,
          count: chassis.length,
          chassis,
        }));
        return {
          id: yard.id,
          name: yard.name,
          city: yard.city,
          state: yard.state,
          total: yardVehicles.length,
          statusBreakdown,
        };
      });

      const totals = {
        totalYards: allYards.length,
        totalVehicles: allVehicles.length,
        em_estoque: allVehicles.filter((v) => v.status === "em_estoque").length,
        pre_estoque: allVehicles.filter((v) => v.status === "pre_estoque").length,
        em_transferencia: allVehicles.filter((v) => v.status === "em_transferencia").length,
        despachado: allVehicles.filter((v) => v.status === "despachado").length,
      };

      res.json({ yardStats, totals });
    } catch (error) {
      console.error("Error fetching yard stats:", error);
      res.status(500).json({ message: "Failed to fetch yard stats" });
    }
  });

  app.get("/api/dashboard/operation", isAuthenticatedJWT, async (req, res) => {
    try {
      const allTransports = await db.select().from(transports);
      const allDriversList = await db.select().from(drivers);
      const allYardsList = await db.select().from(yards);
      const allClientsList = await db.select().from(clients);
      const allDeliveryLocs = await db.select().from(deliveryLocations);
      const allVehiclesList = await db.select().from(vehicles);

      const now = new Date();

      const activeStatuses = ["pendente", "aguardando_saida", "em_transito"];
      const activeTransports = allTransports.filter(t => activeStatuses.includes(t.status));

      const upcomingTransports = activeTransports
        .filter(t => t.scheduledDeparture && new Date(t.scheduledDeparture) >= now)
        .sort((a, b) => new Date(a.scheduledDeparture!).getTime() - new Date(b.scheduledDeparture!).getTime())
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          requestNumber: t.requestNumber,
          status: t.status,
          scheduledDeparture: t.scheduledDeparture,
          driverId: t.driverId,
          driverName: t.driverId ? allDriversList.find(d => d.id === t.driverId)?.name ?? null : null,
          vehicleChassi: t.vehicleChassi,
          vehicleModel: allVehiclesList.find(v => v.chassi === t.vehicleChassi)?.model ?? null,
          vehicleBrand: allVehiclesList.find(v => v.chassi === t.vehicleChassi)?.brand ?? null,
          originYardName: allYardsList.find(y => y.id === t.originYardId)?.name ?? null,
          clientName: allClientsList.find(c => c.id === t.clientId)?.name ?? null,
          deliveryLocationName: allDeliveryLocs.find(dl => dl.id === t.deliveryLocationId)?.name ?? null,
        }));

      const noDriverTransports = activeTransports
        .filter(t => !t.driverId)
        .sort((a, b) => {
          if (a.scheduledDeparture && b.scheduledDeparture) return new Date(a.scheduledDeparture).getTime() - new Date(b.scheduledDeparture).getTime();
          if (a.scheduledDeparture) return -1;
          if (b.scheduledDeparture) return 1;
          return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
        })
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          requestNumber: t.requestNumber,
          status: t.status,
          scheduledDeparture: t.scheduledDeparture,
          vehicleChassi: t.vehicleChassi,
          vehicleModel: allVehiclesList.find(v => v.chassi === t.vehicleChassi)?.model ?? null,
          vehicleBrand: allVehiclesList.find(v => v.chassi === t.vehicleChassi)?.brand ?? null,
          originYardName: allYardsList.find(y => y.id === t.originYardId)?.name ?? null,
          clientName: allClientsList.find(c => c.id === t.clientId)?.name ?? null,
          deliveryLocationName: allDeliveryLocs.find(dl => dl.id === t.deliveryLocationId)?.name ?? null,
          createdAt: t.createdAt,
        }));

      res.json({
        upcomingTransports,
        noDriverTransports,
        stats: {
          totalActive: activeTransports.length,
          totalUpcoming: activeTransports.filter(t => t.scheduledDeparture && new Date(t.scheduledDeparture) >= now).length,
          totalNoDriver: activeTransports.filter(t => !t.driverId).length,
          totalInTransit: activeTransports.filter(t => t.status === "em_transito").length,
          totalPending: activeTransports.filter(t => t.status === "pendente").length,
          totalAwaitingDeparture: activeTransports.filter(t => t.status === "aguardando_saida").length,
        },
      });
    } catch (error: any) {
      console.error("Error fetching operation dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Justified Proposals Report
  app.get("/api/reports/justified-proposals", isAuthenticatedJWT, async (req, res) => {
    try {
      const rows = await db
        .select()
        .from(transportProposalDrivers)
        .where(drizzleSql`${transportProposalDrivers.rankJustification} IS NOT NULL`)
        .orderBy(desc(transportProposalDrivers.createdAt));

      const results = await Promise.all(rows.map(async (row) => {
        const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, row.proposalId));
        const [driver] = await db.select().from(drivers).where(eq(drivers.id, row.driverId));
        const transport = row.assignedTransportId
          ? await db.select().from(transports).where(eq(transports.id, row.assignedTransportId)).then(r => r[0] ?? null)
          : null;

        // User who assigned the driver (from the linked transport)
        let assignedByUserName: string | null = null;
        if (transport?.driverAssignedByUserId) {
          const [assignedUser] = await db.select({ name: systemUsers.name })
            .from(systemUsers)
            .where(eq(systemUsers.id, transport.driverAssignedByUserId));
          assignedByUserName = assignedUser?.name ?? null;
        }

        // Count superior drivers: other aceito drivers in same proposal (all would have been ranked above or equal)
        const otherAceitos = await db
          .select({ count: drizzleSql<number>`count(*)::int` })
          .from(transportProposalDrivers)
          .where(drizzleSql`${transportProposalDrivers.proposalId} = ${row.proposalId}
            AND ${transportProposalDrivers.status} = 'aceito'
            AND ${transportProposalDrivers.id} != ${row.id}`);
        const superiorDriversCount = otherAceitos[0]?.count ?? 0;

        // User who closed the case
        let caseClosedByName: string | null = null;
        if (row.caseClosedBy) {
          const [closedUser] = await db.select({ name: systemUsers.name })
            .from(systemUsers)
            .where(eq(systemUsers.id, row.caseClosedBy));
          caseClosedByName = closedUser?.name ?? null;
        }

        return {
          id: row.id,
          proposalId: row.proposalId,
          proposalNumber: proposal?.proposalNumber ?? null,
          proposalStatus: proposal?.status ?? null,
          driverId: row.driverId,
          driverName: driver?.name ?? null,
          driverCpf: driver?.cpf ?? null,
          assignedTransportId: row.assignedTransportId ?? null,
          transportRequestNumber: transport?.requestNumber ?? null,
          assignedByUserName,
          superiorDriversCount,
          rankJustification: row.rankJustification,
          caseStatus: row.caseStatus ?? "aberto",
          caseNotes: row.caseNotes ?? null,
          caseClosedAt: row.caseClosedAt ?? null,
          caseClosedBy: row.caseClosedBy ?? null,
          caseClosedByName,
          respondedAt: row.respondedAt ?? null,
          createdAt: row.createdAt ?? null,
        };
      }));

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/reports/justified-proposals/:id/close", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { notes } = req.body;
      const userId = req.user?.id ?? null;
      const [updated] = await db
        .update(transportProposalDrivers)
        .set({
          caseStatus: "fechado",
          caseNotes: notes ?? null,
          caseClosedAt: new Date(),
          caseClosedBy: userId,
        })
        .where(eq(transportProposalDrivers.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Registro não encontrado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/reports/justified-proposals/:id/reopen", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const [updated] = await db
        .update(transportProposalDrivers)
        .set({ caseStatus: "aberto", caseNotes: null, caseClosedAt: null, caseClosedBy: null })
        .where(eq(transportProposalDrivers.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Registro não encontrado" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Yard Report - Billing by days in stock
  app.get("/api/reports/yard-billing", isAuthenticatedJWT, async (req, res) => {
    try {
      // Get all vehicles that are currently in stock (em_estoque)
      const vehiclesInStock = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.status, "em_estoque"));

      // Get all clients
      const allClients = await db.select().from(clients);
      const clientsMap = new Map(allClients.map(c => [c.id, c]));

      // Get all yards
      const allYards = await db.select().from(yards);
      const yardsMap = new Map(allYards.map(y => [y.id, y]));

      const now = new Date();
      
      // Calculate billing for each vehicle
      const vehicleBilling = vehiclesInStock.map(vehicle => {
        const client = vehicle.clientId ? clientsMap.get(vehicle.clientId) : null;
        const yard = vehicle.yardId ? yardsMap.get(vehicle.yardId) : null;
        const dailyCost = client?.dailyCost ? parseFloat(client.dailyCost) : 0;
        const graceDays = client?.yardGraceDays ?? 0;
        
        // Calculate days in stock
        let daysInStock = 0;
        if (vehicle.yardEntryDateTime) {
          const entryDate = new Date(vehicle.yardEntryDateTime);
          const diffTime = now.getTime() - entryDate.getTime();
          daysInStock = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysInStock < 0) daysInStock = 0;
        }

        const billableDays = Math.max(0, daysInStock - graceDays);
        const totalCost = billableDays * dailyCost;

        return {
          chassi: vehicle.chassi,
          clientId: vehicle.clientId,
          clientName: client?.name || "Sem cliente",
          yardId: vehicle.yardId,
          yardName: yard?.name || "Sem pátio",
          entryDate: vehicle.yardEntryDateTime,
          daysInStock,
          billableDays,
          graceDays,
          dailyCost,
          totalCost,
        };
      });

      // Group by client
      const byClient: Record<string, {
        clientId: string | null;
        clientName: string;
        dailyCost: number;
        vehicles: typeof vehicleBilling;
        totalDays: number;
        totalCost: number;
      }> = {};

      vehicleBilling.forEach(v => {
        const key = v.clientId || "no-client";
        if (!byClient[key]) {
          byClient[key] = {
            clientId: v.clientId,
            clientName: v.clientName,
            dailyCost: v.dailyCost,
            vehicles: [],
            totalDays: 0,
            totalCost: 0,
          };
        }
        byClient[key].vehicles.push(v);
        byClient[key].totalDays += v.billableDays;
        byClient[key].totalCost += v.totalCost;
      });

      const clientGroups = Object.values(byClient).sort((a, b) => 
        a.clientName.localeCompare(b.clientName)
      );

      const grandTotal = clientGroups.reduce((sum, g) => sum + g.totalCost, 0);
      const totalVehicles = vehicleBilling.length;
      const totalDays = clientGroups.reduce((sum, g) => sum + g.totalDays, 0);

      res.json({
        clientGroups,
        summary: {
          totalVehicles,
          totalDays,
          grandTotal,
        },
      });
    } catch (error) {
      console.error("Error generating yard billing report:", error);
      res.status(500).json({ message: "Failed to generate yard billing report" });
    }
  });

  // ============ FECHAMENTO MENSAL DE PÁTIO ============

  // Helper to calculate monthly billing for a vehicle
  function calcVehicleMonthBilling(
    vehicle: { chassi: string; yardEntryDateTime: Date | null },
    yardName: string,
    month: number,
    year: number,
    dailyCost: number,
    graceDays: number
  ) {
    if (!vehicle.yardEntryDateTime) return null;
    const now = new Date();
    const periodStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999); // last ms of month
    const effectivePeriodEnd = periodEnd < now ? periodEnd : now;

    const entryDate = new Date(vehicle.yardEntryDateTime);
    if (entryDate > effectivePeriodEnd) return null; // not yet in stock this period

    const effectiveStart = entryDate > periodStart ? entryDate : periodStart;
    const daysInPeriod = Math.max(0, Math.ceil((effectivePeriodEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));

    // Total days in patio up to period start (to determine remaining grace)
    const totalDaysBeforePeriod = Math.max(0, Math.ceil((periodStart.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));
    const graceRemaining = Math.max(0, graceDays - totalDaysBeforePeriod);
    const graceDaysApplied = Math.min(graceRemaining, daysInPeriod);
    const billableDays = Math.max(0, daysInPeriod - graceDaysApplied);
    const subtotal = billableDays * dailyCost;

    // Total days in patio overall (for info)
    const totalDaysInPatio = Math.max(0, Math.ceil((effectivePeriodEnd.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));

    return { daysInPeriod, graceDaysApplied, billableDays, subtotal, totalDaysInPatio, yardName, entryDate };
  }

  // GET /api/yard-closing/preview?month=X&year=Y
  app.get("/api/yard-closing/preview", isAuthenticatedJWT, async (req, res) => {
    try {
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      const vehiclesInStock = await db.select().from(vehicles).where(eq(vehicles.status, "em_estoque"));
      const allClients = await db.select().from(clients);
      const allYards = await db.select().from(yards);
      const clientsMap = new Map(allClients.map(c => [c.id, c]));
      const yardsMap = new Map(allYards.map(y => [y.id, y]));

      const byClient: Record<string, {
        clientId: string | null;
        clientName: string;
        dailyCost: number;
        graceDays: number;
        vehicles: any[];
        totalDays: number;
        totalCost: number;
      }> = {};

      for (const v of vehiclesInStock) {
        const client = v.clientId ? clientsMap.get(v.clientId) : null;
        const yard = v.yardId ? yardsMap.get(v.yardId) : null;
        const dailyCost = client?.dailyCost ? parseFloat(client.dailyCost) : 0;
        const graceDays = client?.yardGraceDays ?? 0;
        const billing = calcVehicleMonthBilling(
          { chassi: v.chassi, yardEntryDateTime: v.yardEntryDateTime },
          yard?.name || "Sem pátio",
          month, year, dailyCost, graceDays
        );
        if (!billing) continue;

        const key = v.clientId || "no-client";
        if (!byClient[key]) {
          byClient[key] = {
            clientId: v.clientId ?? null,
            clientName: client?.name || "Sem cliente",
            dailyCost,
            graceDays,
            vehicles: [],
            totalDays: 0,
            totalCost: 0,
          };
        }
        byClient[key].vehicles.push({
          chassi: v.chassi,
          yardName: billing.yardName,
          entryDate: billing.entryDate,
          totalDaysInPatio: billing.totalDaysInPatio,
          daysInPeriod: billing.daysInPeriod,
          graceDaysApplied: billing.graceDaysApplied,
          billableDays: billing.billableDays,
          subtotal: billing.subtotal,
        });
        byClient[key].totalDays += billing.billableDays;
        byClient[key].totalCost += billing.subtotal;
      }

      const clientGroups = Object.values(byClient).sort((a, b) => a.clientName.localeCompare(b.clientName));

      // Check which groups already have an invoice generated
      const existingInvoices = await db.select().from(yardMonthlyInvoices)
        .where(and(eq(yardMonthlyInvoices.referenceMonth, month), eq(yardMonthlyInvoices.referenceYear, year)));
      const invoicedClientIds = new Set(existingInvoices.map(i => i.clientId));

      const result = clientGroups.map(g => ({
        ...g,
        hasInvoice: invoicedClientIds.has(g.clientId),
        invoice: existingInvoices.find(i => i.clientId === g.clientId) || null,
      }));

      res.json({ month, year, clientGroups: result, totalVehicles: vehiclesInStock.length });
    } catch (error) {
      console.error("Error generating yard closing preview:", error);
      res.status(500).json({ message: "Failed to generate yard closing preview" });
    }
  });

  // POST /api/yard-closing/generate — generate/replace invoice for a client in a month
  app.post("/api/yard-closing/generate", isAuthenticatedJWT, async (req, res) => {
    try {
      const { clientId, month, year } = req.body;
      if (!month || !year) return res.status(400).json({ message: "month and year are required" });

      const allClients = await db.select().from(clients);
      const allYards = await db.select().from(yards);
      const clientsMap = new Map(allClients.map(c => [c.id, c]));
      const yardsMap = new Map(allYards.map(y => [y.id, y]));

      const client = clientId ? clientsMap.get(clientId) : null;
      const dailyCost = client?.dailyCost ? parseFloat(client.dailyCost) : 0;
      const graceDays = client?.yardGraceDays ?? 0;

      const vehiclesQuery = clientId
        ? await db.select().from(vehicles).where(and(eq(vehicles.clientId, clientId), eq(vehicles.status, "em_estoque")))
        : await db.select().from(vehicles).where(eq(vehicles.status, "em_estoque"));

      const items: any[] = [];
      let totalValue = 0;

      for (const v of vehiclesQuery) {
        const yard = v.yardId ? yardsMap.get(v.yardId) : null;
        const billing = calcVehicleMonthBilling(
          { chassi: v.chassi, yardEntryDateTime: v.yardEntryDateTime },
          yard?.name || "Sem pátio",
          month, year, dailyCost, graceDays
        );
        if (!billing) continue;
        totalValue += billing.subtotal;
        items.push({
          chassi: v.chassi,
          yardName: billing.yardName,
          entryDate: billing.entryDate,
          totalDaysInPatio: billing.totalDaysInPatio,
          daysInPeriod: billing.daysInPeriod,
          graceDaysApplied: billing.graceDaysApplied,
          billableDays: billing.billableDays,
          dailyCost: String(dailyCost),
          subtotal: String(billing.subtotal),
        });
      }

      // Delete existing invoice for this client+month+year if any
      const existing = await db.select().from(yardMonthlyInvoices).where(
        and(
          eq(yardMonthlyInvoices.referenceMonth, month),
          eq(yardMonthlyInvoices.referenceYear, year),
          clientId ? eq(yardMonthlyInvoices.clientId, clientId) : drizzleSql`client_id IS NULL`
        )
      );
      if (existing.length > 0) {
        await db.delete(yardMonthlyInvoiceItems).where(eq(yardMonthlyInvoiceItems.invoiceId, existing[0].id));
        await db.delete(yardMonthlyInvoices).where(eq(yardMonthlyInvoices.id, existing[0].id));
      }

      const [invoice] = await db.insert(yardMonthlyInvoices).values({
        clientId: clientId || null,
        clientName: client?.name || "Sem cliente",
        referenceMonth: month,
        referenceYear: year,
        totalValue: String(totalValue),
        status: "pending",
        dailyCostSnapshot: String(dailyCost),
        graceDaysSnapshot: graceDays,
      }).returning();

      let savedItems: any[] = [];
      if (items.length > 0) {
        savedItems = await db.insert(yardMonthlyInvoiceItems).values(items.map(item => ({ ...item, invoiceId: invoice.id }))).returning();
      }

      res.json({ ...invoice, items: savedItems });
    } catch (error) {
      console.error("Error generating yard monthly invoice:", error);
      res.status(500).json({ message: "Failed to generate yard monthly invoice" });
    }
  });

  // GET /api/yard-closing/invoices — list invoices (optionally filter by month/year)
  app.get("/api/yard-closing/invoices", isAuthenticatedJWT, async (req, res) => {
    try {
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const year = req.query.year ? parseInt(req.query.year as string) : null;

      const conditions: any[] = [];
      if (month) conditions.push(eq(yardMonthlyInvoices.referenceMonth, month));
      if (year) conditions.push(eq(yardMonthlyInvoices.referenceYear, year));

      const data = conditions.length > 0
        ? await db.select().from(yardMonthlyInvoices).where(and(...conditions)).orderBy(desc(yardMonthlyInvoices.generatedAt))
        : await db.select().from(yardMonthlyInvoices).orderBy(desc(yardMonthlyInvoices.generatedAt));

      res.json(data);
    } catch (error) {
      console.error("Error fetching yard invoices:", error);
      res.status(500).json({ message: "Failed to fetch yard invoices" });
    }
  });

  // GET /api/yard-closing/invoices/:id — get invoice with items
  app.get("/api/yard-closing/invoices/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const [invoice] = await db.select().from(yardMonthlyInvoices).where(eq(yardMonthlyInvoices.id, req.params.id));
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      const items = await db.select().from(yardMonthlyInvoiceItems).where(eq(yardMonthlyInvoiceItems.invoiceId, invoice.id));
      res.json({ ...invoice, items });
    } catch (error) {
      console.error("Error fetching yard invoice:", error);
      res.status(500).json({ message: "Failed to fetch yard invoice" });
    }
  });

  // PATCH /api/yard-closing/invoices/:id/status
  app.patch("/api/yard-closing/invoices/:id/status", isAuthenticatedJWT, async (req, res) => {
    try {
      const { status, paymentDate } = req.body;
      if (!["pending", "paid"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const [updated] = await db.update(yardMonthlyInvoices)
        .set({ status, paymentDate: paymentDate ? new Date(paymentDate) : (status === "paid" ? new Date() : null) })
        .where(eq(yardMonthlyInvoices.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  // DELETE /api/yard-closing/invoices/:id
  app.delete("/api/yard-closing/invoices/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(yardMonthlyInvoiceItems).where(eq(yardMonthlyInvoiceItems.invoiceId, req.params.id));
      await db.delete(yardMonthlyInvoices).where(eq(yardMonthlyInvoices.id, req.params.id));
      res.json({ message: "Invoice deleted" });
    } catch (error) {
      console.error("Error deleting yard invoice:", error);
      res.status(500).json({ message: "Failed to delete yard invoice" });
    }
  });

  // Drivers
  app.get("/api/drivers", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getDrivers();
      res.json(data);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      res.status(500).json({ message: "Failed to fetch drivers" });
    }
  });

  app.get("/api/drivers/online-count", isAuthenticatedJWT, async (_req, res) => {
    try {
      const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const result = await db.select({ count: drizzleSql<number>`count(*)::int` })
        .from(users)
        .where(and(
          eq(users.role, "motorista" as any),
          eq(users.isActive, "true"),
          drizzleSql`${users.lastLogin} >= ${cutoff.toISOString()}`
        ));
      res.json({ count: result[0]?.count ?? 0 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/status-overview", isAuthenticatedJWT, async (_req, res) => {
    try {
      const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const allMotoristas = await db.select({
        userId: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        lastLogin: users.lastLogin,
        refreshTokenVersion: users.refreshTokenVersion,
        isActive: users.isActive,
      }).from(users).where(eq(users.role, "motorista" as any));

      const allDrivers = await storage.getDrivers();

      const driverMap = new Map<string, any>();
      for (const d of allDrivers) {
        if (d.email) driverMap.set(d.email.toLowerCase(), d);
      }

      const enriched = allMotoristas.map(u => {
        const driver = u.email ? driverMap.get(u.email.toLowerCase()) : null;
        const isOnline = u.lastLogin && new Date(u.lastLogin) >= cutoff;
        return {
          userId: u.userId,
          username: u.username,
          name: driver ? driver.name : `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username,
          email: u.email,
          phone: driver?.phone || null,
          city: driver?.city || null,
          state: driver?.state || null,
          driverType: driver?.driverType || null,
          isOnline: !!isOnline,
          isActive: u.isActive === "true",
          lastLogin: u.lastLogin,
          refreshTokenVersion: u.refreshTokenVersion,
          profilePhoto: driver?.profilePhoto || null,
        };
      });

      const online = enriched.filter(e => e.isOnline && e.isActive);
      const offline = enriched.filter(e => !e.isOnline && e.isActive);
      const inactive = enriched.filter(e => !e.isActive);

      const regionMap: Record<string, number> = {};
      for (const d of online) {
        const st = d.state || "N/D";
        regionMap[st] = (regionMap[st] || 0) + 1;
      }

      const stateToRegion: Record<string, string> = {
        AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
        AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
        PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
        DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
        ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
        PR: "Sul", RS: "Sul", SC: "Sul",
      };
      const macroRegionMap: Record<string, number> = {};
      for (const d of online) {
        const region = stateToRegion[d.state || ""] || "N/D";
        macroRegionMap[region] = (macroRegionMap[region] || 0) + 1;
      }

      res.json({
        totalDrivers: enriched.filter(e => e.isActive).length,
        onlineCount: online.length,
        offlineCount: offline.length,
        inactiveCount: inactive.length,
        onlineDrivers: online,
        offlineDrivers: offline,
        byState: regionMap,
        byRegion: macroRegionMap,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/near-yards", isAuthenticatedJWT, async (_req, res) => {
    try {
      const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const RADIUS_KM = 100;

      const activeYards = await db.select().from(yards).where(eq(yards.isActive, "true"));
      const yardsWithCoords = activeYards.filter(y => y.latitude && y.longitude);

      const allMotoristas = await db.select({
        userId: users.id,
        username: users.username,
        email: users.email,
        lastLogin: users.lastLogin,
        isActive: users.isActive,
      }).from(users).where(eq(users.role, "motorista" as any));

      const onlineMotoristas = allMotoristas.filter(u => u.isActive === "true" && u.lastLogin && new Date(u.lastLogin) >= cutoff);

      const allDrivers = await storage.getDrivers();
      const driverMap = new Map<string, any>();
      for (const d of allDrivers) {
        if (d.email) driverMap.set(d.email.toLowerCase(), d);
      }

      function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const result = yardsWithCoords.map(yard => {
        const yLat = parseFloat(yard.latitude!);
        const yLon = parseFloat(yard.longitude!);
        if (!Number.isFinite(yLat) || !Number.isFinite(yLon)) return null;

        const nearbyDrivers: any[] = [];
        for (const u of onlineMotoristas) {
          const driver = u.email ? driverMap.get(u.email.toLowerCase()) : null;
          if (!driver || !driver.latitude || !driver.longitude) continue;
          const dLat = parseFloat(driver.latitude);
          const dLon = parseFloat(driver.longitude);
          if (!Number.isFinite(dLat) || !Number.isFinite(dLon)) continue;

          const dist = haversineKm(yLat, yLon, dLat, dLon);
          if (dist <= RADIUS_KM) {
            nearbyDrivers.push({
              driverId: driver.id,
              name: driver.name,
              phone: driver.phone || null,
              city: driver.city || null,
              state: driver.state || null,
              driverType: driver.driverType || null,
              profilePhoto: driver.profilePhoto || null,
              distanceKm: Math.round(dist * 10) / 10,
              lastLogin: u.lastLogin,
            });
          }
        }

        nearbyDrivers.sort((a, b) => a.distanceKm - b.distanceKm);

        return {
          yardId: yard.id,
          yardName: yard.name,
          yardCity: yard.city,
          yardState: yard.state,
          nearbyCount: nearbyDrivers.length,
          drivers: nearbyDrivers,
        };
      });

      res.json(result.filter(Boolean));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/drivers/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Error fetching driver:", error);
      res.status(500).json({ message: "Failed to fetch driver" });
    }
  });

  app.post("/api/drivers", isAuthenticatedJWT, (req, res, next) => {
    upload.fields([
      { name: "cnhFrontFile", maxCount: 1 },
      { name: "cnhBackFile", maxCount: 1 },
      { name: "rgFile", maxCount: 1 },
      { name: "addressProofFile", maxCount: 1 },
      { name: "profilePhotoFile", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Erro no upload de arquivo" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const body = { ...req.body };

      if (files?.cnhFrontFile?.[0]) {
        body.cnhFrontPhoto = `/uploads/${files.cnhFrontFile[0].filename}`;
      }
      if (files?.cnhBackFile?.[0]) {
        body.cnhBackPhoto = `/uploads/${files.cnhBackFile[0].filename}`;
      }
      if (files?.rgFile?.[0]) {
        body.rgPhoto = `/uploads/${files.rgFile[0].filename}`;
      }
      if (files?.addressProofFile?.[0]) {
        body.addressProofPhoto = `/uploads/${files.addressProofFile[0].filename}`;
      }
      if (files?.profilePhotoFile?.[0]) {
        body.profilePhoto = `/uploads/${files.profilePhotoFile[0].filename}`;
      }

      const { password, ...driverBody } = body;
      const data = insertDriverSchema.parse(driverBody);
      (data as any).registrationSource = "sistema";
      const driver = await storage.createDriver(data);
      await recalculateIsApto(driver.id, storage);

      // If password is provided, create linked user account
      if (password && password.length >= 6 && driver.email) {
        const [existing] = await db.select().from(users).where(eq(users.email, driver.email)).limit(1);
        if (!existing) {
          const passwordHash = await hashPassword(password);
          const username = driver.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
          await db.insert(users).values({
            username,
            email: driver.email,
            passwordHash,
            firstName: driver.name.split(" ")[0],
            lastName: driver.name.split(" ").slice(1).join(" ") || undefined,
            role: "motorista",
            isActive: "true",
          });
        }
      }

      const updated = await storage.getDriver(driver.id);
      res.status(201).json(updated ?? driver);
    } catch (error: any) {
      console.error("Error creating driver:", error);
      res.status(400).json({ message: error.message || "Failed to create driver" });
    }
  });

  app.patch("/api/drivers/:id", isAuthenticatedJWT, (req, res, next) => {
    upload.fields([
      { name: "cnhFrontFile", maxCount: 1 },
      { name: "cnhBackFile", maxCount: 1 },
      { name: "rgFile", maxCount: 1 },
      { name: "addressProofFile", maxCount: 1 },
      { name: "profilePhotoFile", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Erro no upload de arquivo" });
      }
      next();
    });
  }, async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const body = { ...req.body };

      if (files?.cnhFrontFile?.[0]) {
        body.cnhFrontPhoto = `/uploads/${files.cnhFrontFile[0].filename}`;
      }
      if (files?.cnhBackFile?.[0]) {
        body.cnhBackPhoto = `/uploads/${files.cnhBackFile[0].filename}`;
      }
      if (files?.rgFile?.[0]) {
        body.rgPhoto = `/uploads/${files.rgFile[0].filename}`;
      }
      if (files?.addressProofFile?.[0]) {
        body.addressProofPhoto = `/uploads/${files.addressProofFile[0].filename}`;
      }
      if (files?.profilePhotoFile?.[0]) {
        body.profilePhoto = `/uploads/${files.profilePhotoFile[0].filename}`;
      }

      const data = insertDriverSchema.partial().parse(body);
      delete (data as any).isApto;
      const driver = await storage.updateDriver(req.params.id, data);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      await recalculateIsApto(req.params.id, storage);
      const updated = await storage.getDriver(req.params.id);
      res.json(updated ?? driver);
    } catch (error: any) {
      console.error("Error updating driver:", error);
      res.status(400).json({ message: error.message || "Failed to update driver" });
    }
  });

  app.patch("/api/drivers/:id/apto", isAuthenticatedJWT, async (req, res) => {
    try {
      const driverId = req.params.id;
      const { isApto } = req.body as { isApto?: boolean | string };

      if (isApto === undefined || isApto === null) {
        return res.status(400).json({ message: "Campo isApto é obrigatório" });
      }

      const isAptoStr = (isApto === true || isApto === "true") ? "true" : "false";

      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      const updated = await storage.updateDriver(driverId, { isApto: isAptoStr } as any);

      // Motorista inapto MANTÉM a sessão ativa no app, mas as listas de
      // coletas/transportes e o envio de push são bloqueados nos endpoints
      // específicos. Não revogamos refresh tokens aqui.

      res.json(updated ?? driver);
    } catch (error: any) {
      console.error("Error updating driver apto flag:", error);
      res.status(500).json({ message: error.message || "Erro ao atualizar aptidão do motorista" });
    }
  });

  app.get("/api/drivers/:id/user-account", isAuthenticatedJWT, async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.id);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado" });
      if (!driver.email) return res.json({ exists: false, email: null });

      const [user] = await db.select({ id: users.id, username: users.username, email: users.email, isActive: users.isActive })
        .from(users)
        .where(eq(users.email, driver.email))
        .limit(1);

      if (user) {
        res.json({ exists: true, email: driver.email, username: user.username, isActive: user.isActive });
      } else {
        res.json({ exists: false, email: driver.email });
      }
    } catch (error) {
      console.error("Error checking driver user account:", error);
      res.status(500).json({ message: "Erro ao verificar conta do motorista" });
    }
  });

  app.post("/api/drivers/:id/update-password", isAuthenticatedJWT, async (req, res) => {
    try {
      console.log("[update-password] body:", JSON.stringify(req.body));
      const { password } = req.body;
      if (!password || password.length < 6) {
        console.log("[update-password] senha inválida:", password);
        return res.status(400).json({ message: "Senha deve ter pelo menos 6 caracteres" });
      }

      const driver = await storage.getDriver(req.params.id);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado" });
      if (!driver.email) return res.status(400).json({ message: "Motorista não possui e-mail cadastrado" });

      console.log("[update-password] criando/atualizando senha para:", driver.email);
      const [user] = await db.select().from(users).where(eq(users.email, driver.email)).limit(1);
      console.log("[update-password] usuário existente:", user ? user.id : "nenhum");

      const passwordHash = await hashPassword(password);
      console.log("[update-password] hash gerado, salvando...");

      if (user) {
        await db.update(users).set({
          passwordHash,
          lastLogin: null,
          refreshTokenVersion: new Date(),
        }).where(eq(users.id, user.id));
        console.log("[update-password] senha atualizada para usuário existente");
      } else {
        const baseUsername = driver.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        // Ensure unique username
        let username = baseUsername;
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
        if (existing) username = `${baseUsername}_${Date.now()}`;
        await db.insert(users).values({
          username,
          email: driver.email,
          passwordHash,
          firstName: driver.name.split(" ")[0],
          lastName: driver.name.split(" ").slice(1).join(" ") || undefined,
          role: "motorista",
          isActive: "true",
          lastLogin: null,
        });
        console.log("[update-password] novo usuário criado:", username);
      }

      res.json({ message: "Senha atualizada com sucesso" });
    } catch (error) {
      console.error("[update-password] Error:", error);
      res.status(500).json({ message: "Erro ao atualizar senha" });
    }
  });

  app.post("/api/drivers/:id/approve-documents", isAuthenticatedJWT, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["aprovado", "reprovado", "pendente"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      const authReq = req as AuthenticatedRequest;
      const approvedBy = authReq.user?.username || authReq.user?.email || "operador";
      const driver = await storage.updateDriver(req.params.id, {
        documentsApproved: status,
        documentsApprovedAt: status !== "pendente" ? new Date() : null,
        documentsApprovedBy: status !== "pendente" ? approvedBy : null,
      });
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }
      res.json(driver);
    } catch (error: any) {
      console.error("Error approving driver documents:", error);
      res.status(500).json({ message: "Erro ao aprovar documentos" });
    }
  });

  app.delete("/api/drivers/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteDriver(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting driver:", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  // Driver deletion requests (LGPD)
  app.get("/api/driver-deletion-requests", isAuthenticatedJWT, async (_req, res) => {
    try {
      const data = await storage.getDriverDeletionRequests();
      res.json(data);
    } catch (error) {
      console.error("Error fetching deletion requests:", error);
      res.status(500).json({ message: "Failed to fetch deletion requests" });
    }
  });

  app.get("/api/drivers/:id/deletion-requests", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getDriverDeletionRequestsByDriver(req.params.id);
      res.json(data);
    } catch (error) {
      console.error("Error fetching driver deletion requests:", error);
      res.status(500).json({ message: "Failed to fetch driver deletion requests" });
    }
  });

  app.post("/api/driver-deletion-requests", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const parsed = insertDriverDeletionRequestSchema.parse({
        ...req.body,
        requestedByUserId: req.user?.id || null,
        requestedByUserName: req.user?.firstName || req.user?.username || null,
      });
      const driver = await storage.getDriver(parsed.driverId);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado" });
      const created = await storage.createDriverDeletionRequest(parsed);
      res.status(201).json(created);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating deletion request:", error);
      res.status(500).json({ message: "Failed to create deletion request" });
    }
  });

  // External endpoint: motorista logado solicita exclusão dos próprios dados (LGPD)
  app.post("/api/external/driver/request-deletion", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const user = req.user;
      const driverEmail = user?.email as string | undefined;
      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado — não é possível identificar o motorista" });
      }
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }
      const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
      await storage.createDriverDeletionRequest({
        driverId: driver.id,
        channel: "app",
        notes: notes,
        status: "em_aberto",
        completionNotes: null,
        completedAt: null,
        completedByUserId: null,
        completedByUserName: null,
        requestedByUserId: user?.id || null,
        requestedByUserName: driver.name || user?.firstName || user?.username || null,
      } as any);
      res.json({
        message:
          "Solicitação recebida com sucesso.\n\n" +
          "O seu pedido de exclusão de conta e remoção de dados já está em andamento. " +
          "Para cumprir nossos protocolos de segurança e privacidade, garantindo a exclusão total e segura das suas informações, " +
          "o processo será concluído em um prazo de 2 a 5 dias.\n\n" +
          "Agradecemos a confiança e o tempo em que esteve conosco.",
      });
    } catch (error) {
      console.error("Error creating external deletion request:", error);
      res.status(500).json({ message: "Erro ao registrar solicitação de exclusão" });
    }
  });

  app.patch("/api/driver-deletion-requests/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { status, completionNotes } = req.body as { status?: string; completionNotes?: string };
      if (status && !["em_aberto", "concluido"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      const update: any = {};
      if (status) {
        update.status = status;
        if (status === "concluido") {
          update.completedAt = new Date();
          update.completedByUserId = req.user?.id || null;
          update.completedByUserName = req.user?.firstName || req.user?.username || null;
          update.completionNotes = completionNotes ?? null;
        } else {
          update.completedAt = null;
          update.completedByUserId = null;
          update.completedByUserName = null;
          update.completionNotes = null;
        }
      } else if (completionNotes !== undefined) {
        update.completionNotes = completionNotes;
      }
      const updated = await storage.updateDriverDeletionRequest(req.params.id, update);
      if (!updated) return res.status(404).json({ message: "Solicitação não encontrada" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating deletion request:", error);
      res.status(500).json({ message: "Failed to update deletion request" });
    }
  });

  app.delete("/api/driver-deletion-requests/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteDriverDeletionRequest(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deletion request:", error);
      res.status(500).json({ message: "Failed to delete deletion request" });
    }
  });

  // ============== CONTROLE DE VERSÃO (SYSTEM VERSIONS) ==============
  app.get("/api/system-versions", isAuthenticatedJWT, async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(systemVersions)
        .orderBy(desc(systemVersions.deployDate));
      res.json(rows);
    } catch (error) {
      console.error("Error listing system versions:", error);
      res.status(500).json({ message: "Erro ao listar versões" });
    }
  });

  app.post("/api/system-versions", isAuthenticatedJWT, async (req, res) => {
    try {
      const parsed = insertSystemVersionSchema.parse(req.body);
      const [created] = await db.insert(systemVersions).values(parsed).returning();
      res.status(201).json(created);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error creating system version:", error);
      res.status(500).json({ message: "Erro ao criar versão" });
    }
  });

  app.patch("/api/system-versions/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const parsed = insertSystemVersionSchema.partial().parse(req.body);
      const [updated] = await db
        .update(systemVersions)
        .set(parsed)
        .where(eq(systemVersions.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Versão não encontrada" });
      res.json(updated);
    } catch (error: any) {
      if (error?.name === "ZodError") {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("Error updating system version:", error);
      res.status(500).json({ message: "Erro ao atualizar versão" });
    }
  });

  app.delete("/api/system-versions/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(systemVersions).where(eq(systemVersions.id, req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting system version:", error);
      res.status(500).json({ message: "Erro ao excluir versão" });
    }
  });

  // Endpoint público — última versão do APP (sem autenticação)
  app.get("/api/external/app-version/latest", async (_req, res) => {
    try {
      const [latest] = await db
        .select()
        .from(systemVersions)
        .where(eq(systemVersions.type, "app"))
        .orderBy(desc(systemVersions.deployDate))
        .limit(1);
      if (!latest) {
        return res.status(404).json({ message: "Nenhuma versão de app cadastrada" });
      }
      res.json({
        version: latest.version,
        description: latest.description,
        deployDate: latest.deployDate,
      });
    } catch (error) {
      console.error("Error fetching latest app version:", error);
      res.status(500).json({ message: "Erro ao buscar versão do app" });
    }
  });

  // Manufacturers
  app.get("/api/manufacturers", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getManufacturers();
      res.json(data);
    } catch (error) {
      console.error("Error fetching manufacturers:", error);
      res.status(500).json({ message: "Failed to fetch manufacturers" });
    }
  });

  app.get("/api/manufacturers/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const manufacturer = await storage.getManufacturer(req.params.id);
      if (!manufacturer) {
        return res.status(404).json({ message: "Manufacturer not found" });
      }
      res.json(manufacturer);
    } catch (error) {
      console.error("Error fetching manufacturer:", error);
      res.status(500).json({ message: "Failed to fetch manufacturer" });
    }
  });

  app.post("/api/manufacturers", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertManufacturerSchema.parse(req.body);
      const manufacturer = await storage.createManufacturer(data);
      res.status(201).json(manufacturer);
    } catch (error: any) {
      console.error("Error creating manufacturer:", error);
      res.status(400).json({ message: error.message || "Failed to create manufacturer" });
    }
  });

  app.patch("/api/manufacturers/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertManufacturerSchema.partial().parse(req.body);
      const manufacturer = await storage.updateManufacturer(req.params.id, data);
      if (!manufacturer) {
        return res.status(404).json({ message: "Manufacturer not found" });
      }
      res.json(manufacturer);
    } catch (error: any) {
      console.error("Error updating manufacturer:", error);
      res.status(400).json({ message: error.message || "Failed to update manufacturer" });
    }
  });

  app.delete("/api/manufacturers/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteManufacturer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting manufacturer:", error);
      res.status(500).json({ message: "Failed to delete manufacturer" });
    }
  });

  // Yards
  app.get("/api/yards", isAuthenticatedJWT, async (req, res) => {
    try {
      // Quando a coleta envolve um chassi já cadastrado (transferência),
      // o app deve receber apenas o pátio atual onde o veículo está,
      // para que esse seja o único pátio de origem possível.
      // Caso o chassi não exista no estoque, mantém o comportamento atual
      // (devolve todos os pátios para o usuário escolher).
      const chassiQuery = typeof req.query.chassi === "string" ? req.query.chassi.trim() : "";
      if (chassiQuery) {
        const vehicle = await storage.getVehicle(chassiQuery);
        if (vehicle?.yardId) {
          const currentYard = await storage.getYard(vehicle.yardId);
          return res.json(currentYard ? [currentYard] : []);
        }
      }
      const data = await storage.getYards();
      res.json(data);
    } catch (error) {
      console.error("Error fetching yards:", error);
      res.status(500).json({ message: "Failed to fetch yards" });
    }
  });

  app.get("/api/yards/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const yard = await storage.getYard(req.params.id);
      if (!yard) {
        return res.status(404).json({ message: "Yard not found" });
      }
      res.json(yard);
    } catch (error) {
      console.error("Error fetching yard:", error);
      res.status(500).json({ message: "Failed to fetch yard" });
    }
  });

  app.post("/api/yards", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertYardSchema.parse(req.body);
      const yard = await storage.createYard(data);
      res.status(201).json(yard);
    } catch (error: any) {
      console.error("Error creating yard:", error);
      res.status(400).json({ message: error.message || "Failed to create yard" });
    }
  });

  app.patch("/api/yards/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertYardSchema.partial().parse(req.body);
      const yard = await storage.updateYard(req.params.id, data);
      if (!yard) {
        return res.status(404).json({ message: "Yard not found" });
      }
      res.json(yard);
    } catch (error: any) {
      console.error("Error updating yard:", error);
      res.status(400).json({ message: error.message || "Failed to update yard" });
    }
  });

  app.delete("/api/yards/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteYard(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting yard:", error);
      res.status(500).json({ message: "Failed to delete yard" });
    }
  });

  // Clients
  app.get("/api/clients", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getClients();
      res.json(data);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const client = await storage.createClient(data);
      res.status(201).json(client);
    } catch (error: any) {
      console.error("Error creating client:", error);
      res.status(400).json({ message: error.message || "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, data);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error: any) {
      console.error("Error updating client:", error);
      res.status(400).json({ message: error.message || "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const clientId = req.params.id;

      // Bloqueios: registros que NÃO podem ser apagados em cascata.
      const [vehCount] = await db
        .select({ n: drizzleSql<number>`COUNT(*)::int` })
        .from(vehicles)
        .where(eq(vehicles.clientId, clientId));
      const [transportCount] = await db
        .select({ n: drizzleSql<number>`COUNT(*)::int` })
        .from(transports)
        .where(eq(transports.clientId, clientId));
      const [proposalCount] = await db
        .select({ n: drizzleSql<number>`COUNT(*)::int` })
        .from(transportProposals)
        .where(eq(transportProposals.clientId, clientId));

      const blockers: string[] = [];
      if ((vehCount?.n ?? 0) > 0) blockers.push(`${vehCount.n} veículo(s) em estoque`);
      if ((transportCount?.n ?? 0) > 0) blockers.push(`${transportCount.n} transporte(s)`);
      if ((proposalCount?.n ?? 0) > 0) blockers.push(`${proposalCount.n} proposta(s) de transporte`);

      if (blockers.length > 0) {
        return res.status(409).json({
          message: `Não é possível excluir este cliente porque existem registros vinculados: ${blockers.join(", ")}. Remova ou transfira esses registros antes de excluir o cliente.`,
        });
      }

      // Locais de entrega pertencem ao cliente: removidos em cascata.
      await db.delete(deliveryLocations).where(eq(deliveryLocations.clientId, clientId));
      await storage.deleteClient(clientId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: error?.message || "Failed to delete client" });
    }
  });

  // Portal: Definir credenciais de acesso do cliente
  app.post("/api/clients/:id/set-credentials", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const { username, password } = z.object({
        username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
        password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      }).parse(req.body);

      const existing = await storage.getClient(req.params.id);
      if (!existing) return res.status(404).json({ message: "Cliente não encontrado" });

      // Verifica username duplicado em outro cliente
      const [conflict] = await db.select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.username, username), ne(clients.id, req.params.id)))
        .limit(1);
      if (conflict) return res.status(400).json({ message: "Nome de usuário já em uso por outro cliente" });

      const passwordHash = await hashPassword(password);
      await db.update(clients)
        .set({ username, password: passwordHash })
        .where(eq(clients.id, req.params.id));

      return res.json({ message: "Credenciais definidas com sucesso" });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      console.error("Error setting client credentials:", error);
      return res.status(500).json({ message: "Erro ao definir credenciais" });
    }
  });

  // Portal: Remover credenciais de acesso do cliente
  app.delete("/api/clients/:id/set-credentials", isAuthenticatedJWT, async (req, res) => {
    try {
      const existing = await storage.getClient(req.params.id);
      if (!existing) return res.status(404).json({ message: "Cliente não encontrado" });
      await db.update(clients)
        .set({ username: null, password: null })
        .where(eq(clients.id, req.params.id));
      return res.json({ message: "Credenciais removidas com sucesso" });
    } catch (error) {
      console.error("Error removing client credentials:", error);
      return res.status(500).json({ message: "Erro ao remover credenciais" });
    }
  });

  // Delivery Locations
  app.get("/api/delivery-locations", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getAllDeliveryLocations();
      res.json(data);
    } catch (error) {
      console.error("Error fetching all delivery locations:", error);
      res.status(500).json({ message: "Failed to fetch delivery locations" });
    }
  });

  app.get("/api/clients/:clientId/locations", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getDeliveryLocations(req.params.clientId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching delivery locations:", error);
      res.status(500).json({ message: "Failed to fetch delivery locations" });
    }
  });

  app.post("/api/clients/:clientId/locations", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertDeliveryLocationSchema.parse({
        ...req.body,
        clientId: req.params.clientId,
      });
      const location = await storage.createDeliveryLocation(data);
      res.status(201).json(location);
    } catch (error: any) {
      console.error("Error creating delivery location:", error);
      res.status(400).json({ message: error.message || "Failed to create delivery location" });
    }
  });

  app.patch("/api/delivery-locations/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertDeliveryLocationSchema.partial().parse(req.body);
      const location = await storage.updateDeliveryLocation(req.params.id, data);
      if (!location) {
        return res.status(404).json({ message: "Delivery location not found" });
      }
      res.json(location);
    } catch (error: any) {
      console.error("Error updating delivery location:", error);
      res.status(400).json({ message: error.message || "Failed to update delivery location" });
    }
  });

  app.delete("/api/delivery-locations/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteDeliveryLocation(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting delivery location:", error);
      res.status(500).json({ message: "Failed to delete delivery location" });
    }
  });

  // Vehicles
  // Middleware combinado: aceita JWT de admin/staff OU JWT de cliente do portal
  function isAuthenticatedJWTOrClient(req: AuthenticatedRequest, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token não fornecido" });
    }
    const token = authHeader.split(" ")[1];
    // Tenta como token de cliente primeiro
    const clientPayload = verifyClientToken(token);
    if (clientPayload && clientPayload.type === "client") {
      req.clientId = clientPayload.clientId;
      return next();
    }
    // Tenta como token de staff
    const staffPayload = verifyAccessToken(token);
    if (!staffPayload) return res.status(401).json({ message: "Token inválido ou expirado" });
    db.select().from(users).where(eq(users.id, staffPayload.userId)).limit(1)
      .then(([user]) => {
        if (!user || user.isActive !== "true") return res.status(401).json({ message: "Usuário inativo" });
        req.user = user as any;
        next();
      })
      .catch(() => res.status(500).json({ message: "Erro de autenticação" }));
  }

  // Returns the set of vehicle chassis that a client can see indirectly via
  // their transports (vehicles.client_id is often NULL even after delivery,
  // and the actual client link lives on transports.client_id).
  const getClientChassisFromTransports = async (clientId: string): Promise<Set<string>> => {
    const rows = await db.select({ chassi: transports.vehicleChassi })
      .from(transports)
      .where(eq(transports.clientId, clientId));
    return new Set(rows.map(r => r.chassi));
  };

  app.get("/api/vehicles", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      let data = await storage.getVehicles();
      if (req.clientId) {
        // A client can see a vehicle if it is directly linked (vehicles.client_id)
        // OR if it appears in any transport whose client_id matches the user.
        const transportChassis = await getClientChassisFromTransports(req.clientId);
        data = data.filter(v => v.clientId === req.clientId || transportChassis.has(v.chassi));
      }
      // Load yards for name enrichment
      const allYards = await storage.getYards();
      const yardsNameMap = new Map<string, string>(allYards.map(y => [y.id, y.name]));

      // Enrich vehicles that have no yardId using collects or transports
      const vehiclesWithNullYard = data.filter(v => !v.yardId);
      let enriched = [...data];
      if (vehiclesWithNullYard.length > 0) {
        const chassiList = vehiclesWithNullYard.map(v => v.chassi);
        const [recentCollects, recentTransports] = await Promise.all([
          db.select({ vehicleChassi: collects.vehicleChassi, yardId: collects.yardId })
            .from(collects)
            .where(inArray(collects.vehicleChassi, chassiList))
            .orderBy(desc(collects.createdAt)),
          db.select({ vehicleChassi: transports.vehicleChassi, yardId: transports.originYardId })
            .from(transports)
            .where(inArray(transports.vehicleChassi, chassiList))
            .orderBy(desc(transports.createdAt)),
        ]);
        const yardMap = new Map<string, string>();
        for (const t of recentTransports) {
          if (!yardMap.has(t.vehicleChassi) && t.yardId) {
            yardMap.set(t.vehicleChassi, t.yardId);
          }
        }
        for (const c of recentCollects) {
          if (c.yardId) {
            yardMap.set(c.vehicleChassi, c.yardId);
          }
        }
        enriched = data.map(v => {
          const resolvedYardId = v.yardId || (yardMap.has(v.chassi) ? yardMap.get(v.chassi)! : null);
          return { ...v, yardId: resolvedYardId, yardName: resolvedYardId ? yardsNameMap.get(resolvedYardId) ?? null : null };
        });
      } else {
        enriched = data.map(v => ({
          ...v,
          yardName: v.yardId ? yardsNameMap.get(v.yardId) ?? null : null,
        }));
      }
      return res.json(enriched);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ message: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:chassi", isAuthenticatedJWT, async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(decodeURIComponent(req.params.chassi));
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      res.status(500).json({ message: "Failed to fetch vehicle" });
    }
  });

  app.get("/api/vehicle-journey/:chassi", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      const chassi = decodeURIComponent(req.params.chassi);
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.chassi, chassi));
      if (!vehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }
      // Cliente só pode acessar chassis dos seus próprios veículos
      // (vínculo direto em vehicles.client_id OU via algum transport seu).
      if (req.clientId && vehicle.clientId !== req.clientId) {
        const [t] = await db.select({ id: transports.id })
          .from(transports)
          .where(and(eq(transports.vehicleChassi, chassi), eq(transports.clientId, req.clientId)))
          .limit(1);
        if (!t) return res.status(403).json({ message: "Acesso negado a este veículo" });
      }
      const [manufacturer] = vehicle.manufacturerId
        ? await db.select().from(manufacturers).where(eq(manufacturers.id, vehicle.manufacturerId))
        : [null];
      const [yard] = vehicle.yardId
        ? await db.select().from(yards).where(eq(yards.id, vehicle.yardId))
        : [null];
      const [client] = vehicle.clientId
        ? await db.select().from(clients).where(eq(clients.id, vehicle.clientId))
        : [null];
      const collectsList = await db.select().from(collects).where(eq(collects.vehicleChassi, chassi)).orderBy(collects.createdAt);
      const collectsWithRelations = await Promise.all(
        collectsList.map(async (collect) => {
          const [mfr] = await db.select().from(manufacturers).where(eq(manufacturers.id, collect.manufacturerId));
          const [yd] = await db.select().from(yards).where(eq(yards.id, collect.yardId));
          const [driver] = collect.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, collect.driverId))
            : [null];
          const [checkoutApprovedBy] = collect.checkoutApprovedById
            ? await db.select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
                .from(users).where(eq(users.id, collect.checkoutApprovedById))
            : [null];
          return { ...collect, manufacturer: mfr, yard: yd, driver, checkoutApprovedBy };
        })
      );
      const transportsList = await db.select().from(transports).where(eq(transports.vehicleChassi, chassi)).orderBy(transports.createdAt);
      const transportsWithRelations = await Promise.all(
        transportsList.map(async (transport) => {
          const [originYard] = transport.originYardId
            ? await db.select().from(yards).where(eq(yards.id, transport.originYardId))
            : [null];
          const [deliveryLocation] = transport.deliveryLocationId
            ? await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, transport.deliveryLocationId))
            : [null];
          const [driver] = transport.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, transport.driverId))
            : [null];
          const [cl] = await db.select().from(clients).where(eq(clients.id, transport.clientId));
          return { ...transport, originYard, deliveryLocation, driver, client: cl };
        })
      );
      const transfersList = await db.select().from(transfers).where(eq(transfers.vehicleChassi, chassi)).orderBy(transfers.createdAt);
      const transfersWithRelations = await Promise.all(
        transfersList.map(async (transfer) => {
          const [originYard] = await db.select().from(yards).where(eq(yards.id, transfer.originYardId));
          const [destinationYard] = await db.select().from(yards).where(eq(yards.id, transfer.destinationYardId));
          const [driver] = transfer.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, transfer.driverId))
            : [null];
          return { ...transfer, originYard, destinationYard, driver };
        })
      );
      res.json({
        vehicle: { ...vehicle, manufacturer, yard, client },
        collects: collectsWithRelations,
        transports: transportsWithRelations,
        transfers: transfersWithRelations,
      });
    } catch (error) {
      console.error("Error fetching vehicle journey:", error);
      res.status(500).json({ message: "Failed to fetch vehicle journey" });
    }
  });

  app.post("/api/vehicles", isAuthenticatedJWT, async (req, res) => {
    try {
      const rawBody = { ...req.body };
      if (rawBody.clientId === "") rawBody.clientId = null;
      if (rawBody.yardId === "") rawBody.yardId = null;
      if (rawBody.manufacturerId === "") rawBody.manufacturerId = null;
      const data = insertVehicleSchema.parse(rawBody);
      if (data.chassi) data.chassi = data.chassi.toUpperCase();
      const existing = await storage.getVehicle(data.chassi);
      if (existing) {
        const baseChassi = data.chassi;
        let counter = 1;
        let newChassi = `${baseChassi}_otd${counter}`;
        while (await storage.getVehicle(newChassi)) {
          counter++;
          newChassi = `${baseChassi}_otd${counter}`;
        }
        data.chassi = newChassi;
      }
      const vehicle = await storage.createVehicle(data);
      res.status(201).json(vehicle);
    } catch (error: any) {
      console.error("Error creating vehicle:", error);
      res.status(400).json({ message: error.message || "Failed to create vehicle" });
    }
  });

  app.patch("/api/vehicles/:chassi", isAuthenticatedJWT, async (req, res) => {
    try {
      const chassi = decodeURIComponent(req.params.chassi);
      const data = insertVehicleSchema.partial().parse(req.body);
      
      // Convert empty strings to null for nullable foreign key fields
      if (data.clientId === "") data.clientId = null;
      if (data.yardId === "") data.yardId = null;
      if (data.manufacturerId === "") data.manufacturerId = null;
      
      // Get current vehicle to check status transition
      const currentVehicle = await storage.getVehicle(chassi);
      
      // If status is changing from pre_estoque to em_estoque, set yard entry date/time
      if (currentVehicle?.status === "pre_estoque" && data.status === "em_estoque") {
        data.yardEntryDateTime = new Date();
      }
      
      // If status is changing to despachado, set dispatch date/time
      if (currentVehicle?.status !== "despachado" && data.status === "despachado") {
        data.dispatchDateTime = new Date();
      }
      
      const vehicle = await storage.updateVehicle(chassi, data);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      // If vehicle status changed from pre_estoque to em_estoque, mark active collect as autorizado_portaria
      if (currentVehicle?.status === "pre_estoque" && data.status === "em_estoque") {
        // Only update collects that are still em_transito (active)
        await db.update(collects)
          .set({ status: "autorizado_portaria" })
          .where(and(
            eq(collects.vehicleChassi, chassi),
            eq(collects.status, "em_transito")
          ));
      }
      
      res.json(vehicle);
    } catch (error: any) {
      console.error("Error updating vehicle:", error);
      res.status(400).json({ message: error.message || "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:chassi", isAuthenticatedJWT, async (req, res) => {
    try {
      const chassi = decodeURIComponent(req.params.chassi);
      // Delete associated collects first
      await db.delete(collects).where(eq(collects.vehicleChassi, chassi));
      await storage.deleteVehicle(chassi);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ message: "Failed to delete vehicle" });
    }
  });

  // Collects
  app.get("/api/collects", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      let collectsList: typeof collects.$inferSelect[] = [];

      if (req.clientId) {
        // Portal do cliente: somente coletas de veículos deste cliente
        const clientVehicles = await db.select({ chassi: vehicles.chassi }).from(vehicles).where(eq(vehicles.clientId, req.clientId));
        const chassiList = clientVehicles.map(v => v.chassi);
        if (chassiList.length === 0) {
          collectsList = [];
        } else {
          collectsList = await db.select().from(collects).where(inArray(collects.vehicleChassi, chassiList)).orderBy(desc(collects.createdAt));
        }
      } else {
        const user = req.user!;
        if ((user as any).role === "motorista") {
          const userEmail = (user as any).email as string | null;
          if (!userEmail) return res.status(403).json({ message: "Usuário motorista sem e-mail vinculado" });
          const [driver] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.email, userEmail)).limit(1);
          if (!driver) return res.json([]);
          collectsList = await db.select().from(collects).where(eq(collects.driverId, driver.id)).orderBy(desc(collects.createdAt));
        } else {
          collectsList = await storage.getCollects();
        }
      }

      const collectsWithRelations = await Promise.all(
        collectsList.map(async (collect) => {
          const [manufacturer] = collect.manufacturerId
            ? await db.select().from(manufacturers).where(eq(manufacturers.id, collect.manufacturerId))
            : [null];
          const [originYard] = collect.originYardId
            ? await db.select().from(yards).where(eq(yards.id, collect.originYardId))
            : [null];
          const [yard] = await db.select().from(yards).where(eq(yards.id, collect.yardId));
          const [driver] = collect.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, collect.driverId))
            : [null];
          const [checkoutApprovedBy] = collect.checkoutApprovedById
            ? await db.select({ firstName: users.firstName, lastName: users.lastName, username: users.username }).from(users).where(eq(users.id, collect.checkoutApprovedById))
            : [null];
          const [vehicle] = collect.vehicleChassi
            ? await db.select().from(vehicles).where(eq(vehicles.chassi, collect.vehicleChassi))
            : [null];
          return { ...collect, manufacturer, originYard, yard, driver, checkoutApprovedBy, vehicle };
        })
      );
      res.json(collectsWithRelations);
    } catch (error) {
      console.error("Error fetching collects:", error);
      res.status(500).json({ message: "Failed to fetch collects" });
    }
  });

  app.get("/api/collects/recent", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getRecentCollects(5);
      res.json(data);
    } catch (error) {
      console.error("Error fetching recent collects:", error);
      res.status(500).json({ message: "Failed to fetch recent collects" });
    }
  });

  // GET /api/collects/check?chassi=XYZ — verifica se existe coleta para o chassi
  app.get("/api/collects/check", isAuthenticatedJWT, async (req, res) => {
    try {
      const chassi = req.query.chassi as string | undefined;
      if (!chassi || !chassi.trim()) {
        return res.status(400).json({ message: "Parâmetro 'chassi' é obrigatório." });
      }
      const [collect] = await db
        .select({ id: collects.id, status: collects.status, collectDate: collects.collectDate, vehicleChassi: collects.vehicleChassi, yardId: collects.yardId, manufacturerId: collects.manufacturerId })
        .from(collects)
        .where(drizzleSql`LOWER(${collects.vehicleChassi}) = LOWER(${chassi.trim()})`)
        .orderBy(desc(collects.collectDate))
        .limit(1);
      if (collect) {
        res.json({ exists: true, collect });
      } else {
        res.json({ exists: false, collect: null });
      }
    } catch (error) {
      console.error("Error checking collect by chassi:", error);
      res.status(500).json({ message: "Erro ao verificar chassi." });
    }
  });

  app.get("/api/collects/by-chassi/:chassi", isAuthenticatedJWT, async (req, res) => {
    try {
      const chassi = decodeURIComponent(req.params.chassi);
      const collectsList = await db.select().from(collects).where(eq(collects.vehicleChassi, chassi)).orderBy(collects.createdAt);
      const collectsWithRelations = await Promise.all(
        collectsList.map(async (collect) => {
          const [manufacturer] = await db.select().from(manufacturers).where(eq(manufacturers.id, collect.manufacturerId));
          const [yard] = await db.select().from(yards).where(eq(yards.id, collect.yardId));
          const [driver] = collect.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, collect.driverId))
            : [null];
          const [checkoutApprovedBy] = collect.checkoutApprovedById
            ? await db.select({ firstName: users.firstName, lastName: users.lastName, username: users.username }).from(users).where(eq(users.id, collect.checkoutApprovedById))
            : [null];
          return { ...collect, manufacturer, yard, driver, checkoutApprovedBy };
        })
      );
      res.json(collectsWithRelations);
    } catch (error) {
      console.error("Error fetching collects by chassi:", error);
      res.status(500).json({ message: "Failed to fetch collects" });
    }
  });

  app.get("/api/collects/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const collect = await storage.getCollect(req.params.id);
      if (!collect) {
        return res.status(404).json({ message: "Collect not found" });
      }
      res.json(collect);
    } catch (error) {
      console.error("Error fetching collect:", error);
      res.status(500).json({ message: "Failed to fetch collect" });
    }
  });

  app.post("/api/collects", isAuthenticatedJWT, async (req, res) => {
    try {
      const rawData = { ...req.body };
      if (rawData.driverId === "") rawData.driverId = null;
      if (rawData.manufacturerId === "") rawData.manufacturerId = null;
      if (rawData.originYardId === "") rawData.originYardId = null;
      const data = insertCollectSchema.parse(rawData);

      // Validate by type
      if (data.collectType === "coleta" && !data.manufacturerId) {
        return res.status(400).json({ message: "Montadora é obrigatória para coletas." });
      }
      if (data.collectType === "transferencia" && !data.originYardId) {
        return res.status(400).json({ message: "Pátio de origem é obrigatório para transferências." });
      }
      if (data.collectType === "transferencia" && data.originYardId === data.yardId) {
        return res.status(400).json({ message: "O pátio de origem e o pátio de destino devem ser diferentes." });
      }

      if (data.driverId) {
        const openCollects = await db.select({ id: collects.id })
          .from(collects)
          .where(and(
            eq(collects.driverId, data.driverId),
            eq(collects.status, "em_transito")
          ))
          .limit(1);
        if (openCollects.length > 0) {
          return res.status(409).json({ message: "Este motorista já possui uma coleta em aberto. Finalize a coleta atual antes de criar uma nova." });
        }
      }
      
      const existingVehicle = await storage.getVehicle(data.vehicleChassi);

      if (!existingVehicle) {
        // Primeira entrada: cria o veículo automaticamente (apenas para coletas, não transferências)
        if (data.collectType === "coleta") {
          await storage.createVehicle({
            chassi: data.vehicleChassi,
            manufacturerId: data.manufacturerId,
            yardId: data.yardId,
            status: "pre_estoque",
          });
        }
      }
      // Se o veículo já existe (transferencia entre pátios), apenas registra a nova coleta

      // Auto-populate startLatitude/startLongitude from manufacturer if not provided
      let startLatitude = data.startLatitude;
      let startLongitude = data.startLongitude;
      if ((!startLatitude || !startLongitude) && data.manufacturerId) {
        const [mfrCoords] = await db
          .select({ latitude: manufacturers.latitude, longitude: manufacturers.longitude })
          .from(manufacturers)
          .where(eq(manufacturers.id, data.manufacturerId));
        if (mfrCoords?.latitude && mfrCoords?.longitude) {
          startLatitude = mfrCoords.latitude;
          startLongitude = mfrCoords.longitude;
        }
      }

      // Create collect with em_transito status and current timestamp
      const collect = await storage.createCollect({
        ...data,
        startLatitude,
        startLongitude,
        status: "em_transito",
        collectDate: new Date(),
      });
      res.status(201).json(collect);
    } catch (error: any) {
      console.error("Error creating collect:", error);
      res.status(400).json({ message: error.message || "Failed to create collect" });
    }
  });

  app.patch("/api/collects/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertCollectSchema.partial().parse(req.body);
      
      // Get existing collect to check for status transitions
      const existingCollect = await storage.getCollect(req.params.id);
      if (!existingCollect) {
        return res.status(404).json({ message: "Collect not found" });
      }

      const collect = await storage.updateCollect(req.params.id, data);
      if (!collect) {
        return res.status(404).json({ message: "Collect not found" });
      }
      
      // If status changed to autorizado_portaria → update vehicle to em_estoque
      if (data.status === "autorizado_portaria" && existingCollect.status !== "autorizado_portaria") {
        const vehicle = await storage.getVehicle(collect.vehicleChassi);
        if (vehicle && vehicle.status === "pre_estoque") {
          await storage.updateVehicle(collect.vehicleChassi, {
            status: "em_estoque",
            yardId: collect.yardId,
            yardEntryDateTime: new Date(),
          });
        }
      }

      // If status changed to finalizada → ensure vehicle is em_estoque
      if (data.status === "finalizada" && existingCollect.status !== "finalizada") {
        const vehicle = await storage.getVehicle(collect.vehicleChassi);
        if (vehicle && vehicle.status === "pre_estoque") {
          await storage.updateVehicle(collect.vehicleChassi, {
            status: "em_estoque",
            yardId: collect.yardId,
            yardEntryDateTime: new Date(),
          });
        }
      }

      // If checkout was just completed, update vehicle with yard and status
      if (data.checkoutDateTime && !existingCollect.checkoutDateTime) {
        await storage.updateVehicle(collect.vehicleChassi, {
          yardId: collect.yardId,
          status: "em_estoque",
          yardEntryDateTime: new Date(data.checkoutDateTime),
        });
        // Also update collect status to finalizada
        await storage.updateCollect(req.params.id, { status: "finalizada" });
      }
      
      res.json(collect);
    } catch (error: any) {
      console.error("Error updating collect:", error);
      res.status(400).json({ message: error.message || "Failed to update collect" });
    }
  });

  app.delete("/api/collects/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteCollect(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting collect:", error);
      res.status(500).json({ message: "Failed to delete collect" });
    }
  });

  // Portaria - Authorize entry
  app.post("/api/portaria/authorize/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const collect = await storage.getCollect(req.params.id);
      if (!collect) {
        return res.status(404).json({ message: "Coleta não encontrada" });
      }

      if (collect.status !== "em_transito") {
        return res.status(400).json({ message: "Coleta não está em trânsito" });
      }

      // Update vehicle status from pre_estoque to em_estoque
      const vehicle = await storage.getVehicle(collect.vehicleChassi);
      if (vehicle) {
        await storage.updateVehicle(collect.vehicleChassi, {
          status: "em_estoque",
          yardId: collect.yardId,
          yardEntryDateTime: new Date(),
        });
      }

      // Mark collect as authorized by portaria — record exact authorization timestamp and approver
      await storage.updateCollect(req.params.id, {
        status: "autorizado_portaria",
        checkoutDateTime: new Date(),
        checkoutApprovedById: (req as any).user?.id ?? null,
      });

      res.json({ success: true, message: "Entrada autorizada com sucesso" });
    } catch (error: any) {
      console.error("Error authorizing entry:", error);
      res.status(500).json({ message: error.message || "Erro ao autorizar entrada" });
    }
  });

  // Finalize collect by portaria admin (admin finalizes on behalf of driver)
  app.post("/api/portaria/finalize/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const collect = await storage.getCollect(req.params.id);
      if (!collect) {
        return res.status(404).json({ message: "Coleta não encontrada" });
      }

      if (collect.status !== "autorizado_portaria" && collect.status !== "em_transito") {
        return res.status(400).json({ message: "Coleta precisa estar com status 'Autorizado Portaria' ou 'Em Trânsito' para ser finalizada" });
      }

      // Auto-populate end coordinates from destination yard
      let endLatitude: string | undefined;
      let endLongitude: string | undefined;
      if (collect.yardId) {
        const [yardCoords] = await db
          .select({ latitude: yards.latitude, longitude: yards.longitude })
          .from(yards)
          .where(eq(yards.id, collect.yardId));
        if (yardCoords?.latitude && yardCoords?.longitude) {
          endLatitude = yardCoords.latitude;
          endLongitude = yardCoords.longitude;
        }
      }

      await storage.updateCollect(req.params.id, {
        status: "finalizada",
        // Preserve the portaria authorization timestamp if already set; only stamp now if not set
        ...(collect.checkoutDateTime ? {} : { checkoutDateTime: new Date() }),
        ...(endLatitude && endLongitude ? { endLatitude, endLongitude } : {}),
      });

      // Ensure vehicle is em_estoque when collect is finalized
      const vehicle = await storage.getVehicle(collect.vehicleChassi);
      if (vehicle && vehicle.status === "pre_estoque") {
        await storage.updateVehicle(collect.vehicleChassi, {
          status: "em_estoque",
          yardId: collect.yardId,
          yardEntryDateTime: new Date(),
        });
      }

      res.json({ success: true, message: "Coleta finalizada com sucesso" });
    } catch (error: any) {
      console.error("Error finalizing collect:", error);
      res.status(500).json({ message: error.message || "Erro ao finalizar coleta" });
    }
  });

  // Authorize transfer exit (portaria approves vehicle leaving origin yard in a transfer)
  app.post("/api/portaria/authorize-transfer-exit/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const collect = await storage.getCollect(req.params.id);
      if (!collect) {
        return res.status(404).json({ message: "Coleta não encontrada" });
      }
      if ((collect as any).collectType !== "transferencia") {
        return res.status(400).json({ message: "Esta coleta não é uma transferência" });
      }
      if (collect.status !== "em_transito") {
        return res.status(400).json({ message: "Transferência não está em trânsito" });
      }

      // Mark vehicle as in transfer (em_transferencia)
      const vehicle = await storage.getVehicle(collect.vehicleChassi);
      if (vehicle?.status === "em_transferencia") {
        return res.status(400).json({ message: "Saída da transferência já foi autorizada" });
      }
      if (vehicle) {
        await storage.updateVehicle(collect.vehicleChassi, {
          status: "em_transferencia" as any,
        });
      }

      // After portaria authorizes the exit, the vehicle is physically in transit
      // between yards, so the collect status remains/becomes "em_transito".
      // The vehicle.status = "em_transferencia" guard above prevents re-authorization.
      // Record the authorization timestamp and the user (portaria) who approved.
      await storage.updateCollect(req.params.id, {
        status: "em_transito",
        checkoutDateTime: new Date(),
        checkoutApprovedById: req.user?.id ?? null,
      });

      res.json({ success: true, message: "Saída da transferência autorizada com sucesso" });
    } catch (error: any) {
      console.error("Error authorizing transfer exit:", error);
      res.status(500).json({ message: error.message || "Erro ao autorizar saída da transferência" });
    }
  });

  // Authorize transport exit (portaria approves vehicle leaving the yard)
  app.post("/api/portaria/authorize-exit/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const transport = await storage.getTransport(req.params.id);
      if (!transport) {
        return res.status(404).json({ message: "Transporte não encontrado" });
      }

      if (transport.status !== "pendente" && transport.status !== "aguardando_saida") {
        return res.status(400).json({ message: "Transporte não está pendente ou aguardando saída" });
      }

      // Update vehicle status from em_estoque to despachado (if not already)
      const vehicle = await storage.getVehicle(transport.vehicleChassi);
      if (vehicle) {
        if (vehicle.status !== "em_estoque" && vehicle.status !== "despachado") {
          return res.status(400).json({ message: "Veículo não está em estoque ou despachado" });
        }
        // Only update if not already despachado
        if (vehicle.status === "em_estoque") {
          await storage.updateVehicle(transport.vehicleChassi, {
            status: "despachado",
            dispatchDateTime: new Date(),
          });
        }
      }

      // Update transport status to em_transito and set transit start time
      await storage.updateTransport(req.params.id, { 
        status: "em_transito",
        transitStartedAt: new Date(),
      });

      res.json({ success: true, message: "Saída autorizada com sucesso" });
    } catch (error: any) {
      console.error("Error authorizing exit:", error);
      res.status(500).json({ message: error.message || "Erro ao autorizar saída" });
    }
  });

  // Transports
  app.get("/api/transports", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      let transportsList = await storage.getTransports();
      if (req.clientId) {
        transportsList = transportsList.filter(t => t.clientId === req.clientId);
      }
      const transportsWithRelations = await Promise.all(
        transportsList.map(async (transport) => {
          const [client] = await db.select().from(clients).where(eq(clients.id, transport.clientId));
          const [originYard] = transport.originYardId
            ? await db.select().from(yards).where(eq(yards.id, transport.originYardId))
            : [null];
          const [deliveryLocation] = await db
            .select()
            .from(deliveryLocations)
            .where(eq(deliveryLocations.id, transport.deliveryLocationId));
          const [driver] = transport.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, transport.driverId))
            : [null];
          let createdByUser = null;
          if (transport.createdByUserId) {
            const foundUsers = await db.select().from(users).where(eq(users.id, transport.createdByUserId));
            if (foundUsers.length > 0) {
              const u = foundUsers[0];
              createdByUser = { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName };
            }
          }
          let driverAssignedByUser = null;
          if (transport.driverAssignedByUserId) {
            const foundUsers = await db.select().from(users).where(eq(users.id, transport.driverAssignedByUserId));
            if (foundUsers.length > 0) {
              const u = foundUsers[0];
              driverAssignedByUser = { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName };
            }
          }
          let travelRate = null;
          if (transport.travelRateId) {
            const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, transport.travelRateId));
            if (rate) travelRate = rate;
          }
          let travelRateApprovedByUser = null;
          if (transport.travelRateApprovedBy) {
            const foundUsers = await db.select().from(users).where(eq(users.id, transport.travelRateApprovedBy));
            if (foundUsers.length > 0) {
              const u = foundUsers[0];
              travelRateApprovedByUser = { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName };
            }
          }
          // Fetch the most recent collect for this vehicle chassi (for Data Coleta column)
          const vehicleCollects = transport.vehicleChassi
            ? await db.select({ collectDate: collects.collectDate })
                .from(collects)
                .where(eq(collects.vehicleChassi, transport.vehicleChassi))
                .orderBy(desc(collects.createdAt))
                .limit(1)
            : [];
          const collectDate = vehicleCollects[0]?.collectDate ?? null;

          return { ...transport, client, originYard, deliveryLocation, driver, createdByUser, driverAssignedByUser, travelRate, travelRateApprovedByUser, collectDate };
        })
      );
      res.json(transportsWithRelations);
    } catch (error) {
      console.error("Error fetching transports:", error);
      res.status(500).json({ message: "Failed to fetch transports" });
    }
  });

  app.get("/api/transports/recent", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getRecentTransports(5);
      res.json(data);
    } catch (error) {
      console.error("Error fetching recent transports:", error);
      res.status(500).json({ message: "Failed to fetch recent transports" });
    }
  });

  app.get("/api/transports/with-checkpoints", isAuthenticatedJWT, async (req, res) => {
    try {
      const transportsList = await db.select().from(transports);
      const transportsWithDetails = await Promise.all(
        transportsList.map(async (transport) => {
          const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.chassi, transport.vehicleChassi));
          const [client] = await db.select().from(clients).where(eq(clients.id, transport.clientId));
          const [originYard] = await db.select().from(yards).where(eq(yards.id, transport.originYardId));
          const [deliveryLocation] = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, transport.deliveryLocationId));
          const [driver] = transport.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, transport.driverId))
            : [null];
          
          const transportCps = await db.select().from(transportCheckpoints)
            .where(eq(transportCheckpoints.transportId, transport.id));
          
          const cpsWithDetails = await Promise.all(
            transportCps.map(async (tcp) => {
              const [checkpoint] = await db.select().from(checkpoints).where(eq(checkpoints.id, tcp.checkpointId));
              return { ...tcp, checkpoint };
            })
          );

          return {
            ...transport,
            vehicle,
            client,
            originYard,
            deliveryLocation,
            driver,
            checkpoints: cpsWithDetails,
          };
        })
      );
      res.json(transportsWithDetails);
    } catch (error) {
      console.error("Error fetching transports with checkpoints:", error);
      res.status(500).json({ message: "Failed to fetch transports with checkpoints" });
    }
  });

  app.get("/api/drivers/:driverId/transports", isAuthenticatedJWT, async (req, res) => {
    try {
      const { driverId } = req.params;
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      const transportsList = await storage.getTransportsByDriver(driverId);
      const transportsWithRelations = await Promise.all(
        transportsList.map(async (transport) => {
          const [client] = transport.clientId
            ? await db.select().from(clients).where(eq(clients.id, transport.clientId))
            : [null];
          const [originYard] = transport.originYardId
            ? await db.select().from(yards).where(eq(yards.id, transport.originYardId))
            : [null];
          const [deliveryLocation] = transport.deliveryLocationId
            ? await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, transport.deliveryLocationId))
            : [null];
          let travelRate = null;
          if (transport.travelRateId) {
            const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, transport.travelRateId));
            if (rate) travelRate = rate;
          }
          return { ...transport, client, originYard, deliveryLocation, driver, travelRate };
        })
      );
      res.json(transportsWithRelations);
    } catch (error) {
      console.error("Error fetching transports by driver:", error);
      res.status(500).json({ message: "Failed to fetch transports by driver" });
    }
  });

  app.get("/api/transports/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const transport = await storage.getTransport(req.params.id);
      if (!transport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      res.json(transport);
    } catch (error) {
      console.error("Error fetching transport:", error);
      res.status(500).json({ message: "Failed to fetch transport" });
    }
  });

  app.get("/api/transports/:id/route-info", isAuthenticatedJWT, async (req, res) => {
    try {
      const transport = await storage.getTransport(req.params.id);
      if (!transport) return res.status(404).json({ message: "Transport not found" });

      // Associated route (by origin+destination)
      let associatedRoute = null;
      if (transport.originYardId && transport.deliveryLocationId) {
        const [route] = await db.select().from(routes)
          .where(and(
            eq(routes.originYardId, transport.originYardId),
            eq(routes.destinationLocationId, transport.deliveryLocationId)
          )).limit(1);
        if (route) {
          associatedRoute = {
            id: route.id,
            name: route.name,
            fuelCost: route.fuelCost,
            tollCost: route.tollCost,
            driverDailyCost: route.driverDailyCost,
            foodCost: (route as any).foodCost ?? null,
            othersCost: (route as any).othersCost ?? null,
            totalCost: route.totalCost,
          };
        }
      }

      // Advance amount from linked proposal
      let advanceAmount: string | null = null;
      let advanceMethod: string | null = null;
      const [proposalItem] = await db.select().from(transportProposalItems).where(eq(transportProposalItems.transportId, req.params.id));
      if (proposalItem) {
        const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, proposalItem.proposalId));
        if (proposal?.advanceAmount) advanceAmount = String(proposal.advanceAmount);
        if (proposal?.advanceMethod) advanceMethod = proposal.advanceMethod;
      }

      // Also check expense settlement advance
      const [settlement] = await db.select().from(expenseSettlements).where(eq(expenseSettlements.transportId, req.params.id));
      if (settlement?.advanceAmount) advanceAmount = String(settlement.advanceAmount);

      res.json({ associatedRoute, advanceAmount, advanceMethod });
    } catch (error) {
      console.error("Error fetching transport route-info:", error);
      res.status(500).json({ message: "Failed to fetch route info" });
    }
  });

  app.get("/api/transports/:id/proposals", isAuthenticatedJWT, async (req, res) => {
    try {
      const items = await db
        .select()
        .from(transportProposalItems)
        .where(eq(transportProposalItems.transportId, req.params.id));

      if (!items.length) return res.json([]);

      const proposalIds = items.map(i => i.proposalId);
      const proposals = await db
        .select()
        .from(transportProposals)
        .where(drizzleSql`${transportProposals.id} = ANY(ARRAY[${drizzleSql.raw(proposalIds.map(id => `'${id}'`).join(","))}]::varchar[])`);

      const result = await Promise.all(proposals.map(async p => {
        const drivers = await db
          .select()
          .from(transportProposalDrivers)
          .where(eq(transportProposalDrivers.proposalId, p.id));
        const assigned = drivers.filter(d => d.assignedTransportId === req.params.id);
        const assignedDriver = assigned.length > 0
          ? await storage.getDriver(assigned[0].driverId)
          : null;
        return {
          id: p.id,
          proposalNumber: p.proposalNumber,
          status: p.status,
          startDate: p.startDate,
          createdAt: p.createdAt,
          totalDriverResponses: drivers.length,
          acceptedDrivers: drivers.filter(d => d.status === "aceito").length,
          assignedDriver: assignedDriver ? { id: assignedDriver.id, name: assignedDriver.name } : null,
        };
      }));

      result.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function validateVehicleAvailableForTransport(
    chassi: string,
    excludeTransportId?: string,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const vehicle = await storage.getVehicle(chassi);
    if (!vehicle) {
      return { ok: false, status: 400, message: `Veículo com chassi "${chassi}" não encontrado.` };
    }
    const vehicleStatusLabels: Record<string, string> = {
      despachado: "despachado",
      entregue: "entregue",
      em_transferencia: "em transferência",
      retirado: "retirado",
    };
    const allowedStatuses = ["pre_estoque", "em_estoque"];
    if (!allowedStatuses.includes(vehicle.status as string)) {
      const label = vehicleStatusLabels[vehicle.status as string] ?? vehicle.status;
      return {
        ok: false,
        status: 400,
        message: `Não é possível usar o veículo ${chassi} em um transporte pois ele está com status "${label}". Apenas veículos em estoque podem ser despachados.`,
      };
    }
    const conditions = [
      eq(transports.vehicleChassi, chassi),
      ne(transports.status, "entregue"),
      ne(transports.status, "cancelado"),
    ];
    if (excludeTransportId) {
      conditions.push(ne(transports.id, excludeTransportId));
    }
    const activeTransport = await db
      .select({ id: transports.id, requestNumber: transports.requestNumber })
      .from(transports)
      .where(and(...conditions))
      .limit(1);
    if (activeTransport.length > 0) {
      return {
        ok: false,
        status: 400,
        message: `Já existe um transporte ativo (${activeTransport[0].requestNumber}) para o veículo ${chassi}.`,
      };
    }
    return { ok: true };
  }

  app.post("/api/transports", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertTransportSchema.parse(req.body);
      const userId = req.user?.id;

      const check = await validateVehicleAvailableForTransport(data.vehicleChassi);
      if (!check.ok) {
        return res.status(check.status).json({ message: check.message });
      }

      let approvalStatus: string | undefined = undefined;
      if (data.travelRateId) {
        const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, data.travelRateId));
        if (rate && rate.requiresApproval === "true") {
          approvalStatus = "pendente";
        }
      }
      const transportData = {
        ...data,
        createdByUserId: userId,
        driverAssignedByUserId: data.driverId ? userId : undefined,
        driverAssignedAt: data.driverId ? new Date() : undefined,
        travelRateApprovalStatus: approvalStatus,
      };
      const transport = await storage.createTransport(transportData);
      res.status(201).json(transport);
    } catch (error: any) {
      console.error("Error creating transport:", error);
      res.status(400).json({ message: error.message || "Failed to create transport" });
    }
  });

  app.patch("/api/transports/:id", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertTransportSchema.partial().parse(req.body);
      const userId = req.user?.id;

      // Check if driver is being assigned for the first time
      const existingTransport = await storage.getTransport(req.params.id);
      if (!existingTransport) {
        return res.status(404).json({ message: "Transport not found" });
      }

      // If vehicleChassi is being changed, re-validate availability for the NEW chassi
      if (data.vehicleChassi && data.vehicleChassi !== existingTransport.vehicleChassi) {
        const check = await validateVehicleAvailableForTransport(data.vehicleChassi, req.params.id);
        if (!check.ok) {
          return res.status(check.status).json({ message: check.message });
        }
      }

      let updateData: any = { ...data };
      if (data.driverId && !existingTransport.driverId) {
        updateData.driverAssignedByUserId = userId;
        updateData.driverAssignedAt = new Date();
      }

      const transport = await storage.updateTransport(req.params.id, updateData);
      if (!transport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      res.json(transport);
    } catch (error: any) {
      console.error("Error updating transport:", error);
      res.status(400).json({ message: error.message || "Failed to update transport" });
    }
  });

  app.delete("/api/transports/:id", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: "Motivo da exclusão é obrigatório" });
      }
      const existing = await storage.getTransport(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Transporte não encontrado" });
      }
      if (existing.status === "entregue") {
        return res.status(400).json({ message: "Transportes com status 'Entregue' não podem ser apagados" });
      }
      const userId = req.user?.id?.toString();
      const username = req.user?.username;
      await storage.deleteTransport(req.params.id, reason.trim(), userId, username);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting transport:", error);
      res.status(500).json({ message: error.message || "Failed to delete transport" });
    }
  });

  app.get("/api/deleted-transports", isAuthenticatedJWT, async (_req, res) => {
    try {
      const records = await storage.getDeletedTransports();
      res.json(records);
    } catch (error) {
      console.error("Error fetching deleted transports:", error);
      res.status(500).json({ message: "Failed to fetch deleted transports" });
    }
  });

  // ==================== TRANSPORT RATE APPROVALS ====================
  app.get("/api/transport-rate-approvals", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const currentSystemUserId = req.user?.id;

      const pending = await db
        .select()
        .from(transports)
        .where(eq(transports.travelRateApprovalStatus, "pendente"))
        .orderBy(desc(transports.createdAt));
      const enriched = await Promise.all(
        pending.map(async (t) => {
          const [client] = t.clientId ? await db.select().from(clients).where(eq(clients.id, t.clientId)) : [null];
          const [yard] = t.originYardId ? await db.select().from(yards).where(eq(yards.id, t.originYardId)) : [null];
          const [deliveryLocation] = t.deliveryLocationId ? await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, t.deliveryLocationId)) : [null];
          const [rate] = t.travelRateId ? await db.select().from(travelRates).where(eq(travelRates.id, t.travelRateId)) : [null];
          const [creator] = t.createdByUserId ? await db.select().from(users).where(eq(users.id, t.createdByUserId)) : [null];
          const approvers = rate ? await db
            .select({ id: travelRateApprovers.id, userId: travelRateApprovers.userId, userName: users.username, userEmail: users.email })
            .from(travelRateApprovers)
            .innerJoin(users, eq(travelRateApprovers.userId, users.id))
            .where(eq(travelRateApprovers.travelRateId, rate.id)) : [];
          // Route history: all transports (any status) on the same origin → destination route
          const routeHistory = (t.originYardId && t.deliveryLocationId) ? await db
            .select({
              id: transports.id,
              requestNumber: transports.requestNumber,
              createdAt: transports.createdAt,
              status: transports.status,
              travelRateApprovalStatus: transports.travelRateApprovalStatus,
              travelRateId: transports.travelRateId,
            })
            .from(transports)
            .where(
              and(
                eq(transports.originYardId, t.originYardId),
                eq(transports.deliveryLocationId, t.deliveryLocationId),
                ne(transports.id, t.id)
              )
            )
            .orderBy(desc(transports.createdAt))
            .limit(5) : [];
          // Enrich route history with rate names
          const routeHistoryEnriched = await Promise.all(
            routeHistory.map(async (h) => {
              const [hRate] = h.travelRateId ? await db.select({ name: travelRates.name }).from(travelRates).where(eq(travelRates.id, h.travelRateId)) : [null];
              return { ...h, rateName: hRate?.name ?? null };
            })
          );
          const routeCount = routeHistoryEnriched.length;
          return { ...t, client, originYard: yard, deliveryLocation, travelRate: rate, createdByUser: creator, rateApprovers: approvers, routeHistory: routeHistoryEnriched, routeCount };
        })
      );
      // OR logic: only show transports where the current system_user is one of the configured approvers.
      // If a rate has no approvers configured, fall back to showing it to everyone.
      const filtered = enriched.filter((t) => {
        if (!t.rateApprovers || t.rateApprovers.length === 0) return true;
        if (!currentSystemUserId) return true;
        return t.rateApprovers.some((a) => a.userId === currentSystemUserId);
      });
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching rate approvals:", error);
      res.status(500).json({ message: "Erro ao buscar aprovações" });
    }
  });

  app.patch("/api/transports/:id/rate-approval", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, note } = req.body;
      if (!["aprovado", "rejeitado"].includes(status)) {
        return res.status(400).json({ message: "Status deve ser 'aprovado' ou 'rejeitado'" });
      }
      const systemUserId = req.user?.id;

      // OR logic: validate that the current system user is one of the configured approvers for this rate.
      // If no approvers are configured, anyone can approve (fallback).
      const [transport] = await db.select().from(transports).where(eq(transports.id, req.params.id));
      if (!transport) return res.status(404).json({ message: "Transporte não encontrado" });
      if (transport.travelRateId && systemUserId) {
        const approvers = await db
          .select()
          .from(travelRateApprovers)
          .where(eq(travelRateApprovers.travelRateId, transport.travelRateId));
        if (approvers.length > 0) {
          const isApprover = approvers.some((a) => a.userId === systemUserId);
          if (!isApprover) {
            return res.status(403).json({ message: "Você não tem permissão para aprovar esta tarifa" });
          }
        }
      }
      const [updated] = await db
        .update(transports)
        .set({
          travelRateApprovalStatus: status,
          travelRateApprovedBy: systemUserId ?? null,
          travelRateApprovedAt: new Date(),
          travelRateApprovalNote: note || null,
          // When approved, advance transport to normal pending flow; rejected stays blocked
          ...(status === "aprovado" ? { status: "pendente" } : {}),
        })
        .where(eq(transports.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Transporte não encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating rate approval:", error);
      res.status(500).json({ message: "Erro ao processar aprovação" });
    }
  });

  // Proposal Rate Approval
  app.get("/api/proposal-rate-approvals", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const pending = await db.select().from(transportProposals)
        .where(eq(transportProposals.rateApprovalStatus, "pendente"));
      const result = await Promise.all(pending.map(async (p) => {
        const [yard, client, deliveryLocation] = await Promise.all([
          storage.getYard(p.originYardId),
          storage.getClient(p.clientId),
          storage.getDeliveryLocation(p.deliveryLocationId),
        ]);
        let travelRate = null;
        if (p.travelRateId) {
          const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, p.travelRateId));
          if (rate) travelRate = rate;
        }
        const items = await storage.getProposalItems(p.id);
        return { ...p, originYard: yard, client, deliveryLocation, travelRate, totalSlots: items.length };
      }));
      res.json(result);
    } catch (error) {
      console.error("Error fetching proposal rate approvals:", error);
      res.status(500).json({ message: "Erro ao buscar propostas pendentes de aprovação" });
    }
  });

  app.patch("/api/transport-proposals/:id/rate-approval", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, note } = req.body;
      if (!["aprovado", "rejeitado"].includes(status)) {
        return res.status(400).json({ message: "Status deve ser 'aprovado' ou 'rejeitado'" });
      }
      const systemUserId = req.user?.id;

      const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, req.params.id));
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });

      if (proposal.travelRateId && systemUserId) {
        const approvers = await db.select().from(travelRateApprovers).where(eq(travelRateApprovers.travelRateId, proposal.travelRateId));
        if (approvers.length > 0) {
          const isApprover = approvers.some((a) => a.userId === systemUserId);
          if (!isApprover) {
            return res.status(403).json({ message: "Você não tem permissão para aprovar esta tarifa" });
          }
        }
      }

      const setPayload = {
        rateApprovalStatus: status,
        rateApprovedBy: req.user?.username ?? null,
        rateApprovedAt: new Date(),
        rateApprovalNote: note || null,
      };

      // For approval, do an ATOMIC compare-and-set on `rateApprovalStatus = 'pendente'`
      // and `status <> 'cancelada'`. Only the first concurrent request wins, and
      // only the winner fires the deferred push. This prevents:
      //   (a) duplicate pushes from racing PATCH requests
      //   (b) push for a proposal that was cancelled between SELECT and UPDATE
      let updated: typeof proposal | undefined;
      let firePush = false;

      if (status === "aprovado") {
        const [winner] = await db.update(transportProposals)
          .set(setPayload)
          .where(and(
            eq(transportProposals.id, req.params.id),
            eq(transportProposals.rateApprovalStatus, "pendente"),
            ne(transportProposals.status, "cancelada"),
          ))
          .returning();

        if (winner) {
          updated = winner;
          firePush = true;
        } else {
          // Either already approved/rejected, or proposal was cancelled.
          // Apply the update unconditionally for idempotency, but do NOT fire push.
          [updated] = await db.update(transportProposals)
            .set(setPayload)
            .where(eq(transportProposals.id, req.params.id))
            .returning();
        }
      } else {
        // Rejection: never fires push.
        [updated] = await db.update(transportProposals)
          .set(setPayload)
          .where(eq(transportProposals.id, req.params.id))
          .returning();
      }

      await logProposalAction(req.params.id, "change_status",
        status === "aprovado" ? `Tarifa aprovada${note ? `: ${note}` : ""}` : `Tarifa rejeitada${note ? `: ${note}` : ""}`,
        req.user?.username ?? "sistema"
      );

      res.json(updated);

      if (firePush && updated) {
        (async () => {
          try {
            const { title, body, data } = await buildProposalPushContent(
              updated!, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage)
            );
            await sendPushToAllActiveDrivers(title, body, data);
            console.log(`[rate-approval] Deferred push sent for proposal ${updated!.id}.`);
          } catch (e: any) {
            console.warn("Deferred proposal push notification error:", e?.message);
          }
        })();
      }
    } catch (error) {
      console.error("Error updating proposal rate approval:", error);
      res.status(500).json({ message: "Erro ao processar aprovação" });
    }
  });

  // Transport Check-in (pickup from yard)
  app.patch("/api/transports/:id/checkin", isAuthenticatedJWT, async (req, res) => {
    try {
      const { latitude, longitude, frontalPhoto, lateral1Photo, lateral2Photo, traseiraPhoto, odometerPhoto, fuelLevelPhoto, damagePhotos, selfiePhoto, notes } = req.body;
      
      const existingTransport = await storage.getTransport(req.params.id);
      if (!existingTransport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      
      const transport = await storage.updateTransport(req.params.id, {
        checkinDateTime: new Date(),
        checkinLocation: latitude && longitude ? { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] } : null,
        checkinFrontalPhoto: frontalPhoto,
        checkinLateral1Photo: lateral1Photo,
        checkinLateral2Photo: lateral2Photo,
        checkinTraseiraPhoto: traseiraPhoto,
        checkinOdometerPhoto: odometerPhoto,
        checkinFuelLevelPhoto: fuelLevelPhoto,
        checkinDamagePhotos: damagePhotos || [],
        checkinSelfiePhoto: selfiePhoto,
        checkinNotes: notes,
        status: "aguardando_saida",
      });
      
      // Update vehicle status to "despachado" (dispatched)
      await storage.updateVehicle(existingTransport.vehicleChassi, {
        status: "despachado",
      });

      // Auto-criar prestação de contas se ainda não existir (mesmo sem motorista atribuído)
      try {
        const [existingSettlement] = await db
          .select()
          .from(expenseSettlements)
          .where(eq(expenseSettlements.transportId, req.params.id))
          .limit(1);

        if (!existingSettlement) {
          let advanceAmount: string | null = null;
          const [proposalItem] = await db
            .select()
            .from(transportProposalItems)
            .where(eq(transportProposalItems.transportId, req.params.id));
          if (proposalItem) {
            const [proposal] = await db
              .select()
              .from(transportProposals)
              .where(eq(transportProposals.id, proposalItem.proposalId));
            if (proposal?.advanceAmount) advanceAmount = String(proposal.advanceAmount);
          }

          await storage.createExpenseSettlement({
            transportId: req.params.id,
            driverId: existingTransport.driverId ?? null,
            status: "pendente",
            advanceAmount,
            routeDistance: existingTransport.routeDistanceKm ? `${existingTransport.routeDistanceKm} km` : null,
            estimatedTolls: existingTransport.estimatedTolls || null,
            estimatedFuel: existingTransport.estimatedFuel || null,
          } as any);
        }
      } catch (settlementErr) {
        console.error("Error auto-creating expense settlement on internal check-in:", settlementErr);
      }

      res.json(transport);
    } catch (error: any) {
      console.error("Error performing transport check-in:", error);
      res.status(400).json({ message: error.message || "Failed to perform check-in" });
    }
  });

  // Transport Check-out (delivery to client)
  app.patch("/api/transports/:id/conclude", isAuthenticatedJWT, async (req, res) => {
    try {
      const existingTransport = await storage.getTransport(req.params.id);
      if (!existingTransport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      if (existingTransport.status === "entregue") {
        return res.status(400).json({ message: "Transporte já foi concluído" });
      }
      if (existingTransport.status === "cancelado") {
        return res.status(400).json({ message: "Transporte cancelado não pode ser concluído" });
      }

      const checkoutTime = existingTransport.checkoutDateTime ?? new Date();
      const [updatedTransport] = await db
        .update(transports)
        .set({ status: "entregue", checkoutDateTime: checkoutTime })
        .where(eq(transports.id, req.params.id))
        .returning();

      await db
        .update(vehicles)
        .set({ status: "entregue" })
        .where(eq(vehicles.chassi, existingTransport.vehicleChassi));

      res.json(updatedTransport);
    } catch (error: any) {
      console.error("Error concluding transport:", error);
      res.status(400).json({ message: error.message || "Failed to conclude transport" });
    }
  });

  app.patch("/api/transports/:id/checkout", isAuthenticatedJWT, async (req, res) => {
    try {
      const { latitude, longitude, frontalPhoto, lateral1Photo, lateral2Photo, traseiraPhoto, odometerPhoto, fuelLevelPhoto, damagePhotos, selfiePhoto, notes } = req.body;
      
      const existingTransport = await storage.getTransport(req.params.id);
      if (!existingTransport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      
      // Validate that check-in was performed first
      if (!existingTransport.checkinDateTime) {
        return res.status(400).json({ message: "Check-in must be performed before check-out" });
      }
      
      const transport = await storage.updateTransport(req.params.id, {
        checkoutDateTime: new Date(),
        checkoutLocation: latitude && longitude ? { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] } : null,
        checkoutFrontalPhoto: frontalPhoto,
        checkoutLateral1Photo: lateral1Photo,
        checkoutLateral2Photo: lateral2Photo,
        checkoutTraseiraPhoto: traseiraPhoto,
        checkoutOdometerPhoto: odometerPhoto,
        checkoutFuelLevelPhoto: fuelLevelPhoto,
        checkoutDamagePhotos: damagePhotos || [],
        checkoutSelfiePhoto: selfiePhoto,
        checkoutNotes: notes,
        status: "entregue",
      });
      
      // Update vehicle status to "entregue" (delivered)
      await storage.updateVehicle(existingTransport.vehicleChassi, {
        status: "entregue",
      });
      
      res.json(transport);
    } catch (error: any) {
      console.error("Error performing transport check-out:", error);
      res.status(400).json({ message: error.message || "Failed to perform check-out" });
    }
  });

  // Clear Transport Check-in (admin only)
  app.delete("/api/transports/:id/checkin", isAuthenticatedJWT, async (req, res) => {
    try {
      const existingTransport = await storage.getTransport(req.params.id);
      if (!existingTransport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      
      // If checkout exists, must clear it first
      if (existingTransport.checkoutDateTime) {
        return res.status(400).json({ message: "Check-out must be cleared before clearing check-in" });
      }
      
      const transport = await storage.clearTransportCheckin(req.params.id);
      
      // Revert vehicle status back to em_estoque
      await storage.updateVehicle(existingTransport.vehicleChassi, {
        status: "em_estoque",
      });
      
      res.json(transport);
    } catch (error: any) {
      console.error("Error clearing transport check-in:", error);
      res.status(400).json({ message: error.message || "Failed to clear check-in" });
    }
  });

  // Clear Transport Check-out (admin only)
  app.delete("/api/transports/:id/checkout", isAuthenticatedJWT, async (req, res) => {
    try {
      const existingTransport = await storage.getTransport(req.params.id);
      if (!existingTransport) {
        return res.status(404).json({ message: "Transport not found" });
      }
      
      const transport = await storage.clearTransportCheckout(req.params.id);
      
      // Revert vehicle status back to despachado
      await storage.updateVehicle(existingTransport.vehicleChassi, {
        status: "despachado",
      });
      
      res.json(transport);
    } catch (error: any) {
      console.error("Error clearing transport check-out:", error);
      res.status(400).json({ message: error.message || "Failed to clear check-out" });
    }
  });

  // Driver Notifications
  app.get("/api/driver-notifications", isAuthenticatedJWT, async (req, res) => {
    try {
      const { yardId, deliveryLocationId, departureDate } = req.query;
      if (!yardId || !deliveryLocationId || !departureDate) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      const notifications = await storage.getDriverNotifications(
        yardId as string,
        deliveryLocationId as string,
        departureDate as string
      );
      const notificationsWithDrivers = await Promise.all(
        notifications.map(async (notification) => {
          const [driver] = await db.select().from(drivers).where(eq(drivers.id, notification.driverId));
          return { ...notification, driver };
        })
      );
      res.json(notificationsWithDrivers);
    } catch (error) {
      console.error("Error fetching driver notifications:", error);
      res.status(500).json({ message: "Failed to fetch driver notifications" });
    }
  });

  app.post("/api/driver-notifications/notify", isAuthenticatedJWT, async (req, res) => {
    try {
      const { yardId, deliveryLocationId, departureDate } = req.body;
      const activeDrivers = await storage.getDrivers();
      const notifications = await Promise.all(
        activeDrivers
          .filter((d) => d.isActive === "true")
          .map((driver) =>
            storage.createDriverNotification({
              yardId,
              deliveryLocationId,
              departureDate,
              driverId: driver.id,
              status: "pendente",
            })
          )
      );
      res.status(201).json(notifications);
    } catch (error: any) {
      console.error("Error creating driver notifications:", error);
      res.status(400).json({ message: error.message || "Failed to create notifications" });
    }
  });

  app.post("/api/driver-notifications/:id/accept", isAuthenticatedJWT, async (req, res) => {
    try {
      const notification = await storage.updateDriverNotification(req.params.id, {
        status: "aceito",
      });
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error accepting notification:", error);
      res.status(500).json({ message: "Failed to accept notification" });
    }
  });

  // Auth Users (tabela `users`, usada por FKs de aprovadores etc)
  app.get("/api/users", isAuthenticatedJWT, async (_req, res) => {
    try {
      const list = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      }).from(users).orderBy(users.username);
      res.json(list);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // System Users
  app.get("/api/system-users", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getSystemUsers();
      res.json(data);
    } catch (error) {
      console.error("Error fetching system users:", error);
      res.status(500).json({ message: "Failed to fetch system users" });
    }
  });

  app.get("/api/system-users/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const user = await storage.getSystemUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching system user:", error);
      res.status(500).json({ message: "Failed to fetch system user" });
    }
  });

  // Helper: user can manage system users if admin OR has feature 'criar-usuarios' granted
  // to its role/user_type. We check both role_permissions and user_type_permissions.
  const canManageUsers = async (user: any): Promise<boolean> => {
    if (!user) return false;
    if (user.role === "admin") return true;
    // Check user_type_permissions first (this is what the Permissions UI writes to)
    try {
      const utpRows = await db
        .select()
        .from(userTypePermissions)
        .where(and(eq(userTypePermissions.userTypeId, user.role), eq(userTypePermissions.feature, "criar-usuarios")));
      if (utpRows.some((r) => r.canView !== "false")) return true;
    } catch { /* ignore */ }
    // Fallback to legacy role_permissions (only admin/operador/visualizador/motorista/portaria are valid)
    try {
      const rolePermRows = await db
        .select()
        .from(rolePermissions)
        .where(and(eq(rolePermissions.role, user.role as any), eq(rolePermissions.feature, "criar-usuarios" as any)));
      if (rolePermRows.length > 0) return true;
    } catch { /* ignore */ }
    return false;
  };

  app.post("/api/system-users", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (!(await canManageUsers(req.user))) {
        return res.status(403).json({ message: "Você não tem permissão para criar usuários" });
      }

      const data = insertSystemUserSchema.parse(req.body);
      const passwordHash = await hashPassword(data.password);
      const user = await storage.createSystemUser({ ...data, password: passwordHash });

      // Sync to users table so the user can log in
      const [existing] = await db.select().from(users).where(eq(users.email, data.email));
      if (!existing) {
        await db.insert(users).values({
          username: data.username,
          email: data.email,
          passwordHash,
          role: data.role || "operador",
          isActive: "true",
        });
      }

      res.status(201).json(user);
    } catch (error: any) {
      console.error("Error creating system user:", error);
      res.status(400).json({ message: error.message || "Failed to create system user" });
    }
  });

  app.patch("/api/system-users/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (!(await canManageUsers(req.user))) {
        return res.status(403).json({ message: "Você não tem permissão para editar usuários" });
      }

      const data = insertSystemUserSchema.partial().parse(req.body);

      // Read the original record BEFORE updating so we can find it in the users table by old email
      const original = await storage.getSystemUser(req.params.id);
      if (!original) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash password BEFORE persisting in system_users so cleartext is never stored
      const newPasswordHash = data.password ? await hashPassword(data.password) : undefined;
      const dataToSave = newPasswordHash ? { ...data, password: newPasswordHash } : data;

      const user = await storage.updateSystemUser(req.params.id, dataToSave);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Sync relevant fields to the users table to keep auth consistent
      const syncFields: Record<string, any> = {};
      if (data.role) syncFields.role = data.role;
      if (data.email) syncFields.email = data.email;
      if (data.username) syncFields.username = data.username;
      if (data.isActive !== undefined) syncFields.isActive = data.isActive;
      if (data.password) syncFields.passwordHash = await hashPassword(data.password);

      if (Object.keys(syncFields).length > 0) {
        // Match by the ORIGINAL email so we update the right users row even if email changed
        await db.update(users).set(syncFields).where(eq(users.email, original.email));
      }

      res.json(user);
    } catch (error: any) {
      console.error("Error updating system user:", error);
      res.status(400).json({ message: error.message || "Failed to update system user" });
    }
  });

  app.delete("/api/system-users/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (!(await canManageUsers(req.user))) {
        return res.status(403).json({ message: "Você não tem permissão para excluir usuários" });
      }

      // Prevent admin from deleting their own account
      const target = await storage.getSystemUser(req.params.id);
      if (!target) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      if (target.email === req.user.email) {
        return res.status(400).json({ message: "Você não pode excluir sua própria conta" });
      }

      // Remove from users table first (invalidates all future logins)
      await db.delete(users).where(eq(users.email, target.email));

      await storage.deleteSystemUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting system user:", error);
      res.status(500).json({ message: "Failed to delete system user" });
    }
  });

  // Role Permissions
  app.get("/api/role-permissions", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getRolePermissions();
      res.json(data);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.get("/api/role-permissions/:role", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getPermissionsByRole(req.params.role);
      res.json(data);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      res.status(500).json({ message: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/role-permissions/:role", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await db.select().from(users).where(eq(users.id, userId));
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Apenas administradores podem alterar permissões" });
      }

      const { features } = req.body as { features: FeatureKey[] };
      const validFeatures = features.filter((f) => featureKeys.includes(f));
      
      if (req.params.role === "admin" && !validFeatures.includes("usuarios")) {
        validFeatures.push("usuarios");
      }
      
      await storage.setRolePermissions(req.params.role, validFeatures);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error setting role permissions:", error);
      res.status(400).json({ message: error.message || "Failed to set role permissions" });
    }
  });

  // User Types
  app.get("/api/user-types", isAuthenticatedJWT, async (_req, res) => {
    try {
      const data = await storage.getUserTypes();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user types" });
    }
  });

  app.post("/api/user-types", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { name, description, id } = req.body;
      if (!name || !id) return res.status(400).json({ message: "id e name são obrigatórios" });
      const slug = id.toLowerCase().replace(/[^a-z0-9-_]/g, "-").substring(0, 50);
      const existing = await storage.getUserType(slug);
      if (existing) return res.status(400).json({ message: "Já existe um tipo com este ID" });
      const created = await storage.createUserType({ id: slug, name, description, isSystem: "false" });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create user type" });
    }
  });

  app.put("/api/user-types/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      const updated = await storage.updateUserType(req.params.id, { name, description });
      if (!updated) return res.status(404).json({ message: "Tipo de usuário não encontrado" });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update user type" });
    }
  });

  app.delete("/api/user-types/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const userType = await storage.getUserType(req.params.id);
      if (!userType) return res.status(404).json({ message: "Tipo não encontrado" });
      if (userType.isSystem === "true") return res.status(400).json({ message: "Tipos de sistema não podem ser excluídos" });
      await storage.deleteUserType(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to delete user type" });
    }
  });

  app.get("/api/user-types/:id/permissions", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = await storage.getUserTypePermissions(req.params.id);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  app.post("/api/user-types/:id/permissions", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { permissions } = req.body as { permissions: { feature: string; canView: string }[] };
      if (!Array.isArray(permissions)) return res.status(400).json({ message: "permissions deve ser um array" });
      await storage.setUserTypePermissions(req.params.id, permissions);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to set permissions" });
    }
  });

  // Helper: get Google Maps API key from DB (preferred) or env (fallback)
  const getGoogleMapsApiKey = async (): Promise<string | null> => {
    try {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, "google_maps_api_key"));
      const dbVal = rows[0]?.value?.trim();
      if (dbVal) return dbVal;
    } catch { /* ignore */ }
    return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
  };

  // ───────────────────────────────────────────────────────────────────────
  // Distance helpers + per-segment journey distances endpoint
  // ───────────────────────────────────────────────────────────────────────

  // Haversine straight-line distance in km between two GPS points
  // (renamed to avoid clash with the legacy local `haversineKm` declarations
  // that already exist elsewhere in this file).
  const journeyHaversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth radius in km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  };

  // In-process cache of (origin → destination) Google Directions results.
  // Coordinates rounded to 5 decimals (~1m precision); entries expire after 24h.
  // Hard-capped at DIRECTIONS_CACHE_MAX entries; on overflow we drop the
  // oldest (insertion order) ~10% to bound memory growth.
  type DistEntry = { km: number; ts: number };
  const directionsCache = new Map<string, DistEntry>();
  const DIRECTIONS_TTL_MS = 24 * 60 * 60 * 1000;
  const DIRECTIONS_CACHE_MAX = 5000;
  const DIRECTIONS_FETCH_TIMEOUT_MS = 4000;

  const cacheKey = (oLat: number, oLng: number, dLat: number, dLng: number) =>
    `${oLat.toFixed(5)},${oLng.toFixed(5)}->${dLat.toFixed(5)},${dLng.toFixed(5)}`;

  const cacheSet = (key: string, km: number) => {
    if (directionsCache.size >= DIRECTIONS_CACHE_MAX) {
      const drop = Math.ceil(DIRECTIONS_CACHE_MAX * 0.1);
      const it = directionsCache.keys();
      for (let i = 0; i < drop; i++) {
        const k = it.next().value;
        if (k === undefined) break;
        directionsCache.delete(k);
      }
    }
    directionsCache.set(key, { km, ts: Date.now() });
  };

  // Returns driving distance in km via Google Directions API; null on failure.
  const googleDrivingDistanceKm = async (
    apiKey: string,
    oLat: number, oLng: number,
    dLat: number, dLng: number,
  ): Promise<number | null> => {
    const key = cacheKey(oLat, oLng, dLat, dLng);
    const cached = directionsCache.get(key);
    if (cached && Date.now() - cached.ts < DIRECTIONS_TTL_MS) return cached.km;

    // Bound the request time so a slow upstream cannot stall the whole report.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), DIRECTIONS_FETCH_TIMEOUT_MS);
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&language=pt-BR&region=br&key=${apiKey}`;
      const r = await fetch(url, { signal: ac.signal });
      const data = await r.json();
      if (data.status !== "OK" || !data.routes?.[0]?.legs?.[0]?.distance?.value) return null;
      const km = data.routes[0].legs[0].distance.value / 1000;
      cacheSet(key, km);
      return km;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Minimum meaningful distance (km). Below this we assume the two GPS
  // points describe the same spot (driver checked in/out at the same place,
  // missing coordinates, or yards stored with identical coords) and report
  // the segment as "no realized distance" instead of rounding to "0 km".
  const MIN_REALIZED_KM = 0.5;

  // Resolve driving distance with Google, falling back to Haversine straight-line.
  // `source` indicates which method actually produced the value. Returns null
  // when the segment is shorter than MIN_REALIZED_KM (treated as noise).
  const resolveDistanceKm = async (
    apiKey: string | null,
    oLat: number | null | undefined, oLng: number | null | undefined,
    dLat: number | null | undefined, dLng: number | null | undefined,
  ): Promise<{ km: number; source: "directions" | "haversine" } | null> => {
    if (oLat == null || oLng == null || dLat == null || dLng == null) return null;
    if (!isFinite(oLat) || !isFinite(oLng) || !isFinite(dLat) || !isFinite(dLng)) return null;
    // Skip the Google round-trip entirely when the straight-line distance is
    // already below the noise threshold (saves quota and latency).
    const straightKm = journeyHaversineKm(oLat, oLng, dLat, dLng);
    if (straightKm < MIN_REALIZED_KM) return null;
    if (apiKey) {
      const km = await googleDrivingDistanceKm(apiKey, oLat, oLng, dLat, dLng);
      if (km != null && km >= MIN_REALIZED_KM) return { km, source: "directions" };
    }
    return { km: straightKm, source: "haversine" };
  };

  app.get("/api/vehicle-journey/:chassi/distances", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      const chassi = decodeURIComponent(req.params.chassi);
      const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.chassi, chassi));
      if (!vehicle) return res.status(404).json({ message: "Veículo não encontrado" });
      // Same visibility rule as /api/vehicle-journey/:chassi: direct
      // vehicle.client_id OR any transport assigned to this client.
      if (req.clientId && vehicle.clientId !== req.clientId) {
        const [t] = await db.select({ id: transports.id })
          .from(transports)
          .where(and(eq(transports.vehicleChassi, chassi), eq(transports.clientId, req.clientId)))
          .limit(1);
        if (!t) return res.status(403).json({ message: "Acesso negado a este veículo" });
      }

      const apiKey = await getGoogleMapsApiKey();

      // Fetch all related rows
      const collectsList = await db.select().from(collects).where(eq(collects.vehicleChassi, chassi));
      const transportsList = await db.select().from(transports).where(eq(transports.vehicleChassi, chassi));
      const transfersList = await db.select().from(transfers).where(eq(transfers.vehicleChassi, chassi));

      // Pre-load yards used by transfers so we can read their lat/lng
      const yardIds = new Set<string>();
      for (const t of transfersList) {
        if (t.originYardId) yardIds.add(t.originYardId);
        if (t.destinationYardId) yardIds.add(t.destinationYardId);
      }
      const yardMap = new Map<string, { lat: number | null; lng: number | null }>();
      if (yardIds.size > 0) {
        const yardRows = await db.select().from(yards).where(inArray(yards.id, Array.from(yardIds)));
        for (const yd of yardRows) {
          const lat = yd.latitude ? parseFloat(yd.latitude) : null;
          const lng = yd.longitude ? parseFloat(yd.longitude) : null;
          yardMap.set(yd.id, { lat, lng });
        }
      }

      // Geometry on the journey: the row already has GeoJSON-like Point.
      const geomLat = (g: any): number | null => g?.coordinates?.[1] ?? null;
      const geomLng = (g: any): number | null => g?.coordinates?.[0] ?? null;

      // Helper: parse text-coordinate to number (for legacy varchar coords).
      const numOrNull = (v: any): number | null => {
        if (v == null || v === "") return null;
        const n = parseFloat(String(v));
        return isFinite(n) ? n : null;
      };

      // Compute per-segment distances in parallel.
      // Collects: prefer geometry (checkin/checkout); fall back to legacy
      // start/end varchar coordinates when geometry is unavailable.
      const collectsResults = await Promise.all(collectsList.map(async (c) => {
        const oLat = geomLat(c.checkinLocation) ?? numOrNull(c.startLatitude);
        const oLng = geomLng(c.checkinLocation) ?? numOrNull(c.startLongitude);
        const dLat = geomLat(c.checkoutLocation) ?? numOrNull(c.endLatitude);
        const dLng = geomLng(c.checkoutLocation) ?? numOrNull(c.endLongitude);
        const r = await resolveDistanceKm(apiKey, oLat, oLng, dLat, dLng);
        return { id: c.id, distanceKm: r?.km ?? null, source: r?.source ?? "none" };
      }));

      const transfersResults = await Promise.all(transfersList.map(async (t) => {
        const o = yardMap.get(t.originYardId);
        const d = yardMap.get(t.destinationYardId);
        const r = await resolveDistanceKm(apiKey, o?.lat, o?.lng, d?.lat, d?.lng);
        return { id: t.id, distanceKm: r?.km ?? null, source: r?.source ?? "none" };
      }));

      const transportsResults = await Promise.all(transportsList.map(async (t) => {
        const r = await resolveDistanceKm(
          apiKey,
          geomLat(t.checkinLocation), geomLng(t.checkinLocation),
          geomLat(t.checkoutLocation), geomLng(t.checkoutLocation),
        );
        const plannedKm = t.routeDistanceKm ? parseFloat(String(t.routeDistanceKm)) : null;
        return {
          id: t.id,
          plannedKm: plannedKm != null && !isNaN(plannedKm) ? plannedKm : null,
          realizedKm: r?.km ?? null,
          source: r?.source ?? "none",
        };
      }));

      const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
      const collectsKm = sum(collectsResults.map(r => r.distanceKm));
      const transfersKm = sum(transfersResults.map(r => r.distanceKm));
      const transportsRealizedKm = sum(transportsResults.map(r => r.realizedKm));
      const transportsPlannedKm = sum(transportsResults.map(r => r.plannedKm));
      // Total = realized when available, else planned (transports only) + collects + transfers
      const totalRealizedKm = collectsKm + transfersKm +
        transportsResults.reduce((a, r) => a + (r.realizedKm ?? r.plannedKm ?? 0), 0);

      res.json({
        collects: collectsResults,
        transfers: transfersResults,
        transports: transportsResults,
        totals: {
          collectsKm,
          transfersKm,
          transportsRealizedKm,
          transportsPlannedKm,
          totalRealizedKm,
        },
        apiKeyConfigured: !!apiKey,
      });
    } catch (err) {
      console.error("Error computing journey distances:", err);
      res.status(500).json({ message: "Falha ao calcular distâncias" });
    }
  });

  // Integrations
  app.get("/api/integrations/status", isAuthenticatedJWT, async (req, res) => {
    try {
      const gmKey = await getGoogleMapsApiKey();
      const googleMapsApiKey = !!gmKey;
      // Check Autentique token from DB or env
      const dbToken = await db.select().from(appSettings).where(eq(appSettings.key, "autentique_api_token"));
      const autentiqueConfigured = !!(dbToken[0]?.value || process.env.AUTENTIQUE_API_TOKEN);
      res.json({ googleMapsApiKey, autentiqueConfigured });
    } catch (error) {
      console.error("Error checking integration status:", error);
      res.status(500).json({ message: "Failed to check integration status" });
    }
  });

  // Google Maps integration config
  app.get("/api/integrations/google-maps/config", isAuthenticatedJWT, async (req, res) => {
    try {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, "google_maps_api_key"));
      const dbVal = rows[0]?.value?.trim();
      const envVal = process.env.GOOGLE_MAPS_API_KEY?.trim();
      const value = dbVal || envVal || "";
      const source = dbVal ? "database" : envVal ? "environment" : null;
      const maskedKey = value ? `${value.slice(0, 6)}…${value.slice(-4)}` : null;
      res.json({ configured: !!value, source, maskedKey });
    } catch (error) {
      console.error("Error fetching Google Maps config:", error);
      res.status(500).json({ message: "Failed to fetch Google Maps config" });
    }
  });

  app.post("/api/integrations/google-maps/key", isAuthenticatedJWT, async (req, res) => {
    try {
      const { apiKey } = req.body as { apiKey: string };
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
        return res.status(400).json({ message: "Chave inválida" });
      }
      const trimmed = apiKey.trim();
      await db.insert(appSettings)
        .values({ key: "google_maps_api_key", value: trimmed, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: trimmed, updatedAt: new Date() } });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving Google Maps API key:", error);
      res.status(500).json({ message: "Failed to save Google Maps API key" });
    }
  });

  app.delete("/api/integrations/google-maps/key", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(appSettings).where(eq(appSettings.key, "google_maps_api_key"));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing Google Maps API key:", error);
      res.status(500).json({ message: "Failed to remove Google Maps API key" });
    }
  });

  // Autentique integration config
  app.get("/api/integrations/autentique/config", isAuthenticatedJWT, async (req, res) => {
    try {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, "autentique_api_token"));
      const tokenFromEnv = !!process.env.AUTENTIQUE_API_TOKEN;
      const tokenFromDb = !!rows[0]?.value;
      res.json({
        configured: tokenFromDb || tokenFromEnv,
        source: tokenFromDb ? "database" : tokenFromEnv ? "environment" : null,
      });
    } catch (error) {
      console.error("Error fetching Autentique config:", error);
      res.status(500).json({ message: "Failed to fetch Autentique config" });
    }
  });

  app.post("/api/integrations/autentique/token", isAuthenticatedJWT, async (req, res) => {
    try {
      const { token } = req.body as { token: string };
      if (!token || typeof token !== "string" || token.trim().length === 0) {
        return res.status(400).json({ message: "Token inválido" });
      }
      await db.insert(appSettings)
        .values({ key: "autentique_api_token", value: token.trim(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: token.trim(), updatedAt: new Date() } });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving Autentique token:", error);
      res.status(500).json({ message: "Failed to save token" });
    }
  });

  app.delete("/api/integrations/autentique/token", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(appSettings).where(eq(appSettings.key, "autentique_api_token"));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing Autentique token:", error);
      res.status(500).json({ message: "Failed to remove token" });
    }
  });

  // ── Firebase / Push Notifications settings ──────────────────────────────────

  app.get("/api/settings/firebase", isAuthenticatedJWT, async (req, res) => {
    try {
      const rows = await db.select().from(appSettings)
        .where(
          drizzleSql`${appSettings.key} IN ('firebase_vapid_public_key', 'firebase_vapid_private_key', 'firebase_server_key', 'firebase_service_account_json')`
        );
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const saJson = map.firebase_service_account_json;
      let serviceAccountEmail: string | null = null;
      if (saJson) {
        try { serviceAccountEmail = JSON.parse(saJson).client_email ?? null; } catch { /* ignore */ }
      }
      res.json({
        configured: !!saJson || !!map.firebase_server_key || !!(map.firebase_vapid_public_key && map.firebase_vapid_private_key),
        serviceAccountConfigured: !!saJson,
        serviceAccountEmail,
        vapidPublicKey: map.firebase_vapid_public_key ?? null,
        vapidPrivateKey: map.firebase_vapid_private_key ? "***" : null,
        serverKey: map.firebase_server_key ? "***" : null,
        serverKeyConfigured: !!map.firebase_server_key,
      });
    } catch (error) {
      console.error("Error fetching Firebase settings:", error);
      res.status(500).json({ message: "Erro ao buscar configurações do Firebase" });
    }
  });

  app.post("/api/settings/firebase", isAuthenticatedJWT, async (req, res) => {
    try {
      const { vapidPublicKey, vapidPrivateKey, serverKey, serviceAccountJson } = req.body;

      // Validate service account JSON if provided
      if (serviceAccountJson?.trim()) {
        try {
          const parsed = JSON.parse(serviceAccountJson.trim());
          if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
            return res.status(400).json({ message: "Service Account JSON inválido. Certifique-se de usar o arquivo gerado pelo Firebase Console." });
          }
        } catch {
          return res.status(400).json({ message: "Service Account JSON inválido: não é um JSON válido." });
        }
        await db.insert(appSettings)
          .values({ key: "firebase_service_account_json", value: serviceAccountJson.trim(), updatedAt: new Date() })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: serviceAccountJson.trim(), updatedAt: new Date() } });
        // Reset cached Admin app so it re-initializes with the new SA
        _adminSaFingerprint = null;
      }

      if (vapidPublicKey?.trim() && vapidPrivateKey?.trim()) {
        await db.insert(appSettings)
          .values({ key: "firebase_vapid_public_key", value: vapidPublicKey.trim(), updatedAt: new Date() })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: vapidPublicKey.trim(), updatedAt: new Date() } });
        await db.insert(appSettings)
          .values({ key: "firebase_vapid_private_key", value: vapidPrivateKey.trim(), updatedAt: new Date() })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: vapidPrivateKey.trim(), updatedAt: new Date() } });
      }

      if (serverKey?.trim()) {
        await db.insert(appSettings)
          .values({ key: "firebase_server_key", value: serverKey.trim(), updatedAt: new Date() })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: serverKey.trim(), updatedAt: new Date() } });
      }

      if (!serviceAccountJson?.trim() && !serverKey?.trim() && !(vapidPublicKey?.trim() && vapidPrivateKey?.trim())) {
        return res.status(400).json({ message: "Forneça ao menos a Service Account JSON, a FCM Server Key, ou as chaves VAPID." });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving Firebase settings:", error);
      res.status(500).json({ message: "Erro ao salvar configurações do Firebase" });
    }
  });

  app.delete("/api/settings/firebase", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(appSettings).where(
        drizzleSql`${appSettings.key} IN ('firebase_vapid_public_key', 'firebase_vapid_private_key', 'firebase_server_key', 'firebase_service_account_json')`
      );
      _adminSaFingerprint = null;
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing Firebase settings:", error);
      res.status(500).json({ message: "Erro ao remover configurações do Firebase" });
    }
  });

  // ── OpenAI API Key settings ────────────────────────────────────────────────
  app.get("/api/settings/openai-key", isAuthenticatedJWT, async (req, res) => {
    try {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, "openai_api_key"));
      const hasDbKey = !!rows[0]?.value;
      const hasEnvKey = !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
      res.json({
        configured: hasDbKey || hasEnvKey,
        source: hasDbKey ? "database" : hasEnvKey ? "environment" : null,
      });
    } catch (error) {
      console.error("Error fetching OpenAI key settings:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/settings/openai-key", isAuthenticatedJWT, async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
        return res.status(400).json({ message: "apiKey é obrigatório" });
      }
      await db.insert(appSettings)
        .values({ key: "openai_api_key", value: apiKey.trim(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: apiKey.trim(), updatedAt: new Date() } });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving OpenAI key:", error);
      res.status(500).json({ message: "Erro ao salvar chave" });
    }
  });

  app.delete("/api/settings/openai-key", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(appSettings).where(eq(appSettings.key, "openai_api_key"));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing OpenAI key:", error);
      res.status(500).json({ message: "Erro ao remover chave" });
    }
  });

  // POST /api/notifications/push/:driverId — envia push para um motorista
  app.post("/api/notifications/push/:driverId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { title, body, data } = req.body;
      if (!title || !body) {
        return res.status(400).json({ message: "title e body são obrigatórios" });
      }

      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado" });

      // Não envia push para motoristas inaptos ou inativos
      if ((driver as any).isActive !== "true") {
        return res.status(400).json({ message: "Motorista inativo — push não enviado" });
      }
      if ((driver as any).isApto !== "true") {
        return res.status(400).json({ message: "Motorista inapto — push não enviado" });
      }

      const deviceToken = (driver as any).deviceToken as string | null;
      if (!deviceToken) {
        return res.status(400).json({ message: "Motorista não possui token de dispositivo cadastrado" });
      }

      // Fetch Firebase settings
      const rows = await db.select().from(appSettings).where(
        drizzleSql`${appSettings.key} IN ('firebase_service_account_json', 'firebase_server_key')`
      );
      const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const saJson = settingsMap.firebase_service_account_json;
      const serverKey = settingsMap.firebase_server_key;

      if (!saJson && !serverKey) {
        return res.status(503).json({ message: "Firebase não configurado. Adicione a Service Account JSON ou a FCM Server Key em Integrações." });
      }

      const dataStr: Record<string, string> = {};
      if (data && typeof data === "object") {
        for (const [k, v] of Object.entries(data)) dataStr[k] = String(v);
      }

      if (saJson) {
        // Preferred: Firebase Admin SDK
        await sendPushViaAdminSDK(deviceToken, title, body, dataStr, saJson);
      } else {
        // Fallback: FCM Legacy HTTP API
        const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: { "Authorization": `key=${serverKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ to: deviceToken, notification: { title, body }, data: dataStr }),
        });
        const fcmBody = await fcmRes.json() as any;
        if (!fcmRes.ok || fcmBody.failure > 0) {
          const errMsg = fcmBody.results?.[0]?.error ?? `HTTP ${fcmRes.status}`;
          console.error("FCM push error:", errMsg, fcmBody);
          throw new Error(`Falha no envio FCM: ${errMsg}`);
        }
      }
      res.json({ success: true, message: "Push enviado com sucesso" });
    } catch (error: any) {
      console.error("Error sending push notification:", error);
      res.status(500).json({ message: error?.message ?? "Erro ao enviar push notification" });
    }
  });

  // ── Push Message Templates ──────────────────────────────────────────────────

  app.get("/api/settings/push-templates", isAuthenticatedJWT, async (_req, res) => {
    try {
      const rows = await db.select().from(appSettings).where(
        drizzleSql`${appSettings.key} IN ('push_template_nova_proposta_title', 'push_template_nova_proposta_body')`
      );
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      res.json({
        novaPropostaTitle: map.push_template_nova_proposta_title ?? null,
        novaPropostaBody: map.push_template_nova_proposta_body ?? null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings/push-templates", isAuthenticatedJWT, async (req, res) => {
    try {
      const { novaPropostaTitle, novaPropostaBody } = req.body;
      const upsert = async (key: string, value: string) => {
        const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
        if (existing.length > 0) {
          await db.update(appSettings).set({ value }).where(eq(appSettings.key, key));
        } else {
          await db.insert(appSettings).values({ key, value });
        }
      };
      if (novaPropostaTitle !== undefined) await upsert("push_template_nova_proposta_title", novaPropostaTitle);
      if (novaPropostaBody !== undefined) await upsert("push_template_nova_proposta_body", novaPropostaBody);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── PDF password setting ────────────────────────────────────────────────────
  app.get("/api/settings/pdf-password", isAuthenticatedJWT, async (req, res) => {
    try {
      const rows = await db.select().from(appSettings).where(eq(appSettings.key, "pdf_password"));
      res.json({ configured: !!rows[0]?.value, password: rows[0]?.value ?? null });
    } catch (error) {
      console.error("Error fetching PDF password:", error);
      res.status(500).json({ message: "Erro ao buscar senha do PDF" });
    }
  });

  app.post("/api/settings/pdf-password", isAuthenticatedJWT, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password?.trim()) return res.status(400).json({ message: "Senha inválida" });
      await db.insert(appSettings)
        .values({ key: "pdf_password", value: password.trim(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: password.trim(), updatedAt: new Date() } });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving PDF password:", error);
      res.status(500).json({ message: "Erro ao salvar senha do PDF" });
    }
  });

  app.delete("/api/settings/pdf-password", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(appSettings).where(eq(appSettings.key, "pdf_password"));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing PDF password:", error);
      res.status(500).json({ message: "Erro ao remover senha do PDF" });
    }
  });

  // Public route for Google Maps API key (needed by AddressAutocomplete component)
  app.get("/api/integrations/google-maps/api-key", isAuthenticatedJWTOrClient, async (req: any, res) => {
    try {
      const key = await getGoogleMapsApiKey();
      if (!key) {
        return res.json({ configured: false, apiKey: null });
      }
      res.json({ configured: true, apiKey: key });
    } catch (error) {
      console.error("Error fetching Google Maps API key:", error);
      res.status(500).json({ message: "Failed to fetch API key" });
    }
  });

  // Global place search endpoint using new Places API (v1) - supports Mercosul countries
  app.get("/api/integrations/google-maps/places/search", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { query } = req.query;
      console.log("[places/search] Received query:", query);
      
      if (!query || typeof query !== "string" || query.length < 3) {
        return res.json({ predictions: [] });
      }

      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        console.error("[places/search] No API key configured");
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Using the new Places API (v1) with POST request - no IP biasing
      const url = `https://places.googleapis.com/v1/places:autocomplete`;
      
      console.log("[places/search] Calling Google Places API for:", query);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: query,
          includedRegionCodes: ['BR', 'AR', 'PE', 'BO', 'PY', 'CL', 'UY', 'VE', 'CO', 'EC'],
        }),
      });
      
      const data = await response.json();
      console.log("[places/search] Google API response status:", response.status, "suggestions count:", data.suggestions?.length || 0);

      if (data.suggestions && data.suggestions.length > 0) {
        const predictions = data.suggestions
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            placeId: s.placePrediction.placeId,
            description: s.placePrediction.text?.text || s.placePrediction.structuredFormat?.mainText?.text || '',
          }));
        console.log("[places/search] Returning", predictions.length, "predictions");
        return res.json({ predictions });
      }

      console.log("[places/search] No suggestions found");
      res.json({ predictions: [] });
    } catch (error) {
      console.error("[places/search] Error:", error);
      res.status(500).json({ message: "Failed to search places" });
    }
  });

  // Get place details by place ID using new Places API (v1)
  app.get("/api/integrations/google-maps/places/:placeId", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { placeId } = req.params;
      if (!placeId) {
        return res.status(400).json({ message: "Place ID required" });
      }

      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Using new Places API (v1)
      const url = `https://places.googleapis.com/v1/places/${placeId}?fields=formattedAddress,location&key=${apiKey}`;
      
      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': apiKey,
        },
      });
      const data = await response.json();

      if (data.location) {
        return res.json({
          address: data.formattedAddress || '',
          lat: data.location.latitude,
          lng: data.location.longitude,
        });
      }

      res.status(404).json({ message: "Place not found" });
    } catch (error) {
      console.error("Error getting place details:", error);
      res.status(500).json({ message: "Failed to get place details" });
    }
  });

  app.get("/api/integrations/google-maps/key", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await db.select().from(users).where(eq(users.id, userId));
      if (!user[0] || user[0].role !== "admin") {
        return res.status(403).json({ message: "Apenas administradores podem acessar" });
      }

      const key = await getGoogleMapsApiKey();
      if (!key) {
        return res.json({ configured: false, maskedKey: null });
      }
      
      const maskedKey = key.slice(0, 8) + "..." + key.slice(-4);
      res.json({ configured: true, maskedKey });
    } catch (error) {
      console.error("Error fetching Google Maps API key:", error);
      res.status(500).json({ message: "Failed to fetch API key status" });
    }
  });

  // Google Maps Static Image Proxy (to avoid exposing API key in frontend)
  app.get("/api/integrations/google-maps/static-image", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { lat, lng, zoom = "15", size = "400x300" } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
      
      const response = await fetch(mapUrl);
      if (!response.ok) {
        console.error("Google Maps API error:", response.status, await response.text());
        return res.status(500).json({ message: "Failed to fetch map image" });
      }

      const buffer = await response.arrayBuffer();
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Error fetching static map:", error);
      res.status(500).json({ message: "Failed to fetch map image" });
    }
  });

  // Routing calculation endpoint
  app.post("/api/routing/calculate", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { origin, destination, waypoints = [], avoidTolls = false, avoidHighways = false } = req.body;
      
      if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
        return res.status(400).json({ message: "Origin and destination coordinates are required" });
      }

      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      // Build waypoints string for Distance Matrix API
      let waypointsStr = "";
      if (waypoints.length > 0) {
        waypointsStr = "&waypoints=" + waypoints.map((wp: any) => `${wp.lat},${wp.lng}`).join("|");
      }

      // Build avoid string
      let avoidStr = "";
      const avoidList = [];
      if (avoidTolls) avoidList.push("tolls");
      if (avoidHighways) avoidList.push("highways");
      if (avoidList.length > 0) {
        avoidStr = "&avoid=" + avoidList.join("|");
      }

      // Use Directions API for routes with waypoints
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointsStr}${avoidStr}&departure_time=now&traffic_model=best_guess&key=${apiKey}`;
      
      const directionsResponse = await fetch(directionsUrl);
      const directionsData = await directionsResponse.json();

      if (directionsData.status !== "OK" || !directionsData.routes?.[0]) {
        return res.status(400).json({ message: "Could not calculate route" });
      }

      const route = directionsData.routes[0];
      const legs = route.legs;

      // Calculate total distance and duration
      let totalDistance = 0;
      let totalDuration = 0;
      let totalDurationInTraffic = 0;
      let hasTrafficData = false;

      for (const leg of legs) {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
        if (leg.duration_in_traffic) {
          totalDurationInTraffic += leg.duration_in_traffic.value;
          hasTrafficData = true;
        } else {
          totalDurationInTraffic += leg.duration.value;
        }
      }

      // Get toll information using Routes API
      let tollCost = null;
      if (!avoidTolls) {
        try {
          const intermediates = waypoints.map((wp: any) => ({
            location: { latLng: { latitude: wp.lat, longitude: wp.lng } }
          }));

          const routesBody: any = {
            origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
            destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
            travelMode: "DRIVE",
            extraComputations: ["TOLLS"],
            routeModifiers: {
              vehicleInfo: {
                emissionType: "DIESEL"
              }
            }
          };

          if (intermediates.length > 0) {
            routesBody.intermediates = intermediates;
          }

          const routesResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo,routes.legs.travelAdvisory.tollInfo",
            },
            body: JSON.stringify(routesBody),
          });

          const routesData = await routesResponse.json();
          console.log("Routes API toll response:", JSON.stringify(routesData, null, 2));
          
          // Check for toll info at route level
          if (routesData.routes?.[0]?.travelAdvisory?.tollInfo?.estimatedPrice?.[0]) {
            const toll = routesData.routes[0].travelAdvisory.tollInfo.estimatedPrice[0];
            const amount = parseFloat(toll.units || "0") + (parseFloat(toll.nanos || "0") / 1000000000);
            tollCost = {
              amount: amount.toFixed(2),
              currency: toll.currencyCode || "BRL",
            };
          } 
          // Check for toll info at legs level (sum all legs)
          else if (routesData.routes?.[0]?.legs) {
            let totalToll = 0;
            let currency = "BRL";
            for (const leg of routesData.routes[0].legs) {
              if (leg.travelAdvisory?.tollInfo?.estimatedPrice?.[0]) {
                const toll = leg.travelAdvisory.tollInfo.estimatedPrice[0];
                totalToll += parseFloat(toll.units || "0") + (parseFloat(toll.nanos || "0") / 1000000000);
                currency = toll.currencyCode || "BRL";
              }
            }
            if (totalToll > 0) {
              tollCost = {
                amount: totalToll.toFixed(2),
                currency,
              };
            }
          }
          
          if (routesData.error) {
            console.log("Routes API error:", routesData.error);
          }
          
          // If no toll data from API, estimate based on distance
          // Average toll cost in Brazil: ~R$ 0.15 per km for commercial vehicles
          if (!tollCost && totalDistance > 100000) { // Only estimate for distances > 100km
            const distanceKm = totalDistance / 1000;
            const estimatedToll = distanceKm * 0.12; // R$ 0.12 per km average estimate
            tollCost = {
              amount: estimatedToll.toFixed(2),
              currency: "BRL",
              isEstimate: true,
            };
            console.log(`Toll estimated based on distance: R$ ${estimatedToll.toFixed(2)} for ${distanceKm.toFixed(0)} km`);
          }
        } catch (tollError) {
          console.log("Could not fetch toll information:", tollError);
          // Fallback estimation on error
          if (totalDistance > 100000) {
            const distanceKm = totalDistance / 1000;
            const estimatedToll = distanceKm * 0.12;
            tollCost = {
              amount: estimatedToll.toFixed(2),
              currency: "BRL",
              isEstimate: true,
            };
          }
        }
      }

      // Format distance and duration
      const formatDistance = (meters: number) => {
        if (meters >= 1000) {
          return `${(meters / 1000).toFixed(1)} km`;
        }
        return `${meters} m`;
      };

      const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return `${hours} h ${minutes} min`;
        }
        return `${minutes} mins`;
      };

      // Extract waypoint addresses
      const waypointAddresses = waypoints.map((wp: any) => wp.address);

      const result = {
        distance: { text: formatDistance(totalDistance), value: totalDistance },
        duration: { text: formatDuration(totalDuration), value: totalDuration },
        durationInTraffic: hasTrafficData 
          ? { text: formatDuration(totalDurationInTraffic), value: totalDurationInTraffic }
          : null,
        tollCost,
        originAddress: legs[0].start_address,
        destinationAddress: legs[legs.length - 1].end_address,
        waypointAddresses: waypointAddresses.length > 0 ? waypointAddresses : undefined,
      };

      res.json(result);
    } catch (error) {
      console.error("Error calculating route:", error);
      res.status(500).json({ message: "Failed to calculate route" });
    }
  });

  // Route distance by address string — public, no auth required (only calls Google Maps)
  app.post("/api/routing/distance-by-address", async (req: any, res) => {
    try {
      const { originAddress, destinationAddress } = req.body;

      if (!originAddress || !destinationAddress) {
        return res.status(400).json({ message: "Informe a cidade de origem e destino" });
      }

      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        return res.status(500).json({ message: "Chave do Google Maps não configurada" });
      }

      // Step 1: Directions API to get distance, duration and confirmed addresses
      const encodedOrigin = encodeURIComponent(originAddress);
      const encodedDest = encodeURIComponent(destinationAddress);
      const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodedOrigin}&destination=${encodedDest}&language=pt-BR&region=br&key=${apiKey}`;

      const directionsResponse = await fetch(directionsUrl);
      const directionsData = await directionsResponse.json();

      if (directionsData.status !== "OK" || !directionsData.routes?.[0]) {
        if (directionsData.status === "NOT_FOUND" || directionsData.status === "ZERO_RESULTS") {
          return res.status(400).json({ message: "Cidade de origem ou destino não encontrada. Tente incluir o estado (ex: São Paulo, SP)" });
        }
        console.error("Directions API error:", directionsData.status, directionsData.error_message);
        return res.status(400).json({ message: directionsData.error_message || "Não foi possível calcular a rota para os endereços informados" });
      }

      const leg = directionsData.routes[0].legs[0];
      const totalDistance = leg.distance.value;   // metres
      const totalDuration = leg.duration.value;   // seconds
      const confirmedOrigin = leg.start_address;
      const confirmedDest = leg.end_address;

      // Helper: get lat/lng from the geocoded leg endpoints (returned by Directions API)
      const originLatLng = leg.start_location;   // { lat, lng }
      const destLatLng   = leg.end_location;     // { lat, lng }

      // Step 2: Routes API to get toll cost (uses lat/lng from step 1)
      let tollCost: { amount: string; currency: string; isEstimate?: boolean } | null = null;
      try {
        const routesBody = {
          origin:      { location: { latLng: { latitude: originLatLng.lat, longitude: originLatLng.lng } } },
          destination: { location: { latLng: { latitude: destLatLng.lat,   longitude: destLatLng.lng   } } },
          travelMode: "DRIVE",
          extraComputations: ["TOLLS"],
          routeModifiers: { vehicleInfo: { emissionType: "DIESEL" } },
        };

        const routesResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.travelAdvisory.tollInfo,routes.legs.travelAdvisory.tollInfo",
          },
          body: JSON.stringify(routesBody),
        });

        const routesData = await routesResponse.json();

        // Extract toll from route level
        const routeToll = routesData.routes?.[0]?.travelAdvisory?.tollInfo?.estimatedPrice?.[0];
        if (routeToll) {
          const amount = parseFloat(routeToll.units || "0") + (parseFloat(routeToll.nanos || "0") / 1_000_000_000);
          if (amount > 0) tollCost = { amount: amount.toFixed(2), currency: routeToll.currencyCode || "BRL" };
        }

        // Fallback: sum legs
        if (!tollCost && routesData.routes?.[0]?.legs) {
          let total = 0;
          let currency = "BRL";
          for (const routeLeg of routesData.routes[0].legs) {
            const legToll = routeLeg.travelAdvisory?.tollInfo?.estimatedPrice?.[0];
            if (legToll) {
              total += parseFloat(legToll.units || "0") + (parseFloat(legToll.nanos || "0") / 1_000_000_000);
              currency = legToll.currencyCode || "BRL";
            }
          }
          if (total > 0) tollCost = { amount: total.toFixed(2), currency };
        }
      } catch (tollErr) {
        console.log("Routes API toll lookup failed:", tollErr);
      }

      // Step 3: Estimate toll if Routes API returned nothing (R$ 0.12/km for distances > 100 km)
      if (!tollCost && totalDistance > 100_000) {
        const distanceKm = totalDistance / 1000;
        tollCost = {
          amount: (distanceKm * 0.12).toFixed(2),
          currency: "BRL",
          isEstimate: true,
        };
      }

      const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(0)} km` : `${m} m`;
      const formatDuration = (s: number) => {
        const h = Math.floor(s / 3600);
        const min = Math.floor((s % 3600) / 60);
        if (h > 0 && min > 0) return `${h} h ${min} min`;
        if (h > 0) return `${h} h`;
        return `${min} min`;
      };

      res.json({
        distance: { text: formatDistance(totalDistance), value: totalDistance },
        duration: { text: formatDuration(totalDuration), value: totalDuration },
        tollCost,
        originAddress: confirmedOrigin,
        destinationAddress: confirmedDest,
      });
    } catch (error) {
      console.error("Error calculating distance by address:", error);
      res.status(500).json({ message: "Erro interno ao calcular distância" });
    }
  });

  // ============== PRESTAÇÃO DE CONTAS (Expense Settlements) ==============
  // Helper to find the route associated with a transport (by originYardId + deliveryLocationId)
  async function findRouteForTransport(transport: { originYardId?: string | null; deliveryLocationId?: string | null }) {
    if (!transport.originYardId || !transport.deliveryLocationId) return null;
    const [route] = await db.select().from(routes)
      .where(and(
        eq(routes.originYardId, transport.originYardId),
        eq(routes.destinationLocationId, transport.deliveryLocationId)
      )).limit(1);
    return route ?? null;
  }

  app.get("/api/expense-settlements", isAuthenticatedJWT, async (req, res) => {
    try {
      const settlements = await storage.getExpenseSettlements();
      
      // Enrich with related data
      const enrichedSettlements = await Promise.all(
        settlements.map(async (settlement) => {
          const [transport, driver, items] = await Promise.all([
            storage.getTransport(settlement.transportId),
            storage.getDriver(settlement.driverId),
            storage.getExpenseSettlementItems(settlement.id),
          ]);
          
          // Get transport related data
          let client = null;
          let deliveryLocation = null;
          let originYard = null;
          
          if (transport) {
            [client, deliveryLocation, originYard] = await Promise.all([
              transport.clientId ? storage.getClient(transport.clientId) : null,
              transport.deliveryLocationId ? storage.getDeliveryLocation(transport.deliveryLocationId) : null,
              transport.originYardId ? storage.getYard(transport.originYardId) : null,
            ]);
          }

          // Get advance amount from linked transport proposal
          let proposalAdvanceAmount: string | null = null;
          let proposalAdvanceMethod: string | null = null;
          const [proposalItem] = await db.select().from(transportProposalItems).where(eq(transportProposalItems.transportId, settlement.transportId));
          if (proposalItem) {
            const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, proposalItem.proposalId));
            if (proposal?.advanceAmount) proposalAdvanceAmount = String(proposal.advanceAmount);
            if (proposal?.advanceMethod) proposalAdvanceMethod = proposal.advanceMethod;
          }

          // Get reviewer name
          let reviewedByUserName: string | null = null;
          if (settlement.reviewedByUserId) {
            const [reviewer] = await db.select({
              firstName: users.firstName,
              lastName: users.lastName,
              username: users.username,
              email: users.email,
            }).from(users).where(eq(users.id, settlement.reviewedByUserId));
            if (reviewer) {
              const fullName = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(" ").trim();
              reviewedByUserName = fullName || reviewer.username || reviewer.email || null;
            }
          }

          // Find associated route for planned costs
          const associatedRoute = transport ? await findRouteForTransport(transport) : null;

          // Compute driver cost from travel rate
          let driverCost: string | null = null;
          let travelRateInfo: { name: string; rateType: string; rateValue: string } | null = null;
          if (transport?.travelRateId) {
            const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, transport.travelRateId));
            if (rate) {
              travelRateInfo = { name: rate.name, rateType: rate.rateType, rateValue: String(rate.rateValue) };
              const distKm = parseFloat(String(transport.routeDistanceKm || "0"));
              const rateVal = parseFloat(String(rate.rateValue || "0"));
              driverCost = rate.rateType === "por_km"
                ? (distKm * rateVal).toFixed(2)
                : rateVal.toFixed(2);
            }
          }
          
          return {
            ...settlement,
            transport: transport ? { ...transport, client, deliveryLocation, originYard } : null,
            driver,
            items,
            proposalAdvanceAmount,
            proposalAdvanceMethod,
            reviewedByUserName,
            driverCost,
            travelRateInfo,
            associatedRoute: associatedRoute ? {
              id: associatedRoute.id,
              name: associatedRoute.name,
              fuelCost: associatedRoute.fuelCost,
              tollCost: associatedRoute.tollCost,
              driverDailyCost: associatedRoute.driverDailyCost,
              foodCost: (associatedRoute as any).foodCost ?? null,
              othersCost: (associatedRoute as any).othersCost ?? null,
              totalCost: associatedRoute.totalCost,
            } : null,
          };
        })
      );
      
      res.json(enrichedSettlements);
    } catch (error) {
      console.error("Error fetching expense settlements:", error);
      res.status(500).json({ message: "Failed to fetch expense settlements" });
    }
  });

  app.get("/api/expense-settlements/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const settlement = await storage.getExpenseSettlement(req.params.id);
      if (!settlement) {
        return res.status(404).json({ message: "Expense settlement not found" });
      }
      
      const [transport, driver, items] = await Promise.all([
        storage.getTransport(settlement.transportId),
        storage.getDriver(settlement.driverId),
        storage.getExpenseSettlementItems(settlement.id),
      ]);
      
      let client = null;
      let deliveryLocation = null;
      let originYard = null;
      
      if (transport) {
        [client, deliveryLocation, originYard] = await Promise.all([
          transport.clientId ? storage.getClient(transport.clientId) : null,
          transport.deliveryLocationId ? storage.getDeliveryLocation(transport.deliveryLocationId) : null,
          transport.originYardId ? storage.getYard(transport.originYardId) : null,
        ]);
      }

      // Get advance amount from linked transport proposal
      let proposalAdvanceAmount: string | null = null;
      let proposalAdvanceMethod: string | null = null;
      const [proposalItem] = await db.select().from(transportProposalItems).where(eq(transportProposalItems.transportId, settlement.transportId));
      if (proposalItem) {
        const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, proposalItem.proposalId));
        if (proposal?.advanceAmount) proposalAdvanceAmount = String(proposal.advanceAmount);
        if (proposal?.advanceMethod) proposalAdvanceMethod = proposal.advanceMethod;
      }

      // Get reviewer name
      let reviewedByUserName: string | null = null;
      if (settlement.reviewedByUserId) {
        const [reviewer] = await db.select({
          firstName: users.firstName,
          lastName: users.lastName,
          username: users.username,
          email: users.email,
        }).from(users).where(eq(users.id, settlement.reviewedByUserId));
        if (reviewer) {
          const fullName = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(" ").trim();
          reviewedByUserName = fullName || reviewer.username || reviewer.email || null;
        }
      }

      // Find associated route for planned costs
      const associatedRoute = transport ? await findRouteForTransport(transport) : null;

      // Compute driver cost from travel rate
      let driverCost: string | null = null;
      let travelRateInfo: { name: string; rateType: string; rateValue: string } | null = null;
      if (transport?.travelRateId) {
        const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, transport.travelRateId));
        if (rate) {
          travelRateInfo = { name: rate.name, rateType: rate.rateType, rateValue: String(rate.rateValue) };
          const distKm = parseFloat(String(transport.routeDistanceKm || "0"));
          const rateVal = parseFloat(String(rate.rateValue || "0"));
          driverCost = rate.rateType === "por_km"
            ? (distKm * rateVal).toFixed(2)
            : rateVal.toFixed(2);
        }
      }
      
      res.json({
        ...settlement,
        transport: transport ? { ...transport, client, deliveryLocation, originYard } : null,
        driver,
        items,
        proposalAdvanceAmount,
        proposalAdvanceMethod,
        reviewedByUserName,
        driverCost,
        travelRateInfo,
        associatedRoute: associatedRoute ? {
          id: associatedRoute.id,
          name: associatedRoute.name,
          fuelCost: associatedRoute.fuelCost,
          tollCost: associatedRoute.tollCost,
          driverDailyCost: associatedRoute.driverDailyCost,
          foodCost: (associatedRoute as any).foodCost ?? null,
          othersCost: (associatedRoute as any).othersCost ?? null,
          totalCost: associatedRoute.totalCost,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching expense settlement:", error);
      res.status(500).json({ message: "Failed to fetch expense settlement" });
    }
  });

  app.post("/api/expense-settlements", isAuthenticatedJWT, async (req, res) => {
    try {
      // Check if there's already a settlement for this transport
      const existingSettlements = await storage.getExpenseSettlements();
      const existingForTransport = existingSettlements.find(s => s.transportId === req.body.transportId);
      if (existingForTransport) {
        return res.status(400).json({ message: "Já existe uma prestação de contas para este transporte" });
      }
      
      // Get transport to copy route information
      const transport = await storage.getTransport(req.body.transportId);

      // Auto-fill advanceAmount from linked transport proposal if not provided
      let proposalAdvanceAmount: string | null = null;
      if (req.body.transportId) {
        const [proposalItem] = await db.select().from(transportProposalItems).where(eq(transportProposalItems.transportId, req.body.transportId));
        if (proposalItem) {
          const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, proposalItem.proposalId));
          if (proposal?.advanceAmount) proposalAdvanceAmount = String(proposal.advanceAmount);
        }
      }
      
      const settlementData = {
        ...req.body,
        advanceAmount: req.body.advanceAmount || proposalAdvanceAmount || null,
        submittedAt: req.body.status === "enviado" ? new Date() : undefined,
        routeDistance: transport?.routeDistanceKm ? `${transport.routeDistanceKm} km` : null,
        estimatedTolls: transport?.estimatedTolls || null,
        estimatedFuel: transport?.estimatedFuel || null,
      };
      
      const settlement = await storage.createExpenseSettlement(settlementData);
      res.status(201).json(settlement);
    } catch (error) {
      console.error("Error creating expense settlement:", error);
      res.status(500).json({ message: "Failed to create expense settlement" });
    }
  });

  app.patch("/api/expense-settlements/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const settlement = await storage.updateExpenseSettlement(req.params.id, req.body);
      if (!settlement) {
        return res.status(404).json({ message: "Expense settlement not found" });
      }
      res.json(settlement);
    } catch (error) {
      console.error("Error updating expense settlement:", error);
      res.status(500).json({ message: "Failed to update expense settlement" });
    }
  });

  // Devolver prestação para motorista
  app.post("/api/expense-settlements/:id/return", isAuthenticatedJWT, async (req, res) => {
    try {
      const { returnReason } = req.body;
      const settlement = await storage.updateExpenseSettlement(req.params.id, {
        status: "devolvido",
        returnReason,
        reviewedAt: new Date(),
      });
      if (!settlement) {
        return res.status(404).json({ message: "Expense settlement not found" });
      }
      res.json(settlement);
    } catch (error) {
      console.error("Error returning expense settlement:", error);
      res.status(500).json({ message: "Failed to return expense settlement" });
    }
  });

  // Aprovar prestação de contas
  app.post("/api/expense-settlements/:id/approve", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const settlement = await storage.updateExpenseSettlement(req.params.id, {
        status: "aprovado",
        approvedAt: new Date(),
        reviewedAt: new Date(),
        reviewedByUserId: req.user?.id || null,
      });
      if (!settlement) {
        return res.status(404).json({ message: "Expense settlement not found" });
      }
      res.json(settlement);
    } catch (error) {
      console.error("Error approving expense settlement:", error);
      res.status(500).json({ message: "Failed to approve expense settlement" });
    }
  });

  // Gerar PDF da prestação de contas
  app.get("/api/expense-settlements/:id/pdf", isAuthenticatedJWT, async (req, res) => {
    try {
      const settlement = await storage.getExpenseSettlement(req.params.id);
      if (!settlement) {
        return res.status(404).json({ message: "Prestação de contas não encontrada" });
      }

      // Buscar relações
      const driver = await storage.getDriver(settlement.driverId);
      const transport = await storage.getTransport(settlement.transportId);
      let originYard = null;
      let deliveryLocation = null;
      let client = null;
      
      if (transport) {
        if (transport.originYardId) {
          originYard = await storage.getYard(transport.originYardId);
        }
        if (transport.deliveryLocationId) {
          deliveryLocation = await storage.getDeliveryLocation(transport.deliveryLocationId);
        }
        if (transport.clientId) {
          client = await storage.getClient(transport.clientId);
        }
      }

      const items = await storage.getExpenseSettlementItems(req.params.id);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=prestacao-${settlement.id.substring(0, 8)}.pdf`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").text("PRESTAÇÃO DE CONTAS", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica").text("OTD Entregas - Sistema de Gestão de Entregas de Veículos", { align: "center" });
      doc.moveDown(1);

      // Linha separadora
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Informações do Motorista
      doc.fontSize(14).font("Helvetica-Bold").text("DADOS DO MOTORISTA");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Nome: ${driver?.name || "N/A"}`);
      doc.text(`CPF: ${driver?.cpf || "N/A"}`);
      doc.text(`Telefone: ${driver?.phone || "N/A"}`);
      doc.moveDown(1);

      // Informações do Transporte
      doc.fontSize(14).font("Helvetica-Bold").text("DADOS DO TRANSPORTE");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Número da Solicitação: ${transport?.requestNumber || "N/A"}`);
      doc.text(`Veículo (Chassi): ${transport?.vehicleChassi || "N/A"}`);
      doc.text(`Origem: ${originYard?.name || "N/A"}`);
      doc.text(`Destino: ${deliveryLocation?.name || "N/A"}`);
      doc.text(`Cliente: ${client?.name || "N/A"}`);
      if (transport?.checkinDateTime) {
        doc.text(`Data de Saída: ${new Date(transport.checkinDateTime).toLocaleDateString("pt-BR")}`);
      }
      if (transport?.checkoutDateTime) {
        doc.text(`Data de Entrega: ${new Date(transport.checkoutDateTime).toLocaleDateString("pt-BR")}`);
      }
      doc.moveDown(1);

      // Valores Estimados
      doc.fontSize(14).font("Helvetica-Bold").text("VALORES ESTIMADOS");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Distância: ${settlement.routeDistance || transport?.routeDistanceKm || "N/A"} km`);
      doc.text(`Pedágios Estimados: R$ ${settlement.estimatedTolls || transport?.estimatedTolls || "0,00"}`);
      doc.text(`Combustível Estimado: R$ ${settlement.estimatedFuel || transport?.estimatedFuel || "0,00"}`);
      doc.moveDown(1);

      // Despesas Realizadas
      doc.fontSize(14).font("Helvetica-Bold").text("DESPESAS REALIZADAS");
      doc.moveDown(0.5);

      const expenseTypeLabels: Record<string, string> = {
        combustivel: "Combustível",
        pedagio: "Pedágio",
        hospedagem: "Hotel",
        alimentacao: "Alimentação",
        outros: "Outros",
      };

      if (items && items.length > 0) {
        // Cabeçalho da tabela
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 200;
        const col3 = 400;

        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Tipo", col1, tableTop);
        doc.text("Descrição", col2, tableTop);
        doc.text("Valor", col3, tableTop);
        
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
        
        let yPos = tableTop + 25;
        doc.font("Helvetica");
        
        let totalDespesas = 0;
        
        for (const item of items) {
          const valor = parseFloat(item.amount || "0");
          totalDespesas += valor;
          
          doc.text(expenseTypeLabels[item.type] || item.type, col1, yPos);
          doc.text(item.description || "-", col2, yPos, { width: 180 });
          doc.text(`R$ ${valor.toFixed(2).replace(".", ",")}`, col3, yPos);
          
          yPos += 20;
        }
        
        doc.moveTo(50, yPos).lineTo(545, yPos).stroke();
        yPos += 10;
        
        doc.font("Helvetica-Bold");
        doc.text("TOTAL DAS DESPESAS:", col1, yPos);
        doc.text(`R$ ${totalDespesas.toFixed(2).replace(".", ",")}`, col3, yPos);
        
        doc.y = yPos + 30;
      } else {
        doc.fontSize(11).font("Helvetica").text("Nenhuma despesa registrada.");
        doc.moveDown(1);
      }

      // Observações
      if (settlement.driverNotes) {
        doc.fontSize(14).font("Helvetica-Bold").text("OBSERVAÇÕES DO MOTORISTA");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").text(settlement.driverNotes);
        doc.moveDown(1);
      }

      // Adiantamento e Saldo
      const totalDespesasCalc = items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
      const advanceAmount = parseFloat(settlement.advanceAmount || "0");
      const balance = totalDespesasCalc - advanceAmount;
      
      doc.fontSize(14).font("Helvetica-Bold").text("ADIANTAMENTO E SALDO");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Valor Adiantado: R$ ${advanceAmount.toFixed(2).replace(".", ",")}`);
      doc.text(`Total das Despesas: R$ ${totalDespesasCalc.toFixed(2).replace(".", ",")}`);
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica-Bold");
      if (balance > 0) {
        doc.text(`MOTORISTA DEVE RECEBER: R$ ${balance.toFixed(2).replace(".", ",")}`);
      } else if (balance < 0) {
        doc.text(`MOTORISTA DEVE DEVOLVER: R$ ${Math.abs(balance).toFixed(2).replace(".", ",")}`);
      } else {
        doc.text(`SALDO ZERADO`);
      }
      doc.moveDown(1);

      // Status e Data de Aprovação
      doc.moveDown(1);
      doc.fontSize(12).font("Helvetica-Bold").text("STATUS: APROVADO", { align: "center" });
      if (settlement.approvedAt) {
        doc.fontSize(10).font("Helvetica").text(`Data de Aprovação: ${new Date(settlement.approvedAt).toLocaleDateString("pt-BR")}`, { align: "center" });
      }
      doc.moveDown(3);

      // Assinatura do Motorista
      doc.fontSize(12).font("Helvetica-Bold").text("ASSINATURA DO MOTORISTA", { align: "center" });
      doc.moveDown(3);
      
      // Linha para assinatura
      const signatureLineY = doc.y;
      doc.moveTo(150, signatureLineY).lineTo(450, signatureLineY).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text(`${driver?.name || "Motorista"}`, { align: "center" });
      doc.fontSize(9).text(`CPF: ${driver?.cpf || ""}`, { align: "center" });
      
      doc.moveDown(2);
      doc.fontSize(8).fillColor("gray").text(`Documento gerado em: ${new Date().toLocaleString("pt-BR")}`, { align: "center" });
      doc.text("OTD Entregas - Sistema de Gestão de Entregas de Veículos", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating expense settlement PDF:", error);
      res.status(500).json({ message: "Falha ao gerar PDF da prestação de contas" });
    }
  });

  app.delete("/api/expense-settlements/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteExpenseSettlement(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense settlement:", error);
      res.status(500).json({ message: "Failed to delete expense settlement" });
    }
  });

  // Settlement Items
  app.get("/api/expense-settlements/:settlementId/items", isAuthenticatedJWT, async (req, res) => {
    try {
      const items = await storage.getExpenseSettlementItems(req.params.settlementId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching expense settlement items:", error);
      res.status(500).json({ message: "Failed to fetch expense settlement items" });
    }
  });

  app.post("/api/expense-settlements/:settlementId/items", isAuthenticatedJWT, async (req, res) => {
    try {
      const item = await storage.createExpenseSettlementItem({
        ...req.body,
        settlementId: req.params.settlementId,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating expense settlement item:", error);
      res.status(500).json({ message: "Failed to create expense settlement item" });
    }
  });

  app.patch("/api/expense-settlement-items/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const item = await storage.updateExpenseSettlementItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Expense settlement item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating expense settlement item:", error);
      res.status(500).json({ message: "Failed to update expense settlement item" });
    }
  });

  app.delete("/api/expense-settlement-items/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteExpenseSettlementItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense settlement item:", error);
      res.status(500).json({ message: "Failed to delete expense settlement item" });
    }
  });

  // Checkpoints
  app.get("/api/checkpoints", isAuthenticatedJWT, async (req, res) => {
    try {
      const checkpoints = await storage.getCheckpoints();
      res.json(checkpoints);
    } catch (error) {
      console.error("Error fetching checkpoints:", error);
      res.status(500).json({ message: "Failed to fetch checkpoints" });
    }
  });

  app.get("/api/checkpoints/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const checkpoint = await storage.getCheckpoint(req.params.id);
      if (!checkpoint) {
        return res.status(404).json({ message: "Checkpoint not found" });
      }
      res.json(checkpoint);
    } catch (error) {
      console.error("Error fetching checkpoint:", error);
      res.status(500).json({ message: "Failed to fetch checkpoint" });
    }
  });

  app.post("/api/checkpoints", isAuthenticatedJWT, async (req, res) => {
    try {
      const parsed = insertCheckpointSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid checkpoint data", errors: parsed.error.errors });
      }
      const checkpoint = await storage.createCheckpoint(parsed.data);
      res.status(201).json(checkpoint);
    } catch (error) {
      console.error("Error creating checkpoint:", error);
      res.status(500).json({ message: "Failed to create checkpoint" });
    }
  });

  app.patch("/api/checkpoints/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const checkpoint = await storage.updateCheckpoint(req.params.id, req.body);
      if (!checkpoint) {
        return res.status(404).json({ message: "Checkpoint not found" });
      }
      res.json(checkpoint);
    } catch (error) {
      console.error("Error updating checkpoint:", error);
      res.status(500).json({ message: "Failed to update checkpoint" });
    }
  });

  app.delete("/api/checkpoints/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteCheckpoint(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting checkpoint:", error);
      res.status(500).json({ message: "Failed to delete checkpoint" });
    }
  });

  // Transport Checkpoints - Timeline
  app.post("/api/transports/:id/checkpoints", isAuthenticatedJWT, async (req, res) => {
    try {
      const transportId = req.params.id;
      const { checkpointIds } = req.body as { checkpointIds: string[] };

      await db.delete(transportCheckpoints).where(eq(transportCheckpoints.transportId, transportId));

      if (checkpointIds && checkpointIds.length > 0) {
        const newCheckpoints = checkpointIds.map((checkpointId, index) => ({
          transportId,
          checkpointId,
          orderIndex: index + 1,
          status: "pendente",
        }));
        await db.insert(transportCheckpoints).values(newCheckpoints);
      }

      res.json({ message: "Checkpoints assigned successfully" });
    } catch (error) {
      console.error("Error assigning checkpoints:", error);
      res.status(500).json({ message: "Failed to assign checkpoints" });
    }
  });

  app.patch("/api/transport-checkpoints/:id/status", isAuthenticatedJWT, async (req, res) => {
    try {
      const { status, latitude, longitude } = req.body;
      const updated = await db.update(transportCheckpoints)
        .set({
          status,
          latitude,
          longitude,
          reachedAt: status === "alcancado" || status === "concluido" ? new Date() : null,
        })
        .where(eq(transportCheckpoints.id, req.params.id))
        .returning();
      
      if (updated.length === 0) {
        return res.status(404).json({ message: "Transport checkpoint not found" });
      }
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating transport checkpoint:", error);
      res.status(500).json({ message: "Failed to update transport checkpoint" });
    }
  });

  // ============== EVALUATION CRITERIA ==============

  app.get("/api/evaluation-criteria", isAuthenticatedJWT, async (req, res) => {
    try {
      const criteria = await db.select().from(evaluationCriteria).orderBy(evaluationCriteria.order);
      res.json(criteria);
    } catch (error) {
      console.error("Error fetching evaluation criteria:", error);
      res.status(500).json({ message: "Failed to fetch evaluation criteria" });
    }
  });

  app.post("/api/evaluation-criteria", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertEvaluationCriteriaSchema.parse(req.body);
      const [criteria] = await db.insert(evaluationCriteria).values(data).returning();
      res.status(201).json(criteria);
    } catch (error) {
      console.error("Error creating evaluation criteria:", error);
      res.status(500).json({ message: "Failed to create evaluation criteria" });
    }
  });

  app.patch("/api/evaluation-criteria/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(evaluationCriteria)
        .set(req.body)
        .where(eq(evaluationCriteria.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Criteria not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating evaluation criteria:", error);
      res.status(500).json({ message: "Failed to update evaluation criteria" });
    }
  });

  app.delete("/api/evaluation-criteria/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const scoresUsing = await db.select().from(evaluationScores).where(eq(evaluationScores.criteriaId, id)).limit(1);
      if (scoresUsing.length > 0) {
        await db.update(evaluationCriteria).set({ isActive: "false" }).where(eq(evaluationCriteria.id, id));
        return res.json({ message: "Criteria deactivated (has existing evaluations)" });
      }
      await db.delete(evaluationCriteria).where(eq(evaluationCriteria.id, id));
      res.json({ message: "Criteria deleted" });
    } catch (error) {
      console.error("Error deleting evaluation criteria:", error);
      res.status(500).json({ message: "Failed to delete evaluation criteria" });
    }
  });

  app.put("/api/evaluation-criteria/bulk-update", isAuthenticatedJWT, async (req, res) => {
    try {
      const { criteria } = req.body as { criteria: { id: string; weight: string; order: number; penaltyLeve?: string; penaltyMedio?: string; penaltyGrave?: string }[] };
      for (const c of criteria) {
        const updateData: any = { weight: c.weight, order: c.order };
        if (c.penaltyLeve !== undefined) updateData.penaltyLeve = c.penaltyLeve;
        if (c.penaltyMedio !== undefined) updateData.penaltyMedio = c.penaltyMedio;
        if (c.penaltyGrave !== undefined) updateData.penaltyGrave = c.penaltyGrave;
        await db.update(evaluationCriteria)
          .set(updateData)
          .where(eq(evaluationCriteria.id, c.id));
      }
      const updated = await db.select().from(evaluationCriteria).orderBy(evaluationCriteria.order);
      res.json(updated);
    } catch (error) {
      console.error("Error bulk updating evaluation criteria:", error);
      res.status(500).json({ message: "Failed to bulk update evaluation criteria" });
    }
  });

  // ============== DRIVER EVALUATIONS ==============
  
  const ratingToNumber = (rating: string): number => {
    const map: Record<string, number> = {
      pessimo: 1,
      ruim: 2,
      regular: 3,
      bom: 4,
      excelente: 5,
    };
    return map[rating] || 3;
  };

  // Financial Dashboard
  app.get("/api/financial-dashboard", isAuthenticatedJWT, async (req, res) => {
    try {
      const allSettlements = await db.select().from(expenseSettlements);
      const allItems = await db.select().from(expenseSettlementItems);
      const allDrivers = await db.select().from(drivers);
      const allTransports = await db.select().from(transports);

      let totalEstimated = 0;
      let totalActual = 0;
      let approvedCount = 0;
      let pendingCount = 0;
      let rejectedCount = 0;

      const monthlyMap: Record<string, { estimated: number; actual: number }> = {};
      const driverMap: Record<string, { name: string; totalDiff: number; count: number }> = {};
      const offenders: { driverName: string; driverId: string; transportRequestNumber: string; estimated: number; actual: number; difference: number; differencePercent: number }[] = [];
      const expenseTypeMap: Record<string, { total: number; count: number }> = {};

      for (const settlement of allSettlements) {
        const transport = allTransports.find(t => t.id === settlement.transportId);
        const driver = allDrivers.find(d => d.id === settlement.driverId);
        
        const estimated = parseFloat(settlement.estimatedTolls || "0") + parseFloat(settlement.estimatedFuel || "0");
        const actual = parseFloat(settlement.totalExpenses || "0");
        const difference = actual - estimated;

        totalEstimated += estimated;
        totalActual += actual;

        if (settlement.status === "aprovado" || settlement.status === "assinado") approvedCount++;
        else if (settlement.status === "pendente" || settlement.status === "em_analise") pendingCount++;
        else if (settlement.status === "devolvido") rejectedCount++;

        // Monthly aggregation
        if (settlement.submittedAt) {
          const date = new Date(settlement.submittedAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { estimated: 0, actual: 0 };
          monthlyMap[monthKey].estimated += estimated;
          monthlyMap[monthKey].actual += actual;
        }

        // Driver aggregation
        if (driver) {
          if (!driverMap[driver.id]) driverMap[driver.id] = { name: driver.name, totalDiff: 0, count: 0 };
          driverMap[driver.id].totalDiff += difference;
          driverMap[driver.id].count += 1;
        }

        // Offenders list
        if (estimated > 0) {
          offenders.push({
            driverName: driver?.name || "Desconhecido",
            driverId: settlement.driverId,
            transportRequestNumber: transport?.requestNumber || "-",
            estimated,
            actual,
            difference,
            differencePercent: (difference / estimated) * 100,
          });
        }

        // Expense type breakdown from items
        const items = allItems.filter(i => i.settlementId === settlement.id);
        for (const item of items) {
          const type = item.type || "outros";
          if (!expenseTypeMap[type]) expenseTypeMap[type] = { total: 0, count: 0 };
          expenseTypeMap[type].total += parseFloat(item.amount || "0");
          expenseTypeMap[type].count += 1;
        }
      }

      const totalDifference = totalActual - totalEstimated;
      const differencePercent = totalEstimated > 0 ? (totalDifference / totalEstimated) * 100 : 0;
      const avgDifference = allSettlements.length > 0 ? totalDifference / allSettlements.length : 0;
      const avgDifferencePercent = totalEstimated > 0 ? Math.abs(avgDifference / (totalEstimated / allSettlements.length)) * 100 : 0;
      const approvalRate = allSettlements.length > 0 ? (approvedCount / allSettlements.length) * 100 : 0;

      // Monthly data sorted
      const monthlyData = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, data]) => ({
          month: new Date(month + "-01").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          estimated: data.estimated,
          actual: data.actual,
          difference: data.actual - data.estimated,
        }));

      // Top offenders
      const topOverspenders = offenders
        .filter(o => o.difference > 0)
        .sort((a, b) => b.difference - a.difference)
        .slice(0, 10);

      const topUnderspenders = offenders
        .filter(o => o.difference < 0)
        .sort((a, b) => a.difference - b.difference)
        .slice(0, 10);

      // Expense breakdown
      const typeLabels: Record<string, string> = {
        pedagio: "Pedagio",
        combustivel: "Combustivel",
        alimentacao: "Alimentacao",
        hospedagem: "Hospedagem",
        manutencao: "Manutencao",
        outros: "Outros",
      };
      const expenseBreakdown = Object.entries(expenseTypeMap).map(([type, data]) => ({
        type,
        label: typeLabels[type] || type,
        total: data.total,
        count: data.count,
      }));

      // Driver ranking
      const driverRanking = Object.entries(driverMap)
        .map(([id, data]) => ({
          driverName: data.name,
          totalSettlements: data.count,
          avgDifference: data.count > 0 ? data.totalDiff / data.count : 0,
          totalDifference: data.totalDiff,
        }))
        .sort((a, b) => b.totalDifference - a.totalDifference);

      res.json({
        stats: {
          totalEstimated,
          totalActual,
          totalDifference,
          differencePercent,
          avgDifference,
          avgDifferencePercent,
          totalSettlements: allSettlements.length,
          approvedCount,
          pendingCount,
          rejectedCount,
          approvalRate,
        },
        monthlyData,
        topOverspenders,
        topUnderspenders,
        expenseBreakdown,
        driverRanking,
      });
    } catch (error) {
      console.error("Error fetching financial dashboard:", error);
      res.status(500).json({ message: "Erro ao buscar dashboard financeiro" });
    }
  });

  // Driver Ranking Config (weights)
  app.get("/api/driver-ranking-config", isAuthenticatedJWT, async (req, res) => {
    try {
      const [config] = await db.select().from(driverRankingWeights).limit(1);
      if (!config) {
        const [created] = await db.insert(driverRankingWeights).values({}).returning();
        return res.json(created);
      }
      return res.json(config);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/driver-ranking-config", isAuthenticatedJWT, async (req, res) => {
    try {
      const { ratingWeight, tripsWeight, responseTimeWeight } = req.body;
      const schema = z.object({
        ratingWeight: z.number().int().min(0).max(10),
        tripsWeight: z.number().int().min(0).max(10),
        responseTimeWeight: z.number().int().min(0).max(10),
      });
      const parsed = schema.parse({ ratingWeight, tripsWeight, responseTimeWeight });
      const [existing] = await db.select().from(driverRankingWeights).limit(1);
      if (existing) {
        const [updated] = await db.update(driverRankingWeights)
          .set({ ...parsed, updatedAt: new Date() })
          .where(eq(driverRankingWeights.id, existing.id))
          .returning();
        return res.json(updated);
      } else {
        const [created] = await db.insert(driverRankingWeights).values(parsed).returning();
        return res.json(created);
      }
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  // Driver Ranking
  app.get("/api/driver-ranking", isAuthenticatedJWT, async (req, res) => {
    try {
      const allDrivers = await db.select().from(drivers);
      const allTransports = await db.select().from(transports).where(eq(transports.status, "entregue"));
      const allEvaluations = await db.select().from(driverEvaluations);

      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      const driverData = allDrivers.map(driver => {
        const driverTrips = allTransports.filter(t => t.driverId === driver.id);
        const driverEvals = allEvaluations.filter(e => e.driverId === driver.id);
        const tripsLastMonth = driverTrips.filter(t => {
          const checkoutDate = t.checkoutDateTime ? new Date(t.checkoutDateTime) : null;
          return checkoutDate && checkoutDate >= oneMonthAgo;
        }).length;

        const incidentCount = driverEvals.filter(e => e.hadIncident === "true").length;

        let averageScore: number | null = null;
        if (driverEvals.length > 0) {
          const totalScore = driverEvals.reduce((sum, e) => sum + parseFloat(e.weightedScore || e.averageScore || "0"), 0);
          averageScore = totalScore / driverEvals.length;
        }

        return {
          id: driver.id,
          name: driver.name,
          cpf: driver.cpf,
          city: driver.city,
          state: driver.state,
          birthDate: driver.birthDate,
          modality: driver.modality,
          totalTrips: driverTrips.length,
          tripsLastMonth,
          averageScore,
          totalEvaluations: driverEvals.length,
          incidentCount,
        };
      });

      const driversWithScore = driverData.filter(d => d.averageScore !== null);
      const topDrivers = [...driversWithScore]
        .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
        .slice(0, 10);
      const bottomDrivers = [...driversWithScore]
        .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0))
        .slice(0, 10);

      const driversWithTrips = driverData.filter(d => d.totalTrips > 0);
      const mostIncidents = [...driversWithTrips]
        .sort((a, b) => b.incidentCount - a.incidentCount)
        .slice(0, 10);
      const leastIncidents = [...driversWithTrips]
        .sort((a, b) => a.incidentCount - b.incidentCount)
        .slice(0, 10);

      const avgScore = driversWithScore.length > 0
        ? driversWithScore.reduce((sum, d) => sum + (d.averageScore || 0), 0) / driversWithScore.length
        : 0;

      res.json({
        stats: {
          totalDrivers: allDrivers.length,
          activeDrivers: driversWithTrips.length,
          totalTrips: allTransports.length,
          averageScore: avgScore,
          driversWithEvaluations: driversWithScore.length,
        },
        drivers: driverData.sort((a, b) => a.name.localeCompare(b.name)),
        topDrivers,
        bottomDrivers,
        mostIncidents,
        leastIncidents,
      });
    } catch (error) {
      console.error("Error fetching driver ranking:", error);
      res.status(500).json({ message: "Erro ao buscar ranking de motoristas" });
    }
  });

  app.get("/api/driver-evaluations/pending-transports", isAuthenticatedJWT, async (req, res) => {
    try {
      const allTransports = await db.select().from(transports)
        .where(eq(transports.status, "entregue"));

      const allEvaluations = await db.select().from(driverEvaluations);
      const activeCriteria = await db.select().from(evaluationCriteria)
        .where(eq(evaluationCriteria.isActive, "true"));

      const concludedIds = new Set(
        allEvaluations.filter(e => e.status === "concluida").map(e => e.transportId)
      );

      const pendingTransports = allTransports.filter(t => !concludedIds.has(t.id));

      const transportsWithDetails = await Promise.all(
        pendingTransports.map(async (transport) => {
          const vehicle = transport.vehicleChassi
            ? await db.select().from(vehicles).where(eq(vehicles.chassi, transport.vehicleChassi)).then(r => r[0])
            : null;
          const driver = transport.driverId
            ? await db.select().from(drivers).where(eq(drivers.id, transport.driverId)).then(r => r[0])
            : null;
          const client = transport.clientId
            ? await db.select().from(clients).where(eq(clients.id, transport.clientId)).then(r => r[0])
            : null;
          const deliveryLoc = transport.deliveryLocationId
            ? await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, transport.deliveryLocationId)).then(r => r[0])
            : null;

          const partialEval = allEvaluations.find(
            e => e.transportId === transport.id && e.status === "em_andamento"
          );
          let partialScores: any[] = [];
          if (partialEval) {
            const rawScores = await db.select().from(evaluationScores)
              .where(eq(evaluationScores.evaluationId, partialEval.id));
            partialScores = rawScores.map(s => ({
              ...s,
              criteria: activeCriteria.find(c => c.id === s.criteriaId),
            }));
          }

          return {
            ...transport,
            vehicle,
            driver,
            client,
            deliveryLocation: deliveryLoc,
            partialEvaluation: partialEval ? { ...partialEval, scores: partialScores } : null,
            totalCriteria: activeCriteria.length,
            scoredCriteria: partialScores.length,
            activeCriteria,
          };
        })
      );

      res.json(transportsWithDetails);
    } catch (error) {
      console.error("Error fetching pending transports for evaluation:", error);
      res.status(500).json({ message: "Failed to fetch pending transports" });
    }
  });

  app.get("/api/driver-evaluations", isAuthenticatedJWT, async (req, res) => {
    try {
      const evaluations = await db.select().from(driverEvaluations)
        .where(eq(driverEvaluations.status, "concluida"));
      
      const evaluationsWithDetails = await Promise.all(
        evaluations.map(async (evaluation) => {
          const driver = await db.select().from(drivers).where(eq(drivers.id, evaluation.driverId)).then(r => r[0]);
          const transport = await db.select().from(transports).where(eq(transports.id, evaluation.transportId)).then(r => r[0]);
          const scores = await db.select().from(evaluationScores).where(eq(evaluationScores.evaluationId, evaluation.id));
          const criteriaList = scores.length > 0 
            ? await db.select().from(evaluationCriteria)
            : [];
          const scoresWithCriteria = scores.map(s => ({
            ...s,
            criteria: criteriaList.find(c => c.id === s.criteriaId),
          }));
          return { ...evaluation, driver, transport, scores: scoresWithCriteria };
        })
      );
      
      res.json(evaluationsWithDetails);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      res.status(500).json({ message: "Failed to fetch evaluations" });
    }
  });

  app.get("/api/driver-evaluations/driver/:driverId/average", isAuthenticatedJWT, async (req, res) => {
    try {
      const evaluations = await db.select().from(driverEvaluations)
        .where(eq(driverEvaluations.driverId, req.params.driverId));
      
      if (evaluations.length === 0) {
        return res.json({ average: null, count: 0, evaluations: [] });
      }
      
      const totalScore = evaluations.reduce((acc, e) => acc + parseFloat(e.averageScore || "0"), 0);
      const average = totalScore / evaluations.length;
      
      res.json({ 
        average: average.toFixed(2), 
        count: evaluations.length,
        evaluations 
      });
    } catch (error) {
      console.error("Error fetching driver average:", error);
      res.status(500).json({ message: "Failed to fetch driver average" });
    }
  });

  app.post("/api/driver-evaluations", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { criteriaScores, ...evaluationData } = req.body;

      if (!criteriaScores || !Array.isArray(criteriaScores) || criteriaScores.length === 0) {
        return res.status(400).json({ message: "criteriaScores required" });
      }

      const activeCriteria = await db.select().from(evaluationCriteria)
        .where(eq(evaluationCriteria.isActive, "true"));

      // Calculate score for each submitted criterion
      for (const cs of criteriaScores) {
        const criteria = activeCriteria.find(c => c.id === cs.criteriaId);
        if (criteria) {
          const severity = cs.severity || "sem_ocorrencia";
          let penaltyPercent = 0;
          if (severity === "leve") penaltyPercent = parseFloat(criteria.penaltyLeve || "10");
          else if (severity === "medio") penaltyPercent = parseFloat(criteria.penaltyMedio || "50");
          else if (severity === "grave") penaltyPercent = parseFloat(criteria.penaltyGrave || "100");
          cs.calculatedScore = 100 - penaltyPercent;
        }
      }

      // Check if an evaluation already exists for this transport (em_andamento)
      const existing = await db.select().from(driverEvaluations)
        .where(eq(driverEvaluations.transportId, evaluationData.transportId))
        .limit(1);

      let evaluationId: string;
      let isNew = false;

      if (existing.length > 0) {
        evaluationId = existing[0].id;
        await db.update(driverEvaluations)
          .set({
            hadIncident: evaluationData.hadIncident,
            incidentDescription: evaluationData.hadIncident === "true" ? evaluationData.incidentDescription : null,
          })
          .where(eq(driverEvaluations.id, evaluationId));
      } else {
        isNew = true;
        const [newEval] = await db.insert(driverEvaluations)
          .values({
            ...evaluationData,
            status: "em_andamento",
            averageScore: "0",
            weightedScore: "0",
          })
          .returning();
        evaluationId = newEval.id;
      }

      // Upsert scores for each submitted criterion
      for (const cs of criteriaScores) {
        const existingScore = await db.select().from(evaluationScores)
          .where(and(
            eq(evaluationScores.evaluationId, evaluationId),
            eq(evaluationScores.criteriaId, cs.criteriaId)
          ))
          .limit(1);

        if (existingScore.length > 0) {
          await db.update(evaluationScores)
            .set({
              score: (cs.calculatedScore ?? 100).toString(),
              severity: cs.severity || "sem_ocorrencia",
              notes: cs.notes || null,
            })
            .where(eq(evaluationScores.id, existingScore[0].id));
        } else {
          await db.insert(evaluationScores).values({
            evaluationId,
            criteriaId: cs.criteriaId,
            score: (cs.calculatedScore ?? 100).toString(),
            severity: cs.severity || "sem_ocorrencia",
            notes: cs.notes || null,
          });
        }
      }

      // Recalculate scores from all current scores for this evaluation
      const allScores = await db.select().from(evaluationScores)
        .where(eq(evaluationScores.evaluationId, evaluationId));

      const scoredCriteriaIds = new Set(allScores.map(s => s.criteriaId));
      const allScored = activeCriteria.length > 0 && activeCriteria.every(c => scoredCriteriaIds.has(c.id));

      let wSum = 0, wTotal = 0, sSum = 0;
      for (const score of allScores) {
        const criteria = activeCriteria.find(c => c.id === score.criteriaId);
        if (criteria) {
          const w = parseFloat(criteria.weight);
          const s = parseFloat(score.score);
          wSum += s * (w / 100);
          wTotal += w;
          sSum += s;
        }
      }

      const newStatus = allScored ? "concluida" : "em_andamento";
      const [evaluation] = await db.update(driverEvaluations)
        .set({
          status: newStatus,
          averageScore: allScores.length > 0 ? (sSum / allScores.length).toFixed(2) : "0",
          weightedScore: wTotal > 0 ? wSum.toFixed(2) : "0",
        })
        .where(eq(driverEvaluations.id, evaluationId))
        .returning();

      res.status(isNew ? 201 : 200).json({ ...evaluation, scores: allScores });
    } catch (error) {
      console.error("Error creating/updating evaluation:", error);
      res.status(500).json({ message: "Failed to create/update evaluation" });
    }
  });

  app.put("/api/driver-evaluations/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { criteriaScores, ...evaluationData } = req.body;

      const existing = await db.select().from(driverEvaluations).where(eq(driverEvaluations.id, id)).limit(1);
      if (existing.length === 0) return res.status(404).json({ message: "Evaluation not found" });

      if (!criteriaScores || !Array.isArray(criteriaScores) || criteriaScores.length === 0) {
        return res.status(400).json({ message: "criteriaScores required" });
      }

      const activeCriteria = await db.select().from(evaluationCriteria)
        .where(eq(evaluationCriteria.isActive, "true"));

      let weightedSum = 0;
      let totalWeight = 0;
      let simpleSum = 0;

      for (const cs of criteriaScores) {
        const criteria = activeCriteria.find(c => c.id === cs.criteriaId);
        if (criteria) {
          const weight = parseFloat(criteria.weight);
          const severity = cs.severity || "sem_ocorrencia";
          let penaltyPercent = 0;
          if (severity === "leve") penaltyPercent = parseFloat(criteria.penaltyLeve || "10");
          else if (severity === "medio") penaltyPercent = parseFloat(criteria.penaltyMedio || "50");
          else if (severity === "grave") penaltyPercent = parseFloat(criteria.penaltyGrave || "100");
          const score = 100 - penaltyPercent;
          cs.calculatedScore = score;
          weightedSum += score * (weight / 100);
          totalWeight += weight;
          simpleSum += score;
        }
      }

      const weightedScore = totalWeight > 0 ? weightedSum : 0;
      const averageScore = criteriaScores.length > 0 ? (simpleSum / criteriaScores.length) : 0;

      const [evaluation] = await db.update(driverEvaluations)
        .set({
          hadIncident: evaluationData.hadIncident,
          incidentDescription: evaluationData.incidentDescription ?? null,
          averageScore: averageScore.toFixed(2),
          weightedScore: weightedScore.toFixed(2),
        })
        .where(eq(driverEvaluations.id, id))
        .returning();

      await db.delete(evaluationScores).where(eq(evaluationScores.evaluationId, id));

      for (const cs of criteriaScores) {
        await db.insert(evaluationScores).values({
          evaluationId: id,
          criteriaId: cs.criteriaId,
          score: (cs.calculatedScore ?? cs.score ?? 100).toString(),
          severity: cs.severity || "sem_ocorrencia",
          notes: cs.notes || null,
        });
      }

      const scores = await db.select().from(evaluationScores)
        .where(eq(evaluationScores.evaluationId, id));

      res.json({ ...evaluation, scores });
    } catch (error) {
      console.error("Error updating evaluation:", error);
      res.status(500).json({ message: "Failed to update evaluation" });
    }
  });

  app.get("/api/drivers/:id/evaluation-summary", isAuthenticatedJWT, async (req, res) => {
    try {
      const evaluations = await db.select().from(driverEvaluations)
        .where(eq(driverEvaluations.driverId, req.params.id));
      
      if (evaluations.length === 0) {
        return res.json({
          totalEvaluations: 0,
          averageScore: null,
          categories: {
            posturaProfissional: null,
            pontualidade: null,
            apresentacaoPessoal: null,
            cordialidade: null,
            cumpriuProcesso: null,
          },
          incidentCount: 0,
        });
      }
      
      const categoryAverages = {
        posturaProfissional: evaluations.reduce((acc, e) => acc + ratingToNumber(e.posturaProfissional), 0) / evaluations.length,
        pontualidade: evaluations.reduce((acc, e) => acc + ratingToNumber(e.pontualidade), 0) / evaluations.length,
        apresentacaoPessoal: evaluations.reduce((acc, e) => acc + ratingToNumber(e.apresentacaoPessoal), 0) / evaluations.length,
        cordialidade: evaluations.reduce((acc, e) => acc + ratingToNumber(e.cordialidade), 0) / evaluations.length,
        cumpriuProcesso: evaluations.reduce((acc, e) => acc + ratingToNumber(e.cumpriuProcesso), 0) / evaluations.length,
      };
      
      const overallAverage = Object.values(categoryAverages).reduce((a, b) => a + b, 0) / 5;
      const incidentCount = evaluations.filter(e => e.hadIncident === "true").length;
      
      res.json({
        totalEvaluations: evaluations.length,
        averageScore: overallAverage.toFixed(2),
        categories: categoryAverages,
        incidentCount,
      });
    } catch (error) {
      console.error("Error fetching driver summary:", error);
      res.status(500).json({ message: "Failed to fetch driver summary" });
    }
  });

  // ============== HISTÓRICO DE STATUS DO MOTORISTA ==============

  app.get("/api/drivers/:id/status-logs", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const logs = await db
        .select()
        .from(driverStatusLogs)
        .where(eq(driverStatusLogs.driverId, id))
        .orderBy(desc(driverStatusLogs.createdAt));
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao buscar histórico de status" });
    }
  });

  app.post("/api/drivers/:id/status-logs", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, reason, isActive } = req.body;
      if (!action || !reason) {
        return res.status(400).json({ message: "action e reason são obrigatórios" });
      }
      const userReq = (req as any).user;
      const performedByUserId = userReq?.id ?? null;
      const performedByName = userReq?.name ?? userReq?.email ?? null;

      // Update driver isActive
      await db
        .update(drivers)
        .set({ isActive: isActive === true || isActive === "true" ? "true" : "false" })
        .where(eq(drivers.id, id));

      // Insert log
      const [log] = await db
        .insert(driverStatusLogs)
        .values({ driverId: id, action, reason, performedByUserId, performedByName })
        .returning();

      res.json(log);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao registrar status" });
    }
  });

  // ============== PERFIL DE MOTORISTA ==============

  app.get("/api/drivers/:id/profile", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;

      const driver = await storage.getDriver(id);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado" });

      const driverTransports = await db
        .select()
        .from(transports)
        .where(eq(transports.driverId, id))
        .orderBy(desc(transports.createdAt));

      const driverEvals = await db
        .select()
        .from(driverEvaluations)
        .where(eq(driverEvaluations.driverId, id))
        .orderBy(desc(driverEvaluations.createdAt));

      const completed = driverTransports.filter((t) => t.status === "entregue");
      const totalTrips = completed.length;
      const totalKm = completed.reduce((sum, t) => sum + parseFloat(t.routeDistanceKm as string || "0"), 0);
      const avgScore =
        driverEvals.length > 0
          ? driverEvals.reduce(
              (sum, e) => sum + parseFloat(e.weightedScore || e.averageScore || "0"),
              0
            ) / driverEvals.length
          : null;
      const incidentCount = driverEvals.filter((e) => e.hadIncident === "true").length;

      const now = new Date();
      const monthlyPerformance = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
        const monthEvals = driverEvals.filter((e) => {
          const ed = new Date(e.createdAt);
          return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
        });
        const monthAvg =
          monthEvals.length > 0
            ? monthEvals.reduce(
                (sum, e) => sum + parseFloat(e.weightedScore || e.averageScore || "0"),
                0
              ) / monthEvals.length
            : null;
        monthlyPerformance.push({
          month: label,
          score: monthAvg ? parseFloat(monthAvg.toFixed(1)) : null,
          trips: monthEvals.length,
        });
      }

      const recentTransports = driverTransports.slice(0, 25);
      const recentTrips = await Promise.all(
        recentTransports.map(async (t) => {
          const [originYardRows, delLocRows, evalRows] = await Promise.all([
            t.originYardId
              ? db.select().from(yards).where(eq(yards.id, t.originYardId)).limit(1)
              : Promise.resolve([]),
            t.deliveryLocationId
              ? db.select().from(deliveryLocations).where(eq(deliveryLocations.id, t.deliveryLocationId)).limit(1)
              : Promise.resolve([]),
            db.select().from(driverEvaluations).where(eq(driverEvaluations.transportId, t.id)).limit(1),
          ]);
          return {
            ...t,
            originYard: originYardRows[0] || null,
            deliveryLocation: delLocRows[0] || null,
            evaluation: evalRows[0] || null,
          };
        })
      );

      const infractions = driverEvals
        .filter((e) => e.hadIncident === "true")
        .slice(0, 10)
        .map((e) => ({
          id: e.id,
          date: e.createdAt,
          description: e.incidentDescription,
          score: e.weightedScore || e.averageScore,
        }));

      const isOnTrip = driverTransports.some((t) => t.status === "em_transito");

      let lastAppActivity: string | null = null;
      if (driver.email) {
        const [linkedUser] = await db
          .select({ lastLogin: users.lastLogin })
          .from(users)
          .where(eq(users.email, driver.email))
          .limit(1);
        if (linkedUser?.lastLogin) {
          lastAppActivity = new Date(linkedUser.lastLogin).toISOString();
        }
      }

      res.json({
        driver,
        kpis: {
          totalTrips,
          totalKm: totalKm.toFixed(0),
          avgScore: avgScore ? avgScore.toFixed(1) : null,
          incidentCount,
        },
        monthlyPerformance,
        recentTrips,
        infractions,
        isOnTrip,
        lastAppActivity,
      });
    } catch (error) {
      console.error("Error fetching driver profile:", error);
      res.status(500).json({ message: "Failed to fetch driver profile" });
    }
  });

  // ============== GESTÃO DE ROTAS (Route Management) ==============
  
  // Get all routes with relations
  app.get("/api/routes", isAuthenticatedJWT, async (req, res) => {
    try {
      const allRoutes = await db.select().from(routes).orderBy(routes.createdAt);
      
      const routesWithRelations = await Promise.all(
        allRoutes.map(async (route) => {
          const originYard = await db.select().from(yards).where(eq(yards.id, route.originYardId)).limit(1);
          const destinationLocation = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, route.destinationLocationId)).limit(1);
          const client = destinationLocation[0]?.clientId
            ? await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, destinationLocation[0].clientId)).limit(1)
            : [];
          return {
            ...route,
            originYard: originYard[0] || null,
            destinationLocation: destinationLocation[0] || null,
            client: client[0] || null,
          };
        })
      );
      
      res.json(routesWithRelations);
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ message: "Failed to fetch routes" });
    }
  });

  // Get single route by ID
  app.get("/api/routes/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const route = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
      
      if (!route[0]) {
        return res.status(404).json({ message: "Route not found" });
      }
      
      const originYard = await db.select().from(yards).where(eq(yards.id, route[0].originYardId)).limit(1);
      const destinationLocation = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, route[0].destinationLocationId)).limit(1);
      
      res.json({
        ...route[0],
        originYard: originYard[0] || null,
        destinationLocation: destinationLocation[0] || null,
      });
    } catch (error) {
      console.error("Error fetching route:", error);
      res.status(500).json({ message: "Failed to fetch route" });
    }
  });

  // Create new route
  app.post("/api/routes", isAuthenticatedJWT, async (req, res) => {
    try {
      const { name, originYardId, destinationLocationId, distanceKm,
              fuelCost, tollCost, driverDailyCost, foodCost, othersCost, totalCost } = req.body;
      if (!name || !originYardId || !destinationLocationId) {
        return res.status(400).json({ message: "Nome, pátio de origem e local de entrega são obrigatórios." });
      }
      const newRoute = await db.insert(routes).values({
        name,
        originYardId,
        destinationLocationId,
        distanceKm: distanceKm ? String(distanceKm) : null,
        fuelCost: fuelCost ? String(fuelCost) : null,
        tollCost: tollCost ? String(tollCost) : null,
        driverDailyCost: driverDailyCost ? String(driverDailyCost) : null,
        foodCost: foodCost ? String(foodCost) : null,
        othersCost: othersCost ? String(othersCost) : null,
        totalCost: totalCost ? String(totalCost) : null,
      }).returning();
      res.status(201).json(newRoute[0]);
    } catch (error) {
      console.error("Error creating route:", error);
      res.status(500).json({ message: "Failed to create route" });
    }
  });

  // Update route
  app.patch("/api/routes/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, originYardId, destinationLocationId, distanceKm,
              fuelCost, tollCost, driverDailyCost, foodCost, othersCost, totalCost } = req.body;
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (originYardId !== undefined) updateData.originYardId = originYardId;
      if (destinationLocationId !== undefined) updateData.destinationLocationId = destinationLocationId;
      if (distanceKm !== undefined) updateData.distanceKm = distanceKm ? String(distanceKm) : null;
      if (fuelCost !== undefined) updateData.fuelCost = fuelCost ? String(fuelCost) : null;
      if (tollCost !== undefined) updateData.tollCost = tollCost ? String(tollCost) : null;
      if (driverDailyCost !== undefined) updateData.driverDailyCost = driverDailyCost ? String(driverDailyCost) : null;
      if (foodCost !== undefined) updateData.foodCost = foodCost ? String(foodCost) : null;
      if (othersCost !== undefined) updateData.othersCost = othersCost ? String(othersCost) : null;
      if (totalCost !== undefined) updateData.totalCost = totalCost ? String(totalCost) : null;
      const updatedRoute = await db.update(routes).set(updateData).where(eq(routes.id, id)).returning();
      if (!updatedRoute[0]) {
        return res.status(404).json({ message: "Route not found" });
      }
      res.json(updatedRoute[0]);
    } catch (error) {
      console.error("Error updating route:", error);
      res.status(500).json({ message: "Failed to update route" });
    }
  });

  // Delete route
  app.delete("/api/routes/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(routes).where(eq(routes.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route:", error);
      res.status(500).json({ message: "Failed to delete route" });
    }
  });

  // Toggle favorite
  app.patch("/api/routes/:id/favorite", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const route = await db.select().from(routes).where(eq(routes.id, id)).limit(1);
      
      if (!route[0]) {
        return res.status(404).json({ message: "Route not found" });
      }
      
      const newFavoriteStatus = route[0].isFavorite === "true" ? "false" : "true";
      const updatedRoute = await db.update(routes).set({ isFavorite: newFavoriteStatus, updatedAt: new Date() }).where(eq(routes.id, id)).returning();
      
      res.json(updatedRoute[0]);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  // Calculate route distance and tolls using Google Maps API
  app.post("/api/routes/calculate-route", isAuthenticatedJWT, async (req, res) => {
    try {
      const { originYardId, destinationLocationId, truckAxles } = req.body;
      
      if (!originYardId || !destinationLocationId) {
        return res.status(400).json({ message: "Origin yard and destination location are required" });
      }
      
      const originYard = await db.select().from(yards).where(eq(yards.id, originYardId)).limit(1);
      if (!originYard[0]) {
        return res.status(404).json({ message: "Origin yard not found" });
      }
      
      const destinationLocation = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, destinationLocationId)).limit(1);
      if (!destinationLocation[0]) {
        return res.status(404).json({ message: "Destination location not found" });
      }
      
      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      const yard = originYard[0];
      const dest = destinationLocation[0];
      
      // Build text addresses as fallback when coordinates are missing
      const buildAddress = (obj: { address?: string | null; addressNumber?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null; country?: string | null }) => {
        const parts = [obj.address, obj.addressNumber, obj.neighborhood, obj.city, obj.state, obj.country || "Brasil"].filter(Boolean);
        return parts.join(", ");
      };

      const hasOriginCoords = !!(yard.latitude && yard.longitude);
      const hasDestCoords = !!(dest.latitude && dest.longitude);

      // Helper: call Distance Matrix with either coords or address strings
      const callDistanceMatrix = async (originParam: string, destParam: string) => {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originParam)}&destinations=${encodeURIComponent(destParam)}&mode=driving&language=pt-BR&key=${apiKey}`;
        const r = await fetch(url);
        return r.json();
      };

      const originParam = hasOriginCoords ? `${yard.latitude},${yard.longitude}` : buildAddress(yard);
      const destParam = hasDestCoords ? `${dest.latitude},${dest.longitude}` : buildAddress(dest);

      if (!originParam || !destParam) {
        return res.status(400).json({ message: "Pátio ou local de entrega sem endereço cadastrado para calcular a distância." });
      }

      // Try Google Routes API first (only when both have coordinates)
      if (hasOriginCoords && hasDestCoords) {
        const routesApiUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";
        const axlesNum = parseInt(truckAxles) || 2;
        const requestBody: any = {
          origin: { location: { latLng: { latitude: parseFloat(yard.latitude!), longitude: parseFloat(yard.longitude!) } } },
          destination: { location: { latLng: { latitude: parseFloat(dest.latitude!), longitude: parseFloat(dest.longitude!) } } },
          travelMode: "DRIVE",
          computeAlternativeRoutes: false,
          extraComputations: ["TOLLS"],
          routeModifiers: { vehicleInfo: { emissionType: "DIESEL" } }
        };
        if (axlesNum > 2) requestBody.routeModifiers.vehicleInfo.axleCount = axlesNum;

        const response = await fetch(routesApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.travelAdvisory.tollInfo"
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.routes?.length > 0) {
            const route = data.routes[0];
            const distanceKm = (route.distanceMeters / 1000).toFixed(2);
            const durationMinutes = Math.round(parseInt(route.duration.replace("s", "")) / 60);
            let tollCost: string | null = null;
            if (route.travelAdvisory?.tollInfo?.estimatedPrice?.length > 0) {
              const prices = route.travelAdvisory.tollInfo.estimatedPrice;
              const brlPrices = prices.filter((p: any) => p.currencyCode === "BRL");
              const pricesToUse = brlPrices.length > 0 ? brlPrices : prices;
              const total = pricesToUse.reduce((sum: number, p: any) => {
                const units = typeof p.units === 'string' ? parseFloat(p.units) : (p.units || 0);
                const nanos = typeof p.nanos === 'string' ? parseFloat(p.nanos) : (p.nanos || 0);
                return sum + units + nanos / 1000000000;
              }, 0);
              if (total > 0) tollCost = total.toFixed(2);
            }
            return res.json({ distanceKm, durationMinutes, tollCost, originYardName: yard.name, destinationLocationName: dest.name });
          }
        }
      }

      // Fallback: Distance Matrix API with coordinates or text address
      const dmData = await callDistanceMatrix(originParam, destParam);
      if (dmData.status === "OK" && dmData.rows?.[0]?.elements?.[0]?.status === "OK") {
        const element = dmData.rows[0].elements[0];
        const distanceKm = (element.distance.value / 1000).toFixed(2);
        const durationMinutes = Math.round(element.duration.value / 60);
        return res.json({ distanceKm, durationMinutes, tollCost: null, originYardName: yard.name, destinationLocationName: dest.name });
      }

      return res.status(500).json({ message: "Não foi possível calcular a distância. Verifique o endereço do pátio e do local de entrega." });
    } catch (error) {
      console.error("Error calculating route:", error);
      res.status(500).json({ message: "Failed to calculate route" });
    }
  });

  // Get favorite routes only
  app.get("/api/routes/favorites/list", isAuthenticatedJWT, async (req, res) => {
    try {
      const favoriteRoutes = await db.select().from(routes).where(eq(routes.isFavorite, "true")).orderBy(routes.name);
      
      const routesWithRelations = await Promise.all(
        favoriteRoutes.map(async (route) => {
          const originYard = await db.select().from(yards).where(eq(yards.id, route.originYardId)).limit(1);
          const destinationLocation = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, route.destinationLocationId)).limit(1);
          
          return {
            ...route,
            originYard: originYard[0] || null,
            destinationLocation: destinationLocation[0] || null,
          };
        })
      );
      
      res.json(routesWithRelations);
    } catch (error) {
      console.error("Error fetching favorite routes:", error);
      res.status(500).json({ message: "Failed to fetch favorite routes" });
    }
  });

  // Contracts
  // Helper: enrich contracts with their drivers list (N:N) and a primary `driver`
  // (first linked driver) for backwards-compat with existing UI.
  async function enrichContractWithDrivers(contract: Contract) {
    const enriched = await enrichContractsWithDriversBatch([contract]);
    return enriched[0];
  }

  // Batch version: 2 queries total instead of 1+N per contract.
  async function enrichContractsWithDriversBatch(contractsList: Contract[]) {
    if (contractsList.length === 0) return [];
    const contractIds = contractsList.map((c) => c.id);
    const allLinks = await storage.getContractDriversForContracts(contractIds);

    // Collect every driver id we'll need (links + legacy fallback)
    const driverIdSet = new Set<string>();
    for (const l of allLinks) driverIdSet.add(l.driverId);
    for (const c of contractsList) {
      if (c.driverId && !driverIdSet.has(c.driverId)) driverIdSet.add(c.driverId);
    }

    const driverIdsArr = Array.from(driverIdSet);
    const driversList = driverIdsArr.length > 0
      ? await db.select().from(drivers).where(inArray(drivers.id, driverIdsArr))
      : [];
    const driverById = new Map(driversList.map((d) => [d.id, d]));

    // Group links by contract, preserving stable order from getContractDriversForContracts
    const linksByContract = new Map<string, typeof allLinks>();
    for (const l of allLinks) {
      const arr = linksByContract.get(l.contractId);
      if (arr) arr.push(l);
      else linksByContract.set(l.contractId, [l]);
    }

    return contractsList.map((contract) => {
      const links = linksByContract.get(contract.id) || [];
      const driverObjs = links
        .map((l) => {
          const d = driverById.get(l.driverId);
          if (!d) return null;
          return {
            ...d,
            contractDriverId: l.id,
            driverSignedAt: l.driverSignedAt,
            autentiqueDocId: l.autentiqueDocId,
            autentiqueStatus: l.autentiqueStatus,
            autentiqueSignedUrl: l.autentiqueSignedUrl,
            autentiqueOriginalUrl: l.autentiqueOriginalUrl,
            autentiqueSentAt: l.autentiqueSentAt,
          };
        })
        .filter(Boolean) as any[];
      const driverIds = driverObjs.map((d) => d.id);
      const legacyDriver = contract.driverId ? driverById.get(contract.driverId) || null : null;
      const driver = driverObjs[0] || legacyDriver;
      return { ...contract, drivers: driverObjs, driverIds, driver };
    });
  }

  app.get("/api/contracts", isAuthenticatedJWT, async (req, res) => {
    try {
      const allContracts = await storage.getContracts();
      // Phase 1: per-contract Autentique sync (still sequential per-contract, since
      // each may hit the external API). Produces an updated contract list.
      const syncedContracts = await Promise.all(
        allContracts.map(async (contract) => {
          let updated = { ...contract };
          const pendingStatuses = ["pendente", "parcialmente_assinado"];
          if (contract.autentiqueDocId && pendingStatuses.includes(contract.autentiqueStatus ?? "")) {
            try {
              const data = await autentique.getDocument(contract.autentiqueDocId);
              const doc = data.document;
              const computedStatus = autentique.getDocumentStatus(doc);
              if (computedStatus !== contract.autentiqueStatus) {
                const signatures = (doc.signatures || []) as Array<{ signed?: { created_at?: string } | null }>;
                const signedDates = signatures.filter((s) => s.signed?.created_at).map((s) => new Date(s.signed!.created_at!));
                const latestSignedAt = signedDates.length > 0 ? new Date(Math.max(...signedDates.map((d) => d.getTime()))) : null;
                await db.update(contracts)
                  .set({
                    autentiqueStatus: computedStatus,
                    autentiqueSignedUrl: doc.files?.signed || null,
                    ...(computedStatus === "assinado" && latestSignedAt ? { driverSignedAt: latestSignedAt } : {}),
                  })
                  .where(eq(contracts.id, contract.id));
                updated = { ...updated, autentiqueStatus: computedStatus, autentiqueSignedUrl: doc.files?.signed || contract.autentiqueSignedUrl, ...(computedStatus === "assinado" && latestSignedAt ? { driverSignedAt: latestSignedAt } : {}) };
              }
            } catch {
              // Silently skip sync errors — return cached DB value
            }
          }
          return updated;
        })
      );

      // Phase 2: enrich ALL contracts with drivers in 2 queries (no N+1).
      const contractsWithDrivers = await enrichContractsWithDriversBatch(syncedContracts);
      res.json(contractsWithDrivers);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      const enriched = await enrichContractWithDrivers(contract);
      res.json({ ...contract, ...enriched });
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post("/api/contracts", isAuthenticatedJWT, async (req, res) => {
    try {
      const parsed = insertContractSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid contract data", errors: parsed.error.errors });
      }
      const { driverIds: rawDriverIds, ...contractData } = parsed.data as any;
      const driverIds: string[] = Array.isArray(rawDriverIds)
        ? rawDriverIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
        : (contractData.driverId ? [contractData.driverId] : []);
      // Keep legacy driverId in sync with primary driver for backwards-compat
      contractData.driverId = driverIds[0] || null;
      // Atomic: contract row + N:N driver links in a single transaction.
      const contract = await storage.createContractWithDrivers(contractData, driverIds);
      for (const dId of driverIds) await recalculateIsApto(dId, storage);
      const enriched = await enrichContractWithDrivers(contract);
      res.status(201).json({ ...contract, ...enriched });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(400).json({ message: "Número de contrato já existe" });
      }
      console.error("Error creating contract:", error);
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.patch("/api/contracts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const existing = await storage.getContract(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Contract not found" });
      }
      const { driverIds: rawDriverIds, driverId: legacyDriverId, ...rest } = req.body as any;
      let updateData: any = { ...rest };
      // Resolve target driver list (may be undefined → no change)
      let targetDriverIds: string[] | undefined;
      if (Array.isArray(rawDriverIds)) {
        targetDriverIds = rawDriverIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0);
      } else if (legacyDriverId !== undefined) {
        targetDriverIds = legacyDriverId ? [legacyDriverId] : [];
      }

      if (targetDriverIds !== undefined) {
        // Sync legacy driverId column with primary driver
        updateData.driverId = targetDriverIds[0] || null;
      }

      // Atomic: contract row update + N:N driver-link sync in a single transaction.
      const { contract, added, removed, previousIds } =
        await storage.updateContractWithDrivers(req.params.id, updateData, targetDriverIds);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const affected = Array.from(new Set([...previousIds, ...added, ...removed]));
      for (const dId of affected) {
        if (dId) await recalculateIsApto(dId, storage);
      }
      const enriched = await enrichContractWithDrivers(contract);
      res.json({ ...contract, ...enriched });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(400).json({ message: "Número de contrato já existe" });
      }
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const links = await storage.getContractDrivers(req.params.id);
      const existing = await storage.getContract(req.params.id);
      await storage.deleteContract(req.params.id);
      const affected = new Set<string>(links.map((l) => l.driverId));
      if (existing?.driverId) affected.add(existing.driverId);
      for (const dId of affected) {
        if (dId) await recalculateIsApto(dId, storage);
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  app.post("/api/contracts/:id/send-email", isAuthenticatedJWT, async (req, res) => {
    try {
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ message: "ID do motorista é obrigatório" });
      }

      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contrato não encontrado" });
      }

      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      if (!driver.email) {
        return res.status(400).json({ message: "Motorista não possui email cadastrado" });
      }

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT || "587";
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || smtpUser;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.status(500).json({ message: "Configuração SMTP não encontrada. Configure as variáveis SMTP_HOST, SMTP_USER e SMTP_PASS." });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: parseInt(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <div style="background-color: #f97316; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">OTD Entregas</h1>
            <p style="margin: 5px 0 0;">Contrato para Assinatura</p>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb;">
            <p>Olá <strong>${driver.name}</strong>,</p>
            <p>Segue abaixo o contrato <strong>${contract.contractNumber}</strong> - ${contract.title || "Sem título"} para sua análise e assinatura.</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <div style="padding: 10px; background: #fafafa; border-radius: 4px;">
              ${contract.content || "<p>Conteúdo do contrato não disponível.</p>"}
            </div>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">Este email foi enviado automaticamente pelo sistema OTD Entregas.</p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: smtpFrom,
        to: driver.email,
        subject: `Contrato ${contract.contractNumber} - ${contract.title || "Para Assinatura"}`,
        html: htmlContent,
      });

      res.json({ message: "Contrato enviado com sucesso para " + driver.email });
    } catch (error: any) {
      console.error("Error sending contract email:", error);
      res.status(500).json({ message: "Erro ao enviar email: " + (error.message || "Falha no envio") });
    }
  });

  // ============== ESTADOS E CIDADES BRASILEIRAS (público, sem autenticação) ==============

  const ibgeCache: Record<string, { data: unknown; expiresAt: number }> = {};
  const IBGE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

  async function fetchIBGE(url: string) {
    const now = Date.now();
    if (ibgeCache[url] && ibgeCache[url].expiresAt > now) {
      return ibgeCache[url].data;
    }
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`IBGE API error: ${res.status}`);
    const data = await res.json();
    ibgeCache[url] = { data, expiresAt: now + IBGE_CACHE_TTL };
    return data;
  }

  app.get("/api/locations/states", async (_req, res) => {
    try {
      const data = await fetchIBGE(
        "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
      ) as any[];
      const states = data.map((s: any) => ({ uf: s.sigla, name: s.nome }));
      res.json(states);
    } catch (error: any) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Erro ao buscar estados: " + error.message });
    }
  });

  app.get("/api/locations/cities/:uf", async (req, res) => {
    try {
      const uf = req.params.uf.toUpperCase();
      const data = await fetchIBGE(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
      ) as any[];
      const cities = data.map((c: any) => ({ id: c.id, name: c.nome }));
      res.json(cities);
    } catch (error: any) {
      console.error("Error fetching cities:", error);
      res.status(500).json({ message: "Erro ao buscar cidades: " + error.message });
    }
  });

  // ============== CADASTRO PÚBLICO DE MOTORISTA (sem autenticação) ==============

  app.post("/api/external/drivers/register", (req, res, next) => {
    uploadForRegistration.fields([
      { name: "cnhFrontFile", maxCount: 1 },
      { name: "cnhBackFile", maxCount: 1 },
      { name: "rgFile", maxCount: 1 },
      { name: "addressProofFile", maxCount: 1 },
      { name: "profilePhotoFile", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Erro no upload de arquivo" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      // Check if smart storage detected a validation error (CPF/email duplicate)
      if (req._registrationError) {
        return res.status(req._registrationError.status).json({ message: req._registrationError.message });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const body = { ...req.body };

      if (files?.cnhFrontFile?.[0]) {
        body.cnhFrontPhoto = `/uploads/${files.cnhFrontFile[0].filename}`;
      }
      if (files?.cnhBackFile?.[0]) {
        body.cnhBackPhoto = `/uploads/${files.cnhBackFile[0].filename}`;
      }
      if (files?.rgFile?.[0]) {
        body.rgPhoto = `/uploads/${files.rgFile[0].filename}`;
      }
      if (files?.addressProofFile?.[0]) {
        body.addressProofPhoto = `/uploads/${files.addressProofFile[0].filename}`;
      }
      if (files?.profilePhotoFile?.[0]) {
        body.profilePhoto = `/uploads/${files.profilePhotoFile[0].filename}`;
      }

      // Validate required fields: email and password are mandatory for external registration
      if (!body.email || body.email.trim() === "") {
        return res.status(400).json({ message: "O campo 'email' é obrigatório" });
      }
      if (!body.password || body.password.trim() === "") {
        return res.status(400).json({ message: "O campo 'password' é obrigatório" });
      }
      if (body.password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter no mínimo 6 caracteres" });
      }

      // Fallback uniqueness checks (runs when no files were sent, or as double check)
      const cpf = body.cpf?.replace(/\D/g, "");
      if (cpf && !req._cpfChecked) {
        const [existingCpf] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.cpf, cpf)).limit(1);
        if (existingCpf) return res.status(409).json({ message: "CPF já cadastrado no sistema" });
      }
      const emailLower = body.email.trim().toLowerCase();
      if (!req._emailChecked) {
        const [existingEmailUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, emailLower)).limit(1);
        if (existingEmailUser) return res.status(409).json({ message: "E-mail já cadastrado no sistema" });
        const [existingEmailDriver] = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.email, emailLower)).limit(1);
        if (existingEmailDriver) return res.status(409).json({ message: "E-mail já cadastrado no sistema" });
      }

      const { password, ...driverBody } = body;
      // Use flexible schema for external registration: modality/driverType optional (driverType forced to "transporte"), email required
      const externalDriverSchema = insertDriverSchema.extend({
        modality: z.enum(["pj", "clt", "agregado"]).optional(),
        driverType: z.enum(["coleta", "transporte"]).optional(),
        email: z.string().email("Email inválido"),
      });
      const data = externalDriverSchema.parse(driverBody);
      (data as any).registrationSource = "app";
      (data as any).driverType = "transporte";
      const driver = await storage.createDriver(data as any);
      await recalculateIsApto(driver.id, storage);

      // Create user account linked to driver (email + password are guaranteed at this point)
      const [existingUser] = await db.select().from(users).where(eq(users.email, driver.email!)).limit(1);
      if (!existingUser) {
        const passwordHash = await hashPassword(password);
        const username = driver.email!.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        await db.insert(users).values({
          username,
          email: driver.email!,
          passwordHash,
          firstName: driver.name.split(" ")[0],
          lastName: driver.name.split(" ").slice(1).join(" ") || undefined,
          role: "motorista",
          isActive: "true",
        });
      }

      const created = await storage.getDriver(driver.id);
      res.status(201).json(created ?? driver);
    } catch (error: any) {
      console.error("Error creating driver (external):", error);
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        return res.status(409).json({ message: "CPF já cadastrado no sistema" });
      }
      // Format Zod validation errors into readable messages
      if (error?.errors && Array.isArray(error.errors)) {
        const messages = error.errors.map((e: any) => {
          const field = e.path?.[0];
          if (field === "email") return `Email: ${e.message}`;
          if (field === "phone") return "O campo 'phone' (telefone) é obrigatório";
          if (field === "cnhType") return "O campo 'cnhType' (categoria CNH) é obrigatório";
          return e.message;
        });
        return res.status(400).json({ message: messages.join("; ") });
      }
      res.status(400).json({ message: error.message || "Falha ao cadastrar motorista" });
    }
  });

  // ============== COLETA EM ANDAMENTO DO MOTORISTA LOGADO ==============

  app.get("/api/external/driver/my-collects", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;

      // req.user is the full DB User object (set by isAuthenticatedJWT via userId lookup)
      // so user.email is the real email from the database
      const driverEmail = (user as any).email as string | null;

      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado — não é possível identificar o motorista" });
      }

      // Find driver by email
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }

      // Motorista inapto: devolve lista vazia + flag para o app exibir aviso
      const isAptDriver = driver.isApto === "true" && driver.isActive === "true";
      if (!isAptDriver) {
        return res.json({
          driver: {
            id: driver.id,
            name: driver.name,
            cpf: driver.cpf,
            phone: driver.phone,
            email: driver.email,
            driverType: driver.driverType,
            modality: driver.modality,
            isApto: driver.isApto,
            profilePhoto: driver.profilePhoto,
          },
          collects: [],
          total: 0,
          blocked: true,
          blockedReason: INAPTO_MSG,
        });
      }

      // Optional status filter via query param ?status=em_transito
      const statusFilter = req.query.status as string | undefined;

      const whereClause = statusFilter
        ? and(eq(collects.driverId, driver.id), eq(collects.status, statusFilter))
        : eq(collects.driverId, driver.id);

      const driverCollects = await db
        .select()
        .from(collects)
        .where(whereClause)
        .orderBy(desc(collects.createdAt));

      // Enrich with manufacturer and yard data
      const collectsWithRelations = await Promise.all(
        driverCollects.map(async (collect) => {
          const [manufacturer] = await db
            .select({ id: manufacturers.id, name: manufacturers.name, city: manufacturers.city, state: manufacturers.state })
            .from(manufacturers)
            .where(eq(manufacturers.id, collect.manufacturerId));

          const [yard] = await db
            .select({ id: yards.id, name: yards.name, city: yards.city, state: yards.state })
            .from(yards)
            .where(eq(yards.id, collect.yardId));

          return { ...collect, manufacturer: manufacturer || null, yard: yard || null };
        })
      );

      res.json({
        driver: {
          id: driver.id,
          name: driver.name,
          cpf: driver.cpf,
          phone: driver.phone,
          email: driver.email,
          driverType: driver.driverType,
          modality: driver.modality,
          isApto: driver.isApto,
          profilePhoto: driver.profilePhoto,
        },
        collects: collectsWithRelations,
        total: collectsWithRelations.length,
      });
    } catch (error) {
      console.error("Error fetching driver collects:", error);
      res.status(500).json({ message: "Erro ao buscar coletas do motorista" });
    }
  });

  // ============== LISTAR TRANSPORTES DO MOTORISTA (APP MOBILE) ==============

  app.get("/api/external/driver/my-transports", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;

      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado — não é possível identificar o motorista" });
      }

      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }

      // Motorista inapto: lista vazia
      if (driver.isApto !== "true" || driver.isActive !== "true") {
        return res.json([]);
      }

      const transportsList = await storage.getTransportsByDriver(driver.id);
      res.json(transportsList);
    } catch (error) {
      console.error("Error fetching driver transports:", error);
      res.status(500).json({ message: "Erro ao buscar transportes do motorista" });
    }
  });

  // ============== TRANSPORTE EM ANDAMENTO (CHECK-IN FEITO, SEM CHECK-OUT) ==============

  app.get("/api/external/driver/my-transports/in-progress", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;

      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado — não é possível identificar o motorista" });
      }

      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }

      const [row] = await db
        .select({
          id: transports.id,
          requestNumber: transports.requestNumber,
          status: transports.status,
          checkinDateTime: transports.checkinDateTime,
          originName: yards.name,
          originCity: yards.city,
          originState: yards.state,
          destinationName: deliveryLocations.name,
          destinationCity: deliveryLocations.city,
          destinationState: deliveryLocations.state,
        })
        .from(transports)
        .leftJoin(yards, eq(transports.originYardId, yards.id))
        .leftJoin(deliveryLocations, eq(transports.deliveryLocationId, deliveryLocations.id))
        .where(
          and(
            eq(transports.driverId, driver.id),
            isNotNull(transports.checkinDateTime),
            isNull(transports.checkoutDateTime),
          ),
        )
        .orderBy(desc(transports.checkinDateTime))
        .limit(1);

      if (!row) {
        return res.json(null);
      }

      const [settlement] = await db
        .select()
        .from(expenseSettlements)
        .where(eq(expenseSettlements.transportId, row.id))
        .limit(1);

      let expensesPayload: any = null;
      if (settlement) {
        const items = await db
          .select()
          .from(expenseSettlementItems)
          .where(eq(expenseSettlementItems.settlementId, settlement.id))
          .orderBy(desc(expenseSettlementItems.createdAt));

        const totalAmount = items.reduce(
          (sum, it) => sum + parseFloat(it.amount || "0"),
          0,
        );

        expensesPayload = {
          settlementId: settlement.id,
          status: settlement.status,
          advanceAmount: settlement.advanceAmount,
          totalExpenses: settlement.totalExpenses ?? totalAmount.toFixed(2),
          balanceAmount: settlement.balanceAmount,
          items: items.map((it) => ({
            id: it.id,
            type: it.type,
            description: it.description,
            currency: it.currency,
            amount: it.amount,
            photoUrl: it.photoUrl,
            photoStatus: it.photoStatus,
            photoRejectionReason: it.photoRejectionReason,
            itemStatus: it.itemStatus,
            approvedAmount: it.approvedAmount,
            createdAt: it.createdAt,
          })),
        };
      }

      res.json({
        id: row.id,
        requestNumber: row.requestNumber,
        origin: row.originName
          ? {
              name: row.originName,
              city: row.originCity,
              state: row.originState,
            }
          : null,
        destination: row.destinationName
          ? {
              name: row.destinationName,
              city: row.destinationCity,
              state: row.destinationState,
            }
          : null,
        status: row.status,
        checkinDateTime: row.checkinDateTime,
        expenses: expensesPayload,
      });
    } catch (error) {
      console.error("Error fetching driver in-progress transport:", error);
      res.status(500).json({ message: "Erro ao buscar transporte em andamento do motorista" });
    }
  });

  // ============== LISTAR PRESTAÇÕES DE CONTAS PENDENTES DO MOTORISTA (APP MOBILE) ==============

  app.get(
    "/api/external/driver/expense-settlements/pending",
    isAuthenticatedJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;
        const driverEmail = (user as any).email as string | null;
        if (!driverEmail) {
          return res.status(404).json({ message: "Usuário sem e-mail vinculado" });
        }

        const [driver] = await db.select().from(drivers).where(eq(drivers.email, driverEmail)).limit(1);
        if (!driver) {
          return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
        }

        const rows = await db
          .select({
            id: expenseSettlements.id,
            transportId: expenseSettlements.transportId,
            status: expenseSettlements.status,
            advanceAmount: expenseSettlements.advanceAmount,
            totalExpenses: expenseSettlements.totalExpenses,
            balanceAmount: expenseSettlements.balanceAmount,
            routeDistance: expenseSettlements.routeDistance,
            estimatedTolls: expenseSettlements.estimatedTolls,
            estimatedFuel: expenseSettlements.estimatedFuel,
            submittedAt: expenseSettlements.submittedAt,
            driverFinishedSubmissionAt: expenseSettlements.driverFinishedSubmissionAt,
            createdAt: expenseSettlements.createdAt,
            requestNumber: transports.requestNumber,
            originName: yards.name,
            originCity: yards.city,
            originState: yards.state,
            destinationName: deliveryLocations.name,
            destinationCity: deliveryLocations.city,
            destinationState: deliveryLocations.state,
          })
          .from(expenseSettlements)
          .leftJoin(transports, eq(expenseSettlements.transportId, transports.id))
          .leftJoin(yards, eq(transports.originYardId, yards.id))
          .leftJoin(deliveryLocations, eq(transports.deliveryLocationId, deliveryLocations.id))
          .where(
            and(
              eq(expenseSettlements.driverId, driver.id),
              inArray(expenseSettlements.status, ["pendente", "enviado"]),
            ),
          )
          .orderBy(desc(expenseSettlements.createdAt));

        const result = await Promise.all(
          rows.map(async (row) => {
            const items = await db
              .select()
              .from(expenseSettlementItems)
              .where(eq(expenseSettlementItems.settlementId, row.id))
              .orderBy(desc(expenseSettlementItems.createdAt));

            return {
              id: row.id,
              transportId: row.transportId,
              requestNumber: row.requestNumber,
              status: row.status,
              statusLabel: row.status === "enviado" ? "Aguardando Análise" : "Pendente",
              advanceAmount: row.advanceAmount,
              totalExpenses: row.totalExpenses,
              balanceAmount: row.balanceAmount,
              routeDistance: row.routeDistance,
              estimatedTolls: row.estimatedTolls,
              estimatedFuel: row.estimatedFuel,
              submittedAt: row.submittedAt,
              driverFinishedSubmissionAt: row.driverFinishedSubmissionAt,
              createdAt: row.createdAt,
              origin: row.originName
                ? { name: row.originName, city: row.originCity, state: row.originState }
                : null,
              destination: row.destinationName
                ? { name: row.destinationName, city: row.destinationCity, state: row.destinationState }
                : null,
              itemsCount: items.length,
              items: items.map((it) => ({
                id: it.id,
                type: it.type,
                description: it.description,
                country: it.country,
                currency: it.currency,
                amount: it.amount,
                photoUrl: it.photoUrl,
                photoStatus: it.photoStatus,
                itemStatus: it.itemStatus,
                approvedAmount: it.approvedAmount,
                createdAt: it.createdAt,
              })),
            };
          }),
        );

        res.json(result);
      } catch (error: any) {
        console.error("Error fetching pending expense settlements for driver:", error);
        res.status(500).json({ message: "Erro ao buscar prestações de contas pendentes" });
      }
    },
  );

  // ============== ADICIONAR DESPESA À PRESTAÇÃO DE CONTAS (APP MOBILE) ==============

  app.post(
    "/api/external/driver/expense-settlements/:settlementId/items",
    isAuthenticatedJWT,
    (req, res, next) => {
      upload.single("photoFile")(req, res, (err: any) => {
        if (err) {
          console.error("Multer error on expense item upload:", err);
          return res.status(400).json({ message: err.message || "Erro no upload da imagem" });
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;
        const driverEmail = (user as any).email as string | null;
        if (!driverEmail) {
          return res.status(404).json({ message: "Usuário sem e-mail vinculado" });
        }

        const [driver] = await db.select().from(drivers).where(eq(drivers.email, driverEmail)).limit(1);
        if (!driver) {
          return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
        }

        const settlementId = req.params.settlementId;
        const { country, type, description, amount, currency } = req.body;

        const allowedTypes = [
          "combustivel",
          "pedagio",
          "hospedagem",
          "alimentacao",
          "passagem",
          "outros",
        ];
        if (!type || !allowedTypes.includes(type)) {
          return res.status(400).json({
            message: `Tipo de despesa inválido. Use: ${allowedTypes.join(", ")}`,
          });
        }

        const allowedCountries = ["BR", "AR", "CL", "PE", "UY"];
        if (!country || !allowedCountries.includes(country)) {
          return res.status(400).json({
            message: `País de origem inválido. Use: ${allowedCountries.join(", ")}`,
          });
        }

        if (description && String(description).length > 200) {
          return res.status(400).json({
            message: "Observação deve ter no máximo 200 caracteres",
          });
        }

        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) {
          return res.status(400).json({ message: "Imagem do comprovante é obrigatória (campo: photoFile)" });
        }

        const [settlement] = await db
          .select()
          .from(expenseSettlements)
          .where(eq(expenseSettlements.id, settlementId))
          .limit(1);

        if (!settlement) {
          return res.status(404).json({ message: "Prestação de contas não encontrada" });
        }

        if (settlement.driverId !== driver.id) {
          return res.status(403).json({
            message: "Esta prestação de contas não pertence a este motorista",
          });
        }

        const countryToCurrency: Record<string, string> = {
          BR: "BRL",
          AR: "ARS",
          CL: "CLP",
          PE: "PEN",
          UY: "UYU",
        };
        const finalCurrency = currency || countryToCurrency[country] || "BRL";

        const item = await storage.createExpenseSettlementItem({
          settlementId,
          type,
          country,
          currency: finalCurrency,
          amount: amount ? String(amount) : "0",
          description: description || null,
          photoUrl: `/uploads/${file.filename}`,
        } as any);

        res.status(201).json(item);
      } catch (error: any) {
        console.error("Error adding expense item:", error);
        res.status(500).json({ message: error.message || "Erro ao adicionar despesa" });
      }
    },
  );

  // ============== FINALIZAR ENVIO DA PRESTAÇÃO DE CONTAS (APP MOBILE) ==============

  app.post(
    "/api/external/driver/expense-settlements/:settlementId/finalize",
    isAuthenticatedJWT,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = req.user!;
        const driverEmail = (user as any).email as string | null;
        if (!driverEmail) {
          return res.status(404).json({ message: "Usuário sem e-mail vinculado" });
        }

        const [driver] = await db.select().from(drivers).where(eq(drivers.email, driverEmail)).limit(1);
        if (!driver) {
          return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
        }

        const settlementId = req.params.settlementId;

        const [settlement] = await db
          .select()
          .from(expenseSettlements)
          .where(eq(expenseSettlements.id, settlementId))
          .limit(1);

        if (!settlement) {
          return res.status(404).json({ message: "Prestação de contas não encontrada" });
        }
        if (settlement.driverId !== driver.id) {
          return res.status(403).json({ message: "Esta prestação de contas não pertence ao motorista autenticado" });
        }
        if (settlement.driverFinishedSubmissionAt) {
          return res.status(400).json({
            message: "Envio já foi finalizado anteriormente",
            driverFinishedSubmissionAt: settlement.driverFinishedSubmissionAt,
          });
        }
        if (settlement.status !== "pendente" && settlement.status !== "devolvido") {
          return res.status(400).json({
            message: `Não é possível finalizar uma prestação com status "${settlement.status}". Status permitidos: pendente, devolvido.`,
          });
        }

        const result = await db.transaction(async (tx) => {
          const items = await tx
            .select()
            .from(expenseSettlementItems)
            .where(eq(expenseSettlementItems.settlementId, settlementId));

          if (items.length === 0) {
            throw new Error("EMPTY_ITEMS");
          }

          const totalExpenses = items.reduce(
            (sum, it) => sum + (parseFloat(it.amount || "0") || 0),
            0,
          );
          const advance = parseFloat(settlement.advanceAmount || "0") || 0;
          const balance = totalExpenses - advance;

          const now = new Date();
          const [updated] = await tx
            .update(expenseSettlements)
            .set({
              status: "enviado",
              driverFinishedSubmissionAt: now,
              submittedAt: settlement.submittedAt ?? now,
              totalExpenses: totalExpenses.toFixed(2),
              balanceAmount: balance.toFixed(2),
            })
            .where(eq(expenseSettlements.id, settlementId))
            .returning();

          return { updated, itemsCount: items.length };
        }).catch((err: any) => {
          if (err?.message === "EMPTY_ITEMS") return null;
          throw err;
        });

        if (!result) {
          return res.status(400).json({
            message: "Não é possível finalizar uma prestação sem despesas lançadas",
          });
        }

        res.json({
          id: result.updated.id,
          status: result.updated.status,
          statusLabel: "Aguardando Análise",
          driverFinishedSubmissionAt: result.updated.driverFinishedSubmissionAt,
          submittedAt: result.updated.submittedAt,
          totalExpenses: result.updated.totalExpenses,
          advanceAmount: result.updated.advanceAmount,
          balanceAmount: result.updated.balanceAmount,
          itemsCount: result.itemsCount,
          message: "Envio finalizado com sucesso. A prestação está aguardando análise do financeiro.",
        });
      } catch (error: any) {
        console.error("Error finalizing expense settlement:", error);
        res.status(500).json({ message: error.message || "Erro ao finalizar envio da prestação de contas" });
      }
    },
  );

  // ============== CHECK-IN NO TRANSPORTE (APP MOBILE) ==============

  app.post("/api/external/transports/:id/checkin", isAuthenticatedJWT, (req, res, next) => {
    upload.fields([
      { name: "frontalPhotoFile", maxCount: 1 },
      { name: "lateral1PhotoFile", maxCount: 1 },
      { name: "lateral2PhotoFile", maxCount: 1 },
      { name: "traseiraPhotoFile", maxCount: 1 },
      { name: "odometerPhotoFile", maxCount: 1 },
      { name: "fuelLevelPhotoFile", maxCount: 1 },
      { name: "selfiePhotoFile", maxCount: 1 },
      { name: "damagePhotoFiles", maxCount: 10 },
      { name: "interiorPhotoFiles", maxCount: 10 },
    ])(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message || "Erro no upload de arquivo" });
      next();
    });
  }, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;
      if (!driverEmail) return res.status(404).json({ message: "Usuário sem e-mail vinculado" });

      const [driver] = await db.select().from(drivers).where(eq(drivers.email, driverEmail)).limit(1);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado para este usuário" });

      // Motorista inapto NÃO pode iniciar (check-in) novo transporte
      if (driver.isApto !== "true" || driver.isActive !== "true") {
        return res.status(403).json({ error: "driver_not_apt", message: INAPTO_MSG });
      }

      const transportId = req.params.id;
      const existingTransport = await storage.getTransport(transportId);
      if (!existingTransport) return res.status(404).json({ message: "Transporte não encontrado" });
      if (existingTransport.driverId !== driver.id) return res.status(403).json({ message: "Este transporte não pertence ao motorista autenticado" });
      if (existingTransport.checkinDateTime) return res.status(400).json({ message: "Check-in já realizado neste transporte" });
      if (existingTransport.status === "cancelado") return res.status(400).json({ message: "Transporte cancelado não permite check-in" });
      if (existingTransport.status === "entregue") return res.status(400).json({ message: "Transporte já entregue" });

      const { latitude, longitude, notes } = req.body;
      const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const frontalPhoto = files?.frontalPhotoFile?.[0] ? `/uploads/${files.frontalPhotoFile[0].filename}` : undefined;
      const lateral1Photo = files?.lateral1PhotoFile?.[0] ? `/uploads/${files.lateral1PhotoFile[0].filename}` : undefined;
      const lateral2Photo = files?.lateral2PhotoFile?.[0] ? `/uploads/${files.lateral2PhotoFile[0].filename}` : undefined;
      const traseiraPhoto = files?.traseiraPhotoFile?.[0] ? `/uploads/${files.traseiraPhotoFile[0].filename}` : undefined;
      const odometerPhoto = files?.odometerPhotoFile?.[0] ? `/uploads/${files.odometerPhotoFile[0].filename}` : undefined;
      const fuelLevelPhoto = files?.fuelLevelPhotoFile?.[0] ? `/uploads/${files.fuelLevelPhotoFile[0].filename}` : undefined;
      const selfiePhoto = files?.selfiePhotoFile?.[0] ? `/uploads/${files.selfiePhotoFile[0].filename}` : undefined;
      const damagePhotos = files?.damagePhotoFiles?.map((f: Express.Multer.File) => `/uploads/${f.filename}`) ?? [];
      const interiorPhotos = files?.interiorPhotoFiles?.map((f: Express.Multer.File) => `/uploads/${f.filename}`) ?? [];

      const updated = await storage.updateTransport(transportId, {
        checkinDateTime: new Date(),
        checkinLocation: latitude && longitude ? { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] } : null,
        checkinFrontalPhoto: frontalPhoto,
        checkinLateral1Photo: lateral1Photo,
        checkinLateral2Photo: lateral2Photo,
        checkinTraseiraPhoto: traseiraPhoto,
        checkinOdometerPhoto: odometerPhoto,
        checkinFuelLevelPhoto: fuelLevelPhoto,
        checkinDamagePhotos: damagePhotos,
        checkinInteriorPhotos: interiorPhotos,
        checkinSelfiePhoto: selfiePhoto,
        checkinNotes: notes || null,
        status: "aguardando_saida",
      });

      await storage.updateVehicle(existingTransport.vehicleChassi, { status: "despachado" });

      try {
        const [existingSettlement] = await db
          .select()
          .from(expenseSettlements)
          .where(eq(expenseSettlements.transportId, transportId))
          .limit(1);

        if (!existingSettlement) {
          let advanceAmount: string | null = null;
          const [proposalItem] = await db
            .select()
            .from(transportProposalItems)
            .where(eq(transportProposalItems.transportId, transportId));
          if (proposalItem) {
            const [proposal] = await db
              .select()
              .from(transportProposals)
              .where(eq(transportProposals.id, proposalItem.proposalId));
            if (proposal?.advanceAmount) advanceAmount = String(proposal.advanceAmount);
          }

          await storage.createExpenseSettlement({
            transportId,
            driverId: driver.id,
            status: "pendente",
            advanceAmount,
            routeDistance: existingTransport.routeDistanceKm ? `${existingTransport.routeDistanceKm} km` : null,
            estimatedTolls: existingTransport.estimatedTolls || null,
            estimatedFuel: existingTransport.estimatedFuel || null,
          } as any);
        }
      } catch (settlementErr) {
        console.error("Error auto-creating expense settlement on check-in:", settlementErr);
      }

      const [row] = await db
        .select({
          id: transports.id,
          requestNumber: transports.requestNumber,
          status: transports.status,
          checkinDateTime: transports.checkinDateTime,
          originName: yards.name,
          originCity: yards.city,
          originState: yards.state,
          destinationName: deliveryLocations.name,
          destinationCity: deliveryLocations.city,
          destinationState: deliveryLocations.state,
        })
        .from(transports)
        .leftJoin(yards, eq(transports.originYardId, yards.id))
        .leftJoin(deliveryLocations, eq(transports.deliveryLocationId, deliveryLocations.id))
        .where(eq(transports.id, transportId))
        .limit(1);

      const [settlement] = await db
        .select()
        .from(expenseSettlements)
        .where(eq(expenseSettlements.transportId, transportId))
        .limit(1);

      let expensesPayload: any = null;
      if (settlement) {
        const items = await db
          .select()
          .from(expenseSettlementItems)
          .where(eq(expenseSettlementItems.settlementId, settlement.id))
          .orderBy(desc(expenseSettlementItems.createdAt));

        const totalAmount = items.reduce(
          (sum, it) => sum + parseFloat(it.amount || "0"),
          0,
        );

        expensesPayload = {
          settlementId: settlement.id,
          status: settlement.status,
          advanceAmount: settlement.advanceAmount,
          totalExpenses: settlement.totalExpenses ?? totalAmount.toFixed(2),
          balanceAmount: settlement.balanceAmount,
          items: items.map((it) => ({
            id: it.id,
            type: it.type,
            description: it.description,
            currency: it.currency,
            amount: it.amount,
            photoUrl: it.photoUrl,
            photoStatus: it.photoStatus,
            photoRejectionReason: it.photoRejectionReason,
            itemStatus: it.itemStatus,
            approvedAmount: it.approvedAmount,
            createdAt: it.createdAt,
          })),
        };
      }

      res.json({
        id: row.id,
        requestNumber: row.requestNumber,
        origin: row.originName
          ? {
              name: row.originName,
              city: row.originCity,
              state: row.originState,
            }
          : null,
        destination: row.destinationName
          ? {
              name: row.destinationName,
              city: row.destinationCity,
              state: row.destinationState,
            }
          : null,
        status: row.status,
        checkinDateTime: row.checkinDateTime,
        expenses: expensesPayload,
      });
    } catch (error: any) {
      console.error("Error performing external transport check-in:", error);
      res.status(500).json({ message: error.message || "Erro ao realizar check-in" });
    }
  });

  // ============== CHECK-OUT NO TRANSPORTE (APP MOBILE) ==============

  app.post("/api/external/transports/:id/checkout", isAuthenticatedJWT, (req, res, next) => {
    upload.fields([
      { name: "frontalPhotoFile", maxCount: 1 },
      { name: "lateral1PhotoFile", maxCount: 1 },
      { name: "lateral2PhotoFile", maxCount: 1 },
      { name: "traseiraPhotoFile", maxCount: 1 },
      { name: "odometerPhotoFile", maxCount: 1 },
      { name: "fuelLevelPhotoFile", maxCount: 1 },
      { name: "selfiePhotoFile", maxCount: 1 },
      { name: "damagePhotoFiles", maxCount: 10 },
      { name: "interiorPhotoFiles", maxCount: 10 },
    ])(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message || "Erro no upload de arquivo" });
      next();
    });
  }, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;
      if (!driverEmail) return res.status(404).json({ message: "Usuário sem e-mail vinculado" });

      const [driver] = await db.select().from(drivers).where(eq(drivers.email, driverEmail)).limit(1);
      if (!driver) return res.status(404).json({ message: "Motorista não encontrado para este usuário" });

      const transportId = req.params.id;
      const existingTransport = await storage.getTransport(transportId);
      if (!existingTransport) return res.status(404).json({ message: "Transporte não encontrado" });
      if (existingTransport.driverId !== driver.id) return res.status(403).json({ message: "Este transporte não pertence ao motorista autenticado" });
      if (!existingTransport.checkinDateTime) return res.status(400).json({ message: "Check-in deve ser realizado antes do check-out" });
      if (existingTransport.status === "entregue") return res.status(400).json({ message: "Transporte já foi entregue" });
      if (existingTransport.status === "cancelado") return res.status(400).json({ message: "Transporte cancelado não permite check-out" });

      const { latitude, longitude, notes } = req.body;
      const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const frontalPhoto = files?.frontalPhotoFile?.[0] ? `/uploads/${files.frontalPhotoFile[0].filename}` : undefined;
      const lateral1Photo = files?.lateral1PhotoFile?.[0] ? `/uploads/${files.lateral1PhotoFile[0].filename}` : undefined;
      const lateral2Photo = files?.lateral2PhotoFile?.[0] ? `/uploads/${files.lateral2PhotoFile[0].filename}` : undefined;
      const traseiraPhoto = files?.traseiraPhotoFile?.[0] ? `/uploads/${files.traseiraPhotoFile[0].filename}` : undefined;
      const odometerPhoto = files?.odometerPhotoFile?.[0] ? `/uploads/${files.odometerPhotoFile[0].filename}` : undefined;
      const fuelLevelPhoto = files?.fuelLevelPhotoFile?.[0] ? `/uploads/${files.fuelLevelPhotoFile[0].filename}` : undefined;
      const selfiePhoto = files?.selfiePhotoFile?.[0] ? `/uploads/${files.selfiePhotoFile[0].filename}` : undefined;
      const damagePhotos = files?.damagePhotoFiles?.map((f: Express.Multer.File) => `/uploads/${f.filename}`) ?? [];
      const interiorPhotos = files?.interiorPhotoFiles?.map((f: Express.Multer.File) => `/uploads/${f.filename}`) ?? [];

      const updated = await storage.updateTransport(transportId, {
        checkoutDateTime: new Date(),
        checkoutLocation: latitude && longitude ? { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] } : null,
        checkoutFrontalPhoto: frontalPhoto,
        checkoutLateral1Photo: lateral1Photo,
        checkoutLateral2Photo: lateral2Photo,
        checkoutTraseiraPhoto: traseiraPhoto,
        checkoutOdometerPhoto: odometerPhoto,
        checkoutFuelLevelPhoto: fuelLevelPhoto,
        checkoutDamagePhotos: damagePhotos,
        checkoutInteriorPhotos: interiorPhotos,
        checkoutSelfiePhoto: selfiePhoto,
        checkoutNotes: notes || null,
        status: "entregue",
      });

      await storage.updateVehicle(existingTransport.vehicleChassi, { status: "entregue" });

      res.json({ message: "Check-out realizado com sucesso", transport: updated });
    } catch (error: any) {
      console.error("Error performing external transport check-out:", error);
      res.status(500).json({ message: error.message || "Erro ao realizar check-out" });
    }
  });

  // ============== FINALIZAR COLETA (APP MOBILE) ==============

  // ============== CRIAÇÃO DE COLETA / TRANSFERÊNCIA (APP DO MOTORISTA) ==============

  app.post("/api/external/collects", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;

      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado — não é possível identificar o motorista" });
      }

      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }

      // Motorista inapto NÃO pode criar/iniciar nova coleta
      if (driver.isApto !== "true" || driver.isActive !== "true") {
        return res.status(403).json({ error: "driver_not_apt", message: INAPTO_MSG });
      }

      const rawData = { ...req.body };
      rawData.driverId = driver.id; // sempre usa o motorista autenticado
      if (rawData.manufacturerId === "") rawData.manufacturerId = null;
      if (rawData.originYardId === "") rawData.originYardId = null;

      const data = insertCollectSchema.parse(rawData);

      // Validate by type
      if (data.collectType === "coleta" && !data.manufacturerId) {
        return res.status(400).json({ message: "Montadora é obrigatória para coletas." });
      }
      if (data.collectType === "transferencia" && !data.originYardId) {
        return res.status(400).json({ message: "Pátio de origem é obrigatório para transferências." });
      }
      if (data.collectType === "transferencia" && data.originYardId === data.yardId) {
        return res.status(400).json({ message: "O pátio de origem e o pátio de destino devem ser diferentes." });
      }

      // Check for open collect
      const openCollects = await db
        .select({ id: collects.id })
        .from(collects)
        .where(and(eq(collects.driverId, driver.id), eq(collects.status, "em_transito")))
        .limit(1);

      if (openCollects.length > 0) {
        return res.status(409).json({ message: "Você já possui uma coleta em andamento. Finalize a coleta atual antes de criar uma nova." });
      }

      const existingVehicle = await storage.getVehicle(data.vehicleChassi);

      if (!existingVehicle) {
        if (data.collectType === "coleta") {
          await storage.createVehicle({
            chassi: data.vehicleChassi,
            manufacturerId: data.manufacturerId,
            yardId: data.yardId,
            status: "pre_estoque",
          });
        } else {
          return res.status(404).json({ message: "Veículo não encontrado no sistema. Transferências só podem ser criadas para veículos já cadastrados." });
        }
      }

      // Auto-populate startLatitude/startLongitude from manufacturer if not provided
      let startLatitude = data.startLatitude;
      let startLongitude = data.startLongitude;
      if ((!startLatitude || !startLongitude) && data.manufacturerId) {
        const [mfrCoords] = await db
          .select({ latitude: manufacturers.latitude, longitude: manufacturers.longitude })
          .from(manufacturers)
          .where(eq(manufacturers.id, data.manufacturerId));
        if (mfrCoords?.latitude && mfrCoords?.longitude) {
          startLatitude = mfrCoords.latitude;
          startLongitude = mfrCoords.longitude;
        }
      }

      const collect = await storage.createCollect({
        ...data,
        startLatitude,
        startLongitude,
        status: "em_transito",
        collectDate: new Date(),
      });

      const [manufacturer] = collect.manufacturerId
        ? await db.select({ id: manufacturers.id, name: manufacturers.name }).from(manufacturers).where(eq(manufacturers.id, collect.manufacturerId))
        : [null];

      const [yard] = collect.yardId
        ? await db.select({ id: yards.id, name: yards.name, city: yards.city, state: yards.state }).from(yards).where(eq(yards.id, collect.yardId))
        : [null];

      const [originYard] = collect.originYardId
        ? await db.select({ id: yards.id, name: yards.name, city: yards.city, state: yards.state }).from(yards).where(eq(yards.id, collect.originYardId))
        : [null];

      const [driverData] = collect.driverId
        ? await db.select({ id: drivers.id, name: drivers.name, phone: drivers.phone, cnhType: drivers.cnhType }).from(drivers).where(eq(drivers.id, collect.driverId))
        : [null];

      res.status(201).json({
        message: "Coleta registrada com sucesso.",
        collect: {
          ...collect,
          manufacturer: manufacturer || null,
          yard: yard || null,
          originYard: originYard || null,
          driver: driverData || null,
        },
      });
    } catch (error: any) {
      console.error("Error creating external collect:", error);
      res.status(400).json({ message: error.message || "Erro ao registrar coleta" });
    }
  });

  app.post("/api/external/collects/:id/finalize", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const collectId = req.params.id;
      const { latitude, longitude } = req.body;

      // Parse GPS from driver if provided; validate only when present
      let endLat: number | null = null;
      let endLng: number | null = null;
      if (latitude && longitude) {
        endLat = parseFloat(latitude);
        endLng = parseFloat(longitude);
        if (isNaN(endLat) || isNaN(endLng) || endLat < -90 || endLat > 90 || endLng < -180 || endLng > 180) {
          return res.status(400).json({ message: "Latitude ou longitude inválida" });
        }
      }

      const [collect] = await db
        .select()
        .from(collects)
        .where(eq(collects.id, collectId))
        .limit(1);

      if (!collect) {
        return res.status(404).json({ message: "Coleta não encontrada" });
      }

      if (collect.status === "finalizada") {
        return res.status(409).json({ message: "Esta coleta já foi finalizada" });
      }

      if (collect.status !== "autorizado_portaria" && collect.status !== "em_transito") {
        return res.status(409).json({ message: `Coleta não pode ser finalizada no status atual: ${collect.status}. A coleta precisa estar com status "Autorizado Portaria" ou "Em Trânsito".` });
      }

      // req.user is the full DB User object (set by isAuthenticatedJWT)
      // user.email is the real email from the database
      const driverEmail = (user as any).email as string | null;

      const [driver] = driverEmail
        ? await db.select().from(drivers).where(eq(drivers.email, driverEmail)).limit(1)
        : [];

      if (!driver || driver.id !== collect.driverId) {
        return res.status(403).json({
          message: "Você não tem permissão para finalizar esta coleta",
          detail: `Motorista autenticado${driver ? ` (${driver.name})` : ""} não é o responsável por esta coleta`,
        });
      }

      // Fall back to destination yard coordinates if driver did not send GPS
      if (endLat === null || endLng === null) {
        if (collect.yardId) {
          const [yard] = await db
            .select({ latitude: yards.latitude, longitude: yards.longitude })
            .from(yards)
            .where(eq(yards.id, collect.yardId));
          if (yard?.latitude && yard?.longitude) {
            endLat = parseFloat(yard.latitude);
            endLng = parseFloat(yard.longitude);
          }
        }
      }

      await db
        .update(collects)
        .set({
          status: "finalizada",
          endLatitude: endLat !== null ? String(endLat) : null,
          endLongitude: endLng !== null ? String(endLng) : null,
          // Preserve the portaria authorization timestamp if already set; only stamp now if not set
          ...(collect.checkoutDateTime ? {} : { checkoutDateTime: new Date() }),
        })
        .where(eq(collects.id, collectId));

      // Update vehicle to em_estoque when collect is finalized by driver app
      const vehicle = await storage.getVehicle(collect.vehicleChassi);
      if (vehicle && (vehicle.status === "pre_estoque" || vehicle.status === "em_transferencia")) {
        await storage.updateVehicle(collect.vehicleChassi, {
          status: "em_estoque",
          yardId: collect.yardId,
          yardEntryDateTime: new Date(),
        });
      }

      const [updatedCollect] = await db
        .select()
        .from(collects)
        .where(eq(collects.id, collectId))
        .limit(1);

      res.json({
        message: "Coleta finalizada com sucesso.",
        collect: updatedCollect,
      });
    } catch (error) {
      console.error("Error finalizing collect:", error);
      res.status(500).json({ message: "Erro ao finalizar coleta" });
    }
  });

  // ============== TOKENS DE DISPOSITIVO (FCM) - APP DO MOTORISTA ==============

  /**
   * POST /api/external/driver/device-token
   * Define o token FCM do motorista autenticado (substitui qualquer token anterior).
   * Body: { token: string }
   * Retorna: { message, deviceToken: string }
   */
  app.post("/api/external/driver/device-token", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;
      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado" });
      }

      const { token } = req.body;
      if (!token || typeof token !== "string" || token.trim().length === 0) {
        return res.status(400).json({ message: "Token FCM é obrigatório" });
      }
      const fcmToken = token.trim();

      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }

      await db
        .update(drivers)
        .set({ deviceToken: fcmToken } as any)
        .where(eq(drivers.id, driver.id));

      return res.json({ message: "Token registrado com sucesso", deviceToken: fcmToken });
    } catch (error: any) {
      console.error("Error setting device token:", error);
      res.status(500).json({ message: "Erro ao registrar token de dispositivo" });
    }
  });

  /**
   * DELETE /api/external/driver/device-token
   * Remove o token FCM do motorista autenticado (ex: ao fazer logout).
   * Retorna: { message }
   */
  app.delete("/api/external/driver/device-token", isAuthenticatedJWT, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const driverEmail = (user as any).email as string | null;
      if (!driverEmail) {
        return res.status(404).json({ message: "Usuário sem e-mail vinculado" });
      }

      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.email, driverEmail))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado para este usuário" });
      }

      await db
        .update(drivers)
        .set({ deviceToken: null } as any)
        .where(eq(drivers.id, driver.id));

      return res.json({ message: "Token removido com sucesso" });
    } catch (error: any) {
      console.error("Error removing device token:", error);
      res.status(500).json({ message: "Erro ao remover token de dispositivo" });
    }
  });

  // ============== MODELOS DE VEÍCULO - ENDPOINT PÚBLICO ==============

  app.get("/api/external/vehicle-models", async (req, res) => {
    try {
      const models = await db
        .select({
          id: truckModels.id,
          brand: truckModels.brand,
          model: truckModels.model,
          axleConfig: truckModels.axleConfig,
        })
        .from(truckModels)
        .where(eq(truckModels.isActive, "true"))
        .orderBy(truckModels.brand, truckModels.model);
      res.json(models);
    } catch (error) {
      console.error("Error fetching vehicle models:", error);
      res.status(500).json({ message: "Erro ao buscar modelos de veículos" });
    }
  });

  // ============== MODELOS DE CAMINHÃO (Truck Models) ==============

  app.get("/api/truck-models", isAuthenticatedJWT, async (req, res) => {
    try {
      const models = await db.select().from(truckModels).orderBy(truckModels.brand);
      res.json(models);
    } catch (error) {
      console.error("Error fetching truck models:", error);
      res.status(500).json({ message: "Failed to fetch truck models" });
    }
  });

  app.post("/api/truck-models", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertTruckModelSchema.parse(req.body);
      const [model] = await db.insert(truckModels).values(data).returning();
      res.status(201).json(model);
    } catch (error) {
      console.error("Error creating truck model:", error);
      res.status(500).json({ message: "Failed to create truck model" });
    }
  });

  app.patch("/api/truck-models/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(truckModels)
        .set(req.body)
        .where(eq(truckModels.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Model not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating truck model:", error);
      res.status(500).json({ message: "Failed to update truck model" });
    }
  });

  app.delete("/api/truck-models/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(truckModels).where(eq(truckModels.id, id));
      res.json({ message: "Model deleted" });
    } catch (error) {
      console.error("Error deleting truck model:", error);
      res.status(500).json({ message: "Failed to delete truck model" });
    }
  });

  // ==================== AI INFO - TRUCK MODELS ====================
  app.post("/api/truck-models/ai-info", isAuthenticatedJWT, async (req, res) => {
    try {
      const { brand, model, axleConfig } = req.body;
      if (!brand || !model) {
        return res.status(400).json({ message: "brand e model são obrigatórios" });
      }

      const dbKeyRow = await db.select().from(appSettings).where(eq(appSettings.key, "openai_api_key"));
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || dbKeyRow[0]?.value;
      if (!apiKey) {
        return res.status(503).json({ message: "Chave OpenAI não configurada. Configure em Integrações." });
      }

      const openai = new OpenAI({
        apiKey,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const prompt = `Você é um especialista técnico em caminhões pesados. Forneça informações detalhadas sobre o caminhão ${brand} ${model} (configuração de eixo: ${axleConfig || "não informado"}) em formato JSON.

Responda APENAS com um JSON válido com a seguinte estrutura:
{
  "technicalDetails": {
    "engine": "Motor (descrição completa)",
    "power": "Potência em cv/kW",
    "torque": "Torque em Nm",
    "transmission": "Câmbio",
    "axleConfig": "Configuração de eixo",
    "gvw": "PBT (Peso Bruto Total)",
    "payload": "Capacidade de carga",
    "fuelType": "Tipo de combustível",
    "emissionStandard": "Norma de emissão (PROCONVE)",
    "wheelbase": "Entre-eixos",
    "cabType": "Tipo de cabine",
    "year": "Ano de produção / período"
  },
  "generalInfo": {
    "overview": "Descrição geral do veículo em 3-4 frases",
    "applications": ["Aplicação 1", "Aplicação 2", "Aplicação 3"],
    "differentials": ["Diferencial 1", "Diferencial 2", "Diferencial 3"],
    "targetMarket": "Mercado-alvo",
    "competitorModels": ["Concorrente 1", "Concorrente 2"]
  },
  "consumption": {
    "averageHighway": "Consumo médio em rodovia (km/l)",
    "averageUrban": "Consumo médio urbano (km/l)",
    "averageMixed": "Consumo médio misto (km/l)",
    "adBlueConsumption": "Consumo de ARLA 32",
    "fuelTankCapacity": "Capacidade do tanque de combustível",
    "autonomy": "Autonomia estimada",
    "tips": ["Dica 1 para economizar", "Dica 2", "Dica 3"]
  },
  "chronicProblems": [
    {
      "problem": "Nome do problema",
      "description": "Descrição detalhada",
      "severity": "leve | moderado | grave",
      "affectedComponents": "Componentes afetados",
      "estimatedCost": "Custo estimado de reparo"
    }
  ],
  "images": [
    {
      "angle": "Vista lateral",
      "description": "Descrição técnica da imagem"
    },
    {
      "angle": "Cabine interna",
      "description": "Descrição do interior"
    },
    {
      "angle": "Motor",
      "description": "Descrição do motor"
    }
  ]
}

Responda SOMENTE com o JSON, sem texto adicional.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Resposta vazia da IA");

      const data = JSON.parse(content);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching AI truck info:", error);
      if (error?.status === 401 || error?.code === 'invalid_api_key') {
        return res.status(401).json({ message: "Chave de API inválida. Configure em Integrações." });
      }
      res.status(500).json({ message: "Erro ao buscar informações da IA" });
    }
  });

  // ==================== TARIFAS DE VIAGEM ====================
  app.get("/api/travel-rates", isAuthenticatedJWT, async (req, res) => {
    try {
      const rates = await db.select().from(travelRates).orderBy(desc(travelRates.createdAt));
      res.json(rates);
    } catch (error) {
      console.error("Error fetching travel rates:", error);
      res.status(500).json({ message: "Erro ao buscar tarifas" });
    }
  });

  app.post("/api/travel-rates", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertTravelRateSchema.parse(req.body);
      const [rate] = await db.insert(travelRates).values(data).returning();
      res.status(201).json(rate);
    } catch (error: any) {
      console.error("Error creating travel rate:", error);
      res.status(400).json({ message: error.message || "Erro ao criar tarifa" });
    }
  });

  app.patch("/api/travel-rates/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertTravelRateSchema.partial().parse(req.body);
      const [updated] = await db.update(travelRates).set(data).where(eq(travelRates.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Tarifa não encontrada" });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating travel rate:", error);
      res.status(400).json({ message: error.message || "Erro ao atualizar tarifa" });
    }
  });

  app.delete("/api/travel-rates/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(travelRates).where(eq(travelRates.id, req.params.id));
      res.json({ message: "Tarifa excluída com sucesso" });
    } catch (error) {
      console.error("Error deleting travel rate:", error);
      res.status(500).json({ message: "Erro ao excluir tarifa" });
    }
  });

  // ==================== TRAVEL RATE APPROVERS ====================
  app.get("/api/travel-rate-approvers", isAuthenticatedJWT, async (req, res) => {
    try {
      const approvers = await db
        .select({
          id: travelRateApprovers.id,
          travelRateId: travelRateApprovers.travelRateId,
          userId: travelRateApprovers.userId,
          createdAt: travelRateApprovers.createdAt,
          userName: drizzleSql<string>`COALESCE(NULLIF(TRIM(CONCAT(${users.firstName}, ' ', ${users.lastName})), ''), ${users.username})`,
          userEmail: users.email,
          userUsername: users.username,
          userRole: users.role,
        })
        .from(travelRateApprovers)
        .innerJoin(users, eq(travelRateApprovers.userId, users.id));
      res.json(approvers);
    } catch (error) {
      console.error("Error fetching all approvers:", error);
      res.status(500).json({ message: "Erro ao buscar aprovadores" });
    }
  });

  app.get("/api/travel-rates/:id/approvers", isAuthenticatedJWT, async (req, res) => {
    try {
      const approvers = await db
        .select({
          id: travelRateApprovers.id,
          travelRateId: travelRateApprovers.travelRateId,
          userId: travelRateApprovers.userId,
          createdAt: travelRateApprovers.createdAt,
          userName: drizzleSql<string>`COALESCE(NULLIF(TRIM(CONCAT(${users.firstName}, ' ', ${users.lastName})), ''), ${users.username})`,
          userEmail: users.email,
          userUsername: users.username,
          userRole: users.role,
        })
        .from(travelRateApprovers)
        .innerJoin(users, eq(travelRateApprovers.userId, users.id))
        .where(eq(travelRateApprovers.travelRateId, req.params.id));
      res.json(approvers);
    } catch (error) {
      console.error("Error fetching approvers:", error);
      res.status(500).json({ message: "Erro ao buscar aprovadores" });
    }
  });

  app.post("/api/travel-rates/:id/approvers", isAuthenticatedJWT, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId é obrigatório" });
      const existing = await db
        .select()
        .from(travelRateApprovers)
        .where(and(eq(travelRateApprovers.travelRateId, req.params.id), eq(travelRateApprovers.userId, userId)));
      if (existing.length > 0) return res.status(409).json({ message: "Usuário já é aprovador desta tarifa" });
      const [approver] = await db
        .insert(travelRateApprovers)
        .values({ travelRateId: req.params.id, userId })
        .returning();
      res.json(approver);
    } catch (error) {
      console.error("Error adding approver:", error);
      res.status(500).json({ message: "Erro ao adicionar aprovador" });
    }
  });

  app.delete("/api/travel-rates/:id/approvers/:userId", isAuthenticatedJWT, async (req, res) => {
    try {
      await db
        .delete(travelRateApprovers)
        .where(and(eq(travelRateApprovers.travelRateId, req.params.id), eq(travelRateApprovers.userId, req.params.userId)));
      res.json({ message: "Aprovador removido" });
    } catch (error) {
      console.error("Error removing approver:", error);
      res.status(500).json({ message: "Erro ao remover aprovador" });
    }
  });

  // ==================== FREIGHT QUOTES ====================
  app.get("/api/freight-quotes", isAuthenticatedJWT, async (req, res) => {
    try {
      const quotes = await db.select().from(freightQuotes).orderBy(desc(freightQuotes.createdAt));
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching freight quotes:", error);
      res.status(500).json({ message: "Failed to fetch freight quotes" });
    }
  });

  app.get("/api/freight-quotes/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const [quote] = await db.select().from(freightQuotes).where(eq(freightQuotes.id, req.params.id));
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (error) {
      console.error("Error fetching freight quote:", error);
      res.status(500).json({ message: "Failed to fetch freight quote" });
    }
  });

  app.post("/api/freight-quotes", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertFreightQuoteSchema.parse(req.body);
      const [quote] = await db.insert(freightQuotes).values(data).returning();
      res.status(201).json(quote);
    } catch (error) {
      console.error("Error creating freight quote:", error);
      res.status(500).json({ message: "Failed to create freight quote" });
    }
  });

  app.patch("/api/freight-quotes/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { convertedToContractId, convertedAt } = req.body;
      const [updated] = await db
        .update(freightQuotes)
        .set({ convertedToContractId: convertedToContractId ?? null, convertedAt: convertedAt ? new Date(convertedAt) : null })
        .where(eq(freightQuotes.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Quote not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating freight quote:", error);
      res.status(500).json({ message: "Failed to update freight quote" });
    }
  });

  app.delete("/api/freight-quotes/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await db.delete(freightQuotes).where(eq(freightQuotes.id, req.params.id));
      res.json({ message: "Quote deleted" });
    } catch (error) {
      console.error("Error deleting freight quote:", error);
      res.status(500).json({ message: "Failed to delete freight quote" });
    }
  });

  // ==================== FREIGHT CONTRACTS ====================
  app.get("/api/freight-contracts", isAuthenticatedJWT, async (req, res) => {
    try {
      const contracts = await storage.getFreightContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching freight contracts:", error);
      res.status(500).json({ message: "Failed to fetch freight contracts" });
    }
  });

  app.get("/api/freight-contracts/next-number", isAuthenticatedJWT, async (req, res) => {
    try {
      const number = await storage.getNextFreightContractNumber();
      res.json({ contractNumber: number });
    } catch (error) {
      res.status(500).json({ message: "Failed to get next contract number" });
    }
  });

  app.get("/api/freight-contracts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const contract = await storage.getFreightContract(req.params.id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      res.json(contract);
    } catch (error) {
      console.error("Error fetching freight contract:", error);
      res.status(500).json({ message: "Failed to fetch freight contract" });
    }
  });

  app.post("/api/freight-contracts", isAuthenticatedJWT, async (req, res) => {
    try {
      const data = insertFreightContractSchema.parse(req.body);
      const contract = await storage.createFreightContract(data);
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating freight contract:", error);
      res.status(500).json({ message: "Failed to create freight contract" });
    }
  });

  app.patch("/api/freight-contracts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const contract = await storage.updateFreightContract(req.params.id, req.body);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      res.json(contract);
    } catch (error) {
      console.error("Error updating freight contract:", error);
      res.status(500).json({ message: "Failed to update freight contract" });
    }
  });

  app.delete("/api/freight-contracts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      await storage.deleteFreightContract(req.params.id);
      res.json({ message: "Contract deleted" });
    } catch (error) {
      console.error("Error deleting freight contract:", error);
      res.status(500).json({ message: "Failed to delete freight contract" });
    }
  });

  // ============== VOICE TRANSCRIPTION ==============
  app.post("/api/transcribe", isAuthenticatedJWT, async (req, res) => {
    try {
      const { audio } = req.body;
      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ message: "audio (base64) é obrigatório" });
      }
      const { ensureCompatibleFormat, speechToText } = await import("./replit_integrations/audio/client");
      const rawBuffer = Buffer.from(audio, "base64");
      const { buffer, format } = await ensureCompatibleFormat(rawBuffer);
      const text = await speechToText(buffer, format);
      res.json({ text });
    } catch (error: any) {
      console.error("Error in transcribe:", error);
      res.status(500).json({ message: error.message || "Erro ao transcrever áudio" });
    }
  });

  // ============== AI QUERY ==============
  app.post("/api/ai-query", isAuthenticatedJWT, async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ message: "question é obrigatório" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const schemaContext = `
Banco de dados PostgreSQL do sistema OTD Logistics (gestão de logística de veículos). Tabelas disponíveis:

--- MOTORISTAS ---
drivers: id, name, cpf, phone, email, birth_date, cep, address, address_number, complement, neighborhood, city, state,
  driver_type (coleta|transporte), modality (pj|clt|agregado), cnh_type (A|B|C|D|E|AB|AC|AD|AE),
  is_apto (true|false), is_active (true|false), documents_approved (pendente|aprovado|reprovado),
  documents_approved_at, freight_contract_id, registration_source (sistema|app|externo), created_at

--- VEÍCULOS / ESTOQUE ---
vehicles: chassi (PK), model_id→truck_models.id, manufacturer_id→manufacturers.id, color, year,
  status (pre_estoque|em_estoque|em_transferencia|despachado|entregue|retirado),
  yard_id→yards.id, client_id→clients.id, delivery_location_id→delivery_locations.id,
  entry_date, yard_entry_date_time, created_at

--- TRANSPORTES ---
transports: id, request_number (OTD00001…), vehicle_chassi→vehicles.chassi, client_id→clients.id,
  origin_yard_id→yards.id, delivery_location_id→delivery_locations.id, driver_id→drivers.id,
  travel_rate_id→travel_rates.id,
  status (pendente|aguardando_saida|em_transito|entregue|cancelado),
  delivery_date, scheduled_departure, transit_started_at, notes, created_at, created_by_user_id,
  driver_assigned_by_user_id, driver_assigned_at,
  -- Rota calculada:
  route_distance_km, route_duration_minutes, estimated_tolls, estimated_fuel,
  -- Aprovação de tarifa:
  travel_rate_approval_status, travel_rate_approved_by, travel_rate_approved_at, travel_rate_approval_note,
  -- Check-in (retirada no pátio):
  checkin_date_time, checkin_notes,
  checkin_frontal_photo, checkin_lateral1_photo, checkin_lateral2_photo, checkin_traseira_photo,
  checkin_odometer_photo, checkin_fuel_level_photo, checkin_selfie_photo,
  checkin_damage_photos (text[] — array de URLs de fotos de avaria),
  -- Check-out (entrega ao cliente):
  checkout_date_time, checkout_notes,
  checkout_frontal_photo, checkout_lateral1_photo, checkout_lateral2_photo, checkout_traseira_photo,
  checkout_odometer_photo, checkout_fuel_level_photo, checkout_selfie_photo,
  checkout_damage_photos (text[] — array de URLs de fotos de avaria)
-- Avarias: WHERE (checkin_damage_photos IS NOT NULL AND array_length(checkin_damage_photos,1)>0) OR (checkout_damage_photos IS NOT NULL AND array_length(checkout_damage_photos,1)>0)
-- Total de fotos de avaria por transporte: COALESCE(array_length(checkin_damage_photos,1),0)+COALESCE(array_length(checkout_damage_photos,1),0)

--- COLETAS ---
collects: id, driver_id→drivers.id, vehicle_chassi→vehicles.chassi,
  origin_manufacturer_id→manufacturers.id, destination_yard_id→yards.id,
  status (em_transito|finalizada), collect_date, created_at,
  checkin_date_time, checkin_notes, checkin_damage_photos (text[]),
  checkout_date_time, checkout_notes, checkout_damage_photos (text[])

--- PÁTIOS ---
yards: id, name, city, state, cep, address, capacity, manager_name, manager_phone, latitude, longitude, is_active, created_at

--- MONTADORAS ---
manufacturers: id, name, city, state, address, contact_name, contact_phone, is_active, created_at

--- CLIENTES ---
clients: id, name, cnpj, email, phone, city, state, address, created_at

--- LOCAIS DE ENTREGA ---
delivery_locations: id, name, city, state, address, cep, client_id→clients.id, created_at

--- MODELOS DE CAMINHÃO ---
truck_models: id, name, manufacturer_id→manufacturers.id, category, created_at

--- PROPOSTAS DE TRANSPORTE ---
transport_proposals: id, proposal_number, origin_yard_id→yards.id, client_id→clients.id,
  delivery_location_id→delivery_locations.id, travel_rate_id→travel_rates.id,
  start_date, distance_km, total_slots, status (ativa|encerrada|cancelada),
  notes, is_emergency (true|false), estimated_value,
  rate_approval_status, rate_approval_note, rate_approved_at, rate_approved_by,
  advance_amount, advance_method, created_by_user_id, created_at

transport_proposal_items: id, proposal_id→transport_proposals.id, transport_id→transports.id

transport_proposal_drivers: id, proposal_id→transport_proposals.id, driver_id→drivers.id,
  status (pendente|aceito|recusado), responded_at, assigned_transport_id→transports.id,
  rank_justification, case_status (aberto|fechado), case_notes, case_closed_at, created_at

transport_proposal_logs: id, proposal_id, action, description, performed_by, created_at

--- PRESTAÇÃO DE CONTAS (DESPESAS DE VIAGEM) ---
expense_settlements: id, transport_id→transports.id, driver_id→drivers.id,
  status (pendente|enviado|devolvido|aprovado|assinado),
  driver_notes, total_expenses, advance_amount, balance_amount,
  route_distance, estimated_tolls, estimated_fuel,
  submitted_at, reviewed_at, approved_at, signed_at,
  reviewed_by_user_id→system_users.id, return_reason, created_at

expense_settlement_items: id, settlement_id→expense_settlements.id,
  type (pedagio|combustivel|alimentacao|hospedagem|manutencao|multa|estacionamento|lavagem|passagem|outros),
  description, currency (BRL|ARS|CLP|PEN|UYU), amount,
  photo_url, photo_status (ok|borrada|ilegivel), photo_rejection_reason,
  item_status (pendente|aprovado|reprovado), approved_amount, created_at

--- AVALIAÇÕES DE MOTORISTAS ---
driver_evaluations: id, transport_id→transports.id, driver_id→drivers.id,
  evaluator_id, evaluator_name,
  postura_profissional, pontualidade, apresentacao_pessoal, cordialidade, cumpriu_processo
    (cada um: otimo|bom|regular|ruim|pessimo),
  had_incident (true|false), incident_description,
  average_score (0-100), weighted_score (0-100), status (em_andamento|finalizado), created_at

evaluation_criteria: id, name, description, weight (0-100), is_active, created_at

evaluation_scores: id, evaluation_id→driver_evaluations.id, criteria_id→evaluation_criteria.id,
  score (0-100), severity (sem_ocorrencia|leve|medio|grave), notes, created_at

--- GESTÃO DE ROTAS ---
routes: id, name,
  origin_yard_id→yards.id, destination_location_id→delivery_locations.id,
  distance_km, truck_type,
  diesel_price, fuel_consumption, fuel_cost, arla32_cost, toll_cost,
  driver_daily_cost, return_ticket, extra_expenses, food_cost, others_cost,
  ad_valorem_percentage, vehicle_value, ad_valorem_cost,
  profit_margin_percentage, admin_fee,
  total_cost, suggested_price, net_profit,
  is_favorite (true|false), is_active (true|false), created_at, updated_at

--- TARIFAS DE VIAGEM ---
travel_rates: id, name, origin_city, origin_state, destination_city, destination_state,
  rate_type (por_km|fixo|por_veiculo), rate_value, min_distance, max_distance,
  vehicle_type, notes, is_active (true|false), requires_approval (true|false), created_at

--- CONTRATOS ---
contracts: id, contract_number, title, driver_id→drivers.id,
  contract_type (pj|clt|agregado), status (ativo|suspenso|expirado|cancelado),
  start_date, end_date, payment_type (por_km|fixo_mensal|por_entrega|comissao), payment_value,
  truck_type, license_plate, cnh_required, work_region, notes,
  autentique_status, autentique_sent_at, driver_signed_at, created_at

freight_contracts: id, name, base_rate, rate_per_km, valid_from, valid_until, is_active, created_at

--- TRANSFERÊNCIAS ENTRE PÁTIOS ---
transfers: id, vehicle_chassi, origin_yard_id→yards.id, destination_yard_id→yards.id,
  driver_id→drivers.id, status (pendente|autorizada|em_transito|concluida|cancelada),
  authorized_at, completed_at, notes, created_at

--- CHECKPOINTS DE ROTA ---
checkpoints: id, name, address, city, state, latitude, longitude, is_active, created_at

transport_checkpoints: id, transport_id→transports.id, checkpoint_id→checkpoints.id,
  order_index, status (pendente|alcancado|concluido), reached_at, latitude, longitude

--- COTAÇÕES DE FRETE ---
freight_quotes: id, origin, destination, distance_km, weight_kg, vehicle_type, quote_value, status, created_at

--- FECHAMENTO MENSAL DE PÁTIO ---
yard_monthly_invoices: id, client_id, client_name, reference_month, reference_year,
  total_value, status (pending|paid|cancelled), payment_date, notes, generated_at

yard_monthly_invoice_items: id, invoice_id→yard_monthly_invoices.id, chassi, yard_name,
  entry_date, total_days_in_patio, days_in_period, grace_days_applied, billable_days,
  daily_cost, subtotal

--- MENSAGENS (BROADCAST) ---
broadcasts: id, title, message, severity (info|alerta|urgente|critico),
  total_sent, created_by_user_id, created_at

broadcast_recipients: id, broadcast_id→broadcasts.id, driver_id→drivers.id,
  sent_at, received_at, read_at

--- USUÁRIOS DO SISTEMA ---
system_users: id, email, username, first_name, last_name,
  role (admin|operador|visualizador|motorista|portaria), is_active, created_at

--- NOTIFICAÇÕES DO MOTORISTA ---
driver_notifications: id, driver_id→drivers.id, title, message, type, status (pendente|enviado|lido|erro), created_at

IMPORTANTE:
- Não existe tabela chamada "damage_photos" — fotos de avaria são arrays text[] (checkin_damage_photos, checkout_damage_photos) nas tabelas transports e collects.
- Campos booleanos como is_active, is_apto, had_incident, is_emergency são armazenados como text ('true'/'false'), não como boolean.
- Sempre retorne apenas consultas SELECT. Nunca use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER.
- Para datas use DATE_TRUNC, EXTRACT, TO_CHAR do PostgreSQL.
- Use JOINs quando precisar de dados de múltiplas tabelas.
- Prefira aliases legíveis nas colunas (AS "Nome da Coluna").
- Para campos numéricos armazenados como text, use CAST(campo AS numeric) antes de somar/comparar.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: `Você é um analista de dados especialista em SQL PostgreSQL para o sistema OTD Logistics.
Dado o schema do banco e uma pergunta em português, gere uma consulta SQL válida.
Responda SOMENTE com JSON no formato: { "sql": "SELECT ...", "chartType": "bar"|"line"|"pie"|"table"|"kpi" }
- Use "kpi" quando a resposta for um único valor numérico agregado
- Use "bar" para comparações entre categorias
- Use "line" para tendências ao longo do tempo
- Use "pie" para distribuições percentuais
- Use "table" para listagens detalhadas com muitas colunas
Não inclua explicações, apenas o JSON.`,
          },
          {
            role: "user",
            content: `Schema:\n${schemaContext}\n\nPergunta: ${question}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      });

      const content = completion.choices[0]?.message?.content || "{}";
      let parsed: { sql?: string; chartType?: string };
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(500).json({ message: "Resposta inválida da IA" });
      }

      const generatedSql = parsed.sql?.trim();
      const chartType = parsed.chartType || "table";

      if (!generatedSql) {
        return res.status(400).json({ message: "A IA não gerou SQL para essa pergunta" });
      }

      const sqlUpper = generatedSql.toUpperCase().replace(/\s+/g, " ").trim();
      if (!sqlUpper.startsWith("SELECT")) {
        return res.status(400).json({ message: "Apenas consultas SELECT são permitidas" });
      }

      const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "GRANT", "REVOKE"];
      for (const kw of forbidden) {
        if (sqlUpper.includes(kw)) {
          return res.status(400).json({ message: `SQL contém operação proibida: ${kw}` });
        }
      }

      const result = await db.execute(drizzleSql.raw(generatedSql));
      const rows = result.rows as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      res.json({ sql: generatedSql, columns, rows, chartType });
    } catch (error: any) {
      console.error("Error in ai-query:", error);
      res.status(500).json({ message: error.message || "Erro ao processar consulta IA" });
    }
  });

  // ==================== AUTENTIQUE - ASSINATURA DIGITAL ====================

  // List Autentique documents from the API (live sync)
  app.get("/api/autentique/documents", isAuthenticatedJWT, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const data = await autentique.listDocuments(page, limit);
      const docs = data.documents.data.map((doc: any) => ({
        ...doc,
        computedStatus: autentique.getDocumentStatus(doc),
      }));
      res.json({ total: data.documents.total, data: docs });
    } catch (error: any) {
      console.error("Autentique list error:", error);
      res.status(500).json({ message: error.message || "Erro ao listar documentos Autentique" });
    }
  });

  // Get single Autentique document details
  app.get("/api/autentique/documents/:docId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { docId } = req.params;
      const data = await autentique.getDocument(docId);
      const doc = data.document;
      res.json({ ...doc, computedStatus: autentique.getDocumentStatus(doc) });
    } catch (error: any) {
      console.error("Autentique get document error:", error);
      res.status(500).json({ message: error.message || "Erro ao buscar documento Autentique" });
    }
  });

  // Helper: replace {{variable}} placeholders in contract content with real driver/contract data
  function resolveContractVariables(content: string, contract: any, driver: any | null): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("pt-BR");
    const monthStr = today.toLocaleString("pt-BR", { month: "long" });
    const yearStr = today.getFullYear().toString();

    const contractTypeMap: Record<string, string> = { pj: "PJ", clt: "CLT", agregado: "Agregado" };
    const modalityMap: Record<string, string> = { pj: "PJ", clt: "CLT", agregado: "Agregado" };
    const driverTypeMap: Record<string, string> = { proprio: "Próprio", terceiro: "Terceiro" };

    const formatDate = (d: string | null | undefined) =>
      d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "";

    const vars: Record<string, string> = {
      "{{motorista.nome}}": driver?.name || "",
      "{{motorista.cpf}}": driver?.cpf || "",
      "{{motorista.rg}}": driver?.rg || "",
      "{{motorista.cnpj}}": driver?.cnpj || "",
      "{{motorista.razaoSocial}}": driver?.companyName || "",
      "{{motorista.email}}": driver?.email || "",
      "{{motorista.telefone}}": driver?.phone || "",
      "{{motorista.dataNascimento}}": formatDate(driver?.birthDate),
      "{{motorista.cep}}": driver?.cep || "",
      "{{motorista.endereco}}": driver?.address || "",
      "{{motorista.numero}}": driver?.addressNumber || "",
      "{{motorista.complemento}}": driver?.complement || "",
      "{{motorista.bairro}}": driver?.neighborhood || "",
      "{{motorista.cidade}}": driver?.city || "",
      "{{motorista.estado}}": driver?.state || "",
      "{{motorista.cnh}}": driver?.cnhType || "",
      "{{motorista.tipo}}": driverTypeMap[driver?.driverType] || driver?.driverType || "",
      "{{motorista.modalidade}}": modalityMap[driver?.modality] || driver?.modality || "",
      "{{contrato.numero}}": contract.contractNumber || "",
      "{{contrato.titulo}}": contract.title || "",
      "{{contrato.tipo}}": contractTypeMap[contract.contractType] || contract.contractType || "",
      "{{data.hoje}}": dateStr,
      "{{data.mes}}": monthStr,
      "{{data.ano}}": yearStr,
    };

    let result = content;
    for (const [key, val] of Object.entries(vars)) {
      result = result.split(key).join(val);
    }
    return result;
  }

  // Strip basic HTML tags to get plain text for PDF rendering
  function stripHtml(html: string): string {
    return html
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li>/gi, "\n• ")
      .replace(/<\/li>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  app.post("/api/autentique/send-contract/:contractId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { contractId } = req.params;
      const { signers, message, driverId: requestDriverId } = req.body as {
        signers: autentique.AutentiqueSignerInput[];
        message?: string;
        driverId?: string;
      };

      if (!signers || signers.length === 0) {
        return res.status(400).json({ message: "Informe pelo menos um signatário" });
      }

      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Contrato não encontrado" });

      // Fetch driver: prefer the one explicitly passed in request (selected in dialog),
      // fall back to the one linked on the contract
      let driver = null;
      const resolveDriverId = requestDriverId || contract.driverId;
      if (resolveDriverId) {
        const [foundDriver] = await db.select().from(drivers).where(eq(drivers.id, resolveDriverId));
        driver = foundDriver || null;
      }

      // Resolve variables in content and convert HTML to plain text
      const resolvedHtml = resolveContractVariables(contract.content || "", contract, driver);
      const resolvedText = stripHtml(resolvedHtml);

      // Generate PDF from contract content
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 60 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(18).font("Helvetica-Bold").text("OTD Logistics", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(14).font("Helvetica-Bold").text(contract.title, { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica").text(`Contrato Nº: ${contract.contractNumber}`, { align: "center" });
        doc.moveDown(1.5);

        if (resolvedText) {
          doc.fontSize(11).font("Helvetica").text(resolvedText, { align: "justify", lineGap: 4 });
        } else {
          doc.fontSize(11).font("Helvetica").text("(Sem conteúdo detalhado)", { align: "justify" });
        }

        doc.moveDown(3);
        doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, { align: "right" });
        doc.end();
      });

      const result = await autentique.createDocument({
        name: `${contract.contractNumber} - ${contract.title}`,
        signers,
        message,
        pdfBuffer,
        filename: `contrato-${contract.contractNumber}.pdf`,
      });

      const createdDoc = result.createDocument;
      const computedStatus = autentique.getDocumentStatus(createdDoc);
      const sentAt = new Date();

      // Save Autentique info on the per-driver junction row (creates the link if missing)
      if (resolveDriverId) {
        await storage.upsertContractDriverAutentique(contractId, resolveDriverId, {
          autentiqueDocId: createdDoc.id,
          autentiqueStatus: computedStatus,
          autentiqueOriginalUrl: createdDoc.files?.original || null,
          autentiqueSentAt: sentAt,
        });
      }

      // Mirror on the contracts table too (last-send snapshot for back-compat UIs)
      await db.update(contracts)
        .set({
          autentiqueDocId: createdDoc.id,
          autentiqueStatus: computedStatus,
          autentiqueOriginalUrl: createdDoc.files?.original || null,
          autentiqueSentAt: sentAt,
          ...(resolveDriverId && !contract.driverId ? { driverId: resolveDriverId } : {}),
        })
        .where(eq(contracts.id, contractId));

      res.json({
        message: "Documento enviado ao Autentique com sucesso",
        document: { ...createdDoc, computedStatus },
      });
    } catch (error: any) {
      console.error("Autentique send-contract error:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar contrato ao Autentique" });
    }
  });

  // Send a freight contract to Autentique for digital signature
  app.post("/api/autentique/send-freight-contract/:contractId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { contractId } = req.params;
      const { signers, message } = req.body as {
        signers: autentique.AutentiqueSignerInput[];
        message?: string;
      };

      if (!signers || signers.length === 0) {
        return res.status(400).json({ message: "Informe pelo menos um signatário" });
      }

      const [contract] = await db.select().from(freightContracts).where(eq(freightContracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Contrato de frete não encontrado" });

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 60 });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(18).font("Helvetica-Bold").text("OTD Logistics", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(14).font("Helvetica-Bold").text(`Contrato de Frete`, { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica").text(`Nº: ${contract.contractNumber} | Cliente: ${contract.clientName}`, { align: "center" });
        doc.moveDown(1.5);

        if (contract.content) {
          doc.fontSize(11).font("Helvetica").text(contract.content, { align: "justify", lineGap: 4 });
        } else {
          doc.fontSize(11).font("Helvetica").text("(Sem conteúdo detalhado)", { align: "justify" });
        }

        doc.moveDown(3);
        doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, { align: "right" });
        doc.end();
      });

      const result = await autentique.createDocument({
        name: `${contract.contractNumber} - Contrato de Frete - ${contract.clientName}`,
        signers,
        message,
        pdfBuffer,
        filename: `contrato-frete-${contract.contractNumber}.pdf`,
      });

      const createdDoc = result.createDocument;
      const computedStatus = autentique.getDocumentStatus(createdDoc);

      await db.update(freightContracts)
        .set({
          autentiqueDocId: createdDoc.id,
          autentiqueStatus: computedStatus,
          autentiqueOriginalUrl: createdDoc.files?.original || null,
          autentiqueSentAt: new Date(),
        } as any)
        .where(eq(freightContracts.id, contractId));

      res.json({
        message: "Documento enviado ao Autentique com sucesso",
        document: { ...createdDoc, computedStatus },
      });
    } catch (error: any) {
      console.error("Autentique send-freight-contract error:", error);
      res.status(500).json({ message: error.message || "Erro ao enviar contrato ao Autentique" });
    }
  });

  // Sync status of a specific document from Autentique
  app.post("/api/autentique/sync/:docId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { docId } = req.params;
      const data = await autentique.getDocument(docId);
      const doc = data.document;
      const computedStatus = autentique.getDocumentStatus(doc);

      // Extract the latest signing date from signatures
      const signatures = (doc.signatures || []) as Array<{ signed?: { created_at?: string } | null }>;
      const signedDates = signatures
        .filter((s) => s.signed?.created_at)
        .map((s) => new Date(s.signed!.created_at!));
      const latestSignedAt = signedDates.length > 0
        ? new Date(Math.max(...signedDates.map((d) => d.getTime())))
        : null;

      // Update contracts table if linked
      await db.update(contracts)
        .set({
          autentiqueStatus: computedStatus,
          autentiqueSignedUrl: doc.files?.signed || null,
          ...(computedStatus === "assinado" && latestSignedAt ? { driverSignedAt: latestSignedAt } : {}),
        })
        .where(eq(contracts.autentiqueDocId, docId));

      // Update per-driver junction row (N:N)
      const cdLink = await storage.getContractDriverByDocId(docId);
      if (cdLink) {
        await storage.upsertContractDriverAutentique(cdLink.contractId, cdLink.driverId, {
          autentiqueStatus: computedStatus,
          autentiqueSignedUrl: doc.files?.signed || null,
          ...(computedStatus === "assinado" && latestSignedAt ? { driverSignedAt: latestSignedAt } : {}),
        });
      }

      // Also try freight contracts
      await db.update(freightContracts)
        .set({ autentiqueStatus: computedStatus, autentiqueSignedUrl: doc.files?.signed || null })
        .where(eq(freightContracts.autentiqueDocId, docId));

      res.json({ ...doc, computedStatus });
    } catch (error: any) {
      console.error("Autentique sync error:", error);
      res.status(500).json({ message: error.message || "Erro ao sincronizar documento Autentique" });
    }
  });

  // Resend signature emails
  app.post("/api/autentique/resend/:docId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { docId } = req.params;
      await autentique.resendSignatures(docId);
      res.json({ message: "E-mails de assinatura reenviados com sucesso" });
    } catch (error: any) {
      console.error("Autentique resend error:", error);
      res.status(500).json({ message: error.message || "Erro ao reenviar assinaturas" });
    }
  });

  // Delete a document from Autentique
  app.delete("/api/autentique/documents/:docId", isAuthenticatedJWT, async (req, res) => {
    try {
      const { docId } = req.params;
      await autentique.deleteDocument(docId);
      // Clear Autentique info from contracts
      await db.update(contracts)
        .set({ autentiqueDocId: null, autentiqueStatus: null, autentiqueSignedUrl: null, autentiqueOriginalUrl: null, autentiqueSentAt: null })
        .where(eq(contracts.autentiqueDocId, docId));
      res.json({ message: "Documento excluído do Autentique" });
    } catch (error: any) {
      console.error("Autentique delete error:", error);
      res.status(500).json({ message: error.message || "Erro ao excluir documento Autentique" });
    }
  });

  // ============== API LOGS ==============
  app.get("/api/api-logs", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { method, path: pathFilter, statusCode, username, limit: limitParam, offset: offsetParam } = req.query;
      let query = db.select().from(apiLogs).orderBy(desc(apiLogs.createdAt));

      const conditions: any[] = [];
      if (method) conditions.push(eq(apiLogs.method, method as string));
      if (pathFilter) conditions.push(drizzleSql`${apiLogs.path} ILIKE ${'%' + pathFilter + '%'}`);
      if (statusCode) conditions.push(eq(apiLogs.statusCode, parseInt(statusCode as string)));
      if (username) conditions.push(drizzleSql`${apiLogs.username} ILIKE ${'%' + username + '%'}`);

      const limit = Math.min(parseInt(limitParam as string) || 100, 500);
      const offset = parseInt(offsetParam as string) || 0;

      let finalQuery;
      if (conditions.length > 0) {
        finalQuery = db.select().from(apiLogs).where(and(...conditions)).orderBy(desc(apiLogs.createdAt)).limit(limit).offset(offset);
      } else {
        finalQuery = db.select().from(apiLogs).orderBy(desc(apiLogs.createdAt)).limit(limit).offset(offset);
      }

      const logs = await finalQuery;

      let countQuery;
      if (conditions.length > 0) {
        countQuery = db.select({ count: drizzleSql<number>`count(*)::int` }).from(apiLogs).where(and(...conditions));
      } else {
        countQuery = db.select({ count: drizzleSql<number>`count(*)::int` }).from(apiLogs);
      }
      const [{ count: total }] = await countQuery;

      res.json({ logs, total, limit, offset });
    } catch (error: any) {
      console.error("Error fetching API logs:", error);
      res.status(500).json({ message: "Erro ao buscar logs da API" });
    }
  });

  app.get("/api/api-logs/endpoints", isAuthenticatedJWT, async (req: any, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Acesso restrito a administradores" });
    }
    try {
      const endpoints = await db.select({
        method: apiLogs.method,
        path: apiLogs.path,
        count: drizzleSql<number>`count(*)::int`,
        avgDuration: drizzleSql<number>`round(avg(${apiLogs.durationMs}))::int`,
        lastCall: drizzleSql<string>`max(${apiLogs.createdAt})`,
        errorCount: drizzleSql<number>`count(*) filter (where ${apiLogs.statusCode} >= 400)::int`,
      })
      .from(apiLogs)
      .groupBy(apiLogs.method, apiLogs.path)
      .orderBy(drizzleSql`count(*) desc`)
      .limit(200);

      res.json(endpoints);
    } catch (error: any) {
      console.error("Error fetching endpoint stats:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas de endpoints" });
    }
  });

  app.delete("/api/api-logs", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Somente admins podem limpar logs" });
      }
      await db.delete(apiLogs);
      res.json({ message: "Logs limpos com sucesso" });
    } catch (error: any) {
      console.error("Error clearing API logs:", error);
      res.status(500).json({ message: "Erro ao limpar logs" });
    }
  });

  // =====================
  // BACKUP ROUTES
  // =====================
  app.get("/api/backup/summary", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { getDatabaseSummary } = await import("./backup/backup-service");
      const summary = await getDatabaseSummary();
      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching backup summary:", error);
      res.status(500).json({ message: "Erro ao buscar resumo do banco" });
    }
  });

  app.get("/api/backup/list", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { listBackups } = await import("./backup/backup-service");
      res.json(listBackups());
    } catch (error: any) {
      console.error("Error listing backups:", error);
      res.status(500).json({ message: "Erro ao listar backups" });
    }
  });

  app.post("/api/backup/create", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { type, tables, description } = req.body;
      const validTypes = ["full", "selective"];
      if (type && !validTypes.includes(type)) {
        return res.status(400).json({ message: "Tipo de backup inválido" });
      }
      const { createBackup, getValidTableNames } = await import("./backup/backup-service");
      if (type === "selective") {
        if (!Array.isArray(tables) || tables.length === 0) {
          return res.status(400).json({ message: "Selecione pelo menos uma tabela" });
        }
        const validNames = getValidTableNames();
        const invalid = tables.filter((t: string) => !validNames.includes(t));
        if (invalid.length > 0) {
          return res.status(400).json({ message: `Tabelas inválidas: ${invalid.join(", ")}` });
        }
      }
      const metadata = await createBackup({
        type: type || "full",
        tables,
        createdBy: req.user.username,
        description: typeof description === "string" ? description.slice(0, 200) : undefined,
      });
      res.status(201).json(metadata);
    } catch (error: any) {
      console.error("Error creating backup:", error);
      res.status(500).json({ message: "Erro ao criar backup" });
    }
  });

  app.get("/api/backup/download/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { getBackupFilePath, getBackupMetadata } = await import("./backup/backup-service");
      const filePath = getBackupFilePath(req.params.id);
      if (!filePath) {
        return res.status(404).json({ message: "Backup não encontrado" });
      }
      const backup = getBackupMetadata(req.params.id);
      const isTarGz = backup?.format === "tar.gz" || backup?.filename?.endsWith(".tar.gz");
      const contentType = isTarGz ? "application/gzip" : "application/sql";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename=${backup?.filename ?? "backup.sql"}`);
      res.sendFile(filePath);
    } catch (error: any) {
      console.error("Error downloading backup:", error);
      res.status(500).json({ message: "Erro ao baixar backup" });
    }
  });

  app.delete("/api/backup/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { deleteBackup } = await import("./backup/backup-service");
      const success = deleteBackup(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Backup não encontrado" });
      }
      res.json({ message: "Backup removido com sucesso" });
    } catch (error: any) {
      console.error("Error deleting backup:", error);
      res.status(500).json({ message: "Erro ao remover backup" });
    }
  });

  app.post("/api/backup/restore/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { restoreBackup } = await import("./backup/backup-service");
      const result = await restoreBackup(req.params.id);
      res.json(result);
    } catch (error: any) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ message: error.message || "Erro ao restaurar backup" });
    }
  });

  app.post("/api/backup/cleanup", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const keepCount = Math.max(1, Math.min(50, parseInt(req.body.keepCount) || 5));
      const { cleanOldBackups } = await import("./backup/backup-service");
      const removed = await cleanOldBackups(keepCount);
      res.json({ message: `${removed} backup(s) antigo(s) removido(s)`, removed });
    } catch (error: any) {
      console.error("Error cleaning backups:", error);
      res.status(500).json({ message: "Erro ao limpar backups antigos" });
    }
  });

  app.get("/api/backup/tables", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const { getTableStats } = await import("./backup/backup-service");
      const stats = await getTableStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching table stats:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas das tabelas" });
    }
  });

  // External: list transports assigned to the logged-in driver
  app.get("/api/external/transports/my", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (!req.user?.email) {
        return res.status(401).json({ message: "Usuário não identificado" });
      }

      const [driverRow] = await db.select({ id: drivers.id, name: drivers.name, isApto: drivers.isApto, isActive: drivers.isActive })
        .from(drivers).where(eq(drivers.email, req.user.email)).limit(1);
      if (!driverRow) {
        return res.status(403).json({ message: "Nenhum motorista vinculado a este usuário" });
      }

      // Motorista inapto: lista vazia
      if (driverRow.isApto !== "true" || driverRow.isActive !== "true") {
        return res.json([]);
      }

      // Optional status filter: ?status=pendente,aguardando_saida,em_transito,entregue,cancelado
      // Accepts "em_transporte" as alias for "em_transito" for backwards compatibility
      const statusParam = req.query.status as string | undefined;
      const statusFilter = statusParam
        ? statusParam.split(",").map(s => {
            const v = s.trim();
            return v === "em_transporte" ? "em_transito" : v;
          }).filter(Boolean)
        : null;

      const allTransports = await storage.getTransportsByDriver(driverRow.id);

      const filtered = statusFilter
        ? allTransports.filter(t => statusFilter.includes(t.status ?? ""))
        : allTransports;

      const results = await Promise.all(filtered.map(async (t) => {
        const [vehicle, client, originYard, deliveryLocation, proposalItem] = await Promise.all([
          storage.getVehicle(t.vehicleChassi),
          t.clientId ? storage.getClient(t.clientId) : Promise.resolve(null),
          t.originYardId ? storage.getYard(t.originYardId) : Promise.resolve(null),
          t.deliveryLocationId ? storage.getDeliveryLocation(t.deliveryLocationId) : Promise.resolve(null),
          db.select().from(transportProposalItems).where(eq(transportProposalItems.transportId, t.id)).limit(1).then(r => r[0] ?? null),
        ]);

        // Fetch linked proposal and its travel rate to compute value
        let proposalValue: number | null = null;
        let proposalNumber: string | null = null;
        let proposalId: string | null = null;
        let advanceAmount: number | null = null;
        let advanceMethod: string | null = null;
        let approximateValue: number | null = null;
        if (proposalItem?.proposalId) {
          const proposal = await storage.getTransportProposal(proposalItem.proposalId);
          if (proposal) {
            proposalId = proposal.id;
            proposalNumber = proposal.proposalNumber ?? null;
            advanceAmount = proposal.advanceAmount ? Number(proposal.advanceAmount) : null;
            advanceMethod = proposal.advanceMethod ?? null;
            if (proposal.estimatedValue) {
              proposalValue = Number(proposal.estimatedValue);
            }
            // Always compute approximateValue from distanceKm × travelRate.rateValue
            if (proposal.distanceKm && proposal.travelRateId) {
              const [rate] = await db.select({ rateValue: travelRates.rateValue }).from(travelRates).where(eq(travelRates.id, proposal.travelRateId)).limit(1);
              if (rate) {
                approximateValue = Math.round(Number(proposal.distanceKm) * Number(rate.rateValue) * 100) / 100;
                if (!proposalValue) proposalValue = approximateValue;
              }
            }
          }
        }

        return {
          id: t.id,
          requestNumber: t.requestNumber,
          status: t.status,
          vehicleChassi: t.vehicleChassi,
          vehicle: vehicle ? {
            chassi: vehicle.chassi,
            model: vehicle.model ?? null,
            color: vehicle.color ?? null,
            manufacturerId: vehicle.manufacturerId ?? null,
            year: vehicle.year ?? null,
          } : null,
          client: client ? { id: client.id, name: client.name } : null,
          originYard: originYard ? {
            id: originYard.id,
            name: originYard.name,
            city: originYard.city,
            state: originYard.state,
          } : null,
          deliveryLocation: deliveryLocation ? {
            id: deliveryLocation.id,
            name: deliveryLocation.name,
            city: deliveryLocation.city,
            state: deliveryLocation.state,
          } : null,
          proposal: proposalId ? {
            id: proposalId,
            proposalNumber,
            value: proposalValue,
            approximateValue,
            advanceAmount,
            advanceMethod,
          } : null,
          deliveryDate: t.deliveryDate ?? null,
          scheduledDeparture: t.scheduledDeparture ?? null,
          checkinDateTime: t.checkinDateTime ?? null,
          checkoutDateTime: t.checkoutDateTime ?? null,
          routeDistanceKm: t.routeDistanceKm ? Number(t.routeDistanceKm) : null,
          notes: t.notes ?? null,
          createdAt: t.createdAt,
        };
      }));

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching driver transports (external):", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/external/transports/pending-count — count of pending transports for logged driver
  app.get("/api/external/transports/pending-count", isAuthenticatedJWT, async (req: any, res) => {
    try {
      if (!req.user?.email) {
        return res.status(401).json({ message: "Usuário não identificado" });
      }

      const [driverRow] = await db.select({ id: drivers.id, name: drivers.name, isApto: drivers.isApto, isActive: drivers.isActive })
        .from(drivers).where(eq(drivers.email, req.user.email)).limit(1);
      if (!driverRow) {
        return res.status(403).json({ message: "Nenhum motorista vinculado a este usuário" });
      }

      // Motorista inapto: contagem zero
      if (driverRow.isApto !== "true" || driverRow.isActive !== "true") {
        return res.json({ count: 0, driverId: driverRow.id, driverName: driverRow.name });
      }

      const allTransports = await storage.getTransportsByDriver(driverRow.id);
      const pendingCount = allTransports.filter(t => t.status === "pendente").length;

      res.json({ count: pendingCount, driverId: driverRow.id, driverName: driverRow.name });
    } catch (error: any) {
      console.error("Error fetching pending transport count (external):", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== TRANSPORT PROPOSALS ==========

  app.get("/api/external/transport-proposals/open", isAuthenticatedJWT, async (req: any, res) => {
    try {
      // Identify the logged-in driver by matching their user email to the drivers table
      let loggedDriverId: string | null = null;
      if (req.user?.email) {
        const [driverRow] = await db.select({ id: drivers.id, isApto: drivers.isApto, isActive: drivers.isActive })
          .from(drivers).where(eq(drivers.email, req.user.email)).limit(1);
        loggedDriverId = driverRow?.id ?? null;
        // Motorista inapto não recebe propostas/ofertas de trabalho
        if (driverRow && (driverRow.isApto !== "true" || driverRow.isActive !== "true")) {
          return res.json([]);
        }
      }

      const proposals = await storage.getTransportProposals();
      const results = [];
      for (const p of proposals) {
        if (p.status === "cancelada") continue;
        const [yard, client, deliveryLocation, travelRate, items, driverResponses] = await Promise.all([
          storage.getYard(p.originYardId),
          storage.getClient(p.clientId),
          storage.getDeliveryLocation(p.deliveryLocationId),
          p.travelRateId ? db.select().from(travelRates).where(eq(travelRates.id, p.travelRateId)).then(r => r[0]) : Promise.resolve(null),
          storage.getProposalItems(p.id),
          storage.getProposalDrivers(p.id),
        ]);

        // Skip proposals where the logged-in driver has already accepted
        if (loggedDriverId) {
          const alreadyAccepted = driverResponses.some(d => d.driverId === loggedDriverId && d.status === "aceito");
          if (alreadyAccepted) continue;
        }

        const totalSlots = items.length;
        const occupiedSlots = driverResponses.filter(d => d.assignedTransportId).length;
        if (totalSlots === 0 || occupiedSlots < totalSlots) {
          const transportDetails = await Promise.all(items.map(async (item) => {
            const transport = await storage.getTransport(item.transportId);
            if (!transport) return null;
            const vehicle = await storage.getVehicle(transport.vehicleChassi);
            const assignedDriver = driverResponses.find(d => d.assignedTransportId === transport.id);
            return {
              transportId: transport.id,
              vehicleChassi: transport.vehicleChassi,
              vehicleColor: vehicle?.color ?? null,
              vehicleManufacturer: vehicle?.manufacturerId ?? null,
              hasDriverAssigned: !!assignedDriver,
            };
          }));
          results.push({
            id: p.id,
            code: p.proposalNumber ?? null,
            originYard: yard?.name ?? null,
            originYardCity: yard?.city ?? null,
            originYardState: yard?.state ?? null,
            client: client?.name ?? null,
            deliveryLocation: deliveryLocation?.name ?? null,
            deliveryLocationCity: deliveryLocation?.city ?? null,
            deliveryLocationState: deliveryLocation?.state ?? null,
            startDate: p.startDate,
            distanceKm: p.distanceKm ? Number(p.distanceKm) : null,
            isEmergency: p.isEmergency === "true",
            travelRate: travelRate ? { name: travelRate.name, value: Number(travelRate.rateValue) } : null,
            approximateValue: p.distanceKm && travelRate ? Math.round(Number(p.distanceKm) * Number(travelRate.rateValue) * 100) / 100 : null,
            totalSlots,
            occupiedSlots,
            availableSlots: totalSlots - occupiedSlots,
            transports: transportDetails.filter(Boolean),
          });
        }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Error fetching open proposals for external app:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // External: logged-in driver accepts a transport proposal
  app.post("/api/external/transport-proposals/:id/accept", isAuthenticatedJWT, async (req: any, res) => {
    try {
      // Identify the logged-in driver by email
      if (!req.user?.email) {
        return res.status(401).json({ message: "Usuário não identificado" });
      }
      const [driverRow] = await db.select({ id: drivers.id, name: drivers.name, isApto: drivers.isApto, isActive: drivers.isActive })
        .from(drivers).where(eq(drivers.email, req.user.email)).limit(1);
      if (!driverRow) {
        return res.status(403).json({ message: "Nenhum motorista vinculado a este usuário" });
      }
      // Motorista inapto NÃO pode aceitar novas propostas
      if (driverRow.isApto !== "true" || driverRow.isActive !== "true") {
        return res.status(403).json({ error: "driver_not_apt", message: INAPTO_MSG });
      }

      const proposalId = req.params.id;

      // Check proposal exists and is not cancelled
      const proposal = await storage.getTransportProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ message: "Proposta não encontrada" });
      }
      if (proposal.status === "cancelada") {
        return res.status(400).json({ message: "Esta proposta foi cancelada e não pode ser aceita" });
      }

      // Check for available slots
      const [items, driverResponses] = await Promise.all([
        storage.getProposalItems(proposalId),
        storage.getProposalDrivers(proposalId),
      ]);
      const totalSlots = items.length;
      const occupiedSlots = driverResponses.filter(d => d.assignedTransportId).length;
      if (totalSlots > 0 && occupiedSlots >= totalSlots) {
        return res.status(400).json({ message: "Não há vagas disponíveis nesta proposta" });
      }

      // Check if driver already has an entry for this proposal
      const existingEntry = driverResponses.find(d => d.driverId === driverRow.id);

      let result;
      if (existingEntry) {
        if (existingEntry.status === "aceito") {
          return res.status(409).json({ message: "Você já aceitou esta proposta" });
        }
        // Update existing entry (e.g. was recusado or pendente) to aceito
        result = await storage.updateProposalDriver(existingEntry.id, {
          status: "aceito",
          respondedAt: new Date(),
        });
      } else {
        // Create a new entry with status aceito
        result = await storage.addProposalDriver(proposalId, driverRow.id);
        result = await storage.updateProposalDriver(result.id, {
          status: "aceito",
          respondedAt: new Date(),
        });
      }

      await logProposalAction(proposalId, "change_status", `Motorista "${driverRow.name ?? driverRow.id}" aceitou a proposta via app`, req.user?.username ?? "sistema");

      res.status(200).json({
        message: "Proposta aceita com sucesso",
        entry: result,
      });
    } catch (error: any) {
      console.error("Error accepting proposal (external):", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transport-proposals/list", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposals = await storage.getTransportProposals();
      const result = await Promise.all(proposals.map(async (p) => {
        const [yard, client, deliveryLocation, items, driverResponses] = await Promise.all([
          storage.getYard(p.originYardId),
          storage.getClient(p.clientId),
          storage.getDeliveryLocation(p.deliveryLocationId),
          storage.getProposalItems(p.id),
          storage.getProposalDrivers(p.id),
        ]);
        const totalSlots = items.length;
        const occupiedSlots = driverResponses.filter(d => d.assignedTransportId).length;
        const computedStatus = p.status === "cancelada" ? "cancelada" : p.rateApprovalStatus === "pendente" ? "pendente_aprovacao" : (totalSlots > 0 && occupiedSlots >= totalSlots ? "fechada" : "em_aberto");
        return {
          id: p.id,
          originYard: yard?.name ?? null,
          originYardAddress: yard ? [yard.address, yard.addressNumber, yard.city, yard.state].filter(Boolean).join(", ") : null,
          client: client?.name ?? null,
          deliveryLocation: deliveryLocation?.name ?? null,
          deliveryLocationAddress: deliveryLocation ? [deliveryLocation.address, deliveryLocation.addressNumber, deliveryLocation.city, deliveryLocation.state].filter(Boolean).join(", ") : null,
          startDate: p.startDate,
          distanceKm: p.distanceKm ? Number(p.distanceKm) : null,
          totalSlots,
          occupiedSlots,
          computedStatus,
        };
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transport-proposals", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposals = await storage.getTransportProposals();
      const result = await Promise.all(proposals.map(async (p) => {
        const [yard, client, deliveryLocation, items, driverResponses] = await Promise.all([
          storage.getYard(p.originYardId),
          storage.getClient(p.clientId),
          storage.getDeliveryLocation(p.deliveryLocationId),
          storage.getProposalItems(p.id),
          storage.getProposalDrivers(p.id),
        ]);
        let travelRate = null;
        if (p.travelRateId) {
          const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, p.travelRateId));
          if (rate) travelRate = rate;
        }
        const transportDetails = await Promise.all(items.map(i => storage.getTransport(i.transportId)));
        const driverDetails = await Promise.all(driverResponses.map(async d => ({
          ...d,
          driver: await storage.getDriver(d.driverId),
          assignedTransport: d.assignedTransportId ? await storage.getTransport(d.assignedTransportId) : null,
        })));
        const totalSlots = items.length;
        const occupiedSlots = driverResponses.filter(d => d.assignedTransportId).length;
        const computedStatus = p.status === "cancelada" ? "cancelada" : p.rateApprovalStatus === "pendente" ? "pendente_aprovacao" : (totalSlots > 0 && occupiedSlots >= totalSlots ? "fechada" : "em_aberto");
        return { ...p, originYard: yard, client, deliveryLocation, travelRate, items: transportDetails.filter(Boolean), driverResponses: driverDetails, totalSlots, occupiedSlots, computedStatus };
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function logProposalAction(proposalId: string, action: string, description: string, performedBy: string) {
    try {
      await db.insert(transportProposalLogs).values({ proposalId, action, description, performedBy });
    } catch (e) { console.error("Failed to log proposal action:", e); }
  }

  app.post("/api/transport-proposals", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { transportIds, totalSlots: _ts, ...proposalData } = req.body;
      console.log("[transport-proposals POST] body:", JSON.stringify(req.body));
      let rateApprovalStatus: string | null = null;
      if (proposalData.travelRateId) {
        const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, proposalData.travelRateId));
        if (rate?.requiresApproval === "true") {
          rateApprovalStatus = "pendente";
        }
      }
      const proposal = await storage.createTransportProposal({ ...proposalData, rateApprovalStatus, createdByUserId: req.user?.id });
      if (transportIds && Array.isArray(transportIds)) {
        await Promise.all(transportIds.map((tid: string) => storage.addProposalItem(proposal.id, tid)));
      }
      const items = await storage.getProposalItems(proposal.id);
      const transportDetails = await Promise.all(items.map(i => storage.getTransport(i.transportId)));
      const totalSlots = items.length;
      const computedStatus = rateApprovalStatus === "pendente" ? "pendente_aprovacao" : "em_aberto";
      res.status(201).json({ ...proposal, items: transportDetails.filter(Boolean), driverResponses: [], totalSlots, occupiedSlots: 0, computedStatus });

      // Fire-and-forget: send push to all active drivers with device tokens.
      // If the rate requires approval, hold the push until the rate is approved
      // (see PATCH /api/transport-proposals/:id/rate-approval).
      if (rateApprovalStatus !== "pendente") {
        (async () => {
          try {
            const { title, body, data } = await buildProposalPushContent(
              proposal, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage)
            );
            await sendPushToAllActiveDrivers(title, body, data);
          } catch (e: any) {
            console.warn("Proposal push notification error:", e?.message);
          }
        })();
      } else {
        console.log(`[transport-proposals POST] Push notification deferred — proposal ${proposal.id} awaits rate approval.`);
      }
    } catch (error: any) {
      console.error("[transport-proposals POST] error:", error?.message, error?.stack);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/transport-proposals/:id/resend-push", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposal = await storage.getTransportProposal(req.params.id);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      const { title, body, data } = await buildProposalPushContent(
        proposal, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage)
      );
      await sendPushToAllActiveDrivers(title, body, data);
      res.json({ message: "Notificação reenviada com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transport-proposals/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposal = await storage.getTransportProposal(req.params.id);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      const [yard, client, deliveryLocation, items, driverResponses] = await Promise.all([
        storage.getYard(proposal.originYardId),
        storage.getClient(proposal.clientId),
        storage.getDeliveryLocation(proposal.deliveryLocationId),
        storage.getProposalItems(proposal.id),
        storage.getProposalDrivers(proposal.id),
      ]);
      let travelRate = null;
      if (proposal.travelRateId) {
        const [rate] = await db.select().from(travelRates).where(eq(travelRates.id, proposal.travelRateId));
        if (rate) travelRate = rate;
      }
      const transportDetails = await Promise.all(items.map(async i => {
        const t = await storage.getTransport(i.transportId);
        if (!t) return null;
        const [tClient] = await db.select().from(clients).where(eq(clients.id, t.clientId));
        const [tYard] = t.originYardId ? await db.select().from(yards).where(eq(yards.id, t.originYardId)) : [null];
        const [tDelivery] = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, t.deliveryLocationId));
        return { ...t, client: tClient ?? null, originYard: tYard ?? null, deliveryLocation: tDelivery ?? null };
      }));

      // Fetch driver stats in bulk
      const driverIds = driverResponses.map(d => d.driverId);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [monthlyDeliveries, avgScores] = await Promise.all([
        driverIds.length > 0
          ? db.select({ driverId: transports.driverId, total: drizzleSql<number>`count(*)::int` })
              .from(transports)
              .where(and(
                eq(transports.status, "entregue"),
                drizzleSql`${transports.driverId} = ANY(ARRAY[${drizzleSql.raw(driverIds.map(id => `'${id}'`).join(","))}]::varchar[])`,
                drizzleSql`${transports.createdAt} >= ${startOfMonth.toISOString()}`
              ))
              .groupBy(transports.driverId)
          : Promise.resolve([]),
        driverIds.length > 0
          ? db.select({ driverId: driverEvaluations.driverId, avgScore: drizzleSql<string>`AVG(${driverEvaluations.averageScore})::numeric(4,1)` })
              .from(driverEvaluations)
              .where(drizzleSql`${driverEvaluations.driverId} = ANY(ARRAY[${drizzleSql.raw(driverIds.map(id => `'${id}'`).join(","))}]::varchar[])`)
              .groupBy(driverEvaluations.driverId)
          : Promise.resolve([]),
      ]);

      const monthlyMap = Object.fromEntries((monthlyDeliveries as any[]).map(r => [r.driverId, r.total]));
      const scoreMap = Object.fromEntries((avgScores as any[]).map(r => [r.driverId, r.avgScore ? Number(r.avgScore) : null]));

      const driverDetails = await Promise.all(driverResponses.map(async d => ({
        ...d,
        driver: await storage.getDriver(d.driverId),
        assignedTransport: d.assignedTransportId ? await storage.getTransport(d.assignedTransportId) : null,
        monthlyDeliveries: monthlyMap[d.driverId] ?? 0,
        averageScore: scoreMap[d.driverId] ?? null,
      })));
      const totalSlots = items.length;
      const occupiedSlots = driverResponses.filter(d => d.assignedTransportId).length;
      const computedStatus = proposal.status === "cancelada" ? "cancelada" : proposal.rateApprovalStatus === "pendente" ? "pendente_aprovacao" : (totalSlots > 0 && occupiedSlots >= totalSlots ? "fechada" : "em_aberto");

      const logs = await db.select().from(transportProposalLogs)
        .where(eq(transportProposalLogs.proposalId, req.params.id))
        .orderBy(desc(transportProposalLogs.createdAt));

      res.json({ ...proposal, originYard: yard, client, deliveryLocation, travelRate, items: transportDetails.filter(Boolean), driverResponses: driverDetails, totalSlots, occupiedSlots, computedStatus, logs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/transport-proposals/:id", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { transportIds, totalSlots: _ts, ...data } = req.body;
      const oldProposal = await storage.getTransportProposal(req.params.id);
      const updated = await storage.updateTransportProposal(req.params.id, data);
      if (!updated) return res.status(404).json({ message: "Proposta não encontrada" });

      if ("status" in data && data.status === "cancelada" && oldProposal?.status !== "cancelada") {
        await logProposalAction(req.params.id, "change_status", "Proposta encerrada", req.user?.username ?? "sistema");
      }

      if ("travelRateId" in data && data.travelRateId !== oldProposal?.travelRateId) {
        let description = "";
        if (!data.travelRateId) {
          const oldRateName = oldProposal?.travelRateId
            ? (await db.select().from(travelRates).where(eq(travelRates.id, oldProposal.travelRateId)))?.[0]?.name ?? oldProposal.travelRateId
            : "nenhuma";
          description = `Tarifa removida (anterior: "${oldRateName}")`;
          await db.update(transportProposals).set({ rateApprovalStatus: null, rateApprovalNote: null, rateApprovedAt: null, rateApprovedBy: null }).where(eq(transportProposals.id, req.params.id));
        } else {
          const [newRate] = await db.select().from(travelRates).where(eq(travelRates.id, data.travelRateId));
          const newRateName = newRate?.name ?? data.travelRateId;
          const newRateValue = newRate ? `R$ ${Number(newRate.rateValue).toFixed(2)}` : "";
          if (newRate?.requiresApproval === "true") {
            await db.update(transportProposals).set({ rateApprovalStatus: "pendente", rateApprovalNote: null, rateApprovedAt: null, rateApprovedBy: null }).where(eq(transportProposals.id, req.params.id));
          } else {
            await db.update(transportProposals).set({ rateApprovalStatus: null, rateApprovalNote: null, rateApprovedAt: null, rateApprovedBy: null }).where(eq(transportProposals.id, req.params.id));
          }
          if (oldProposal?.travelRateId) {
            const [oldRate] = await db.select().from(travelRates).where(eq(travelRates.id, oldProposal.travelRateId));
            const oldRateName = oldRate?.name ?? oldProposal.travelRateId;
            const oldRateValue = oldRate ? `R$ ${Number(oldRate.rateValue).toFixed(2)}` : "";
            description = `Tarifa alterada de "${oldRateName}" (${oldRateValue}) para "${newRateName}" (${newRateValue})`;
          } else {
            description = `Tarifa definida como "${newRateName}" (${newRateValue})`;
          }
        }
        await logProposalAction(req.params.id, "change_rate", description, req.user?.username ?? "sistema");
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });


  // Proposal items (transports)
  app.post("/api/transport-proposals/:id/transports", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { transportId } = req.body;
      const item = await storage.addProposalItem(req.params.id, transportId);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/transport-proposals/:id/transports/:transportId", isAuthenticatedJWT, async (req: any, res) => {
    try {
      await storage.removeProposalItem(req.params.id, req.params.transportId);
      res.json({ message: "Transporte removido da proposta" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Proposal drivers
  app.post("/api/transport-proposals/:id/drivers", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { driverId } = req.body;
      const existing = await storage.getProposalDrivers(req.params.id);
      if (existing.find(d => d.driverId === driverId)) {
        return res.status(409).json({ message: "Motorista já está nesta proposta" });
      }
      const driver = await storage.addProposalDriver(req.params.id, driverId);
      const driverInfo = await storage.getDriver(driverId);
      await logProposalAction(req.params.id, "add_driver", `Motorista "${driverInfo?.name ?? driverId}" adicionado à proposta`, req.user?.username ?? "sistema");
      res.status(201).json({ ...driver, driver: driverInfo });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/transport-proposals/:id/drivers/:driverEntryId", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const data: any = { ...req.body };
      if (data.status && (data.status === "aceito" || data.status === "recusado")) {
        data.respondedAt = new Date();
      }
      const updated = await storage.updateProposalDriver(req.params.driverEntryId, data);
      if (!updated) return res.status(404).json({ message: "Registro não encontrado" });
      const driverInfo = await storage.getDriver(updated.driverId);
      if (data.status) {
        const statusLabels: Record<string, string> = { pendente: "Pendente", aceito: "Aceito", recusado: "Recusado" };
        await logProposalAction(req.params.id, "change_status", `Status do motorista "${driverInfo?.name ?? updated.driverId}" alterado para "${statusLabels[data.status] ?? data.status}"`, req.user?.username ?? "sistema");
      }
      res.json({ ...updated, driver: driverInfo });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/transport-proposals/:id/drivers/:driverId", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const driverInfo = await storage.getDriver(req.params.driverId);
      await storage.removeProposalDriver(req.params.id, req.params.driverId);
      await logProposalAction(req.params.id, "remove_driver", `Motorista "${driverInfo?.name ?? req.params.driverId}" removido da proposta`, req.user?.username ?? "sistema");
      res.json({ message: "Motorista removido da proposta" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver accepts a proposal
  app.post("/api/transport-proposals/:id/drivers/:driverEntryId/accept", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposal = await storage.getTransportProposal(req.params.id);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      if (proposal.status !== "ativa") return res.status(400).json({ message: "A proposta não está ativa" });

      const drivers = await storage.getProposalDrivers(req.params.id);
      const entry = drivers.find(d => d.id === req.params.driverEntryId);
      if (!entry) return res.status(404).json({ message: "Motorista não encontrado nesta proposta" });
      if (entry.status !== "pendente") return res.status(400).json({ message: "Proposta já foi respondida por este motorista" });

      const updated = await storage.updateProposalDriver(req.params.driverEntryId, {
        status: "aceito",
        respondedAt: new Date(),
      });
      const driverInfo = await storage.getDriver(updated!.driverId);
      await logProposalAction(req.params.id, "change_status", `Status do motorista "${driverInfo?.name ?? updated!.driverId}" alterado para "Aceito"`, req.user?.username ?? "sistema");
      res.json({ ...updated, driver: driverInfo });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Driver rejects a proposal
  app.post("/api/transport-proposals/:id/drivers/:driverEntryId/reject", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposal = await storage.getTransportProposal(req.params.id);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      if (proposal.status !== "ativa") return res.status(400).json({ message: "A proposta não está ativa" });

      const drivers = await storage.getProposalDrivers(req.params.id);
      const entry = drivers.find(d => d.id === req.params.driverEntryId);
      if (!entry) return res.status(404).json({ message: "Motorista não encontrado nesta proposta" });
      if (entry.status !== "pendente") return res.status(400).json({ message: "Proposta já foi respondida por este motorista" });

      const updated = await storage.updateProposalDriver(req.params.driverEntryId, {
        status: "recusado",
        respondedAt: new Date(),
      });
      const driverInfo = await storage.getDriver(updated!.driverId);
      await logProposalAction(req.params.id, "change_status", `Status do motorista "${driverInfo?.name ?? updated!.driverId}" alterado para "Recusado"`, req.user?.username ?? "sistema");
      res.json({ ...updated, driver: driverInfo });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assign driver to transport
  app.post("/api/transport-proposals/:id/drivers/:driverEntryId/assign", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { transportId, rankJustification } = req.body;
      const proposalId = req.params.id;

      const transport = await storage.getTransport(transportId);
      if (!transport) return res.status(404).json({ message: "Transporte não encontrado" });

      if (transport.driverId) {
        return res.status(400).json({ message: "Este transporte já possui um motorista atribuído." });
      }

      const updated = await storage.updateProposalDriver(req.params.driverEntryId, {
        assignedTransportId: transportId,
        ...(rankJustification ? { rankJustification } : {}),
      } as any);
      if (!updated) return res.status(404).json({ message: "Registro não encontrado" });

      await storage.updateTransport(transportId, {
        driverId: updated.driverId,
        driverAssignedAt: new Date(),
        driverAssignedByUserId: req.user?.id ?? null,
      } as any);

      const [existingItem] = await db
        .select()
        .from(transportProposalItems)
        .where(and(
          eq(transportProposalItems.proposalId, proposalId),
          eq(transportProposalItems.transportId, transportId),
        ));
      if (!existingItem) {
        await db.insert(transportProposalItems).values({ proposalId, transportId });
      }

      const updatedTransport = await storage.getTransport(transportId);
      const driverInfo = await storage.getDriver(updated.driverId);
      await logProposalAction(proposalId, "assign_driver", `Motorista "${driverInfo?.name ?? updated.driverId}" atribuído ao transporte "${updatedTransport?.requestNumber ?? transportId}"`, req.user?.username ?? "sistema");

      // Send push notification to the assigned driver (fire-and-forget)
      const proposal = await storage.getTransportProposal(proposalId);
      if (proposal) {
        buildAssignedToPushContent(proposal, updatedTransport?.requestNumber ?? null, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage))
          .then(({ title, body, data }) => sendPushToDriver(updated.driverId, title, body, data))
          .catch(() => {});

        // Check if all slots are now filled → notify unassigned accepted drivers
        const allEntries = await storage.getProposalDrivers(proposalId);
        const allItems = await storage.getProposalItems(proposalId);
        const nowOccupied = allEntries.filter(d => d.assignedTransportId).length;
        if (allItems.length > 0 && nowOccupied >= allItems.length) {
          buildNotSelectedPushContent(proposal, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage))
            .then(({ title, body, data }) => sendPushToUnassignedAcceptedDrivers(proposalId, title, body, data))
            .catch(() => {});
        }
      }

      res.json({ ...updated, assignedTransport: updatedTransport });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Unassign driver from transport
  app.post("/api/transport-proposals/:id/transports/:transportId/unassign-driver", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { transportId } = req.params;
      const proposalId = req.params.id;

      const driverEntry = (await db
        .select()
        .from(transportProposalDrivers)
        .where(and(
          eq(transportProposalDrivers.proposalId, proposalId),
          eq(transportProposalDrivers.assignedTransportId, transportId),
        )))[0];

      let driverName = "desconhecido";
      let removedDriverId: string | null = null;
      if (driverEntry) {
        const driverInfo = await storage.getDriver(driverEntry.driverId);
        driverName = driverInfo?.name ?? driverEntry.driverId;
        removedDriverId = driverEntry.driverId;
        await storage.updateProposalDriver(driverEntry.id, { assignedTransportId: null } as any);
      }

      const transport = await storage.getTransport(transportId);
      await storage.updateTransport(transportId, { driverId: null } as any);
      await logProposalAction(proposalId, "unassign_driver", `Motorista "${driverName}" removido do transporte "${transport?.requestNumber ?? transportId}"`, req.user?.username ?? "sistema");

      // Notify removed driver (fire-and-forget)
      if (removedDriverId) {
        const proposal = await storage.getTransportProposal(proposalId);
        if (proposal) {
          buildRemovedFromTransportPushContent(proposal, transport?.requestNumber ?? null, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage))
            .then(({ title, body, data }) => sendPushToDriver(removedDriverId!, title, body, data))
            .catch(() => {});
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Change driver on a transport (unassign old, assign new)
  app.post("/api/transport-proposals/:id/transports/:transportId/change-driver", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { transportId } = req.params;
      const proposalId = req.params.id;
      const { newDriverEntryId } = req.body;

      const oldDriverEntry = (await db
        .select()
        .from(transportProposalDrivers)
        .where(and(
          eq(transportProposalDrivers.proposalId, proposalId),
          eq(transportProposalDrivers.assignedTransportId, transportId),
        )))[0];

      let oldDriverName = "nenhum";
      let oldDriverId: string | null = null;
      if (oldDriverEntry) {
        const oldInfo = await storage.getDriver(oldDriverEntry.driverId);
        oldDriverName = oldInfo?.name ?? oldDriverEntry.driverId;
        oldDriverId = oldDriverEntry.driverId;
        await storage.updateProposalDriver(oldDriverEntry.id, { assignedTransportId: null } as any);
      }

      const newDriverEntry = await storage.updateProposalDriver(newDriverEntryId, { assignedTransportId: transportId });
      if (!newDriverEntry) return res.status(404).json({ message: "Motorista não encontrado na proposta" });

      await storage.updateTransport(transportId, { driverId: newDriverEntry.driverId } as any);

      const newInfo = await storage.getDriver(newDriverEntry.driverId);
      const transport = await storage.getTransport(transportId);
      await logProposalAction(proposalId, "change_driver", `Motorista do transporte "${transport?.requestNumber ?? transportId}" trocado de "${oldDriverName}" para "${newInfo?.name ?? newDriverEntry.driverId}"`, req.user?.username ?? "sistema");

      const proposal = await storage.getTransportProposal(proposalId);
      if (proposal) {
        // Notify newly assigned driver
        buildAssignedToPushContent(proposal, transport?.requestNumber ?? null, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage))
          .then(({ title, body, data }) => sendPushToDriver(newDriverEntry.driverId, title, body, data))
          .catch(() => {});

        // Notify removed driver
        if (oldDriverId) {
          buildRemovedFromTransportPushContent(proposal, transport?.requestNumber ?? null, storage.getYard.bind(storage), storage.getDeliveryLocation.bind(storage))
            .then(({ title, body, data }) => sendPushToDriver(oldDriverId!, title, body, data))
            .catch(() => {});
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Manual trigger: notify all accepted-but-unassigned drivers of a proposal
  app.post("/api/transport-proposals/:id/notify-unassigned", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const proposalId = req.params.id;
      const proposal = await storage.getTransportProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });

      // Count how many accepted-but-unassigned drivers exist
      const entries = await db.select().from(transportProposalDrivers).where(
        and(
          eq(transportProposalDrivers.proposalId, proposalId),
          eq(transportProposalDrivers.status, "aceito"),
          drizzleSql`${transportProposalDrivers.assignedTransportId} IS NULL`
        )
      );

      if (entries.length === 0) {
        return res.json({ message: "Nenhum motorista aceito sem atribuição encontrado", notified: 0 });
      }

      const { title, body, data } = await buildNotSelectedPushContent(
        proposal,
        storage.getYard.bind(storage),
        storage.getDeliveryLocation.bind(storage)
      );

      // Fire-and-forget — respond immediately
      sendPushToUnassignedAcceptedDrivers(proposalId, title, body, data).catch(() => {});

      await logProposalAction(proposalId, "notify_unassigned", `Notificação enviada para ${entries.length} motorista(s) aceito(s) sem atribuição`, req.user?.username ?? "sistema");

      res.json({ message: "Notificações enviadas", notified: entries.length });
    } catch (error: any) {
      console.error("Error notifying unassigned drivers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── BROADCAST ──────────────────────────────────────────────────────────────

  function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function pointInPolygon(lat: number, lng: number, coords: { lat: number; lng: number }[]) {
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i].lng, yi = coords[i].lat;
      const xj = coords[j].lng, yj = coords[j].lat;
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function driverMatchesGeoFilter(lat: string | null, lng: string | null, geoFilter: any): boolean {
    if (!geoFilter) return true;
    if (!lat || !lng) return false;
    const dLat = parseFloat(lat), dLng = parseFloat(lng);
    if (isNaN(dLat) || isNaN(dLng)) return false;
    if (geoFilter.type === "circle") {
      const dist = haversineKm(dLat, dLng, geoFilter.center.lat, geoFilter.center.lng);
      return dist <= geoFilter.radius / 1000;
    }
    if (geoFilter.type === "polygon") {
      return pointInPolygon(dLat, dLng, geoFilter.coords);
    }
    return true;
  }

  interface DriverFilterCriteria {
    states?: string[];
    cities?: string[];
    minAge?: number;
    maxAge?: number;
    driverTypes?: string[];
    modalities?: string[];
    cnhTypes?: string[];
    isApto?: boolean;
    documentsApproved?: string[];
    hasToken?: boolean;
  }

  function driverMatchesDriverFilter(driver: {
    state?: string | null;
    city?: string | null;
    birthDate?: string | null;
    driverType?: string | null;
    modality?: string | null;
    cnhType?: string | null;
    isApto?: string | null;
    documentsApproved?: string | null;
    deviceToken?: string | null;
  }, f: DriverFilterCriteria | null): boolean {
    if (!f) return true;

    if (f.states && f.states.length > 0) {
      if (!driver.state || !f.states.includes(driver.state.toUpperCase())) return false;
    }

    if (f.cities && f.cities.length > 0) {
      const dCity = (driver.city ?? "").toLowerCase();
      const matches = f.cities.some(c => dCity.includes(c.toLowerCase()) || c.toLowerCase().includes(dCity));
      if (!matches) return false;
    }

    if (f.minAge !== undefined || f.maxAge !== undefined) {
      if (!driver.birthDate) return false;
      const birth = new Date(driver.birthDate);
      if (isNaN(birth.getTime())) return false;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (f.minAge !== undefined && age < f.minAge) return false;
      if (f.maxAge !== undefined && age > f.maxAge) return false;
    }

    if (f.driverTypes && f.driverTypes.length > 0) {
      if (!driver.driverType || !f.driverTypes.includes(driver.driverType)) return false;
    }

    if (f.modalities && f.modalities.length > 0) {
      if (!driver.modality || !f.modalities.includes(driver.modality)) return false;
    }

    if (f.cnhTypes && f.cnhTypes.length > 0) {
      if (!driver.cnhType || !f.cnhTypes.includes(driver.cnhType.toUpperCase())) return false;
    }

    if (f.isApto !== undefined) {
      const dApto = driver.isApto === "true" || driver.isApto === "1";
      if (dApto !== f.isApto) return false;
    }

    if (f.documentsApproved && f.documentsApproved.length > 0) {
      if (!driver.documentsApproved || !f.documentsApproved.includes(driver.documentsApproved)) return false;
    }

    if (f.hasToken !== undefined) {
      const hasT = !!(driver.deviceToken?.trim());
      if (hasT !== f.hasToken) return false;
    }

    return true;
  }

  app.get("/api/broadcasts", isAuthenticatedJWT, async (req, res) => {
    try {
      const list = await db.select().from(broadcasts).orderBy(desc(broadcasts.createdAt));
      const result = await Promise.all(list.map(async (b) => {
        const recs = await db.select().from(broadcastRecipients).where(eq(broadcastRecipients.broadcastId, b.id));
        return {
          ...b,
          stats: {
            sent: recs.filter(r => r.sentAt).length,
            received: recs.filter(r => r.receivedAt).length,
            read: recs.filter(r => r.readAt).length,
          },
        };
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/broadcasts/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const [broadcast] = await db.select().from(broadcasts).where(eq(broadcasts.id, req.params.id));
      if (!broadcast) return res.status(404).json({ message: "Broadcast não encontrado" });
      const recs = await db.select().from(broadcastRecipients).where(eq(broadcastRecipients.broadcastId, broadcast.id));
      const recipientDetails = await Promise.all(recs.map(async (r) => {
        const [driver] = await db.select({ id: drivers.id, name: drivers.name, city: drivers.city, state: drivers.state }).from(drivers).where(eq(drivers.id, r.driverId));
        return { ...r, driver: driver ?? null };
      }));
      res.json({
        ...broadcast,
        stats: {
          sent: recipientDetails.filter(r => r.sentAt).length,
          received: recipientDetails.filter(r => r.receivedAt).length,
          read: recipientDetails.filter(r => r.readAt).length,
        },
        recipients: recipientDetails,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/broadcasts", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { title, message, severity = "info", geoFilter, driverFilter } = req.body;
      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ message: "Título e mensagem são obrigatórios" });
      }

      // Fetch Firebase settings
      const settingRows = await db.select().from(appSettings).where(
        drizzleSql`${appSettings.key} IN ('firebase_service_account_json', 'firebase_server_key')`
      );
      const settingsMap = Object.fromEntries(settingRows.map(r => [r.key, r.value]));
      const saJson = settingsMap.firebase_service_account_json;
      const serverKey = settingsMap.firebase_server_key;

      if (!saJson && !serverKey) {
        return res.status(400).json({ message: "Firebase não configurado. Adicione a Service Account JSON ou a FCM Server Key em Integrações." });
      }

      // Create broadcast record
      const [newBroadcast] = await db.insert(broadcasts).values({
        title: title.trim(),
        message: message.trim(),
        severity,
        geoFilter: geoFilter ?? null,
        driverFilter: driverFilter ?? null,
        createdByUserId: req.user?.id ?? null,
      }).returning();

      // Filter eligible drivers: active, APTO, has device token, matches geo + driver filters
      const allDrivers = await db.select({
        id: drivers.id, name: drivers.name, deviceToken: drivers.deviceToken,
        latitude: drivers.latitude, longitude: drivers.longitude,
        state: drivers.state, city: drivers.city,
        birthDate: drivers.birthDate,
        driverType: drivers.driverType, modality: drivers.modality,
        cnhType: drivers.cnhType, isApto: drivers.isApto,
        documentsApproved: drivers.documentsApproved,
      }).from(drivers).where(and(eq(drivers.isActive, "true"), eq(drivers.isApto, "true")));

      const eligible = allDrivers.filter(d =>
        d.deviceToken?.trim() &&
        driverMatchesGeoFilter(d.latitude, d.longitude, geoFilter ?? null) &&
        driverMatchesDriverFilter(d as any, driverFilter ?? null)
      );

      const broadcastData = { broadcastId: newBroadcast.id, severity, type: "broadcast" };

      // Send push via Admin SDK (preferred) or FCM Legacy HTTP API (fallback)
      let sent = 0;
      for (const driver of eligible) {
        try {
          if (saJson) {
            await sendPushViaAdminSDK(driver.deviceToken!, title.trim(), message.trim(), broadcastData, saJson);
          } else {
            const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
              method: "POST",
              headers: { "Authorization": `key=${serverKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                to: driver.deviceToken,
                notification: { title: title.trim(), body: message.trim() },
                data: broadcastData,
              }),
            });
            const rawText = await fcmRes.text();
            let fcmBody: any = null;
            try { fcmBody = JSON.parse(rawText); } catch { /* HTML page */ }
            if (!fcmBody) {
              throw new Error("FCM Legacy HTTP API foi descontinuada pelo Google. Configure a Service Account JSON do Firebase em Integrações para habilitar push notifications.");
            }
            if (!fcmRes.ok || (fcmBody.success ?? 0) === 0) {
              const errMsg = fcmBody.results?.[0]?.error ?? `HTTP ${fcmRes.status}`;
              throw new Error(errMsg);
            }
          }
          await db.insert(broadcastRecipients).values({
            broadcastId: newBroadcast.id,
            driverId: driver.id,
            sentAt: new Date(),
          });
          sent++;
        } catch (e: any) {
          console.warn(`FCM broadcast failed for driver ${driver.name}:`, e?.message);
          await db.insert(broadcastRecipients).values({
            broadcastId: newBroadcast.id,
            driverId: driver.id,
            sentAt: null,
          });
        }
      }

      await db.update(broadcasts).set({ totalSent: sent }).where(eq(broadcasts.id, newBroadcast.id));
      res.json({ success: true, broadcastId: newBroadcast.id, totalSent: sent, totalEligible: eligible.length });
    } catch (error: any) {
      console.error("Broadcast error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Preview: count eligible drivers for given geo + driver filters (before sending)
  app.post("/api/broadcasts/preview-recipients", isAuthenticatedJWT, async (req, res) => {
    try {
      const { geoFilter, driverFilter } = req.body;
      const allDrivers = await db.select({
        id: drivers.id,
        deviceToken: drivers.deviceToken,
        latitude: drivers.latitude,
        longitude: drivers.longitude,
        state: drivers.state, city: drivers.city,
        birthDate: drivers.birthDate,
        driverType: drivers.driverType, modality: drivers.modality,
        cnhType: drivers.cnhType, isApto: drivers.isApto,
        documentsApproved: drivers.documentsApproved,
      }).from(drivers).where(and(eq(drivers.isActive, "true"), eq(drivers.isApto, "true")));

      const withToken = allDrivers.filter(d => d.deviceToken?.trim());
      const eligible = allDrivers.filter(d =>
        d.deviceToken?.trim() &&
        driverMatchesGeoFilter(d.latitude, d.longitude, geoFilter ?? null) &&
        driverMatchesDriverFilter(d as any, driverFilter ?? null)
      );
      res.json({ total: allDrivers.length, withToken: withToken.length, eligible: eligible.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // External: driver marks broadcast as received
  app.post("/api/external/broadcasts/:broadcastId/received", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const driverUser = await db.select().from(drivers).where(eq(drivers.email, req.user?.email ?? "")).limit(1);
      if (!driverUser.length) return res.status(404).json({ message: "Motorista não encontrado" });
      const driverId = driverUser[0].id;
      await db.update(broadcastRecipients)
        .set({ receivedAt: new Date() })
        .where(and(eq(broadcastRecipients.broadcastId, req.params.broadcastId), eq(broadcastRecipients.driverId, driverId), drizzleSql`received_at IS NULL`));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // External: driver marks broadcast as read
  app.post("/api/external/broadcasts/:broadcastId/read", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const driverUser = await db.select().from(drivers).where(eq(drivers.email, req.user?.email ?? "")).limit(1);
      if (!driverUser.length) return res.status(404).json({ message: "Motorista não encontrado" });
      const driverId = driverUser[0].id;
      await db.update(broadcastRecipients)
        .set({ readAt: new Date() })
        .where(and(eq(broadcastRecipients.broadcastId, req.params.broadcastId), eq(broadcastRecipients.driverId, driverId), drizzleSql`read_at IS NULL`));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============== AVARIAS ==============
  app.get("/api/damage-reports/new-count", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { since } = req.query as { since?: string };
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const collectsRows = await db.execute(drizzleSql`
        SELECT COUNT(*)::int AS count FROM collects
        WHERE created_at > ${sinceDate}
          AND (
            (checkin_damage_photos IS NOT NULL AND array_length(checkin_damage_photos, 1) > 0)
            OR
            (checkout_damage_photos IS NOT NULL AND array_length(checkout_damage_photos, 1) > 0)
          )
      `);

      const transportsRows = await db.execute(drizzleSql`
        SELECT COUNT(*)::int AS count FROM transports
        WHERE created_at > ${sinceDate}
          AND (
            (checkin_damage_photos IS NOT NULL AND array_length(checkin_damage_photos, 1) > 0)
            OR
            (checkout_damage_photos IS NOT NULL AND array_length(checkout_damage_photos, 1) > 0)
          )
      `);

      const collectsResult = (collectsRows as any).rows?.[0] ?? (collectsRows as any)[0] ?? {};
      const transportsResult = (transportsRows as any).rows?.[0] ?? (transportsRows as any)[0] ?? {};
      const total = Number(collectsResult.count ?? 0) + Number(transportsResult.count ?? 0);
      res.json({ count: total });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============== ANALYTICS ==============
  app.get("/api/analytics/routes-engagement", isAuthenticatedJWT, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const THRESHOLD = 5;

      const dateFilter = drizzleSql`
        ${startDate ? drizzleSql`AND tp.start_date >= ${new Date(startDate)}` : drizzleSql``}
        ${endDate ? drizzleSql`AND tp.start_date <= ${new Date(endDate + "T23:59:59")}` : drizzleSql``}
      `;

      const rows = await db.execute(drizzleSql`
        SELECT
          y.name AS origin_yard,
          y.city AS origin_city,
          y.state AS origin_state,
          dl.name AS destination,
          dl.city AS destination_city,
          dl.state AS destination_state,
          COUNT(tpd.id)::int AS total_proposals,
          SUM(CASE WHEN tpd.status = 'aceito' THEN 1 ELSE 0 END)::int AS total_accepted,
          SUM(CASE WHEN tpd.status = 'recusado' THEN 1 ELSE 0 END)::int AS total_rejected,
          SUM(CASE WHEN tpd.status = 'pendente' THEN 1 ELSE 0 END)::int AS total_pending,
          COUNT(DISTINCT tpd.driver_id)::int AS unique_drivers_reached,
          ROUND(
            (SUM(CASE WHEN tpd.status = 'aceito' THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(tpd.id), 0)) * 100, 1
          ) AS acceptance_rate,
          ROUND(
            (SUM(CASE WHEN tpd.status = 'recusado' THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(tpd.id), 0)) * 100, 1
          ) AS rejection_rate
        FROM transport_proposal_drivers tpd
        JOIN transport_proposals tp ON tp.id = tpd.proposal_id
        JOIN yards y ON y.id = tp.origin_yard_id
        JOIN delivery_locations dl ON dl.id = tp.delivery_location_id
        WHERE 1=1
          ${dateFilter}
        GROUP BY y.id, y.name, y.city, y.state, dl.id, dl.name, dl.city, dl.state
        ORDER BY COUNT(tpd.id) DESC
      `);

      const routes = (rows.rows as any[]).map(r => ({
        originYard: r.origin_yard,
        originCity: r.origin_city,
        originState: r.origin_state,
        destination: r.destination,
        destinationCity: r.destination_city,
        destinationState: r.destination_state,
        totalProposals: Number(r.total_proposals),
        totalAccepted: Number(r.total_accepted),
        totalRejected: Number(r.total_rejected),
        totalPending: Number(r.total_pending),
        uniqueDriversReached: Number(r.unique_drivers_reached),
        acceptanceRate: Number(r.acceptance_rate ?? 0),
        rejectionRate: Number(r.rejection_rate ?? 0),
        hasEnoughData: Number(r.total_proposals) >= THRESHOLD,
      }));

      const sufficientRoutes = routes.filter(r => r.hasEnoughData);
      const insufficientRoutes = routes.filter(r => !r.hasEnoughData);

      const mostAcceptedRoutes = [...sufficientRoutes].sort((a, b) => {
        const rateDiff = b.acceptanceRate - a.acceptanceRate;
        return rateDiff !== 0 ? rateDiff : b.totalProposals - a.totalProposals;
      });

      const leastAcceptedRoutes = [...sufficientRoutes].sort((a, b) => {
        const rateDiff = b.rejectionRate - a.rejectionRate;
        return rateDiff !== 0 ? rateDiff : b.totalProposals - a.totalProposals;
      });

      const totalProposals = routes.reduce((s, r) => s + r.totalProposals, 0);
      const totalAccepted = routes.reduce((s, r) => s + r.totalAccepted, 0);

      res.json({
        mostAcceptedRoutes,
        leastAcceptedRoutes,
        insufficientDataRoutes: insufficientRoutes,
        totalRoutes: routes.length,
        totalProposals,
        totalDriversReached: routes.reduce((s, r) => s + r.uniqueDriversReached, 0),
        overallAcceptanceRate: totalProposals > 0 ? Number(((totalAccepted / totalProposals) * 100).toFixed(1)) : 0,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============== SOLICITAÇÕES DE CHASSI (PORTAL DO CLIENTE) ==============

  app.post("/api/portal/chassis-requests", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = (req as any).clientId;
      if (!clientId) return res.status(403).json({ message: "Apenas clientes podem solicitar chassi" });

      const parsed = insertChassisRequestSchema.parse({ ...req.body, clientId });
      const created = await storage.createChassisRequest(parsed);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Erro ao criar solicitação" });
    }
  });

  app.get("/api/portal/chassis-requests", isAuthenticatedJWTOrClient, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = (req as any).clientId;
      if (!clientId) return res.status(403).json({ message: "Apenas clientes podem acessar este endpoint" });

      const requests = await storage.getChassisRequestsByClient(clientId);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin lista todas as solicitações (enriquecido com dados do cliente)
  app.get("/api/chassis-requests", isAuthenticatedJWT, async (req, res) => {
    try {
      const requests = await storage.getChassisRequests();
      // Enriquecer com nome do cliente
      const clientsMap = new Map<string, string>();
      const allClients = await storage.getClients();
      for (const c of allClients) clientsMap.set(c.id, c.name);
      const enriched = requests.map(r => ({
        ...r,
        clientName: clientsMap.get(r.clientId) || r.clientId,
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin atualiza status de uma solicitação
  app.patch("/api/chassis-requests/:id", isAuthenticatedJWT, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const updated = await storage.updateChassisRequest(id, { status, adminNotes });
      if (!updated) return res.status(404).json({ message: "Solicitação não encontrada" });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
