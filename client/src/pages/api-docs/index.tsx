import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code, Server, Key, FileText, Download, FileDown } from "lucide-react";
import { jsPDF } from "jspdf";

interface EndpointDoc {
  method: "POST" | "GET" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  headers: { name: string; value: string; description: string }[];
  body: {
    field: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  example: object;
  response: object;
}

const endpoints: { category: string; items: EndpointDoc[] }[] = [
  {
    category: "Motoristas",
    items: [
      {
        method: "POST",
        path: "/api/external/drivers/register",
        description: "Cadastra um novo motorista sem necessidade de autenticação — use este endpoint no primeiro contato do motorista com o aplicativo (auto-cadastro). Email e senha são obrigatórios: ao concluir o cadastro, uma conta de acesso com role 'motorista' é criada automaticamente. Envie como multipart/form-data para incluir foto de perfil, CNH, RG e comprovante de residência.",
        headers: [
          { name: "Content-Type", value: "multipart/form-data", description: "Tipo do conteúdo (formulário com arquivos)" },
        ],
        body: [
          { field: "name", type: "string", required: true, description: "Nome completo do motorista" },
          { field: "cpf", type: "string", required: true, description: "CPF do motorista (somente números)" },
          { field: "phone", type: "string", required: true, description: "Telefone com DDD" },
          { field: "birthDate", type: "string", required: true, description: "Data de nascimento (YYYY-MM-DD)" },
          { field: "cnhType", type: "string", required: true, description: "Categoria da CNH (A, B, C, D, E, AB, AC, AD, AE)" },
          { field: "email", type: "string", required: true, description: "E-mail do motorista — usado como login. Deve ser único no sistema" },
          { field: "password", type: "string", required: true, description: "Senha de acesso (mín. 6 caracteres) — cria automaticamente conta de acesso com role motorista" },
          { field: "profilePhotoFile", type: "file", required: false, description: "Foto de perfil do motorista (JPG, PNG)" },
          { field: "cnhFrontFile", type: "file", required: false, description: "Imagem da frente da CNH (JPG, PNG)" },
          { field: "cnhBackFile", type: "file", required: false, description: "Imagem do verso da CNH (JPG, PNG)" },
          { field: "rgFile", type: "file", required: false, description: "Imagem do RG (frente ou aberto) (JPG, PNG)" },
          { field: "addressProofFile", type: "file", required: false, description: "Imagem do comprovante de residência (JPG, PNG)" },
          { field: "cep", type: "string", required: false, description: "CEP do endereço" },
          { field: "address", type: "string", required: false, description: "Rua/Logradouro" },
          { field: "addressNumber", type: "string", required: false, description: "Número" },
          { field: "complement", type: "string", required: false, description: "Complemento" },
          { field: "neighborhood", type: "string", required: false, description: "Bairro" },
          { field: "city", type: "string", required: false, description: "Cidade" },
          { field: "state", type: "string", required: false, description: "Estado (UF)" },
          { field: "modality", type: "string", required: false, description: "Modalidade: pj, clt ou agregado" },
          { field: "driverType", type: "string", required: false, description: "Tipo de motorista — definido automaticamente como 'transporte' para cadastros pelo app" },
        ],
        example: {
          "Content-Type": "multipart/form-data",
          "nota": "Sem Authorization header — endpoint público",
          "campos_texto": {
            name: "João Silva",
            cpf: "12345678900",
            phone: "11999998888",
            birthDate: "1985-03-15",
            cnhType: "D",
            email: "joao.silva@email.com",
            password: "senha123",
            city: "Curitiba",
            state: "PR",
          },
          "campos_arquivo": {
            profilePhotoFile: "<foto_perfil.jpg>",
            cnhFrontFile: "<cnh_frente.jpg>",
            cnhBackFile: "<cnh_verso.jpg>",
            rgFile: "<rg.jpg>",
            addressProofFile: "<comprovante_residencia.jpg>",
          }
        },
        response: {
          id: "uuid-do-motorista",
          name: "João Silva",
          cpf: "12345678900",
          cnhType: "D",
          city: "Curitiba",
          state: "PR",
          profilePhoto: "/uploads/perfil001.jpg",
          cnhFrontPhoto: "/uploads/cnh_frente123.jpg",
          cnhBackPhoto: "/uploads/cnh_verso456.jpg",
          rgPhoto: "/uploads/rg789.jpg",
          addressProofPhoto: "/uploads/comprovante012.jpg",
          isActive: "true",
          documentsApproved: "pendente",
          createdAt: "2026-04-06T14:16:18.423Z",
        }
      },
      {
        method: "POST",
        path: "/api/drivers",
        description: "Cria um novo motorista no sistema (uso interno — requer autenticação admin). Envie como multipart/form-data para incluir os arquivos de foto de perfil, CNH (frente e verso), RG e comprovante de residência.",
        headers: [
          { name: "Content-Type", value: "multipart/form-data", description: "Tipo do conteúdo (formulário com arquivos)" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso" },
        ],
        body: [
          { field: "name", type: "string", required: true, description: "Nome completo do motorista" },
          { field: "cpf", type: "string", required: true, description: "CPF do motorista (somente números)" },
          { field: "phone", type: "string", required: true, description: "Telefone com DDD" },
          { field: "birthDate", type: "string", required: true, description: "Data de nascimento (YYYY-MM-DD)" },
          { field: "cnhType", type: "string", required: true, description: "Categoria da CNH (A, B, C, D, E, AB, AC, AD, AE)" },
          { field: "profilePhotoFile", type: "file", required: false, description: "Foto de perfil do motorista (JPG, PNG)" },
          { field: "cnhFrontFile", type: "file", required: false, description: "Imagem da frente da CNH (JPG, PNG)" },
          { field: "cnhBackFile", type: "file", required: false, description: "Imagem do verso da CNH (JPG, PNG)" },
          { field: "rgFile", type: "file", required: false, description: "Imagem do RG (frente ou aberto) (JPG, PNG)" },
          { field: "addressProofFile", type: "file", required: false, description: "Imagem do comprovante de residência (JPG, PNG, PDF)" },
          { field: "email", type: "string", required: false, description: "E-mail do motorista" },
          { field: "cep", type: "string", required: false, description: "CEP do endereço" },
          { field: "address", type: "string", required: false, description: "Rua/Logradouro" },
          { field: "addressNumber", type: "string", required: false, description: "Número" },
          { field: "complement", type: "string", required: false, description: "Complemento" },
          { field: "neighborhood", type: "string", required: false, description: "Bairro" },
          { field: "city", type: "string", required: false, description: "Cidade" },
          { field: "state", type: "string", required: false, description: "Estado (UF)" },
          { field: "modality", type: "string", required: false, description: "Modalidade: pj, clt ou agregado" },
          { field: "driverType", type: "string", required: false, description: "Tipo de motorista — definido automaticamente como 'transporte' para cadastros pelo app" },
          { field: "password", type: "string", required: false, description: "Senha de acesso ao sistema (mín. 6 caracteres). Se informada junto com email, cria automaticamente o usuário com role motorista" },
        ],
        example: {
          "Content-Type": "multipart/form-data",
          "campos_texto": {
            name: "João Silva",
            cpf: "12345678900",
            phone: "11999998888",
            birthDate: "1985-03-15",
            cnhType: "D",
            modality: "pj",
            driverType: "transporte",
            email: "joao.silva@email.com",
            password: "senha123",
          },
          "campos_arquivo": {
            profilePhotoFile: "<foto_perfil.jpg>",
            cnhFrontFile: "<arquivo_cnh_frente.jpg>",
            cnhBackFile: "<arquivo_cnh_verso.jpg>",
            rgFile: "<arquivo_rg.jpg>",
            addressProofFile: "<comprovante_residencia.jpg>",
          }
        },
        response: {
          id: "uuid-do-motorista",
          name: "João Silva",
          cpf: "12345678900",
          modality: "pj",
          driverType: "transporte",
          profilePhoto: "/uploads/perfil001.jpg",
          cnhFrontPhoto: "/uploads/abc123.jpg",
          cnhBackPhoto: "/uploads/def456.jpg",
          rgPhoto: "/uploads/rg789.jpg",
          addressProofPhoto: "/uploads/comprovante012.jpg",
        }
      },
      {
        method: "GET",
        path: "/api/drivers/:id/user-account",
        description: "Verifica se o motorista possui conta de acesso ao sistema. Retorna se existe um usuário vinculado pelo e-mail do motorista.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso" },
        ],
        body: [],
        example: {},
        response: {
          exists: true,
          email: "joao.silva@email.com",
          username: "joao.silva",
          isActive: "true"
        }
      },
      {
        method: "POST",
        path: "/api/drivers/:id/update-password",
        description: "Cria ou atualiza a senha de acesso do motorista ao sistema. Se o motorista não tiver conta, cria uma automaticamente com role 'motorista'. O motorista deve ter um e-mail cadastrado.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso" },
        ],
        body: [
          { field: "password", type: "string", required: true, description: "Nova senha (mínimo 6 caracteres)" },
        ],
        example: {
          password: "novaSenha123"
        },
        response: {
          message: "Senha atualizada com sucesso"
        }
      },
      {
        method: "GET",
        path: "/api/external/driver/my-transports/in-progress",
        description: "Retorna apenas os transportes do motorista autenticado que estão em andamento — ou seja, com check-in já realizado (checkinDateTime preenchido) e check-out ainda pendente (checkoutDateTime nulo). Útil para o app mobile listar transportes prontos para finalização. O motorista é identificado pelo token JWT. Resultado ordenado pelo check-in mais recente primeiro.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
        ],
        body: [],
        example: {
          "nota": "GET /api/external/driver/my-transports/in-progress",
          "autenticacao": "Bearer token obtido via /api/external/auth/token"
        },
        response: [
          {
            id: "ed326ac6-723c-4804-adee-6f9cb814d9a6",
            requestNumber: "OTD00004",
            vehicleChassi: "9BWZZZ377VT004251",
            status: "aguardando_saida",
            checkinDateTime: "2026-04-25T14:30:00.000Z",
            checkoutDateTime: null,
            checkinFrontalPhoto: "/uploads/abc123.jpg",
            checkinInteriorPhotos: ["/uploads/int1.jpg"],
          }
        ]
      },
      {
        method: "GET",
        path: "/api/external/driver/expense-settlements/pending",
        description: "Lista todas as prestações de contas do motorista autenticado que estão **abertas** — ou seja, com status `pendente` (recém-criada após check-in, motorista lançando despesas) ou `enviado` (Aguardando Análise pelo financeiro). Útil para o app mobile mostrar ao motorista as prestações que ainda exigem ação. Retorna array com dados enriquecidos: número do transporte, origem/destino, totais, adiantamento e lista completa de itens (despesas) já lançados. Ordenado pela data de criação (mais recente primeiro).",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
        ],
        body: [],
        example: {
          "nota": "GET /api/external/driver/expense-settlements/pending",
          "autenticacao": "Bearer token obtido via /api/external/auth/token"
        },
        response: [
          {
            id: "1dc55598-f223-4797-83b1-7e74e08ad4e3",
            transportId: "9e9afa45-1f4c-4ed4-b797-d638f12906d5",
            requestNumber: "OTD00041",
            status: "pendente",
            statusLabel: "Pendente",
            advanceAmount: "1199.13",
            totalExpenses: null,
            balanceAmount: null,
            routeDistance: "856.36 km",
            estimatedTolls: "95.00",
            estimatedFuel: "1391.59",
            submittedAt: null,
            createdAt: "2026-04-25T20:38:29.024Z",
            origin: { name: "OTD Matriz", city: "São José dos Pinhais", state: "PR" },
            destination: { name: "Gavea Volvo", city: "Brazil", state: "" },
            itemsCount: 1,
            items: [
              {
                id: "7963f57b-1ce8-4d5a-95ac-3c404de66351",
                type: "hospedagem",
                description: "teste",
                country: null,
                currency: "CLP",
                amount: "0",
                photoUrl: "/uploads/f66da4fb-a559-4362-8cf1-e8005c04c265.PNG",
                photoStatus: "ok",
                itemStatus: "aprovado",
                approvedAmount: "150000",
                createdAt: "2026-04-25T20:42:41.705Z"
              }
            ]
          }
        ]
      },
      {
        method: "POST",
        path: "/api/external/driver/expense-settlements/:settlementId/items",
        description: "Adiciona uma despesa (item) à prestação de contas do motorista. O motorista é identificado pelo token JWT e só pode adicionar despesas em prestações vinculadas a ele. Aceita upload de imagem (multipart/form-data) com a foto do comprovante. O `settlementId` pode ser obtido em `GET /api/external/driver/my-transports/in-progress` (campo `expenses.settlementId`). A moeda é definida automaticamente a partir do país (BR→BRL, AR→ARS, CL→CLP, PE→PEN, UY→UYU), mas pode ser sobrescrita.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso do motorista" },
          { name: "Content-Type", value: "multipart/form-data", description: "Obrigatório para upload de imagem" },
        ],
        body: [
          { name: "country", type: "string", required: true, description: "País de origem da despesa (BR, AR, CL, PE, UY)" },
          { name: "type", type: "string", required: true, description: "Tipo de despesa: combustivel, pedagio, hospedagem, alimentacao, passagem, outros" },
          { name: "description", type: "string", required: false, description: "Observação (até 200 caracteres)" },
          { name: "amount", type: "string", required: false, description: "Valor da despesa na moeda do país (default \"0\" — pode ser editado depois)" },
          { name: "currency", type: "string", required: false, description: "Moeda (BRL, ARS, CLP, PEN, UYU). Se omitida, é deduzida do país." },
          { name: "photoFile", type: "file", required: true, description: "Foto do comprovante (JPEG, PNG, WebP, HEIC, PDF — até 10MB)" },
        ],
        example: {
          "nota": "Use multipart/form-data. Exemplo de campos enviados:",
          "country": "BR",
          "type": "combustivel",
          "description": "Abastecimento posto Shell BR-376",
          "amount": "215.30",
          "photoFile": "(arquivo binário .jpg/.png)"
        },
        response: {
          id: "item-uuid-1",
          settlementId: "9f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
          type: "combustivel",
          country: "BR",
          currency: "BRL",
          amount: "215.30",
          description: "Abastecimento posto Shell BR-376",
          photoUrl: "/uploads/abc123.jpg",
          photoStatus: "ok",
          itemStatus: "pendente",
          createdAt: "2026-04-25T15:10:00.000Z"
        }
      },
      {
        method: "POST",
        path: "/api/external/driver/expense-settlements/:settlementId/finalize",
        description: "Finaliza o envio da prestação de contas pelo motorista. Marca o campo `driverFinishedSubmissionAt` com o momento atual, muda o status de `pendente` (ou `devolvido`) para `enviado` (Aguardando Análise), e calcula automaticamente `totalExpenses` e `balanceAmount` somando todos os itens lançados. Após finalizar, o motorista não consegue mais adicionar/editar despesas — só voltará a poder se o financeiro devolver a prestação. Requer pelo menos 1 despesa lançada e que a prestação pertença ao motorista autenticado.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso do motorista" },
        ],
        body: [],
        example: {
          "nota": "POST /api/external/driver/expense-settlements/9f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c/finalize",
          "autenticacao": "Bearer token obtido via /api/external/auth/token"
        },
        response: {
          id: "9f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
          status: "enviado",
          statusLabel: "Aguardando Análise",
          driverFinishedSubmissionAt: "2026-04-27T18:30:00.000Z",
          submittedAt: "2026-04-27T18:30:00.000Z",
          totalExpenses: "1850.30",
          advanceAmount: "1199.13",
          balanceAmount: "651.17",
          itemsCount: 5,
          message: "Envio finalizado com sucesso. A prestação está aguardando análise do financeiro."
        }
      },
      {
        method: "GET",
        path: "/api/external/driver/my-transports",
        description: "Retorna todos os transportes do motorista logado no app. O motorista é identificado automaticamente pelo token JWT (via e-mail do usuário autenticado) — sem necessidade de informar o ID na URL. A resposta inclui dados enriquecidos: cliente, pátio de origem, local de entrega, dados do motorista e tarifa de viagem. Retorna array vazio se não houver transportes. Use o access_token obtido em /api/external/auth/token.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
        ],
        body: [],
        example: {
          "nota": "GET /api/external/driver/my-transports",
          "autenticacao": "Bearer token obtido via /api/external/auth/token"
        },
        response: [
          {
            id: "ed326ac6-723c-4804-adee-6f9cb814d9a6",
            requestNumber: "OTD00004",
            vehicleChassi: "9BWZZZ377VT004251",
            status: "pendente",
            deliveryDate: "2026-04-08",
            routeDistanceKm: "512.18",
            estimatedTolls: "55.90",
            estimatedFuel: "832.29",
            client: {
              id: "uuid-do-cliente",
              name: "Volvo Paulinia",
              phone: "11202060545",
              contactName: "Carolina Volvo"
            },
            originYard: {
              id: "uuid-do-patio",
              name: "OTD Matriz",
              city: "São José dos Pinhais",
              state: "PR"
            },
            deliveryLocation: {
              id: "uuid-do-local",
              name: "Paulinia Centro",
              city: "Paulínia",
              state: "SP",
              responsibleName: "Joao Ribeiro",
              responsiblePhone: "1120216040"
            },
            driver: {
              id: "uuid-do-motorista",
              name: "Ricardo Stafim",
              phone: "41992392227",
              cnhType: "B"
            },
            travelRate: {
              id: "uuid-da-tarifa",
              name: "Tarifa Normal",
              rateType: "por_km",
              rateValue: "1.20"
            },
            createdAt: "2026-04-07T19:27:05.816Z"
          }
        ]
      }
    ]
  },
  {
    category: "Localidades",
    items: [
      {
        method: "GET",
        path: "/api/locations/states",
        description: "Lista todos os 27 estados brasileiros em ordem alfabética. Endpoint público, sem necessidade de autenticação. Os dados são obtidos da API do IBGE com cache de 24h.",
        headers: [],
        body: [],
        example: {},
        response: [
          { uf: "AC", name: "Acre" },
          { uf: "AL", name: "Alagoas" },
          { uf: "AM", name: "Amazonas" },
          { uf: "...", name: "..." },
          { uf: "SP", name: "São Paulo" },
        ]
      },
      {
        method: "GET",
        path: "/api/locations/cities/:uf",
        description: "Lista todos os municípios de um estado brasileiro em ordem alfabética. Substitua :uf pela sigla do estado (ex: PR, SP, RJ). Endpoint público, sem necessidade de autenticação. Os dados são obtidos da API do IBGE com cache de 24h.",
        headers: [],
        body: [],
        example: {
          "url_exemplo": "/api/locations/cities/PR",
          "nota": "Substitua PR pela UF desejada: SP, RJ, MG, BA, RS, SC, etc."
        },
        response: [
          { id: 4100103, name: "Abatiá" },
          { id: 4100202, name: "Adrianópolis" },
          { id: 4100301, name: "Agudos do Sul" },
          { id: "...", name: "..." },
        ]
      }
    ]
  },
  {
    category: "Coletas",
    items: [
      {
        method: "POST",
        path: "/api/collects",
        description: "Cria uma nova coleta ou transferência de veículo (uso interno — requer autenticação). O campo collectType define o tipo: 'coleta' para retirada na montadora (exige manufacturerId) ou 'transferencia' para movimentação entre pátios OTD (exige originYardId, diferente de yardId). Para coletas, o veículo é criado automaticamente com status 'pre_estoque' se não existir. Para transferências, o veículo já deve existir no sistema.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso" },
        ],
        body: [
          { field: "collectType", type: "string", required: false, description: "Tipo do registro: 'coleta' (padrão) ou 'transferencia'" },
          { field: "vehicleChassi", type: "string", required: true, description: "Chassi do veículo" },
          { field: "manufacturerId", type: "string", required: false, description: "UUID da montadora de origem — obrigatório quando collectType='coleta'" },
          { field: "originYardId", type: "string", required: false, description: "UUID do pátio de origem — obrigatório quando collectType='transferencia'. Deve ser diferente de yardId" },
          { field: "yardId", type: "string", required: true, description: "UUID do pátio de destino" },
          { field: "driverId", type: "string", required: false, description: "UUID do motorista responsável" },
          { field: "collectDate", type: "string (datetime)", required: false, description: "Data/hora prevista da coleta ou transferência" },
          { field: "notes", type: "string", required: false, description: "Observações" },
        ],
        example: {
          "exemplo_coleta": {
            collectType: "coleta",
            vehicleChassi: "9BWZZZ377VT004251",
            manufacturerId: "uuid-da-montadora",
            yardId: "uuid-do-patio-destino",
            driverId: "uuid-do-motorista",
            notes: "Coleta urgente"
          },
          "exemplo_transferencia": {
            collectType: "transferencia",
            vehicleChassi: "9BWZZZ377VT004251",
            originYardId: "uuid-do-patio-origem",
            yardId: "uuid-do-patio-destino",
            driverId: "uuid-do-motorista",
            notes: "Transferência entre pátios"
          }
        },
        response: {
          id: "uuid-da-coleta",
          collectType: "coleta",
          collectDate: "2026-01-15T14:30:00.000Z",
          status: "em_transito",
          driverId: "uuid-do-motorista",
          manufacturerId: "uuid-da-montadora",
          originYardId: null,
          yardId: "uuid-do-patio",
        }
      }
    ]
  },
  {
    category: "Coletas do Motorista",
    items: [
      {
        method: "POST",
        path: "/api/external/transports/:id/checkin",
        description: "Realiza o check-in do motorista em um transporte. Deve ser enviado como multipart/form-data. O motorista é identificado pelo token JWT — não é necessário informar o driverId. Valida que o transporte pertence ao motorista autenticado. Muda o status para 'aguardando_saida' e registra data/hora, localização GPS e fotos do veículo. Retorna 400 se o check-in já foi realizado ou o transporte está cancelado/entregue.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
          { name: "Content-Type", value: "multipart/form-data", description: "Envio com arquivos de foto" },
        ],
        body: [
          { field: "latitude", type: "string", required: true, description: "Latitude GPS da localização atual do motorista" },
          { field: "longitude", type: "string", required: true, description: "Longitude GPS da localização atual do motorista" },
          { field: "notes", type: "string", required: false, description: "Observações do check-in" },
          { field: "frontalPhotoFile", type: "file", required: false, description: "Foto frontal do veículo (JPG, PNG)" },
          { field: "lateral1PhotoFile", type: "file", required: false, description: "Foto lateral esquerda do veículo" },
          { field: "lateral2PhotoFile", type: "file", required: false, description: "Foto lateral direita do veículo" },
          { field: "traseiraPhotoFile", type: "file", required: false, description: "Foto traseira do veículo" },
          { field: "odometerPhotoFile", type: "file", required: false, description: "Foto do odômetro" },
          { field: "fuelLevelPhotoFile", type: "file", required: false, description: "Foto do nível de combustível" },
          { field: "selfiePhotoFile", type: "file", required: false, description: "Selfie do motorista com o veículo" },
          { field: "damagePhotoFiles", type: "file[]", required: false, description: "Fotos de avarias (até 10 arquivos)" },
          { field: "interiorPhotoFiles", type: "file[]", required: false, description: "Fotos do interior do veículo (até 10 arquivos)" },
        ],
        example: {
          "url_exemplo": "POST /api/external/transports/{id}/checkin",
          "campos_texto": {
            latitude: "-25.6359",
            longitude: "-49.1816",
            notes: "Veículo em bom estado"
          },
          "campos_arquivo": {
            frontalPhotoFile: "<foto_frontal.jpg>",
            selfiePhotoFile: "<selfie.jpg>",
            interiorPhotoFiles: ["<interior_1.jpg>", "<interior_2.jpg>"]
          }
        },
        response: {
          message: "Check-in realizado com sucesso",
          transport: {
            id: "uuid-do-transporte",
            status: "aguardando_saida",
            checkinDateTime: "2026-04-07T14:30:00.000Z",
            checkinFrontalPhoto: "/uploads/abc123.jpg",
            checkinSelfiePhoto: "/uploads/def456.jpg",
            checkinInteriorPhotos: ["/uploads/int1.jpg", "/uploads/int2.jpg"],
            checkinNotes: "Veículo em bom estado"
          }
        }
      },
      {
        method: "POST",
        path: "/api/external/transports/:id/checkout",
        description: "Realiza o check-out do motorista em um transporte (entrega ao cliente). Deve ser enviado como multipart/form-data. O motorista é identificado pelo token JWT. Valida que o transporte pertence ao motorista e que o check-in já foi realizado. Muda o status para 'entregue' e atualiza o veículo. Retorna 400 se o check-in não foi realizado ou o transporte já está entregue/cancelado.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
          { name: "Content-Type", value: "multipart/form-data", description: "Envio com arquivos de foto" },
        ],
        body: [
          { field: "latitude", type: "string", required: true, description: "Latitude GPS da localização atual do motorista" },
          { field: "longitude", type: "string", required: true, description: "Longitude GPS da localização atual do motorista" },
          { field: "notes", type: "string", required: false, description: "Observações do check-out / entrega" },
          { field: "frontalPhotoFile", type: "file", required: false, description: "Foto frontal do veículo na entrega (JPG, PNG)" },
          { field: "lateral1PhotoFile", type: "file", required: false, description: "Foto lateral esquerda na entrega" },
          { field: "lateral2PhotoFile", type: "file", required: false, description: "Foto lateral direita na entrega" },
          { field: "traseiraPhotoFile", type: "file", required: false, description: "Foto traseira na entrega" },
          { field: "odometerPhotoFile", type: "file", required: false, description: "Foto do odômetro na entrega" },
          { field: "fuelLevelPhotoFile", type: "file", required: false, description: "Foto do nível de combustível na entrega" },
          { field: "selfiePhotoFile", type: "file", required: false, description: "Selfie do motorista na entrega" },
          { field: "damagePhotoFiles", type: "file[]", required: false, description: "Fotos de avarias na entrega (até 10 arquivos)" },
          { field: "interiorPhotoFiles", type: "file[]", required: false, description: "Fotos do interior do veículo na entrega (até 10 arquivos)" },
        ],
        example: {
          "url_exemplo": "POST /api/external/transports/{id}/checkout",
          "campos_texto": {
            latitude: "-23.5505",
            longitude: "-46.6333",
            notes: "Entrega realizada ao responsável João"
          },
          "campos_arquivo": {
            frontalPhotoFile: "<foto_entrega.jpg>",
            selfiePhotoFile: "<selfie_entrega.jpg>",
            interiorPhotoFiles: ["<interior_1.jpg>", "<interior_2.jpg>"]
          }
        },
        response: {
          message: "Check-out realizado com sucesso",
          transport: {
            id: "uuid-do-transporte",
            status: "entregue",
            checkoutDateTime: "2026-04-08T16:45:00.000Z",
            checkoutFrontalPhoto: "/uploads/ghi789.jpg",
            checkoutSelfiePhoto: "/uploads/jkl012.jpg",
            checkoutInteriorPhotos: ["/uploads/int1.jpg", "/uploads/int2.jpg"],
            checkoutNotes: "Entrega realizada ao responsável João"
          }
        }
      },
      {
        method: "GET",
        path: "/api/external/driver/my-collects",
        description: "Retorna todas as coletas do motorista vinculado ao usuário autenticado. Por padrão retorna todos os status; use o query param '?status=' para filtrar. O motorista é identificado automaticamente pelo token JWT via e-mail do usuário autenticado. Requer autenticação com token de usuário com role 'motorista'.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
        ],
        body: [
          { field: "status (query param)", type: "string", required: false, description: "Filtra pelo status da coleta. Valores aceitos: pendente, em_transito, finalizada, autorizado_portaria, cancelada" },
        ],
        example: {
          "nota": "GET /api/external/driver/my-collects?status=em_transito",
          "filtrar_por_status": "?status=em_transito (opcional — sem parâmetro retorna todas)"
        },
        response: {
          driver: {
            id: "uuid-do-motorista",
            name: "João Silva",
            cpf: "123.456.789-00",
            phone: "11999998888",
            email: "joao.silva@email.com",
            driverType: "coleta",
            profilePhoto: "/uploads/perfil001.jpg"
          },
          collects: [
            {
              id: "uuid-da-coleta",
              vehicleChassi: "9BWZZZ377VT004251",
              status: "em_transito",
              collectDate: "2026-03-31T14:30:00.000Z",
              driverId: "uuid-do-motorista",
              manufacturerId: "uuid-da-montadora",
              yardId: "uuid-do-patio",
              checkinAt: null,
              checkoutAt: null,
              notes: "Coleta urgente",
              createdAt: "2026-03-31T08:00:00.000Z",
              manufacturer: {
                id: "uuid-da-montadora",
                name: "Volkswagen do Brasil",
                city: "São Bernardo do Campo",
                state: "SP"
              },
              yard: {
                id: "uuid-do-patio",
                name: "Pátio Central SP",
                city: "São Paulo",
                state: "SP"
              }
            }
          ],
          total: 1
        }
      },
      {
        method: "POST",
        path: "/api/external/collects",
        description: "Cria uma nova coleta ou transferência pelo app mobile. O driverId é preenchido automaticamente pelo token JWT do motorista — não é necessário enviá-lo. Use collectType='coleta' (padrão) para retirada na montadora (exige manufacturerId) ou collectType='transferencia' para movimentação entre pátios OTD (exige originYardId diferente de yardId). Para coletas, o veículo é criado automaticamente se não existir. Para transferências, o veículo deve existir no sistema. Retorna 409 se o motorista já tem uma coleta em aberto.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "collectType", type: "string", required: false, description: "Tipo do registro: 'coleta' (padrão) ou 'transferencia'" },
          { field: "vehicleChassi", type: "string", required: true, description: "Chassi do veículo" },
          { field: "manufacturerId", type: "string", required: false, description: "UUID da montadora — obrigatório quando collectType='coleta'" },
          { field: "originYardId", type: "string", required: false, description: "UUID do pátio de origem — obrigatório quando collectType='transferencia'. Deve ser diferente de yardId" },
          { field: "yardId", type: "string", required: true, description: "UUID do pátio de destino" },
          { field: "notes", type: "string", required: false, description: "Observações" },
        ],
        example: {
          "exemplo_coleta": {
            collectType: "coleta",
            vehicleChassi: "9BWZZZ377VT004251",
            manufacturerId: "uuid-da-montadora",
            yardId: "uuid-do-patio-destino",
            notes: "Retirada na montadora"
          },
          "exemplo_transferencia": {
            collectType: "transferencia",
            vehicleChassi: "9BWZZZ377VT004251",
            originYardId: "uuid-do-patio-origem",
            yardId: "uuid-do-patio-destino",
            notes: "Transferência entre pátios"
          }
        },
        response: {
          message: "Coleta registrada com sucesso.",
          collect: {
            id: "uuid-da-coleta",
            collectType: "coleta",
            vehicleChassi: "9BWZZZ377VT004251",
            status: "em_transito",
            driverId: "uuid-do-motorista",
            manufacturerId: "uuid-da-montadora",
            originYardId: null,
            yardId: "uuid-do-patio-destino",
            collectDate: "2026-01-15T14:30:00.000Z",
            createdAt: "2026-01-15T14:30:00.000Z"
          }
        }
      },
      {
        method: "POST",
        path: "/api/external/collects/:id/finalize",
        description: "Finaliza uma coleta em andamento. O motorista autenticado envia sua localização GPS ao chegar no pátio de destino. Os campos endLatitude e endLongitude são salvos como coordenadas de fim da rota. A coleta muda de status 'em_transito' para 'finalizada'. Apenas o motorista vinculado pode finalizar. Coletas já finalizadas retornam erro 409.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login do motorista" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "latitude", type: "string", required: true, description: "Latitude GPS do motorista ao chegar no pátio — salvo como endLatitude na coleta" },
          { field: "longitude", type: "string", required: true, description: "Longitude GPS do motorista ao chegar no pátio — salvo como endLongitude na coleta" },
        ],
        example: {
          latitude: "-25.6359",
          longitude: "-49.1816"
        },
        response: {
          message: "Coleta finalizada com sucesso.",
          collect: {
            id: "uuid-da-coleta",
            vehicleChassi: "9BWZZZ377VT004251",
            status: "finalizada",
            driverId: "uuid-do-motorista",
            manufacturerId: "uuid-da-montadora",
            yardId: "uuid-do-patio",
            startLatitude: "-23.5505",
            startLongitude: "-46.6333",
            endLatitude: "-25.6359",
            endLongitude: "-49.1816",
            collectDate: "2026-03-31T14:30:00.000Z",
            createdAt: "2026-03-31T08:00:00.000Z"
          }
        }
      }
    ]
  },
  {
    category: "Autenticação Externa",
    items: [
      {
        method: "POST",
        path: "/api/external/auth/token",
        description: "Gera um par de tokens (access + refresh) para autenticação externa. O access_token deve ser enviado no header Authorization de todas as requisições protegidas.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "username", type: "string", required: true, description: "Nome de usuário cadastrado no sistema" },
          { field: "password", type: "string", required: true, description: "Senha do usuário" },
        ],
        example: {
          username: "admin",
          password: "admin123"
        },
        response: {
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          token_type: "Bearer",
          expires_in: 900,
          user: {
            id: "uuid-do-usuario",
            username: "joaosilva",
            email: "joao.silva@email.com",
            role: "motorista",
            firstName: "João",
            lastName: "Silva",
            driverId: "uuid-do-motorista",
            driverType: "coleta",
            phone: "11999998888",
            cpf: "123.456.789-00",
            profilePhoto: "/uploads/perfil001.jpg"
          }
        }
      },
      {
        method: "POST",
        path: "/api/external/auth/refresh",
        description: "Renova o access_token usando um refresh_token válido. Use quando o access_token expirar (após 15 minutos).",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "refresh_token", type: "string", required: true, description: "Refresh token obtido no login" },
        ],
        example: {
          refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        },
        response: {
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          refresh_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          token_type: "Bearer",
          expires_in: 900
        }
      },
      {
        method: "GET",
        path: "/api/external/auth/validate",
        description: "Valida se um access_token ainda é válido e retorna os dados do usuário autenticado. Envie o token no header Authorization.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: {
          valid: true,
          user: {
            id: "uuid-do-usuario",
            username: "joaosilva",
            email: "joao.silva@email.com",
            role: "motorista",
            firstName: "João",
            lastName: "Silva",
            driverId: "uuid-do-motorista",
            driverType: "coleta",
            phone: "11999998888",
            cpf: "123.456.789-00",
            profilePhoto: "/uploads/perfil001.jpg"
          }
        }
      }
    ]
  },
  {
    category: "Recuperação de Senha",
    items: [
      {
        method: "POST",
        path: "/api/auth/forgot-password",
        description: "Solicita a recuperação de senha. Envia um código de 6 dígitos para o e-mail cadastrado do usuário, válido por 15 minutos. Se o e-mail não estiver cadastrado, a resposta é a mesma por segurança.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "email", type: "string", required: true, description: "E-mail cadastrado do usuário" },
        ],
        example: {
          email: "usuario@empresa.com.br"
        },
        response: {
          message: "Se este e-mail estiver cadastrado, você receberá o código em breve."
        }
      },
      {
        method: "POST",
        path: "/api/auth/verify-reset-code",
        description: "Verifica se o código de 6 dígitos enviado por e-mail é válido. Retorna o tokenId necessário para confirmar a operação. O código expira em 15 minutos e só pode ser usado uma vez.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "email", type: "string", required: true, description: "E-mail do usuário que solicitou a recuperação" },
          { field: "code", type: "string", required: true, description: "Código de 6 dígitos recebido por e-mail" },
        ],
        example: {
          email: "usuario@empresa.com.br",
          code: "483920"
        },
        response: {
          message: "Código válido",
          tokenId: "uuid-do-token-de-reset"
        }
      },
      {
        method: "POST",
        path: "/api/auth/reset-password",
        description: "Redefine a senha do usuário usando o código de 6 dígitos recebido por e-mail. O código deve ser o mesmo gerado pelo /forgot-password e ainda não expirado. Após o uso, o código é invalidado.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "email", type: "string", required: true, description: "E-mail do usuário" },
          { field: "code", type: "string", required: true, description: "Código de 6 dígitos recebido por e-mail" },
          { field: "newPassword", type: "string", required: true, description: "Nova senha (mínimo 6 caracteres)" },
        ],
        example: {
          email: "usuario@empresa.com.br",
          code: "483920",
          newPassword: "NovaSenha@2024"
        },
        response: {
          message: "Senha redefinida com sucesso"
        }
      }
    ]
  },
  {
    category: "Montadoras",
    items: [
      {
        method: "GET",
        path: "/api/manufacturers",
        description: "Retorna a lista de todas as montadoras cadastradas no sistema. Requer autenticação.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-da-montadora",
            name: "Volkswagen do Brasil",
            cep: "09550-051",
            address: "Via Anchieta",
            addressNumber: "s/n",
            complement: null,
            neighborhood: "Jardim das Nações",
            city: "São Bernardo do Campo",
            state: "SP",
            latitude: "-23.6945",
            longitude: "-46.5651",
            phone: "11999998888",
            email: "contato@vw.com.br",
            contactName: "Carlos Oliveira",
            isActive: "true",
            createdAt: "2026-01-10T10:00:00.000Z"
          },
          {
            id: "uuid-da-montadora-2",
            name: "Fiat Chrysler Automóveis",
            cep: "32530-000",
            address: "Rua Fiat",
            addressNumber: "1000",
            complement: null,
            neighborhood: "Conj. Califórnia",
            city: "Betim",
            state: "MG",
            latitude: "-19.9622",
            longitude: "-44.1978",
            phone: "31988887777",
            email: "contato@fiat.com.br",
            contactName: "Ana Lima",
            isActive: "true",
            createdAt: "2026-01-12T08:30:00.000Z"
          }
        ]
      },
      {
        method: "GET",
        path: "/api/manufacturers/:id",
        description: "Retorna os dados de uma montadora específica pelo seu ID. Requer autenticação.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid-da-montadora",
          name: "Volkswagen do Brasil",
          cep: "09550-051",
          address: "Via Anchieta",
          addressNumber: "s/n",
          complement: null,
          neighborhood: "Jardim das Nações",
          city: "São Bernardo do Campo",
          state: "SP",
          latitude: "-23.6945",
          longitude: "-46.5651",
          phone: "11999998888",
          email: "contato@vw.com.br",
          contactName: "Carlos Oliveira",
          isActive: "true",
          createdAt: "2026-01-10T10:00:00.000Z"
        }
      },
      {
        method: "POST",
        path: "/api/manufacturers",
        description: "Cadastra uma nova montadora no sistema. Requer autenticação.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [
          { field: "name", type: "string", required: true, description: "Nome da montadora (mínimo 2 caracteres)" },
          { field: "cep", type: "string", required: false, description: "CEP do endereço" },
          { field: "address", type: "string", required: false, description: "Rua/Logradouro" },
          { field: "addressNumber", type: "string", required: false, description: "Número" },
          { field: "complement", type: "string", required: false, description: "Complemento" },
          { field: "neighborhood", type: "string", required: false, description: "Bairro" },
          { field: "city", type: "string", required: false, description: "Cidade" },
          { field: "state", type: "string", required: false, description: "Estado (UF, ex: SP)" },
          { field: "latitude", type: "string", required: false, description: "Latitude geográfica" },
          { field: "longitude", type: "string", required: false, description: "Longitude geográfica" },
          { field: "phone", type: "string", required: false, description: "Telefone com DDD" },
          { field: "email", type: "string", required: false, description: "E-mail de contato" },
          { field: "contactName", type: "string", required: false, description: "Nome do responsável de contato" },
          { field: "isActive", type: "string", required: false, description: "Status ativo: 'true' ou 'false' (padrão: 'true')" },
        ],
        example: {
          name: "Volkswagen do Brasil",
          cep: "09550-051",
          address: "Via Anchieta",
          addressNumber: "s/n",
          neighborhood: "Jardim das Nações",
          city: "São Bernardo do Campo",
          state: "SP",
          phone: "11999998888",
          email: "contato@vw.com.br",
          contactName: "Carlos Oliveira"
        },
        response: {
          id: "uuid-da-montadora",
          name: "Volkswagen do Brasil",
          cep: "09550-051",
          address: "Via Anchieta",
          addressNumber: "s/n",
          complement: null,
          neighborhood: "Jardim das Nações",
          city: "São Bernardo do Campo",
          state: "SP",
          latitude: null,
          longitude: null,
          phone: "11999998888",
          email: "contato@vw.com.br",
          contactName: "Carlos Oliveira",
          isActive: "true",
          createdAt: "2026-03-31T10:00:00.000Z"
        }
      },
      {
        method: "PATCH",
        path: "/api/manufacturers/:id",
        description: "Atualiza parcialmente os dados de uma montadora existente. Envie apenas os campos que deseja alterar. Requer autenticação.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [
          { field: "name", type: "string", required: false, description: "Nome da montadora" },
          { field: "phone", type: "string", required: false, description: "Telefone com DDD" },
          { field: "email", type: "string", required: false, description: "E-mail de contato" },
          { field: "contactName", type: "string", required: false, description: "Nome do responsável de contato" },
          { field: "isActive", type: "string", required: false, description: "Status ativo: 'true' ou 'false'" },
        ],
        example: {
          phone: "11888887777",
          contactName: "Marcos Souza",
          isActive: "false"
        },
        response: {
          id: "uuid-da-montadora",
          name: "Volkswagen do Brasil",
          phone: "11888887777",
          contactName: "Marcos Souza",
          isActive: "false",
          createdAt: "2026-01-10T10:00:00.000Z"
        }
      },
      {
        method: "DELETE",
        path: "/api/manufacturers/:id",
        description: "Remove uma montadora do sistema pelo seu ID. Requer autenticação.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: {
          message: "Manufacturer deleted successfully"
        }
      }
    ]
  },
  {
    category: "Pátios",
    items: [
      {
        method: "GET",
        path: "/api/yards",
        description: "Retorna a lista de todos os pátios cadastrados no sistema. Requer autenticação.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-do-patio",
            name: "Pátio Central SP",
            cep: "01310-100",
            address: "Av. Paulista",
            addressNumber: "1000",
            complement: "Galpão A",
            neighborhood: "Bela Vista",
            city: "São Paulo",
            state: "SP",
            latitude: "-23.5620",
            longitude: "-46.6553",
            phone: "11999991111",
            maxVehicles: 200,
            isActive: "true",
            createdAt: "2026-01-05T08:00:00.000Z"
          },
          {
            id: "uuid-do-patio-2",
            name: "Pátio Norte MG",
            cep: "30130-005",
            address: "Av. Amazonas",
            addressNumber: "500",
            complement: null,
            neighborhood: "Centro",
            city: "Belo Horizonte",
            state: "MG",
            latitude: "-19.9191",
            longitude: "-43.9386",
            phone: "31988882222",
            maxVehicles: 150,
            isActive: "true",
            createdAt: "2026-01-08T09:00:00.000Z"
          }
        ]
      },
      {
        method: "GET",
        path: "/api/yards/:id",
        description: "Retorna os dados de um pátio específico pelo seu ID. Requer autenticação.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid-do-patio",
          name: "Pátio Central SP",
          cep: "01310-100",
          address: "Av. Paulista",
          addressNumber: "1000",
          complement: "Galpão A",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          latitude: "-23.5620",
          longitude: "-46.6553",
          phone: "11999991111",
          maxVehicles: 200,
          isActive: "true",
          createdAt: "2026-01-05T08:00:00.000Z"
        }
      },
      {
        method: "POST",
        path: "/api/yards",
        description: "Cadastra um novo pátio no sistema. Requer autenticação.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [
          { field: "name", type: "string", required: true, description: "Nome do pátio (mínimo 2 caracteres)" },
          { field: "cep", type: "string", required: false, description: "CEP do endereço" },
          { field: "address", type: "string", required: false, description: "Rua/Logradouro" },
          { field: "addressNumber", type: "string", required: false, description: "Número" },
          { field: "complement", type: "string", required: false, description: "Complemento" },
          { field: "neighborhood", type: "string", required: false, description: "Bairro" },
          { field: "city", type: "string", required: false, description: "Cidade" },
          { field: "state", type: "string", required: false, description: "Estado (UF, ex: SP)" },
          { field: "latitude", type: "string", required: false, description: "Latitude geográfica" },
          { field: "longitude", type: "string", required: false, description: "Longitude geográfica" },
          { field: "phone", type: "string", required: false, description: "Telefone com DDD" },
          { field: "maxVehicles", type: "number", required: false, description: "Capacidade máxima de veículos" },
          { field: "isActive", type: "string", required: false, description: "Status ativo: 'true' ou 'false' (padrão: 'true')" },
        ],
        example: {
          name: "Pátio Central SP",
          cep: "01310-100",
          address: "Av. Paulista",
          addressNumber: "1000",
          complement: "Galpão A",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          phone: "11999991111",
          maxVehicles: 200
        },
        response: {
          id: "uuid-do-patio",
          name: "Pátio Central SP",
          cep: "01310-100",
          address: "Av. Paulista",
          addressNumber: "1000",
          complement: "Galpão A",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          latitude: null,
          longitude: null,
          phone: "11999991111",
          maxVehicles: 200,
          isActive: "true",
          createdAt: "2026-03-31T10:00:00.000Z"
        }
      },
      {
        method: "PATCH",
        path: "/api/yards/:id",
        description: "Atualiza parcialmente os dados de um pátio existente. Envie apenas os campos que deseja alterar. Requer autenticação.",
        headers: [
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [
          { field: "name", type: "string", required: false, description: "Nome do pátio" },
          { field: "phone", type: "string", required: false, description: "Telefone com DDD" },
          { field: "maxVehicles", type: "number", required: false, description: "Capacidade máxima de veículos" },
          { field: "isActive", type: "string", required: false, description: "Status ativo: 'true' ou 'false'" },
        ],
        example: {
          phone: "11888883333",
          maxVehicles: 250,
          isActive: "false"
        },
        response: {
          id: "uuid-do-patio",
          name: "Pátio Central SP",
          phone: "11888883333",
          maxVehicles: 250,
          isActive: "false",
          createdAt: "2026-01-05T08:00:00.000Z"
        }
      },
      {
        method: "DELETE",
        path: "/api/yards/:id",
        description: "Remove um pátio do sistema pelo seu ID. Retorna status 204 sem conteúdo em caso de sucesso. Requer autenticação.",
        headers: [
          { name: "Authorization", value: "Bearer <access_token>", description: "Token de acesso obtido no login" },
        ],
        body: [],
        example: {},
        response: {}
      }
    ]
  },
  {
    category: "Modelos de Veículo",
    items: [
      {
        method: "GET",
        path: "/api/external/vehicle-models",
        description: "Retorna a lista de todos os modelos de veículos ativos cadastrados no sistema. Endpoint público — não requer autenticação.",
        headers: [],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-do-modelo",
            brand: "Volkswagen",
            model: "Constellation 24.280",
            axleConfig: "6x2"
          },
          {
            id: "uuid-do-modelo-2",
            brand: "Scania",
            model: "R 450",
            axleConfig: "4x2"
          }
        ]
      }
    ]
  },
  {
    category: "Propostas de Transporte",
    items: [
      {
        method: "GET",
        path: "/api/external/transport-proposals/open",
        description: "Endpoint externo — retorna apenas propostas em aberto (com vagas disponíveis para motoristas). Inclui dados do pátio de origem, cliente, local de entrega, tarifa, transportes vinculados e vagas disponíveis. Projetado para consumo por aplicativos externos.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {
          id: "fb13c06f-...",
          originYard: "Terminal OTD Curitiba",
          originYardCity: "Curitiba",
          originYardState: "PR",
          client: "Stellantis do Brasil S.A.",
          deliveryLocation: "Planta Principal",
          deliveryLocationCity: "São Bernardo do Campo",
          deliveryLocationState: "SP",
          startDate: "2026-04-09T08:00:00.000Z",
          distanceKm: 460.32,
          isEmergency: true,
          travelRate: { name: "Tarifa PR → SP", value: 4.5 },
          totalSlots: 3,
          occupiedSlots: 1,
          availableSlots: 2,
          transports: [
            { transportId: "1433079b-...", vehicleChassi: "9BS3E4GX0RB100001", vehicleColor: "Branco", vehicleManufacturer: "c963465a-...", hasDriverAssigned: false },
          ],
        },
      },
      {
        method: "GET",
        path: "/api/transport-proposals",
        description: "Retorna a lista completa de propostas de transporte com os relacionamentos (pátio de origem, cliente, local de entrega, motoristas e transportes vinculados). Propostas com startDate ≤ agora+48h são marcadas automaticamente como emergência.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-da-proposta",
            originYardId: "uuid-do-patio",
            clientId: "uuid-do-cliente",
            deliveryLocationId: "uuid-do-local",
            travelRateId: "uuid-da-tarifa",
            startDate: "2026-04-15T08:00:00.000Z",
            distanceKm: "450",
            totalSlots: 3,
            status: "ativa",
            isEmergency: "false",
            originYard: { id: "uuid", name: "Terminal OTD Curitiba" },
            client: { id: "uuid", name: "Stellantis do Brasil S.A." },
            deliveryLocation: { id: "uuid", name: "Planta Principal" },
            items: [],
            driverResponses: [],
            occupiedSlots: 0
          }
        ]
      },
      {
        method: "GET",
        path: "/api/transport-proposals/list",
        description: "Retorna uma lista simplificada (leve) de propostas de transporte com informações resumidas: nome do pátio, cliente, local de entrega, distância, vagas totais e ocupadas.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-da-proposta",
            originYardName: "Terminal OTD Curitiba",
            originYardAddress: "Rod. BR-116, km 98",
            clientName: "Stellantis do Brasil S.A.",
            deliveryLocationName: "Planta Principal",
            deliveryLocationAddress: "Av. Industrial, 1000",
            startDate: "2026-04-15T08:00:00.000Z",
            distanceKm: "450",
            totalSlots: 3,
            occupiedSlots: 2
          }
        ]
      },
      {
        method: "GET",
        path: "/api/transport-proposals/:id",
        description: "Retorna os detalhes completos de uma proposta de transporte, incluindo transportes vinculados (com cliente, pátio e local de entrega), motoristas com status e estatísticas (entregas do mês, nota média), tarifa de viagem e histórico de atividades.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid-da-proposta",
          originYardId: "uuid-do-patio",
          clientId: "uuid-do-cliente",
          deliveryLocationId: "uuid-do-local",
          startDate: "2026-04-15T08:00:00.000Z",
          distanceKm: "450",
          totalSlots: 3,
          status: "ativa",
          isEmergency: "false",
          originYard: { id: "uuid", name: "Terminal OTD Curitiba" },
          client: { id: "uuid", name: "Stellantis do Brasil S.A." },
          deliveryLocation: { id: "uuid", name: "Planta Principal" },
          travelRate: { id: "uuid", name: "Tarifa Padrão", rateValue: "1500.00", rateType: "fixo" },
          items: [
            { id: "uuid-transporte", requestNumber: "OTD00001", vehicleChassi: "9BM3E2GX0RB100001", client: { name: "Cliente" }, originYard: { name: "Pátio" }, deliveryLocation: { name: "Destino" } }
          ],
          driverResponses: [
            { id: "uuid-entry", driverId: "uuid", status: "aceito", driver: { name: "João Silva" }, monthlyDeliveries: 5, averageScore: 4.5 }
          ],
          occupiedSlots: 1,
          logs: [
            { id: "uuid-log", action: "add_driver", description: "Motorista João Silva adicionado", performedBy: "admin", createdAt: "2026-04-10T10:00:00.000Z" }
          ]
        }
      },
      {
        method: "POST",
        path: "/api/transport-proposals",
        description: "Cria uma nova proposta de transporte. Opcionalmente pode vincular transportes no momento da criação passando o array transportIds.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "originYardId", type: "string", required: true, description: "UUID do pátio de origem" },
          { field: "clientId", type: "string", required: true, description: "UUID do cliente" },
          { field: "deliveryLocationId", type: "string", required: true, description: "UUID do local de entrega" },
          { field: "startDate", type: "string", required: true, description: "Data/hora de início (ISO 8601)" },
          { field: "totalSlots", type: "number", required: true, description: "Número total de vagas para motoristas" },
          { field: "distanceKm", type: "string", required: false, description: "Distância em quilômetros" },
          { field: "travelRateId", type: "string", required: false, description: "UUID da tarifa de viagem" },
          { field: "notes", type: "string", required: false, description: "Observações" },
          { field: "isEmergency", type: "string", required: false, description: "Emergência: 'true' ou 'false'" },
          { field: "transportIds", type: "string[]", required: false, description: "Array de UUIDs de transportes para vincular" },
        ],
        example: {
          originYardId: "uuid-do-patio",
          clientId: "uuid-do-cliente",
          deliveryLocationId: "uuid-do-local",
          startDate: "2026-04-15T08:00:00.000Z",
          totalSlots: 3,
          distanceKm: "450",
          transportIds: ["uuid-transporte-1", "uuid-transporte-2"]
        },
        response: {
          id: "uuid-da-proposta",
          status: "ativa",
          items: [],
          driverResponses: [],
          occupiedSlots: 0
        }
      },
      {
        method: "PATCH",
        path: "/api/transport-proposals/:id",
        description: "Atualiza campos de uma proposta de transporte. Permite alterar status, emergência, tarifa, vagas, datas, etc. Alteração de tarifa gera log automático.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "status", type: "string", required: false, description: "Status: ativa, finalizada, cancelada" },
          { field: "isEmergency", type: "string", required: false, description: "'true' ou 'false'" },
          { field: "travelRateId", type: "string|null", required: false, description: "UUID da tarifa ou null para remover" },
          { field: "totalSlots", type: "number", required: false, description: "Total de vagas" },
          { field: "startDate", type: "string", required: false, description: "Nova data de início (ISO 8601)" },
          { field: "notes", type: "string", required: false, description: "Observações" },
        ],
        example: {
          status: "finalizada",
          travelRateId: "uuid-da-tarifa"
        },
        response: {
          id: "uuid-da-proposta",
          status: "finalizada"
        }
      },
      {
        method: "DELETE",
        path: "/api/transport-proposals/:id",
        description: "Remove permanentemente uma proposta de transporte e todos os seus vínculos (transportes e motoristas).",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: { message: "Proposta removida com sucesso" }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/transports",
        description: "Vincula um transporte existente a uma proposta. O transporte não pode já estar vinculado.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "transportId", type: "string", required: true, description: "UUID do transporte a vincular" },
        ],
        example: { transportId: "uuid-do-transporte" },
        response: {
          id: "uuid-do-item",
          proposalId: "uuid-da-proposta",
          transportId: "uuid-do-transporte"
        }
      },
      {
        method: "DELETE",
        path: "/api/transport-proposals/:id/transports/:transportId",
        description: "Remove o vínculo de um transporte com a proposta.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: { message: "Transporte removido da proposta" }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/drivers",
        description: "Adiciona um motorista à proposta com status 'pendente'. O motorista não pode já estar na proposta.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "driverId", type: "string", required: true, description: "UUID do motorista" },
        ],
        example: { driverId: "uuid-do-motorista" },
        response: {
          id: "uuid-do-entry",
          proposalId: "uuid-da-proposta",
          driverId: "uuid-do-motorista",
          status: "pendente"
        }
      },
      {
        method: "PATCH",
        path: "/api/transport-proposals/:id/drivers/:driverEntryId",
        description: "Atualiza o status de um motorista na proposta (pendente, aceito, recusado). Gera log de alteração.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "status", type: "string", required: true, description: "Novo status: pendente, aceito, recusado" },
        ],
        example: { status: "aceito" },
        response: {
          id: "uuid-do-entry",
          status: "aceito",
          respondedAt: "2026-04-10T10:00:00.000Z"
        }
      },
      {
        method: "DELETE",
        path: "/api/transport-proposals/:id/drivers/:driverId",
        description: "Remove um motorista da proposta. Gera log de remoção.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: { message: "Motorista removido da proposta" }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/drivers/:driverEntryId/accept",
        description: "Marca o motorista como 'aceito' na proposta. Registra a data de resposta e gera log.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid-do-entry",
          status: "aceito",
          respondedAt: "2026-04-10T10:00:00.000Z"
        }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/drivers/:driverEntryId/reject",
        description: "Marca o motorista como 'recusado' na proposta. Registra a data de resposta e gera log.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid-do-entry",
          status: "recusado",
          respondedAt: "2026-04-10T10:00:00.000Z"
        }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/drivers/:driverEntryId/assign",
        description: "Atribui um motorista aceito a um transporte vinculado à proposta. O transporte não pode já ter outro motorista atribuído.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "transportId", type: "string", required: true, description: "UUID do transporte para atribuir" },
        ],
        example: { transportId: "uuid-do-transporte" },
        response: {
          id: "uuid-do-entry",
          assignedTransportId: "uuid-do-transporte"
        }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/transports/:transportId/unassign-driver",
        description: "Remove a atribuição do motorista de um transporte, deixando-o sem motorista. Gera log de desvinculação.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: { message: "Motorista desvinculado do transporte" }
      },
      {
        method: "POST",
        path: "/api/transport-proposals/:id/transports/:transportId/change-driver",
        description: "Troca o motorista atribuído a um transporte por outro motorista aceito disponível. Gera log da troca.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "newDriverEntryId", type: "string", required: true, description: "UUID do entry do novo motorista (deve estar aceito e sem transporte atribuído)" },
        ],
        example: { newDriverEntryId: "uuid-do-novo-entry" },
        response: { message: "Motorista trocado com sucesso" }
      },
    ]
  },
  {
    category: "Transportes",
    items: [
      {
        method: "GET",
        path: "/api/transports",
        description: "Retorna a lista completa de transportes com todos os relacionamentos: cliente, pátio de origem, local de entrega, motorista, tarifa de viagem, usuário criador e usuário que atribuiu o motorista. Inclui também a data da última coleta do veículo vinculado.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-do-transporte",
            requestNumber: "TRF-2026-0042",
            vehicleChassi: "9BS3E4GX0RB100001",
            status: "aguardando_saida",
            clientId: "uuid-do-cliente",
            originYardId: "uuid-do-patio",
            deliveryLocationId: "uuid-do-local",
            driverId: "uuid-do-motorista",
            travelRateId: "uuid-da-tarifa",
            checkinDateTime: null,
            checkoutDateTime: null,
            client: { id: "uuid", name: "Stellantis do Brasil S.A." },
            originYard: { id: "uuid", name: "Terminal OTD Curitiba" },
            deliveryLocation: { id: "uuid", name: "Planta Principal", city: "São Bernardo do Campo", state: "SP" },
            driver: { id: "uuid", name: "João Silva", cpf: "12345678900" },
            travelRate: { id: "uuid", name: "Tarifa PR → SP", rateValue: "4.50" },
            collectDate: "2026-04-15T10:00:00.000Z"
          }
        ]
      },
      {
        method: "GET",
        path: "/api/transports/:id",
        description: "Retorna os detalhes completos de um transporte específico, incluindo todos os relacionamentos e fotos de check-in/check-out.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid-do-transporte",
          requestNumber: "TRF-2026-0042",
          vehicleChassi: "9BS3E4GX0RB100001",
          status: "entregue",
          checkinDateTime: "2026-04-15T08:30:00.000Z",
          checkinFrontalPhoto: "https://storage.../foto.jpg",
          checkoutDateTime: "2026-04-16T14:00:00.000Z",
          client: { id: "uuid", name: "Stellantis do Brasil S.A." },
          originYard: { id: "uuid", name: "Terminal OTD Curitiba" },
          deliveryLocation: { id: "uuid", name: "Planta Principal" },
          driver: { id: "uuid", name: "João Silva" }
        }
      },
      {
        method: "POST",
        path: "/api/transports",
        description: "Cria um novo registro de transporte. Se a tarifa selecionada exigir aprovação, o transporte será criado com status de aprovação 'pendente'. Se um motorista for informado, o usuário que criou o transporte é registrado como responsável pela atribuição.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "vehicleChassi", type: "string", required: true, description: "Chassi do veículo a ser transportado" },
          { field: "clientId", type: "string", required: true, description: "UUID do cliente de destino" },
          { field: "deliveryLocationId", type: "string", required: true, description: "UUID do local de entrega" },
          { field: "originYardId", type: "string", required: false, description: "UUID do pátio de saída" },
          { field: "driverId", type: "string", required: false, description: "UUID do motorista responsável" },
          { field: "travelRateId", type: "string", required: false, description: "UUID da tarifa de viagem a aplicar" },
          { field: "routeDistanceKm", type: "number", required: false, description: "Distância da rota em km" },
          { field: "estimatedTolls", type: "string", required: false, description: "Valor estimado de pedágios (R$)" },
          { field: "estimatedFuel", type: "string", required: false, description: "Valor estimado de combustível (R$)" },
          { field: "notes", type: "string", required: false, description: "Observações sobre o transporte" },
        ],
        example: {
          vehicleChassi: "9BS3E4GX0RB100001",
          clientId: "uuid-do-cliente",
          deliveryLocationId: "uuid-do-local",
          originYardId: "uuid-do-patio",
          driverId: "uuid-do-motorista",
          travelRateId: "uuid-da-tarifa",
          routeDistanceKm: 460,
          estimatedTolls: "85.00",
          estimatedFuel: "320.00"
        },
        response: {
          id: "uuid-do-novo-transporte",
          requestNumber: "TRF-2026-0043",
          vehicleChassi: "9BS3E4GX0RB100001",
          status: "cadastrado",
          travelRateApprovalStatus: null,
          createdAt: "2026-04-19T10:00:00.000Z"
        }
      },
      {
        method: "PATCH",
        path: "/api/transports/:id",
        description: "Atualiza os dados de um transporte existente. Todos os campos são opcionais. Se um motorista for atribuído pela primeira vez, o usuário autenticado é registrado como responsável pela atribuição.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "driverId", type: "string", required: false, description: "UUID do motorista para atribuição" },
          { field: "travelRateId", type: "string", required: false, description: "UUID da tarifa de viagem" },
          { field: "status", type: "string", required: false, description: "Status do transporte: pendente | aguardando_saida | em_transito | entregue | cancelado" },
          { field: "notes", type: "string", required: false, description: "Observações" },
        ],
        example: { driverId: "uuid-do-novo-motorista", notes: "Motorista substituto por indisponibilidade" },
        response: { id: "uuid", driverId: "uuid-do-novo-motorista", status: "aguardando_saida" }
      },
      {
        method: "DELETE",
        path: "/api/transports/:id",
        description: "Remove um transporte do sistema. O motivo da exclusão é obrigatório e fica registrado no histórico para rastreabilidade.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "reason", type: "string", required: true, description: "Motivo da exclusão do transporte" },
        ],
        example: { reason: "Transporte duplicado por erro de cadastro" },
        response: {}
      },
      {
        method: "PATCH",
        path: "/api/transports/:id/checkin",
        description: "Registra o check-in do transporte (saída do pátio). Armazena localização GPS, data/hora e fotos do veículo no momento da saída. O status do transporte é atualizado para 'aguardando_saida' e o veículo para 'despachado'.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "latitude", type: "number", required: false, description: "Latitude da localização no momento do check-in" },
          { field: "longitude", type: "number", required: false, description: "Longitude da localização no momento do check-in" },
          { field: "frontalPhoto", type: "string", required: false, description: "URL da foto frontal do veículo" },
          { field: "lateral1Photo", type: "string", required: false, description: "URL da foto lateral esquerda" },
          { field: "lateral2Photo", type: "string", required: false, description: "URL da foto lateral direita" },
          { field: "traseiraPhoto", type: "string", required: false, description: "URL da foto traseira" },
          { field: "odometerPhoto", type: "string", required: false, description: "URL da foto do odômetro" },
          { field: "fuelLevelPhoto", type: "string", required: false, description: "URL da foto do nível de combustível" },
          { field: "selfiePhoto", type: "string", required: false, description: "URL da selfie do motorista" },
          { field: "damagePhotos", type: "string[]", required: false, description: "Lista de URLs de fotos de avarias" },
          { field: "notes", type: "string", required: false, description: "Observações do check-in" },
        ],
        example: {
          latitude: -25.4284,
          longitude: -49.2733,
          frontalPhoto: "https://storage.../frontal.jpg",
          odometerPhoto: "https://storage.../odometro.jpg",
          notes: "Veículo em perfeito estado"
        },
        response: {
          id: "uuid",
          status: "aguardando_saida",
          checkinDateTime: "2026-04-19T08:00:00.000Z",
          checkinLocation: { type: "Point", coordinates: [-49.2733, -25.4284] }
        }
      },
      {
        method: "PATCH",
        path: "/api/transports/:id/checkout",
        description: "Registra o check-out do transporte (entrega ao cliente). Requer que o check-in já tenha sido realizado. Armazena localização GPS, data/hora e fotos da entrega. O status do transporte e do veículo são atualizados para 'entregue'.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
          { name: "Content-Type", value: "application/json", description: "Tipo do conteúdo" },
        ],
        body: [
          { field: "latitude", type: "number", required: false, description: "Latitude da localização no momento da entrega" },
          { field: "longitude", type: "number", required: false, description: "Longitude da localização no momento da entrega" },
          { field: "frontalPhoto", type: "string", required: false, description: "URL da foto frontal do veículo na entrega" },
          { field: "lateral1Photo", type: "string", required: false, description: "URL da foto lateral esquerda na entrega" },
          { field: "lateral2Photo", type: "string", required: false, description: "URL da foto lateral direita na entrega" },
          { field: "traseiraPhoto", type: "string", required: false, description: "URL da foto traseira na entrega" },
          { field: "odometerPhoto", type: "string", required: false, description: "URL da foto do odômetro na entrega" },
          { field: "fuelLevelPhoto", type: "string", required: false, description: "URL da foto do nível de combustível na entrega" },
          { field: "selfiePhoto", type: "string", required: false, description: "URL da selfie do motorista na entrega" },
          { field: "damagePhotos", type: "string[]", required: false, description: "Lista de URLs de fotos de avarias encontradas na entrega" },
          { field: "notes", type: "string", required: false, description: "Observações da entrega" },
        ],
        example: {
          latitude: -23.6883,
          longitude: -46.5641,
          frontalPhoto: "https://storage.../entrega_frontal.jpg",
          notes: "Entregue ao responsável José Santos às 14h"
        },
        response: {
          id: "uuid",
          status: "entregue",
          checkoutDateTime: "2026-04-19T14:00:00.000Z",
          checkoutLocation: { type: "Point", coordinates: [-46.5641, -23.6883] }
        }
      },
      {
        method: "PATCH",
        path: "/api/transports/:id/conclude",
        description: "Conclui manualmente um transporte, marcando-o como entregue sem necessidade de registrar fotos de check-out. Útil para finalização administrativa. O veículo também é atualizado para status 'entregue'.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: {
          id: "uuid",
          status: "entregue",
          checkoutDateTime: "2026-04-19T14:00:00.000Z"
        }
      },
      {
        method: "GET",
        path: "/api/transports/:id/proposals",
        description: "Retorna as propostas de transporte vinculadas a um transporte específico, com informações completas de pátio de origem, cliente, local de entrega e tarifa de viagem.",
        headers: [
          { name: "Authorization", value: "Bearer {token}", description: "Token JWT de autenticação" },
        ],
        body: [],
        example: {},
        response: [
          {
            id: "uuid-da-proposta",
            proposalNumber: "PROP-2026-0010",
            startDate: "2026-04-15T08:00:00.000Z",
            status: "ativa",
            distanceKm: "460",
            totalSlots: 3,
            originYard: { id: "uuid", name: "Terminal OTD Curitiba" },
            client: { id: "uuid", name: "Stellantis do Brasil S.A." },
            deliveryLocation: { id: "uuid", name: "Planta Principal" },
            travelRate: { id: "uuid", name: "Tarifa PR → SP", rateValue: "4.50" }
          }
        ]
      },
    ]
  }
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
    POST: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
    PUT: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
    PATCH: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
    DELETE: "bg-red-500/20 text-red-700 dark:text-red-400",
  };
  
  return (
    <Badge className={`${colors[method]} font-mono text-xs`}>
      {method}
    </Badge>
  );
}

function CodeBlock({ code }: { code: object }) {
  return (
    <ScrollArea className="h-auto max-h-64">
      <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
        {JSON.stringify(code, null, 2)}
      </pre>
    </ScrollArea>
  );
}

function EndpointCard({ endpoint }: { endpoint: EndpointDoc }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{endpoint.path}</code>
        </div>
        <CardDescription className="mt-2">{endpoint.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="params" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="params" data-testid="tab-params">Parâmetros</TabsTrigger>
            <TabsTrigger value="example" data-testid="tab-example">Exemplo</TabsTrigger>
            <TabsTrigger value="response" data-testid="tab-response">Resposta</TabsTrigger>
          </TabsList>
          
          <TabsContent value="params">
            <div className="space-y-4">
              {endpoint.headers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Headers</h4>
                  <div className="space-y-1">
                    {endpoint.headers.map((h) => (
                      <div key={h.name} className="flex items-center gap-2 text-sm">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{h.name}</code>
                        <span className="text-muted-foreground">{h.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Body (JSON)</h4>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Campo</th>
                        <th className="text-left px-3 py-2 font-medium">Tipo</th>
                        <th className="text-left px-3 py-2 font-medium">Obrigatório</th>
                        <th className="text-left px-3 py-2 font-medium">Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.body.map((field) => (
                        <tr key={field.field} className="border-t">
                          <td className="px-3 py-2">
                            <code className="text-xs">{field.field}</code>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{field.type}</td>
                          <td className="px-3 py-2">
                            {field.required ? (
                              <Badge variant="destructive" className="text-xs">Sim</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Não</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{field.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="example">
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Requisição</h4>
              <CodeBlock code={endpoint.example} />
            </div>
          </TabsContent>
          
          <TabsContent value="response">
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Resposta de sucesso</h4>
              <CodeBlock code={endpoint.response} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function generatePdf() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  }

  function drawLine() {
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("OTD Entregas - Documentação da API", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Base URL: ${window.location.origin}`, margin, y);
  y += 5;
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 10;
  doc.setTextColor(0);

  drawLine();

  for (const category of endpoints) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(category.category, margin, y);
    y += 8;

    for (const ep of category.items) {
      checkPage(30);

      const methodColors: Record<string, [number, number, number]> = {
        GET: [16, 185, 129],
        POST: [59, 130, 246],
        PUT: [245, 158, 11],
        PATCH: [249, 115, 22],
        DELETE: [239, 68, 68],
      };
      const color = methodColors[ep.method] || [100, 100, 100];

      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin, y - 4, 14, 6, 1, 1, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255);
      doc.text(ep.method, margin + 2, y);

      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont("courier", "normal");
      doc.text(ep.path, margin + 18, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80);
      const descLines = doc.splitTextToSize(ep.description, contentWidth);
      checkPage(descLines.length * 4 + 4);
      doc.text(descLines, margin, y);
      y += descLines.length * 4 + 4;
      doc.setTextColor(0);

      if (ep.headers.length > 0) {
        checkPage(15);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Headers:", margin, y);
        y += 5;
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        for (const h of ep.headers) {
          checkPage(6);
          doc.text(`${h.name}: ${h.value}`, margin + 4, y);
          y += 4;
        }
        y += 2;
      }

      if (ep.body.length > 0) {
        checkPage(15);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Parâmetros (Body):", margin, y);
        y += 6;

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 4, contentWidth, 6, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("Campo", margin + 2, y);
        doc.text("Tipo", margin + 50, y);
        doc.text("Obrig.", margin + 80, y);
        doc.text("Descrição", margin + 100, y);
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        for (const field of ep.body) {
          checkPage(6);
          doc.setFont("courier", "normal");
          doc.text(field.field, margin + 2, y);
          doc.setFont("helvetica", "normal");
          doc.text(field.type, margin + 50, y);
          doc.text(field.required ? "Sim" : "Não", margin + 80, y);
          const descFieldLines = doc.splitTextToSize(field.description, contentWidth - 100);
          doc.text(descFieldLines[0], margin + 100, y);
          y += 5;
        }
        y += 3;
      }

      if (Object.keys(ep.example).length > 0) {
        checkPage(15);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Exemplo de Requisição:", margin, y);
        y += 5;

        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        doc.setFillColor(245, 245, 245);
        const jsonStr = JSON.stringify(ep.example, null, 2);
        const jsonLines = jsonStr.split("\n");
        const blockHeight = jsonLines.length * 3.5 + 4;
        checkPage(blockHeight);
        doc.rect(margin, y - 3, contentWidth, blockHeight, "F");
        for (const line of jsonLines) {
          doc.text(line, margin + 3, y);
          y += 3.5;
        }
        y += 4;
      }

      checkPage(15);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Exemplo de Resposta:", margin, y);
      y += 5;

      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.setFillColor(245, 245, 245);
      const respStr = JSON.stringify(ep.response, null, 2);
      const respLines = respStr.split("\n");
      const respBlockHeight = respLines.length * 3.5 + 4;
      checkPage(respBlockHeight);
      doc.rect(margin, y - 3, contentWidth, respBlockHeight, "F");
      for (const line of respLines) {
        doc.text(line, margin + 3, y);
        y += 3.5;
      }
      y += 8;

      drawLine();
    }
  }

  doc.save("OTD_Entregas_API_Documentacao.pdf");
}

function generateMarkdown() {
  let md = `# OTD Entregas - Documentação da API\n\n`;
  md += `**Base URL:** \`${window.location.origin}\`\n\n`;
  md += `**Gerado em:** ${new Date().toLocaleString("pt-BR")}\n\n`;
  md += `---\n\n`;

  for (const category of endpoints) {
    md += `## ${category.category}\n\n`;

    for (const ep of category.items) {
      md += `### \`${ep.method}\` ${ep.path}\n\n`;
      md += `${ep.description}\n\n`;

      if (ep.headers.length > 0) {
        md += `**Headers:**\n\n`;
        md += `| Nome | Valor | Descrição |\n`;
        md += `|------|-------|-----------|\n`;
        for (const h of ep.headers) {
          md += `| \`${h.name}\` | \`${h.value}\` | ${h.description} |\n`;
        }
        md += `\n`;
      }

      if (ep.body.length > 0) {
        md += `**Parâmetros (Body):**\n\n`;
        md += `| Campo | Tipo | Obrigatório | Descrição |\n`;
        md += `|-------|------|-------------|-----------|\n`;
        for (const field of ep.body) {
          md += `| \`${field.field}\` | \`${field.type}\` | ${field.required ? "Sim" : "Não"} | ${field.description} |\n`;
        }
        md += `\n`;
      }

      if (Object.keys(ep.example).length > 0) {
        md += `**Exemplo de Requisição:**\n\n`;
        md += `\`\`\`json\n${JSON.stringify(ep.example, null, 2)}\n\`\`\`\n\n`;
      }

      md += `**Exemplo de Resposta:**\n\n`;
      md += `\`\`\`json\n${JSON.stringify(ep.response, null, 2)}\n\`\`\`\n\n`;
      md += `---\n\n`;
    }
  }

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "OTD_Entregas_API_Documentacao.md";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ApiDocsPage() {
  return (
    <div className="h-full overflow-auto p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Documentação da API</h1>
          <p className="text-muted-foreground mt-1">
            Endpoints disponíveis para integração com sistemas externos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateMarkdown} variant="outline" data-testid="button-generate-md">
            <FileDown className="w-4 h-4 mr-2" />
            Gerar MD
          </Button>
          <Button onClick={generatePdf} data-testid="button-generate-pdf">
            <Download className="w-4 h-4 mr-2" />
            Gerar PDF
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Informações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Autenticação</h4>
                <p className="text-sm text-muted-foreground">
                  Todas as requisições devem incluir um cookie de sessão válido ou token de autenticação.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Code className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Formato</h4>
                <p className="text-sm text-muted-foreground">
                  Todas as requisições e respostas utilizam JSON (application/json).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Base URL</h4>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {window.location.origin}
                </code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
        {endpoints.map((category) => (
          <div key={category.category}>
            <h2 className="text-lg font-semibold mb-4" data-testid={`text-category-${category.category}`}>
              {category.category}
            </h2>
            {category.items.map((endpoint, idx) => (
              <EndpointCard key={idx} endpoint={endpoint} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
