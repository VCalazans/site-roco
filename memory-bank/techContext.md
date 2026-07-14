# Tech Context — ROCO
> Atualizar quando mudar dependências ou configurações.

## Stack Completa
- **next** 16.0.3 (App Router, Turbopack, output standalone)
- **react** / **react-dom** 19.2.0
- **typescript** 5 (strict) — alias `@/* -> ./src/*`
- **tailwindcss** 4 + **@tailwindcss/postcss** (config via `@theme` em `globals.css`)
- **framer-motion** 12 (animações da hero)
- **lucide-react** (ícones)
- **clsx** + **tailwind-merge** (`cn`)
- **server-only** (proteção de módulos server, ex.: `get-dictionary`)
- Fontes: `next/font/google` — Inter (corpo) e Poppins (display)

## Setup do Ambiente
```bash
node -v            # 22+
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

## Variáveis de Ambiente (ver .env.example)
| Variável                     | Obrig. | Descrição                                  |
|------------------------------|:------:|--------------------------------------------|
| NEXT_PUBLIC_SITE_URL         | não    | URL pública (metadata/sitemap/robots)      |
| NEXT_PUBLIC_CONTACT_EMAIL    | não    | E-mail de contato (CTA — fase futura)      |
| NEXT_PUBLIC_WHATSAPP_NUMBER  | não    | WhatsApp de contato (fase futura)          |
| NEXT_PUBLIC_PRODUCTS_URL     | não    | Destino do CTA "Conheça nossos Produtos"   |
| NEXT_PUBLIC_CATALOG_URL      | não    | Destino do CTA "Baixar Catálogo" (PDF)     |
| WHATSAPP_MCP_URL             | não    | Endpoint do MCP WhatsApp (automações)      |

## Comandos do Projeto
| Comando         | Quando usar                                  |
|-----------------|----------------------------------------------|
| `npm run dev`   | Desenvolvimento (hot reload, Turbopack)      |
| `npm run build` | Validar tipos + build de produção            |
| `npm run start` | Servir o build de produção                   |
| `npm run lint`  | Checagem de lint antes de PR                 |

## Assets do Design
- Fonte de verdade: `docs/documento` (`.psd`, 3224×1724). **Não editar.**
- Extraídos p/ `public/images/hero/`:
  - `hero-scene.jpg` / `.png` — render do ambiente (sem o texto de headline/parágrafo).
  - `roco-logo-white.png` — logotipo ROCO 2D (branco, transparente).
  - `roco-wordmark-white.png` — wordmark central 3D (branco, transparente).
- Reextração: os scripts usam `ag-psd` + `@napi-rs/canvas` (Node). Ver decisionLog.

## Infraestrutura de Deploy
- `output: "standalone"` + `Dockerfile` multi-stage (node:22-alpine) + `docker-compose.yml`.
- Headers de segurança configurados em `next.config.ts`.

## Links de Referência
- Next.js App Router: https://nextjs.org/docs/app
- Tailwind v4: https://tailwindcss.com/docs
- framer-motion: https://www.framer.com/motion/
