import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Inter, Poppins } from "next/font/google";
import { defaultMetadata, LOCALE_LANGUAGE_TAGS } from "@/core/config/metadata";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

// Favicon e ícone Apple vêm da CONVENÇÃO de arquivos do App Router
// (`src/app/icon.png` 512×512 e `src/app/apple-icon.png` 180×180): monograma
// "R" da logo nova sobre o navy da marca com os brilhos ciano/âmbar — legível
// em aba clara e escura (o favicon anterior era o logotipo BRANCO sobre
// transparência, que sumia em abas de tema claro). Spec 001, RF03.
export const metadata: Metadata = {
  ...defaultMetadata,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Idioma da URL (header gravado pelo `src/proxy.ts`); o cookie só vale onde o
  // proxy não passa (páginas de erro fora de `[locale]`).
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const candidate = headerStore.get("x-roco-locale") ?? cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = locales.includes(candidate as Locale) ? (candidate as Locale) : defaultLocale;

  return (
    // As variáveis do next/font ficam no <html>, não no <body>: `globals.css`
    // compõe as stacks em `:root` (`--type-font-sans: var(--font-inter), …`), e
    // `:root` É o <html>. Declaradas no <body> elas não existiriam no escopo em
    // que são consumidas, a declaração viraria inválida e a tipografia cairia
    // silenciosamente no fallback ui-sans-serif do Tailwind.
    <html
      lang={LOCALE_LANGUAGE_TAGS[locale]}
      className={`${inter.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
