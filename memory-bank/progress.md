# Progress — ROCO

## ✅ Concluído
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
- [x] `npm run build` verde

## 🔄 Em Andamento
- [ ] Afinar labels nav desktop (layout 1 vs 2 linhas)
- [ ] Definir fluxo dos itens de contato (Mautic vs. WhatsApp vs. híbrido)

## 📋 Backlog MVP / Pós-MVP
- [ ] Corrigir config ESLint (circular structure)
- [ ] Revisar copy EN com copywriter
- [ ] Confirmar destinos reais (URL Produtos, arquivo Catálogo PDF)
- [ ] Página/fluxo de Contato completo (se diferente do modal Mautic)
- [ ] Metadata/SEO definitiva + favicon/OG oficiais
- [ ] Página de Produtos e Catálogo
- [ ] Conteúdo institucional (Quem somos) / blog (se aplicável)

## 🐛 Débitos Técnicos
- `npm run lint` quebrado: ESLint 9.39.5 estoura "Converting circular structure to JSON" ao carregar config (pré-existente, não relacionado a mudanças de hoje).
- Configurar test runner formal (Jest/Vitest) para formalizar testes de `cnpj.ts` (verificação atual: manual, 10/10 casos).
- Avaliar tornar CNPJ obrigatório (atualmente só se preenchido — depende da política de contato da ROCO).
- `roco-wordmark-white.png` (wordmark 3D) tem leve bleed do render; logo 2D é o asset principal.
- `docs/documento` e `docs/Novos ícones_OK.psd` (~98 MB) versionados — avaliar mover para storage/LFS.
- Copy EN dos itens novos de nav é provisório (revisar).
- Destinos dos CTAs podem ser placeholders até stakeholder confirmar.

## 🔐 Riscos de Segurança
- Ao adicionar formulários: validar inputs, aplicar rate limiting, tratar LGPD/consentimento.
- Os 3 itens de contato (nav) atualmente convergem para Mautic id=1 — confirmar se é intencional.

## 📊 Métricas de Qualidade
- Testes: ainda não configurados (sem lógica de negócio nesta fase).
- Build: passando. Lint: bloqueado (config ESLint).
