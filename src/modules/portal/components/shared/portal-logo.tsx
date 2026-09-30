import Image from "next/image";
import Box from "@mui/material/Box";

/**
 * Logos da marca por esquema de cor do portal. Os PNGs em
 * `public/images/logos/` são recortes sem padding, então a proporção abaixo é a
 * do próprio arquivo — o `width`/`height` renderizados derivam dela e a logo
 * nunca é achatada (a versão antiga forçava um quadrado 28×28 sobre um
 * arquivo retangular).
 *
 *   wordmark -> 289×125, só "ROCO" (cabeçalho da sidebar)
 *   slogan   -> 918×506, "ROCO" + "onde tudo se conecta" (login e boas-vindas)
 *
 * A logo 3D (`roco-logo-3d.png`) NÃO entra aqui de propósito: ela tem as faces
 * brancas com volume azul e só funciona sobre fundo escuro, enquanto o portal
 * troca entre dois esquemas de cor.
 */
const LOGOS = {
  wordmark: {
    light: "/images/logos/roco-logo-blue.png",
    dark: "/images/logos/roco-logo-white.png",
    ratio: 125 / 289,
  },
  slogan: {
    light: "/images/logos/roco-logo-slogan-blue.png",
    dark: "/images/logos/roco-logo-slogan-white.png",
    ratio: 506 / 918,
  },
} as const;

export type PortalLogoVariant = keyof typeof LOGOS;

type PortalLogoProps = {
  /** Texto alternativo — vem do dicionário (`navigation.brand`). */
  alt: string;
  variant?: PortalLogoVariant;
  /** Largura renderizada em px; a altura sai da proporção do arquivo. */
  width: number;
  /**
   * `true` para logos acima da dobra (login). Só sobe a prioridade de rede
   * (`fetchPriority="high"`): NÃO usa `preload` nem `loading="eager"`, porque as
   * duas versões ficam no DOM e ambos fariam o navegador baixar as duas. Com o
   * `loading="lazy"` padrão, a que está com `display: none` nunca é buscada —
   * é o que a doc do Next recomenda para imagens com troca de tema.
   */
  eager?: boolean;
};

/**
 * Logo ROCO sensível ao tema: azul no esquema claro, branca no escuro.
 *
 * A troca é feita só com CSS — as duas imagens vão no HTML e o seletor de
 * classe do MUI (`<html class="dark|light">`, ver `colorSchemeSelector:
 * "class"` em `src/core/theme/index.ts`) decide qual aparece. Assim o
 * componente funciona em Server Components (o `sx` é um objeto, nunca uma
 * função) e não pisca a logo errada antes da hidratação, coisa que um
 * `useColorScheme()` faria.
 *
 * O seletor `*:where(.dark) &` é exatamente o que `theme.applyStyles("dark")`
 * gera. Sem classe no `<html>` vale o esquema padrão do tema (claro).
 *
 * As duas imagens levam o mesmo `alt`: a oculta por `display: none` sai da
 * árvore de acessibilidade, então o leitor de tela anuncia a marca uma vez só.
 */
export function PortalLogo({ alt, variant = "wordmark", width, eager = false }: PortalLogoProps) {
  const logo = LOGOS[variant];
  const height = Math.round(width * logo.ratio);
  const fetchPriority = eager ? "high" : undefined;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        flexShrink: 0,
        width,
        height,
        lineHeight: 0,
        "& img": { display: "block", width: "100%", height: "auto" },
        "& .portal-logo-dark": { display: "none" },
        "*:where(.dark) & .portal-logo-light": { display: "none" },
        "*:where(.dark) & .portal-logo-dark": { display: "block" },
      }}
    >
      <Image
        className="portal-logo-light"
        src={logo.light}
        alt={alt}
        width={width}
        height={height}
        fetchPriority={fetchPriority}
      />
      <Image
        className="portal-logo-dark"
        src={logo.dark}
        alt={alt}
        width={width}
        height={height}
        fetchPriority={fetchPriority}
      />
    </Box>
  );
}
