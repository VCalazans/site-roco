# ROCO — Site Institucional

> Página de espera ("Tem novidade chegando!") sobre uma base Next.js pronta para crescer.

Site institucional da **ROCO**. Nesta fase inicial, apresenta uma landing "Em breve" fiel
ao layout aprovado (`.psd`), já estruturada para evoluir para o site completo.

## 🚀 Quick Start
```bash
npm install
cp .env.example .env.local
npm run dev
# abra http://localhost:3000  (redireciona para /pt)
```

## 📋 Requisitos
- Node.js 22+
- npm 9+

## 🏗️ Stack
| Tecnologia      | Versão | Propósito                          |
|-----------------|--------|------------------------------------|
| Next.js         | 16     | Framework (App Router, Turbopack)  |
| React           | 19     | UI                                 |
| TypeScript      | 5      | Tipagem estática (strict)          |
| Tailwind CSS    | 4      | Estilos (via `@theme`, sem config) |
| framer-motion   | 12     | Animações                          |
| lucide-react    | 1.x    | Ícones                             |

## 📁 Estrutura
```
src/app        → App Router (layout, [locale], globals.css, robots, sitemap)
src/core       → config (metadata) e lib (cn)
src/modules    → features (landing/…)
src/shared     → componentes compartilhados
src/i18n       → i18n (pt padrão, en) + dicionários
public/images  → assets (hero extraída do .psd)
middleware.ts  → roteamento de locale
```

## 🌐 Internacionalização
- Locales: **pt** (padrão) e **en**.
- Todo texto vem de `src/i18n/dictionaries/{pt,en}.json`.
- O locale é resolvido no `middleware.ts` (cookie `NEXT_LOCALE` / `Accept-Language`).

## 🐳 Deploy
Build standalone pronto para container:
```bash
docker compose up --build
```

## 🤝 Contribuindo
- Padrão de commits: Conventional Commits.
- Copy visível apenas nos dicionários i18n.
- Rode `npm run lint` e `npm run build` antes de abrir PR.

## 🎨 Design
O layout de referência está em `docs/documento` (`.psd`, 3224×1724). Os assets da hero
(`public/images/hero/`) foram extraídos dele. **Não edite o `.psd`.**

## 📄 Licença
Proprietário — © 2026 ROCO. Todos os direitos reservados.
