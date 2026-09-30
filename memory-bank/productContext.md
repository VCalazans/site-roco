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
3. Pode: **Explorar Produtos** (→ `/pt/produtos`, listagem real com múltiplos filtros), **Baixar Catálogo**
   (formulário + PDF), **Portal ROCO** (pré-cadastro de representantes ou acesso interno),
   ou **Entrar em contato** (formulário).

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
1. Acessa `/pt` (ou `/en`) → home institucional com **header persistente** (não remonta):
   - Hero cinematográfico com setas, indicadores, pausa, teclado/arraste (padrão WEG).
   - **Fachada da ROCO** (seção editável): imagem, eyebrow, título, texto, CTA opcional.
   - "Quem é a ROCO" (institucional, editável).
   - **Vitrine de destaques**: carrossel com setas, produtos destacados em ordem do operador (fallback: campeões → recentes).
   - Categorias (grid editável).
   - CTA Portal ROCO.
   - Rodapé com contatos e redes sociais (endereços editáveis).

2. **Busca/navegação**:
   - Busca no header (desktop) e no menu mobile → `/pt/produtos?search=termo`.
   - Barra lateral de filtros em `/produtos`: busca ao vivo + contagem por categoria + "só campeões" checkbox; gaveta no mobile.
   - Via vitrine: clica destaque → `/pt/produtos/[slug]` (detalhe com breadcrumb, galeria + setas + miniaturas,
     anterior/próximo, "voltar" restaurando filtros, embalagens, badges, produtos relacionados por categoria).

3. **Orçamento multi-produto** (ex-carrinho): clica "Adicionar ao orçamento" (card ou detalhe) →
   badge na nav atualiza contagem → `/pt/orcamento` → miniatura + quantidade ajustável + remover + "Enviar orçamento".
   Envio: `POST /api/contact` com `subject: "cart"` → gravado em `contact_submissions` + `contact_submission_items`,
   melhor-esforço para RD Station (origin: `"orcamento"`, `conversion_identifier: "orcamento_lista_produtos"`)
   e e-mail (Resend, quando configurado).

4. **Solicitações de orçamento ou contato**:
   - Clica **"Solicite um orçamento"** (produto) ou **"Entre em contato"** (nav) → `/pt/contato` (formulário público).
   - Preenche: nome, e-mail, telefone, empresa (opcional), CNPJ (opcional), assunto (dropdown: ligamos/orçamento/contato),
     mensagem (opcional), consentimento LGPD obrigatório.
   - Validação client-side (e-mail, telefone) → `POST /api/contact` → INSERT em `contact_submissions`,
     melhor-esforço para RD Station + e-mail (Resend).

5. **Catálogo PDF**:
   - Clica **"Baixar Catálogo"** (nav/footer) → `/pt/catalogo` (formulário de captura) → `POST /api/contact`
     com `subject: "catalog"` → link para download em `public/downloads/catalogo-roco-2026.pdf`.

6. **Transições e UX**: navegação entre páginas é fluida (View Transitions React 19), header fica fixo,
   cards carregam em paralelo com morphing de imagem (card → detalhe). Redução de movimento respeitada
   (`prefers-reduced-motion`).

### Fluxo de Representante (Portal)
**Canal padrão (2026-08-11): pré-cadastro pelo SITE.**
0. Visitante acessa `/{locale}/representantes` (nav "Portal ROCO") → pré-cadastro com CNPJ
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
6. Entra direto nas **boas-vindas** ("Painel" não aparece para o representante): "Materiais recentes" no topo e
   o item **Materiais** no menu → biblioteca por assunto (política comercial, logística, contatos, treinamento,
   outros) com busca e filtros; o arquivo abre pela rota autenticada (link gerado no clique). Pedidos/comissões
   dependem do ERP (futuro).
7. **Produtos** (menu já existente, catálogo somente leitura com paginação numerada e filtros): baixa as imagens
   ORIGINAIS — uma a uma ou "Baixar todas (ZIP)" na galeria do produto, ou o ZIP de todos os produtos do filtro
   atual pelo botão **"Baixar imagens"** (resumo de quantidade e tamanho antes de baixar; sem filtro, o catálogo
   inteiro). Inclui as imagens que não aparecem no site. Permissão `product_images:download`.

### Fluxo do Operador (Admin + Sales Manager)
1. Acessa `/portal` (requer role `admin` ou `sales_manager`):
   - **Dashboard**: indicadores clicáveis (produtos publicados, destaques, campeões, sem foto, representantes
     aguardando aprovação, solicitações dos últimos 30 dias), atalhos (novo produto, editar home, ver site).

2. **Gestão de Página Inicial** (`/{locale}/portal/pagina-inicial`, requer `home_content:update`):
   - Página com a lista de seções (ordem por setas, "Exibir no site") e o editor da seção escolhida: fachada
     (imagem, eyebrow, título, texto PT/EN, CTA opcional), institucional (textos, destaques, números reais do
     catálogo), categorias (cards), destaques (textos, limite e a vitrine de produtos), CTA do portal.
   - Upload 2-step presigned: tipo/tamanho ASSINADOS no presign + HEAD no confirm (valida tipo real, tamanho ≤10MB, extensão).
   - Fallback inteligente: campo vazio = padrão do dicionário (sempre tem conteúdo visível); "Restaurar padrão" apaga a linha.

3. **Gerenciamento de Produtos**:
   - Acessa `/portal/produtos` (requer `products:read`; edição requer `products:update`):
     - Tabela com paginação numerada (20/50/100 itens/página), miniatura prioriza imagem visível,
       flags `featured`/`best_seller` toggleáveis em 1 clique, filtros "Destaque", "Campeão" e
       "Sem foto no site", busca por nome/SKU; a coluna Fotos mostra o total e "{n} no site" (ou o
       chip "Nenhuma no site") e abre a galeria de download.
     - Ações por linha: "Ver no site" (se `published`), "Copiar link", "Compartilhar no WhatsApp", "Imagens e download".
   - Clica o produto (ou "Editar") → formulário em diálogo na própria listagem:
     - Seções: identificação (SKU, ERP, NCM, EAN), nome e descrição PT/EN, categorias e selos, vitrine,
       embalagens (todas; sem "padrão"; repetida é acusada), imagens (upload presigned).
     - **Imagens**: chave "Exibir no site" por imagem, "Usar como capa" (leva ao início e marca visível),
       baixar original, remover; chips "Capa da listagem"/"No site"/"Só no portal"; aviso se nenhuma vai
       ao site; na fila de upload, "Exibir no site" (marcado por padrão) antes do envio. Vale na hora.
     - Flags: "Destaque na home" (entra no fim da vitrine; a ordem se ajusta na Página inicial) e "Campeão de vendas" (troféu no site).
     - "Publicar" (toggle) requer `products:publish`; invalidação de cache imediata.
   - **Botão "Baixar imagens"** (topo da listagem; também para gerente comercial e representante): ZIP dos
     originais com os filtros atuais (sem filtro = catálogo inteiro), resumo antes de baixar (ex.: "617
     imagens originais de 593 produtos (336 MB)"); teto 3000 arquivos / 2 GiB. Cada original também
     baixável individualmente.

4. **Visualização de Solicitações** (`/{locale}/portal/solicitacoes`, requer `leads:read`):
   - Lista somente-leitura de leads/orçamentos: sem e-mail/telefone (minimização LGPD).
   - Filtro por assunto (call_back, quote, general, catalog, cart).
   - Clica detalhe → janela modal com nome, e-mail, telefone, empresa, CNPJ, produto (se aplicável), lista de itens
     (se orçamento), mensagem, status do RD Station e e-mail (sent/failed/skipped), data.
     Abertura grava audit log (`leads.view`).

5. **Configurações** (`/{locale}/portal/configuracoes`, requer `admin`):
   - Redes sociais em campos separados e validados (Instagram, LinkedIn, YouTube, WhatsApp).
   - Endereços da matriz e unidade fabril (que aparecem no rodapé público).
   - Não expõe JSON cru (campos separados).

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
