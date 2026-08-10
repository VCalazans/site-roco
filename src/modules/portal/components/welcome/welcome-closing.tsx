import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type WelcomeClosingProps = {
  content: PortalDictionary["welcome"]["closing"];
};

/** Encerramento da página — os dois parágrafos em destaque tipográfico
 *  (fundo suave com o accent primário do tema, funciona nos dois schemes). */
export function WelcomeClosing({ content }: WelcomeClosingProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, sm: 4 },
        mt: 4,
        // Server Component: `sx` precisa ser objeto serializável (sem callback
        // de tema) — o canal RGB via CSS var acompanha o color scheme.
        bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.06)",
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h6" component="p" sx={{ fontWeight: 600 }}>
          {content.paragraph1}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {content.paragraph2}
        </Typography>
      </Stack>
    </Paper>
  );
}
