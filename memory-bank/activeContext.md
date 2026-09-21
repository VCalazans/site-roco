# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-09-21

## Fase Atual
MVP estável — landing + catálogo + pop-ups e leads em RD Station; botão próprio de WhatsApp removido.

## O Que Foi Feito (esta sessão)
- **Pop-ups do RD Station (conta 811101) agora renderizam**:
  - Loader RD já existia (`rdstation-tracking.tsx`, SHA-256 `db41b826…`); injetava popup.min.js
    do CDN CloudFront. Bloqueio vinha da CSP: `connect-src`, `style-src`, `font-src` não liberavam
    os hosts do RD e Google Fonts.
  - Mudança em `next.config.ts`: constante `RD_STATION_POPUP_HOSTS` somada a `connect-src`
    (`popups.rdstation.com.br`, `cta-redirect.rdstation.com`, `cidades.rdstation.com.br`);
    `style-src` + `https://fonts.googleapis.com`; `font-src` + `https://fonts.gstatic.com`.
  - Auditoria de `rdstation-popup.min.js`: sem eval/`new Function`/iframes; clipboard só em
    botão "copiar cupom".
- **Removido botão flutuante próprio de WhatsApp**:
  - Deletado: `src/shared/components/whatsapp-float/` (componente + index).
  - Removido uso em `src/app/[locale]/layout.tsx`.
  - Removido: chave `whatsapp` em `src/i18n/dictionaries/{pt,en}.json`.
  - `siteLinks.whatsapp` em `src/core/config/site.ts` agora sem uso.
  - Razão: pop-up flutuante do RD (id=6077326) substitui a funcionalidade; elimina redundância.
- **Pop-ups ativos na conta RD**:
  - Newsletter (id=6072461, exit_intent, desktop, 1x/dia).
  - WhatsApp (id=6077326, floating_button, desktop+mobile).
  - "teste" (id=9325167, scroll, 1x/dia, link rds.land — **confirmar se pausar**).
- Verificado: `npm run build` verde; CSP header via `next start` confere; sem eval/forbidden API.
- **Não verificado**: smoke test no navegador (botão WhatsApp renderiza, console sem CSP violation,
  cookies do RD gravados).

## Próximos Passos Imediatos
1. [ ] **Smoke test no navegador**: abrir `/pt` (prod), Network filtrar `popups.rdstation.com.br`,
       ver botão WhatsApp, Console sem CSP violations, Cookies com `rd_*`.
2. [ ] **Pausar pop-up "teste" (id=9325167)?** — link para rds.land; avaliar se deve ficar ativo.
3. [ ] **Máscara de telefone internacional**: se algum pop-up usar, carrega `choices.js` de
       cdn.jsdelivr.net — decidirnow se liberar cdn.jsdelivr.net em `script-src` ou manter sem máscara.
4. [ ] Confirmar se GA4 será adicionado aos pop-ups (googletagmanager.com).

## Bloqueadores
- Verificação no navegador (extensão Chrome não conectada).

## Decisões Pendentes
- Pop-up "teste" de scroll (rds.land) deve ser pausado ou mantido ativamente?
- Suporte a máscara de telefone internacional nos pop-ups (exige cdn.jsdelivr.net em `script-src`)?
