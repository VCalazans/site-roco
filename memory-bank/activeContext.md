# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-08-12

## Sessão 2026-08-12 — Finalização: commits, revisão adversarial e correções
- Recuperação pós-stall do architect: trabalho da parte 3 verificado (hero/menu polish aplicado,
  `hero-stage.jpg` recortado sem a barra pintada, SiteHeader único ancorado à viewport em todas
  as páginas; listagem servindo 737 produtos). Portões verdes (334→340 testes, lint, build).
- 7 commits atômicos: fix rate-limit register (20/10min), feat(site) completo (39 arquivos),
  build(docker) R2_PUBLIC_URL, chore(tooling) psd-extract, docs (memory-bank + PSDs referência),
  fix(produtos) achados da revisão.
- **Revisão adversarial multi-agente** (Workflow, 13 agentes): 8 achados confirmados, 1 refutado,
  7 corrigidos (ver progress.md Métricas). Backlog novo: endurecer register (captcha/e-mail),
  busca por categoria.
- Imagem Docker rebuildada com o código final; smoke tests no container.
- **Rodada 2 (feedback do stakeholder)**: header fixo translúcido padrão WEG (blur, mais sólido ao
  rolar, filete ciano→âmbar, painel mobile full-width com backdrop e trava de scroll) e primeira
  dobra reprojetada: board COVER full-bleed (sem tarjas), copy centralizada nos dois eixos entre o
  wordmark e os botões neon (POS.copy top 50% + translate), tipografia cqw reescalada, indicador
  de scroll. Chave nova `home.hero.scrollCue` (345 chaves pt/en, paridade OK). Commit fe00ef8.
- **Rodada 3 (feedback do stakeholder)**: hero passa a usar o VÍDEO institucional da ROCO
  (youtube-nocookie, autoplay mudo em loop, cover full-bleed, pôster hero-stage esmaecido) com
  conteúdo centralizado e CTAs `.btn-neon` reais — `CtaHotspot`/`POS`/`.hero-board` aposentados.
  CSP: `frame-src` ganha youtube-nocookie (script-src intacto). Nav uniforme padrão WEG: sem
  ícones lucide, sem text-glows, caixa alta, ativo = ciano (navLabelClass; 341 testes).
  Ver decisionLog 2026-08-12. **Follow-up**: trocar embed por MP4 self-hosted quando houver arquivo.
- **Rodada 4 (feedback do stakeholder)**: headline visível do hero substituída pelo LOGOTIPO ROCO
  (texto do dicionário preservado como sr-only no h1 — SEO/a11y); rodapé ganhou bloco
  "Certificações e selos" com badge GPTW textual (`footer.certifications`, array extensível;
  347 chaves pt/en). Arte oficial do selo + ano seguem pendentes (ver risco no progress.md).
- **Rodada 5 (feedback do stakeholder)**: chrome do player do YouTube (título/traduções,
  legendas, marca-d'água, controles pausa/próximo da UI de playlist do loop) aparecia sobre o
  vídeo → iframe com OVERSCAN de 35% além do cover; o wrapper corta o chrome para fora da tela.
  Nenhum parâmetro de embed desliga isso de forma confiável — mitigação até o MP4 self-hosted.
  Commits da sessão: d12fb88..5d9cde7 (13 atômicos). Imagem Docker local atualizada e smoke OK.

## Estado ao fim de 2026-08-12
- Branch `feat/porta-mais-site`, working tree limpo, 341 testes verdes, lint/build verdes.
- Site no ar em localhost:3000 (container): home WEG (vídeo + logo + CTAs centrais), header fixo
  translúcido, nav uniforme, /produtos (737), footer com selo GPTW.
- Aguardando do stakeholder: MP4 do vídeo institucional (YouTube Studio), arte oficial do selo
  GPTW com ano, decisão publicação do catálogo em produção, Google OAuth, infra de produção.

## Sessão 2026-08-11 (parte 2) — Canal público de aquisição de representantes
- **Pré-cadastro pelo site** em `/{locale}/representantes` (nav "Força de Vendas" reativada):
  CNPJ obrigatório/validado + nome, e-mail, telefone, razão social e senha (login por credenciais;
  Google SSO com o mesmo e-mail funciona quando configurado).
- `POST /api/representatives/register`: rate limit IP+global, honeypot, dedupe e-mail/CNPJ (409),
  transação user (bcrypt 12) + representative `submitted` + audit log. Schema puro testável
  (`representative-register.ts`, 10 testes novos → 236).
- **Fluxo**: site → fila de aprovação do admin (review existente concede role) → primeiro acesso
  completa território+documentos (`completeProfile`, wizard "modo conclusão"; docs liberados para
  `approved`). CNPJ/razão social imutáveis pós-aprovação.
- Compartilhado: `shared/lib/phone.ts` (site+portal), alias `.form-neon` no globals.css.
- Ver decisionLog 2026-08-11 para o racional completo.

## Sessão 2026-08-11 — Stack Docker local sempre no ar
- `docker compose up -d`: web (localhost:3000, produção standalone) + postgres (host 5433) +
  redis (host 6380), todos `restart: unless-stopped`. Dados preservados no volume (737 produtos).
- Portas do host remapeadas (5433/6380) para não conflitar com Postgres/Redis de outros projetos;
  `.env.local` atualizado. Container web usa `.env` (gitignored) + hosts internos do compose.
- **Bug BuildKit/Windows**: `compose build` falha com caminhos `[locale]`/`(site)` → workaround
  permanente em `scripts/docker-build.cmd` (contexto via tar/stdin) + `--no-build` no up.
- Tracking Mautic desativado no bundle da imagem local (build-arg `false` — flag é build-time).
- Smoke tests OK: /pt 200, /api/products com dados, /pt/portal/login 200, guard 307, login
  credentials E2E 302 + cookie de sessão.

## Fase Atual
Site institucional completo + portal CRM — home reformulada (marketing completo), listagem/detalhe de
produtos do catálogo real, rodapé institucional. Sessão 2026-08-11 (parte 3) entregou site público robusto.

## O Que Foi Feito (esta sessão — 2026-08-10)
### Rodada "Robustez e Consistência"
- **Página de boas-vindas do representante** (`src/app/[locale]/(internal)/portal/boas-vindas/page.tsx`):
  componentes modulares welcome-hero/welcome-section-card/welcome-dw-system-card/welcome-closing/
  onboarding-status-alert. Copy oficial da ROCO em portal.welcome (34 chaves pt/en). CTA catálogo
  baixa `/downloads/catalogo-roco-2026.pdf`; materiais "Em breve" visíveis como Chip (não Tooltip).
  Homepage do representante: (internal)/portal/page.tsx redireciona role representative sem staff.
- **Campos MUI consistentes**: MuiTextField/MuiFormControl medium + fullWidth + outlined. Densidade
  documentada em `src/core/theme/index.ts`. createPortalTheme(locale) com tradução interna MUI.
- **Light mode (secondary amber #b25e00, AA 4.7:1)** em scheme light.
- **Paginação real**: representatives.list + products.list ganham {total, page, perPage} +
  TablePagination funcional; products.stats/representatives.stats novos no dashboard.
- **Rate limiting Redis** (fixed-window, fail-open sem REDIS_URL) em `src/server/lib/rate-limit.ts`:
  login 5/5min por e-mail + 30/5min global; webhook ERP 60/min; /api/products* 120/min por IP;
  presigns 30/5min por usuário. 18 testes novos → 226 total.
- **Teste de representante** criado em dev: representante@exemplo.com.br.

### 7 Bugs Reais Encontrados & Fixados (commits b968656→e689522)
1. **`sx` como função não cruza fronteira Server→Client**: welcome-hero/welcome-closing usavam
   callback de tema → trocado por rgba(var(--mui-palette-primary-mainChannel) / 0.16).
2. **Tooltip em Button disabled cause hydration mismatch**: clone do filho divergia SSR↔cliente
   → REMOVIDO; rótulo "Em breve no portal" virou Chip visível (melhor UX, touch-friendly).
   **Padrão**: nunca Tooltip em elemento disabled em árvore SSR.
3. **Onboarding refetch da query me sobrescrevia entrada do usuário**: autosave + invalidate
   refaziam a cada focus na janela → guard booleano (hidrata UMA vez, form local = fonte verdade).
4. **saveOnboarding wizard**: autosalva form INTEIRO (campos futuros vazios) + zod min(1) rejeita
   → preprocess ""→undefined (draftField helper); obrigatoriedade só no submit.
5. **CSS layers CRÍTICO**: enableCssLayer do Emotion punha MUI em @layer mui (declarada ANTES
   layers Tailwind) → preflight (@layer base) VENCIA MUI → inputs encolhiam. Solução: enableCssLayer
   REMOVIDO (src/core/theme/portal-providers.tsx) — MUI unlayered vence layers; seguro por route groups.
6. **Light mode com miolo preto**: body herda dark do site (globals.css) → (internal)/layout.tsx
   pinta Box bgcolor background.default + minHeight 100dvh.
7. **Processo órfão dev server** (Windows, porta 3000): killall via taskkill antes de restart.

## Próximos Passos Imediatos
1. [ ] Subir PDFs das boas-vindas (contatos, política comercial, logística) e vídeo Sistema DW.
2. [ ] Google OAuth Client ID (stakeholder).
3. [ ] Validar fluxo onboarding→aprovação admin (manual + testes E2E).
4. [ ] LGPD/CORS Mautic (herdado), rate limiting (recém-implementado).
5. [ ] Deploy: provisionar Postgres + Redis + R2 + envs de produção.

## Bloqueadores
- PDFs/vídeo dos materiais das boas-vindas (links desabilitados).
- Google OAuth credentials production.
- Confirmação arquitetura deployment (RDS/ElastiCache vs docker-compose).

## Sessão 2026-08-11 (parte 3) — Site institucional completo: home reformulada + /produtos + rodapé
- **Home** (`src/app/[locale]/(site)/page.tsx` + `src/modules/home/components/`): hero
  cinematográfico reaproveitado, seção institucional "Quem é a ROCO" (dados verificáveis: Roco Indústria
  Metalplástica S.A., 2014, Blumenau/SC + Gaspar/SC, GPTW, exportação Paraguai/Bolívia), vitrine de
  categorias reais, vitrine de produtos em destaque (badge `top` + fallback recentes), CTA Portal ROCO.
  Copy EN revisada; dicionário `home` (~50 chaves pt/en) reestruturado.
- **`/{locale}/produtos`** (listagem): grid com busca (debounce 350ms), filtro por categoria, paginação.
  SSR cacheado via `unstable_cache` (tag `"products"`, revalidate 300s), sem `generateStaticParams`.
  Funções novas: `getPublicProductList`/`getPublicCategoryList` em `src/server/lib/public-products.ts`.
- **`/{locale}/produtos/[slug]`** (detalhe): galeria (R2 via `next/image` com `remotePatterns`), nome,
  código, categorias, descrição, embalagens, badges, CTA "Solicite um orçamento" (modal Mautic).
  Produtos relacionados por categoria.
- **`SiteFooter`** (`src/shared/components/footer/`): rodapé completo (colunas, redes, copyright) em
  (site) layout. Namespace `footer` (~20 chaves pt/en).
- **3 bugs fixados**: (a) `assembleProducts` não trazia `nameEn` de categorias → EN broken; (b)
  `home.about.cta.href` apontava para `/sobre` (404) → corrigido para `/produtos`; (c)
  `getRemotePatterns()` gerava `pathname: "//*"` malformado sem subpath → corrigido.
- **Infra**: `next.config.ts` + `Dockerfile`/`docker-compose.yml` ganharam suporte a `R2_PUBLIC_URL`
  como build-arg (resolução de `images.remotePatterns` em build-time).
- **90 testes novos** (produtos explorer, detalhes, funções puras) → suite verde.
- **Segurança OWASP**: revisão OK, nenhum achado crítico/alto introduzido. Ver progress.md novos riscos.
- Ver decisionLog 2026-08-11 decisões #7–#11 para detalhes arquiteturais.

## Decisões Pendentes
- Confirmação: seal GPTW (ano/validade) com stakeholder antes de produção.
- Fluxo completo validação (onboarding→admin review→acesso portal).
- LGPD/consentimento banner (herdado 2026-08-04).
