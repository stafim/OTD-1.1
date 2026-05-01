import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ClipboardList, Clock, CheckCircle2, XCircle, Search, Building2, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
  pendente:   { label: "Pendente",    variant: "secondary",  icon: Clock },
  em_analise: { label: "Em Análise",  variant: "default",    icon: Search },
  aprovado:   { label: "Aprovado",    variant: "outline",    icon: CheckCircle2 },
  rejeitado:  { label: "Rejeitado",   variant: "destructive", icon: XCircle },
};

const statusOptions = [
  { value: "pendente",   label: "Pendente" },
  { value: "em_analise", label: "Em Análise" },
  { value: "aprovado",   label: "Aprovado" },
  { value: "rejeitado",  label: "Rejeitado" },
];

export default function SolicitacoesClientePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [editStatus, setEditStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/chassis-requests"],
    staleTime: 15_000,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; status: string; adminNotes: string }) =>
      apiRequest("PATCH", `/api/chassis-requests/${data.id}`, {
        status: data.status,
        adminNotes: data.adminNotes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chassis-requests"] });
      toast({ title: "Solicitação atualizada com sucesso" });
      setSelected(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (req: any) => {
    setSelected(req);
    setEditStatus(req.status);
    setAdminNotes(req.adminNotes || "");
  };

  const handleSave = () => {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, status: editStatus, adminNotes });
  };

  const pendingCount = (requests as any[]).filter((r: any) => r.status === "pendente").length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Solicitações de Chassi"
        breadcrumbs={[{ label: "Operação", href: "/" }, { label: "Solicitações Cliente" }]}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">Pedidos de Transporte dos Clientes</span>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" data-testid="badge-pending-count">
              {pendingCount} pendente(s)
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border rounded-lg bg-muted/10">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma solicitação recebida</p>
            <p className="text-xs mt-1">Quando clientes solicitarem transporte de chassi, aparecerá aqui.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Chassi</th>
                  <th className="text-left px-4 py-3 font-medium">Destino</th>
                  <th className="text-left px-4 py-3 font-medium">Observações</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-left px-4 py-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {(requests as any[]).map((req: any, idx: number) => {
                  const st = statusConfig[req.status] ?? { label: req.status, variant: "outline" as const, icon: Clock };
                  const StatusIcon = st.icon;
                  return (
                    <tr
                      key={req.id}
                      data-testid={`row-request-${req.id}`}
                      className={`border-t hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{req.clientName || req.clientId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-primary">{req.chassi}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        {req.deliveryAddress || "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground">
                        {req.notes || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={st.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {st.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {req.createdAt
                          ? format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-edit-${req.id}`}
                          onClick={() => openEdit(req)}
                        >
                          Atualizar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog de atualização */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Atualizar Solicitação
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20">Cliente:</span>
                  <span className="font-medium">{selected.clientName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-20">Chassi:</span>
                  <span className="font-mono font-bold text-primary">{selected.chassi}</span>
                </div>
                {selected.deliveryAddress && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20">Destino:</span>
                    <span>{selected.deliveryAddress}</span>
                  </div>
                )}
                {selected.notes && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-20">Obs:</span>
                    <span>{selected.notes}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resposta / Observações OTD</Label>
                <Textarea
                  data-testid="textarea-admin-notes"
                  placeholder="Informe ao cliente o andamento, data prevista, motorista designado..."
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-status"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
