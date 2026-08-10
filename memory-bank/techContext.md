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
| NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED | não | Tracking de visitantes (prod: on salvo `"false"`; dev: off salvo `"true"`) |
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

## Links de Referência
- Next.js App Router: https://nextjs.org/docs/app
- Tailwind v4: https://tailwindcss.com/docs
- framer-motion: https://www.framer.com/motion/
- MUI CSS Variables: https://mui.com/material-ui/customization/css-variables/
