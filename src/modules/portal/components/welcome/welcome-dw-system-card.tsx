import type { ReactNode } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type WelcomeDwSystemCardProps = {
  content: PortalDictionary["welcome"]["dwSystem"];
  icon: ReactNode;
};

/**
 * Card do Sistema DW — layout próprio (não o `WelcomeSectionCard` genérico)
 * porque tem uma lista de features (`dwSystem.features`, 4 itens) entre
 * intro/outro que os outros materiais não têm. O CTA de vídeo (`cta`, que
 * era sempre desabilitado — "Em breve") saiu do dicionário: o vídeo do
 * Sistema DW passa a ser só mais um item publicável no feed de materiais
 * (`WelcomeMaterialsFeed`), como qualquer outro. Ver decisionLog 2026-08-24
 * ("Materiais dinâmicos para representantes").
 */
export function WelcomeDwSystemCard({ content, icon }: WelcomeDwSystemCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Stack spacing={0.5}>
            <Typography variant="h6" component="h2">
              {content.title}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              {content.subtitle}
            </Typography>
          </Stack>

          <Typography variant="body2">{content.intro}</Typography>

          <List disablePadding>
            {content.features.map((feature) => (
              <ListItem key={feature} disableGutters>
                <ListItemIcon sx={{ minWidth: 32, color: "success.main" }}>
                  <CheckCircleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={feature} />
              </ListItem>
            ))}
          </List>

          <Typography variant="body2" color="text.secondary">
            {content.outro}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
