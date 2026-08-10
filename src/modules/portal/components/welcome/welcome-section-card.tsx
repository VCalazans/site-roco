import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

type WelcomeSectionCardProps = {
  icon: ReactNode;
  title: string;
  body: string;
  /** `undefined` = seção puramente informativa, sem CTA (ex.: "Conheça a
   *  ROCO", que não tem `cta` no dicionário) — nenhum botão é renderizado. */
  ctaLabel?: string;
  ctaIcon?: ReactNode;
  /** `null`/`undefined` = material ainda sem asset no portal (`disabled` +
   *  `comingSoonLabel` como tooltip/legenda). Nunca invente uma URL aqui. */
  href?: string | null;
  /** Força download em vez de abrir em nova aba — só o catálogo (PDF
   *  publicado em `public/downloads/`) usa isto hoje. */
  download?: boolean;
  comingSoonLabel: string;
};

/**
 * Card de uma seção de material de apoio da página de boas-vindas. Layout
 * próprio do design system do portal (não é uma cópia do visual do RD
 * Station): ícone MUI + título + corpo + CTA, sempre no mesmo `Card`
 * `variant="outlined"` usado no resto do portal (dashboard, onboarding).
 */
export function WelcomeSectionCard({
  icon,
  title,
  body,
  ctaLabel,
  ctaIcon,
  href,
  download,
  comingSoonLabel,
}: WelcomeSectionCardProps) {
  const isAvailable = Boolean(href);

  // Dois `Button` distintos (não um só com props condicionais): o overload de
  // tipos do MUI exige `href` como `string` firme quando presente — não
  // aceita `string | undefined` mesmo controlado por `disabled`.
  const button = !ctaLabel ? null : isAvailable ? (
    <Button
      variant="contained"
      startIcon={ctaIcon}
      href={href as string}
      target={download ? undefined : "_blank"}
      rel={download ? undefined : "noopener noreferrer"}
      download={download}
      sx={{ alignSelf: "flex-start" }}
    >
      {ctaLabel}
    </Button>
  ) : (
    <Button variant="outlined" startIcon={ctaIcon} disabled sx={{ alignSelf: "flex-start" }}>
      {ctaLabel}
    </Button>
  );

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%" }}>
        <Stack spacing={2} sx={{ height: "100%" }}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Stack spacing={1} sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {body}
            </Typography>
          </Stack>
          {/* Tooltip em disabled: `Button` desabilitado não dispara eventos de
              ponteiro — o `span` "pega" o hover para o Tooltip funcionar. */}
          {!button ? null : isAvailable ? (
            button
          ) : (
            <Tooltip title={comingSoonLabel}>
              <span style={{ alignSelf: "flex-start" }}>{button}</span>
            </Tooltip>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
