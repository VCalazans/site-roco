# Active Context — ROCO
> Atualizar no início/fim de cada sessão.

## Data
2026-08-04

## Fase Atual
MVP evolução — landing + catálogo no ar; tracking de visitantes recém-instalado.

## O Que Foi Feito (esta sessão)
- **Tracking de visitantes via Mautic (`mtc.js`)**, no padrão de segurança já usado no formulário:
  - `public/vendor/mautic-tracking.js` — cópia verificada e self-hosted do `mtc.js`
    (SHA-256 `d4378644…`, 100.654 bytes; zero indicadores de ClickFix/ofuscação).
  - `src/shared/components/analytics/mautic-tracking.tsx` (+ `index.ts`) — instala a fila `mt`,
    carrega o script self-hosted e emite um pageview por `pathname` novo (App Router é SPA).
  - Montado em `src/app/[locale]/layout.tsx`.
  - CSP: **`script-src 'self'` mantido**; adicionado só `https://mautic.roco.com.br` ao `img-src`.
  - Flag `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED` (prod: on salvo `"false"`; dev: off salvo `"true"`).
  - `public/vendor/README.md` e `.env.example` documentados; decisão em `decisionLog.md`.
- Verificado: build verde; `/vendor/mautic-tracking.js` servido 200; CSP correta na resposta;
  `POST /mtc/event` → 200 com CORS completo; `mtracking.gif` → 200 `image/gif`.
- **Descoberta a resolver**: a allowlist de CORS do Mautic tem só `https://roco.com.br`. Como
  `roco.com.br` e `www.roco.com.br` ambos servem o site (nenhum canonicaliza), quem entra por `www`
  cai no pixel — o hit conta, mas os cookies `mtc_id`/`mtc_sid` não são gravados e a visita não é
  amarrada ao contato. Corrigir no Mautic (CORS Valid Domains) ou canonicalizar o host.

## Próximos Passos Imediatos
1. [ ] **Smoke test no navegador** (não executado — extensão do Chrome não conectada nesta sessão):
       abrir `/pt`, DevTools → Network filtrar `mtracking` (1 hit), navegar para `/pt/catalogo`
       (2º hit), Console sem violações de CSP, Application → Cookies com `mtc_id`/`mtc_sid`.
       Conferir no Mautic se as visitas aparecem.
2. [ ] **Liberar `www` no CORS do Mautic** (ou canonicalizar host) — ver "Descoberta" acima.
3. [ ] **Decidir LGPD**: manter tracking sem banner ou exigir opt-in (o `mtc.js` grava
       `mtc_id`/`mtc_sid`/`mautic_device_id` e identifica o visitante). Flag já permite desligar.
4. [ ] Confirmar fluxo dos 3 itens de contato: todos → Mautic id=1, ou "Ligamos pra você" → WhatsApp?
5. [ ] Revisar copy EN (provisório) com copywriter.
6. [ ] Corrigir config ESLint (circular structure).
7. [ ] Confirmar destino real de Produtos (`NEXT_PUBLIC_PRODUCTS_URL` vazio).

## Bloqueadores
- Definição de fluxo das opções de contato (Mautic vs. WhatsApp vs. híbrido).
- Política de consentimento (LGPD) para o tracking.

## Decisões Pendentes
- Três itens de contato devem convergir para o mesmo modal, ou ter caminhos distintos?
- Banner de consentimento antes do tracking?
