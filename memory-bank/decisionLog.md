# Decision Log — ROCO
> Registro de decisões arquiteturais importantes. Nunca deletar entradas — apenas adicionar.
> Formato: Data | Decisão | Alternativas | Justificativa | Impacto

---

## 2026-07-13 — Stack e estrutura base
**Decisão**: Next.js 16 (App Router) + React 19 + TypeScript 5 + Tailwind v4, com estrutura
`src/{app,core,modules,shared,i18n}`.
**Alternativas**: Astro/Vite estático; estrutura flat sem `modules`.
**Justificativa**: Espelhar os projetos de referência da mesma casa (`site-autotec`,
`archicodesite`) garante consistência, reuso de padrões e evolução previsível.
**Impacto**: Base modular pronta para crescer sem retrabalho estrutural.

## 2026-07-13 — i18n por middleware (pt padrão, en secundário)
**Decisão**: i18n próprio via `middleware.ts` + segmento `[locale]` + dicionários JSON tipados.
**Alternativas**: next-intl; site pt-only.
**Justificativa**: Mesmo padrão das referências; ROCO é BR (pt padrão) mas a base já suporta en.
**Impacto**: Todo texto visível deve vir dos dicionários; rotas prefixadas por locale.

## 2026-07-13 — Página "Em breve": render do .psd como arte + foreground vivo
**Decisão**: Usar o render 3D do `.psd` como imagem de fundo cinematográfica e reconstruir
como HTML vivo apenas as camadas separáveis (nav, headline, parágrafo) + hotspots clicáveis
sobre os botões neon "assados" no render.
**Alternativas**: (a) usar o composite achatado inteiro como imagem estática (sem i18n/SEO/
responsivo); (b) recriar toda a cena em CSS (perderia a fidelidade do render 3D).
**Justificativa**: O wordmark central, a barra de navegação e os botões neon são geometria 3D
intrínseca ao render (camada única "Camada 2"), não separáveis. Manter o render preserva a
fidelidade; extrair headline/parágrafo (camadas próprias no `.psd`) mantém copy traduzível,
selecionável e indexável.
**Impacto**: Desktop usa caixa `aspect-[3224/1724]` + `containerType: inline-size` (texto em
`cqw`) para alinhar overlays ao render em qualquer largura; mobile reconstrói o foreground
empilhado com botões neon em CSS. Coordenadas medidas do `.psd` ficam em `coming-soon-hero.tsx`.

## 2026-07-13 — Extração de assets do .psd via Node (ag-psd)
**Decisão**: Extrair camadas/cores com `ag-psd` + `@napi-rs/canvas`.
**Alternativas**: `psd-tools` (Python) — inviável (sem `pip`/`ensurepip` no ambiente); ImageMagick — sem delegate PSD.
**Justificativa**: Node disponível e confiável; `ag-psd` lê a árvore de camadas e dados raster.
**Impacto**: Pipeline de reextração reproduzível documentado em techContext.

## 2026-07-13 — "Entre em contato": modal + formulário Mautic embutido
**Decisão**: O CTA "Entre em contato" (nav) abre um **modal** que embute o formulário do
**Mautic** (`https://mautic.roco.com.br/form/generate.js?id=1`). Padrão de provider/contexto
em `src/shared/components/contact-form/` (ContactFormProvider → ContactModal), espelhando o
lead-form dos projetos de referência.
**Alternativas**: página `/contato` dedicada (Bootstrap, como no HTML enviado); link `mailto`.
**Justificativa**: Modal mantém o usuário na landing "Em breve"; reaproveita o Mautic já
existente da ROCO (id=1). Não usamos Bootstrap (conflita com Tailwind) — o form do Mautic é
estilizado via `.mautic-form-wrap` no `globals.css`, no tema dark/neon.
**Impacto**: O script do Mautic é injetado **lazy** (só ao abrir, uma vez) dentro do container;
o modal fica montado (opacity/pointer-events) para preservar o form entre abre/fecha. URL do
Mautic hardcoded em `contact-modal.tsx` (`MAUTIC_FORM_SRC`) — parametrizar via env se necessário.

## 2026-07-13 — Fontes: Inter (corpo) + Poppins (display)
**Decisão**: Pareamento via `next/font/google`.
**Alternativas**: Geist (referências) — menos alinhado ao visual industrial da ROCO.
**Justificativa**: Poppins (geométrica) aproxima a headline do `.psd`; Inter para leitura.
**Impacto**: Variáveis `--font-inter`/`--font-poppins` consumidas pelo `@theme`.

## 2026-07-19 — Refatoração da landing + nova barra de nav do PSD + resolução centralizada de destinos
**Decisão**: (1) Quebrar monolito `coming-soon-hero.tsx` (~259 linhas) em componentes modulares:
`hero-layout.ts` (constantes/tipos), `nav-items.tsx` (renderizador de itens), `cta-hotspot.tsx`
(hotspot transparente), `mobile-menu.tsx` (hambúrguer); (2) Integrar nova barra de nav do PSD
`docs/Novos ícones_OK.psd` (4 itens: Home, Ligamos pra você, Solicite um orçamento, Entre em
contato) com ícones lucide-react (PhoneCall, Headset); (3) Centralizar resolução de destino via
`resolveDestination(href)` em `src/core/config/site.ts` (mapeia `#produtos`/`#catalogo` para env).
**Alternativas**: Manter monolito (menos manutenível); hardcodar ícones; resolver destino em N componentes.
**Justificativa**: Modularização facilita reuso e testes futuros; ícones lucide garantem fidelidade
ao PSD sem assets adicionais; centralização evita duplicação de lógica.
**Impacto**: Componentes menores e focados; nav escalável (container-query desktop + mobile
hambúrguer); destinos mapeáveis via env sem tocar código. **Premissas em aberto**: Os 3 itens de
contato abrem o MESMO modal Mautic (id=1) — confirmar se "Ligamos pra você" vai para WhatsApp.
Copy EN provisório; labels desktop em 1 linha (PSD mostra 2) — afinar.

## 2026-07-19 — Validação de CNPJ + enhancement client-side do formulário Mautic
**Decisão**: Criar camada de "enhancement" client-side para o form Mautic (injetado em runtime).
Arquivos novos em `src/shared/components/contact-form/`: `cnpj.ts` (funções puras de validação/
formatação com suporte alfanumérico desde jul/2026 — base de 12 chars com A–Z/0–9 + 2 DV numéricos)
e `use-mautic-enhancements.ts` (hook + função DOM pura que aplica máscara de CNPJ/telefone,
validação inline via `aria-invalid`, e **bloqueia submit de CNPJ inválido** usando listener na fase
de CAPTURA do evento submit no container — antes do AJAX/POST do Mautic).
**Alternativas**: (a) deixar validação só no servidor Mautic (sem feedback imediato); (b) reescrever
form em React (perde manutenibilidade); (c) validar mas não bloquear (menos UX).
**Justificativa**: Mautic injeta HTML em runtime (não é React); enhancement via DOM oferece máscara,
feedback visual e bloqueio de submit inválido **antes** de atingir Mautic. Rejeita comprimento
errado, sequências repetidas. Usa `MutationObserver` para achar campos assincronamente.
**Impacto**: (1) Campos inválidos não disparam AJAX/POST — previne rejeição no Mautic. (2) Validação
só se preenchido — obrigatoriedade é responsabilidade do Mautic. (3) Integração em `contact-modal.tsx`
via hook. (4) Novo CSS em `globals.css` (`input[aria-invalid="true"]`). (5) Dicionários ampliados.
Verificação manual: unit CNPJ 10/10 + simulação DOM 9/9 (happy-dom). Débito: test runner formal.

## 2026-08-04 — Tracking de visitantes: Mautic `mtc.js` self-hosted + pageview por rota
**Decisão**: Adotar o tracking do **Mautic** (`mtc.js`) como analytics do site, mas **sem carregar o
script do servidor Mautic**: cópia verificada e self-hosted em `public/vendor/mautic-tracking.js`,
consumida por `src/shared/components/analytics/mautic-tracking.tsx` (client component montado em
`app/[locale]/layout.tsx`). A CSP mantém `script-src 'self'`; foi adicionado apenas o domínio do
Mautic ao `img-src`. Flag `NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED` (produção: ligado salvo `"false"`;
desenvolvimento: desligado salvo `"true"`).
**Alternativas**: (a) snippet oficial carregando `https://mautic.roco.com.br/mtc.js` — exigiria
devolver o domínio do Mautic ao `script-src`, reabrindo exatamente o vetor fechado após o ClickFix;
(b) GA4/GTM — mais relatórios, mas cookies de terceiros, banner de consentimento e ainda assim
liberação de CSP para domínios Google; (c) analytics cookieless (Umami/Plausible) — melhor para LGPD,
porém não amarra a visita ao lead que já existe no Mautic.
**Justificativa**: O funil da ROCO (catálogo e contato) já vive no Mautic; o pixel liga visita ↔ lead
sem ferramenta nova. Self-hosting preserva a garantia pós-ClickFix: mesmo com o servidor Mautic
reinfectado, nenhum script de fora executa nesta origem — só *dados* do hit saem.
**Auditoria da cópia** (2026-08-04, SHA-256 `d4378644…d6d4dc7f000`, 100.654 bytes): zero indicadores
de ClickFix/ofuscação (`clipboard.writeText`, `execCommand`, `powershell`, `mshta`, `eval(`,
`new Function`, `atob`, `fromCharCode`, `unescape`, `document.write`). Os dois caminhos que
injetariam script remoto são inertes aqui: `initGatedVideo()` aborta sem `<video>` na página, e o
loader de `mautic-form.js` só roda ao renderizar slot de *Dynamic Web Content* — o site não tem
nenhum dos dois. Detalhes em `public/vendor/README.md`.
**Impacto**: (1) O hit sai por `POST /mtc/event` (caminho principal) **ou** pelo pixel
`mtracking.gif` (fallback). O `mtc.js` manda `X-Requested-With` + `withCredentials=true`, então o
navegador exige preflight; o Mautic responde corretamente (`Access-Control-Allow-Credentials: true`
+ eco da origem), **mas sua allowlist de CORS contém somente `https://roco.com.br`** — `www` e
qualquer outro host recebem preflight sem headers. Como hoje `roco.com.br` **e** `www.roco.com.br`
servem o site (nenhum canonicaliza), visitantes em `www` caem no pixel: o hit é registrado, porém
`setTrackedContact` não roda e os cookies `mtc_id`/`mtc_sid` não são gravados no cliente — a visita
não é amarrada ao contato. Por isso o `img-src` é load-bearing, não enfeite. **Correção a fazer:**
adicionar `https://www.roco.com.br` às "CORS Valid Domains" do Mautic, ou canonicalizar o site em um
único host por redirect. (2) SPA: o hit automático do
`mtc.js` cobre só a primeira view, então o componente emite um pageview por `pathname` novo,
deduplicado por variável de MÓDULO (`lastTrackedPath`) — sobrevive à remontagem do layout na troca
de locale e absorve a dupla invocação de efeitos do StrictMode. (3) **LGPD em aberto**: o `mtc.js`
grava cookies de primeira parte (`mtc_id`, `mtc_sid`, `mautic_device_id`) + `localStorage` e
identifica o visitante, e **não há banner de consentimento** — decisão de opt-in ficou pendente com
o stakeholder; a flag desliga tudo sem editar código se o jurídico exigir.

## 2026-08-31 — Landing envia leads DIRETO ao RD Station, sem tirar o Mautic do caminho

**Decisão**: a landing em produção passa a encaminhar ao RD Station todo lead que o formulário do
Mautic aceitar. O formulário NÃO muda: continua postando para o Mautic exatamente como antes. O que
entra é um observador — quando o Mautic confirma o sucesso, os valores capturados são enviados a
`POST /api/rd-lead`, que fala com a Conversions API do RD do lado do SERVIDOR.

**Por que uma rota, e não um POST do navegador direto para o RD**: a `RD_STATION_API_KEY` é
credencial de servidor. Um `fetch` para `api.rd.services` feito do cliente a publicaria no
código-fonte da página para qualquer visitante. O Route Handler existe para o envio sair "direto ao
RD" sem expor a chave — é a única razão dele.

**Por que MANTER o Mautic**: esta landing não tem banco (o `package.json` traz `next`, `react` e
pouco mais — nada de Postgres, Drizzle ou Redis), então não existe aqui o "grava o lead primeiro,
dispara os canais depois" do site novo. Sem o Mautic, uma indisponibilidade do RD faria o lead se
perder de vez. Com ele, o RD é um canal ADICIONAL sobre uma captação que já funciona: se o
encaminhamento falha, o lead continua no Mautic e o visitante nem fica sabendo (a rota responde 202
mesmo quando o RD recusa — o motivo fica só no log).

**Captura no SUBMIT, não no sucesso**: o SDK do Mautic limpa os campos ao concluir. Ler o formulário
dentro do callback de sucesso devolveria strings vazias de forma intermitente — seria uma corrida
contra o reset. Os valores são lidos na fase de CAPTURA do evento `submit`, antes de qualquer coisa
acontecer, e guardados numa ref até a confirmação chegar. A detecção de sucesso reaproveita a dupla
de sinais que `useCatalogDownload` já usava (callback `onResponseEnd` do SDK + classe
`mauticform-post-success` como reserva), sempre ENCADEANDO o handler anterior: a página de catálogo
tem dois observadores no mesmo formulário e nenhum pode apagar o outro.

**Mapeamento de campos**: `nome`+`sobrenome` → `name`; `email` → `email`; `telefone` →
`personal_phone`; `cidade` → `city`; `estado` → `state`; `cnpj` → `cf_cnpj`; `mensagem` →
`cf_mensagem`; a seção → `cf_origem`. `city`/`state` vão nos campos PADRÃO de propósito: a conta tem
um `cf_seu_estado`, mas duplicar num campo customizado o que a API já modela nativamente criaria
duas fontes de verdade e ficaria fora dos relatórios nativos do RD. `conversion_identifier` usa os
MESMOS valores do site novo (`download_catalogo`, `contato_geral`) para o histórico do RD não nascer
partido em dois vocabulários.

**Rate limit em MEMÓRIA**: janela fixa de 10 por IP a cada 10 min, com teto de chaves para IPs
rotativos não fazerem a `Map` crescer sem limite. O site novo usa Redis; aqui não há nenhum, e a
alternativa era deixar SEM limite uma rota pública que cria contato no CRM — spam de lead falso
direto na base comercial. Reiniciar o processo só zera os contadores, falhando para o lado
permissivo, que é o certo quando o custo de um falso positivo é perder lead real.

**Alternativas**: (a) captura automática de formulário do RD (o script de monitoramento já está na
página e o RD integra formulários sozinho) — rejeitada por não ser verificável daqui: o envio do
Mautic é AJAX com o `submit` sequestrado pelo SDK, e não há como confirmar que o tracker o
reconhece; a falha seria silenciosa; (b) substituir o Mautic pelo RD — rejeitada, deixaria a
captação sem rede de segurança numa landing sem banco; (c) portar o `/api/contact` do site novo —
impossível sem Postgres/Drizzle/Redis, que esta base não tem.

**Impacto**: arquivos novos `src/server/lib/{rd-station,rd-station-send}.ts`,
`src/app/api/rd-lead/route.ts`, `src/shared/components/contact-form/use-rd-lead-forward.ts`; props
novas `leadSubject`/`leadOrigin` no `MauticEmbed`; env `RD_STATION_API_KEY` documentada no
`.env.example`. CSP intocada — a chamada é para a própria origem, já coberta por `connect-src 'self'`.
⚠️ **Ao mesclar o site novo nesta branch, os módulos `rd-station*` daqui devem ser DESCARTADOS** em
favor dos de lá (que têm zod, testes e o schema de `contact-submit`), nunca mesclados: são o mesmo
conceito escrito para dois contextos, e esta versão só existe porque a landing não tem backend.
