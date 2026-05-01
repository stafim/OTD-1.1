import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileWarning,
  Search,
  ClipboardList,
  User,
  Truck,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Download,
  CheckCircle2,
  CircleDot,
  RotateCcw,
  XCircle,
  Loader2,
  MessageSquare,
  UserCheck,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface JustifiedProposalRow {
  id: string;
  proposalId: string;
  proposalNumber: string | null;
  proposalStatus: string | null;
  driverId: string;
  driverName: string | null;
  driverCpf: string | null;
  assignedTransportId: string | null;
  transportRequestNumber: string | null;
  assignedByUserName: string | null;
  superiorDriversCount: number;
  rankJustification: string | null;
  caseStatus: string;
  caseNotes: string | null;
  caseClosedAt: string | null;
  caseClosedBy: string | null;
  caseClosedByName: string | null;
  respondedAt: string | null;
  createdAt: string | null;
}

const proposalStatusLabel: Record<string, string> = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

const proposalStatusColor: Record<string, string> = {
  ativa: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  encerrada: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cancelada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function RelatorioPropostasJustificadasPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "aberto" | "fechado">("todos");
  const [closeDialog, setCloseDialog] = useState<JustifiedProposalRow | null>(null);
  const [caseNotes, setCaseNotes] = useState("");

  const { data: rows = [], isLoading } = useQuery<JustifiedProposalRow[]>({
    queryKey: ["/api/reports/justified-proposals"],
    staleTime: 0,
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      apiRequest("PATCH", `/api/reports/justified-proposals/${id}/close`, { notes }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/reports/justified-proposals"] });
      setCloseDialog(null);
      setCaseNotes("");
      toast({ title: "Caso fechado com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro ao fechar caso", description: err.message, variant: "destructive" }),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/reports/justified-proposals/${id}/reopen`, {}),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/reports/justified-proposals"] });
      toast({ title: "Caso reaberto com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro ao reabrir caso", description: err.message, variant: "destructive" }),
  });

  const filtered = rows.filter(row => {
    if (statusFilter !== "todos" && row.caseStatus !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (row.proposalNumber ?? "").toLowerCase().includes(q) ||
      (row.driverName ?? "").toLowerCase().includes(q) ||
      (row.driverCpf ?? "").toLowerCase().includes(q) ||
      (row.transportRequestNumber ?? "").toLowerCase().includes(q) ||
      (row.rankJustification ?? "").toLowerCase().includes(q) ||
      (row.caseNotes ?? "").toLowerCase().includes(q)
    );
  });

  const abertos = rows.filter(r => r.caseStatus === "aberto").length;
  const fechados = rows.filter(r => r.caseStatus === "fechado").length;

  const exportCsv = () => {
    const headers = ["Proposta", "Status Proposta", "Motorista", "CPF", "Transporte", "Atribuído por", "Mot. Superiores Preteridos", "Justificativa", "Status Caso", "Considerações", "Fechado por", "Fechado em", "Data"];
    const csvRows = [
      headers.join(";"),
      ...filtered.map(row => [
        row.proposalNumber ?? "",
        proposalStatusLabel[row.proposalStatus ?? ""] ?? row.proposalStatus ?? "",
        row.driverName ?? "",
        row.driverCpf ?? "",
        row.transportRequestNumber ?? "",
        row.assignedByUserName ?? "",
        String(row.superiorDriversCount),
        `"${(row.rankJustification ?? "").replace(/"/g, '""')}"`,
        row.caseStatus === "fechado" ? "Fechado" : "Aberto",
        `"${(row.caseNotes ?? "").replace(/"/g, '""')}"`,
        row.caseClosedByName ?? "",
        row.caseClosedAt ? format(new Date(row.caseClosedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
        row.createdAt ? format(new Date(row.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
      ].join(";"))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propostas-justificadas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Propostas Justificadas"
        breadcrumbs={[
          { label: "Relatórios" },
          { label: "Propostas Justificadas" },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-count">{isLoading ? "—" : rows.length}</p>
                  <p className="text-xs text-muted-foreground">Total de casos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${statusFilter === "aberto" ? "ring-2 ring-orange-400" : "hover:bg-muted/30"}`}
            onClick={() => setStatusFilter(statusFilter === "aberto" ? "todos" : "aberto")}
            data-testid="card-filter-aberto"
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <CircleDot className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400" data-testid="text-abertos-count">{isLoading ? "—" : abertos}</p>
                  <p className="text-xs text-muted-foreground">Em aberto</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${statusFilter === "fechado" ? "ring-2 ring-green-400" : "hover:bg-muted/30"}`}
            onClick={() => setStatusFilter(statusFilter === "fechado" ? "todos" : "fechado")}
            data-testid="card-filter-fechado"
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-fechados-count">{isLoading ? "—" : fechados}</p>
                  <p className="text-xs text-muted-foreground">Fechados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900/30">
                  <ClipboardList className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "—" : new Set(rows.map(r => r.proposalId)).size}</p>
                  <p className="text-xs text-muted-foreground">Propostas afetadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por proposta, motorista, CPF, transporte ou justificativa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} data-testid="select-status-filter">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="fechado">Fechados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-amber-500" />
              Registros de Ranking Inferior com Justificativa
              {!isLoading && (
                <span className="ml-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2 py-0.5">
                  {filtered.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <FileWarning className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {search || statusFilter !== "todos"
                    ? "Nenhum resultado para os filtros aplicados."
                    : "Nenhuma proposta com justificativa de ranking inferior encontrada."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(row => {
                  const isFechado = row.caseStatus === "fechado";
                  return (
                    <div
                      key={row.id}
                      className={`p-4 transition-colors ${isFechado ? "bg-muted/20" : "hover:bg-muted/30"}`}
                      data-testid={`row-justified-${row.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Header: proposal + status badge + case badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/proposta-transporte/${row.proposalId}`}>
                              <span className="font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer text-sm flex items-center gap-1" data-testid={`link-proposal-${row.id}`}>
                                <ClipboardList className="h-3.5 w-3.5" />
                                {row.proposalNumber ?? row.proposalId.slice(0, 8)}
                              </span>
                            </Link>
                            {row.proposalStatus && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${proposalStatusColor[row.proposalStatus] ?? "bg-muted text-muted-foreground"}`}>
                                {proposalStatusLabel[row.proposalStatus] ?? row.proposalStatus}
                              </span>
                            )}
                            {row.transportRequestNumber && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Truck className="h-3 w-3" />
                                {row.transportRequestNumber}
                              </span>
                            )}
                            {/* Case status badge */}
                            {isFechado ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" data-testid={`badge-case-status-${row.id}`}>
                                <CheckCircle2 className="h-3 w-3" />
                                Fechado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" data-testid={`badge-case-status-${row.id}`}>
                                <CircleDot className="h-3 w-3" />
                                Aberto
                              </span>
                            )}
                          </div>

                          {/* Driver + assignment context */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium" data-testid={`text-driver-${row.id}`}>{row.driverName ?? "Motorista desconhecido"}</span>
                              {row.driverCpf && <span className="text-xs text-muted-foreground">{row.driverCpf}</span>}
                            </div>
                            {row.assignedByUserName && (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span className="text-xs text-muted-foreground">Atribuído por</span>
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300" data-testid={`text-assigned-by-${row.id}`}>{row.assignedByUserName}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                              <span className="text-xs text-muted-foreground">Motoristas superiores preteridos:</span>
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${row.superiorDriversCount > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "bg-muted text-muted-foreground"}`} data-testid={`text-superior-count-${row.id}`}>
                                {row.superiorDriversCount}
                              </span>
                            </div>
                          </div>

                          {/* Rank justification */}
                          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">Justificativa do operador:</p>
                              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed" data-testid={`text-justification-${row.id}`}>
                                {row.rankJustification}
                              </p>
                            </div>
                          </div>

                          {/* Case notes (if closed) */}
                          {isFechado && row.caseNotes && (
                            <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2 flex items-start gap-2">
                              <MessageSquare className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-0.5 flex flex-wrap items-center gap-1">
                                  <span>Considerações do fechamento</span>
                                  {row.caseClosedByName && (
                                    <span className="font-normal text-muted-foreground">por <span className="font-medium text-green-700 dark:text-green-400">{row.caseClosedByName}</span></span>
                                  )}
                                  {row.caseClosedAt && (
                                    <span className="font-normal text-muted-foreground">
                                      — {format(new Date(row.caseClosedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </span>
                                  )}
                                  <span>:</span>
                                </p>
                                <p className="text-xs text-green-800 dark:text-green-300 leading-relaxed" data-testid={`text-case-notes-${row.id}`}>
                                  {row.caseNotes}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions + date */}
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                          {row.createdAt && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(row.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          <Link href={`/proposta-transporte/${row.proposalId}`}>
                            <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 h-7 px-2" data-testid={`button-open-proposal-${row.id}`}>
                              <ExternalLink className="h-3.5 w-3.5 mr-1" />
                              Ver proposta
                            </Button>
                          </Link>
                          {isFechado ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
                              onClick={() => reopenMutation.mutate(row.id)}
                              disabled={reopenMutation.isPending}
                              data-testid={`button-reopen-${row.id}`}
                            >
                              {reopenMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                              Reabrir
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => { setCloseDialog(row); setCaseNotes(""); }}
                              data-testid={`button-close-case-${row.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Fechar caso
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Close case dialog */}
      <Dialog open={!!closeDialog} onOpenChange={(open) => { if (!open) { setCloseDialog(null); setCaseNotes(""); } }}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Fechar Caso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {closeDialog && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                <p><span className="font-medium">Proposta:</span> {closeDialog.proposalNumber}</p>
                <p><span className="font-medium">Motorista:</span> {closeDialog.driverName}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="case-notes" className="text-sm font-medium">
                Considerações do fechamento <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="case-notes"
                placeholder="Descreva o desfecho, análise ou decisão tomada para encerrar este caso..."
                value={caseNotes}
                onChange={e => setCaseNotes(e.target.value)}
                rows={4}
                className="resize-none"
                data-testid="input-case-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCloseDialog(null); setCaseNotes(""); }}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => closeDialog && closeMutation.mutate({ id: closeDialog.id, notes: caseNotes })}
              disabled={closeMutation.isPending}
              data-testid="button-confirm-close"
            >
              {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
