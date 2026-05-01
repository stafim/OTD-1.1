# Endpoint — Criar Coleta entre Pátios

> **Tipo:** `transferencia`
> Utilize este endpoint para registrar a movimentação de um veículo de um pátio de origem para um pátio de destino, acionada por um motorista de coleta.

---

## Autenticação

Todas as requisições exigem um **Bearer Token** JWT.

### 1. Obter o token

**POST** `/api/auth/login`

```bash
curl -s -X POST https://4d11ac73-2d20-48bb-b640-17d848840b68-00-2afjmks46q1co.worf.replit.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**Resposta:**
```json
{
  "message": "Login realizado com sucesso",
  "accessToken": "<JWT_ACCESS_TOKEN>",
  "refreshToken": "<JWT_REFRESH_TOKEN>",
  "user": { ... }
}
```

Utilize o valor de `accessToken` no header `Authorization` das próximas chamadas.

---

## Criar Coleta entre Pátios

**POST** `/api/collects`

### Campos obrigatórios

| Campo | Tipo | Descrição |
|---|---|---|
| `vehicleChassi` | `string` (mín. 7 chars) | Chassi do veículo |
| `manufacturerId` | `string` (UUID) | ID da montadora |
| `yardId` | `string` (UUID) | ID do **pátio de destino** |
| `collectType` | `"transferencia"` | Tipo da coleta — deve ser `"transferencia"` |

### Campos opcionais

| Campo | Tipo | Descrição |
|---|---|---|
| `driverId` | `string` (UUID) | ID do motorista responsável |
| `notes` | `string` | Observações gerais |
| `startLatitude` | `string` | Latitude de origem |
| `startLongitude` | `string` | Longitude de origem |

> **Atenção:** O sistema rejeita a criação se o `driverId` informado já possuir uma coleta com status `em_transito`. Finalize a coleta atual antes de criar uma nova.

---

### Exemplo — cURL

```bash
curl -X POST https://4d11ac73-2d20-48bb-b640-17d848840b68-00-2afjmks46q1co.worf.replit.dev/api/collects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_ACCESS_TOKEN>" \
  -d '{
    "vehicleChassi": "9BWZZZ377VT004251",
    "manufacturerId": "21045ffb-06c9-4851-a096-89a5b78e8d13",
    "yardId": "38da0646-664a-480f-aefb-40a734fb564e",
    "collectType": "transferencia",
    "driverId": "49c8f5be-aa17-46c0-90ca-820fb93145b6",
    "notes": "Transferência do pátio filial para a matriz"
  }'
```

### Resposta de sucesso — `201 Created`

```json
{
  "id": "c1f2a3b4-...",
  "vehicleChassi": "9BWZZZ377VT004251",
  "manufacturerId": "21045ffb-06c9-4851-a096-89a5b78e8d13",
  "yardId": "38da0646-664a-480f-aefb-40a734fb564e",
  "driverId": "49c8f5be-aa17-46c0-90ca-820fb93145b6",
  "collectType": "transferencia",
  "status": "em_transito",
  "collectDate": "2026-04-16T13:00:00.000Z",
  "notes": "Transferência do pátio filial para a matriz",
  "createdAt": "2026-04-16T13:00:00.000Z"
}
```

---

### Erros possíveis

| HTTP | Situação |
|---|---|
| `400` | Campos obrigatórios ausentes ou inválidos |
| `401` | Token ausente ou expirado |
| `409` | Chassi já cadastrado no sistema |
| `409` | Motorista já possui uma coleta `em_transito` em aberto |

---

## Fluxo completo em Shell (login + coleta)

```bash
BASE_URL="https://4d11ac73-2d20-48bb-b640-17d848840b68-00-2afjmks46q1co.worf.replit.dev"

# 1. Login
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# 2. Criar coleta (transferência entre pátios)
curl -X POST "$BASE_URL/api/collects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "vehicleChassi": "9BWZZZ377VT004251",
    "manufacturerId": "21045ffb-06c9-4851-a096-89a5b78e8d13",
    "yardId": "38da0646-664a-480f-aefb-40a734fb564e",
    "collectType": "transferencia",
    "driverId": "49c8f5be-aa17-46c0-90ca-820fb93145b6",
    "notes": "Transferência entre pátios"
  }'
```

---

*Base URL de desenvolvimento: `https://4d11ac73-2d20-48bb-b640-17d848840b68-00-2afjmks46q1co.worf.replit.dev`*
