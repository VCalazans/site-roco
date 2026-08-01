import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://roco.com.br";

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ROCO — Tem novidade chegando!",
    template: "%s | ROCO",
  },
  description:
    "Estamos preparando um novo site, pensado para estar cada vez mais conectado com você. Enquanto isso, continue acessando nossos produtos e catálogo.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "ROCO — Tem novidade chegando!",
    description:
      "Estamos preparando um novo site, pensado para estar cada vez mais conectado com você.",
    images: [
      {
        // Dimensões declaradas como as reais do arquivo: o antigo 1200x630 não
        // batia com a imagem e algumas redes recortam pelo valor anunciado.
        url: "/images/hero/hero-stage.jpg",
        width: 3224,
        height: 1484,
        alt: "ROCO",
      },
    ],
  },
};
