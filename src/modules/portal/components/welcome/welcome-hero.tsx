import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PortalLogo } from "@/modules/portal/components/shared/portal-logo";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type WelcomeHeroProps = {
  content: PortalDictionary["welcome"]["hero"];
  /** `dictionary.navigation.brand` — mesmo `alt` reaproveitado em
   *  `login-card.tsx`/`portal-shell.tsx`, não é copy nova. */
  logoAlt: string;
};

/**
 * Hero da página "Boas-vindas". Gradiente sutil ciano→âmbar via
 * `theme.palette.primary`/`secondary` (não hex soltos): funciona nos dois
 * `colorSchemes` porque lê a cor resolvida do tema em cada scheme.
 *
 * A logo com slogan usa a variante de cada esquema (`PortalLogo`: azul no
 * claro, branca no escuro) — o gradiente é translúcido sobre
 * `background.default`, então o contraste da logo acompanha o tema sem o
 * "chip" escuro fixo que a logo branca antiga exigia.
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
        <PortalLogo alt={logoAlt} variant="slogan" width={168} eager />

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
