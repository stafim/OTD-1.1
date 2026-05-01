import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Truck, Plus, ClipboardList, Clock, CheckCircle2, XCircle, Search } from "lucide-react";
import { clientFetch } from "@/hooks/use-client-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
  pendente:   { label: "Pendente",    variant: "secondary", icon: Clock },
  em_analise: { label: "Em Análise",  variant: "default",   icon: Search },
  aprovado:   { label: "Aprovado",    variant: "outline",   icon: CheckCircle2 },
  rejeitado:  { label: "Rejeitado",   variant: "destructive", icon: XCircle },
};

export default function PortalPedirChassPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ chassi: "", deliveryAddress: "", notes: "" });

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
    queryKey: ["/api/vehicles", "portal"],
    queryFn: async () => {
      const r = await clientFetch("/api/vehicles");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["/api/portal/chassis-requests"],
    queryFn: async () => {
      const r = await clientFetch("/api/portal/chassis-requests");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await clientFetch("/api/portal/chassis-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar solicitação");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/chassis-requests"] });
      toast({ title: "Solicitação enviada!", description: "A OTD Logistics foi notificada e analisará seu pedido." });
      setOpen(false);
      setForm({ chassi: "", deliveryAddress: "", notes: "" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chassi.trim()) {
      toast({ title: "Informe o chassi", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  // Veículos em estoque disponíveis para selecionar
  const availableVehicles = vehicles.filter((v: any) => v.status === "em_estoque");

  return (
    <PortalLayout>
      <div className="p-6 overflow-auto flex-1">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Pedir Chassi</h1>
          </div>
          <Button
            data-testid="button-nova-solicitacao"
            onClick={() => setOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Solicitação
          </Button>
        </div>

        <p className="text-muted-foreground mb-6 text-sm">
          Solicite à OTD Logistics o transporte de um veículo do seu estoque para o destino desejado.
        </p>

        {loadingRequests ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma solicitação ainda</p>
            <p className="text-xs mt-1">Clique em "Nova Solicitação" para pedir o transporte de um chassi.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(requests as any[]).map((req: any) => {
              const st = statusConfig[req.status] ?? { label: req.status, variant: "outline" as const, icon: Clock };
              const StatusIcon = st.icon;
              return (
                <Card key={req.id} data-testid={`card-request-${req.id}`} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-primary text-base">{req.chassi}</span>
                          <Badge variant={st.variant} className="gap-1 text-xs">
                            <StatusIcon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                        </div>
                        {req.deliveryAddress && (
                          <p className="text-sm text-muted-foreground truncate">
                            <span className="font-medium">Destino:</span> {req.deliveryAddress}
                          </p>
                        )}
                        {req.notes && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Obs:</span> {req.notes}
                          </p>
                        )}
                        {req.adminNotes && (
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            <span className="font-medium">OTD:</span> {req.adminNotes}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {req.createdAt
                            ? format(new Date(req.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog de nova solicitação */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Solicitar Transporte de Chassi
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chassi">Chassi *</Label>
              {availableVehicles.length > 0 ? (
                <select
                  id="chassi"
                  data-testid="select-chassi"
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.chassi}
                  onChange={e => setForm(p => ({ ...p, chassi: e.target.value }))}
                >
                  <option value="">Selecione um chassi...</option>
                  {availableVehicles.map((v: any) => (
                    <option key={v.chassi} value={v.chassi}>
                      {v.chassi}{v.model ? ` — ${v.model}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="chassi"
                  data-testid="input-chassi"
                  placeholder="Ex: 9BWZZZ377VT004251"
                  value={form.chassi}
                  onChange={e => setForm(p => ({ ...p, chassi: e.target.value }))}
                  required
                />
              )}
              {availableVehicles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {availableVehicles.length} veículo(s) disponível(is) em estoque
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Endereço de Entrega</Label>
              <Input
                id="deliveryAddress"
                data-testid="input-delivery-address"
                placeholder="Rua, número, cidade, estado..."
                value={form.deliveryAddress}
                onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                data-testid="textarea-notes"
                placeholder="Instruções especiais, prazo desejado, contato..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-request">
                {mutation.isPending ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
