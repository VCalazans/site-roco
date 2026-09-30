"use client";

import { useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { Locale } from "@/i18n/config";
import { accountErrorMessage, postAccount } from "@/modules/portal/lib/account-client";
import type { PortalAccountDictionary } from "@/modules/portal/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailLinkRequestFormProps = {
  /** Rota que envia o link (`ACCOUNT_API.forgotPassword` / `resendVerification`). */
  endpoint: string;
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
 * também: nunca diz se o e-mail tem conta.
 */
export function EmailLinkRequestForm({
  endpoint,
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setFieldError(errors.invalidEmail);
      return;
    }
    setFieldError(null);
    setError(null);
    setPhase("sending");
    const result = await postAccount(endpoint, { email: value, locale });
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
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={phase === "sending"}
        startIcon={phase === "sending" ? <CircularProgress size={18} color="inherit" /> : undefined}
        sx={{ py: 1.6 }}
      >
        {buttonLabel}
      </Button>
    </Stack>
  );
}
