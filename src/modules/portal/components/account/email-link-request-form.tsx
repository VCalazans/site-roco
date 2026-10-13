"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { Locale } from "@/i18n/config";
import { PortalTurnstileField } from "@/modules/portal/components/shared/portal-turnstile-field";
import { accountErrorMessage, postAccount } from "@/modules/portal/lib/account-client";
import type { PortalAccountDictionary } from "@/modules/portal/lib/types";
import { useTurnstile } from "@/shared/components/turnstile/use-turnstile";
import { TURNSTILE_TOKEN_FIELD, type TurnstileAction } from "@/shared/lib/turnstile";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailLinkRequestFormProps = {
  /** Rota que envia o link (`ACCOUNT_API.forgotPassword` / `resendVerification`). */
  endpoint: string;
  /** Ação do Turnstile que a rota confere (`senha` / `confirmacao`). */
  captchaAction: TurnstileAction;
  locale: Locale;
  emailLabel: string;
  buttonLabel: string;
  /** Mensagem genérica de "enviado" — a mesma exista ou não a conta. */
  sentMessage: string;
  errors: PortalAccountDictionary["errors"];
  /** Chamado quando o pedido foi aceito (a tela pode trocar o título, por exemplo). */
  onSent?: () => void;
};

/**
 * "Informe seu e-mail e enviamos um link" — pedido de nova senha e reenvio da
 * confirmação de cadastro. A resposta do servidor é sempre genérica; a tela
 * também: nunca diz se o e-mail tem conta. O pedido passa pela verificação
 * anti-robô (Turnstile): o botão espera o token, e cada tentativa gasta o seu.
 */
export function EmailLinkRequestForm({
  endpoint,
  captchaAction,
  locale,
  emailLabel,
  buttonLabel,
  sentMessage,
  errors,
  onSent,
}: EmailLinkRequestFormProps) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");
  const turnstile = useTurnstile();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setFieldError(errors.invalidEmail);
      return;
    }
    if (turnstile.pending) return;
    setFieldError(null);
    setError(null);
    setPhase("sending");
    const result = await postAccount(endpoint, {
      email: value,
      locale,
      ...(turnstile.token ? { [TURNSTILE_TOKEN_FIELD]: turnstile.token } : {}),
    });
    // O token foi gasto nesta tentativa (deu certo ou não): pede outro.
    turnstile.reset();
    if (result.ok) {
      setPhase("sent");
      onSent?.();
      return;
    }
    setError(accountErrorMessage(result.error, errors));
    setPhase("idle");
  }

  if (phase === "sent") {
    return (
      <Alert severity="success" role="status" sx={{ width: "100%", textAlign: "left" }}>
        {sentMessage}
      </Alert>
    );
  }

  return (
    <Stack component="form" noValidate onSubmit={handleSubmit} spacing={2.5} sx={{ width: "100%" }}>
      {error ? (
        <Alert severity="error" sx={{ textAlign: "left" }}>
          {error}
        </Alert>
      ) : null}
      <TextField
        type="email"
        label={emailLabel}
        autoComplete="email"
        required
        fullWidth
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setFieldError(null);
        }}
        error={Boolean(fieldError)}
        helperText={fieldError ?? undefined}
      />
      <PortalTurnstileField turnstile={turnstile} action={captchaAction} locale={locale} messages={errors} />
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={phase === "sending" || turnstile.pending}
        startIcon={phase === "sending" ? <CircularProgress size={18} color="inherit" /> : undefined}
        sx={{ py: 1.6 }}
      >
        {buttonLabel}
      </Button>
    </Stack>
  );
}
