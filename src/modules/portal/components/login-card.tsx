"use client";

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
import { AuthCard } from "@/modules/portal/components/account/auth-card";

type LoginCardProps = {
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
}: {
  label: string;
  icon?: React.ReactNode;
  variant: "contained" | "outlined";
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
      disabled={pending}
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

export function LoginCard({
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
  google,
}: LoginCardProps) {
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
          <PendingButton label={signInButtonLabel} variant="contained" />
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
