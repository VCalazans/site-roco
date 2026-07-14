# Progress — ROCO

## ✅ Concluído
- [x] Concepção da estrutura (padrão espelhado de `site-autotec` / `archicodesite`)
- [x] Base Next.js 16 + TS + Tailwind v4 + i18n (pt/en) + SEO (robots/sitemap)
- [x] Extração de assets do `.psd` (hero, logo, wordmark)
- [x] Página "Em breve" fiel ao layout (desktop + mobile)
- [x] "Entre em contato" → modal com formulário Mautic (id=1) embutido (lazy load)
- [x] Infra de IA (CLAUDE.md, AGENTS.md, memory-bank, `.claude/`, `.github/`, `.mcp.json`)
- [x] Docker (standalone) + headers de segurança
- [x] `npm run build` verde

## 🔄 Em Andamento
- [ ] Ajustes finos de cor/tamanho após revisão em navegador real

## 📋 Backlog MVP / Pós-MVP
- [ ] Definir e ligar destinos dos CTAs (Produtos, Catálogo)
- [ ] Página/fluxo de Contato ("Entre em contato")
- [ ] Metadata/SEO definitiva + favicon/OG oficiais
- [ ] Página de Produtos e Catálogo
- [ ] Conteúdo institucional (Quem somos) / blog (se aplicável)

## 🐛 Débitos Técnicos
- Destinos dos CTAs são placeholders (`#produtos`, `#catalogo`, `#contato`).
- `roco-wordmark-white.png` (wordmark 3D) tem leve bleed do render; logo 2D é o asset principal.
- `docs/documento` (`.psd`, ~98 MB) está versionado — avaliar mover para storage/LFS.

## 🔐 Riscos de Segurança
- Ao adicionar formulários: validar inputs, aplicar rate limiting, tratar LGPD/consentimento.

## 📊 Métricas de Qualidade
- Testes: ainda não configurados (sem lógica de negócio nesta fase).
- Build: passando. Lint: `next/core-web-vitals`.
