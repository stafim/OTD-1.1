import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "./layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Truck } from "lucide-react";
import { clientFetch } from "@/hooks/use-client-auth";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const transportStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendente:            { label: "Pendente",          variant: "secondary" },
  aguardando_saida:    { label: "Aguardando Saída",  variant: "secondary" },
  em_transito:         { label: "Em Trânsito",       variant: "default" },
  entregue:            { label: "Entregue",          variant: "outline" },
  cancelado:           { label: "Cancelado",         variant: "destructive" },
};

export default function PortalTransportePage() {
  const [search, setSearch] = useState("");

  const { data: transportsList = [], isLoading } = useQuery({
    queryKey: ["/api/transports", "portal"],
    queryFn: () => clientFetch("/api/transports").then(r => r.json()),
    staleTime: 30_000,
  });

  const filtered = transportsList.filter((t: any) =>
    t.vehicleChassi?.toLowerCase().includes(search.toLowerCase()) ||
    t.requestNumber?.toLowerCase().includes(search.toLowerCase()) ||
    t.driver?.firstName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="p-6 overflow-auto flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Transporte</h1>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            className="pl-9"
            placeholder="Buscar por chassi, número, motorista..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum transporte encontrado</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Chassi</th>
                  <th className="text-left px-4 py-3 font-medium">Nº Pedido</th>
                  <th className="text-left px-4 py-3 font-medium">Pátio Origem</th>
                  <th className="text-left px-4 py-3 font-medium">Destino</th>
                  <th className="text-left px-4 py-3 font-medium">Motorista</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any, idx: number) => {
                  const st = transportStatusLabels[t.status] ?? { label: t.status ?? "—", variant: "outline" as const };
                  return (
                    <tr
                      key={t.id}
                      data-testid={`row-transport-${t.id}`}
                      className={`border-t hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{t.vehicleChassi}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.requestNumber || "—"}</td>
                      <td className="px-4 py-3">{t.originYard?.name || "—"}</td>
                      <td className="px-4 py-3">{t.deliveryLocation?.name || "—"}</td>
                      <td className="px-4 py-3">
                        {t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.deliveryDate
                          ? formatInTimeZone(new Date(t.deliveryDate), 'UTC', "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">{filtered.length} transporte(s)</p>
      </div>
    </PortalLayout>
  );
}
