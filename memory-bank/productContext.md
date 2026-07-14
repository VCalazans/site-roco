# Product Context — ROCO

## Contexto de Negócio
ROCO é uma **fabricante industrial brasileira**. O material de referência (`.psd`) mostra um
ambiente futurista com estética neon dual-tone (ciano à esquerda, âmbar à direita), o galpão/
sede da ROCO e um piso fabril — reforçando o posicionamento industrial e tecnológico.
> A confirmar com o stakeholder: linha de produtos oficial, segmento e claims de marca.

## Fluxos Principais (fase atual)
1. Visitante acessa `/` → é redirecionado para `/pt` (ou `/en` conforme idioma).
2. Vê a página "Tem novidade chegando!" com a mensagem de site em construção.
3. Pode: acessar **Produtos**, **Baixar Catálogo**, ou **Entrar em contato**.
   > Destinos desses links são placeholders (`#produtos`, `#catalogo`, `#contato`) até
   > que as URLs/recursos reais sejam definidos (ver decisionLog / progress).

## Integrações de Negócio
- **WhatsApp (MCP Archicode)**: disponível para automações/notificações internas.
- Futuras: e-mail de contato, PDF do catálogo, site/loja de produtos.

## Restrições de Negócio
- Conteúdo primário em **pt-BR** (mercado brasileiro); en como secundário.
- LGPD: ao introduzir formulários, tratar dados pessoais com consentimento e mínimo necessário.

## Personas
- **Cliente/Parceiro industrial**: quer conhecer produtos e obter o catálogo.
- **Visitante geral**: quer entender o que é a ROCO e como falar com a empresa.
