/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     description: Cria um novo usuário no sistema com username e senha
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 description: Nome de usuário único
 *                 example: "joao.silva"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Senha do usuário (mínimo 6 caracteres)
 *                 example: "senha123"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do usuário (opcional)
 *                 example: "joao@email.com"
 *               firstName:
 *                 type: string
 *                 description: Nome do usuário
 *                 example: "João"
 *               lastName:
 *                 type: string
 *                 description: Sobrenome do usuário
 *                 example: "Silva"
 *               role:
 *                 type: string
 *                 enum: [admin, operador, visualizador, motorista, portaria]
 *                 description: Função do usuário no sistema
 *                 example: "operador"
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Usuário criado com sucesso"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Dados inválidos ou username/email já em uso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usernameInUse:
 *                 value:
 *                   message: "Username já está em uso"
 *               emailInUse:
 *                 value:
 *                   message: "Email já está em uso"
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Realizar login
 *     description: |
 *       Autentica o usuário com username e senha, retornando tokens JWT.
 *       
 *       - **accessToken**: Token de acesso com validade de 15 minutos
 *       - **refreshToken**: Token de renovação com validade de 7 dias
 *       
 *       Use o accessToken no header Authorization: Bearer {token}
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Nome de usuário
 *                 example: "joao.silva"
 *               password:
 *                 type: string
 *                 description: Senha do usuário
 *                 example: "senha123"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login realizado com sucesso"
 *                 accessToken:
 *                   type: string
 *                   description: Token JWT de acesso (15 min)
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken:
 *                   type: string
 *                   description: Token JWT de renovação (7 dias)
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Credenciais inválidas"
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar tokens
 *     description: |
 *       Renova o accessToken usando o refreshToken.
 *       Use quando o accessToken expirar (erro 401).
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Token de renovação obtido no login
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Tokens renovados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: Novo token de acesso
 *                 refreshToken:
 *                   type: string
 *                   description: Novo token de renovação
 *       401:
 *         description: Refresh token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Realizar logout
 *     description: Invalida o refresh token do usuário, forçando novo login
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout realizado com sucesso"
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obter usuário autenticado
 *     description: Retorna as informações do usuário atualmente autenticado
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Não autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /collects:
 *   post:
 *     summary: Criar coleta ou transferência
 *     description: |
 *       Cria um novo registro de coleta **ou** transferência de veículo conforme o campo `collectType`.
 *
 *       ---
 *
 *       ### Tipo `coleta` (padrão)
 *       Retirada de veículo **na montadora** para entrega no pátio OTD.
 *       - Campo obrigatório adicional: `manufacturerId`
 *       - Um veículo é criado automaticamente com status `pre_estoque` se ainda não existir no sistema
 *       - A coleta é criada com status `em_transito`
 *
 *       ### Tipo `transferencia`
 *       Movimentação de veículo **entre dois pátios OTD**.
 *       - Campo obrigatório adicional: `originYardId` (pátio de origem, diferente de `yardId`)
 *       - O veículo já deve existir no sistema com status `em_estoque`
 *       - O status do veículo é alterado para `em_transferencia`
 *       - A coleta/transferência é criada com status `em_transito`
 *       - A portaria autoriza a saída via `POST /api/portaria/authorize-transfer-exit/{id}`,
 *         alterando o status para `autorizado_portaria`
 *     tags: [Coletas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCollect'
 *           examples:
 *             coleta:
 *               summary: "Exemplo: Nova Coleta (retirada na montadora)"
 *               value:
 *                 collectType: "coleta"
 *                 vehicleChassi: "9BWZZZ377VT004251"
 *                 manufacturerId: "380b776b-dd38-4714-9148-459ac9f2c876"
 *                 yardId: "65981fdf-ceba-44b2-a046-63045b162de9"
 *                 driverId: "64d72138-55b7-4b4e-a4f6-3c41f4d09bf1"
 *                 collectDate: "2026-01-11T10:30:00"
 *                 notes: "Veículo com documentação completa"
 *             transferencia:
 *               summary: "Exemplo: Nova Transferência (entre pátios OTD)"
 *               value:
 *                 collectType: "transferencia"
 *                 vehicleChassi: "9BWZZZ377VT004251"
 *                 originYardId: "65981fdf-ceba-44b2-a046-63045b162de9"
 *                 yardId: "b2e9a7c3-11d4-4f6e-8812-aa3450f9d002"
 *                 driverId: "64d72138-55b7-4b4e-a4f6-3c41f4d09bf1"
 *                 collectDate: "2026-01-11T10:30:00"
 *                 notes: "Transferência para pátio sul"
 *     responses:
 *       201:
 *         description: Coleta / transferência criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Collect'
 *       400:
 *         description: Dados inválidos (ex. originYardId igual a yardId, montadora ausente em coleta, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Não autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /collects/{id}:
 *   patch:
 *     summary: Atualizar coleta (Check-in / Check-out)
 *     description: |
 *       Atualiza os dados de uma coleta existente. Este endpoint é utilizado para:
 *       
 *       **Check-in:** Registra a retirada do veículo na montadora
 *       - Enviar campos checkinDateTime, checkinLocation (geometry Point), checkinSelfiePhoto, etc.
 *       
 *       **Check-out:** Registra a entrega do veículo no pátio
 *       - Enviar campos checkoutDateTime, checkoutLocation (geometry Point), checkoutSelfiePhoto, etc.
 *       - Ao realizar check-out, o veículo é atualizado para status "em_estoque" e a coleta para "finalizada"
 *     tags: [Coletas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da coleta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/CheckinData'
 *               - $ref: '#/components/schemas/CheckoutData'
 *           examples:
 *             checkin:
 *               summary: Exemplo de Check-in
 *               value:
 *                 checkinDateTime: "2026-01-11T10:30:00Z"
 *                 checkinLocation: { type: "Point", coordinates: [-46.633308, -23.550520] }
 *                 checkinSelfiePhoto: "https://storage.example.com/photos/selfie123.jpg"
 *                 checkinBodyPhotos: ["https://storage.example.com/photos/body1.jpg"]
 *                 checkinOdometerPhoto: "https://storage.example.com/photos/odometer.jpg"
 *                 checkinDamagePhotos: []
 *                 checkinNotes: "Veículo em bom estado"
 *             checkout:
 *               summary: Exemplo de Check-out
 *               value:
 *                 checkoutDateTime: "2026-01-11T14:45:00Z"
 *                 checkoutLocation: { type: "Point", coordinates: [-46.600000, -23.520000] }
 *                 checkoutSelfiePhoto: "https://storage.example.com/photos/selfie456.jpg"
 *                 checkoutBodyPhotos: ["https://storage.example.com/photos/body3.jpg"]
 *                 checkoutOdometerPhoto: "https://storage.example.com/photos/odometer2.jpg"
 *                 checkoutDamagePhotos: []
 *                 checkoutNotes: "Entrega realizada"
 *     responses:
 *       200:
 *         description: Coleta atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Collect'
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Coleta não encontrada
 */

/**
 * @swagger
 * /collects:
 *   get:
 *     summary: Listar coletas e transferências
 *     description: |
 *       Retorna todos os registros de coletas e transferências cadastrados no sistema.
 *
 *       Cada item possui o campo **`collectType`** que indica o tipo do registro:
 *       - `coleta` — retirada de veículo na montadora
 *       - `transferencia` — movimentação de veículo entre pátios OTD
 *
 *       **Controle de acesso:**
 *       - Perfil `motorista` — retorna apenas as coletas/transferências atribuídas ao próprio motorista
 *       - Demais perfis — retorna todos os registros
 *
 *       Para filtrar pelo tipo, utilize o campo `collectType` no cliente após receber a lista.
 *       Os objetos retornados incluem dados relacionados: `manufacturer`, `originYard`, `yard`, `driver`.
 *     tags: [Coletas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de coletas e transferências
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Collect'
 *             examples:
 *               coleta:
 *                 summary: "Exemplo: Coleta"
 *                 value:
 *                   - id: "a1b2c3d4-0000-0000-0000-000000000001"
 *                     collectType: "coleta"
 *                     vehicleChassi: "9BWZZZ377VT004251"
 *                     manufacturerId: "380b776b-dd38-4714-9148-459ac9f2c876"
 *                     originYardId: null
 *                     yardId: "65981fdf-ceba-44b2-a046-63045b162de9"
 *                     status: "em_transito"
 *                     collectDate: "2026-01-11T10:30:00.000Z"
 *               transferencia:
 *                 summary: "Exemplo: Transferência"
 *                 value:
 *                   - id: "a1b2c3d4-0000-0000-0000-000000000002"
 *                     collectType: "transferencia"
 *                     vehicleChassi: "9BWZZZ377VT004251"
 *                     manufacturerId: null
 *                     originYardId: "65981fdf-ceba-44b2-a046-63045b162de9"
 *                     yardId: "b2e9a7c3-11d4-4f6e-8812-aa3450f9d002"
 *                     status: "autorizado_portaria"
 *                     collectDate: "2026-01-11T10:30:00.000Z"
 *       401:
 *         description: Não autenticado
 */

/**
 * @swagger
 * /collects/{id}:
 *   get:
 *     summary: Obter coleta por ID
 *     description: Retorna os detalhes de uma coleta específica
 *     tags: [Coletas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da coleta
 *     responses:
 *       200:
 *         description: Detalhes da coleta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Collect'
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Coleta não encontrada
 */

/**
 * @swagger
 * /external/collects:
 *   post:
 *     summary: Criar coleta ou transferência (App Mobile)
 *     description: |
 *       Endpoint utilizado pelo **aplicativo mobile** para o motorista registrar o início de uma coleta ou transferência.
 *       O `driverId` é preenchido automaticamente a partir do token JWT do motorista autenticado — não é necessário enviá-lo.
 *
 *       ---
 *
 *       ### Tipo `coleta` (padrão)
 *       Retirada de veículo **na montadora** para entrega no pátio OTD.
 *       - Campo obrigatório adicional: `manufacturerId`
 *       - Se o veículo não existir no sistema, é criado automaticamente com status `pre_estoque`
 *       - A coleta é criada com status `em_transito`
 *
 *       ### Tipo `transferencia`
 *       Movimentação de veículo **entre dois pátios OTD**.
 *       - Campo obrigatório adicional: `originYardId` (deve ser diferente de `yardId`)
 *       - O veículo **deve existir** no sistema — se não existir, retorna erro 404
 *       - A transferência é criada com status `em_transito`
 *
 *       **Regras comuns:**
 *       - O motorista não pode ter outra coleta com status `em_transito` em aberto (retorna 409)
 *       - Apenas motoristas com conta ativa podem usar este endpoint
 *     tags: [App Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleChassi
 *               - yardId
 *             properties:
 *               collectType:
 *                 type: string
 *                 enum: [coleta, transferencia]
 *                 default: coleta
 *                 description: "Tipo do registro. Default: 'coleta'."
 *               vehicleChassi:
 *                 type: string
 *                 description: Chassi do veículo
 *                 example: "9BWZZZ377VT004251"
 *               manufacturerId:
 *                 type: string
 *                 format: uuid
 *                 description: "ID da montadora de origem. Obrigatório quando collectType='coleta'."
 *               originYardId:
 *                 type: string
 *                 format: uuid
 *                 description: "ID do pátio de origem. Obrigatório quando collectType='transferencia'."
 *               yardId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do pátio de destino
 *               notes:
 *                 type: string
 *                 description: Observações
 *           examples:
 *             coleta:
 *               summary: "Nova Coleta (retirada na montadora)"
 *               value:
 *                 collectType: "coleta"
 *                 vehicleChassi: "9BWZZZ377VT004251"
 *                 manufacturerId: "380b776b-dd38-4714-9148-459ac9f2c876"
 *                 yardId: "65981fdf-ceba-44b2-a046-63045b162de9"
 *                 notes: "Veículo com documentação completa"
 *             transferencia:
 *               summary: "Nova Transferência (entre pátios OTD)"
 *               value:
 *                 collectType: "transferencia"
 *                 vehicleChassi: "9BWZZZ377VT004251"
 *                 originYardId: "65981fdf-ceba-44b2-a046-63045b162de9"
 *                 yardId: "b2e9a7c3-11d4-4f6e-8812-aa3450f9d002"
 *                 notes: "Transferência solicitada pela operação"
 *     responses:
 *       201:
 *         description: Coleta / transferência registrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Coleta registrada com sucesso."
 *                 collect:
 *                   $ref: '#/components/schemas/Collect'
 *       400:
 *         description: Dados inválidos ou validação de tipo falhou
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Motorista não encontrado ou veículo inexistente (apenas para transferências)
 *       409:
 *         description: Motorista já possui uma coleta em andamento
 */

/**
 * @swagger
 * /external/driver/my-collects:
 *   get:
 *     summary: Minhas coletas (App Mobile)
 *     description: |
 *       Retorna todas as coletas e transferências atribuídas ao motorista autenticado.
 *       O motorista é identificado automaticamente pelo JWT — não é necessário informar ID.
 *
 *       Utilize o parâmetro `status` para filtrar por situação da coleta.
 *       Os objetos retornados incluem os dados relacionados de `manufacturer` e `yard`.
 *     tags: [App Mobile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [em_transito, finalizada, autorizado_portaria, cancelada]
 *         description: Filtra as coletas pelo status informado. Se omitido, retorna todas.
 *     responses:
 *       200:
 *         description: Dados do motorista e suas coletas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 driver:
 *                   type: object
 *                   description: Dados do motorista autenticado
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     cpf:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *                     driverType:
 *                       type: string
 *                     modality:
 *                       type: string
 *                     isApto:
 *                       type: string
 *                     profilePhoto:
 *                       type: string
 *                       nullable: true
 *                 collects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Collect'
 *                 total:
 *                   type: integer
 *                   description: Total de registros retornados
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Motorista não encontrado para o usuário autenticado
 */

/**
 * @swagger
 * /external/collects/{id}/finalize:
 *   post:
 *     summary: Finalizar coleta (App Mobile)
 *     description: |
 *       Endpoint utilizado pelo aplicativo mobile para finalizar uma coleta em andamento.
 *       O motorista autenticado envia sua localização (latitude e longitude) ao chegar no pátio de destino.
 *       A coleta muda de status `em_transito` para `finalizada`.
 *       
 *       **Regras de negócio:**
 *       - Apenas o motorista vinculado à coleta pode finalizá-la
 *       - A coleta deve estar com status `em_transito`
 *       - Coletas já finalizadas retornam erro 409
 *       - Latitude deve estar entre -90 e 90, longitude entre -180 e 180
 *     tags: [Coletas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da coleta a ser finalizada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: string
 *                 example: "-23.5505"
 *                 description: Latitude da localização do motorista
 *               longitude:
 *                 type: string
 *                 example: "-46.6333"
 *                 description: Longitude da localização do motorista
 *     responses:
 *       200:
 *         description: Coleta finalizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Coleta finalizada com sucesso. Aguardando checkout no pátio."
 *                 collect:
 *                   $ref: '#/components/schemas/Collect'
 *       400:
 *         description: Latitude e longitude são obrigatórios ou inválidos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Motorista não tem permissão para finalizar esta coleta
 *       404:
 *         description: Coleta não encontrada
 *       409:
 *         description: Coleta já finalizada ou em status incompatível
 */

/**
 * @swagger
 * /external/drivers/register:
 *   post:
 *     summary: Auto-cadastro de motorista (público)
 *     description: |
 *       Cadastra um novo motorista **sem necessidade de autenticação**.
 *       Use este endpoint no primeiro contato do motorista com o aplicativo.
 *       Aceita multipart/form-data para envio de foto de perfil e documentos.
 *       **`email` e `password` são obrigatórios** — ao concluir o cadastro, uma conta de acesso é criada automaticamente com role **motorista**.
 *     tags: [Motoristas]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - cpf
 *               - phone
 *               - birthDate
 *               - cnhType
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome completo do motorista
 *                 example: "João Silva"
 *               cpf:
 *                 type: string
 *                 description: CPF (somente números)
 *                 example: "12345678900"
 *               phone:
 *                 type: string
 *                 description: Telefone com DDD
 *                 example: "41999998888"
 *               birthDate:
 *                 type: string
 *                 format: date
 *                 description: Data de nascimento (YYYY-MM-DD)
 *                 example: "1985-03-15"
 *               cnhType:
 *                 type: string
 *                 enum: [A, B, C, D, E, AB, AC, AD, AE]
 *                 description: Categoria da CNH
 *                 example: "D"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-mail do motorista — obrigatório, usado como login. Deve ser único no sistema
 *                 example: "joao.silva@email.com"
 *               password:
 *                 type: string
 *                 description: Senha de acesso — obrigatório, mín. 6 caracteres. Cria automaticamente conta de acesso com role motorista
 *                 example: "senha123"
 *               cep:
 *                 type: string
 *                 example: "80010-000"
 *               address:
 *                 type: string
 *                 example: "Rua das Flores"
 *               addressNumber:
 *                 type: string
 *                 example: "123"
 *               complement:
 *                 type: string
 *                 example: "Apto 4"
 *               neighborhood:
 *                 type: string
 *                 example: "Centro"
 *               city:
 *                 type: string
 *                 example: "Curitiba"
 *               state:
 *                 type: string
 *                 example: "PR"
 *               modality:
 *                 type: string
 *                 enum: [pj, clt, agregado]
 *                 description: Modalidade de contratação (opcional no cadastro inicial)
 *               driverType:
 *                 type: string
 *                 enum: [coleta, transporte]
 *                 description: "Tipo de motorista — definido automaticamente como 'transporte' para cadastros pelo app"
 *               profilePhotoFile:
 *                 type: string
 *                 format: binary
 *                 description: Foto de perfil (JPG, PNG)
 *               cnhFrontFile:
 *                 type: string
 *                 format: binary
 *                 description: Frente da CNH (JPG, PNG)
 *               cnhBackFile:
 *                 type: string
 *                 format: binary
 *                 description: Verso da CNH (JPG, PNG)
 *               rgFile:
 *                 type: string
 *                 format: binary
 *                 description: RG (JPG, PNG)
 *               addressProofFile:
 *                 type: string
 *                 format: binary
 *                 description: Comprovante de residência (JPG, PNG)
 *     responses:
 *       201:
 *         description: Motorista cadastrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 cpf:
 *                   type: string
 *                 profilePhoto:
 *                   type: string
 *                   nullable: true
 *                   example: "/uploads/abc123.jpg"
 *                 cnhFrontPhoto:
 *                   type: string
 *                   nullable: true
 *                 cnhBackPhoto:
 *                   type: string
 *                   nullable: true
 *                 rgPhoto:
 *                   type: string
 *                   nullable: true
 *                 addressProofPhoto:
 *                   type: string
 *                   nullable: true
 *                 documentsApproved:
 *                   type: string
 *                   example: "pendente"
 *                 isActive:
 *                   type: string
 *                   example: "true"
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dados inválidos ou campos obrigatórios ausentes
 *       409:
 *         description: CPF já cadastrado no sistema
 */

/**
 * @swagger
 * /locations/states:
 *   get:
 *     summary: Listar todos os estados brasileiros
 *     description: |
 *       Retorna os 27 estados brasileiros em ordem alfabética.
 *       **Endpoint público** — não requer autenticação.
 *       Os dados são obtidos da API do IBGE com cache de 24 horas.
 *     tags: [Localidades]
 *     responses:
 *       200:
 *         description: Lista de estados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   uf:
 *                     type: string
 *                     description: Sigla do estado
 *                     example: "PR"
 *                   name:
 *                     type: string
 *                     description: Nome completo do estado
 *                     example: "Paraná"
 *             example:
 *               - uf: "AC"
 *                 name: "Acre"
 *               - uf: "AL"
 *                 name: "Alagoas"
 *               - uf: "SP"
 *                 name: "São Paulo"
 *       500:
 *         description: Erro ao comunicar com a API do IBGE
 */

/**
 * @swagger
 * /locations/cities/{uf}:
 *   get:
 *     summary: Listar municípios de um estado
 *     description: |
 *       Retorna todos os municípios de um estado brasileiro em ordem alfabética.
 *       **Endpoint público** — não requer autenticação.
 *       Os dados são obtidos da API do IBGE com cache de 24 horas.
 *     tags: [Localidades]
 *     parameters:
 *       - in: path
 *         name: uf
 *         required: true
 *         schema:
 *           type: string
 *           example: "PR"
 *         description: "Sigla do estado (case-insensitive). Ex: PR, SP, RJ, MG"
 *     responses:
 *       200:
 *         description: Lista de municípios do estado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: Código IBGE do município
 *                     example: 4100103
 *                   name:
 *                     type: string
 *                     description: Nome do município
 *                     example: "Curitiba"
 *             example:
 *               - id: 4106902
 *                 name: "Curitiba"
 *               - id: 4113700
 *                 name: "Londrina"
 *               - id: 4115200
 *                 name: "Maringá"
 *       500:
 *         description: Erro ao comunicar com a API do IBGE ou UF inválida
 */

/**
 * @swagger
 * /external/transports/{id}/checkin:
 *   post:
 *     summary: Check-in do motorista no transporte (APP)
 *     description: |
 *       Realiza o check-in do motorista em um transporte especifico.
 *       O motorista e identificado pelo token JWT - sem necessidade de informar o driverId.
 *       Aceita fotos do veiculo como multipart/form-data.
 *       Muda o status do transporte para aguardando_saida.
 *       Valida que o transporte pertence ao motorista autenticado.
 *     tags: [Transportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do transporte
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: string
 *                 description: Latitude GPS do motorista
 *                 example: "-25.6359"
 *               longitude:
 *                 type: string
 *                 description: Longitude GPS do motorista
 *                 example: "-49.1816"
 *               notes:
 *                 type: string
 *                 description: Observacoes do check-in
 *               frontalPhotoFile:
 *                 type: string
 *                 format: binary
 *                 description: Foto frontal do veiculo
 *               lateral1PhotoFile:
 *                 type: string
 *                 format: binary
 *               lateral2PhotoFile:
 *                 type: string
 *                 format: binary
 *               traseiraPhotoFile:
 *                 type: string
 *                 format: binary
 *               odometerPhotoFile:
 *                 type: string
 *                 format: binary
 *               fuelLevelPhotoFile:
 *                 type: string
 *                 format: binary
 *               selfiePhotoFile:
 *                 type: string
 *                 format: binary
 *               damagePhotoFiles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Fotos de avarias (ate 10 arquivos)
 *     responses:
 *       200:
 *         description: Check-in realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transport:
 *                   type: object
 *       400:
 *         description: Check-in ja realizado ou transporte nao permite check-in
 *       401:
 *         description: Nao autenticado
 *       403:
 *         description: Transporte nao pertence ao motorista autenticado
 *       404:
 *         description: Transporte ou motorista nao encontrado
 */

/**
 * @swagger
 * /external/transports/{id}/checkout:
 *   post:
 *     summary: Check-out do motorista no transporte (APP)
 *     description: |
 *       Realiza o check-out do motorista em um transporte (entrega ao cliente).
 *       Requer que o check-in tenha sido realizado anteriormente.
 *       O motorista e identificado pelo token JWT.
 *       Muda o status do transporte para entregue e atualiza o veiculo.
 *     tags: [Transportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do transporte
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: string
 *                 description: Latitude GPS do motorista na entrega
 *                 example: "-23.5505"
 *               longitude:
 *                 type: string
 *                 description: Longitude GPS do motorista na entrega
 *                 example: "-46.6333"
 *               notes:
 *                 type: string
 *                 description: Observacoes da entrega
 *               frontalPhotoFile:
 *                 type: string
 *                 format: binary
 *               lateral1PhotoFile:
 *                 type: string
 *                 format: binary
 *               lateral2PhotoFile:
 *                 type: string
 *                 format: binary
 *               traseiraPhotoFile:
 *                 type: string
 *                 format: binary
 *               odometerPhotoFile:
 *                 type: string
 *                 format: binary
 *               fuelLevelPhotoFile:
 *                 type: string
 *                 format: binary
 *               selfiePhotoFile:
 *                 type: string
 *                 format: binary
 *               damagePhotoFiles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Check-out realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 transport:
 *                   type: object
 *       400:
 *         description: Check-in nao realizado ou transporte ja entregue/cancelado
 *       401:
 *         description: Nao autenticado
 *       403:
 *         description: Transporte nao pertence ao motorista autenticado
 *       404:
 *         description: Transporte ou motorista nao encontrado
 */

/**
 * @swagger
 * /external/driver/my-transports:
 *   get:
 *     summary: Listar transportes do motorista autenticado (APP)
 *     description: |
 *       Retorna todos os transportes do motorista logado no app. O motorista e identificado
 *       automaticamente pelo token JWT (via e-mail do usuario autenticado), sem necessidade
 *       de informar o ID na URL. Utiliza o mesmo access_token obtido em /external/auth/token.
 *       Retorna array vazio se nao houver transportes vinculados.
 *     tags: [Transportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de transportes do motorista logado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   requestNumber:
 *                     type: string
 *                     example: "OTD00004"
 *                   vehicleChassi:
 *                     type: string
 *                   status:
 *                     type: string
 *                     enum: [pendente, aguardando_saida, em_transito, entregue, cancelado]
 *                   deliveryDate:
 *                     type: string
 *                     format: date
 *                   routeDistanceKm:
 *                     type: string
 *                   estimatedTolls:
 *                     type: string
 *                   estimatedFuel:
 *                     type: string
 *                   client:
 *                     type: object
 *                     nullable: true
 *                   originYard:
 *                     type: object
 *                     nullable: true
 *                   deliveryLocation:
 *                     type: object
 *                     nullable: true
 *                   driver:
 *                     type: object
 *                     nullable: true
 *                   travelRate:
 *                     type: object
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Nao autenticado - token JWT ausente ou invalido
 *       404:
 *         description: Motorista nao encontrado para o usuario autenticado
 *       500:
 *         description: Erro interno ao buscar transportes
 */

/**
 * @swagger
 * /drivers/{driverId}/transports:
 *   get:
 *     summary: Listar transportes de um motorista
 *     description: |
 *       Retorna todos os transportes vinculados ao motorista informado, em todos os status
 *       (pendente, aguardando_saida, em_transito, entregue, cancelado).
 *       Cada transporte é retornado com dados enriquecidos: cliente, pátio de origem,
 *       local de entrega, dados do motorista e tarifa de viagem.
 *     tags: [Transportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do motorista
 *         example: "580503d3-bdc1-433e-b5ca-5005651ff1f8"
 *     responses:
 *       200:
 *         description: Lista de transportes do motorista (pode ser vazia)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                     description: ID do transporte
 *                   requestNumber:
 *                     type: string
 *                     description: Número do pedido (ex. OTD00001)
 *                     example: "OTD00001"
 *                   vehicleChassi:
 *                     type: string
 *                     description: Chassi do veículo
 *                   status:
 *                     type: string
 *                     enum: [pendente, aguardando_saida, em_transito, entregue, cancelado]
 *                     description: Status atual do transporte
 *                   deliveryDate:
 *                     type: string
 *                     format: date
 *                     description: Data prevista de entrega
 *                   checkinDateTime:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     description: Data/hora do check-in
 *                   checkoutDateTime:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                     description: Data/hora do check-out
 *                   routeDistanceKm:
 *                     type: string
 *                     description: Distância da rota em km
 *                   estimatedTolls:
 *                     type: string
 *                     description: Pedágios estimados (R$)
 *                   estimatedFuel:
 *                     type: string
 *                     description: Combustível estimado (R$)
 *                   client:
 *                     type: object
 *                     nullable: true
 *                     description: Dados do cliente
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       contactName:
 *                         type: string
 *                   originYard:
 *                     type: object
 *                     nullable: true
 *                     description: Pátio de origem
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       city:
 *                         type: string
 *                       state:
 *                         type: string
 *                   deliveryLocation:
 *                     type: object
 *                     nullable: true
 *                     description: Local de entrega
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       address:
 *                         type: string
 *                       city:
 *                         type: string
 *                       state:
 *                         type: string
 *                       responsibleName:
 *                         type: string
 *                       responsiblePhone:
 *                         type: string
 *                   driver:
 *                     type: object
 *                     nullable: true
 *                     description: Dados do motorista
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       cnhType:
 *                         type: string
 *                   travelRate:
 *                     type: object
 *                     nullable: true
 *                     description: Tarifa de viagem aplicada
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       rateType:
 *                         type: string
 *                       rateValue:
 *                         type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Nao autenticado - token JWT ausente ou invalido
 *       404:
 *         description: Motorista não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: "Driver not found"
 *       500:
 *         description: Erro interno ao buscar transportes
 */

/**
 * @swagger
 * /portaria/authorize/{id}:
 *   post:
 *     summary: Portaria — Autorizar entrada de coleta
 *     description: |
 *       Autoriza a **entrada** de um veículo no pátio através da portaria (fluxo de coleta).
 *       Esta operação realiza automaticamente o check-out da coleta, alterando:
 *       - Status da coleta → `finalizada`
 *       - Status do veículo → `em_estoque`
 *     tags: [Portaria]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da coleta a ser autorizada
 *     responses:
 *       200:
 *         description: Entrada autorizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Collect'
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Coleta não encontrada
 */

/**
 * @swagger
 * /portaria/authorize-transfer-exit/{id}:
 *   post:
 *     summary: Portaria — Autorizar saída de transferência
 *     description: |
 *       Autoriza a **saída** de um veículo em transferência entre pátios OTD.
 *       Usado exclusivamente para registros com `collectType='transferencia'`.
 *       Esta operação altera:
 *       - Status da transferência → `autorizado_portaria`
 *       - Status do veículo → `em_transferencia`
 *     tags: [Portaria]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da transferência (coleta com collectType='transferencia') a ser autorizada para saída
 *     responses:
 *       200:
 *         description: Saída da transferência autorizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Collect'
 *       400:
 *         description: Registro não é uma transferência
 *       401:
 *         description: Não autenticado
 *       404:
 *         description: Transferência não encontrada
 */
