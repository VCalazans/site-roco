# Product Context — ROCO

## Contexto de Negócio
ROCO é uma **fabricante industrial brasileira**. O material de referência (`.psd`) mostra um
ambiente futurista com estética neon dual-tone (ciano à esquerda, âmbar à direita), o galpão/
sede da ROCO e um piso fabril — reforçando o posicionamento industrial e tecnológico.
> A confirmar com o stakeholder: linha de produtos oficial, segmento e claims de marca.

## Fluxos Principais (fase atual)
1. Visitante acessa `/` → é redirecionado para `/pt` (ou `/en` conforme idioma).
2. Vê a página "Tem novidade chegando!" com a mensagem de site em construção.
3. Pode: acessar **Produtos**, **Baixar Catálogo**, ou **Entrar em contato**.
   > Destinos desses links são placeholders (`#produtos`, `#catalogo`, `#contato`) até
   > que as URLs/recursos reais sejam definidos (ver decisionLog / progress).

## Integrações de Negócio
- **WhatsApp (MCP Archicode)**: disponível para automações/notificações internas.
- Futuras: e-mail de contato, PDF do catálogo, site/loja de produtos.

## Restrições de Negócio
- Conteúdo primário em **pt-BR** (mercado brasileiro); en como secundário.
- LGPD: ao introduzir formulários, tratar dados pessoais com consentimento e mínimo necessário.

## Personas
### Site Público
- **Cliente/Parceiro industrial**: quer conhecer produtos, obter catálogo e entrar em contato.
- **Visitante geral**: quer entender o que é a ROCO e como conversar com a empresa.

### Portal Interno (CRM)
- **Representante comercial em onboarding**: acessa via Google OAuth, preenche perfil/empresa,
  faz upload de documentos (CNPJ, CEP), aguarda aprovação do time interno; após aprovação,
  acessa dashboard com pedidos/comissões (ERP futuro).
- **Time interno (admin/sales_manager)**: gerencia catálogo (CRUD produtos, embalagens, categorias,
  badges, imagens R2), revisa onboarding de representantes (aprova/rejeita), consulta audit logs,
  dispara sync manual do ERP.

## Fluxos de Negócio

### Fluxo de Visitante (Site Público)
1. Acessa `/pt` (ou `/en`) → landing "Tem novidade chegando!" com hero + 4 CTAs.
2. Clica **"Conheça nossos Produtos"** → `/pt/catalogo` (listagem via API `/api/products`).
3. Clica **"Baixar Catálogo"** → download PDF (link externo ou arquivo.pdf).
4. Clica **"Entre em contato"** ou **"Ligamos pra você"** → abre modal com form Mautic (id=1).
5. Preenche CNPJ/empresa/email/telefone → validação client-side (CNPJ, telefone) + bloqueio
   de submit inválido → POST via Mautic → lead criado no Mautic.
6. Tracking: pageview em cada rota (`mtc.js` via `mautic-tracking.tsx`); hit enviado a
   `POST /mtc/event` ou pixel `mtracking.gif`.

### Fluxo de Representante (Portal)
1. Acessa `/portal/login` (link de convite via WhatsApp/e-mail é fase futura).
2. Login com Google (SSO) → primeira vez: onboarding wizard (MUI Stepper).
   - **Passo 1**: Dados pessoais (nome/e-mail da sessão Google readonly + telefone com máscara).
   - **Passo 2**: Empresa (razão social, CNPJ com validação/formatação — `cnpj.ts`).
   - **Passo 3**: Território (região de atuação + observações).
   - **Passo 4**: Documentos (upload presigned → R2 privado; PDF/JPG/PNG, 10MB).
   - **Passo 5**: Revisão e envio.
   - Autosave no banco a cada "Avançar" (`saveOnboarding`, status `draft`).
3. Submit → `representatives.status = "submitted"` (+ `submittedAt`).
4. Time interno revisa em `/portal/representantes` → aprova/rejeita com notas (audit log;
   auto-aprovação bloqueada no servidor).
5. Se aprovado: usuário ganha a role `representative` (userRoles) — JWT revalida em ≤5min.
6. Dashboard mostra resumo; pedidos/comissões dependem do ERP (futuro).

### Fluxo de Produto (Admin)
1. Importar catálogo: `npm run db:import-catalog` lê `docs/Dados Catalogo ROCO site_2026.xls`
   (769 produtos, 10 categorias, embalagens múltiplas) → INSERT idempotente
   (`externalId` unique, `published=false` sempre).
2. Admin acessa `/admin/produtos`.
3. Busca/filtro por categoria, disponibilidade, preço.
4. Clica produto → `/admin/produtos/[slug]`:
   - Edita: nome, descrição, preço (read-only do ERP?), categorias (N:N, isPrimary).
   - Badges/tags (ex.: `tres_em_um`, `pronta_entrega`).
   - Embalagens (N registros): unidade, qtd por embalagem, SKU.
   - Upload imagens presigned → R2 público.
   - Status: published (toggle).
5. Publica produto → cache invalidado via `revalidateTag("products")`.
6. Site público consome `/api/products` → mostra apenas `published=true`.

### Fluxo de Sync ERP
1. ERP dispara webhook → `POST /api/webhooks/erp` (JSON payload, secret timing-safe).
2. Rota recebe, valida secret, enfileira job em BullMQ → responde 202 (aceitada).
3. Worker processa job (retry 3x, backoff). Atualiza produtos via `externalId`.
4. Salva `sync_runs` (timestamp, status, count, error se houve).
5. Falha → DLQ `erp-sync-dlq` (admin revisa manualmente).
6. Admin pode disparar sync manual via botão `/admin/sync` (full-sync indefinido).

## Restrições de Negócio
- Conteúdo primário em **pt-BR** (mercado brasileiro); en como secundário.
- LGPD: portal coleta CNPJ/telefone/documentos de representantes (dados pessoais, minimização ok).
  Policy de retenção a definir com stakeholder.
- Representantes só acessam seu dashboard; não veem dados de outros representantes (RBAC).
- Admin vê todos; role `sales_manager` vê representantes atribuídos (futuro).
- Tracking Mautic sem consentimento explícito — avaliar banner (LGPD).
