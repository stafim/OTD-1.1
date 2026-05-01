import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardCheck, CheckCircle2, XCircle, Truck, User, Building2,
  DollarSign, Calendar, Hash, AlertCircle, Loader2, Users,
  ArrowRight, MapPin, Route, History, FileText,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

const RATE_TYPE_LABELS: Record<string, string> = {
  por_km: "Por Km",
  fixo: "Fixo",
  por_veiculo: "Por Veículo",
};

function formatCurrency(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

interface RouteHistoryEntry {
  id: string;
  requestNumber: string;
  createdAt: string | null;
  status: string;
  travelRateApprovalStatus: string | null;
  rateName: string | null;
}

interface ApprovalTransport {
  id: string;
  requestNumber: string;
  vehicleChassi: string;
  status: string;
  travelRateApprovalStatus: string | null;
  travelRateApprovalNote: string | null;
  travelRateApprovedAt: string | null;
  createdAt: string | null;
  client: { id: string; name: string } | null;
  originYard: { id: string; name: string; city: string; state: string } | null;
  deliveryLocation: { id: string; name: string; city: string; state: string } | null;
  travelRate: {
    id: string;
    name: string;
    rateType: string;
    rateValue: string;
    requiresApproval: string;
  } | null;
  createdByUser: { id: string; name: string; username: string; role: string } | null;
  rateApprovers: Array<{ id: string; userId: string; userName: string; userEmail: string }>;
  routeHistory: RouteHistoryEntry[];
  routeCount: number;
}

interface ApprovalProposal {
  id: string;
  proposalNumber: string | null;
  originYard?: { id: string; name: string; city: string; state: string } | null;
  client?: { id: string; name: string } | null;
  deliveryLocation?: { id: string; name: string; city: string; state: string } | null;
  travelRate?: { id: string; name: string; rateType: string; rateValue: string; requiresApproval: string } | null;
  rateApprovalStatus: string | null;
  rateApprovalNote: string | null;
  rateApprovedAt: string | null;
  totalSlots: number;
  startDate: string | null;
  createdAt: string | null;
}

export default function AprovacaoTarifaPage() {
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"aprovar" | "rejeitar" | null>(null);
  const [actionSource, setActionSource] = useState<"transport" | "proposal">("transport");
  const [note, setNote] = useState("");
  const { toast } = useToast();

  const { data: pendingApprovals, isLoading } = useQuery<ApprovalTransport[]>({
    queryKey: ["/api/transport-rate-approvals"],
  });

  const { data: pendingProposals, isLoading: isLoadingProposals } = useQuery<ApprovalProposal[]>({
    queryKey: ["/api/proposal-rate-approvals"],
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note: string }) =>
      apiRequest("PATCH", actionSource === "proposal" ? `/api/transport-proposals/${id}/rate-approval` : `/api/transports/${id}/rate-approval`, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-rate-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposal-rate-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transport-proposals"] });
      toast({
        title: actionType === "aprovar" ? "Tarifa aprovada com sucesso!" : "Tarifa rejeitada",
      });
      setActionId(null);
      setActionType(null);
      setNote("");
    },
    onError: () => {
      toast({ title: "Erro ao processar aprovação", variant: "destructive" });
    },
  });

  const handleAction = (id: string, type: "aprovar" | "rejeitar", source: "transport" | "proposal" = "transport") => {
    setActionId(id);
    setActionType(type);
    setActionSource(source);
    setNote("");
  };

  const handleConfirm = () => {
    if (!actionId || !actionType) return;
    approveMutation.mutate({
      id: actionId,
      status: actionType === "aprovar" ? "aprovado" : "rejeitado",
      note,
    });
  };

  const activeTransport = pendingApprovals?.find((t) => t.id === actionId);
  const activeProposal = pendingProposals?.find((p) => p.id === actionId);
  const activeItem = actionSource === "proposal" ? activeProposal : activeTransport;
  const activeLabel = actionSource === "proposal"
    ? `Proposta ${activeProposal?.proposalNumber || `#${activeProposal?.id?.slice(0, 8) ?? ""}`}`
    : `Transporte #${activeTransport?.requestNumber ?? ""}`;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Aprovação de Tarifa"
        description="Transportes aguardando aprovação de tarifa diferente da padrão"
      />

      <div className="p-6 flex-1">
        <Tabs defaultValue="transportes">
          <TabsList className="mb-4">
            <TabsTrigger value="transportes" className="gap-1.5">
              <Truck className="h-4 w-4" />
              Transportes
              {pendingApprovals && pendingApprovals.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{pendingApprovals.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="propostas" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Propostas
              {pendingProposals && pendingProposals.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{pendingProposals.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transportes">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !pendingApprovals || pendingApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">Nenhuma aprovação pendente</h3>
            <p className="text-muted-foreground mt-1">Todos os transportes com tarifas especiais já foram analisados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {pendingApprovals.length} transporte{pendingApprovals.length !== 1 ? "s" : ""} aguardando sua aprovação
            </p>

            {pendingApprovals.map((t) => (
              <Card key={t.id} className="border-l-4 border-l-orange-400" data-testid={`card-approval-${t.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-base">
                        Transporte #{t.requestNumber}
                      </CardTitle>
                      <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                        Aguardando Aprovação
                      </Badge>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                        onClick={() => handleAction(t.id, "rejeitar")}
                        data-testid={`button-reject-${t.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleAction(t.id, "aprovar")}
                        data-testid={`button-approve-${t.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Dados do transporte */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transporte</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">Chassi:</span>
                          <span className="font-mono">{t.vehicleChassi}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">Cliente:</span>
                          <span>{t.client?.name ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">Pátio Origem:</span>
                          <span>{t.originYard ? `${t.originYard.name}` : "—"}</span>
                        </div>
                        {t.createdAt && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">Criado em:</span>
                            <span>{format(new Date(t.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                          </div>
                        )}
                        {t.createdByUser && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium">Criado por:</span>
                            <span>{t.createdByUser.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tarifa selecionada */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarifa Selecionada</p>
                      {t.travelRate ? (
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-orange-600" />
                            <span className="font-semibold text-orange-700 dark:text-orange-400">{t.travelRate.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">
                              {RATE_TYPE_LABELS[t.travelRate.rateType] ?? t.travelRate.rateType}
                            </Badge>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(t.travelRate.rateValue)}
                              {t.travelRate.rateType === "por_km" && <span className="text-xs font-normal text-muted-foreground">/km</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-orange-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Tarifa especial — requer aprovação
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nenhuma tarifa especificada</p>
                      )}
                    </div>

                    {/* Aprovadores */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Aprovadores desta Tarifa ({t.rateApprovers.length})
                      </p>
                      {t.rateApprovers.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span className="text-xs">Nenhum aprovador cadastrado para esta tarifa. Qualquer usuário pode aprovar.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {t.rateApprovers.map((a) => (
                            <div key={a.userId} className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">{getInitials(a.userName)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{a.userName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Histórico do trecho */}
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Route className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico do Trecho</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="font-medium text-blue-700 dark:text-blue-400">
                          {t.originYard ? `${t.originYard.name} — ${t.originYard.city}/${t.originYard.state}` : "—"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <MapPin className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          {t.deliveryLocation ? `${t.deliveryLocation.name} — ${t.deliveryLocation.city}/${t.deliveryLocation.state}` : "—"}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                          data-testid={`badge-route-count-${t.id}`}
                        >
                          <History className="h-3 w-3 mr-1" />
                          {t.routeCount === 0
                            ? "1ª vez neste trecho"
                            : `${t.routeCount} viagem${t.routeCount !== 1 ? "ns" : ""} anterior${t.routeCount !== 1 ? "es" : ""}`}
                        </Badge>
                      </div>
                    </div>

                    {t.routeHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-1">
                        Nenhuma viagem anterior registrada neste trecho.
                      </p>
                    ) : (
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Transporte</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Data</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tarifa</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Status</th>
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Aprovação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.routeHistory.map((h, idx) => (
                              <tr key={h.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                <td className="px-3 py-2 font-mono font-medium">#{h.requestNumber}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {h.createdAt ? format(new Date(h.createdAt), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                                </td>
                                <td className="px-3 py-2">{h.rateName ?? <span className="text-muted-foreground italic">Padrão</span>}</td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={h.status as any} />
                                </td>
                                <td className="px-3 py-2">
                                  {h.travelRateApprovalStatus ? (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      h.travelRateApprovalStatus === "aprovado"
                                        ? "bg-green-100 text-green-700"
                                        : h.travelRateApprovalStatus === "rejeitado"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}>
                                      {h.travelRateApprovalStatus === "aprovado" ? "Aprovado" : h.travelRateApprovalStatus === "rejeitado" ? "Rejeitado" : "Pendente"}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>

          <TabsContent value="propostas">
            {isLoadingProposals ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !pendingProposals || pendingProposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">Nenhuma proposta pendente</h3>
                <p className="text-muted-foreground mt-1">Todas as propostas com tarifas especiais já foram analisadas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {pendingProposals.length} proposta{pendingProposals.length !== 1 ? "s" : ""} aguardando aprovação
                </p>

                {pendingProposals.map((p) => (
                  <Card key={p.id} className="border-l-4 border-l-amber-400" data-testid={`card-proposal-approval-${p.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-amber-500" />
                          <CardTitle className="text-base">
                            Proposta {p.proposalNumber || `#${p.id.slice(0, 8)}`}
                          </CardTitle>
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            Aguardando Aprovação
                          </Badge>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                            onClick={() => handleAction(p.id, "rejeitar", "proposal")}
                            data-testid={`button-reject-proposal-${p.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAction(p.id, "aprovar", "proposal")}
                            data-testid={`button-approve-proposal-${p.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proposta</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">Cliente:</span>
                              <span>{p.client?.name ?? "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">Pátio Origem:</span>
                              <span>{p.originYard ? p.originYard.name : "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">Slots:</span>
                              <span>{p.totalSlots}</span>
                            </div>
                            {p.startDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Data início:</span>
                                <span>{format(new Date(p.startDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                              </div>
                            )}
                            {p.createdAt && (
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Criado em:</span>
                                <span>{format(new Date(p.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarifa Selecionada</p>
                          {p.travelRate ? (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-amber-600" />
                                <span className="font-semibold text-amber-700 dark:text-amber-400">{p.travelRate.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline" className="text-xs">
                                  {RATE_TYPE_LABELS[p.travelRate.rateType] ?? p.travelRate.rateType}
                                </Badge>
                                <span className="font-semibold text-green-600">
                                  {formatCurrency(p.travelRate.rateValue)}
                                  {p.travelRate.rateType === "por_km" && <span className="text-xs font-normal text-muted-foreground">/km</span>}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Tarifa especial — requer aprovação
                              </div>
                              {p.rateApprovalNote && (
                                <div className="pt-2 mt-1 border-t border-amber-200 dark:border-amber-800">
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Motivo da solicitação:</p>
                                  <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed bg-amber-100/60 dark:bg-amber-900/30 rounded px-2 py-1.5 italic">
                                    "{p.rateApprovalNote}"
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Nenhuma tarifa especificada</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rota</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                              <span className="font-medium">Origem:</span>
                              <span>{p.originYard ? `${p.originYard.name} — ${p.originYard.city}/${p.originYard.state}` : "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-green-500 shrink-0" />
                              <span className="font-medium">Destino:</span>
                              <span>{p.deliveryLocation ? `${p.deliveryLocation.name} — ${p.deliveryLocation.city}/${p.deliveryLocation.state}` : "—"}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog de confirmação */}
      <Dialog open={!!actionId && !!actionType} onOpenChange={(o) => { if (!o) { setActionId(null); setActionType(null); setNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${actionType === "aprovar" ? "text-green-600" : "text-destructive"}`}>
              {actionType === "aprovar" ? (
                <><CheckCircle2 className="h-5 w-5" /> Aprovar Tarifa</>
              ) : (
                <><XCircle className="h-5 w-5" /> Rejeitar Tarifa</>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionType === "aprovar"
                ? `Aprovar o uso da tarifa "${activeItem?.travelRate?.name}" para ${activeLabel}?`
                : `Rejeitar o uso da tarifa "${activeItem?.travelRate?.name}" para ${activeLabel}? ${actionSource === "proposal" ? "A proposta precisará ser revisada." : "O transporte precisará ser revisado."}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Observação {actionType === "rejeitar" ? "(obrigatória)" : "(opcional)"}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={actionType === "aprovar" ? "Observação sobre a aprovação..." : "Motivo da rejeição..."}
              rows={3}
              data-testid="textarea-approval-note"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionId(null); setActionType(null); setNote(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={approveMutation.isPending || (actionType === "rejeitar" && !note.trim())}
              className={actionType === "aprovar" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
              data-testid="button-confirm-approval"
            >
              {approveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
              ) : actionType === "aprovar" ? (
                "Confirmar Aprovação"
              ) : (
                "Confirmar Rejeição"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
