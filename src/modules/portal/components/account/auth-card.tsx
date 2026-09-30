import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PortalLogo } from "@/modules/portal/components/shared/portal-logo";

/**
 * Moldura das telas de autenticação do portal (login, confirmar e-mail,
 * esqueci a senha, nova senha): página centralizada no fundo do tema.
 */
export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
        py: 4,
      }}
    >
      <Container maxWidth="xs">{children}</Container>
    </Box>
  );
}

type AuthCardProps = {
  /** `alt` do logotipo (`dictionary.navigation.brand`). */
  logoAlt: string;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Cartão das telas de autenticação: logo com slogan (azul no tema claro,
 * branca no escuro — ver `PortalLogo`), título, descrição e o conteúdo.
 */
export function AuthCard({ logoAlt, title, description, children }: AuthCardProps) {
  return (
    <Card variant="outlined" sx={{ width: "100%" }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
          <PortalLogo alt={logoAlt} variant="slogan" width={168} eager />
          <Stack spacing={0.5}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {description ? (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            ) : null}
          </Stack>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
