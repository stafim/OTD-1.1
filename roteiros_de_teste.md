# Roteiros de Teste — Cadastros OTD Logistics

Documento com cenários de teste manuais para validar os formulários de cadastro do sistema.

Convenções:
- **Pré-condição**: estado necessário antes do teste
- **Passos**: ações a executar
- **Resultado esperado**: comportamento correto
- Usar usuário admin: `admin / adminTq62md88**`

---

## 1. Pátios (Yards)

**Caminho:** Menu → Cadastros → Pátios → Novo Pátio

### 1.1 Cadastro válido (caminho feliz)
- **Passos:**
  1. Preencher Nome: `Pátio Teste Curitiba`
  2. CEP: `81260-900` → confirmar autopreenchimento de Endereço, Bairro, Cidade, Estado
  3. Número: `100`
  4. Telefone: `(41) 3333-0000`
  5. Capacidade máxima: `200`
  6. Status: Ativo
  7. Confirmar pin no mapa (latitude/longitude preenchidos)
  8. Salvar
- **Esperado:** Toast de sucesso; pátio aparece na lista; banco salva latitude/longitude.

### 1.2 Validações obrigatórias
- **Passos:** Tentar salvar com Nome em branco; depois com CEP inválido (`00000-000`); depois sem capacidade.
- **Esperado:** Erros de validação inline; nada é enviado.

### 1.3 Edição
- **Passos:** Editar pátio existente, alterar capacidade para `500`, salvar.
- **Esperado:** Lista reflete novo valor sem reload manual.

### 1.4 Inativação
- **Passos:** Editar e marcar Status = Inativo.
- **Esperado:** Pátio inativo não aparece em seletores de Coleta/Transporte.

---

## 2. Montadoras (Manufacturers)

**Caminho:** Menu → Cadastros → Montadoras → Nova Montadora

### 2.1 Cadastro válido
- **Passos:**
  1. Nome: `Volvo Teste`
  2. CEP: `81260-900` → autopreenchimento
  3. Número: `2600`, Bairro: `Cidade Industrial`
  4. Telefone: `(41) 3317-0000`
  5. E-mail: `contato@volvo-teste.com.br`
  6. Contato: `João Silva`
  7. Confirmar coordenadas no mapa
  8. Salvar
- **Esperado:** Cadastro salvo com latitude/longitude; aparece na lista de Montadoras e no seletor de Nova Coleta.

### 2.2 Validação de e-mail
- **Passos:** Inserir e-mail inválido `abc@`.
- **Esperado:** Erro de validação no campo.

### 2.3 Cadastro sem e-mail/telefone
- **Passos:** Cadastrar apenas Nome + Endereço completo (campos opcionais em branco).
- **Esperado:** Salva normalmente.

### 2.4 Vínculo com Coleta
- **Pré-condição:** Montadora cadastrada.
- **Passos:** Criar Nova Coleta → selecionar a montadora.
- **Esperado:** Origem da coleta usa endereço/coordenadas da montadora.

---

## 3. Clientes (Clients)

**Caminho:** Menu → Cadastros → Clientes → Novo Cliente

### 3.1 Cadastro válido
- **Passos:**
  1. Nome: `Cliente Teste S/A`
  2. CNPJ: `43.999.424/0001-14` (válido)
  3. CEP/Endereço completo via autopreenchimento
  4. Telefone, E-mail, Nome do Contato
  5. Custo diário (diária de pátio): `25,00`
  6. Dias de carência no pátio: `3`
  7. Salvar
- **Esperado:** Cliente criado e visível na lista.

### 3.2 Validação de CNPJ
- **Passos:** Inserir CNPJ inválido `00.000.000/0000-00`.
- **Esperado:** Erro de validação; bloqueia o save.

### 3.3 Credenciais de portal (opcional)
- **Passos:** Preencher username + password e salvar; depois tentar logar com essas credenciais no portal do cliente.
- **Esperado:** Login funciona; sem credenciais o cliente não acessa portal.

### 3.4 Inativação
- **Passos:** Inativar o cliente.
- **Esperado:** Cliente some dos seletores ativos; locais de entrega vinculados continuam no banco mas não selecionáveis.

---

## 4. Locais de Entrega (Delivery Locations)

**Caminho:** Cliente → Detalhe/edição → aba Locais de Entrega → Novo Local

### 4.1 Cadastro válido
- **Pré-condição:** Cliente "Cliente Teste S/A" cadastrado.
- **Passos:**
  1. Nome do local: `Filial Paulínia`
  2. Endereço completo via autocomplete (Google Maps): `Rod. Prof. Zeferino Vaz, KM 138, Paulínia/SP`
  3. Complemento: `Portaria 2`
  4. Responsável: `Recebimento`
  5. Telefone responsável: `(19) 3874-0000`
  6. E-mails de notificação: `recebimento@cliente.com`
  7. Salvar
- **Esperado:** Local salvo com latitude/longitude; aparece como destino selecionável em Transporte.

### 4.2 Múltiplos e-mails
- **Passos:** Inserir 3 e-mails (recebimento1@, recebimento2@, gerente@).
- **Esperado:** Todos salvos como array; ao criar transporte, todos recebem notificações.

### 4.3 Endereço sem coordenadas
- **Passos:** Digitar endereço manualmente sem usar o autocomplete do Google.
- **Esperado:** Mensagem alertando que coordenadas são necessárias para roteirização (ou bloquear save).

### 4.4 Edição de coordenadas
- **Passos:** Arrastar pin no mapa para ajustar a posição exata.
- **Esperado:** Latitude/longitude atualizadas no banco.

### 4.5 Inativação
- **Passos:** Inativar um local.
- **Esperado:** Não aparece como destino disponível em Novo Transporte.

---

## 5. Motoristas (Drivers)

**Caminho:** Menu → Cadastros → Motoristas → Novo Motorista

### 5.1 Cadastro válido (motorista de coleta)
- **Passos:**
  1. Foto de perfil (upload)
  2. Nome: `Motorista Teste`
  3. CPF: `123.456.789-09` (válido)
  4. Data de nascimento: `01/01/1985`
  5. E-mail: `motorista.teste@otd.com`
  6. Telefone: `(41) 99999-0000`
  7. Endereço completo via CEP
  8. Tipo: `coleta`; Modalidade: `própria`; CNH: `D`
  9. Senha + confirmação para login no app
  10. Apto: Sim; Ativo: Sim
  11. Salvar
- **Esperado:** Motorista criado; usuário no `system_users` criado; consegue logar no app mobile.

### 5.2 Validação de CPF
- **Passos:** Inserir CPF inválido `111.111.111-11`.
- **Esperado:** Erro de validação inline.

### 5.3 CPF duplicado
- **Pré-condição:** Já existe motorista com CPF X.
- **Passos:** Tentar cadastrar outro com o mesmo CPF.
- **Esperado:** Erro de duplicidade retornado pelo backend.

### 5.4 Senha vs confirmação
- **Passos:** Senha `12345678` + Confirmação `87654321`.
- **Esperado:** Erro "senhas não conferem".

### 5.5 Motorista não-apto
- **Passos:** Cadastrar com `Apto = Não` e tentar usar em Nova Coleta.
- **Esperado:** Não aparece no seletor de motoristas (form filtra `isApto = true`).

### 5.6 Motorista de transporte
- **Passos:** Tipo = `transporte`, Modalidade = `agregado`, CNH = `E`.
- **Esperado:** Aparece em Propostas de Transporte; não aparece em Coletas.

### 5.7 Edição de documentos
- **Passos:** Editar motorista → aba Documentos → upload CNH e comprovante de residência.
- **Esperado:** Arquivos salvos e recuperáveis no Object Storage.

### 5.8 Inativação
- **Passos:** Marcar `Ativo = Não`.
- **Esperado:** Sumiu de seletores; sessão ativa do app é invalidada no próximo refresh.

---

## Smoke test integrado (após os cadastros)

1. Criar Pátio → Montadora → Cliente → Local de Entrega → Motorista (apto, coleta).
2. Criar Coleta selecionando os cadastros acima.
3. Autorizar entrada do veículo na portaria.
4. Criar Transporte vinculando o local de entrega.
5. Conferir aparecimento do veículo em Maps Agora e Dashboard.

**Esperado:** Fluxo completo sem erro 500; dados consistentes nas listagens e relatórios.
