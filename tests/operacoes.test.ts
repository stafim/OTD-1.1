/**
 * Testes de integração — Operações
 *  • Coletas
 *  • Transportes
 *  • Propostas de Transporte
 *  • Aprovação de Tarifa
 *
 * Roda contra a aplicação em http://localhost:5000.
 *   TEST_ADMIN_PASS=adminTq62md88** node_modules/.bin/tsx tests/operacoes.test.ts
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const ADMIN_USER = process.env.TEST_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.TEST_ADMIN_PASS;
if (!ADMIN_PASS) {
  console.error("Set TEST_ADMIN_PASS env var to run these tests.");
  process.exit(2);
}

let token = "";
const created: Record<string, string[]> = {
  yards: [], manufacturers: [], clients: [], deliveryLocations: [], drivers: [],
  travelRates: [], collects: [], transports: [], proposals: [], vehicles: [],
};

const results: { suite: string; name: string; ok: boolean; info?: string }[] = [];

function log(s: string) { console.log(s); }

async function api(method: string, path: string, body?: any, opts: { multipart?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: any;
  if (opts.multipart && body) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach(item => fd.append(k, String(item)));
      else fd.append(k, String(v));
    }
    payload = fd;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json };
}

function record(suite: string, name: string, ok: boolean, info?: string) {
  results.push({ suite, name, ok, info });
  log(`  ${ok ? "✅" : "❌"} ${name}${info ? " — " + info : ""}`);
}

async function login() {
  const r = await api("POST", "/api/auth/login", { username: ADMIN_USER, password: ADMIN_PASS });
  if (r.status !== 200 || !r.body?.accessToken) throw new Error("Login failed: " + JSON.stringify(r.body));
  token = r.body.accessToken;
  log(`🔑 Login OK as ${ADMIN_USER}`);
}

// ============== SETUP DE PRÉ-REQUISITOS ==============
type Setup = {
  yard1Id: string; yard2Id: string;
  manufacturerId: string;
  clientId: string;
  deliveryLocationId: string;
  driverId: string;
  rateNoApprovalId: string;
  rateApprovalId: string;
  chassi: string;        // chassi criado pela coleta
};

async function setup(): Promise<Setup> {
  log("\n🛠  Setup de pré-requisitos");
  const ts = Date.now().toString().slice(-6);

  const yard1 = await api("POST", "/api/yards", {
    name: `Pátio Origem ${ts}`, cep: "81260-900", address: "R. A", addressNumber: "1",
    neighborhood: "C", city: "Curitiba", state: "PR",
    latitude: "-25.4707", longitude: "-49.3128", phone: "(41)0000-0000",
    maxVehicles: 100, isActive: "true",
  });
  const yard1Id = yard1.body.id; created.yards.push(yard1Id);

  const yard2 = await api("POST", "/api/yards", {
    name: `Pátio Destino ${ts}`, cep: "01310-100", address: "Av. B", addressNumber: "2",
    neighborhood: "C", city: "São Paulo", state: "SP",
    latitude: "-23.5613", longitude: "-46.6565", phone: "(11)0000-0000",
    maxVehicles: 100, isActive: "true",
  });
  const yard2Id = yard2.body.id; created.yards.push(yard2Id);

  const mfr = await api("POST", "/api/manufacturers", {
    name: `Volvo Teste ${ts}`, cep: "81260-900", address: "Av. JK",
    addressNumber: "2600", neighborhood: "Cidade Industrial",
    city: "Curitiba", state: "PR", latitude: "-25.4707", longitude: "-49.3128",
    phone: "(41)0000-1111", email: `mfr${ts}@t.com`, contactName: "X", isActive: "true",
  });
  const manufacturerId = mfr.body.id; created.manufacturers.push(manufacturerId);

  const cli = await api("POST", "/api/clients", {
    name: `Cliente Teste ${ts}`, cnpj: "43.999.424/0001-14",
    cep: "81260-900", address: "Av. C", addressNumber: "500",
    neighborhood: "C", city: "Curitiba", state: "PR",
    latitude: "-25.4707", longitude: "-49.3128",
    phone: "(41)0000-2222", email: `cli${ts}@t.com`, contactName: "Y",
    dailyCost: "10.00", yardGraceDays: 1, isActive: "true",
  });
  const clientId = cli.body.id; created.clients.push(clientId);

  const dl = await api("POST", `/api/clients/${clientId}/locations`, {
    name: `Filial ${ts}`, address: "Rod. Z", addressNumber: "1",
    neighborhood: "B", city: "Sorocaba", state: "SP", country: "Brasil",
    latitude: "-23.5015", longitude: "-47.4526",
    responsibleName: "Recebimento", responsiblePhone: "(15)0000-0000",
    emails: [`recebimento${ts}@t.com`],
  });
  const deliveryLocationId = dl.body.id; created.deliveryLocations.push(deliveryLocationId);

  // Reusa motorista apto existente (evita criação/cleanup com CPF único)
  const allDrivers = await api("GET", "/api/drivers");
  const apto = Array.isArray(allDrivers.body)
    ? allDrivers.body.find((d: any) => d.isApto === "true" || d.isApto === true)
    : null;
  if (!apto?.id) throw new Error("Nenhum motorista apto encontrado para os testes");
  const driverId: string = apto.id;

  const rate1 = await api("POST", "/api/travel-rates", {
    name: `Tarifa Sem Aprov ${ts}`, rateType: "por_km", rateValue: "1.20",
    isActive: "true", requiresApproval: "false",
  });
  const rateNoApprovalId = rate1.body.id; created.travelRates.push(rateNoApprovalId);

  const rate2 = await api("POST", "/api/travel-rates", {
    name: `Tarifa Com Aprov ${ts}`, rateType: "fixo", rateValue: "999.00",
    isActive: "true", requiresApproval: "true",
  });
  const rateApprovalId = rate2.body.id; created.travelRates.push(rateApprovalId);

  log(`  setup OK (yards=${yard1Id.slice(0,8)}.., client=${clientId.slice(0,8)}..)`);
  return {
    yard1Id, yard2Id, manufacturerId, clientId, deliveryLocationId,
    driverId, rateNoApprovalId, rateApprovalId,
    chassi: `TST${ts}A`,
  };
}

// ============== COLETAS ==============
async function testCollects(s: Setup) {
  log("\n🚛 COLETAS");

  // 1.1 — Coleta válida (cria veículo)
  let r = await api("POST", "/api/collects", {
    vehicleChassi: s.chassi,
    manufacturerId: s.manufacturerId,
    yardId: s.yard1Id,
    collectType: "coleta",
    notes: "Coleta de teste",
  });
  let collectId = r.body?.id;
  if (collectId) { created.collects.push(collectId); created.vehicles.push(s.chassi); }
  record("collects", "1.1 Cadastro de coleta válida", !!collectId, `status=${r.status}`);

  // 1.2 — Validação: chassi muito curto
  r = await api("POST", "/api/collects", {
    vehicleChassi: "ABC", manufacturerId: s.manufacturerId, yardId: s.yard1Id, collectType: "coleta",
  });
  record("collects", "1.2 Validação: chassi curto rejeitado", r.status === 400, `status=${r.status}`);

  // 1.3 — Validação: coleta sem montadora
  r = await api("POST", "/api/collects", {
    vehicleChassi: `TST${Date.now()}B`, yardId: s.yard1Id, collectType: "coleta",
  });
  record("collects", "1.3 Validação: coleta exige montadora",
    r.status === 400 && /montadora/i.test(JSON.stringify(r.body)), `status=${r.status}`);

  // 1.4 — Validação: pátio destino obrigatório
  r = await api("POST", "/api/collects", {
    vehicleChassi: `TST${Date.now()}C`, manufacturerId: s.manufacturerId, collectType: "coleta",
  });
  record("collects", "1.4 Validação: pátio destino obrigatório", r.status === 400, `status=${r.status}`);

  // 1.5 — Transferência: pátio origem == destino é rejeitado
  r = await api("POST", "/api/collects", {
    vehicleChassi: s.chassi, originYardId: s.yard1Id, yardId: s.yard1Id, collectType: "transferencia",
  });
  record("collects", "1.5 Validação: transferência com pátios iguais rejeitada",
    r.status === 400, `status=${r.status}`);

  // 1.6 — Transferência válida (chassi já existe)
  const transfChassi = `TST${Date.now()}T`;
  // primeiro precisa existir o veículo: criamos via coleta inicial
  const seed = await api("POST", "/api/collects", {
    vehicleChassi: transfChassi, manufacturerId: s.manufacturerId, yardId: s.yard1Id, collectType: "coleta",
  });
  if (seed.body?.id) { created.collects.push(seed.body.id); created.vehicles.push(transfChassi); }

  r = await api("POST", "/api/collects", {
    vehicleChassi: transfChassi, originYardId: s.yard1Id, yardId: s.yard2Id, collectType: "transferencia",
  });
  if (r.body?.id) created.collects.push(r.body.id);
  record("collects", "1.6 Transferência entre pátios distintos", !!r.body?.id,
    `status=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`);

  if (collectId) {
    // 1.7 — Buscar coleta por chassi
    r = await api("GET", `/api/collects/by-chassi/${s.chassi}`);
    record("collects", "1.7 GET por chassi", r.status === 200 && Array.isArray(r.body) && r.body.length > 0,
      `status=${r.status} count=${Array.isArray(r.body) ? r.body.length : "?"}`);

    // 1.8 — Edição (notas)
    r = await api("PATCH", `/api/collects/${collectId}`, { notes: "atualizado" });
    record("collects", "1.8 Edição de notas",
      r.status === 200 && r.body?.notes === "atualizado", `status=${r.status}`);

    // 1.9 — Listagem inclui a coleta
    r = await api("GET", "/api/collects");
    const found = Array.isArray(r.body) && r.body.find((c: any) => c.id === collectId);
    record("collects", "1.9 Listagem inclui a coleta criada", !!found, `count=${Array.isArray(r.body) ? r.body.length : "?"}`);
  }
}

// ============== TRANSPORTES ==============
async function testTransports(s: Setup): Promise<{ noRateId: string; rateNoApprovalId: string; rateApprovalId: string }> {
  log("\n🚚 TRANSPORTES");
  const out = { noRateId: "", rateNoApprovalId: "", rateApprovalId: "" };

  const base = {
    vehicleChassi: s.chassi,
    clientId: s.clientId,
    originYardId: s.yard1Id,
    deliveryLocationId: s.deliveryLocationId,
  };

  // 2.1 — Transporte sem tarifa
  let r = await api("POST", "/api/transports", base);
  if (r.body?.id) { out.noRateId = r.body.id; created.transports.push(r.body.id); }
  record("transports", "2.1 Cadastro sem tarifa", !!out.noRateId, `status=${r.status}`);

  // 2.2 — Validação: cliente obrigatório
  r = await api("POST", "/api/transports", { ...base, clientId: "" });
  record("transports", "2.2 Validação: cliente obrigatório", r.status === 400, `status=${r.status}`);

  // 2.3 — Validação: pátio origem obrigatório
  r = await api("POST", "/api/transports", { ...base, originYardId: "" });
  record("transports", "2.3 Validação: pátio origem obrigatório", r.status === 400, `status=${r.status}`);

  // 2.4 — Validação: chassi inexistente rejeitado (FK)
  r = await api("POST", "/api/transports", { ...base, vehicleChassi: "INEXISTENTE_99999" });
  record("transports", "2.4 Validação: chassi inexistente rejeitado",
    r.status >= 400 && r.status < 600 && !r.body?.id, `status=${r.status}`);

  // 2.5 — Transporte com tarifa que NÃO exige aprovação → status pendente normal
  r = await api("POST", "/api/transports", { ...base, travelRateId: s.rateNoApprovalId });
  if (r.body?.id) { out.rateNoApprovalId = r.body.id; created.transports.push(r.body.id); }
  const noApprovalOk = r.body?.travelRateApprovalStatus == null || r.body?.travelRateApprovalStatus === undefined;
  record("transports", "2.5 Tarifa sem aprovação não dispara fluxo de aprovação",
    !!out.rateNoApprovalId && noApprovalOk,
    `status=${r.status} approval=${r.body?.travelRateApprovalStatus ?? "(null)"}`);

  // 2.6 — Transporte com tarifa que EXIGE aprovação → travelRateApprovalStatus = pendente
  r = await api("POST", "/api/transports", { ...base, travelRateId: s.rateApprovalId });
  if (r.body?.id) { out.rateApprovalId = r.body.id; created.transports.push(r.body.id); }
  record("transports", "2.6 Tarifa com aprovação dispara fluxo (status pendente)",
    !!out.rateApprovalId && r.body?.travelRateApprovalStatus === "pendente",
    `status=${r.status} approval=${r.body?.travelRateApprovalStatus}`);

  if (out.noRateId) {
    // 2.7 — Edição (atribuir motorista)
    r = await api("PATCH", `/api/transports/${out.noRateId}`, { driverId: s.driverId });
    record("transports", "2.7 Edição: atribuir motorista",
      r.status === 200 && r.body?.driverId === s.driverId,
      `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);

    // 2.8 — GET por ID
    r = await api("GET", `/api/transports/${out.noRateId}`);
    record("transports", "2.8 GET por ID", r.status === 200 && r.body?.id === out.noRateId, `status=${r.status}`);

    // 2.9 — Delete sem motivo é rejeitado
    r = await api("DELETE", `/api/transports/${out.noRateId}`, {});
    record("transports", "2.9 Delete sem motivo rejeitado", r.status === 400, `status=${r.status}`);
  }

  return out;
}

// ============== PROPOSTAS DE TRANSPORTE ==============
async function testProposals(s: Setup, transportIds: string[]) {
  log("\n📜 PROPOSTAS DE TRANSPORTE");

  const validTransportIds = transportIds.filter(Boolean);

  // 3.1 — Proposta válida (com transportes)
  let r = await api("POST", "/api/transport-proposals", {
    originYardId: s.yard1Id,
    clientId: s.clientId,
    deliveryLocationId: s.deliveryLocationId,
    travelRateId: s.rateNoApprovalId,
    startDate: new Date(Date.now() + 86400000).toISOString(),
    distanceKm: "380.5",
    estimatedValue: "456.60",
    advanceAmount: "1500.00",
    advanceMethod: "dinheiro",
    notes: "Proposta de teste",
    transportIds: validTransportIds.slice(0, 1),
  });
  let proposalId = r.body?.id;
  if (proposalId) created.proposals.push(proposalId);
  record("proposals", "3.1 Cadastro de proposta válida", !!proposalId, `status=${r.status}`);

  // 3.2 — Validação: pátio origem obrigatório (request fails, sem id)
  r = await api("POST", "/api/transport-proposals", {
    clientId: s.clientId, deliveryLocationId: s.deliveryLocationId,
    startDate: new Date().toISOString(),
  });
  record("proposals", "3.2 Validação: pátio origem obrigatório",
    r.status >= 400 && !r.body?.id, `status=${r.status}`);

  // 3.3 — Validação: cliente obrigatório (request fails, sem id)
  r = await api("POST", "/api/transport-proposals", {
    originYardId: s.yard1Id, deliveryLocationId: s.deliveryLocationId,
    startDate: new Date().toISOString(),
  });
  record("proposals", "3.3 Validação: cliente obrigatório",
    r.status >= 400 && !r.body?.id, `status=${r.status}`);

  // 3.4 — Proposta com tarifa que exige aprovação → computedStatus = pendente_aprovacao
  r = await api("POST", "/api/transport-proposals", {
    originYardId: s.yard1Id, clientId: s.clientId, deliveryLocationId: s.deliveryLocationId,
    travelRateId: s.rateApprovalId,
    startDate: new Date(Date.now() + 86400000).toISOString(),
    distanceKm: "380.5", estimatedValue: "999.00",
  });
  if (r.body?.id) created.proposals.push(r.body.id);
  record("proposals", "3.4 Proposta com tarifa que exige aprovação fica pendente",
    r.status === 201 && r.body?.computedStatus === "pendente_aprovacao",
    `status=${r.status} computedStatus=${r.body?.computedStatus}`);

  if (proposalId) {
    // 3.5 — GET por ID retorna detalhe completo
    r = await api("GET", `/api/transport-proposals/${proposalId}`);
    const detailOk = r.status === 200 && r.body?.id === proposalId &&
      r.body?.originYard?.id === s.yard1Id && r.body?.client?.id === s.clientId &&
      Array.isArray(r.body?.items) && Array.isArray(r.body?.driverResponses);
    record("proposals", "3.5 GET detalhe (com pátio, cliente, itens, motoristas)",
      detailOk, `status=${r.status}`);

    // 3.6 — Adicionar transporte
    if (validTransportIds[1]) {
      r = await api("POST", `/api/transport-proposals/${proposalId}/transports`,
        { transportId: validTransportIds[1] });
      record("proposals", "3.6 Adicionar transporte à proposta",
        r.status === 200 || r.status === 201, `status=${r.status}`);
    }

    // 3.7 — Adicionar motorista
    r = await api("POST", `/api/transport-proposals/${proposalId}/drivers`,
      { driverId: s.driverId });
    const driverEntryId = r.body?.id;
    record("proposals", "3.7 Adicionar motorista à proposta",
      (r.status === 200 || r.status === 201) && !!driverEntryId,
      `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`);

    // 3.8 — Edição (notas)
    r = await api("PATCH", `/api/transport-proposals/${proposalId}`, { notes: "editada" });
    record("proposals", "3.8 Edição (notas)",
      r.status === 200 && r.body?.notes === "editada", `status=${r.status}`);

    // 3.9 — Listagem inclui a proposta
    r = await api("GET", "/api/transport-proposals");
    const found = Array.isArray(r.body) && r.body.find((p: any) => p.id === proposalId);
    record("proposals", "3.9 Listagem inclui a proposta", !!found,
      `count=${Array.isArray(r.body) ? r.body.length : "?"}`);

    // 3.10 — Remover motorista
    if (driverEntryId) {
      r = await api("DELETE", `/api/transport-proposals/${proposalId}/drivers/${s.driverId}`);
      record("proposals", "3.10 Remover motorista da proposta",
        r.status === 200 || r.status === 204, `status=${r.status}`);
    }
  }
}

// ============== APROVAÇÃO DE TARIFA ==============
async function testRateApproval(s: Setup, transportRateApprovalId: string) {
  log("\n💰 APROVAÇÃO DE TARIFA");

  // 4.1 — Listagem mostra transporte pendente de aprovação
  let r = await api("GET", "/api/transport-rate-approvals");
  let pendingHasIt = Array.isArray(r.body) && r.body.some((t: any) => t.id === transportRateApprovalId);
  record("rate-approval", "4.1 Listagem inclui transporte pendente",
    r.status === 200 && pendingHasIt,
    `status=${r.status} match=${pendingHasIt}`);

  // 4.2 — Validação: status inválido rejeitado
  r = await api("PATCH", `/api/transports/${transportRateApprovalId}/rate-approval`,
    { status: "talvez", note: "invalido" });
  record("rate-approval", "4.2 Validação: status inválido rejeitado",
    r.status === 400, `status=${r.status}`);

  // 4.3 — Aprovar tarifa
  r = await api("PATCH", `/api/transports/${transportRateApprovalId}/rate-approval`,
    { status: "aprovado", note: "OK" });
  record("rate-approval", "4.3 Aprovar tarifa do transporte",
    r.status === 200 && r.body?.travelRateApprovalStatus === "aprovado" && r.body?.status === "pendente",
    `status=${r.status} approval=${r.body?.travelRateApprovalStatus} transp=${r.body?.status}`);

  // 4.4 — Após aprovação, sai da listagem de pendentes
  r = await api("GET", "/api/transport-rate-approvals");
  const stillPending = Array.isArray(r.body) && r.body.some((t: any) => t.id === transportRateApprovalId);
  record("rate-approval", "4.4 Após aprovado sai da listagem de pendentes",
    !stillPending, `stillPending=${stillPending}`);

  // 4.5 — Criar 2º transporte com tarifa de aprovação para testar rejeição
  const create = await api("POST", "/api/transports", {
    vehicleChassi: s.chassi, clientId: s.clientId, originYardId: s.yard1Id,
    deliveryLocationId: s.deliveryLocationId, travelRateId: s.rateApprovalId,
  });
  const rejectId = create.body?.id;
  if (rejectId) created.transports.push(rejectId);

  r = await api("PATCH", `/api/transports/${rejectId}/rate-approval`,
    { status: "rejeitado", note: "Valor acima do permitido" });
  record("rate-approval", "4.5 Rejeitar tarifa do transporte",
    r.status === 200 && r.body?.travelRateApprovalStatus === "rejeitado",
    `status=${r.status} approval=${r.body?.travelRateApprovalStatus}`);

  // 4.6a — Não-aprovador recebe 403 (cria tarifa com aprovador específico ≠ admin)
  const sysUsers = await api("GET", "/api/system-users");
  const me = (await api("GET", "/api/auth/me")).body;
  const otherUser = Array.isArray(sysUsers.body)
    ? sysUsers.body.find((u: any) => u.id !== me?.id)
    : null;
  if (otherUser?.id) {
    const restrictedRate = await api("POST", "/api/travel-rates", {
      name: `Tarifa Restrita ${Date.now()}`, rateType: "fixo",
      rateValue: "100.00", isActive: "true", requiresApproval: "true",
    });
    const restrictedRateId = restrictedRate.body?.id;
    if (restrictedRateId) {
      created.travelRates.push(restrictedRateId);
      await api("POST", `/api/travel-rates/${restrictedRateId}/approvers`,
        { userId: otherUser.id });
      const restrictedTransport = await api("POST", "/api/transports", {
        vehicleChassi: s.chassi, clientId: s.clientId, originYardId: s.yard1Id,
        deliveryLocationId: s.deliveryLocationId, travelRateId: restrictedRateId,
      });
      const rtId = restrictedTransport.body?.id;
      if (rtId) {
        created.transports.push(rtId);
        const denied = await api("PATCH", `/api/transports/${rtId}/rate-approval`,
          { status: "aprovado", note: "tentativa indevida" });
        record("rate-approval", "4.6 Não-aprovador recebe 403",
          denied.status === 403,
          `status=${denied.status} body=${JSON.stringify(denied.body).slice(0, 120)}`);
      }
    }
  }

  // 4.6b — Aprovação de proposta com tarifa de aprovação
  const prop = await api("POST", "/api/transport-proposals", {
    originYardId: s.yard1Id, clientId: s.clientId, deliveryLocationId: s.deliveryLocationId,
    travelRateId: s.rateApprovalId,
    startDate: new Date(Date.now() + 86400000).toISOString(),
    distanceKm: "380.5", estimatedValue: "999.00",
  });
  const propId = prop.body?.id;
  if (propId) created.proposals.push(propId);

  // 4.7 — Listagem de propostas pendentes
  r = await api("GET", "/api/proposal-rate-approvals");
  const propPending = Array.isArray(r.body) && r.body.some((p: any) => p.id === propId);
  record("rate-approval", "4.7 Listagem de propostas pendentes inclui criada",
    r.status === 200 && propPending, `status=${r.status} match=${propPending}`);

  // 4.8 — Aprovar proposta
  if (propId) {
    r = await api("PATCH", `/api/transport-proposals/${propId}/rate-approval`,
      { status: "aprovado", note: "ok" });
    record("rate-approval", "4.8 Aprovar tarifa da proposta",
      r.status === 200 && r.body?.rateApprovalStatus === "aprovado",
      `status=${r.status} approval=${r.body?.rateApprovalStatus}`);
  }
}

// ============== CLEANUP ==============
async function cleanup() {
  log("\n🧹 Limpeza");
  for (const id of created.proposals)  await api("DELETE", `/api/transport-proposals/${id}`);
  for (const id of created.transports) await api("DELETE", `/api/transports/${id}`, { reason: "teste" });
  for (const id of created.collects)   await api("DELETE", `/api/collects/${id}`);
  for (const chassi of created.vehicles) await api("DELETE", `/api/vehicles/${chassi}`);
  for (const id of created.travelRates) await api("DELETE", `/api/travel-rates/${id}`);
  for (const id of created.deliveryLocations) await api("DELETE", `/api/delivery-locations/${id}`);
  for (const id of created.drivers)    await api("DELETE", `/api/drivers/${id}`);
  for (const id of created.clients)    await api("DELETE", `/api/clients/${id}`);
  for (const id of created.manufacturers) await api("DELETE", `/api/manufacturers/${id}`);
  for (const id of created.yards)      await api("DELETE", `/api/yards/${id}`);
  log("  cleanup done");
}

async function main() {
  await login();
  const s = await setup();
  try {
    await testCollects(s);
    const tr = await testTransports(s);
    await testProposals(s, [tr.noRateId, tr.rateNoApprovalId]);
    await testRateApproval(s, tr.rateApprovalId);
  } finally {
    await cleanup();
  }

  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;
  log(`\n========== RESULTADO ==========`);
  log(`Total: ${total} | ✅ ${passed} | ❌ ${failed}`);
  if (failed > 0) {
    log(`\nFalhas:`);
    results.filter(r => !r.ok).forEach(r => log(`  - [${r.suite}] ${r.name} ${r.info ?? ""}`));
    process.exit(1);
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(2); });
