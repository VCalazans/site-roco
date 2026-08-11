"use client";

import { useFormStatus } from "react-dom";
import Image from "next/image";
import NextLink from "next/link";
import GoogleIcon from "@mui/icons-material/Google";
import MuiLink from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type LoginCardProps = {
  /** `alt` do logotipo — reaproveita `dictionary.navigation.brand` ("ROCO"),
   *  já existente nos dois locales; não é copy nova a acrescentar. */
  logoAlt: string;
  title: string;
  subtitle: string;
  googleButtonLabel: string;
  disclaimer: string;
  emailLabel: string;
  passwordLabel: string;
  signInButtonLabel: string;
  orDividerLabel: string;
  /** Mensagem genérica de credencial inválida (via `?error=credentials`). */
  errorMessage?: string;
  /** CTA para o pré-cadastro público de representantes (`/{locale}/representantes`). */
  registerPrompt: string;
  registerLinkLabel: string;
  registerHref: string;
  /** Server Actions já com argumentos fixados via `.bind` (ver
   *  `login-action.ts` e `(internal)/portal/login/page.tsx`). */
  googleAction: (formData: FormData) => void | Promise<void>;
  credentialsAction: (formData: FormData) => void | Promise<void>;
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
  googleButtonLabel,
  disclaimer,
  emailLabel,
  passwordLabel,
  signInButtonLabel,
  orDividerLabel,
  errorMessage,
  registerPrompt,
  registerLinkLabel,
  registerHref,
  googleAction,
  credentialsAction,
}: LoginCardProps) {
  return (
    <Card variant="outlined" sx={{ width: "100%" }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
          {/* Logo branco: precisa de um fundo escuro fixo para ter contraste
              tanto no color scheme dark quanto no light do portal. */}
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

          <Stack spacing={0.5}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Stack>

          {errorMessage ? (
            <Alert severity="error" sx={{ width: "100%", textAlign: "left" }}>
              {errorMessage}
            </Alert>
          ) : null}

          {/* Campos em `size="medium"` (default global do tema — ver "Regra
              de densidade de campos" em `src/core/theme/index.ts`) com
              espaçamento generoso: o login é a porta de entrada do portal,
              nunca um formulário denso. */}
          <Box component="form" action={credentialsAction} sx={{ width: "100%" }}>
            <Stack spacing={2.5}>
              <TextField
                name="email"
                type="email"
                label={emailLabel}
                autoComplete="email"
                required
                fullWidth
              />
              <TextField
                name="password"
                type="password"
                label={passwordLabel}
                autoComplete="current-password"
                required
                fullWidth
              />
              <PendingButton label={signInButtonLabel} variant="contained" />
            </Stack>
          </Box>

          <Divider sx={{ width: "100%" }}>
            <Typography variant="caption" color="text.secondary">
              {orDividerLabel}
            </Typography>
          </Divider>

          <Box component="form" action={googleAction} sx={{ width: "100%" }}>
            <PendingButton
              label={googleButtonLabel}
              icon={<GoogleIcon />}
              variant="outlined"
            />
          </Box>

          <Typography variant="body2" color="text.secondary">
            {registerPrompt}{" "}
            <MuiLink component={NextLink} href={registerHref}>
              {registerLinkLabel}
            </MuiLink>
          </Typography>

          <Typography variant="caption" color="text.secondary">
            {disclaimer}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
