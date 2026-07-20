# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-07-19

## Fase Atual
MVP evolução — landing refatorada e nav expandida (4 itens com ícones do novo PSD).

## O Que Foi Feito (esta sessão)
- Refatoração de `coming-soon-hero.tsx` em peças: `hero-layout.ts`, `nav-items.tsx`, `cta-hotspot.tsx`, `mobile-menu.tsx`.
- Integração da nova barra de nav `docs/Novos ícones_OK.psd` (extração via ag-psd + sharp).
- 4 itens de nav: Home, Ligamos pra você (PhoneCall), Solicite um orçamento (Headset), Entre em contato.
- Ícones lucide-react (`currentColor`, tamanho em `em`) — escaláveis desktop/mobile.
- Textos adicionados a `src/i18n/dictionaries/{pt,en}.json` (campos `navigation.links[].icon`).
- Resolução centralizada de destino: `resolveDestination(href)` em `src/core/config/site.ts`.
- **Validação de CNPJ + enhancement do form Mautic**: `cnpj.ts` (lógica pura, suporte alfanumérico) + `use-mautic-enhancements.ts` (hook + bloqueio de submit inválido via listener de captura).
- `npm run build` verde; `npm run lint` quebrado (problema pré-existente: ESLint circular structure).

## Próximos Passos Imediatos
1. [ ] Confirmar fluxo dos 3 itens de contato: todos → Mautic id=1, ou "Ligamos pra você" → WhatsApp?
2. [ ] Testar form Mautic em navegador (CNPJ válido/inválido, telefone, submit bloqueado).
3. [ ] Revisar copy EN (provisório) com copywriter.
4. [ ] Afinar layout labels nav desktop (1 linha vs. 2 linhas do PSD).
5. [ ] Corrigir config ESLint (circular structure).
6. [ ] Confirmar destinos de Produtos e Catálogo PDF.

## Bloqueadores
- Definição de fluxo das opções de contato (Mautic vs. WhatsApp vs. híbrido).

## Decisões Pendentes
- Três itens de contato devem convergir para o mesmo modal, ou ter caminhos distintos?
