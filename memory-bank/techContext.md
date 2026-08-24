# Tech Context — ROCO
> Atualizar quando mudar dependências ou configurações.

## Stack Completa
### Frontend
- **next** 16.3.0 (App Router, Turbopack, output standalone; 16.0.3 → 16.3.0 por CVEs)
- **react** / **react-dom** 19.2.0
- **typescript** 5 (strict) — alias `@/* -> ./src/*`
- **tailwindcss** 4 + **@tailwindcss/postcss** (config via `@theme` em `globals.css`)
- **framer-motion** 12 (animações da hero)
- **lucide-react** (ícones)
- **clsx** + **tailwind-merge** (`cn`)
- **server-only** (proteção de módulos server, ex.: `get-dictionary`)
- Fontes: `next/font/google` — Inter (corpo) e Poppins (display)

### Portal / Backend
- **next-auth** 5.0.0-beta.32 (Google SSO + Credentials provider, JWT strategy, DrizzleAdapter)
- **drizzle-orm** 0.45.2 (type-safe ORM, migrations via drizzle-kit)
- **pg** (driver PostgreSQL)
- **trpc** 11.18 (type-safe RPC)
- **@trpc/client** + **@trpc/react-query** (client-side tRPC)
- **@tanstack/react-query** (data fetching, cache)
- **@mui/material** 9.3.1 + **@mui/material-nextjs** (tema centralizado dark/light)
- **@emotion/react** + **@emotion/styled** (CSS-in-JS para MUI)
- **bullmq** 6 (job queue) + **redis** (client)
- **@aws-sdk/client-s3** (Cloudflare R2, compatível S3)
- **bcryptjs** 3 (hash seguro senhas; custo 12; puro JS para alpine)
- **xlsx** 0.20.3 (via CDN tarball para importação de catálogo)
- **vitest** 4 (test runner, 208 testes)
- **happy-dom** (DOM simulation para testes)
- **tsx** (devDependency; scripts db:seed + db:import-catalog — Node 20 local sem `--experimental-strip-types`)

## Setup do Ambiente
```bash
node -v            # 22+
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

## Variáveis de Ambiente (ver .env.example)
### Site Público
| Variável                     | Obrig. | Descrição                                  |
|------------------------------|:------:|--------------------------------------------|
| NEXT_PUBLIC_SITE_URL         | não    | URL pública (metadata/sitemap/robots)      |
| NEXT_PUBLIC_CONTACT_EMAIL    | não    | E-mail de contato (CTA — fase futura)      |
| NEXT_PUBLIC_WHATSAPP_NUMBER  | não    | WhatsApp de contato (fase futura)          |
| NEXT_PUBLIC_PRODUCTS_URL     | não    | Destino do CTA "Conheça nossos Produtos"   |
| NEXT_PUBLIC_CATALOG_URL      | não    | Destino do CTA "Baixar Catálogo" (PDF)     |
| NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED | não | **(Removido 2026-08-23)** Mautic saiu; substituído por RD Station — ver `NEXT_PUBLIC_RDSTATION_*` abaixo. |
| NEXT_PUBLIC_RDSTATION_SCRIPT_URL  | não    | URL do script RD Station (carregado via `next/script`); entra na CSP `script-src` quando configurado. Stub em src/shared/components/analytics/rdstation-tracking.tsx. |
| NEXT_PUBLIC_RDSTATION_TRACKING_ENABLED | não | Liga/desliga o tracking RD Station (prod: `"false"` por padrão; dev: idem). |
| NEXT_PUBLIC_CONSENT_ENABLED       | não    | Liga/desliga o banner LGPD (ConsentBanner). Stub em src/shared/components/consent/consent-banner.tsx — body do dicionário fica em branco até o jurídico preencher. |
| WHATSAPP_MCP_URL             | não    | Endpoint do MCP WhatsApp (automações)      |

### Portal / Auth
| Variável                     | Obrig. | Descrição                                  |
|------------------------------|:------:|--------------------------------------------|
| DATABASE_URL                 | sim    | PostgreSQL: `postgresql://user:pwd@host/db` |
| AUTH_SECRET                  | sim    | Segredo para JWT (min. 32 chars)            |
| AUTH_GOOGLE_ID               | sim    | Google OAuth: client ID                    |
| AUTH_GOOGLE_SECRET           | sim    | Google OAuth: client secret                |
| PORTAL_ADMIN_EMAIL           | não    | E-mail do admin bootstrap (seed: cria/atualiza se definido) |
| PORTAL_ADMIN_PASSWORD        | não    | Senha do admin bootstrap (mín. 12 chars; seed: idempotente, rejeita <12) |
| PORTAL_INTERNAL_EMAIL_DOMAIN | não    | Domínio interno (ex.: `@roco.com.br`); usuários deste domínio recebem role `viewer` automaticamente |

### Redis / Fila ERP
| Variável                     | Obrig. | Descrição                                  |
|------------------------------|:------:|--------------------------------------------|
| REDIS_URL                    | não    | Redis: `redis://host:port` (sem-op se vazio) |
| ERP_WEBHOOK_SECRET           | não    | Secret timing-safe do webhook `/api/webhooks/erp` |

### Cloudflare R2 (Imagens/Documentos)
| Variável                     | Obrig. | Descrição                                  |
|------------------------------|:------:|--------------------------------------------|
| R2_ACCOUNT_ID                | sim    | Account ID Cloudflare (endpoint `https://<id>.r2.cloudflarestorage.com`; também entra na CSP `connect-src`) |
| R2_ACCESS_KEY_ID             | sim    | R2 access key ID                           |
| R2_SECRET_ACCESS_KEY         | sim    | R2 secret access key                       |
| R2_BUCKET                    | sim    | Nome do bucket R2 (`roco-portal` no exemplo) |
| R2_PUBLIC_URL                | não    | URL pública das imagens de produto (entra na CSP `img-src`) |

## Comandos do Projeto
### Desenvolvimento
| Comando         | Quando usar                                  |
|-----------------|----------------------------------------------|
| `npm run dev`   | Desenvolvimento (hot reload, Turbopack)      |
| `npm run build` | Validar tipos + build de produção            |
| `npm run start` | Servir o build de produção                   |
| `npm run lint`  | Checagem de lint antes de PR                 |

### Testes
| Comando              | Quando usar                                  |
|----------------------|----------------------------------------------|
| `npm run test`       | Executar suite Vitest 1x                     |
| `npm run test:watch` | Watch mode (desenvolvimento)                 |
| `npm run test:coverage` | Relatório de cobertura                     |

### Database
| Comando              | Quando usar                                  |
|----------------------|----------------------------------------------|
| `npm run db:generate` | Gerar tipos/queries a partir do schema Drizzle |
| `npm run db:migrate` | Aplicar migrations pendentes                 |
| `npm run db:push`    | Push schema direto (dev apenas)              |
| `npm run db:studio`  | Abrir Drizzle Studio (UI local)              |
| `npm run db:seed`    | Seed roles + permissões (idempotente)       |
| `npm run db:import-catalog` | Importar catálogo de .xls (769 produtos) |
| `npm run db:import-images` | Carga inicial de fotos (docs/PRODUTOS → R2 + product_images; `--dry-run`/`--limit=N`; idempotente por produto+filename) |

## Portal Interno (CRM)
### Arquitetura
Monolito Next.js 16: mesmo app que o site público, rotas isoladas por **route groups**.
- **(site)** = `/pt`, `/en` (landing) + `/pt/catalogo`, `/en/catalogo` — público, com Mautic tracking.
- **(internal)** = `/portal/*` (representantes + onboarding) + `/admin/*` (time interna) — protegido por auth/RBAC, SEM tracking.

### Autenticação & Autorização
- **Auth.js v5**: Google SSO; sessão 8h com revalidação staleness 5min.
- **RBAC**: roles (admin, sales_manager, representative, viewer) + permissões granulares
  (resource:action, ex. `products:create`, `representatives:approve`).
- **Persistência**: Postgres via Drizzle (tabelas users, roles, role_permissions, permissions).
- **Middleware (proxy.ts)**: Node runtime; valida locale, protege /portal/* e /admin/* com `requireAuth()`.

### Fluxo de Representante
1. Acessa `/portal/login` → Google OAuth.
2. Primeira vez → onboarding wizard (5 passos): perfil, empresa, documentos (CNPJ, CEP validado).
3. Upload presigned para R2 (2-step: presign → PUT → confirm).
4. Admin revisa em `/admin/representatives` (aprova/rejeita) — **sem auto-aprovação** (audit log).
5. Acesso ao `/portal/dashboard` (listagem de pedidos ERP futura).

### Fluxo de Produto
1. Importar via `npm run db:import-catalog` (769 produtos + 10 categorias + variantes embalagem).
2. Admin CRUD em `/admin/produtos`: busca, filtros, cursor pagination.
3. Form com embalagens N, badges, categorias N:N (isPrimary).
4. Upload imagens presigned → R2 público (R2_PUBLIC_URL).
5. Status: `published=false` por padrão; admin publica em `/admin/produtos/[slug]`.
6. API pública `/api/products` (read-only, cache invalidado via revalidateTag).

### Sincronização ERP
- **Trigger**: webhook `/api/webhooks/erp` (POST com JSON payload + secret timing-safe).
- **Fila**: BullMQ sobre Redis (in-process via instrumentation.ts singleton).
- **Retry**: 3x com backoff exponencial; jobs falhados → DLQ (erp-sync-dlq).
- **Idempotência**: por externalId do ERP.
- **Full-sync**: não implementado (aguarda contrato ERP).

### Dados & Segurança
- **PostgreSQL**: produção via docker-compose ou RDS.
- **Redis**: fila + cache de sessão (opcional, pode usar Postgres se REDIS_URL vazio).
- **R2**: imagens públicas (domínio custom) + documentos privados (presigned GET).
- **Validação**: CNPJ/CEP/telefone com máscaras + bloqueio de submit inválido (via DOM).
- **Audit log**: tabela audit_logs (user_id, action, resource, timestamp, metadata).

### Testes
- **Vitest 4**: 208 testes cobrindo rbac, cnpj, validações, perms, phone.
- **Happy-dom**: DOM simulation para testes de helpers.
- Scripts: `npm run test`, `test:watch`, `test:coverage`.

- Fonte de verdade: `docs/documento` (`.psd`, 3224×1724). **Não editar.**
- Extraídos p/ `public/images/hero/`:
  - `hero-scene.jpg` / `.png` — render do ambiente (sem o texto de headline/parágrafo).
  - `roco-logo-white.png` — logotipo ROCO 2D (branco, transparente).
  - `roco-wordmark-white.png` — wordmark central 3D (branco, transparente).
- Reextração: os scripts usam `ag-psd` + `@napi-rs/canvas` (Node). Ver decisionLog.

## Scripts de Terceiros (self-hosted)
`public/vendor/` — cópias **verificadas** servidas do próprio domínio, para manter a CSP
`script-src 'self'` após o incidente ClickFix (jul/2026):
- `mautic-form.js` — SDK do formulário Mautic.
- `mautic-tracking.js` — `mtc.js`, tracking de visitantes.

Procedência, SHA-256, resultado da inspeção e passos de reextração: `public/vendor/README.md`.
**Nunca** atualize essas cópias a partir de um servidor Mautic não verificado.

## Armadilhas da Stack (Descobertas 2026-08-10)
1. **CSS Layers + MUI Emotion**: `enableCssLayer: true` do Emotion coloca MUI em `@layer mui`
   → se declarado ANTES das layers do Tailwind, preflight (@layer base, zera padding/border)
   **vence** o MUI no SSR (ordem = primeira aparição no documento). Solução: remover enableCssLayer,
   deixar MUI unlayered (especificidade bruta, mas consistente com route groups).
2. **`sx` como função em Server Components**: revalidação de SSR não resolve theme callbacks em runtime.
   Use CSS variables: `rgba(var(--mui-palette-primary-mainChannel) / 0.16)` em vez de
   `(theme) => ({ color: theme.palette.primary.main })`.
3. **Tooltip em elemento disabled no SSR**: MUI Popper clona o filho para medir → divergência
   de atributos (aria-describedby) → hydration mismatch **mesmo sem style inline**. Padrão: Chip
   visível ou texto inline; nunca Tooltip em disabled em árvore Server.

## Infraestrutura de Deploy
- `output: "standalone"` + `Dockerfile` multi-stage (node:22-alpine) + `docker-compose.yml`.
- Headers de segurança configurados em `next.config.ts`.

## Runbook — Primeiro Deploy em Produção (seed completo, escrito 2026-08-23)
Pipeline validado ponta a ponta no ambiente local (migrations → seed → catálogo → imagens →
site com fotos). Ordem para produção:

1. **Provisionar**: Postgres, Redis e bucket R2 de PRODUÇÃO (não reutilizar `roco-test`):
   criar bucket + token "Object Read & Write" escopado nele + acesso público
   (preferir domínio custom, ex. `img.roco.com.br`, ao r2.dev — cache/branding).
2. **Build da imagem** com build-args (resolvidos em build-time — CSP/remotePatterns/flags):
   `NEXT_PUBLIC_SITE_URL=https://roco.com.br`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID`,
   `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED` (prod: ligado por padrão — decisão LGPD pendente).
3. **Envs runtime** (`.env` de produção): `DATABASE_URL`, `AUTH_SECRET` (≥32), `AUTH_URL`,
   `PORTAL_ADMIN_EMAIL`/`PORTAL_ADMIN_PASSWORD` (≥12 — exigido pelo seed), `REDIS_URL`
   (SEM ele rate limit é fail-open!), `ERP_WEBHOOK_SECRET`, `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/
   `R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`R2_PUBLIC_URL`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
   (quando o stakeholder criar — sem eles o login Google falha ao clicar; credenciais funcionam).
4. **Carga inicial — UM COMANDO da máquina local** (2026-08-24): `npm run db:bootstrap-producao`.
   Credencial em `.env.producao.local` (gitignored) como `PRODUCTION_DATABASE_URL=...` — nome
   separado de `DATABASE_URL` de propósito, para o ambiente local seguir apontando para o
   Postgres de desenvolvimento e não haver o risco de esquecer a variável trocada. As demais
   envs (PORTAL_ADMIN_*, R2_*) vêm do `.env.local`. O script roda migrations → seed → catálogo
   → publicação → fotos, é idempotente, pede confirmação digitando o nome do banco, aceita
   `--dry-run`, `--so=<ids>`, `--pular=<ids>` e imprime o estado ANTES/DEPOIS. Validado contra
   banco descartável: 20 tabelas, 737 produtos publicados, 16 categorias, 4 roles, 24
   permissões, 1 admin; re-execução não duplica nada.
   ⚠️ As fotos (`docs/PRODUTOS/`, ~1 GB gitignored) só existem na máquina local — esta etapa
   não tem como rodar do servidor.

4b. **(histórico) Sequência manual equivalente**, com `DATABASE_URL`/R2 de produção no `.env.local`
   (os scripts rodam fora do bundle e leem `docs/`, que NÃO vai na imagem Docker), nesta ordem:
   a. `npm run db:migrate`      (drizzle 0000–0005) — ou, de dentro do container,
      `npm run db:migrate:container` (ver seção abaixo)
   b. `npm run db:seed`         (roles/permissões + admin bootstrap; idempotente)
   c. `npm run db:import-catalog` (upsert por sku; nasce `published=false` POR DESIGN)
   d. **DECISÃO DO STAKEHOLDER**: publicar em massa (ato deliberado, ex. UPDATE em lote) OU
      curadoria item a item no admin — sem isso `/produtos` nasce VAZIO em produção
      (pendência registrada no decisionLog 2026-08-11).
   e. `npm run db:import-images -- --dry-run` e depois sem flag (613 fotos; idempotente).
   ⚠️ Apontar tooling local para banco de produção só nessa janela; conferir env antes de cada
   comando e remover as credenciais de produção do `.env.local` ao terminar.
5. **Smoke**: home 200 nos 2 locales, `/produtos` com fotos (otimizador `_next/image` 200),
   login credenciais 302+cookie, guard `/portal` 307, webhook ERP sem secret → 401,
   rate limit ativo (Redis conectado — ver logs).
6. **Riscos abertos no go-live** (progress.md): banner LGPD do tracking Mautic (decisão),
   CORS `www` no Mautic, endurecer register (captcha/e-mail), MP4 self-hosted do hero.

## Migrations em Produção — o container consegue migrar sozinho (2026-08-24)

**Incidente que originou isto**: o primeiro deploy subiu com o banco vazio e todas as
queries morriam com `42P01 relation "products" does not exist`. Dentro do container,
`npm run db:migrate` respondia `sh: drizzle-kit: not found`.

**Três camadas de causa** (todas verificadas empiricamente no repo):
1. `drizzle-kit` é devDependency — a imagem `output: standalone` só leva deps de produção.
2. O Turbopack **inlina** o `drizzle-orm` nos chunks do servidor: o pacote não existe em
   `.next/standalone/node_modules` (só o `pg` sobrevive, por ser nativo). O mesmo vale para
   `bcryptjs`. Ou seja: instalar o drizzle-kit no container não resolveria.
3. Os `.sql` de `drizzle/` nunca eram copiados para a imagem — não havia o que aplicar.

**Solução**: `scripts/migrate.mjs` + três `COPY` no estágio runner do Dockerfile
(`drizzle/`, o script, e `node_modules/drizzle-orm` — que tem zero deps de runtime, então
não arrasta nada transitivo; ~16 MB).

**As migrations rodam SOZINHAS no boot** (2026-08-24, 2ª rodada). O passo manual não
sobrevivia a redeploy — o deploy seguiu quebrado porque ninguém rodou o comando. Hoje o
`CMD` do Dockerfile aplica as migrations antes de subir o servidor:

```dockerfile
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS_ON_BOOT\" != false ]; then node scripts/migrate.mjs || echo '[boot] AVISO...'; fi; exec node server.js"]
```

- **Inline no CMD, sem `entrypoint.sh`**: o repo tem `core.autocrlf=true`; um `.sh` comitado
  do Windows chegaria com CRLF e o shebang quebraria no Alpine ("no such file or directory") —
  o container não subiria. Inline elimina essa classe de falha.
- **`||` e não `&&`**: migration que falha não derruba o servidor. O motivo fica no log e a
  aplicação segue acessível para diagnóstico, em vez de crash-loop escondendo a causa.
- **`exec` no fim**: PID 1 do container vira o `next-server` (verificado via `/proc/1/cmdline`),
  então SIGTERM do `docker stop` chega direto no Next.
- **`pg_advisory_lock` num client dedicado**: serializa N réplicas subindo juntas. Verificado
  com duas simultâneas — uma aplicou as 6, a outra esperou e encontrou tudo pronto; 20 tabelas
  e journal com 6 linhas. O lock é de SESSÃO, por isso vive num client próprio (via
  `pool.query` a liberação poderia cair noutra conexão e vazar).
- **`RUN_MIGRATIONS_ON_BOOT=false`** desliga, se for preciso separar deploy de migração.

Ganho colateral: a migration usa a MESMA `DATABASE_URL` do app, então some a classe de erro
"migrei no banco errado" — as duas não podem mais divergir.

Ainda dá para rodar à mão (útil para aplicar migration sem redeploy):

```bash
# dentro do container (Terminal do EasyPanel, docker exec, etc.)
npm run db:migrate:container      # ou: node scripts/migrate.mjs
```

⚠️ O `package.json` que vai para a imagem é **cópia integral** do projeto, então ele continua
anunciando `db:migrate` → `drizzle-kit` — a isca exata que causou o incidente. O script que
funciona lá dentro é o `db:migrate:container`.

**Compatibilidade de journal**: o script usa o migrator que já vem dentro do `drizzle-orm`,
a mesma implementação que o `drizzle-kit migrate` chama por baixo. Tabela de controle
(`drizzle.__drizzle_migrations`) e hash SHA-256 são idênticos — rodar no servidor e depois
rodar `drizzle-kit migrate` da máquina local contra o mesmo banco **não** duplica nada
(verificado: o segundo reconhece as 6 como aplicadas e pula).

**Não está no entrypoint de propósito**: o migrator do Drizzle não pega advisory lock, então
N réplicas subindo juntas aplicariam a mesma migration em paralelo. Se algum dia virar
automático no boot, envolver em `pg_advisory_lock`.

**Diagnóstico de falha**: o script traduz o motivo real na primeira linha (ECONNREFUSED,
EAI_AGAIN, 28P01, 3D000, 28000/SSL...), desempacota `AggregateError` (o `localhost` resolve
para 127.0.0.1 e ::1 e o Node agrega as falhas com `.message` vazia) e imprime
host:porta/base + status de SSL sem nunca mostrar a senha.

**O que o container AINDA não faz**: `db:seed`, `db:import-catalog` e `db:import-images`
dependem de `tsx` + `src/db/schema` (TypeScript) e, no caso das imagens, de `docs/PRODUTOS/`
(~1 GB, gitignored). Esses continuam saindo da máquina local ou de um container
`node:22-alpine` com o repo montado. Nota: `docs/Dados Catalogo ROCO site_2026.xls` **está**
versionado, então o import de catálogo funciona também a partir do repo clonado no servidor.

## Stack Docker Local (sempre no ar — 2026-08-11)
Os 3 serviços rodam via `docker compose` com `restart: unless-stopped` (voltam com o Docker Desktop):
- **web** (`site-roco`) → http://localhost:3000 — site + API + portal (build de produção).
- **postgres** (`site-roco-postgres`) → host `localhost:5433` (interno 5432; 5433 evita conflito
  com Postgres de outros projetos). Volume `roco_postgres_data` preserva dados (737 produtos, seed).
- **redis** (`site-roco-redis`) → host `localhost:6380` (interno 6379).

Envs: container web usa `.env` (gitignored) + `environment:` do compose (DATABASE_URL/REDIS_URL
apontam para os hosts internos `postgres`/`redis`); tooling do host (`npm run dev`, drizzle-kit)
usa `.env.local` (localhost:5433/6380 — mesmo banco).

**Build no Windows (bug do BuildKit)**: `docker compose build` falha com
`invalid file request src/app/[locale]/(site)/page.tsx` (colchetes/parênteses no caminho).
Use `scripts\docker-build.cmd` (contexto via tar/stdin, binário-seguro via cmd) e depois
`docker compose up -d --no-build web`. O script passa
`NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED=false` como build-arg (flag é embutida no bundle em
build-time — imagem local NÃO envia hits reais ao Mautic).

**Hot reload**: a imagem é build de produção (sem HMR). Para desenvolver com hot reload:
`docker compose stop web && npm run dev` (mesma porta 3000, mesmo Postgres/Redis do Docker);
ao terminar, `docker compose start web`.

## Links de Referência
- Next.js App Router: https://nextjs.org/docs/app
- Tailwind v4: https://tailwindcss.com/docs
- framer-motion: https://www.framer.com/motion/
- MUI CSS Variables: https://mui.com/material-ui/customization/css-variables/
