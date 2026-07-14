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
    icon: [{ url: "/images/hero/roco-logo-white.png", type: "image/png" }],
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
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${poppins.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
