import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldAlert,
  Search,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Clock,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DeletionRequestRow {
  id: string;
  driverId: string;
  channel: string;
  notes: string | null;
  status: "em_aberto" | "concluido";
  completionNotes: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  completedByUserName: string | null;
  requestedByUserId: string | null;
  requestedByUserName: string | null;
  createdAt: string;
  driverName: string;
  driverCpf: string;
  driverPhone: string;
}

const channelLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  telefone: "Telefone",
  app: "Aplicativo",
  presencial: "Presencial",
  outro: "Outro",
};

export default function DriverDeletionRequestsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [completing, setCompleting] = useState<DeletionRequestRow | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [reopening, setReopening] = useState<DeletionRequestRow | null>(null);

  const { data: requests, isLoading } = useQuery<DeletionRequestRow[]>({
    queryKey: ["/api/driver-deletion-requests"],
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      completionNotes: notes,
    }: {
      id: string;
      status: "em_aberto" | "concluido";
      completionNotes?: string;
    }) =>
      apiRequest("PATCH", `/api/driver-deletion-requests/${id}`, {
        status,
        completionNotes: notes,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-deletion-requests"] });
      toast({
        title:
          variables.status === "concluido"
            ? "Solicitação concluída"
            : "Solicitação reaberta",
      });
      setCompleting(null);
      setCompletionNotes("");
      setReopening(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar solicitação", variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!requests) return [];
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter(
      (r) =>
        r.driverName?.toLowerCase().includes(term) ||
        r.driverCpf?.toLowerCase().includes(term) ||
        r.channel?.toLowerCase().includes(term) ||
        (r.requestedByUserName ?? "").toLowerCase().includes(term),
    );
  }, [requests, search]);

  const stats = useMemo(() => {
    const total = requests?.length ?? 0;
    const open = requests?.filter((r) => r.status === "em_aberto").length ?? 0;
    const done = requests?.filter((r) => r.status === "concluido").length ?? 0;
    return { total, open, done };
  }, [requests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informe de Exclusão LGPD"
        description="Solicitações de exclusão de motoristas registradas em conformidade com a LGPD"
        icon={ShieldAlert}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold" data-testid="stat-total">{stats.total}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em aberto</p>
                <p className="text-2xl font-bold text-amber-600" data-testid="stat-open">{stats.open}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-emerald-600" data-testid="stat-done">{stats.done}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Solicitações</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mostrando: <span data-testid="text-total-requests" className="font-medium">{filtered.length}</span>
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por motorista, CPF, canal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-deletion-requests"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma solicitação de exclusão registrada.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>Registrado por</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} data-testid={`row-deletion-request-${r.id}`}>
                      <TableCell className="text-sm whitespace-nowrap" data-testid={`text-date-${r.id}`}>
                        {format(new Date(r.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`text-driver-name-${r.id}`}>
                        {r.driverName || "(motorista removido)"}
                      </TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-driver-cpf-${r.id}`}>
                        {r.driverCpf}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-channel-${r.id}`}>
                          {channelLabels[r.channel] ?? r.channel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-xs">
                        {r.notes ? (
                          <span className="line-clamp-2" title={r.notes}>
                            <MessageSquare className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
                            {r.notes}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-requested-by-${r.id}`}>
                        {r.requestedByUserName || "—"}
                      </TableCell>
                      <TableCell>
                        {r.status === "concluido" ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-300 w-fit gap-1"
                              data-testid={`badge-status-${r.id}`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Concluído
                            </Badge>
                            {r.completedAt && (
                              <span className="text-xs text-muted-foreground" title={r.completionNotes ?? undefined}>
                                {format(new Date(r.completedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                {r.completedByUserName ? ` • ${r.completedByUserName}` : ""}
                              </span>
                            )}
                            {r.completionNotes && (
                              <span className="text-xs text-muted-foreground italic line-clamp-2 max-w-[220px]" title={r.completionNotes}>
                                "{r.completionNotes}"
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge
                            className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-300 gap-1"
                            data-testid={`badge-status-${r.id}`}
                          >
                            <Clock className="h-3 w-3" />
                            Em aberto
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.driverId && r.driverName && (
                            <Link href={`/motoristas/${r.driverId}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Abrir cadastro do motorista"
                                data-testid={`button-open-driver-${r.id}`}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                          {r.status === "em_aberto" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => {
                                setCompleting(r);
                                setCompletionNotes("");
                              }}
                              data-testid={`button-complete-${r.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Concluir
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setReopening(r)}
                              data-testid={`button-reopen-${r.id}`}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Reabrir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!completing} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent data-testid="dialog-complete-request">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Concluir solicitação
            </DialogTitle>
            <DialogDescription>
              Marcar como concluída a solicitação de exclusão de{" "}
              <strong>{completing?.driverName}</strong>. Informe uma observação descrevendo
              o atendimento (ex.: dados anonimizados, cadastro removido, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="completion-notes">Observação da conclusão *</Label>
            <Textarea
              id="completion-notes"
              placeholder="Descreva como a solicitação foi atendida..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={4}
              data-testid="input-completion-notes"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompleting(null)}
              data-testid="button-cancel-complete"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!completionNotes.trim() || updateMutation.isPending}
              onClick={() =>
                completing &&
                updateMutation.mutate({
                  id: completing.id,
                  status: "concluido",
                  completionNotes: completionNotes.trim(),
                })
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-confirm-complete"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Marcar como concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reopening} onOpenChange={(open) => !open && setReopening(null)}>
        <DialogContent data-testid="dialog-reopen-request">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reabrir solicitação
            </DialogTitle>
            <DialogDescription>
              A solicitação de <strong>{reopening?.driverName}</strong> voltará para o
              status "Em aberto". A observação de conclusão anterior será removida.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReopening(null)}
              data-testid="button-cancel-reopen"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={() =>
                reopening &&
                updateMutation.mutate({ id: reopening.id, status: "em_aberto" })
              }
              data-testid="button-confirm-reopen"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
