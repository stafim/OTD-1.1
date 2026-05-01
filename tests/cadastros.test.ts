const BASE = process.env.TEST_BASE_URL || "http://localhost:5000";
const ADMIN_USER = process.env.TEST_ADMIN_USER || "admin";
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || "adminTq62md88**";

let token = "";
const created: Record<string, string[]> = {
  yards: [], manufacturers: [], clients: [], deliveryLocations: [], drivers: [],
};

const results: { suite: string; name: string; ok: boolean; info?: string }[] = [];

function log(s: string) { console.log(s); }

async function api(method: string, path: string, body?: any, opts: { multipart?: boolean; expectFail?: boolean } = {}) {
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

// ============== YARDS ==============
async function testYards() {
  log("\n📦 PÁTIOS (Yards)");
  const valid = {
    name: `Pátio Teste ${Date.now()}`,
    cep: "81260-900", address: "Rua Teste", addressNumber: "100",
    neighborhood: "Centro", city: "Curitiba", state: "PR",
    latitude: "-25.4707", longitude: "-49.3128",
    phone: "(41) 3333-0000", maxVehicles: 200, isActive: "true",
  };
  let r = await api("POST", "/api/yards", valid);
  let id = "";
  if (r.status === 201 || r.status === 200) { id = r.body.id; created.yards.push(id); }
  record("yards", "1.1 Cadastro válido", !!id, `status=${r.status}`);

  r = await api("POST", "/api/yards", { ...valid, name: "" });
  record("yards", "1.2 Validação: nome vazio rejeitado", r.status === 400, `status=${r.status}`);

  if (id) {
    r = await api("PATCH", `/api/yards/${id}`, { maxVehicles: 500 });
    record("yards", "1.3 Edição (capacidade)", r.status === 200 && r.body.maxVehicles === 500, `status=${r.status}`);

    r = await api("PATCH", `/api/yards/${id}`, { isActive: "false" });
    record("yards", "1.4 Inativação", r.status === 200 && r.body.isActive === "false", `status=${r.status}`);

    r = await api("GET", "/api/yards");
    const found = Array.isArray(r.body) && r.body.find((y: any) => y.id === id);
    record("yards", "1.5 Listagem inclui o pátio", !!found, `count=${Array.isArray(r.body) ? r.body.length : "?"}`);
  }
}

// ============== MANUFACTURERS ==============
async function testManufacturers() {
  log("\n🏭 MONTADORAS (Manufacturers)");
  const valid = {
    name: `Volvo Teste ${Date.now()}`,
    cep: "81260-900", address: "Av. Teste", addressNumber: "2600",
    neighborhood: "Cidade Industrial", city: "Curitiba", state: "PR",
    latitude: "-25.4707", longitude: "-49.3128",
    phone: "(41) 3317-0000", email: "contato@volvo-teste.com.br",
    contactName: "João Silva", isActive: "true",
  };
  let r = await api("POST", "/api/manufacturers", valid);
  let id = "";
  if (r.status === 201 || r.status === 200) { id = r.body.id; created.manufacturers.push(id); }
  record("manufacturers", "2.1 Cadastro válido", !!id, `status=${r.status}`);

  r = await api("POST", "/api/manufacturers", { ...valid, name: "X" });
  record("manufacturers", "2.2 Validação: nome curto rejeitado", r.status === 400, `status=${r.status}`);

  const minimal = { name: `Mini ${Date.now()}` };
  r = await api("POST", "/api/manufacturers", minimal);
  if (r.body?.id) created.manufacturers.push(r.body.id);
  record("manufacturers", "2.3 Cadastro mínimo (só nome)", r.status === 201 || r.status === 200, `status=${r.status}`);

  if (id) {
    r = await api("GET", "/api/manufacturers");
    const found = Array.isArray(r.body) && r.body.find((m: any) => m.id === id);
    record("manufacturers", "2.4 Listagem", !!found);
  }
}

// ============== CLIENTS ==============
async function testClients() {
  log("\n🧑‍💼 CLIENTES (Clients)");
  const valid = {
    name: `Cliente Teste ${Date.now()}`,
    cnpj: "43.999.424/0001-14",
    cep: "81260-900", address: "Av. Cliente", addressNumber: "500",
    neighborhood: "Centro", city: "Curitiba", state: "PR",
    latitude: "-25.4707", longitude: "-49.3128",
    phone: "(41) 3000-0000", email: "cliente@teste.com",
    contactName: "Maria", dailyCost: "25.00", yardGraceDays: 3, isActive: "true",
  };
  let r = await api("POST", "/api/clients", valid);
  let id = "";
  if (r.status === 201 || r.status === 200) { id = r.body.id; created.clients.push(id); }
  record("clients", "3.1 Cadastro válido", !!id, `status=${r.status}`);

  r = await api("POST", "/api/clients", { ...valid, name: "" });
  record("clients", "3.2 Validação: nome vazio rejeitado", r.status === 400, `status=${r.status}`);

  if (id) {
    r = await api("PATCH", `/api/clients/${id}`, { dailyCost: "30.00" });
    record("clients", "3.3 Edição (custo diário)", r.status === 200 && r.body.dailyCost === "30.00", `status=${r.status}`);

    r = await api("GET", `/api/clients/${id}`);
    record("clients", "3.4 GET por ID", r.status === 200 && r.body.id === id, `status=${r.status}`);
  }
  return id;
}

// ============== DELIVERY LOCATIONS ==============
async function testDeliveryLocations(clientId: string) {
  log("\n📍 LOCAIS DE ENTREGA (Delivery Locations)");
  if (!clientId) { record("deliveryLocations", "pré-condição cliente", false, "sem cliente"); return; }
  const valid = {
    name: `Filial Teste ${Date.now()}`,
    address: "Rod. Prof. Zeferino Vaz, KM 138",
    addressNumber: "138", neighborhood: "Bairro Bom Retiro",
    city: "Paulínia", state: "SP", country: "Brasil",
    latitude: "-22.7611", longitude: "-47.1546",
    responsibleName: "Recebimento Volvo",
    responsiblePhone: "(19) 3874-0000",
    emails: ["recebimento@cliente.com"],
  };
  let r = await api("POST", `/api/clients/${clientId}/locations`, valid);
  let id = "";
  if (r.status === 201 || r.status === 200) { id = r.body.id; created.deliveryLocations.push(id); }
  record("deliveryLocations", "4.1 Cadastro válido", !!id, `status=${r.status}`);

  r = await api("POST", `/api/clients/${clientId}/locations`, { ...valid, emails: [] });
  record("deliveryLocations", "4.2 Validação: pelo menos 1 email", r.status === 400, `status=${r.status}`);

  r = await api("POST", `/api/clients/${clientId}/locations`, { ...valid, emails: ["nao-eh-email"] });
  record("deliveryLocations", "4.3 Validação: email inválido", r.status === 400, `status=${r.status}`);

  r = await api("POST", `/api/clients/${clientId}/locations`, {
    ...valid, name: `Multi ${Date.now()}`,
    emails: ["a@x.com", "b@x.com", "c@x.com"],
  });
  if (r.body?.id) {
    created.deliveryLocations.push(r.body.id);
    const ok = Array.isArray(r.body.emails) && r.body.emails.length === 3;
    record("deliveryLocations", "4.4 Múltiplos emails persistidos", ok, `emails=${JSON.stringify(r.body.emails)}`);
  } else {
    record("deliveryLocations", "4.4 Múltiplos emails persistidos", false, `status=${r.status}`);
  }

  r = await api("GET", `/api/clients/${clientId}/locations`);
  record("deliveryLocations", "4.5 Listagem por cliente",
    Array.isArray(r.body) && r.body.some((l: any) => l.id === id), `count=${Array.isArray(r.body) ? r.body.length : "?"}`);
}

// ============== DRIVERS ==============
async function testDrivers() {
  log("\n🚚 MOTORISTAS (Drivers)");
  // CPFs válidos diferentes
  const ts = Date.now().toString().slice(-6);
  const valid = {
    name: `Motorista Teste ${ts}`,
    cpf: "529.982.247-25", // CPF válido
    birthDate: "1985-01-01",
    email: `motorista.${ts}@teste.com`,
    phone: "41999990000",
    cep: "81260-900", address: "Rua Motorista", addressNumber: "10",
    neighborhood: "Centro", city: "Curitiba", state: "PR",
    driverType: "coleta", modality: "agregado", cnhType: "D",
    isActive: "true", isApto: "true",
  };
  let r = await api("POST", "/api/drivers", valid, { multipart: true });
  let id = "";
  if (r.status === 201 || r.status === 200) { id = r.body.id; created.drivers.push(id); }
  record("drivers", "5.1 Cadastro válido (coleta)", !!id, `status=${r.status} ${id ? "" : JSON.stringify(r.body)}`);

  r = await api("POST", "/api/drivers", { ...valid, cpf: "123" }, { multipart: true });
  record("drivers", "5.2 Validação: CPF curto rejeitado", r.status === 400, `status=${r.status}`);

  r = await api("POST", "/api/drivers", { ...valid, modality: "invalida" }, { multipart: true });
  record("drivers", "5.3 Validação: modalidade inválida rejeitada", r.status === 400, `status=${r.status}`);

  r = await api("POST", "/api/drivers", { ...valid, cnhType: "Z" }, { multipart: true });
  record("drivers", "5.4 Validação: CNH inválida rejeitada", r.status === 400, `status=${r.status}`);

  // motorista de transporte
  const ts2 = (Date.now() + 1).toString().slice(-6);
  r = await api("POST", "/api/drivers", {
    ...valid, name: `Transp ${ts2}`,
    cpf: "111.444.777-35", email: `transp.${ts2}@teste.com`,
    driverType: "transporte", cnhType: "E",
  }, { multipart: true });
  if (r.body?.id) created.drivers.push(r.body.id);
  record("drivers", "5.5 Cadastro motorista de transporte", r.status === 201 || r.status === 200, `status=${r.status}`);

  if (id) {
    r = await api("GET", `/api/drivers/${id}`);
    record("drivers", "5.6 GET por ID", r.status === 200 && r.body.id === id, `status=${r.status}`);

    r = await api("PATCH", `/api/drivers/${id}`, { phone: "41988887777" }, { multipart: true });
    record("drivers", "5.7 Edição (telefone)", r.status === 200 && r.body.phone === "41988887777", `status=${r.status}`);
  }
}

// ============== CLEANUP ==============
async function cleanup() {
  log("\n🧹 Limpeza dos registros de teste");
  for (const id of created.deliveryLocations) await api("DELETE", `/api/delivery-locations/${id}`);
  for (const id of created.drivers) await api("DELETE", `/api/drivers/${id}`);
  for (const id of created.clients) await api("DELETE", `/api/clients/${id}`);
  for (const id of created.manufacturers) await api("DELETE", `/api/manufacturers/${id}`);
  for (const id of created.yards) await api("DELETE", `/api/yards/${id}`);
  log("  cleanup done");
}

async function main() {
  await login();
  await testYards();
  await testManufacturers();
  const clientId = await testClients();
  await testDeliveryLocations(clientId!);
  await testDrivers();
  await cleanup();

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
