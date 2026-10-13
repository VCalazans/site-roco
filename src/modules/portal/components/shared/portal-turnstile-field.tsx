"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import type { PortalCaptchaMessages } from "@/modules/portal/lib/types";
import { TurnstileWidget } from "@/shared/components/turnstile/turnstile-widget";
import type { TurnstileState } from "@/shared/components/turnstile/use-turnstile";
import type { TurnstileAction } from "@/shared/lib/turnstile";

type PortalTurnstileFieldProps = {
  turnstile: TurnstileState;
  action: TurnstileAction;
  locale: Locale;
  /** `portal.login` ou `portal.account.errors` — as mesmas chaves nos dois. */
  messages: Pick<PortalCaptchaMessages, "captcha" | "captchaPending" | "captchaLoad">;
};

/**
 * Verificação anti-robô das telas públicas do portal (MUI): o widget no tema
 * `auto` (segue o claro/escuro do visitante) e, logo abaixo, o motivo de o
 * botão ainda estar desabilitado. Sem site key no build não renderiza nada.
 */
export function PortalTurnstileField({ turnstile, action, locale, messages }: PortalTurnstileFieldProps) {
  if (!turnstile.enabled) return null;

  const status =
    turnstile.failure === "load"
      ? messages.captchaLoad
      : turnstile.failure === "challenge"
        ? messages.captcha
        : turnstile.pending
          ? messages.captchaPending
          : null;

  return (
    <Box sx={{ width: "100%" }}>
      <TurnstileWidget action={action} locale={locale} theme="auto" {...turnstile.widget} />
      {status ? (
        <Typography
          role={turnstile.failure ? "alert" : "status"}
          variant="caption"
          color={turnstile.failure ? "error" : "text.secondary"}
          sx={{ display: "block", mt: 1, textAlign: "left" }}
        >
          {status}
        </Typography>
      ) : null}
    </Box>
  );
}
