# Progress — ROCO

## ✅ Concluído
### Site Institucional (MVP landing)
- [x] Concepção da estrutura (padrão espelhado de `site-autotec` / `archicodesite`)
- [x] Base Next.js 16 + TS + Tailwind v4 + i18n (pt/en) + SEO (robots/sitemap)
- [x] Extração de assets do `.psd` (hero, logo, wordmark) e novo PSD nav `docs/Novos ícones_OK.psd`
- [x] Página "Em breve" fiel ao layout (desktop + mobile)
- [x] "Entre em contato" → modal com formulário Mautic (id=1) embutido (lazy load)
- [x] Infra de IA (CLAUDE.md, AGENTS.md, memory-bank, `.claude/`, `.github/`, `.mcp.json`)
- [x] Docker (standalone) + headers de segurança
- [x] Refatoração: `coming-soon-hero.tsx` → `hero-layout.ts`, `nav-items.tsx`, `cta-hotspot.tsx`, `mobile-menu.tsx`
- [x] Nova nav com 4 itens + ícones lucide-react (PhoneCall, Headset) + textos i18n
- [x] Resolução centralizada de destino: `resolveDestination()` em `src/core/config/site.ts`
- [x] Validação de CNPJ + enhancement client-side do form Mautic (`cnpj.ts`, `use-mautic-enhancements.ts`)
- [x] Suporte alfanumérico de CNPJ (Receita Federal jul/2026) + bloqueio de submit inválido
- [x] Tracking de visitantes (Mautic `mtc.js`) — cópia self-hosted verificada + pageview por rota,
      CSP mantendo `script-src 'self'` (`src/shared/components/analytics/`)

### Portal Interno/CRM (2026-08-09 a 2026-08-10)
- [x] Schema Drizzle (18 tabelas + 4 enums) + migrations 0000-0001 em `./drizzle`
- [x] Seed idempotente (roles: admin, sales_manager, representative, viewer; permissões resource:action)
- [x] Auth.js v5 + Google SSO + Credentials provider + DrizzleAdapter + JWT revalidação staleness (5min)
- [x] proxy.ts (renomeado de middleware.ts): Node runtime, guardas sessão/role /portal/* /admin/*
- [x] Portal UI: MUI v9 + tema centralizado dark/light (tokens ROCO: cyan + amber AA 4.7:1)
      + InitColorSchemeScript (sem FOUC) + unlayered (sem enableCssLayer)
- [x] Route groups: (site) com tracking; (internal) sem tracking
- [x] Login Google + Credentials (e-mail/senha) + validação callbackUrl (anti-CSRF)
- [x] Shell (AppBar + Drawer): nav por permissão, representantes vs admin
- [x] Onboarding wizard (5 passos): autosave com guard booleano (hidrata uma vez), uploads presigned
- [x] Review representantes: aprovar/rejeitar com anti-auto-aprovação + audit log
- [x] Boas-vindas do representante (homepage): welcome-hero/sections/closing/status-alert,
      copy ROCO oficial, CTA catálogo PDF, materiais "Em breve" como Chip (não Tooltip)
- [x] tRPC v11 routers: products, representatives, sync (type-safe, withRBAC procedures)
- [x] REST público `/api/products` + `/api/products/[slug]` (unstable_cache + revalidateTag)
- [x] Cloudflare R2 presigned PUT/GET: imagens públicas, documentos privados (2-step validation)
- [x] BullMQ 6 + Redis: fila erp-sync in-process (instrumentation singleton), retry 3x backoff, DLQ
- [x] Webhook `/api/webhooks/erp` (secret timing-safe, 202 + fila)
- [x] Importador catálogo: SheetJS via CDN, 769 produtos + variantes, normalizações, idempotente
- [x] CRUD produtos: busca/filtros/cursor pagination + paginação real (total, page, perPage),
      form embalagens/badges/categorias, R2 uploads
- [x] Validação CNPJ/telefone + masking em uploads representantes
- [x] Dashboard: products.stats (total, published, active) + representatives.stats (draft, submitted, etc.)
- [x] Vitest 4: 226 testes, 100% cobertura lógica pura; 18 testes novos para rate limiting
- [x] Rate limiting Redis: login 5/5min + 30/5min global, webhook 60/min, /api/products 120/min,
      presigns 30/5min (fail-open sem REDIS_URL)
- [x] Segurança: Next 16.3.0 (CVEs), CSP R2, audit logs, callbackUrl validation, npm audit 0 vulns
- [x] ESLint: flat config nativo
- [x] i18n Portal: namespace `portal` (~156 chaves) pt/en idênticas
- [x] Bug fixes (7 reais encontrados em teste manual):
      (1) sx via CSS vars (não função em Server Components)
      (2) Tooltip em disabled REMOVIDO (hydration + chip visível)
      (3) Guard booleano hidratação onboarding (form = fonte verdade)
      (4) draftField preprocess ""→undefined (min validação só submit)
      (5) enableCssLayer REMOVIDO (MUI unlayered vence layers por route groups)
      (6) Light mode bgcolor background.default + minHeight 100dvh em (internal) layout
      (7) Processo órfão dev Windows: taskkill antes de restart

### Aquisição de Representantes (2026-08-11)
- [x] Página pública `/{locale}/representantes` (pré-cadastro, CNPJ obrigatório) + nav
      "Força de Vendas" reativada + sitemap + namespace i18n `representatives` pt/en
- [x] `POST /api/representatives/register`: rate limit (5/10min IP + 30/5min global), honeypot,
      dedupe e-mail/CNPJ, transação user+representative(`submitted`)+audit, bcrypt 12
- [x] Primeiro acesso pós-aprovação: `completeProfile` + wizard "modo conclusão"
      (território+documentos), presign/confirm liberados p/ `approved`, alerta nas boas-vindas
- [x] Link "Faça seu pré-cadastro" no login do portal; phone helpers movidos p/ `shared/lib`
- [x] 10 testes novos (registerSchema) → 236 total

### Infra Local (2026-08-11)
- [x] Stack Docker completa sempre no ar: web (localhost:3000) + postgres (host 5433) +
      redis (host 6380), `restart: unless-stopped`; dados preservados no volume (737 produtos)
- [x] `scripts/docker-build.cmd`: build via tar/stdin (bug BuildKit Windows com `[locale]`/`(site)`)
      + `docker compose up -d --no-build web`
- [x] Build-args `NEXT_PUBLIC_*` no Dockerfile — tracking Mautic OFF no bundle da imagem local
- [x] Smoke tests no container: site 200, /api/products com dados, guard do portal 307,
      login credentials E2E (302 + cookie de sessão)

### Site Institucional Completo (2026-08-11 parte 3)
- [x] Home reformulada: hero cinematográfico + institucional "Quem é a ROCO" (dados reais verificáveis)
      + vitrine categorias reais + produtos destaque + CTA Portal ROCO + footer
- [x] `/{locale}/produtos` (listagem): grid + busca (debounce 350ms) + filtro por categoria + paginação
      SSR cacheado via `unstable_cache` (tag "products", revalidate 300s), sem `generateStaticParams`
- [x] `/{locale}/produtos/[slug]` (detalhe): galeria R2 + `next/image`, nome/código/categorias/embalagens/
      badges, CTA "Solicite um orçamento" (modal Mautic), produtos relacionados por categoria
- [x] `SiteFooter` (`src/shared/components/footer/`): rodapé completo em (site) layout.
      Namespace `footer` (~20 chaves pt/en)
- [x] Funções novas: `getPublicProductList`/`getPublicCategoryList` (src/server/lib/public-products.ts)
- [x] 90 testes novos (produtos explorer, detail, funções puras) → suite verde
- [x] `next.config.ts` + Dockerfile/docker-compose suportam `R2_PUBLIC_URL` como build-arg
- [x] Revisão OWASP: nenhum achado crítico/alto novo introduzido

### Upload de mídia, materiais dinâmicos e RBAC editável (2026-08-24)
- [x] Upload de mídia do hero: bug fix `presignUpload`/`confirmUpload` (aceitava só vídeo mesmo para pôster)
- [x] Helper puro `src/server/lib/upload-limits.ts` (validação centralizada tipo/tamanho por campo)
- [x] Componente genérico `src/modules/portal/components/shared/portal-file-uploader.tsx` (dropzone, progresso, validação)
- [x] Schema `materials` (migration 0006) + router tRPC materials (CRUD + presign/confirm 2-step)
- [x] Admin CRUD `/{locale}/portal/materiais` + nav item gate `materials:create`
- [x] Feed somente-leitura em boas-vindas `welcome-materials-feed.tsx` (substitui 4 cards estáticos)
- [x] Arquivos sempre privados (presigned GET sob demanda, nunca `R2_PUBLIC_URL`)
- [x] Permissões novas: `materials:{create,read,update,delete}` no seed
- [x] 5 guardas puras RBAC: canDeleteRole, canEditRolePermissions, wouldSelfLockout, wouldRemoveLastAdmin, canGrantRole
- [x] Router tRPC routers/roles (listRoles/listPermissionsCatalog/createRole/updateRoleMeta/deleteRole/updateRolePermissions/listUsers/assignUserRole/unassignUserRole)
- [x] Tela `/{locale}/portal/perfis` (3 abas: Perfis CRUD, Matriz de permissões, Usuários)
- [x] Permissão `roles:manage` (admin only); perfil `admin` travado em UI
- [x] Slug de perfil imutável pós-criação (coluna `slug` no schema roles)
- [x] 137 testes novos (roles-guards.test.ts 51, upload-limits.test.ts 86) → 485 total
- [x] Segurança: 2 achados ALTOS corrigidos (gate `materials.list`, r2Key omitido do JSON)
- [x] i18n: 408 chaves portal.* verificadas programaticamente (paridade pt/en), bug `site`→`welcome` corrigido

### Página `/contato` e fluxo de recebimento de orçamento (2026-08-24 parte 3)
- [x] Rota pública `/{locale}/contato` (Server Component, resolve produto no servidor via `getPublicProductBySlug`)
- [x] Form com campos: nome/e-mail/telefone obrigatórios, empresa/CNPJ opcionais, assunto (dropdown: call_back/quote/general),
      mensagem opcional, chip de contexto de produto (somente-leitura, removível), checkbox consentimento LGPD obrigatório, honeypot
- [x] Route Handler `POST /api/contact` (síncrono, sem fila): (1) rate limit IP+global `productionSafe: true` (fail-closed),
      (2) INSERT `contact_submissions`, (3) Promise.allSettled RD Station + Resend paralelo (timeout 8s, best-effort),
      (4) responde `201 { ok: true }` assim que INSERT funciona, independente dos canais
- [x] Tabela `contact_submissions` (migration 0007): name, email, phone, company_name, cnpj, subject, product_slug,
      product_name_at_submit, consent_granted + consent_at, rd_station_status/error, email_status/error, ip_address, submitted_at
- [x] UUID client_tracking_id UNIQUE = nossa dedupe (RD API não é idempotente)
- [x] RD Station Conversions API: `event_type` CONVERSION, custom fields `cf_cnpj`/`cf_produto_interesse` (criar à mão no painel RD)
- [x] Resend (e-mail transacional): notificação para `CONTACT_NOTIFICATION_EMAIL` (fallback `NEXT_PUBLIC_CONTACT_EMAIL`)
- [x] Consolidação do menu: 6 → 4 itens (Home, Produtos, Portal ROCO, Contato); 3 intenções agora opções em dropdown `subject`
- [x] Bug corrigido: link "Contato" agora prefixado com locale via `resolveDestination("#contato")`
- [x] Segurança anti-header-injection: CONTROL_CHARS regex bloqueia `\r\n\0` em name/companyName/message/productSlug
- [x] 139 testes novos (contact-submit.test.ts, rd-station.test.ts, contact-email.test.ts) → 623 total

### Rastreio de origem do lead + formulário do catálogo (2026-08-25)
- [x] Módulo puro `src/shared/lib/lead-origin.ts`: lista FECHADA de 10 seções do site (`LEAD_ORIGINS`),
      `LEAD_ORIGIN_PARAM = "origem"`, `normalizeLeadOrigin` (valor forjado → `undefined` → NULL),
      `withLeadOrigin` (preserva querystring/fragmento, idempotente, sem `decodeURIComponent`)
- [x] `resolveDestination(href, locale, origin)` anexa `?origem=` SÓ nas duas páginas internas de
      captura (`/contato`, `/catalogo`) — nunca home, listagem ou URL externa de env
- [x] Todas as CTAs cobertas: nav, rodapé, hero, vitrines da home, listagem/detalhe de produto
      (incl. `quote-cta-button.tsx`, que montava a URL à mão)
- [x] UTM (`utm_source`/`utm_medium`/`utm_campaign`) saneada → campos PADRÃO `traffic_*` do RD
      (sem configuração no painel); origem = seção INTERNA, UTM = campanha EXTERNA
- [x] 4 `conversion_identifier`: `orcamento_produto`/`download_catalogo`/`ligamos_pra_voce`/`contato_geral`
- [x] Retry gracioso do RD: 400 de campo customizado → reenvia UMA vez sem os `cf_*` e marca
      `rd_station_error = validation_retry_ok` (lead entra; time descobre que falta criar `cf_*`)
- [x] `/{locale}/catalogo` volta a ter formulário de captura (nome/e-mail/telefone/empresa +
      consentimento LGPD + honeypot), reaproveitando `POST /api/contact` com `subject: "catalog"`
- [x] Migration `0008_contact_origin_utm.sql`: colunas `origin`/`utm_source`/`utm_medium`/`utm_campaign`
      + valor `catalog` no enum `contact_subject` (aplicada limpa sobre as 7 anteriores)

### Correções da revisão adversarial (2026-08-25)
- [x] **Middleware nunca rodou** — `proxy.ts` estava na RAIZ, mas o Next o procura no nível de `app/`
      (aqui `src/app`). Movido para `src/proxy.ts`. Antes: `/contato`/`/produtos`/`/portal` sem locale
      davam 404, `NEXT_LOCALE` nunca era gravado e o guard de sessão de `/portal`/`/admin` não
      executava (só o `requireAuth()` das páginas protegia). Build agora imprime `ƒ Proxy (Middleware)`
- [x] Painel de erro do formulário do catálogo exibe o link do PDF: falha nossa (Redis fora, 5xx)
      perde o lead, nunca o download — antes o CTA de catálogo morria junto com o Redis
- [x] Teto global de `/api/contact` cobrado só após honeypot + `safeParse`, e 40 → 200/5min
      (é backstop de DOIS funis). Flood de lixo não derruba mais lead legítimo de outro IP
- [x] `RateLimitResult.unavailable` separa 429 `rate_limited` (teto estourado) de 503 `unavailable`
      (limitador fora do ar) — a primeira tentativa numa queda de Redis não é mais tratada como repetição
- [x] 400 de validação vira erro POR CAMPO nos dois formulários (`fields` deixou de ser descartado)
- [x] Espelho de e-mail client usa `contactSchema.shape.email` (fim do regex paralelo divergente)
- [x] `message` aceita quebra de linha (`optionalMultilineField`, só NUL bloqueado) — é `<textarea>`;
      `name`/`companyName`/`productSlug` seguem fechados a CR/LF (vão ao header `Subject`)
- [x] UTM persistida em cookie de primeira parte `roco_utm` (httpOnly, SameSite=Lax, 30d) gravado pelo
      middleware na URL de ENTRADA e lido pelas páginas de captura (`resolveLeadUtm`); redirect de
      locale passou a preservar a querystring

### Contato dinâmico + footer completo + nav "Ligamos pra você" (2026-08-25)
- [x] Schema: 5 chaves `site_settings` (contact.phone, contact.email, contact.address.matriz,
      contact.address.filial, social.links)
- [x] Server lib: `getContactInfo()` e `getSocialLinks()` cacheados (revalidate 60s) — rodapé público
- [x] tRPC router `siteSettings` expõe `list` (admin) e `set` (com validação de chave permitida)
- [x] Footer: telefone com `wa.me`, e-mail, endereço matriz + filial, ícones Instagram/LinkedIn/YouTube
      (SVG inline) + WhatsApp (Globe lucide) — cada ícone só aparece se link existir no banco
- [x] Nav: "Ligamos pra você" como 5o item em pt/en, link `/contato?assunto=call_back&origem=menu`
- [x] Portal `/portal/configuracoes`: admin-editable, 5 campos (MUI v9 Grid v2), seed idempotente
- [x] Seed: `npm run db:seed` agora também upsert dos dados ROCO (não sobrescreve edição do admin)
- [x] Ícones sociais: SVG inline Instagram/LinkedIn/YouTube (não existem em lucide-react)
- [x] Bug fix em `site-settings.ts`: `cachedReadSetting()()` → `cachedReadSetting` (invocação duplicada)

### Capacidade e observabilidade (2026-08-25)
> Origem: teste de carga real no container. UM processo Node, UM event loop — renderizar página
> satura ~1 core (120% de CPU com 30 SSR concorrentes; home de 15–27 ms para p50 122 ms / p90 432 ms,
> ZERO erro HTTP). Postgres nunca foi gargalo (máx. 10 conexões, todas `active=0`, contra
> `max_connections=100`, até 500 concorrentes). Maior alavanca: CDN na frente de `/_next/image`
> (440% de CPU com 96 otimizações simultâneas) — pendente do stakeholder.
- [x] `statement_timeout: 15_000` + `max: 10` explícito no pool (`src/db/index.ts`); verificado no
      `pg` 8.23 que a opção chega ao servidor. Scripts pesados abrem pool próprio, não são afetados
- [x] `INSERT` do lead em `/api/contact` tenta uma 2ª vez no SQLSTATE `57014`: o `statement_timeout`
      conta espera por LOCK, então um `CREATE INDEX` de migration no boot mataria o lead
- [x] Teto de 10 MB no corpo do webhook do ERP, ANTES do parse (header + leitura contada);
      sem `.max(N)` em `products` — o `jobId` por minuto descartaria a 2ª página em silêncio
- [x] `WORKERS_ENABLED` desliga o worker BullMQ sem tirar o `REDIS_URL` (que também é o rate limit
      fail-closed de `/api/contact`). Default LIGADO; só o valor exato `false` desliga
- [x] `GET /api/health`: sem token só `{status:"ok"}` + 200 (liveness); com `x-health-token`
      (tempo constante) uptime, atraso do event loop em JANELA de 60 s + acumulado, contadores do
      pool e `workers: {running, reason}`. `?db=1` opcional distingue `pool_saturated` (200) de
      falha real de conexão (503) e não deixa waiter residual no pool
- [x] Duas recomendações REFUTADAS e registradas no decisionLog para ninguém "consertar" depois:
      `connectionTimeoutMillis` no pool (dispara por CPU travada e viraria LEAD PERDIDO) e subir o
      `max` do pool (banco ocioso em toda a bateria — mais conexões só disputam o mesmo core)

### Chrome de navegação: escala da nav, seletor de idioma, login do portal e rodapé (2026-08-30)
> ⚠️ NENHUMA verificação VISUAL nesta sessão — a extensão do navegador estava desconectada e
> ninguém abriu a página. Tudo foi medido: métricas reais do arquivo Inter servido pelo
> `next/font` para as larguras, e `curl` + parse do HTML servido para o resto. O julgamento
> estético continua PENDENTE DE OLHO HUMANO.
- [x] `--type-nav` deixa de escalar e fixa em **14px** (era clamp 14→17px); tracking 0.06em → 0.04em.
      Caixa alta + tracking pesa mais que o mesmo corpo em caixa baixa — referência de mercado para
      nav em versalete é 13–14px. Corrigido NO PAPEL da escala (`globals.css`), nunca por `className`
      solto no header. O papel `nav` só é consumido pelo chrome de navegação: nenhuma página muda fora dele
- [x] Mobile NÃO encolheu junto: o alvo de toque do painel vem do `py-3.5` (45,5px > 44px do WCAG
      2.5.5), não do corpo da fonte. Removido um `text-ui` que nunca se aplicava ali (mesmo grupo
      `font-size` do `cn()` — `text-nav` descartava em silêncio)
- [x] Seletor de idioma PT ⇄ EN (`language-switcher.tsx` + módulo puro `shared/lib/locale-path.ts`):
      troca o PRIMEIRO segmento do pathname preservando caminho, query e fragmento — não há rotas
      traduzidas (`/pt/produtos` e `/en/produtos` compartilham o segmento). Padrão USWDS "two
      languages": autônimo do idioma de DESTINO, sem bandeira, sem sigla, sem globo
- [x] `<a>` cru (navegação de documento inteiro) de propósito: o `<html lang>` mora no root layout,
      ACIMA de `[locale]`, e não re-renderizaria numa navegação client-side (SC 3.1.1). Confirmado
      em `src/proxy.ts` que o cookie `NEXT_LOCALE` é regravado pelo MIDDLEWARE na requisição
      seguinte — o componente não precisa escrevê-lo
- [x] Sem `useSearchParams` (evita fronteira `<Suspense>` em toda página pré-renderizada): o `href`
      renderizado leva só o CAMINHO e o clique lê a URL VIVA. Verificado: `/pt/produtos?...` renderiza
      `href="/en/produtos"`, e `switchLocalePath` executada com query+hash preserva os dois
- [x] Botão de login do portal (`portal-login-link.tsx`) → `/{locale}/portal/login`, com nome
      acessível do dicionário. É OUTRO destino que o item de nav "Portal ROCO", que vai para
      `/representantes` (pré-cadastro público) — quem já tem conta não tinha caminho nenhum
- [x] Breakpoint de colapso MEDIDO e mantido em `lg` (1024px): 5 rótulos + divisor + seletor + botão
      medem 728px (pt) / 709px (en) contra 868px disponíveis; só deixaria de caber abaixo de ~900px
- [x] Rodapé em DUAS BANDAS sobre a mesma grade (antes: uma coluna `1.5fr` acumulava logo, tagline,
      telefone, e-mail, os dois endereços e as redes). Desnível cai de 291–330px para 42–66px
      (banda 1) e 27–66px (banda 2); pior caso antigo era ao GANHAR espaço — cruzando 1023→1024px a
      coluna perdia 39% da largura e ficava mais ALTA
- [x] Todo bloco de prosa do rodapé passa por `PROSE_BLOCK` (`max-w-xs`): antes só a tagline tinha
      teto, e eram os dois endereços sem limite que empurravam a coluna para 10 linhas
- [x] Matriz e unidade fabril ganharam RÓTULO próprio (`footer.contact.{headquartersLabel,plantLabel}`)
      — a descrição da filial era parágrafo solto sob o endereço da matriz e lia como erro
- [x] `footer.addressLabel` removido dos dois dicionários: era código morto desde a entrada dos
      endereços dinâmicos (nenhum componente o lia)

### Correções da revisão adversarial do pacote acima (2026-08-30)
- [x] **Menu mobile trancava a rolagem ao cruzar o breakpoint** (alta): `lg:hidden` é `display:none`,
      que NÃO desmonta o React — `open` ficava preso, o cleanup nunca rodava e o body seguia com
      `overflow:hidden`. Botão, backdrop e painel estão todos no subárvore escondido, então não
      sobrava controle visível para destravar: TODA rota de `(site)` ficava sem rolagem. Reproduz
      girando um iPad com o menu aberto ou arrastando a janela de 1000→1100px. Corrigido com
      `matchMedia("(min-width: 64rem)")` fechando o painel. A trava de scroll é DESTA branch — a
      armadilha inteira é nova em relação à `main`
- [x] **`aria-label` do seletor anulava o `<span lang>`**: `aria-label` (passo 2C do accname) encerra
      a computação antes do conteúdo (2F), então o autônimo era lido com os fonemas do idioma errado
      — exatamente o que o docblock do componente afirmava ter resolvido. Nome passa a vir do
      CONTEÚDO (`sr-only` + `<span lang>`); string resultante byte-idêntica, sem regressão de 2.5.3
- [x] **Telefone do rodapé abria WhatsApp chamando-se "(47) 3335-2012"** com ícone `Phone`: o MESMO
      href aparecia duas vezes no rodapé com nomes diferentes (3.2.4) e sem propósito determinável
      pelo nome (2.4.4). Ganhou `aria-label` composto com `footer.socialNames.whatsapp` e o
      `WhatsappIcon` do próprio arquivo. NÃO virou `tel:` — o seed descreve o número como canal de
      WhatsApp, não linha de voz. A duplicação é nova: o `readSetting` antigo derrubava o bloco de
      redes com `String(v)` sobre o jsonb
- [x] **"Ligamos pra você" no RODAPÉ apontava para o mesmo destino de "Fale conosco"**: a migração
      para o placeholder `#ligamos` cobriu a nav e esqueceu o rodapé, então o lead chegava ao RD
      Station como `contato_geral` em vez de `ligamos_pra_voce`. Verificado depois da correção que
      `/pt/contato?assunto=call_back&origem=rodape` renderiza `<option value="call_back" selected>`.
      Rótulo EN uniformizado ("We call you" na nav vs "We'll call you" no rodapé)

### Carrinho de Cotação Multi-Produto (2026-08-30)
- [x] Store client-side singleton (`useSyncExternalStore`, `localStorage` chave `roco_cart_v1`)
      em `src/shared/lib/cart-store.ts` com suporte a múltiplos assinantes simultâneos
- [x] Ícone com badge na nav (`cart-nav-link.tsx`), tratamento visual equivalente ao login portal
- [x] Botão "Adicionar ao Carrinho" (`add-to-cart-button.tsx`), Client Component isolado usado em
      `ProductCard` (reestruturado: botão como irmão do `<Link>`, não aninhado) e detalhe de produto
- [x] Página dedicada `/{locale}/carrinho`: listagem com stepper de quantidade, remover, esvaziar,
      botão WhatsApp (mensagem resumida, client-only) e formulário de envio (nome/e-mail/telefone/empresa
      + consentimento LGPD + honeypot) no padrão visual de `/contato`/`/catalogo`
- [x] Backend: reaproveita 100% rota `POST /api/contact` — novo `subject: "cart"` + validação
      `.superRefine` do array `items: {slug, quantity}[]` (obrigatório só para "cart")
- [x] Tabela `contact_submission_items` (migration `drizzle/0009`) para persistir itens da cotação
- [x] Resolução em lote via `getPublicProductsBySlugs` (servidor, nunca confia no client),
      INSERT pai+filhos numa transação, nomes/SKUs resolvidos do banco
- [x] RD Station: novo `conversion_identifier: "carrinho_cotacao"`, campo customizado `cf_produtos_carrinho`
      (pendente criação manual no painel), e-mail lista itens por linha
- [x] `origin` gravado sempre como `"carrinho"` (valor novo em `LEAD_ORIGINS`, lista fechada)
- [x] Sem rate limit dedicado novo — reaproveita limites de `/api/contact` (query cost é mesmo
      independente de 1 ou 20 itens)
- [x] 122 testes novos (cart-store 28, product-card 18, cart-page 44, contact-submit/cart-cases 32)
      → 1098 total. Build detectou 2 erros TS em testes, corrigidos. Lint: 0 erros novos.
- [x] Revisão de segurança: 3 achados (1 Médio pré-existente, 2 Baixo/informativos novos)

### Qualidade
- [x] `npm run build` verde (incluindo `tsc` completo — detectou 2 erros em cart.test.ts)
- [x] `npm run test` e `npm run test:coverage` funcionando (1098 testes totais agora)

## 🔄 Em Andamento
- [x] **Página `/contato` e fluxo de recebimento — CONCLUÍDA 2026-08-24 parte 3**: site não tinha forma
      real de receber pedidos. Entregue rota + form + integrações RD Station + Resend + rate limit +
      segurança. 139 testes, 0 regressão. Pendências do stakeholder: provisionar RD Station API Key
      e campos customizados, Resend domínio verificado.
- [x] **Carga inicial de imagens de produto — CONCLUÍDA 2026-08-23**: token corrigido pelo
      stakeholder; `npm run db:import-images` subiu 613 imagens (336 MB) para 593 produtos no
      bucket `roco-test`, 0 falhas, chaves/registros no formato do portal; re-execução pula tudo
      (idempotência verificada); objeto amostrado byte-idêntico ao original; container web
      recriado com as envs R2 (portal apto a presign/confirm/delete).
- [x] **`R2_PUBLIC_URL` — RESOLVIDO 2026-08-23**: stakeholder habilitou o r2.dev
      (`https://pub-a1a98630b8f4417ebc7e9d2098e8c2f9.r2.dev`); URL gravada em `.env`/`.env.local`
      e imagem Docker rebuildada com os build-args R2_PUBLIC_URL + R2_ACCOUNT_ID. Verificado:
      listagem/detalhe servem as fotos reais via next/image (otimizador 200), CSP img-src com o
      host. Em produção, avaliar domínio custom no lugar do r2.dev (cache/branding).
- [ ] Segunda rodada de fotos: mapear 132 arquivos sem produto (faixas 1906–1919, 2237–2280,
      3068–3179 ausentes do catálogo + 11 nomes livres) e 144 produtos sem foto.
- [ ] Smoke test portal (login, RBAC, uploads, presigned URLs, webhook ERP)
- [ ] **Provisionar infra prod** (Alto): Postgres, **Redis (obrigatório — sem ele `/api/contact`
      responde 503 e nenhum lead entra)**, Google OAuth, bucket R2 separado sem acesso público,
      RD Station API Key + campos customizados, Resend domínio verificado.
- [ ] **RD Station: criar `cf_origem` no painel** (Alto, stakeholder — atualizado 2026-08-31): dos
      cinco `cf_*` que o código envia, a conta já tem `cf_cnpj`, `cf_produto_interesse`,
      `cf_produtos_carrinho` e `cf_mensagem`; **falta só `cf_origem`**, em Configurações > Campos
      personalizados. A API Key não cria campo (só OAuth).
      ⚠️ **A redação anterior deste item estava errada** e prometia um alarme que não existe: ela
      dizia que faltar um `cf_*` gravaria `validation_retry_ok` em `rd_station_error`. Sonda de
      2026-08-31 provou o contrário — a Conversions API respondeu **HTTP 200 até para um campo
      deliberadamente inventado**, ou seja, DESCARTA EM SILÊNCIO o que não conhece. Não há 400,
      não há retry, não há coluna acusando nada. Sem os campos criados, CNPJ, produto, origem e
      lista do carrinho simplesmente somem, sem rastro dos dois lados. A única conferência possível
      é abrir um contato no painel do RD e olhar (a API Key não autoriza `GET /platform/contacts`).

## 🗺️ Roadmap Estratégico (avaliação multi-agente 2026-08-23)
Análise de 5 áreas (conversão, portal/CRM, dados/integrações, SEO, segurança/LGPD) sobre o código
real — 29 oportunidades ancoradas em arquivo/rota. Artefato completo publicado para o stakeholder
(claude.ai/code/artifact/de6b6f9c-4ef2-4563-8e94-e1a40818e1ef). Síntese em 3 fases:
- **Fase 0 (pré-launch)**: rate-limit fail-closed + IP confiável; canonicalização www→apex (resolve
  CORS Mautic + SEO); Turnstile no register; LGPD (banner consentimento + /privacidade); curadoria
  em LOTE de published no admin (destrava go-live); ficha técnica B2B (EAN/NCM/embalagens já no
  banco, não exibidos); nav "Produtos" + /sobre + /contato; 2ª carga de fotos (132 órfãs via
  planilha de mapeamento); SEO fundação (sitemap dinâmico de produtos — reverter parcialmente
  decisão 2026-08-11 com cache por tag, hreflang/canonical, fix <html lang> via cookie, OG por
  produto, malha de links rastreável, facade do YouTube p/ LCP).
- **Fase 1 (quick wins)**: busca unaccent+multi-termo+categoria; orçamento com contexto do produto
  (prefill Mautic + WhatsApp contextual); JSON-LD Product/Breadcrumb/Organization; notificações
  WhatsApp (MCP configurado, zero uso no código — ciclo do representante + alerta de lead);
  gestor de materiais de venda no admin (mata os 6 "Em breve").
- **Fase 2 (salto de valor)**: full-sync ERP com preço+estoque (DESTRAVADOR — priceCents é coluna
  morta); catálogo comercial do representante; badge dinâmica pronta-entrega; carrinho de cotação
  multi-item no site; cotação estruturada do representante → fila interna; upload de imagens em
  massa no admin; ciclo de vida de documentos (deleteDocument + retenção LGPD).
Tese: 4 movimentos — tirar atrito do funil de cotação → portal com motivo de uso semanal →
catálogo vivo via ERP → cotação como dado estruturado.

## 📋 Backlog MVP / Pós-MVP
### Infra (pré-launch — decisão stakeholder)
- [ ] **Bucket R2 separado para conteúdo privado** (Alto, infra): criar bucket sem acesso público para
      materiais/documentos de representante (hoje compartilhado com bucket público hero/produtos).
      Mitiga risco de exposição via r2.dev — ver Riscos de Segurança (TOCTOU e bucket compartilhado).
- [ ] **CDN na frente de `/_next/image`** (Alto, MAIOR alavanca de capacidade, 2026-08-25): é o
      endpoint mais caro do sistema — 440% de CPU com 96 otimizações simultâneas (sharp em threads
      nativas), no MESMO container que renderiza página. Cache de borda resolve; é CONFIGURAÇÃO do
      stakeholder (Cloudflare já está no caminho), não código.
- [ ] **`HEALTH_METRICS_TOKEN` em produção** (2026-08-25): sem a env, `/api/health` não expõe métrica
      nenhuma a ninguém — o incidente de saturação volta a ser invisível. Gerar um segredo e apontar
      o monitoramento para `GET /api/health` com o header `x-health-token` (o healthcheck da
      PLATAFORMA continua sem token, no caminho de liveness).
- [ ] **Serviço worker dedicado antes de escalar para 2+ réplicas web** (2026-08-25): a receita é
      SERVIÇO web com `WORKERS_ENABLED=false` + SERVIÇO worker com a flag ligada. Env é por serviço,
      não por réplica. Desligar a flag sem ter consumidor em lugar nenhum é falha SILENCIOSA (o
      webhook do ERP segue respondendo 202) — conferir `workers` em `/api/health` depois de mexer.
- [ ] **Readiness de verdade (migration quebrada)** (2026-08-25, Médio): `/api/health` sem token é
      LIVENESS incondicional e responde 200 mesmo com o banco sem tabela — o `CMD` do Dockerfile usa
      `||` de propósito para o servidor subir mesmo com `scripts/migrate.mjs` falhando (foi o
      incidente `42P01`). Um sinal do passo de migração (marcador em disco lido pela rota) fecharia
      isso; hoje a checagem é olhar as linhas `[migrate]` no log do container.

### Portal (pós-launch inicial)
- [ ] **Rate limiting** (ALTO): webhook, presign, /api/products, login via @upstash/ratelimit
- [ ] Confirmar assunções negócio: N categorias por produto? Preço sincronizado? Universo ERP
      vs só catálogo? Badges oficiais?
- [ ] Contrato full-sync ERP (worker trata webhook; full-sync = not_implemented)
- [ ] deleteDocument endpoint (UI não tem remover documento confirmado)
- [ ] E2E + component tests; /portal/produtos com next/image (hoje <img> cru)
- [ ] Uploads órfãos no R2 (presign sem confirm) — job de limpeza futuro

### Site (pós-MVP home/produtos)
- [ ] **Dados de `site_settings` não têm dimensão de locale** (2026-08-30, Médio): os endereços e a
      descrição da unidade fabril vêm do banco em PORTUGUÊS e renderizam assim na versão em inglês,
      sem `lang="pt"` (WCAG SC 3.1.2, "Language of Parts") — o rodapé está em toda página de `(site)`.
      Não tem correção local: a tabela é chave-valor sem coluna de idioma. Opções: chaves por locale
      (`contact.address.matriz.en`) ou valor `jsonb` `{pt, en}` com fallback. Achado da revisão
      adversarial de 2026-08-30, REFUTADO como regressão daquele pacote (é byte-idêntico desde
      `692ae7c`) e registrado aqui como dívida.
- [ ] **Item de nav ativo distinguido só por matiz** (2026-08-30, Baixo): o único diferencial do
      item ativo é o tom ciano (1,20:1 contra o inativo) — 1.4.1 pede um segundo canal. Sugestão:
      filete/underline sob o item ativo, que já existe como linguagem no filete dual-tone da barra.
      Não bloqueia: `aria-current="page"` já cobre leitor de tela.
- [ ] **Endereços do banco sem `overflow-wrap`** (2026-08-30, Baixo): um token muito longo colado no
      admin (URL, CEP grudado) estouraria a coluna de prosa do rodapé. `PROSE_BLOCK` limita a
      MEDIDA, não quebra palavra — só o e-mail tem `break-words` hoje.
- [ ] **Vídeo do hero: trocar embed YouTube por MP4 self-hosted** (2026-08-12): pedir o arquivo ao
      stakeholder; remove youtube-nocookie da CSP `frame-src`, elimina tracking de terceiro (LGPD)
      e o player em conexões lentas. Avaliar `prefers-reduced-motion` (pôster já cobre fallback).
- [ ] **Endurecer `/api/contact` contra enumeração/bot** (2026-08-24): honeypot + rate limit 8/10min
      IP (rígido) é defesa inicial; hardening futuro: Turnstile/hCaptcha ou confirmação de e-mail
      para throttle sem revelar se lead já existe (evita spam em lote).
- [ ] **Endurecer register contra enumeração/spam** (revisão 2026-08-12): oráculo 409
      email_exists/cnpj_exists + teto global 60/5min permitem ~17k probes/dia (enumeração) e
      pré-cadastros falsos inundando a fila do admin (CNPJs válidos são geráveis; honeypot só
      dispara se o campo vier preenchido). Mitigação recomendada: Turnstile/hCaptcha ou
      confirmação de e-mail antes do INSERT, mantendo o 409 atrás do desafio.
- [ ] Busca por nome de categoria na listagem `/produtos` (revisão 2026-08-12): a busca cobre
      nome (pt/en) + SKU; categoria só via filtro select. Placeholder já ajustado para não
      prometer o que não faz — implementar se o stakeholder quiser busca unificada.
- [ ] Smoke test tracking RD Station no navegador (pixel, tracking, CSP clean)
- [x] ~~Confirmar certificação/selo GPTW~~ **RESOLVIDO 2026-08-23**: arte oficial com vigência
      fev 2026 – fev 2027 recebida e no rodapé (ver Riscos de Segurança)
- [ ] Liberar `https://www.roco.com.br` nas "CORS Valid Domains" do Mautic (hoje só `roco.com.br`),
      ou canonicalizar host — senão visitas via `www` não amarram ao contato
- [ ] Decidir política consentimento (LGPD) para tracking Mautic
- [ ] Subir PDFs das seções do site (catálogo, notícia técnica, brochura) na rota de download
- [ ] Metadata/SEO definitiva + favicon/OG oficiais (home e páginas de produtos)
- [ ] Blog/Notícias (backlog futuro quando CMS/fonte de conteúdo definida)
- [ ] Newsletter integrada (backlog futuro quando infra de e-mail definida)

## 🐛 Débitos Técnicos
- **Retenção de `contact_submissions` (LGPD)** (2026-08-24): tabela contém dados pessoais (ip_address);
  sem policy de retenção hoje (indefinida). Recomendação: definir prazo (ex.: 1 ano) e job de limpeza automática.
- **PDFs + vídeo das boas-vindas** (contactos, política comercial, logística, Sistema DW) —
  atualmente disabled; links precisam de upload/asset públicos.
- **Funções puras não exportadas** (2026-08-11): `categoryName` em `products-explorer.tsx`
  e outras em `public-products.ts` não são módulos testáveis isoladamente — testáveis só via componente.
  Refatorar para `src/server/lib` quando escala de testes crescer. (`interpolate` já migrou para
  `src/shared/lib/interpolate.ts` com testes próprios — 2026-08-12.)
- ~~SiteHeader não sticky/fixed~~ **RESOLVIDO 2026-08-12**: header virou faixa fixa translúcida
  padrão WEG (backdrop-blur, fundo sólido ao rolar, filete dual-tone) com painel mobile full-width
  (backdrop + trava de scroll). `.nav-glass` removida do globals.css (histórico no git).
- **Seções "Notícias" e "Newsletter" omitidas** (2026-08-11): padrão WEG não replicado (sem CMS/e-mail
  marketing hoje). Backlog pós-MVP quando houver fonte de conteúdo real.
- **Processo órfão dev server Windows**: taskkill manual necessário antes de `npm run dev` restart
  (mitigado 2026-08-11: teste contínuo agora roda no container Docker; dev server só para hot reload
  — `docker compose stop web && npm run dev`).
- Avaliar tornar CNPJ obrigatório em representantes (atualmente só se preenchido).
- `roco-wordmark-white.png` (wordmark 3D) tem leve bleed; logo 2D é principal.
- `docs/documento` (~98 MB) versionado — avaliar LFS/storage externo.
- **xlsx via CDN tarball**: fora do npm audit — reauditar manualmente a cada atualização.
- E2E e component tests da UI do portal faltam (vitest cobre lógica pura).
- Audit logs export/retention policy indefinida.

## ✅ Resolvido em 2026-08-25
- **Rastreio de origem do lead — CONCLUÍDO**: até aqui o lead que chegava ao RD Station só distinguia
  orçamento de contato geral e não carregava NENHUM sinal de qual seção do site o produziu. Agora leva
  origem interna (`cf_origem`, lista fechada de 10 seções) + campanha externa (`traffic_*`), quatro
  `conversion_identifier` por intenção de negócio, e `/catalogo` — que desde a saída do Mautic era
  download direto sem capturar nada — volta a ter formulário. Migration 0008 aplicada.
- **BUG GRAVE PRÉ-EXISTENTE: o middleware nunca rodou** (descoberto na verificação de fumaça, não na
  revisão). `proxy.ts` na raiz do repo enquanto `app/` mora em `src/app` → compilado, nunca registrado
  (`middleware-manifest.json` com `"middleware": {}`). Toda URL sem prefixo de locale dava 404
  (`/contato`, `/produtos`, `/portal`), `NEXT_LOCALE` nunca era gravado e o guard de sessão de
  `/portal`/`/admin` não executava. Movido para `src/proxy.ts` (com aviso no topo). Verificado:
  `/contato` → 307 `/pt/contato`, `/pt/portal` → 307 login, `/pt/portal/login` → 200, `/api/products` → 200.
- **Catálogo deixou de ser refém do Redis**: com o formulário novo, uma queda de Redis (rate limit
  fail-closed) matava o CTA de catálogo em todo o site. O painel de erro passa a exibir o link do PDF.
- **Flood de lixo não derruba mais lead legítimo**: o balde global era cobrado antes do parse e em
  paralelo ao de IP; 41 POSTs de corpo vazio de um IP bloqueavam todo mundo por 5 min. Ordem corrigida
  (IP → honeypot → schema → global) e teto 40 → 200. Reverificado contra o servidor real.
- **400 deixou de virar "tente novamente em instantes"**: `fields` agora vira erro por campo nos dois
  formulários; o regex de e-mail duplicado deu lugar a `contactSchema.shape.email`; e `message` aceita
  quebra de linha (era `<textarea>` que reprovava qualquer Enter).
- **UTM passou a sobreviver à navegação**: cookie `roco_utm` gravado pelo middleware no pouso e lido nas
  páginas de captura; o redirect de locale parou de descartar a querystring.

## ✅ Resolvido em 2026-08-24
- **Página `/contato` e recebimento de orçamento — CONCLUÍDA**: site não tinha nenhuma forma real de receber pedidos até hoje. 3 dos 6 itens do menu apontavam para `/contato` (404); botão de orçamento descartava contexto e mandava para PDF. Fluxo novo: formulário público envia lead a RD Station (CRM da ROCO) via Conversions API + e-mail para time comercial via Resend, ambos best-effort; lead SEMPRE gravado em `contact_submissions` primeiro (síncrono, sem fila). Envio paralelo com timeout 8s. Rate limit 8/10min IP + 40/5min global, ambos `productionSafe: true` (fail-closed). Contexto de produto preservado via `?produto=` query param. 139 testes, 0 regressão. Ver decisionLog 2026-08-24 (RD Station, Resend, consolidação menu, contact_submissions, fluxo síncrono).
- **Achado de segurança ALTO 1**: `materials.list` aceitava gate `materials:read` em vez de `materials:create` — representante conseguia ver rascunhos não publicados. CORRIGIDO: gate trocado para `permissionProcedure("materials","create")` (admin only).
- **Achado de segurança ALTO 2**: `r2Key` bruta vazava no payload JSON de `materials.list`/`listPublished` — combinado com bucket R2 público (r2.dev), permitia montar URL pública contornando link presignado. CORRIGIDO: `withDownloadUrl` agora omite `r2Key` do retorno (expõe só `downloadUrl`). Componentes consumidores (`MaterialRow`, form edição) ajustados para patch parcial (reenviam `r2Key` só se arquivo trocado, senão omitem).
- **Anti-header-injection em `/api/contact`**: CONTROL_CHARS regex (`[\r\n\0]`) bloqueia caracteres de controle em name/companyName/message/productSlug — previne injeção de cabeçalho de e-mail via Resend (mitiga risco teórico de header injection caso o backend do Resend não sanitize).

## ✅ Resolvido em 2026-08-23
- **Sidebar colapsável do portal**: toggle no AppBar com persistência localStorage por usuário (larguras 260/72px); padrão `next/navigation` decidiu estado inicial para evitar hydration mismatch.
- **Hero slideshow admin** (`/portal/hero`): 6 macro-famílias de marketing configuráveis (YouTube ou upload R2), copy bilíngue PT/EN, CTAs, janela de loop opcional, auto-advance opcional, agendamento, reorder. `HeroSlider` com auto-advance + crossfade + pause-on-hover. `/catalogo` virou download direto (lê `getCatalogPdfUrl()` com fallback DB → env → constante).
- **Mautic → RD Station**: 11 arquivos removidos, stub `RdStationTracking` off-by-default. CSP limpa do domínio Mautic; mantém `youtube-nocookie.com` (slides YouTube continuam possíveis).
- **LGPD stub**: `ConsentBanner` off-by-default via `NEXT_PUBLIC_CONSENT_ENABLED`; usa `useSyncExternalStore` (sem hydration mismatch, sem setState em effect). Body do dicionário fica em branco até jurídico preencher.
- **Hardening de segurança**: `proxy.ts` agora match exato de `/api` por segmento (era substring — qualquer `/portal/api-docs` futuro nasceria público). `rate-limit.ts` com `productionSafe` para fail-closed em rotas de auth.
- **`site_settings`**: tabela genérica chave-valor para configs 1-por-site (hoje: `catalog.pdf-url`). Edits via admin sem deploy.

## 🔐 Riscos de Segurança
- **Rate limiting implementado** (2026-08-10): login 5/5min + 30/5min global, webhook 60/min,
  /api/products 120/min, presigns 30/5min via Redis fixed-window (fail-open sem REDIS_URL com WARN).
  **Nota**: sem Redis em dev, rate limit não funciona (comportamento esperado, recomendação: testar em staging com Redis).
- **Claim GPTW — RESOLVIDO 2026-08-23**: stakeholder forneceu a arte oficial do selo com vigência
  ("Certificada FEV 2026 – FEV 2027, Brasil"). Processada para PNG transparente em
  `public/images/certifications/gptw-certificada-2026-2027.png` (original de referência em
  `docs/selo-gptw-fev2026-fev2027.jpeg`); rodapé exibe o selo oficial + vigência no lugar do
  badge textual. Ao RENOVAR a certificação (fev/2027), substituir o asset e as notas nos
  dicionários (`footer.certifications.items[0]`) — selo vencido volta a ser risco CDC.
- **`getClientIp` confia em `X-Forwarded-For` sem validar topologia de proxy** (2026-08-11): rate-limit
  usa header sem normalização. Pré-existente, porém tráfego público novo (catálogo) aumenta superfície.
  Recomendação: confirmar que proxy de produção (Cloudflare/reverse proxy) normaliza o header.
- **`proxy.ts` usa `pathname.includes("/api")` não segmento exato** (2026-08-11): substring não seguro.
  Não explorável hoje (nenhuma rota interna contém "api" no path), item de hardening futuro.
- **LGPD Portal**: CNPJ/telefone/documentos de representantes (dados pessoais). Minimização ok,
  mas política retenção não definida. Audit log implementado.
- **Tracking Mautic sem consentimento**: `mtc.js` grava `mtc_id`/`mtc_sid`/`mautic_device_id`,
  identifica visitante, **sem banner opt-in**. Flag permite desligar; decisão pendente com jurídico.
- **CORS Mautic**: allowlist tem só `https://roco.com.br`; visitantes via `www` caem em pixel
  sem amarrar ao contato — corrigir CORS ou canonicalizar host.
- **Cópias em `public/vendor/`**: reextrair APENAS de servidor Mautic limpo (pós-ClickFix).
  Reinspecionar + SHA-256 em `public/vendor/README.md`. Devolver `mautic.roco.com.br` ao `script-src` reabriria vetor.
- **JWT + Drizzle**: validação staleness por callback a cada 5min; user.active booleano; desativação
  derruba sessão em ≤5min (ok). RBAC checado em tRPC procedures + Server Actions.
- **sx (Emotion) em Server Components**: não pode usar funções (revalidação em runtime); usar
  `rgba(var(--mui-palette-primary-mainChannel) / 0.16)` em vez disso.
- **Condição de corrida (TOCTOU) em `unassignUserRole`** (2026-08-24, Médio/backlog): leitura da contagem
  de admins ativos e o `DELETE` não estão na mesma transação/lock — duas remoções concorrentes de `admin`
  poderiam, em teoria, zerar os admins ativos mesmo com guarda `wouldRemoveLastAdmin`. Exige ator já
  privilegiado (`roles:manage`) e timing preciso. **Hardening futuro**: envolver em `db.transaction` com
  `SELECT ... FOR UPDATE`.
- **`roles:manage` é admin-equivalente** (2026-08-24, Médio/backlog): ator com só `roles:manage` pode
  criar perfil customizado, marcar TODAS permissões do catálogo nele e se auto-atribuir — obtendo poder
  operacional equivalente a admin sem tocar role `admin` (único caminho bloqueado por `canGrantRole`).
  Não é promessa quebrada do decisionLog, mas limite real do modelo de confiança. **Mitigação**: tratar
  `roles:manage` como nível "admin-equivalente"; hardening futuro: impedir concessão de permissão que
  o ator não possui.
- **Bucket R2 compartilhado com acesso público (r2.dev)** (2026-08-24, Alto/backlog): "privado" para
  materiais/documentos de representante é CONVENÇÃO DA APLICAÇÃO (nunca gerar URL pública), não controle
  de armazenamento — bucket inteiro tem acesso público desde 2026-08-23 para hero/produtos. Pré-existente
  (onboarding docs desde 2026-08-09), visível agora com conteúdo sensível novo (materiais comerciais)
  acessível a mais público (representantes vs admin). **Decisão pendente stakeholder**: bucket separado
  sem acesso público para conteúdo privado, antes de produção.
- **Honeypot é única defesa anti-bot em `/api/contact`** (2026-08-24, Médio/backlog): mesmo padrão de risco
  já aceito para `/api/representatives/register`. Taxa 8/10min IP + 200/5min global (teto global subiu em
  2026-08-25 porque virou backstop de DOIS funis públicos), porém honeypot só funciona se bot preenche o
  campo — bots sofisticados saltam. **Hardening futuro**: Turnstile/hCaptcha ou confirmação de e-mail antes
  do INSERT (mantendo 409 atrás do desafio).
- **`REDIS_URL` virou requisito duro de PRODUÇÃO para captar lead** (2026-08-25, Alto/operacional): os dois
  limites de `/api/contact` são `productionSafe: true` (fail-closed) e a rota é o único caminho de captura
  de `/contato` E `/catalogo`. Sem Redis a rota responde 503 e NENHUM lead entra (o PDF do catálogo continua
  acessível pelo link do painel de erro). A documentação antiga que dizia "sem REDIS_URL o rate limit
  desliga (fail-open)" NÃO vale mais para esta rota — vale só para as que continuam fail-open.
- **Guard de `/portal`/`/admin` dependeu só do `requireAuth()` das páginas até 2026-08-25** (histórico): o
  middleware nunca executou porque `proxy.ts` estava na raiz e o Next o procura no nível de `app/`
  (`src/app` aqui). Corrigido movendo para `src/proxy.ts`. Nenhuma exposição conhecida — as páginas do
  portal já validavam a sessão por conta própria —, mas a camada de defesa anunciada no systemPatterns
  estava ausente. Ao mexer nesse arquivo, conferir: `curl -I http://host/contato` tem que dar 307, não 404.
- **Cookie `roco_utm`** (2026-08-25, Baixo/LGPD): primeira parte, `httpOnly`, `SameSite=Lax`, 30 dias, sem
  dado pessoal (só o rótulo de campanha que o anunciante pôs na URL). Entra na mesma decisão de
  consentimento já pendente do `ConsentBanner`.
- **Sem política de retenção para `contact_submissions`** (2026-08-24, Médio/backlog): tabela contém `ip_address`/
  `userAgent` (dados pessoais). Minimização presente (gravaremos só para logs/auditoria), mas retenção indefinida
  é débito LGPD. Recomendação: definir prazo (ex.: 1 ano) e job de limpeza automática.
- **`/api/contact` e `/api/representatives/register` sem `productionSafe: true` em paralelo** (2026-08-24, Médio/backlog):
  `/api/contact` implementou com `productionSafe: true` (fail-closed), mas `/api/representatives/register` ainda
  tem `productionSafe: false` (fail-open). Recomendação: fast-follow para passar a flag também em register (foi
  mencionado como débito em 2026-08-23, ficou pendente).
- **`POST /api/contact` sem teto de tamanho de corpo** (2026-08-30, Médio/backlog): rota não aplica `checkContentLength`
  ou `readBodyTextWithLimit` de `src/server/lib/request-size.ts` (usados no webhook do ERP desde 2026-08-25).
  Pré-existente desde 2026-08-24 (endpoint de `/contato`), mas agora mais relevante com carrinho de até 20 itens
  (payload estruturalmente maior). Recomendação: aplicar o mesmo padrão de teto de 10 MB + leitura limitada.
- **Itens duplicados no carrinho não são mesclados no servidor** (2026-08-30, Baixo/qualidade): payload com dois
  objetos `{slug: "X", quantity: 2}` gera DUAS linhas em `contact_submission_items` em vez de somar. Não é risco
  de segurança (dados de negócio, não acesso), registrado como débito de qualidade. Mitigação client-side: `cart-store`
  já deduplica e soma antes de enviar.
- **Origem `"carrinho"` pode vazar para outros `subject`** (2026-08-30, Baixo/informativo): `LEAD_ORIGINS` foi expandido
  com `"carrinho"` (lista fechada), mas rota só força hardcode quando `subject === "cart"` — os outros 4 assuntos
  poderiam receber `?origem=carrinho` via URL. Não é brecha de segurança (origin/UTM são self-reported, não
  confiáveis por desenho), registrado por completude de documentação.

## 📊 Métricas de Qualidade
- **Testes**: Vitest 4, 1098 testes (30 arquivos), 100% cobertura lógica pura; scripts test/test:watch/test:coverage.
  (+122 testes 2026-08-30 carrinho: `cart-store` 28, `product-card` 18, `cart-page` 44, `contact-submit`/cart-cases 32.)
  (+42 testes 2026-08-30 chrome de navegação: `locale-path`, `phone`, casos novos de `nav` e
  `resolveDestination`/`#ligamas`.)
  (+90 testes 2026-08-11 produtos explorer/detail; +6 testes 2026-08-12 `interpolate`;
  +6 testes 2026-08-23 `resolveCategoryCardHref`; +137 testes 2026-08-24 roles-guards + upload-limits;
  +139 testes 2026-08-24 contato: contact-submit + rd-station + contact-email;
  +224 testes 2026-08-25 rastreio de origem: lead-origin, catalog-form, site/nav, rd-station,
  contact-email, contact-submit; +87 testes 2026-08-25 capacidade: request-size, timing-safe,
  workers-enabled, event-loop-metrics/summarizeHistogram, pg-error).
- **Build**: verde. **Lint**: verde (ESLint flat config).
- **Segurança**: npm audit --omit=dev = 0 vulns (após Next 16.3.0); OWASP scan 2026-08-11 aplicado
  (nenhum achado crítico/alto novo introduzido).
- **Revisão adversarial multi-agente** (2026-08-12): 13 agentes (4 dimensões: corretude, i18n,
  segurança, regressão + verificação adversarial por achado) sobre o diff da feature WEG.
  8 achados confirmados / 1 refutado; 7 corrigidos no mesmo dia (resync URL↔estado do explorer
  via history.replaceState + adoção de props, revert de erro com banner, clamp de página no
  server, escape/teto/no-cache da busca livre, busca inclui nameEn, alt localizado altPt/altEn,
  copy do HomeAbout → dicionários). 1 movido para backlog (endurecer register). Regressão: zero.
- **Revisão adversarial multi-agente** (2026-08-23): 11 agentes (3 dimensões: corretude, i18n/a11y,
  design/segurança + verificação adversarial por achado) sobre o diff da vitrine PSD + selo GPTW.
  4 confirmados / 3 refutados; 4 corrigidos na hora (guard de URIError no resolveCategoryCardHref,
  scrim WCAG atrás do rótulo dos cards — contraste ~1:1 medido em 2 das 6 artes, alt decorativo ""
  nos cards — nome acessível do link ficava verboso, EN "Connections"→"Fittings" + description).
  Verificadores mediram contraste por pixel nas artes reais e reproduziram o URIError via tsx.
- **Revisão adversarial multi-agente** (2026-08-25): sobre o diff do rastreio de origem do lead.
  4 achados confirmados / 2 refutados (fail-closed sem Redis "novo neste diff" — o `productionSafe`
  vinha de 53dd8ea e o PDF segue servido de `public/`; painel de sucesso sem gestão de foco — padrão
  byte-idêntico ao `register-form.tsx` pré-existente, e a copy já instrui a usar o botão). Os 4
  confirmados corrigidos no mesmo dia + 1 achado EXTRA vindo da verificação de fumaça, mais grave que
  todos: o middleware nunca havia rodado (`proxy.ts` na raiz). Verificação feita contra servidor real
  (curl + Postgres + Redis), não por leitura: flood de 41 requisições, queda e volta do Redis,
  propagação de UTM entre páginas e isolamento entre visitantes.
- **Revisão de segurança** (2026-08-24): feature RBAC + materiais dinâmicos auditada internamente.
  2 achados ALTOS confirmados + corrigidos (gate `materials.list`, r2Key omitido do JSON).
  3 riscos Médio/backlog identificados (TOCTOU `unassignUserRole`, admin-equivalência de `roles:manage`,
  bucket R2 compartilhado com acesso público) — não bloqueantes, registrados em Riscos e Backlog.
- **i18n**: portal namespace (~156+24 chaves materiais) + home (~50 chaves) + footer (~20 chaves) —
  árvores pt/en idênticas. Dicionário estruturado por módulo (landing → home, representantes como
  namespace raiz). 408 chaves portal.* verificadas programaticamente (2026-08-24).
