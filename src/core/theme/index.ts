import { enUS, ptBR } from "@mui/material/locale";
import { createTheme } from "@mui/material/styles";
import type { Locale } from "@/i18n/config";

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
 * O MESMO problema valia para `secondary` (âmbar): `#f5a33c` (a cor "bright"
 * da marca) tem ~3.3:1 sobre branco — abaixo de AA. `#b25e00` é a família do
 * âmbar escurecida até ~4.7:1 sobre `background.paper` branco; `light`/`dark`
 * do scheme claro usam os tons intermediário/mais escuro da mesma família
 * como degraus (não são reaproveitados do scheme dark, que usa os tons
 * "bright" originais da marca sobre fundo escuro, onde o contraste já é alto).
 *
 * `colorSchemeSelector: "class"` casa com `<InitColorSchemeScript
 * attribute="class" />` montado em `(internal)/layout.tsx`: o MUI alterna uma
 * classe `light`/`dark` no `<html>` (em vez do atributo `data-mui-color-scheme`
 * padrão) — o mesmo mecanismo usado por bibliotecas dark-mode baseadas em
 * classe, então o portal não introduz um segundo sistema de detecção de tema.
 *
 * ## Regra de densidade de campos (`size`)
 * `MuiTextField`/`MuiFormControl`/`MuiInputLabel` têm `defaultProps.size =
 * "medium"` abaixo — todo campo do portal nasce em altura confortável por
 * padrão (o feedback do stakeholder foi literal: "inputs de login estão
 * muito pequenos"). `size="small"` só é aceitável, de forma DELIBERADA, em
 * contextos de alta densidade onde o campo é secundário à leitura de dados
 * tabulares, nunca o único campo de uma tela ou de um formulário principal:
 *   - Filtros de listagem acima de uma tabela (busca/`Select` de categoria e
 *     status em `products-page-client.tsx`) — todos pequenos entre si, nunca
 *     misturado com um campo `medium` na mesma barra.
 *   - Campos inline DENTRO de uma linha de lista/tabela já editável em loco
 *     (embalagens em `product-form-dialog.tsx`; `alt` de imagem pendente em
 *     `product-images-manager.tsx`) — a linha inteira (inputs + ícones) é
 *     pequena, não só o campo de texto.
 *   - `Table`/`Chip`/`IconButton` continuam pequenos por escolha própria do
 *     componente (density de tabela, não input de formulário) — não são
 *     afetados por este default, que é só de `TextField`/`FormControl`.
 * Formulários "principais" (login, onboarding, dialog de produto, dialog de
 * revisão) usam o `size="medium"` do default — não declaram `size` no JSX.
 *
 * ## Locale dos textos internos do MUI
 * `createPortalTheme(locale)` aplica o pacote de tradução do MUI
 * (`@mui/material/locale`) por cima das `themeOptions` abaixo — cobre textos
 * que o MUI gera sozinho e não vêm de `portal.*` (ex.: "Rows per page"/
 * "Linhas por página" e o intervalo "X–Y of Z" do `TablePagination`). Não é
 * cópia nossa para hardcodar nem para forçar em uma chave de dicionário
 * (`portal.common.*` não tem uma string equivalente) — é estritamente a
 * tradução oficial do MUI para o `locale` da rota atual. `PortalProviders`
 * memoiza o resultado por `locale` (ver `portal-providers.tsx`).
 */
const themeOptions = {
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
          main: "#b25e00",
          light: "#c97c1f",
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
    // Consistência global de campo (ver "Regra de densidade" no comentário do
    // topo): todo `TextField`/`FormControl`/`InputLabel` nasce `medium` +
    // `fullWidth` + `outlined`; telas de alta densidade (filtros, linhas de
    // tabela) sobrescrevem `size="small"` explicitamente no próprio JSX.
    MuiTextField: {
      defaultProps: {
        size: "medium",
        fullWidth: true,
        variant: "outlined",
      },
    },
    MuiFormControl: {
      defaultProps: {
        size: "medium",
        fullWidth: true,
      },
    },
    MuiInputLabel: {
      defaultProps: {
        size: "medium",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // Altura confortável mesmo em `size="medium"` (o default do MUI já é
        // maior que `small`, mas o feedback foi literal sobre "robustez" —
        // um pouco mais de respiro vertical no texto do input). Só no
        // `medium`: os `size="small"` deliberados (filtros, linhas de
        // embalagem — ver "Regra de densidade" acima) precisam continuar
        // compactos, senão o padding extra os deixaria do mesmo tamanho do
        // `medium` e a distinção de densidade perderia o sentido.
        input: ({ ownerState }: { ownerState: { size?: "small" | "medium" } }) =>
          ownerState.size === "small"
            ? {}
            : {
                paddingTop: 14.5,
                paddingBottom: 14.5,
              },
      },
    },
  },
} as const;

/** `locale` da rota atual (`params.locale`, já validado contra `locales`). */
export function createPortalTheme(locale: Locale) {
  return createTheme(themeOptions, locale === "en" ? enUS : ptBR);
}

/** Instância default (pt) — mantida para compatibilidade; prefira
 *  `createPortalTheme(locale)` em código novo (ver `portal-providers.tsx`). */
export const theme = createPortalTheme("pt");
