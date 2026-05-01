import { pool } from "../db";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  createdBy: string;
  type: "full" | "selective";
  tables: string[];
  totalRecords: number;
  sizeBytes: number;
  format: "sql" | "tar.gz";
  description?: string;
  version: string;
  includesFiles?: boolean;
  fileCount?: number;
  sqlFilename?: string;
}

function getMetadataPath(): string {
  return path.join(BACKUP_DIR, "backup-registry.json");
}

function loadRegistry(): BackupMetadata[] {
  const registryPath = getMetadataPath();
  if (!fs.existsSync(registryPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  } catch {
    return [];
  }
}

function saveRegistry(registry: BackupMetadata[]) {
  fs.writeFileSync(getMetadataPath(), JSON.stringify(registry, null, 2));
}

function getAllTableNames(): string[] {
  return [
    "users",
    "drivers",
    "manufacturers",
    "yards",
    "clients",
    "delivery_locations",
    "vehicles",
    "collects",
    "transports",
    "contracts",
    "freight_contracts",
    "transfers",
    "checkpoints",
    "transport_checkpoints",
    "driver_evaluations",
    "evaluation_criteria",
    "evaluation_scores",
    "expense_settlements",
    "expense_settlement_items",
    "truck_models",
    "freight_quotes",
    "routes",
    "travel_rates",
    "travel_rate_approvers",
    "yard_monthly_invoices",
    "yard_monthly_invoice_items",
    "system_users",
    "role_permissions",
    "request_counter",
    "driver_notifications",
    "password_reset_tokens",
    "user_types",
    "user_type_permissions",
  ];
}

export function getValidTableNames(): string[] {
  return getAllTableNames();
}

export async function getTableStats(): Promise<
  { table: string; count: number; sizeEstimate: string }[]
> {
  const stats: { table: string; count: number; sizeEstimate: string }[] = [];
  const tableNames = getAllTableNames();

  for (const name of tableNames) {
    try {
      const countResult = await pool.query(
        `SELECT count(*)::int as count FROM "${name}"`
      );
      const count = countResult.rows[0]?.count ?? 0;

      let sizeEstimate = "N/A";
      try {
        const sizeResult = await pool.query(
          `SELECT pg_size_pretty(pg_total_relation_size($1)) as size`,
          [name]
        );
        sizeEstimate = sizeResult.rows[0]?.size ?? "N/A";
      } catch {}

      stats.push({ table: name, count, sizeEstimate });
    } catch {
      stats.push({ table: name, count: 0, sizeEstimate: "N/A" });
    }
  }

  return stats;
}

function countUploadsFiles(): number {
  if (!fs.existsSync(UPLOADS_DIR)) return 0;
  try {
    return fs.readdirSync(UPLOADS_DIR).length;
  } catch {
    return 0;
  }
}

export async function createBackup(options: {
  tables?: string[];
  type?: "full" | "selective";
  createdBy: string;
  description?: string;
}): Promise<BackupMetadata> {
  const { type = "full", createdBy, description } = options;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não configurada");
  }

  const backupId = randomUUID();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sqlFilename = `backup_${type}_${timestamp}_${backupId.slice(0, 8)}.sql`;
  const sqlFilePath = path.join(BACKUP_DIR, sqlFilename);

  let pgDumpArgs = [
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--format=plain",
    `--file=${sqlFilePath}`,
  ];

  let tablesToBackup: string[];

  if (type === "selective" && options.tables && options.tables.length > 0) {
    tablesToBackup = options.tables;
    for (const table of tablesToBackup) {
      pgDumpArgs.push(`--table=${table}`);
    }
  } else {
    tablesToBackup = getAllTableNames();
  }

  const pgDumpCmd = `pg_dump ${pgDumpArgs.join(" ")} "${databaseUrl}"`;

  try {
    execSync(pgDumpCmd, {
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: any) {
    if (fs.existsSync(sqlFilePath)) {
      fs.unlinkSync(sqlFilePath);
    }
    throw new Error(`pg_dump falhou: ${err.stderr?.toString() || err.message}`);
  }

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error("Arquivo de backup não foi gerado");
  }

  let totalRecords = 0;
  try {
    const stats = await getTableStats();
    const tableSet = new Set(tablesToBackup);
    totalRecords = stats
      .filter((s) => tableSet.has(s.table))
      .reduce((sum, s) => sum + s.count, 0);
  } catch {}

  // For full backups, bundle SQL + uploads directory into a single tar.gz
  const includeFiles = type === "full" && fs.existsSync(UPLOADS_DIR);
  let finalFilename: string;
  let finalFilePath: string;
  let sizeBytes: number;
  let fileCount = 0;

  if (includeFiles) {
    finalFilename = `backup_full_${timestamp}_${backupId.slice(0, 8)}.tar.gz`;
    finalFilePath = path.join(BACKUP_DIR, finalFilename);
    fileCount = countUploadsFiles();

    try {
      // Create tar.gz containing the SQL file and the uploads directory
      const tarCmd = `tar czf "${finalFilePath}" -C "${BACKUP_DIR}" "${sqlFilename}" -C "${process.cwd()}" uploads`;
      execSync(tarCmd, { timeout: 300000, stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      // If tar fails, fall back to SQL-only
      console.error("tar failed, falling back to SQL-only backup:", err.message);
      finalFilename = sqlFilename;
      finalFilePath = sqlFilePath;
      fileCount = 0;
    }

    // Remove standalone SQL file if tar succeeded
    if (finalFilename !== sqlFilename && fs.existsSync(sqlFilePath)) {
      fs.unlinkSync(sqlFilePath);
    }

    sizeBytes = fs.existsSync(finalFilePath) ? fs.statSync(finalFilePath).size : 0;
  } else {
    finalFilename = sqlFilename;
    finalFilePath = sqlFilePath;
    sizeBytes = fs.existsSync(sqlFilePath) ? fs.statSync(sqlFilePath).size : 0;
  }

  const metadata: BackupMetadata = {
    id: backupId,
    filename: finalFilename,
    createdAt: new Date().toISOString(),
    createdBy,
    type,
    tables: tablesToBackup,
    totalRecords,
    sizeBytes,
    format: includeFiles && finalFilename.endsWith(".tar.gz") ? "tar.gz" : "sql",
    description,
    version: "2.0.0",
    includesFiles: includeFiles && finalFilename.endsWith(".tar.gz"),
    fileCount: includeFiles ? fileCount : 0,
    sqlFilename: includeFiles && finalFilename.endsWith(".tar.gz") ? sqlFilename : undefined,
  };

  const registry = loadRegistry();
  registry.unshift(metadata);
  saveRegistry(registry);

  return metadata;
}

export async function getDatabaseSummary() {
  let totalSize = "N/A";
  try {
    const result = await pool.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    );
    totalSize = result.rows[0]?.size ?? "N/A";
  } catch {}

  const stats = await getTableStats();
  const totalRecords = stats.reduce((sum, s) => sum + s.count, 0);

  // Include uploads info
  let uploadsSize = "0 B";
  let uploadsCount = 0;
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      const result = execSync(`du -sb "${UPLOADS_DIR}" 2>/dev/null || echo "0"`, {
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const bytes = parseInt(result.toString().split("\t")[0]) || 0;
      uploadsSize = formatBytes(bytes);
      uploadsCount = countUploadsFiles();
    }
  } catch {}

  return {
    databaseSize: totalSize,
    totalTables: stats.length,
    totalRecords,
    tables: stats,
    lastBackup: loadRegistry()[0] ?? null,
    uploadsSize,
    uploadsCount,
  };
}

export function listBackups(): BackupMetadata[] {
  return loadRegistry();
}

export function getBackupFilePath(backupId: string): string | null {
  const registry = loadRegistry();
  const backup = registry.find((b) => b.id === backupId);
  if (!backup) return null;
  const filePath = path.join(BACKUP_DIR, backup.filename);
  return fs.existsSync(filePath) ? filePath : null;
}

export function getBackupMetadata(backupId: string): BackupMetadata | null {
  const registry = loadRegistry();
  return registry.find((b) => b.id === backupId) ?? null;
}

export function deleteBackup(backupId: string): boolean {
  const registry = loadRegistry();
  const idx = registry.findIndex((b) => b.id === backupId);
  if (idx === -1) return false;

  const backup = registry[idx];
  const filePath = path.join(BACKUP_DIR, backup.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  registry.splice(idx, 1);
  saveRegistry(registry);
  return true;
}

export async function restoreBackup(
  backupId: string
): Promise<{ success: boolean; output: string }> {
  const registry = loadRegistry();
  const backup = registry.find((b) => b.id === backupId);
  if (!backup) throw new Error("Backup não encontrado");

  const filePath = path.join(BACKUP_DIR, backup.filename);
  if (!fs.existsSync(filePath)) throw new Error("Arquivo de backup não encontrado");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada");

  let sqlPath = filePath;

  // If it's a tar.gz, extract the SQL file first
  if (backup.format === "tar.gz") {
    const extractDir = path.join(BACKUP_DIR, `restore_${backupId}`);
    if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });

    try {
      execSync(`tar xzf "${filePath}" -C "${extractDir}"`, {
        timeout: 120000,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Restore uploads if present
      const extractedUploads = path.join(extractDir, "uploads");
      if (fs.existsSync(extractedUploads)) {
        execSync(`cp -r "${extractedUploads}/." "${UPLOADS_DIR}/"`, {
          timeout: 60000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      }

      // Find the SQL file
      const sqlFile = backup.sqlFilename
        ? path.join(extractDir, backup.sqlFilename)
        : path.join(extractDir, backup.filename.replace(".tar.gz", ".sql"));

      if (fs.existsSync(sqlFile)) {
        sqlPath = sqlFile;
      } else {
        // Try to find any .sql file in extract dir
        const files = fs.readdirSync(extractDir).filter(f => f.endsWith(".sql"));
        if (files.length > 0) {
          sqlPath = path.join(extractDir, files[0]);
        }
      }
    } catch (err: any) {
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
      throw new Error(`Extração falhou: ${err.message}`);
    }
  }

  try {
    const output = execSync(`psql "${databaseUrl}" < "${sqlPath}"`, {
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      shell: "/bin/sh",
    });

    // Clean up extract dir
    if (backup.format === "tar.gz") {
      const extractDir = path.join(BACKUP_DIR, `restore_${backupId}`);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
    }

    return {
      success: true,
      output: output.toString().slice(0, 2000),
    };
  } catch (err: any) {
    // Clean up extract dir
    if (backup.format === "tar.gz") {
      const extractDir = path.join(BACKUP_DIR, `restore_${backupId}`);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });
    }

    const stderr = err.stderr?.toString() || "";
    const stdout = err.stdout?.toString() || "";
    if (stdout && !stderr.includes("ERROR")) {
      return {
        success: true,
        output: `Restauração concluída com avisos: ${stderr.slice(0, 500)}`,
      };
    }
    throw new Error(`Restauração falhou: ${stderr.slice(0, 500) || err.message}`);
  }
}

export async function cleanOldBackups(keepCount: number = 5): Promise<number> {
  const registry = loadRegistry();
  if (registry.length <= keepCount) return 0;

  const toRemove = registry.slice(keepCount);
  let removed = 0;

  for (const backup of toRemove) {
    const filePath = path.join(BACKUP_DIR, backup.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    removed++;
  }

  saveRegistry(registry.slice(0, keepCount));
  return removed;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
