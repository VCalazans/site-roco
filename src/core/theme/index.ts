import { createTheme } from "@mui/material/styles";

/**
 * Tema único do Portal Interno ROCO — MUI v9 com CSS variables e dois
 * `colorSchemes` (dark/light). O site público (landing/catálogo) permanece
 * 100% Tailwind e nunca importa este módulo; a convivência entre os dois
 * sistemas de estilo é resolvida em `portal-providers.tsx` (`enableCssLayer`),
 * não aqui.
 *
 * Tokens de marca herdados de `src/app/globals.css`:
 *   --neon-cyan #3ec6f0 / --neon-cyan-bright #35d9ff  -> primary
 *   --neon-amber #f5a33c / --neon-amber-bright #ffb454 -> secondary
 *   --background #05070b / paper ~#0a0e15              -> dark scheme
 *
 * O scheme `light` NÃO reusa `--neon-cyan` (#3ec6f0) como `primary.main`: a
 * cor tem ~2.6:1 de contraste contra branco, abaixo do mínimo AA (4.5:1) para
 * texto/ícones. `#0e7fa8` é a mesma família de cor escurecida até passar em
 * AA sobre `background.paper` branco, mantendo `light`/`dark` do próprio tom
 * como degraus de hover/estado.
 *
 * `colorSchemeSelector: "class"` casa com `<InitColorSchemeScript
 * attribute="class" />` montado em `(internal)/layout.tsx`: o MUI alterna uma
 * classe `light`/`dark` no `<html>` (em vez do atributo `data-mui-color-scheme`
 * padrão) — o mesmo mecanismo usado por bibliotecas dark-mode baseadas em
 * classe, então o portal não introduz um segundo sistema de detecção de tema.
 */
export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: {
    dark: {
      palette: {
        mode: "dark",
        primary: {
          main: "#3ec6f0",
          light: "#35d9ff",
          dark: "#1f92b8",
          contrastText: "#04121a",
        },
        secondary: {
          main: "#f5a33c",
          light: "#ffb454",
          dark: "#c97c1f",
          contrastText: "#241300",
        },
        background: {
          default: "#05070b",
          paper: "#0a0e15",
        },
        text: {
          primary: "#f5f7fa",
          secondary: "rgba(245, 247, 250, 0.7)",
        },
        divider: "rgba(255, 255, 255, 0.12)",
      },
    },
    light: {
      palette: {
        mode: "light",
        primary: {
          main: "#0e7fa8",
          light: "#3ec6f0",
          dark: "#0a5f7d",
          contrastText: "#ffffff",
        },
        secondary: {
          main: "#c97c1f",
          light: "#f5a33c",
          dark: "#8f5810",
          contrastText: "#ffffff",
        },
        background: {
          default: "#f4f6f8",
          paper: "#ffffff",
        },
        text: {
          primary: "#0b1220",
          secondary: "rgba(11, 18, 32, 0.68)",
        },
        divider: "rgba(11, 18, 32, 0.12)",
      },
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    // Mesmas famílias do site público (`next/font` injeta as variáveis no
    // <html> do root layout — herdadas aqui mesmo dentro do route group
    // `(internal)`, que não redefine <html>/<body>).
    fontFamily: "var(--font-inter), sans-serif",
    h1: { fontFamily: "var(--font-poppins), var(--font-inter), sans-serif" },
    h2: { fontFamily: "var(--font-poppins), var(--font-inter), sans-serif" },
    h3: { fontFamily: "var(--font-poppins), var(--font-inter), sans-serif" },
    h4: { fontFamily: "var(--font-poppins), var(--font-inter), sans-serif" },
    h5: { fontFamily: "var(--font-poppins), var(--font-inter), sans-serif" },
    h6: { fontFamily: "var(--font-poppins), var(--font-inter), sans-serif" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});
