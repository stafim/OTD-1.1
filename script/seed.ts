import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(sql: string, params?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }
function rand(arr: any[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number, dec = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function generateCPF(index: number): string {
  const base = String(100000000 + index).padStart(9, "0");
  const d1 = cpfDigit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cpfDigit(base + d1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const raw = base + d1 + d2;
  return `${raw.slice(0,3)}.${raw.slice(3,6)}.${raw.slice(6,9)}-${raw.slice(9)}`;
}

function cpfDigit(s: string, weights: number[]) {
  const sum = s.split("").reduce((acc, c, i) => acc + parseInt(c) * weights[i], 0);
  const r = sum % 11;
  return String(r < 2 ? 0 : 11 - r);
}

function generateCNPJ(index: number): string {
  const base = String(index + 10000000000000).slice(0, 12);
  return `${base.slice(0,2)}.${base.slice(2,5)}.${base.slice(5,8)}/${base.slice(8,12)}-00`;
}

function generatePhone(ddd: string) {
  return `(${ddd}) 9${randInt(1000,9999)}-${randInt(1000,9999)}`;
}

// ─────────────────────────────────────────────────────────────
// REFERENCE DATA
// ─────────────────────────────────────────────────────────────

const firstNames = [
  "Carlos","José","Marcos","Anderson","Rodrigo","Felipe","Rafael","Bruno","Leandro","Eduardo",
  "Thiago","Gustavo","Fabio","Diego","Alex","Pablo","Renato","Luciano","Emerson","Vagner",
  "Adriano","Claudio","Roberto","Douglas","Vinicius","Leonardo","Henrique","Gabriel","Matheus","Paulo",
  "Antonio","Jair","Nilton","Cicero","Raimundo","Manoel","Wellington","Edson","Juarez","Osvaldo",
  "Maria","Ana","Fernanda","Patricia","Camila","Juliana","Carla","Beatriz","Leticia","Vanessa",
  "Sandra","Claudia","Marcia","Rosana","Elaine","Cristiane","Silvia","Tatiana","Regiane","Luciana",
  "Denise","Adriana","Simone","Priscila","Debora","Heloisa","Amanda","Renata","Isabela","Natalia",
  "Gisele","Aline","Daniele","Thaiane","Larissa","Bruna","Milena","Carolina","Viviane","Josiane",
  "Joao","Pedro","Luis","Jorge","Sergio","Mario","Tiago","Mauro","Junior","Elias",
  "Gilberto","Rogerio","Clebson","Adalberto","Welington","Alisson","Geovani","Celio","Natan","Ionã"
];

const lastNames = [
  "Silva","Santos","Oliveira","Souza","Costa","Ferreira","Alves","Pereira","Lima","Gomes",
  "Ribeiro","Carvalho","Martins","Rocha","Nascimento","Mendes","Dias","Castro","Nunes","Araujo",
  "Cardoso","Teixeira","Rodrigues","Vieira","Moreira","Fernandes","Correia","Barbosa","Batista","Cavalcante",
  "Machado","Pinto","Freitas","Moraes","Cunha","Barros","Lopes","Ramos","Melo","Monteiro"
];

const cities = [
  { city: "São Paulo", state: "SP", ddd: "11", cep: "01310-100", neighborhood: "Centro", address: "Av. Paulista" },
  { city: "Curitiba", state: "PR", ddd: "41", cep: "80010-020", neighborhood: "Centro", address: "Rua XV de Novembro" },
  { city: "Campinas", state: "SP", ddd: "19", cep: "13010-050", neighborhood: "Centro", address: "Av. Francisco Glicério" },
  { city: "Porto Alegre", state: "RS", ddd: "51", cep: "90010-150", neighborhood: "Centro Histórico", address: "Av. Borges de Medeiros" },
  { city: "Belo Horizonte", state: "MG", ddd: "31", cep: "30110-000", neighborhood: "Centro", address: "Av. Afonso Pena" },
  { city: "Salvador", state: "BA", ddd: "71", cep: "40020-280", neighborhood: "Comércio", address: "Av. dos Estados" },
  { city: "Recife", state: "PE", ddd: "81", cep: "50010-010", neighborhood: "Boa Vista", address: "Av. Guararapes" },
  { city: "Manaus", state: "AM", ddd: "92", cep: "69010-050", neighborhood: "Centro", address: "Av. Eduardo Ribeiro" },
  { city: "Fortaleza", state: "CE", ddd: "85", cep: "60010-280", neighborhood: "Centro", address: "Av. Dom Manuel" },
  { city: "Goiânia", state: "GO", ddd: "62", cep: "74010-090", neighborhood: "Setor Central", address: "Av. Goiás" },
  { city: "Vitória", state: "ES", ddd: "27", cep: "29010-904", neighborhood: "Centro", address: "Av. Princesa Isabel" },
  { city: "Florianópolis", state: "SC", ddd: "48", cep: "88010-400", neighborhood: "Centro", address: "Av. Hercílio Luz" },
  { city: "São José dos Pinhais", state: "PR", ddd: "41", cep: "83005-010", neighborhood: "Afonso Pena", address: "Av. Rui Barbosa" },
  { city: "Betim", state: "MG", ddd: "31", cep: "32600-000", neighborhood: "Centro", address: "Rua Padre Guilherme Pompílio" },
  { city: "Santo André", state: "SP", ddd: "11", cep: "09010-170", neighborhood: "Centro", address: "Av. Industrial" },
];

const cnhTypes = ["B", "C", "D", "E", "AB", "AC", "AD", "AE"];
const modalities = ["pj", "clt", "agregado"];
const driverTypes = ["coleta", "transporte"];
const vehicleColors = ["Branco", "Prata", "Preto", "Cinza", "Vermelho", "Azul", "Verde", "Amarelo", "Laranja"];
const vehicleStatuses = ["pre_estoque", "em_estoque", "em_estoque", "em_estoque", "em_transferencia", "despachado", "entregue"];

// ─────────────────────────────────────────────────────────────
// 1. MANUFACTURERS (3)
// ─────────────────────────────────────────────────────────────

const manufacturers = [
  {
    name: "Volvo do Brasil Veículos Ltda",
    cnpj: "55.093.542/0001-37",
    cep: "80270-210",
    address: "Rodovia BR-277",
    addressNumber: "KM 188",
    complement: "Distrito Industrial",
    neighborhood: "Curitiba Industrial",
    city: "Curitiba",
    state: "PR",
    phone: "(41) 3317-8000",
    email: "contato@volvo.com.br",
    contactName: "Alexandre Bergström",
    latitude: "-25.4955",
    longitude: "-49.3199",
  },
  {
    name: "Scania Latin America Ltda",
    cnpj: "61.156.002/0001-98",
    cep: "09695-000",
    address: "Av. Scania",
    addressNumber: "1800",
    complement: "Portão Principal",
    neighborhood: "Piraporinha",
    city: "São Bernardo do Campo",
    state: "SP",
    phone: "(11) 4344-8000",
    email: "contato@scania.com.br",
    contactName: "Erik Lindqvist",
    latitude: "-23.7254",
    longitude: "-46.5650",
  },
  {
    name: "Mercedes-Benz do Brasil Ltda",
    cnpj: "60.820.937/0001-91",
    cep: "09750-901",
    address: "Av. Alfred Jurzykowski",
    addressNumber: "762",
    complement: "Prédio Administrativo",
    neighborhood: "Assunção",
    city: "São Bernardo do Campo",
    state: "SP",
    phone: "(11) 4173-5000",
    email: "contato@mercedes-benz.com.br",
    contactName: "Klaus Müller",
    latitude: "-23.7005",
    longitude: "-46.5610",
  },
];

// ─────────────────────────────────────────────────────────────
// 2. TRUCK MODELS (30 — 10 per manufacturer)
// ─────────────────────────────────────────────────────────────

const truckModels = [
  // Volvo (10)
  { brand: "Volvo", model: "FH 500", axleConfig: "6x4", averageConsumption: "2.80", vehicleValue: "650000" },
  { brand: "Volvo", model: "FH 460", axleConfig: "6x2", averageConsumption: "3.10", vehicleValue: "620000" },
  { brand: "Volvo", model: "FM 380", axleConfig: "4x2", averageConsumption: "3.40", vehicleValue: "480000" },
  { brand: "Volvo", model: "FMX 500", axleConfig: "8x4", averageConsumption: "2.50", vehicleValue: "720000" },
  { brand: "Volvo", model: "VM 270", axleConfig: "4x2", averageConsumption: "3.80", vehicleValue: "310000" },
  { brand: "Volvo", model: "FH 540", axleConfig: "6x4", averageConsumption: "2.70", vehicleValue: "690000" },
  { brand: "Volvo", model: "FH 420", axleConfig: "4x2", averageConsumption: "3.20", vehicleValue: "590000" },
  { brand: "Volvo", model: "FM 440", axleConfig: "6x2", averageConsumption: "2.95", vehicleValue: "540000" },
  { brand: "Volvo", model: "FMX 460", axleConfig: "6x4", averageConsumption: "2.60", vehicleValue: "680000" },
  { brand: "Volvo", model: "VM 310", axleConfig: "6x2", averageConsumption: "3.60", vehicleValue: "360000" },
  // Scania (10)
  { brand: "Scania", model: "R 450", axleConfig: "6x2", averageConsumption: "2.90", vehicleValue: "640000" },
  { brand: "Scania", model: "R 540", axleConfig: "6x4", averageConsumption: "2.65", vehicleValue: "670000" },
  { brand: "Scania", model: "S 500", axleConfig: "6x2", averageConsumption: "2.85", vehicleValue: "660000" },
  { brand: "Scania", model: "G 360", axleConfig: "4x2", averageConsumption: "3.30", vehicleValue: "490000" },
  { brand: "Scania", model: "P 310", axleConfig: "4x2", averageConsumption: "3.70", vehicleValue: "380000" },
  { brand: "Scania", model: "R 500", axleConfig: "6x4", averageConsumption: "2.75", vehicleValue: "655000" },
  { brand: "Scania", model: "S 580", axleConfig: "6x4", averageConsumption: "2.55", vehicleValue: "710000" },
  { brand: "Scania", model: "G 410", axleConfig: "6x2", averageConsumption: "3.00", vehicleValue: "520000" },
  { brand: "Scania", model: "P 360", axleConfig: "4x2", averageConsumption: "3.50", vehicleValue: "420000" },
  { brand: "Scania", model: "L 340", axleConfig: "4x2", averageConsumption: "3.60", vehicleValue: "400000" },
  // Mercedes-Benz (10)
  { brand: "Mercedes-Benz", model: "Actros 2651", axleConfig: "6x4", averageConsumption: "2.80", vehicleValue: "635000" },
  { brand: "Mercedes-Benz", model: "Actros 2546", axleConfig: "6x2", averageConsumption: "3.00", vehicleValue: "615000" },
  { brand: "Mercedes-Benz", model: "Atego 2430", axleConfig: "4x2", averageConsumption: "3.40", vehicleValue: "470000" },
  { brand: "Mercedes-Benz", model: "Arocs 3348", axleConfig: "8x4", averageConsumption: "2.40", vehicleValue: "730000" },
  { brand: "Mercedes-Benz", model: "Accelo 1016", axleConfig: "4x2", averageConsumption: "4.20", vehicleValue: "260000" },
  { brand: "Mercedes-Benz", model: "Actros 2658", axleConfig: "6x4", averageConsumption: "2.60", vehicleValue: "680000" },
  { brand: "Mercedes-Benz", model: "Atego 2726", axleConfig: "4x2", averageConsumption: "3.20", vehicleValue: "430000" },
  { brand: "Mercedes-Benz", model: "Arocs 2636", axleConfig: "6x4", averageConsumption: "2.70", vehicleValue: "690000" },
  { brand: "Mercedes-Benz", model: "Atego 1719", axleConfig: "4x2", averageConsumption: "3.80", vehicleValue: "350000" },
  { brand: "Mercedes-Benz", model: "Accelo 915", axleConfig: "4x2", averageConsumption: "4.50", vehicleValue: "230000" },
];

// ─────────────────────────────────────────────────────────────
// 3. CLIENTS (10) + DELIVERY LOCATIONS (2 each = 20)
// ─────────────────────────────────────────────────────────────

const clients = [
  {
    name: "Renault do Brasil S.A.",
    cnpj: "03.658.428/0001-79",
    cep: "83010-010",
    address: "Av. Renault",
    addressNumber: "1300",
    complement: "Portão A",
    neighborhood: "Quatro Barras",
    city: "São José dos Pinhais",
    state: "PR",
    phone: "(41) 3281-3000",
    email: "logistica@renault.com.br",
    contactName: "Thierry Dupont",
    dailyCost: "120.00",
    yardGraceDays: 5,
    locations: [
      {
        name: "Renault - Concessionária Curitiba Centro",
        cnpj: "03.658.428/0002-50",
        cep: "80010-020",
        address: "Rua XV de Novembro",
        addressNumber: "1500",
        neighborhood: "Centro",
        city: "Curitiba",
        state: "PR",
        responsibleName: "Marcos Andrade",
        responsiblePhone: "(41) 3322-5000",
        emails: ["marcos.andrade@renault.com.br", "logistica.cwb@renault.com.br"],
      },
      {
        name: "Renault - Concessionária São Paulo",
        cnpj: "03.658.428/0003-31",
        cep: "01310-100",
        address: "Av. Paulista",
        addressNumber: "2300",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        responsibleName: "Ana Paula Freitas",
        responsiblePhone: "(11) 3500-7000",
        emails: ["ana.freitas@renault.com.br", "logistica.sp@renault.com.br"],
      },
    ],
  },
  {
    name: "Toyota do Brasil Ltda",
    cnpj: "59.275.792/0001-50",
    cep: "09750-000",
    address: "Av. Pereira Barreto",
    addressNumber: "200",
    complement: "Bloco Comercial",
    neighborhood: "Rudge Ramos",
    city: "São Bernardo do Campo",
    state: "SP",
    phone: "(11) 4393-5000",
    email: "logistica@toyota.com.br",
    contactName: "Hiroshi Tanaka",
    dailyCost: "150.00",
    yardGraceDays: 7,
    locations: [
      {
        name: "Toyota - Concessionária Porto Alegre",
        cnpj: "59.275.792/0002-31",
        cep: "90010-150",
        address: "Av. Borges de Medeiros",
        addressNumber: "800",
        neighborhood: "Praia de Belas",
        city: "Porto Alegre",
        state: "RS",
        responsibleName: "Carlos Ritter",
        responsiblePhone: "(51) 3338-4000",
        emails: ["carlos.ritter@toyota.com.br"],
      },
      {
        name: "Toyota - Concessionária Belo Horizonte",
        cnpj: "59.275.792/0003-12",
        cep: "30110-000",
        address: "Av. Afonso Pena",
        addressNumber: "4000",
        neighborhood: "Funcionários",
        city: "Belo Horizonte",
        state: "MG",
        responsibleName: "Luciana Mota",
        responsiblePhone: "(31) 3277-9000",
        emails: ["luciana.mota@toyota.com.br", "logistica.bh@toyota.com.br"],
      },
    ],
  },
  {
    name: "General Motors do Brasil Ltda",
    cnpj: "59.275.000/0001-22",
    cep: "13060-904",
    address: "Av. Presidente Kennedy",
    addressNumber: "1500",
    complement: "Fábrica Principal",
    neighborhood: "Vila Independência",
    city: "São José dos Campos",
    state: "SP",
    phone: "(12) 3985-2000",
    email: "logistica@gm.com.br",
    contactName: "Steve Johnson",
    dailyCost: "140.00",
    yardGraceDays: 6,
    locations: [
      {
        name: "GM - Concessionária Recife",
        cnpj: "59.275.000/0002-03",
        cep: "50010-010",
        address: "Av. Guararapes",
        addressNumber: "1200",
        neighborhood: "Boa Vista",
        city: "Recife",
        state: "PE",
        responsibleName: "Francisco Melo",
        responsiblePhone: "(81) 3421-5000",
        emails: ["francisco.melo@gm.com.br"],
      },
      {
        name: "GM - Concessionária Salvador",
        cnpj: "59.275.000/0003-84",
        cep: "40020-280",
        address: "Av. Tancredo Neves",
        addressNumber: "3000",
        neighborhood: "Caminho das Árvores",
        city: "Salvador",
        state: "BA",
        responsibleName: "Jailson Carvalho",
        responsiblePhone: "(71) 3352-8000",
        emails: ["jailson.carvalho@gm.com.br", "logistica.ssa@gm.com.br"],
      },
    ],
  },
  {
    name: "Honda Automóveis do Brasil Ltda",
    cnpj: "48.593.106/0001-69",
    cep: "13040-902",
    address: "Av. Antônio Álvares Leite",
    addressNumber: "800",
    complement: "Portão Industrial",
    neighborhood: "Parque Industrial",
    city: "Sumaré",
    state: "SP",
    phone: "(19) 3816-8000",
    email: "logistica@honda.com.br",
    contactName: "Yuki Nakamura",
    dailyCost: "130.00",
    yardGraceDays: 5,
    locations: [
      {
        name: "Honda - Concessionária Goiânia",
        cnpj: "48.593.106/0002-40",
        cep: "74010-090",
        address: "Av. Anhanguera",
        addressNumber: "5500",
        neighborhood: "Setor Oeste",
        city: "Goiânia",
        state: "GO",
        responsibleName: "Roberta Nascimento",
        responsiblePhone: "(62) 3240-6000",
        emails: ["roberta.nascimento@honda.com.br"],
      },
      {
        name: "Honda - Concessionária Fortaleza",
        cnpj: "48.593.106/0003-21",
        cep: "60010-280",
        address: "Av. Dom Luís",
        addressNumber: "700",
        neighborhood: "Meireles",
        city: "Fortaleza",
        state: "CE",
        responsibleName: "Antônio Pinheiro",
        responsiblePhone: "(85) 3265-4000",
        emails: ["antonio.pinheiro@honda.com.br", "logistica.for@honda.com.br"],
      },
    ],
  },
  {
    name: "Stellantis Brasil Ltda",
    cnpj: "60.543.816/0001-31",
    cep: "09735-100",
    address: "Av. do Taboão",
    addressNumber: "8600",
    complement: "Fábrica Betim",
    neighborhood: "Assunção",
    city: "Betim",
    state: "MG",
    phone: "(31) 3539-2000",
    email: "logistica@stellantis.com.br",
    contactName: "Carlos Tavares Junior",
    dailyCost: "160.00",
    yardGraceDays: 7,
    locations: [
      {
        name: "Stellantis - Concessionária Manaus",
        cnpj: "60.543.816/0002-12",
        cep: "69010-050",
        address: "Av. Djalma Batista",
        addressNumber: "2100",
        neighborhood: "Chapada",
        city: "Manaus",
        state: "AM",
        responsibleName: "Eduardo Monteiro",
        responsiblePhone: "(92) 3584-7000",
        emails: ["eduardo.monteiro@stellantis.com.br"],
      },
      {
        name: "Stellantis - Concessionária Florianópolis",
        cnpj: "60.543.816/0003-93",
        cep: "88010-400",
        address: "Av. Mauro Ramos",
        addressNumber: "1200",
        neighborhood: "Centro",
        city: "Florianópolis",
        state: "SC",
        responsibleName: "Marina Silveira",
        responsiblePhone: "(48) 3215-9000",
        emails: ["marina.silveira@stellantis.com.br", "logistica.fln@stellantis.com.br"],
      },
    ],
  },
  {
    name: "Hyundai Caoa do Brasil Ltda",
    cnpj: "01.344.502/0001-88",
    cep: "12308-000",
    address: "Rodovia Presidente Dutra",
    addressNumber: "KM 154",
    complement: "Complexo Industrial",
    neighborhood: "Vila Industrial",
    city: "Jacareí",
    state: "SP",
    phone: "(12) 3844-6000",
    email: "logistica@hyundai.com.br",
    contactName: "Kim Seung-Woo",
    dailyCost: "110.00",
    yardGraceDays: 4,
    locations: [
      {
        name: "Hyundai - Concessionária Vitória",
        cnpj: "01.344.502/0002-69",
        cep: "29010-904",
        address: "Av. Fernando Ferrari",
        addressNumber: "1200",
        neighborhood: "Goiabeiras",
        city: "Vitória",
        state: "ES",
        responsibleName: "Renata Borges",
        responsiblePhone: "(27) 3315-5000",
        emails: ["renata.borges@hyundai.com.br"],
      },
      {
        name: "Hyundai - Concessionária Campo Grande",
        cnpj: "01.344.502/0003-40",
        cep: "79002-001",
        address: "Av. Afonso Pena",
        addressNumber: "3300",
        neighborhood: "Centro",
        city: "Campo Grande",
        state: "MS",
        responsibleName: "Leandro Chagas",
        responsiblePhone: "(67) 3321-4000",
        emails: ["leandro.chagas@hyundai.com.br", "logistica.cg@hyundai.com.br"],
      },
    ],
  },
  {
    name: "Volkswagen do Brasil Indústria de Veículos Ltda",
    cnpj: "59.104.422/0001-50",
    cep: "09550-000",
    address: "Via Anchieta",
    addressNumber: "KM 23.5",
    complement: "Complexo VW",
    neighborhood: "Vila Euclides",
    city: "São Bernardo do Campo",
    state: "SP",
    phone: "(11) 4236-8000",
    email: "logistica@vw.com.br",
    contactName: "Herbert Diess",
    dailyCost: "145.00",
    yardGraceDays: 6,
    locations: [
      {
        name: "VW - Concessionária Curitiba Batel",
        cnpj: "59.104.422/0002-31",
        cep: "80420-090",
        address: "Rua Comendador Araújo",
        addressNumber: "850",
        neighborhood: "Batel",
        city: "Curitiba",
        state: "PR",
        responsibleName: "Guilherme Andrade",
        responsiblePhone: "(41) 3225-7000",
        emails: ["guilherme.andrade@vw.com.br"],
      },
      {
        name: "VW - Concessionária Brasília",
        cnpj: "59.104.422/0003-12",
        cep: "70002-900",
        address: "SCS Quadra 06",
        addressNumber: "Bloco A",
        neighborhood: "Asa Sul",
        city: "Brasília",
        state: "DF",
        responsibleName: "Patrícia Leite",
        responsiblePhone: "(61) 3312-6000",
        emails: ["patricia.leite@vw.com.br", "logistica.bsb@vw.com.br"],
      },
    ],
  },
  {
    name: "Ford Motor Company Brasil Ltda",
    cnpj: "03.470.727/0001-35",
    cep: "13179-000",
    address: "Av. Henry Ford",
    addressNumber: "1000",
    complement: "Fábrica Tatuí",
    neighborhood: "Jardim América",
    city: "Camaçari",
    state: "BA",
    phone: "(71) 3626-8000",
    email: "logistica@ford.com.br",
    contactName: "Jim Farley",
    dailyCost: "135.00",
    yardGraceDays: 5,
    locations: [
      {
        name: "Ford - Concessionária Belém",
        cnpj: "03.470.727/0002-16",
        cep: "66010-000",
        address: "Av. Nazaré",
        addressNumber: "1800",
        neighborhood: "Nazaré",
        city: "Belém",
        state: "PA",
        responsibleName: "Otávio Figueiredo",
        responsiblePhone: "(91) 3276-3000",
        emails: ["otavio.figueiredo@ford.com.br"],
      },
      {
        name: "Ford - Concessionária Natal",
        cnpj: "03.470.727/0003-97",
        cep: "59010-100",
        address: "Av. Salgado Filho",
        addressNumber: "2200",
        neighborhood: "Lagoa Nova",
        city: "Natal",
        state: "RN",
        responsibleName: "Fernanda Costa",
        responsiblePhone: "(84) 3211-5000",
        emails: ["fernanda.costa@ford.com.br", "logistica.nat@ford.com.br"],
      },
    ],
  },
  {
    name: "Nissan do Brasil Automóveis Ltda",
    cnpj: "72.912.669/0001-77",
    cep: "83403-000",
    address: "Av. Nissan",
    addressNumber: "1600",
    complement: "Planta Industrial",
    neighborhood: "Resende Industrial",
    city: "Resende",
    state: "RJ",
    phone: "(24) 3381-7000",
    email: "logistica@nissan.com.br",
    contactName: "Makoto Uchida",
    dailyCost: "125.00",
    yardGraceDays: 5,
    locations: [
      {
        name: "Nissan - Concessionária Londrina",
        cnpj: "72.912.669/0002-58",
        cep: "86010-000",
        address: "Av. Higienópolis",
        addressNumber: "4000",
        neighborhood: "Centro",
        city: "Londrina",
        state: "PR",
        responsibleName: "Paulo Barros",
        responsiblePhone: "(43) 3344-6000",
        emails: ["paulo.barros@nissan.com.br"],
      },
      {
        name: "Nissan - Concessionária Uberlândia",
        cnpj: "72.912.669/0003-39",
        cep: "38400-122",
        address: "Av. João Naves de Ávila",
        addressNumber: "3200",
        neighborhood: "Santa Mônica",
        city: "Uberlândia",
        state: "MG",
        responsibleName: "Sandra Vieira",
        responsiblePhone: "(34) 3225-8000",
        emails: ["sandra.vieira@nissan.com.br", "logistica.udi@nissan.com.br"],
      },
    ],
  },
  {
    name: "Fiat Automóveis S.A.",
    cnpj: "01.622.439/0001-34",
    cep: "32531-000",
    address: "Rodovia Fernão Dias",
    addressNumber: "KM 429",
    complement: "Complexo Industrial Fiat",
    neighborhood: "Jardim Industrial",
    city: "Betim",
    state: "MG",
    phone: "(31) 3539-1000",
    email: "logistica@fiat.com.br",
    contactName: "Olivier François",
    dailyCost: "115.00",
    yardGraceDays: 4,
    locations: [
      {
        name: "Fiat - Concessionária Curitiba Norte",
        cnpj: "01.622.439/0002-15",
        cep: "82530-490",
        address: "Av. Comendador Franco",
        addressNumber: "7000",
        neighborhood: "Guabirotuba",
        city: "Curitiba",
        state: "PR",
        responsibleName: "Diego Martins",
        responsiblePhone: "(41) 3268-9000",
        emails: ["diego.martins@fiat.com.br"],
      },
      {
        name: "Fiat - Concessionária São Paulo ABC",
        cnpj: "01.622.439/0003-96",
        cep: "09010-170",
        address: "Av. dos Estados",
        addressNumber: "3500",
        neighborhood: "Jardim do Mar",
        city: "Santo André",
        state: "SP",
        responsibleName: "Cristina Souza",
        responsiblePhone: "(11) 4421-7000",
        emails: ["cristina.souza@fiat.com.br", "logistica.abc@fiat.com.br"],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // ── 1. Truck Models ──────────────────────────────────────
  console.log("📦 Criando 30 modelos de caminhão...");
  for (const m of truckModels) {
    await query(
      `INSERT INTO truck_models (brand, model, axle_config, average_consumption, vehicle_value, is_active)
       VALUES ($1,$2,$3,$4,$5,'true')
       ON CONFLICT DO NOTHING`,
      [m.brand, m.model, m.axleConfig, m.averageConsumption, m.vehicleValue]
    );
  }
  console.log("✅ 30 modelos criados.\n");

  // ── 2. Manufacturers ────────────────────────────────────
  console.log("🏭 Criando 3 montadoras...");
  const manufacturerIds: string[] = [];
  for (const m of manufacturers) {
    const res = await query(
      `INSERT INTO manufacturers (name, cep, address, address_number, complement, neighborhood, city, state,
         phone, email, contact_name, latitude, longitude, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'true')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [m.name, m.cep, m.address, m.addressNumber, m.complement, m.neighborhood, m.city, m.state,
       m.phone, m.email, m.contactName, m.latitude, m.longitude]
    );
    if (res.rows.length) manufacturerIds.push(res.rows[0].id);
  }
  // Fetch existing IDs if already inserted
  if (manufacturerIds.length < 3) {
    const res = await query(`SELECT id FROM manufacturers WHERE name = ANY($1) ORDER BY name`, [manufacturers.map(m => m.name)]);
    manufacturerIds.length = 0;
    res.rows.forEach(r => manufacturerIds.push(r.id));
  }
  console.log(`✅ ${manufacturerIds.length} montadoras criadas/encontradas.\n`);

  // ── 3. Clients + Delivery Locations ─────────────────────
  console.log("🏢 Criando 10 clientes com 2 locais de entrega cada...");
  const clientIds: string[] = [];
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const res = await query(
      `INSERT INTO clients (name, cnpj, cep, address, address_number, complement, neighborhood, city, state,
         phone, email, contact_name, daily_cost, yard_grace_days, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'true')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [c.name, c.cnpj, c.cep, c.address, c.addressNumber, c.complement, c.neighborhood, c.city, c.state,
       c.phone, c.email, c.contactName, c.dailyCost, c.yardGraceDays]
    );
    let clientId: string;
    if (res.rows.length) {
      clientId = res.rows[0].id;
    } else {
      const existing = await query(`SELECT id FROM clients WHERE cnpj=$1`, [c.cnpj]);
      clientId = existing.rows[0].id;
    }
    clientIds.push(clientId);

    for (const loc of c.locations) {
      await query(
        `INSERT INTO delivery_locations (client_id, name, cnpj, cep, address, address_number, neighborhood, city, state,
           responsible_name, responsible_phone, emails, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'true')
         ON CONFLICT DO NOTHING`,
        [clientId, loc.name, loc.cnpj, loc.cep, loc.address, loc.addressNumber,
         loc.neighborhood, loc.city, loc.state,
         loc.responsibleName, loc.responsiblePhone, loc.emails]
      );
    }
  }
  console.log(`✅ ${clients.length} clientes + ${clients.length * 2} locais criados.\n`);

  // ── 4. Drivers (100) ─────────────────────────────────────
  console.log("🧑‍✈️ Criando 100 motoristas com fotos e documentos...");

  // Check how many drivers already exist
  const existingDrivers = await query(`SELECT COUNT(*) FROM drivers`);
  const existingCount = parseInt(existingDrivers.rows[0].count);
  const toCreate = Math.max(0, 100 - existingCount);

  let created = 0;
  for (let i = 0; i < 200 && created < toCreate; i++) {
    const firstName = rand(firstNames);
    const lastName1 = rand(lastNames);
    const lastName2 = rand(lastNames);
    const name = `${firstName} ${lastName1} ${lastName2}`;
    const cpf = generateCPF(existingCount + i);
    const location = rand(cities);
    const driverType = rand(driverTypes);
    const cnhType = rand(cnhTypes);
    const modality = rand(modalities);
    const avatarId = randInt(1, 99);
    const profilePhoto = `https://i.pravatar.cc/300?img=${avatarId}`;
    const docBase = `https://placehold.co/800x500/e8e8e8/555555?text=Documento`;
    const year = randInt(1975, 2000);
    const month = pad(randInt(1, 12));
    const day = pad(randInt(1, 28));
    const birthDate = `${year}-${month}-${day}`;
    const email = `${firstName.toLowerCase()}.${lastName1.toLowerCase()}${randInt(10,99)}@email.com.br`;

    try {
      await query(
        `INSERT INTO drivers (name, cpf, phone, email, birth_date, cep, address, address_number,
           neighborhood, city, state, driver_type, modality, cnh_type,
           profile_photo, cnh_front_photo, cnh_back_photo, rg_photo, address_proof_photo,
           is_apto, is_active, documents_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                 'true','true','aprovado')`,
        [
          name, cpf, generatePhone(location.ddd), email, birthDate,
          location.cep, location.address, String(randInt(100, 9999)),
          location.neighborhood, location.city, location.state,
          driverType, modality, cnhType,
          profilePhoto,
          `${docBase}+CNH+Frente`,
          `${docBase}+CNH+Verso`,
          `${docBase}+RG`,
          `${docBase}+Comprovante+Residencia`,
        ]
      );
      created++;
    } catch (e: any) {
      if (!e.message?.includes("unique") && !e.message?.includes("duplicate")) {
        console.error(`  Erro motorista ${i}:`, e.message);
      }
    }
  }
  console.log(`✅ ${created} motoristas criados (total: ${existingCount + created}).\n`);

  // ── 5. Vehicles / Estoque (100) ──────────────────────────
  console.log("🚗 Criando 100 veículos em estoque...");

  const existingVehicles = await query(`SELECT COUNT(*) FROM vehicles`);
  const existingVehicleCount = parseInt(existingVehicles.rows[0].count);
  const vehiclesToCreate = Math.max(0, 100 - existingVehicleCount);

  // Get first yard (if any)
  const yardsRes = await query(`SELECT id FROM yards LIMIT 5`);
  const yardIds = yardsRes.rows.map(r => r.id);

  let vehiclesCreated = 0;
  const statusWeights = [
    ...Array(20).fill("pre_estoque"),
    ...Array(40).fill("em_estoque"),
    ...Array(15).fill("em_transferencia"),
    ...Array(15).fill("despachado"),
    ...Array(7).fill("entregue"),
    ...Array(3).fill("retirado"),
  ];

  for (let i = 0; i < vehiclesToCreate; i++) {
    const chassi = `9BW${String(existingVehicleCount + i + 1).padStart(14, "0")}`;
    const clientId = rand(clientIds);
    const manufacturerId = rand(manufacturerIds);
    const yardId = yardIds.length ? rand(yardIds) : null;
    const color = rand(vehicleColors);
    const status = rand(statusWeights);

    const now = new Date();
    const collectDT = new Date(now.getTime() - randInt(1, 90) * 86400000);
    const yardEntryDT = new Date(collectDT.getTime() + randInt(1, 5) * 86400000);
    const dispatchDT = ["despachado","entregue","retirado"].includes(status)
      ? new Date(yardEntryDT.getTime() + randInt(1, 30) * 86400000)
      : null;
    const deliveryDT = ["entregue","retirado"].includes(status) && dispatchDT
      ? new Date(dispatchDT.getTime() + randInt(1, 10) * 86400000)
      : null;

    try {
      await query(
        `INSERT INTO vehicles (chassi, client_id, yard_id, manufacturer_id, color, status,
           collect_date_time, yard_entry_date_time, dispatch_date_time, delivery_date_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (chassi) DO NOTHING`,
        [chassi, clientId, yardId, manufacturerId, color, status,
         collectDT, yardEntryDT, dispatchDT, deliveryDT]
      );
      vehiclesCreated++;
    } catch (e: any) {
      console.error(`Erro ao criar veículo ${chassi}:`, e.message);
    }
  }
  console.log(`✅ ${vehiclesCreated} veículos criados (total: ${existingVehicleCount + vehiclesCreated}).\n`);

  // ── Done ────────────────────────────────────────────────
  console.log("🎉 Seed concluído com sucesso!");
  console.log(`   📦 30 modelos de caminhão`);
  console.log(`   🏭 3 montadoras`);
  console.log(`   🏢 10 clientes + 20 locais de entrega`);
  console.log(`   🧑‍✈️ ~100 motoristas com fotos e documentos`);
  console.log(`   🚗 ~100 veículos em estoque`);

  await pool.end();
}

seed().catch(e => {
  console.error("❌ Erro no seed:", e);
  pool.end();
  process.exit(1);
});
