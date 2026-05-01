import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "./layout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin } from "lucide-react";
import { clientFetch } from "@/hooks/use-client-auth";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

const collectStatusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  em_transito:  { label: "Em Trânsito",  variant: "secondary" },
  autorizado:   { label: "Autorizado",   variant: "default" },
  finalizado:   { label: "Finalizado",   variant: "outline" },
  cancelado:    { label: "Cancelado",    variant: "destructive" },
};

const collectTypeLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  coleta:        { label: "Coleta",        variant: "secondary" },
  transferencia: { label: "Transferência", variant: "default" },
};

export default function PortalColetaPage() {
  const [search, setSearch] = useState("");

  const { data: collectsList = [], isLoading } = useQuery({
    queryKey: ["/api/collects", "portal"],
    queryFn: () => clientFetch("/api/collects").then(r => r.json()),
    staleTime: 30_000,
  });

  const filtered = collectsList.filter((c: any) =>
    c.vehicleChassi?.toLowerCase().includes(search.toLowerCase()) ||
    c.manufacturer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.yard?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PortalLayout>
      <div className="p-6 overflow-auto flex-1">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Coleta</h1>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            className="pl-9"
            placeholder="Buscar por chassi, montadora, pátio..."
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
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma coleta encontrada</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Chassi</th>
                  <th className="text-left px-4 py-3 font-medium">Montadora</th>
                  <th className="text-left px-4 py-3 font-medium">Pátio Destino</th>
                  <th className="text-left px-4 py-3 font-medium">Motorista</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Data Coleta</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any, idx: number) => {
                  const st = collectStatusLabels[c.collectStatus] ?? { label: c.collectStatus ?? "—", variant: "outline" as const };
                  const tp = collectTypeLabels[c.collectType] ?? { label: c.collectType ?? "—", variant: "outline" as const };
                  return (
                    <tr
                      key={c.id}
                      data-testid={`row-collect-${c.id}`}
                      className={`border-t hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <Badge variant={tp.variant}>{tp.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-primary">{c.vehicleChassi}</td>
                      <td className="px-4 py-3">{c.manufacturer?.name || "—"}</td>
                      <td className="px-4 py-3">{c.yard?.name || "—"}</td>
                      <td className="px-4 py-3">{c.driver ? `${c.driver.firstName} ${c.driver.lastName}` : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.collectDate
                          ? formatInTimeZone(new Date(c.collectDate), 'UTC', "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">{filtered.length} registro(s)</p>
      </div>
    </PortalLayout>
  );
}
