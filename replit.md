# Vehicle Delivery Management System

## Overview

This is a vehicle delivery management system (Sistema de Gestão de Entregas de Veículos) built for logistics operations. The application manages the complete lifecycle of new vehicle deliveries - from collection at manufacturers, through storage at company yards, to final delivery to customers.

The system handles:
- **Collections (Coletas)**: Picking up new vehicles from manufacturers
- **Transports**: Managing vehicle transportation and delivery to customers
- **Inventory (Estoque)**: Tracking vehicles through various statuses (pre-stock, in-stock, dispatched, delivered, withdrawn)
- **Driver Management**: Coordinating drivers, sending location-based notifications, and detailed driver performance profiles
- **Driver Profile Page** (`/motoristas/:id/perfil`): Score circular, KPI cards, 6-month performance chart (recharts), infraction history, trip history table, PDF print support
- **Entity Management**: Manufacturers, yards, clients, and delivery locations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Validation**: Zod for input/output validation with drizzle-zod for schema integration
- **Authentication**: Replit Auth (OpenID Connect/OAuth) with Passport.js
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage

### Data Storage
- **Database**: PostgreSQL
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with migrations output to `./migrations`

### Key Design Patterns
- **Shared Types**: The `shared/` directory contains schema definitions used by both frontend and backend
- **Storage Interface**: `server/storage.ts` implements a storage interface pattern for all database operations
- **Path Aliases**: TypeScript path aliases (`@/` for client, `@shared/` for shared code)
- **API Structure**: RESTful endpoints under `/api/` prefix with authentication middleware

### Database Schema
Core entities include:
- **drivers**: Company drivers with modality types (PJ, CLT, agregado)
- **manufacturers**: Vehicle manufacturers (montadoras)
- **yards**: Company storage locations (pátios)
- **clients**: Customer information
- **deliveryLocations**: Customer delivery addresses
- **vehicles**: Vehicle inventory with chassis as primary key
- **collects**: Collection records from manufacturers
- **transports**: Transport/delivery records with auto-generated request numbers (OTD prefix)
- **driverNotifications**: Push notification system for drivers

Status enums for workflow tracking:
- Vehicle status: pre_estoque, em_estoque, despachado, entregue, retirado
- Transport status: pendente, em_transito, entregue, cancelado
- Collect status: pendente, em_andamento, concluida, cancelada

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires DATABASE_URL environment variable)
- **PostGIS 3.5**: Spatial extension enabled for geometry columns (checkinLocation, checkoutLocation in collects/transports tables use geometry(Point, 4326) with GeoJSON Point format `{ type: "Point", coordinates: [longitude, latitude] }`)
- **Drizzle ORM**: Database toolkit for TypeScript (customType for PostGIS geometry with EWKB hex parsing)

### Authentication
- **Replit Auth**: OAuth/OpenID Connect authentication
- **Required Environment Variables**: 
  - `DATABASE_URL`: PostgreSQL connection string
  - `SESSION_SECRET`: Session encryption secret
  - `ISSUER_URL`: OIDC issuer (defaults to Replit)
  - `REPL_ID`: Replit application identifier

### UI Dependencies
- **Radix UI**: Headless UI primitives for accessible components
- **Lucide React**: Icon library
- **date-fns**: Date formatting and manipulation
- **embla-carousel-react**: Carousel component
- **recharts**: Charting library
- **vaul**: Drawer component
- **cmdk**: Command palette component

### Development Tools
- **Vite**: Build tool and dev server
- **esbuild**: Production bundling for server
- **TypeScript**: Type checking (no emit, bundlers handle transpilation)

## Recent Changes

### January 21, 2026
- **Transport Check-in/Check-out Photo Fields**: Updated transports to use the same photo structure as collects
  - Added individual vehicle photos: frontal, lateral1, lateral2, traseira
  - Added panel photos: odometer, fuel level
  - Added damage photos (up to 10) and selfie
  - Removed old "body photos" field in favor of individual photo fields
  - Updated transport form with organized photo sections matching collects form
  - Added `checkinFuelLevelPhoto` and `checkoutFuelLevelPhoto` fields to transports schema

### January 22, 2026
- **Check Points Feature**: Added checkpoint management for route monitoring
  - Created `checkpoints` table in database schema with: name, address, city, state, latitude, longitude
  - Implemented full CRUD API endpoints for checkpoints
  - Created Check Points page (`/checkpoints`) with Google Maps integration
  - Features include: map click to select location, address autocomplete, reverse geocoding
  - Google Maps API key stored in environment variable (`VITE_GOOGLE_MAPS_API_KEY`)
- **Financial Comparison in Expense Settlements**: Added comparison between estimated and actual costs
  - Shows "Despesas Previstas" (estimated) and "Despesas Realizadas" (actual) side by side
  - Compact layout with toll, fuel, and other expenses breakdown
- **Timeline Check Points Page**: New page `/timeline-checkpoints` for tracking transport progress
  - Visual timeline showing transport journey from origin yard to delivery location
  - Intermediate checkpoints between origin and destination
  - Status indicators: pending, reached, completed
  - Progress percentage calculation
  - Ability to assign checkpoints to transports
  - Created `transportCheckpoints` table to associate checkpoints with transports
- **Route Management (Gestão de Rotas)**: New comprehensive route management module (`/routes`)
  - Database table `routes` with origin yard, destination location, truck type, and cost parameters
  - Automatic cost calculations: fuel cost, Arla 32 (5% of fuel), tolls, driver logistics, Ad Valorem, admin fee
  - Profit margin calculation: suggested price = total cost × (1 + margin%)
  - Net profit calculation: suggested price - total cost
  - Favorite routes toggle functionality for quick access
  - Integration with yards and delivery locations
  - Full CRUD API endpoints with proper partial update handling
  - Added to Cadastros menu with Route icon
  - **Google Maps API Integration**: Auto-fetch distance and tolls when origin/destination selected
    - Backend endpoint `/api/routes/calculate-route` using Google Routes API with Distance Matrix fallback
    - Smart state management with `lastCalculatedKey` to prevent duplicate API calls
    - Loading indicators in distance and toll field labels during API calls
    - All fields remain editable for manual adjustments after auto-calculation
- **Traffic Page (Tráfego Agora)**: Real-time traffic monitoring with Google Maps
  - 6 summary cards: active transports, active collects, delayed vehicles, pending, delivered today, vehicles on map
  - Interactive Google Maps with color-coded markers (orange=transport, blue=collect, red=delayed)
  - Delayed vehicles highlighted (>24 hours in transit) with pulse animation
  - Tabs for filtering delayed and active vehicles
  - Auto-refresh every 30 seconds with manual refresh button
  - useMemo-based markersKey ensures map updates when vehicle positions change
- **Expense Settlement PDF Generation**: PDF document on approval
  - Backend route `/api/expense-settlements/:id/pdf` with authentication
  - PDF includes: driver info, transport details, estimated values, expenses table
  - Signature line with driver name and CPF for manual signing
  - "Baixar PDF" button appears when settlement is approved
  - Uses pdfkit library for PDF generation

### February 19, 2026
- **Contract Manager (Gestor de Contratos)**: New module for driver contract management (`/contratos`)
  - Database table `contracts` with contract number, title, driver link, type (PJ/CLT/Agregado), payment terms, dates
  - TipTap rich text editor for creating contract documents (bold, italic, underline, headings, lists, alignment)
  - Three view modes: list (cards), editor (full-page with metadata + text editor), read-only (rendered HTML)
  - Contract content stored as HTML in `content` field
  - Full CRUD API endpoints at `/api/contracts`
  - Added to Cadastros menu in sidebar
  - **N:N contract↔drivers**: A contract can be linked to one or many drivers via `contract_drivers` junction table (per-driver Autentique status preserved). Legacy `contracts.driverId` kept for back-compat (mirrors first linked driver). Atomic create/update via `createContractWithDrivers` and `updateContractWithDrivers` (single DB transaction with `FOR UPDATE` row lock). GET /api/contracts uses batch enrichment (2 queries total, no N+1). `recalculateIsApto` checks both legacy and junction.
- **Send Contract via Email**: Added ability to send contracts to drivers by email
  - New section "Enviar Contrato por Email" in driver edit form
  - Contract selector dropdown with send button
  - Backend endpoint `POST /api/contracts/:id/send-email` using nodemailer SMTP
  - Email includes formatted contract content with OTD Entregas branding
  - Validates driver has email before allowing send
  - **SMTP Configuration Required** (secrets): `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
  - **SMTP Configuration Optional** (env vars): `SMTP_PORT` (default 587), `SMTP_FROM` (defaults to SMTP_USER)
- **Evaluation Criteria Page**: Added route `/criterios-avaliacao` and sidebar link for configuring evaluation criteria
- **Evaluation System Update**: Severity-based evaluation (Leve/Médio/Grave)
  - Each criterion starts with 100 points and is evaluated by severity level
  - Severity levels: Sem Ocorrência (no penalty), Leve, Médio, Grave
  - Each severity has a configurable % penalty (default: Leve=10%, Médio=50%, Grave=100%)
  - Score = 100 - penalty%, weighted by criterion weight for final score
  - Schema fields: `penaltyLeve`, `penaltyMedio`, `penaltyGrave` on `evaluationCriteria` table
  - `evaluationScores` table now stores `severity` enum alongside calculated `score`
- **Truck Models (Modelos)**: New module under Cadastros for managing truck brands and models (`/modelos`)
  - Database table `truck_models` with brand, model, axle configuration, and average fuel consumption
  - Full CRUD API endpoints at `/api/truck-models`
  - Frontend page with search, grouped display by brand, and add/edit/delete dialogs
  - Axle options: 2 to 9 eixos
  - Average consumption in km/l
  - Vehicle value (valor do veículo) - optional, stored as numeric(12,2)
  - Added to Cadastros menu in sidebar with CarFront icon
- **Cotação de Frete**: Freight quote calculator page (`/cotacao-frete`) under Operação menu
  - Input fields: Valor do Bem, Distância km, Frete OTD, Retorno Motorista, Pedágio, Consumo do Veículo, Preço do Diesel
  - Auto-calculates: Comissão Motorista (R$0.50/km), Diesel, Seguro (0.03% do bem), Valor Base, CTe (markup 21.25%), Impostos, Margem
  - Pie chart showing cost distribution (recharts)
  - Summary card with highlighted CTe value
  - All calculations are frontend-only (no backend needed)
- **Cotação de Frete PRO**: Advanced version of freight quote calculator (`/cotacao-frete-pro`) under Operação menu
  - Database table `freight_quotes` for saving quotes with client info, calculation inputs/results
  - Truck model selector auto-fills consumption and vehicle value from `/api/truck-models`
  - Client selector from existing clients or manual entry (name, phone, email)
  - Validity date for quotes with expired badge indicator
  - Two tabs: Calculator (create/edit) and Saved Quotes (list/search/delete/load)
  - Full CRUD API endpoints at `/api/freight-quotes`
  - "Versão Avançada" badge with Sparkles icon in sidebar
- **Portaria New Collect**: Added ability to create new collects directly from the Portaria page when vehicles arrive without pre-existing collect records
- **Damage Report (Relatório de Avarias)**: New page `/relatorio-avarias` under Operação menu
  - Automatically lists all collects and transports that have damage photos (checkinDamagePhotos or checkoutDamagePhotos)
  - Summary cards showing total damage records, total photos, and distribution between collects/transports
  - Tabs to filter by All, Collects only, or Transports only
  - Search by chassis, driver, OTD number, or client
  - Photo gallery with lightbox navigation (prev/next) for viewing damage images
  - Separates check-in and check-out damage photos within each record
- **Jornada do Veículo**: New report page `/jornada-veiculo` under Operação menu
  - Backend route: `GET /api/vehicle-journey/:chassi` returns vehicle + all collects + all transports with full relations
  - Timeline component at top showing progress (Coleta → Pátio → Transporte → Entrega) with semaphoric colors
  - Vehicle header card: chassi, manufacturer, client, status badge, "Gerar PDF do Dossiê" button (uses window.print())
  - Tabs: Coleta (driver info, photos), Logística (movements table + timestamps), Transporte (OTD, route, driver, photos), Entrega (final date, delivery proof photos)
  - Combobox search filtering all vehicles by chassi, manufacturer, or client name
  - Photo gallery with lightbox for all check-in/check-out photos in each section
  - Status colors: Yellow = Aguardando Coleta, Blue = No Pátio/Em Trânsito, Green = Entregue, Gray = Retirado

### April 7, 2026 (continuação)
- **Check-in no Transporte (APP)**: `POST /api/external/transports/:id/checkin`
  - Motorista identificado pelo token JWT (sem precisar do driverId na URL)
  - Valida que o transporte pertence ao motorista autenticado
  - Aceita fotos via multipart/form-data (frontal, laterais, traseira, odômetro, combustível, selfie, avarias)
  - Registra GPS (`checkinLocation`), data/hora e fotos; status → `aguardando_saida`; veículo → `despachado`
- **Check-out no Transporte (APP)**: `POST /api/external/transports/:id/checkout`
  - Mesma autenticação e fotos que o check-in
  - Requer que check-in tenha sido realizado (400 se não)
  - Status → `entregue`; veículo → `entregue`
  - Ambos documentados na API Docs (categoria "Coletas do Motorista") e no Swagger (tag Transportes)
- **Broadcast (Mensagens em Massa)**: envio de push notifications para grupos de motoristas via FCM; filtro geográfico por círculo ou polígono no mapa; dashboard de monitoramento em tempo real; página `/broadcast` na sidebar grupo Motorista
  - `GET /api/broadcasts` — lista broadcasts com stats (enviados/recebidos/lidos)
  - `POST /api/broadcasts` — cria e envia broadcast; aplica filtro geográfico; tabelas: `broadcasts`, `broadcast_recipients`
  - `GET /api/broadcasts/:id` — detalhes com lista de destinatários e status individual
  - `POST /api/broadcasts/preview-recipients` — preview de motoristas elegíveis antes de enviar
  - `POST /api/external/broadcasts/:broadcastId/received` — motorista confirma recebimento
  - `POST /api/external/broadcasts/:broadcastId/read` — motorista marca como lido (Check-in)
- **Firebase Push Notifications**: chaves VAPID armazenadas em `app_settings`; endpoint `POST /api/notifications/push/:driverId` envia push via `web-push` com VAPID; card de configuração na página Integrações
  - `GET/POST/DELETE /api/settings/firebase` — gerencia `firebase_vapid_public_key`, `firebase_vapid_private_key`, `firebase_server_key`
  - Para apps nativos Android/iOS: adicionar FCM Server Key na página Integrações
- **Token de Dispositivo FCM (APP)** — 1 token por motorista:
  - `POST /api/external/driver/device-token` — define/substitui o token FCM; body: `{ token }`; retorna `{ message, deviceToken }`
  - `DELETE /api/external/driver/device-token` — limpa o token (ex: logout); retorna `{ message }`
  - Autenticação via JWT; motorista identificado pelo e-mail do usuário autenticado
  - Schema: coluna `device_token text` (singular) na tabela `drivers`

### April 7, 2026
- **Endpoint: Transportes por Motorista**: `GET /api/drivers/:driverId/transports`
  - Retorna todos os transportes vinculados a um motorista, em qualquer status
  - Resposta enriquecida com: cliente, pátio de origem, local de entrega, motorista e tarifa de viagem
  - Retorna 404 se o motorista não existir
  - Documentado na API Docs (`/api-docs`) sob a tag **Transportes**
- **Exclusão de Transportes com Motivo Obrigatório**: Arquivamento antes de excluir
  - Tabela `deleted_transports` armazena o registro completo + motivo, operador e timestamp
  - `DELETE /api/transports/:id` requer campo `reason` no body (400 se ausente)
  - Veículo retorna automaticamente para `em_estoque` ao excluir o transporte
  - `GET /api/deleted-transports` retorna histórico completo de exclusões
- **Correção: Status de Assinatura de Contrato**: Ao vincular um contrato a um novo motorista, os campos de assinatura anteriores (`autentiqueStatus`, `autentiqueDocId`, `autentiqueSignedUrl`, `autentiqueSentAt`, `driverSignedAt`) são zerados automaticamente para que o novo motorista assine do zero

### April 4, 2026
- **Backup & Restauração System**: Full backup management at `/backup` (Configurações > Backup)
  - Backend: `server/backup/backup-service.ts` — JSON export of all 27 database tables
  - Full or selective backup (choose specific tables)
  - Backup history with download, restore, and delete
  - Restore uses PostgreSQL transaction (atomic rollback on failure)
  - Cleanup tool to remove old backups (keep last N)
  - Admin-only access on all endpoints
  - Backup files stored in `/backups/` directory (gitignored)
  - Dashboard cards: DB size, table count, total records, last backup time
  - Tables tab: per-table record count and disk size

### March 2, 2026
- **Bug Fix: "Concluir Frete" not persisting**: Fixed `PATCH /api/transports/:id/conclude` endpoint
  - Root cause: `storage.updateTransport(id, Partial<InsertTransport>)` was not persisting when called with `{ status, checkoutDateTime }` — the Zod-inferred `InsertTransport` type (with transforms) was incompatible with Drizzle's `.set()` method, causing the update to silently fail
  - Fix: Changed conclude endpoint to use Drizzle ORM directly (`db.update(transports).set(...).where(...)`) with native column types, bypassing the storage abstraction
  - Same approach used for vehicle status update in the same endpoint
  - Transport status now correctly persists to `entregue` and `checkoutDateTime` is recorded
- **Indicadores Dashboard**: KPI dashboard page (`/indicadores`) under new "Indicadores" sidebar menu
  - OTD (On-Time Delivery): percentage of deliveries completed within the agreed deadline
  - Damage-Free Delivery: proportion of deliveries without damage photos
  - OTIF (On-Time In-Full): deliveries both on-time and damage-free
  - Lead Time: average transport time from transit start to checkout
  - Monthly trend charts (AreaChart + BarChart), pie charts per KPI, volume bar chart
  - Period filter (1/3/6/12/24 months) based on delivery completion date (`checkoutDateTime`)
  - API endpoint: `GET /api/indicadores?period=6`
  - Sidebar menu structure: Dados → Indicadores → Operação
### April 30, 2026
- **Driver fitness (isApto) workflow**: Inapto drivers CAN log into the mobile app (and continue using the system), but cannot receive new work or push notifications.
  - **Allowed when inapto**: login, refresh token, validate, profile/expense/account screens, finishing in-progress transports (checkout) or in-progress collects (finalize).
  - **Blocked when inapto** (returns empty list / 403):
    - Lists return empty:
      - `GET /api/external/driver/my-collects` → `{ collects: [], total: 0, blocked: true, blockedReason }`
      - `GET /api/external/driver/my-transports` → `[]`
      - `GET /api/external/transports/my` → `[]`
      - `GET /api/external/transports/pending-count` → `{ count: 0 }`
      - `GET /api/external/transport-proposals/open` → `[]`
    - Actions return 403 `driver_not_apt`:
      - `POST /api/external/transport-proposals/:id/accept`
      - `POST /api/external/transports/:id/checkin`
      - `POST /api/external/collects` (criar coleta)
    - Push notifications:
      - `sendPushToAllActiveDrivers`, `sendPushToDriver`, `sendPushToUnassignedAcceptedDrivers` filter `isApto = "true" AND isActive = "true"`.
      - `POST /api/notifications/push/:driverId` returns 400 if driver inapto/inativo.
      - `POST /api/broadcasts` and `/api/broadcasts/preview-recipients` filter by `isApto = "true"`.
  - Helper: `getDriverFromAuthUser()` and constant `INAPTO_MSG` in `server/routes.ts`.

### May 1, 2026
- **Jornada do Veículo — Distância por Trecho**: novo endpoint e exibição detalhada das distâncias percorridas em cada etapa da jornada do veículo.
  - `GET /api/vehicle-journey/:chassi/distances` retorna `{ collects, transfers, transports, totals, apiKeyConfigured }`.
  - **Coletas**: distância entre check-in (saída da montadora) e check-out (chegada ao pátio); usa `checkinLocation`/`checkoutLocation` (geometry Point) ou, em coletas legadas, os varchar `startLatitude/Longitude` + `endLatitude/Longitude`.
  - **Transferências**: distância entre `originYard` e `destinationYard` (lat/lng do pátio).
  - **Transportes**: `plannedKm` (campo `routeDistanceKm` salvo no momento da criação) e `realizedKm` calculado entre check-in e check-out reais.
  - Cálculo: tenta primeiro Google Directions API (rota viária real); se a chave não estiver configurada ou a chamada falhar, cai para **Haversine** (linha reta GPS). O campo `source` (`directions` | `haversine` | `none`) indica qual método foi usado.
  - **Cache** in-process das chamadas Directions por par de coordenadas (5 decimais ≈ 1m de precisão), TTL 24h.
  - **UI** (`/jornada-veiculo`): nova `DataRow` "Distância Realizada" em cada coleta/transferência/transporte (com indicação do método usado entre parênteses); o tile "Distância Total" no cabeçalho passa a usar o `totalRealizedKm` (coleta + transferência + transporte) com fallback ao planejado.
  - **PDF** (`handlePrint`): replicado nos mesmos três blocos + tile total.
  - Helper renomeado para `journeyHaversineKm` para evitar conflito com declarações `haversineKm` legadas em outras rotas no mesmo arquivo.

- **Bug Fix — Duplicidade de transporte por veículo (CRITICAL)**: corrigida brecha onde `POST /api/transports` permitia criar transporte para veículo `despachado`/`entregue` ou que já tivesse outro transporte ativo.
  - Helper `validateVehicleAvailableForTransport(chassi, excludeTransportId?)` em `server/routes.ts`: rejeita se veículo não existe, status diferente de `pre_estoque`/`em_estoque`, ou se há transporte ativo (status NOT IN `entregue`/`cancelado`) para o mesmo chassi.
  - Aplicado no `POST /api/transports` e também no `PATCH /api/transports/:id` (quando `vehicleChassi` é alterado), passando o id atual em `excludeTransportId` para não auto-bloquear.
  - **Defesa em camada DB**: índice único parcial `uniq_active_transport_per_chassi` em `transports(vehicle_chassi) WHERE status NOT IN ('entregue','cancelado')` em `shared/schema.ts`. Garante atomicidade mesmo sob concorrência (POSTs paralelos para o mesmo chassi).
  - Aplicado via `npm run db:push --force`.

- **Push de proposta — adiar quando tarifa requer aprovação**: quando uma proposta é criada com tarifa cuja `requiresApproval === "true"`, o `rateApprovalStatus` fica `pendente` e o push para motoristas **não** é enviado na criação. O push é disparado somente quando a tarifa transita de `pendente → aprovado` via `PATCH /api/transport-proposals/:id/rate-approval` (menu "Aprovação de tarifa"). Rejeição não dispara push. Propostas sem tarifa ou com tarifa que não requer aprovação seguem o fluxo original (push imediato na criação). Endpoint manual `POST /api/transport-proposals/:id/resend-push` permanece inalterado.
  - **Atomicidade (defesa contra concorrência)**: a transição para `aprovado` usa um `UPDATE ... WHERE id = ? AND rate_approval_status = 'pendente' AND status <> 'cancelada' RETURNING *`. Apenas a primeira requisição concorrente vence (recebe a linha de volta) e dispara o push; as demais executam um UPDATE de fallback sem disparar push. Isso previne (a) duplicidade de push em PATCHes concorrentes e (b) push enviado para proposta cancelada entre o SELECT inicial e o UPDATE.
