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
        url: "/images/hero/hero-scene.jpg",
        width: 1200,
        height: 630,
        alt: "ROCO",
      },
    ],
  },
};
