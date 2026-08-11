# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-08-11

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
Portal interno robusto — landing + catálogo + portal CRM em produção. Sessão 2026-08-10 focou em
consistência de UI (MUI light mode, paginação real) e 7 bugs críticos encontrados em testes manuais.

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

## Decisões Pendentes
- Fluxo completo validação (onboarding→admin review→acesso portal).
- LGPD/consentimento banner (herdado 2026-08-04).
