# Product Context — ROCO

## Contexto de Negócio
ROCO é uma **fabricante industrial brasileira**. O material de referência (`.psd`) mostra um
ambiente futurista com estética neon dual-tone (ciano à esquerda, âmbar à direita), o galpão/
sede da ROCO e um piso fabril — reforçando o posicionamento industrial e tecnológico.
> A confirmar com o stakeholder: linha de produtos oficial, segmento e claims de marca.

## Fluxos Principais (fase atual)
1. Visitante acessa `/` → é redirecionado para `/pt` (ou `/en` conforme idioma).
2. Vê a página home: site de marketing completo (hero + institucional "Quem é a ROCO" + vitrine de
   categorias + produtos em destaque + CTA Portal ROCO + rodapé).
3. Pode: **Explorar Produtos** (→ `/pt/produtos`, listagem real), **Baixar Catálogo** (formulário Mautic
   + PDF), **Força de Vendas** (pré-cadastro de representantes), **Portal ROCO** (acesso interno),
   ou **Entrar em contato** (modal Mautic).

## Integrações de Negócio
- **WhatsApp (MCP Archicode)**: disponível para automações/notificações internas.
- Futuras: e-mail de contato, PDF do catálogo, site/loja de produtos.

## Restrições de Negócio
- Conteúdo primário em **pt-BR** (mercado brasileiro); en como secundário.
- LGPD: ao introduzir formulários, tratar dados pessoais com consentimento e mínimo necessário.

## Personas
### Site Público
- **Cliente/Parceiro industrial**: quer explorar catálogo real, filtrar por categoria/busca, obter PDF e
  entrar em contato → `/produtos` com paginação/filtro, CTA "Solicite um orçamento", modal Mautic.
- **Visitante geral**: quer entender quem é a ROCO (história, dados reais, certificações) e como conversar →
  home com seção institucional (Roco Indústria Metalplástica S.A., 2014, Blumenau/SC + Gaspar/SC, GPTW,
  exportação), vitrine de categorias, rodapé com contatos, CTA Portal.

### Portal Interno (CRM)
- **Representante comercial em onboarding**: acessa via Google OAuth, preenche perfil/empresa,
  faz upload de documentos (CNPJ, CEP), aguarda aprovação do time interno; após aprovação,
  acessa dashboard com pedidos/comissões (ERP futuro).
- **Time interno (admin/sales_manager)**: gerencia catálogo (CRUD produtos, embalagens, categorias,
  badges, imagens R2), revisa onboarding de representantes (aprova/rejeita), consulta audit logs,
  dispara sync manual do ERP.

## Fluxos de Negócio

### Fluxo de Visitante (Site Público)
1. Acessa `/pt` (ou `/en`) → home institucional (hero + "Quem é a ROCO" + categorias + produtos destaque + footer).
2. **Via vitrine de produtos**: clica um produto destacado → `/pt/produtos/[slug]` (detalhe com galeria R2,
   embalagens, badges, produtos relacionados).
3. **Via vitrine de categorias**: clica categoria (ex.: "Metalurgia") → `/pt/produtos?category=metalurgia`
   (filtro aplicado).
4. **Via barra de busca**: digita termo + ENTER/buscar → `/pt/produtos?q=termo` (SSR, debounce 350ms
   no client, paginação real, cache tag `"products"`).
5. Clica **"Solicite um orçamento"** (em produto) ou **"Entre em contato"** (nav) → abre modal form Mautic (id=1).
6. Preenche CNPJ/empresa/email/telefone → validação client-side (CNPJ, telefone) + bloqueio de submit inválido
   → POST via Mautic → lead criado no Mautic.
7. **Alternativa**: clica **"Baixar Catálogo"** (nav/footer) → abre modal Mautic (captura de lead) + link PDF
   (endpoint `/downloads/catalogo-roco-2026.pdf`).
8. Tracking: pageview em cada rota (`mtc.js` via `mautic-tracking.tsx`); hit enviado a `POST /mtc/event` ou
   pixel `mtracking.gif`.

### Fluxo de Representante (Portal)
**Canal padrão (2026-08-11): pré-cadastro pelo SITE.**
0. Visitante acessa `/{locale}/representantes` (nav "Força de Vendas") → pré-cadastro com CNPJ
   obrigatório + nome/e-mail/telefone/razão social/senha → `representatives.status = "submitted"`
   direto na fila do admin. Aprovação (review existente) concede a role `representative`.
   Primeiro acesso pós-aprovação: wizard "modo conclusão" (território + documentos, `completeProfile`).

**Fluxo alternativo (onboarding completo pós-login):**
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
