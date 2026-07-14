# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-07-13

## Fase Atual
MVP — página "Em breve" entregue; base estruturada para crescer.

## O Que Foi Feito (esta sessão)
- Bootstrap da base Next.js 16 (App Router, i18n pt/en, módulos, SEO, Docker).
- Extração dos assets da hero do `.psd` (`public/images/hero/`).
- Implementação fiel da página "Tem novidade chegando!" (desktop alinhado ao render + mobile empilhado).
- Infra de IA: CLAUDE.md, AGENTS.md, memory-bank, `.claude/` (agents, commands, settings), `.github/`, `.mcp.json`.
- Build de produção validado (`npm run build` OK) e alinhamento do layout conferido.

## Próximos Passos Imediatos
1. [ ] Confirmar destinos reais dos CTAs de Produtos e Catálogo PDF. (Contato já resolvido: modal + formulário Mautic id=1.)
2. [ ] Confirmar descrição oficial do negócio ROCO para metadata/SEO e OpenGraph.
3. [ ] Ajustar cores de marca finais (tokens neon em `globals.css`) se necessário.
4. [ ] Conferir a página em navegador real (desktop + mobile) e afinar tamanhos.
5. [ ] Adicionar favicon/OG dedicados (ícones oficiais da ROCO).

## Bloqueadores
- Destinos dos CTAs, dados de contato e descrição do negócio dependem do stakeholder.

## Decisões Pendentes
- URL do site de Produtos e arquivo do Catálogo.
- Canal de contato (formulário vs. WhatsApp vs. e-mail).
