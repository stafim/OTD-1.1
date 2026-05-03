import FormData from "form-data";
import fetch from "node-fetch";
import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const AUTENTIQUE_API = "https://api.autentique.com.br/v2/graphql";

async function getToken(): Promise<string> {
  // Try DB first, then env var
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "autentique_api_token"));
    if (rows[0]?.value) return rows[0].value;
  } catch {
    // ignore DB errors, fall back to env
  }
  const token = process.env.AUTENTIQUE_API_TOKEN;
  if (!token) throw new Error("AUTENTIQUE_API_TOKEN não configurado");
  return token;
}

async function gql(query: string, variables: Record<string, any> = {}) {
  const res = await fetch(AUTENTIQUE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await getToken()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!json) {
    throw new Error(`Autentique HTTP ${res.status}: ${text.substring(0, 300)}`);
  }
  if (json.errors) {
    const msg = json.errors.map((e: any) => e.message).join("; ");
    const debug = JSON.stringify(json.errors).substring(0, 500);
    console.error("[Autentique] GraphQL errors:", debug);
    throw new Error(`Autentique: ${msg}`);
  }
  return json.data;
}

async function gqlMultipart(query: string, variables: Record<string, any>, fileKey: string, fileBuffer: Buffer, filename: string, mimeType: string) {
  const form = new FormData();
  const operations = JSON.stringify({ query, variables });
  const map = JSON.stringify({ "0": [`variables.${fileKey}`] });

  form.append("operations", operations);
  form.append("map", map);
  form.append("0", fileBuffer, { filename, contentType: mimeType });

  const res = await fetch(AUTENTIQUE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      ...form.getHeaders(),
    },
    body: form,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!json) {
    throw new Error(`Autentique HTTP ${res.status}: ${text.substring(0, 300)}`);
  }
  if (json.errors) {
    const extractDetails = (e: any): string[] => {
      const out: string[] = [];
      const v = e?.extensions?.validation;
      if (v && typeof v === "object") {
        for (const key of Object.keys(v)) {
          const arr = v[key];
          if (Array.isArray(arr)) out.push(...arr.map((m: string) => `${key}: ${m}`));
        }
      }
      return out;
    };
    const flatDetails = json.errors.flatMap(extractDetails);
    const baseMsgs = json.errors.map((e: any) => e.message);
    const msg = [...baseMsgs, ...flatDetails].join("; ");
    const debug = JSON.stringify(json.errors).substring(0, 1500);
    console.error("[Autentique] GraphQL errors (multipart):", debug);
    console.error("[Autentique] file size:", fileBuffer.length, "bytes, mimeType:", mimeType);
    throw new Error(`Autentique: ${msg}`);
  }
  return json.data;
}

export interface AutentiqueSignerInput {
  name: string;
  email: string;
  action?: "SIGN" | "APPROVE" | "WITNESS" | "PARTY" | "INTERVENER" | "RECEIPT" | "ENDORSER" | "ENDORSEE" | "TRANSFEROR" | "TRANSFEREE" | "CONTRACTEE" | "CONTRACTOR" | "JOINT_DEBTOR" | "ISSUER" | "MANAGER" | "BUYER" | "SELLER";
}

export interface CreateDocumentInput {
  name: string;
  signers: AutentiqueSignerInput[];
  message?: string;
  pdfBuffer: Buffer;
  filename: string;
}

export async function createDocument(input: CreateDocumentInput) {
  const query = `
    mutation createDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id
        name
        created_at
        signatures {
          public_id
          name
          email
          link { short_link }
          signed { created_at }
        }
        files {
          original
          signed
        }
      }
    }
  `;

  const variables = {
    document: {
      name: input.name,
      message: input.message || "Por favor, assine este documento.",
      refusable: true,
      sortable: false,
    },
    signers: input.signers.map((s) => ({
      name: s.name,
      email: s.email,
      action: s.action || "SIGN",
    })),
    file: null,
  };

  return gqlMultipart(query, variables, "file", input.pdfBuffer, input.filename, "application/pdf");
}

export async function getDocument(docId: string) {
  const query = `
    query getDocument($id: UUID!) {
      document(id: $id) {
        id
        name
        created_at
        updated_at
        signatures_count
        signed_count
        rejected_count
        signatures {
          public_id
          name
          email
          link { short_link }
          signed { created_at }
          viewed { created_at }
          rejected { created_at reason }
        }
        files {
          original
          signed
        }
      }
    }
  `;
  return gql(query, { id: docId });
}

export async function listDocuments(page = 1, limit = 20) {
  const query = `
    query listDocuments($limit: Int!, $page: Int!) {
      documents(limit: $limit, page: $page) {
        total
        data {
          id
          name
          created_at
          updated_at
          signatures_count
          signed_count
          rejected_count
          signatures {
            name
            email
            signed { created_at }
            rejected { created_at }
          }
          files {
            original
            signed
          }
        }
      }
    }
  `;
  return gql(query, { limit, page });
}

export async function deleteDocument(docId: string) {
  const query = `
    mutation deleteDocument($id: UUID!) {
      deleteDocument(id: $id)
    }
  `;
  return gql(query, { id: docId });
}

export async function resendSignatures(docId: string) {
  const docData: any = await getDocument(docId);
  const signatures = docData?.document?.signatures || [];
  const pendingPublicIds: string[] = signatures
    .filter((s: any) => !s.signed && !s.rejected)
    .map((s: any) => s.public_id)
    .filter(Boolean);

  if (pendingPublicIds.length === 0) {
    throw new Error("Não há assinaturas pendentes para reenviar");
  }

  const query = `
    mutation resendSignatures($public_ids: [UUID!]!) {
      resendSignatures(public_ids: $public_ids)
    }
  `;
  return gql(query, { public_ids: pendingPublicIds });
}

export function getDocumentStatus(doc: { signatures_count: number; signed_count: number; rejected_count: number }) {
  if (doc.rejected_count > 0) return "recusado";
  if (doc.signed_count >= doc.signatures_count) return "assinado";
  if (doc.signed_count > 0) return "parcialmente_assinado";
  return "pendente";
}
