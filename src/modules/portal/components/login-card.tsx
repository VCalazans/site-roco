"use client";

import { useFormStatus } from "react-dom";
import Image from "next/image";
import GoogleIcon from "@mui/icons-material/Google";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type LoginCardProps = {
  /** `alt` do logotipo — reaproveita `dictionary.navigation.brand` ("ROCO"),
   *  já existente nos dois locales; não é copy nova a acrescentar. */
  logoAlt: string;
  title: string;
  subtitle: string;
  googleButtonLabel: string;
  disclaimer: string;
  /** Server Action já com `callbackUrl` fixado via `.bind` (ver
   *  `login-action.ts` e `(internal)/portal/login/page.tsx`). */
  action: (formData: FormData) => void | Promise<void>;
};

function GoogleSubmitButton({ label }: { label: string }) {
  // useFormStatus só funciona dentro do <form> que usa `action` — é a razão
  // deste subcomponente existir separado de LoginCard.
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="contained"
      size="large"
      fullWidth
      disabled={pending}
      startIcon={
        pending ? (
          <CircularProgress size={18} color="inherit" />
        ) : (
          <GoogleIcon />
        )
      }
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
  action,
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

          <Box component="form" action={action} sx={{ width: "100%" }}>
            <GoogleSubmitButton label={googleButtonLabel} />
          </Box>

          <Typography variant="caption" color="text.secondary">
            {disclaimer}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
