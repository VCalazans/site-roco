"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import NextLink from "next/link";
import GoogleIcon from "@mui/icons-material/Google";
import MuiLink from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Locale } from "@/i18n/config";
import { AuthCard } from "@/modules/portal/components/account/auth-card";
import { PortalTurnstileField } from "@/modules/portal/components/shared/portal-turnstile-field";
import type { PortalCaptchaMessages } from "@/modules/portal/lib/types";
import { useTurnstile } from "@/shared/components/turnstile/use-turnstile";
import { TURNSTILE_ACTIONS, TURNSTILE_TOKEN_FIELD } from "@/shared/lib/turnstile";

type LoginCardProps = {
  /** Idioma da página — o widget anti-robô (Turnstile) fala o mesmo. */
  locale: Locale;
  /** `alt` do logotipo — reaproveita `dictionary.navigation.brand` ("ROCO"),
   *  já existente nos dois locales; não é copy nova a acrescentar. */
  logoAlt: string;
  title: string;
  subtitle: string;
  disclaimer: string;
  emailLabel: string;
  passwordLabel: string;
  signInButtonLabel: string;
  /** Erro da última tentativa (`?error=`), já traduzido. */
  errorMessage?: string;
  /** Ação oferecida junto do erro (ex.: reenviar o e-mail de confirmação). */
  errorAction?: { href: string; label: string };
  /** Aviso de sucesso vindo de outra tela (`?notice=`), já traduzido. */
  noticeMessage?: string;
  forgotPassword: { href: string; label: string };
  /** CTA para o pré-cadastro público de representantes (`/{locale}/representantes`). */
  registerPrompt: string;
  registerLinkLabel: string;
  registerHref: string;
  credentialsAction: (formData: FormData) => void | Promise<void>;
  /** Textos da verificação anti-robô (`portal.login.captcha*`). */
  captchaMessages: Pick<PortalCaptchaMessages, "captcha" | "captchaPending" | "captchaLoad">;
  /** Login com Google — só aparece quando habilitado (`AUTH_GOOGLE_ENABLED`). */
  google?: {
    buttonLabel: string;
    orDividerLabel: string;
    action: (formData: FormData) => void | Promise<void>;
  };
};

function PendingButton({
  label,
  icon,
  variant,
  blocked = false,
}: {
  label: string;
  icon?: React.ReactNode;
  variant: "contained" | "outlined";
  /** Desabilitado também fora do envio (ex.: verificação anti-robô sem token). */
  blocked?: boolean;
}) {
  // useFormStatus só funciona dentro do <form> que usa `action` — é a razão
  // deste subcomponente existir separado de LoginCard.
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size="large"
      fullWidth
      disabled={pending || blocked}
      startIcon={pending ? <CircularProgress size={18} color="inherit" /> : icon}
      // `py` explícito: `size="large"` sozinho fica mais baixo que os campos
      // `medium` acima (que ganharam padding extra no tema — ver
      // `MuiOutlinedInput` em `src/core/theme/index.ts`); este ajuste alinha
      // a altura do botão de submit à altura confortável dos inputs.
      sx={{ py: 1.6 }}
    >
      {label}
    </Button>
  );
}

/**
 * Pede um token novo ao Turnstile quando o envio termina (`pending` volta a
 * `false`): o token é de uso único e já foi gasto no servidor. Rede de
 * segurança — hoje o redirect do login com erro (`?error=`) REMONTA o cartão
 * e o widget nasce de novo (conferido no navegador em 2026-10-12, inclusive
 * repetindo a mesma URL); se um dia o envio terminar sem remontar o
 * formulário, o próximo envio não leva o token velho, que seria recusado.
 */
function ResetTurnstileAfterSubmit({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      onSettled();
    }
  }, [pending, onSettled]);

  return null;
}

export function LoginCard({
  locale,
  logoAlt,
  title,
  subtitle,
  disclaimer,
  emailLabel,
  passwordLabel,
  signInButtonLabel,
  errorMessage,
  errorAction,
  noticeMessage,
  forgotPassword,
  registerPrompt,
  registerLinkLabel,
  registerHref,
  credentialsAction,
  captchaMessages,
  google,
}: LoginCardProps) {
  // Verificação anti-robô: o token vai num campo oculto do formulário e é
  // conferido no `authorize` do Auth.js (ver `@/core/auth`).
  const turnstile = useTurnstile();

  return (
    <AuthCard logoAlt={logoAlt} title={title} description={subtitle}>
      {noticeMessage ? (
        <Alert severity="success" sx={{ width: "100%", textAlign: "left" }}>
          {noticeMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" sx={{ width: "100%", textAlign: "left" }}>
          {errorMessage}
          {errorAction ? (
            <>
              {" "}
              <MuiLink component={NextLink} href={errorAction.href} color="inherit" sx={{ fontWeight: 600 }}>
                {errorAction.label}
              </MuiLink>
            </>
          ) : null}
        </Alert>
      ) : null}

      {/* Campos em `size="medium"` (default global do tema — ver "Regra
          de densidade de campos" em `src/core/theme/index.ts`) com
          espaçamento generoso: o login é a porta de entrada do portal,
          nunca um formulário denso. */}
      <Box component="form" action={credentialsAction} sx={{ width: "100%" }}>
        <Stack spacing={2.5}>
          <TextField name="email" type="email" label={emailLabel} autoComplete="email" required fullWidth />
          <TextField
            name="password"
            type="password"
            label={passwordLabel}
            autoComplete="current-password"
            required
            fullWidth
          />
          <MuiLink component={NextLink} href={forgotPassword.href} variant="body2" sx={{ alignSelf: "flex-end" }}>
            {forgotPassword.label}
          </MuiLink>
          <PortalTurnstileField
            turnstile={turnstile}
            action={TURNSTILE_ACTIONS.login}
            locale={locale}
            messages={captchaMessages}
          />
          {turnstile.enabled ? (
            <input type="hidden" name={TURNSTILE_TOKEN_FIELD} value={turnstile.token ?? ""} />
          ) : null}
          <ResetTurnstileAfterSubmit onSettled={turnstile.reset} />
          <PendingButton label={signInButtonLabel} variant="contained" blocked={turnstile.pending} />
        </Stack>
      </Box>

      {google ? (
        <>
          <Divider sx={{ width: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              {google.orDividerLabel}
            </Typography>
          </Divider>
          <Box component="form" action={google.action} sx={{ width: "100%" }}>
            <PendingButton label={google.buttonLabel} icon={<GoogleIcon />} variant="outlined" />
          </Box>
        </>
      ) : null}

      <Typography variant="body2" color="text.secondary">
        {registerPrompt}{" "}
        <MuiLink component={NextLink} href={registerHref}>
          {registerLinkLabel}
        </MuiLink>
      </Typography>

      <Typography variant="caption" color="text.secondary">
        {disclaimer}
      </Typography>
    </AuthCard>
  );
}
