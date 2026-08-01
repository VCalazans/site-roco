import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Poppins } from "next/font/google";
import { defaultMetadata } from "@/core/config/metadata";
import { defaultLocale } from "@/i18n/config";
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

export const metadata: Metadata = {
  ...defaultMetadata,
  icons: {
    // Mesmo logo limpo (fundo transparente) usado no header das páginas.
    // Nota: é um logotipo BRANCO — em abas de tema claro ele fica pouco
    // visível. Um favicon dedicado, com a marca em cor sólida ou sobre fundo
    // da marca, resolveria; depende de a ROCO fornecer a versão apropriada.
    icon: [{ url: "/images/hero/roco-logo.png", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? defaultLocale;

  return (
    // As variáveis do next/font ficam no <html>, não no <body>: `globals.css`
    // compõe as stacks em `:root` (`--type-font-sans: var(--font-inter), …`), e
    // `:root` É o <html>. Declaradas no <body> elas não existiriam no escopo em
    // que são consumidas, a declaração viraria inválida e a tipografia cairia
    // silenciosamente no fallback ui-sans-serif do Tailwind.
    <html
      lang={locale}
      className={`${inter.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
