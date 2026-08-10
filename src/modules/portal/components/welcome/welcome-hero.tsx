import Image from "next/image";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type WelcomeHeroProps = {
  content: PortalDictionary["welcome"]["hero"];
  /** `dictionary.navigation.brand` — mesmo `alt` reaproveitado em
   *  `portal-shell.tsx`/`login-card.tsx`, não é copy nova. */
  logoAlt: string;
};

/**
 * Hero da página "Boas-vindas". Gradiente sutil ciano→âmbar via
 * `theme.palette.primary`/`secondary` (não hex soltos): funciona nos dois
 * `colorSchemes` porque lê a cor resolvida do tema em cada scheme, em vez de
 * reusar os tokens "bright" fixos do dark mode (ver design system do
 * `login-card.tsx`, que precisou de um fundo escuro FIXO só para o logo
 * branco — aqui o logo fica sobre um chip com o mesmo tratamento).
 */
export function WelcomeHero({ content, logoAlt }: WelcomeHeroProps) {
  return (
    <Box
      sx={{
        borderRadius: 3,
        p: { xs: 3, sm: 5 },
        mb: 4,
        // `sx` como FUNÇÃO não pode cruzar a fronteira server → client
        // (este componente é Server Component). Com `cssVariables: true` no
        // tema, os canais RGB ficam disponíveis como CSS vars — o gradiente
        // continua acompanhando o color scheme sem callback de tema.
        background:
          "linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.16), rgba(var(--mui-palette-secondary-mainChannel) / 0.14))",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
        {/* Mesmo tratamento do logo branco em `login-card.tsx`: fundo escuro
            FIXO (não é um token do tema — é o logotipo em si que só existe em
            branco) para manter contraste nos dois `colorSchemes`. */}
        <Box
          sx={{
            bgcolor: "#05070b",
            borderRadius: "9999px",
            p: 1.5,
            display: "inline-flex",
          }}
        >
          <Image
            src="/images/hero/roco-logo.png"
            alt={logoAlt}
            width={40}
            height={40}
            priority
          />
        </Box>

        <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
          {content.title}
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400 }}>
          {content.subtitle}
        </Typography>
        <Typography variant="body1">{content.description}</Typography>
      </Stack>
    </Box>
  );
}
