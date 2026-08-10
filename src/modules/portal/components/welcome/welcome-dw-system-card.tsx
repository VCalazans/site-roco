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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import type { PortalDictionary } from "@/modules/portal/lib/types";

type WelcomeDwSystemCardProps = {
  content: PortalDictionary["welcome"]["dwSystem"];
  icon: ReactNode;
  ctaIcon: ReactNode;
  comingSoonLabel: string;
};

/**
 * Card do Sistema DW — layout próprio (não o `WelcomeSectionCard` genérico)
 * porque tem uma lista de features (`dwSystem.features`, 4 itens) entre
 * intro/outro que os outros materiais não têm. O vídeo (`cta`) ainda não tem
 * asset no portal: botão desabilitado com `comingSoonLabel` como tooltip,
 * mesma regra dos demais materiais sem link real.
 */
export function WelcomeDwSystemCard({
  content,
  icon,
  ctaIcon,
  comingSoonLabel,
}: WelcomeDwSystemCardProps) {
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

          <Tooltip title={comingSoonLabel}>
            <span style={{ alignSelf: "flex-start" }}>
              <Button variant="outlined" startIcon={ctaIcon} disabled sx={{ alignSelf: "flex-start" }}>
                {content.cta}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </CardContent>
    </Card>
  );
}
