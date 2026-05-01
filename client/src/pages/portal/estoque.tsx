import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "./layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package } from "lucide-react";
import { clientFetch } from "@/hooks/use-client-auth";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pre_estoque:      { label: "Pré-Estoque",      variant: "secondary" },
  em_estoque:       { label: "Em Estoque",        variant: "default" },
  em_transferencia: { label: "Em Transferência",  variant: "secondary" },
  despachado:       { label: "Despachado",        variant: "secondary" },
  entregue:         { label: "Entregue",          variant: "outline" },
  retirado:         { label: "Retirado",          variant: "outline" },
};

export default function PortalEstoquePage() {
  const [search, setSearch] = useState("");

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["/api/vehicles", "portal"],
    queryFn: () => clientFetch("/api/vehicles").then(r => r.json()),
    staleTime: 30_000,
  });

  const filtered = vehicles.filter((v: any) =>
    v.chassi?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="p-6 overflow-auto flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Estoque</h1>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            className="pl-9"
            placeholder="Buscar por chassi ou modelo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum veículo encontrado</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Chassi</th>
                  <th className="text-left px-4 py-3 font-medium">Pátio Atual</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Entrada no Pátio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v: any, idx: number) => {
                  const st = statusLabels[v.status] ?? { label: v.status, variant: "outline" as const };
                  return (
                    <tr
                      key={v.chassi}
                      data-testid={`row-vehicle-${v.chassi}`}
                      className={`border-t hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{v.chassi}</td>
                      <td className="px-4 py-3">{v.yardName || v.yardId || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {v.yardEntryDateTime
                          ? formatInTimeZone(new Date(v.yardEntryDateTime), 'UTC', "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">{filtered.length} veículo(s)</p>
      </div>
    </PortalLayout>
  );
}
