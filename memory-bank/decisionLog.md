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
