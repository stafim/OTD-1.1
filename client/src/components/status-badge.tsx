import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type VehicleStatus = "pre_estoque" | "em_estoque" | "despachado" | "entregue" | "retirado";
type TransportStatus = "pendente" | "pendente_aprovacao" | "aguardando_saida" | "em_transito" | "entregue" | "cancelado";
type CollectStatus = "em_transito" | "autorizado_portaria" | "finalizada";
type NotificationStatus = "pendente" | "aceito" | "recusado";

type StatusType = VehicleStatus | TransportStatus | CollectStatus | NotificationStatus;

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pre_estoque: { label: "Pré-estoque", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  em_estoque: { label: "Em estoque", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  despachado: { label: "Despachado", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  entregue: { label: "Entregue", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  retirado: { label: "Retirado", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  pendente: { label: "Pendente", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  pendente_aprovacao: { label: "Pendente Aprovação", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400" },
  aguardando_saida: { label: "Aguardando Saída", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  em_transito: { label: "Em trânsito", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  autorizado_portaria: { label: "Autorizado Portaria", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400" },
  finalizada: { label: "Finalizada", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  aceito: { label: "Aceito", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  recusado: { label: "Recusado", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "" };

  return (
    <Badge
      variant="outline"
      className={cn("border-0 font-medium", config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}
