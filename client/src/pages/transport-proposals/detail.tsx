import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  Ruler,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Truck,
  User,
  UserPlus,
  Loader2,
  Star,
  PackageCheck,
  RefreshCcw,
  UserMinus,
  History,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Receipt,
  Pencil,
  Phone,
  Mail,
  MapPinned,
  FileText,
  BadgeCheck,
  DollarSign,
  Wifi,
  Bell,
  Trophy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Driver, Transport, TravelRate } from "@shared/schema";

interface DriverResponse {
  id: string;
  proposalId: string;
  driverId: string;
  status: "pendente" | "aceito" | "recusado";
  respondedAt: string | null;
  assignedTransportId: string | null;
  rankJustification: string | null;
  createdAt: string;
  driver?: Driver;
  assignedTransport?: Transport | null;
  monthlyDeliveries?: number;
  averageScore?: number | null;
}

interface ProposalDetail {
  id: string;
  proposalNumber: string | null;
  originYardId: string;
  clientId: string;
  deliveryLocationId: string;
  startDate: string;
  distanceKm: string | null;
  totalSlots: number;
  occupiedSlots: number;
  status: string;
  computedStatus: "em_aberto" | "fechada" | "cancelada" | "pendente_aprovacao";
  rateApprovalStatus?: string | null;
  rateApprovalNote?: string | null;
  rateApprovedAt?: string | null;
  rateApprovedBy?: string | null;
  notes: string | null;
  isEmergency?: string;
  travelRateId?: string | null;
  travelRate?: TravelRate | null;
  createdAt: string;
  originYard?: any;
  client?: any;
  deliveryLocation?: any;
  items: Transport[];
  driverResponses: DriverResponse[];
  logs?: any[];
}

const statusConfig = {
  em_aberto: { label: "Em Aberto", variant: "default" as const },
  pendente_aprovacao: { label: "Pendente Aprovação", variant: "outline" as const },
  fechada: { label: "Fechada", variant: "secondary" as const },
  cancelada: { label: "Cancelada", variant: "destructive" as const },
};

const driverStatusConfig = {
  pendente: { label: "Pendente", variant: "secondary" as const, icon: Clock, color: "text-yellow-600" },
  aceito: { label: "Aceito", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" },
  recusado: { label: "Recusado", variant: "destructive" as const, icon: XCircle, color: "text-red-600" },
};

export default function TransportProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [removeDriverId, setRemoveDriverId] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ driverEntry: DriverResponse } | null>(null);
  const [selectedTransportForAssign, setSelectedTransportForAssign] = useState("");
  const [changeStatusDialog, setChangeStatusDialog] = useState<{ driverEntry: DriverResponse; newStatus: string } | null>(null);
  const [unassignTransportId, setUnassignTransportId] = useState<string | null>(null);
  const [changeDriverDialog, setChangeDriverDialog] = useState<{ transportId: string; currentDriverName?: string } | null>(null);
  const [selectedDriverForChange, setSelectedDriverForChange] = useState("");
  const [driverPages, setDriverPages] = useState<Record<string, number>>({ aceitos: 1, recusados: 1, pendentes: 1 });
  const [driverTab, setDriverTab] = useState<"aceitos" | "recusados" | "pendentes">("aceitos");
  const [driverInfoDialog, setDriverInfoDialog] = useState<DriverResponse | null>(null);
  const [logTab, setLogTab] = useState<"respostas" | "slots">("respostas");
  const [showChangeRate, setShowChangeRate] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [showNewRate, setShowNewRate] = useState(false);
  const [newRateForm, setNewRateForm] = useState({ name: "", rateValue: "", rateType: "fixo" as string });
  const [showAddTransport, setShowAddTransport] = useState(false);
  const [selectedTransportIds, setSelectedTransportIds] = useState<Set<string>>(new Set());
  const [removeTransportId, setRemoveTransportId] = useState<string | null>(null);
  const [rankJustification, setRankJustification] = useState("");

  const { data: proposal, isLoading, isFetching } = useQuery<ProposalDetail>({
    queryKey: ["/api/transport-proposals", id],
    enabled: !!id,
  });

  const { data: allDrivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: allTransports = [] } = useQuery<Transport[]>({ queryKey: ["/api/transports"] });
  const { data: travelRates = [] } = useQuery<TravelRate[]>({ queryKey: ["/api/travel-rates"] });
  const { data: onlineData } = useQuery<{ count: number }>({ queryKey: ["/api/drivers/online-count"], refetchInterval: 30000 });
  const { data: rankingConfig } = useQuery<{ ratingWeight: number; tripsWeight: number; responseTimeWeight: number }>({
    queryKey: ["/api/driver-ranking-config"],
  });

  const availableDrivers = allDrivers.filter(d =>
    d.isActive !== "false" &&
    d.isApto === "true" &&
    d.driverType === "transporte" &&
    !proposal?.driverResponses.some(r => r.driverId === d.id)
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/transport-proposals", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/transport-proposals"] });
  }

  const addDriverMutation = useMutation({
    mutationFn: (driverId: string) => apiRequest("POST", `/api/transport-proposals/${id}/drivers`, { driverId }),
    onSuccess: () => { invalidate(); setShowAddDriver(false); setSelectedDriverId(""); toast({ title: "Motorista adicionado à proposta" }); },
    onError: (err: any) => toast({ title: "Erro ao adicionar motorista", description: err.message, variant: "destructive" }),
  });

  const removeDriverMutation = useMutation({
    mutationFn: (driverId: string) => apiRequest("DELETE", `/api/transport-proposals/${id}/drivers/${driverId}`),
    onSuccess: () => { invalidate(); setRemoveDriverId(null); toast({ title: "Motorista removido da proposta" }); },
    onError: (err: any) => toast({ title: "Erro ao remover motorista", description: err.message, variant: "destructive" }),
  });

  const updateDriverStatusMutation = useMutation({
    mutationFn: ({ entryId, status }: { entryId: string; status: string }) =>
      apiRequest("PATCH", `/api/transport-proposals/${id}/drivers/${entryId}`, { status }),
    onSuccess: () => { invalidate(); setChangeStatusDialog(null); toast({ title: "Status atualizado" }); },
    onError: (err: any) => toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" }),
  });

  const assignTransportMutation = useMutation({
    mutationFn: ({ entryId, transportId, justification }: { entryId: string; transportId: string; justification?: string }) =>
      apiRequest("POST", `/api/transport-proposals/${id}/drivers/${entryId}/assign`, {
        transportId,
        ...(justification ? { rankJustification: justification } : {}),
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      setAssignDialog(null);
      setSelectedTransportForAssign("");
      setRankJustification("");
      toast({ title: "Motorista atribuído ao transporte com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro ao atribuir motorista", description: err.message, variant: "destructive" }),
  });

  const updateProposalStatusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/transport-proposals/${id}`, { status }),
    onSuccess: () => { invalidate(); toast({ title: "Status da proposta atualizado" }); },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleEmergencyMutation = useMutation({
    mutationFn: (isEmergency: string) => apiRequest("PATCH", `/api/transport-proposals/${id}`, { isEmergency }),
    onSuccess: () => { invalidate(); toast({ title: proposal?.isEmergency === "true" ? "Emergência removida" : "Proposta marcada como emergência" }); },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const changeRateMutation = useMutation({
    mutationFn: (travelRateId: string | null) => apiRequest("PATCH", `/api/transport-proposals/${id}`, { travelRateId }),
    onSuccess: () => { invalidate(); setShowChangeRate(false); setSelectedRateId(""); toast({ title: "Tarifa de viagem atualizada" }); },
    onError: (err: any) => toast({ title: "Erro ao alterar tarifa", description: err.message, variant: "destructive" }),
  });

  const createRateMutation = useMutation({
    mutationFn: async (data: { name: string; rateValue: string; rateType: string }) => {
      const res = await apiRequest("POST", "/api/travel-rates", data);
      return res.json();
    },
    onSuccess: async (newRate: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-rates"] });
      await changeRateMutation.mutateAsync(newRate.id);
      setShowNewRate(false);
      setNewRateForm({ name: "", rateValue: "", rateType: "fixo" });
    },
    onError: (err: any) => toast({ title: "Erro ao criar tarifa", description: err.message, variant: "destructive" }),
  });

  const addTransportMutation = useMutation({
    mutationFn: async (transportIds: string[]) => {
      for (const transportId of transportIds) {
        await apiRequest("POST", `/api/transport-proposals/${id}/transports`, { transportId });
      }
    },
    onSuccess: (_, transportIds) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      for (const transportId of transportIds) {
        queryClient.refetchQueries({ queryKey: ["/api/transports", transportId, "proposals"] });
      }
      setSelectedTransportIds(new Set());
      setShowAddTransport(false);
      toast({ title: "Transportes vinculados à proposta" });
    },
    onError: (err: any) => toast({ title: "Erro ao vincular transportes", description: err.message, variant: "destructive" }),
  });

  const removeTransportMutation = useMutation({
    mutationFn: (transportId: string) => apiRequest("DELETE", `/api/transport-proposals/${id}/transports/${transportId}`),
    onSuccess: (_, transportId) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.refetchQueries({ queryKey: ["/api/transports", transportId, "proposals"] });
      setRemoveTransportId(null);
      toast({ title: "Transporte removido da proposta" });
    },
    onError: (err: any) => toast({ title: "Erro ao remover transporte", description: err.message, variant: "destructive" }),
  });

  const unassignDriverMutation = useMutation({
    mutationFn: (transportId: string) =>
      apiRequest("POST", `/api/transport-proposals/${id}/transports/${transportId}/unassign-driver`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      setUnassignTransportId(null);
      toast({ title: "Motorista removido do transporte" });
    },
    onError: (err: any) => toast({ title: "Erro ao remover motorista", description: err.message, variant: "destructive" }),
  });

  const changeDriverMutation = useMutation({
    mutationFn: ({ transportId, newDriverEntryId }: { transportId: string; newDriverEntryId: string }) =>
      apiRequest("POST", `/api/transport-proposals/${id}/transports/${transportId}/change-driver`, { newDriverEntryId }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      setChangeDriverDialog(null);
      setSelectedDriverForChange("");
      toast({ title: "Motorista alterado com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro ao alterar motorista", description: err.message, variant: "destructive" }),
  });

  const resendPushMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/transport-proposals/${id}/resend-push`),
    onSuccess: () => toast({ title: "Notificação reenviada!", description: "Push enviado a todos os motoristas ativos com token." }),
    onError: (err: any) => toast({ title: "Erro ao reenviar notificação", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Detalhes da Proposta" breadcrumbs={[{ label: "Propostas de Transporte", href: "/proposta-transporte" }, { label: "Detalhes" }]} />
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Proposta não encontrada" breadcrumbs={[{ label: "Propostas de Transporte", href: "/proposta-transporte" }]} />
        <div className="flex-1 overflow-y-auto p-6 text-center text-muted-foreground">
          <p>A proposta solicitada não foi encontrada.</p>
          <Link href="/proposta-transporte"><Button className="mt-4" variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  const cfg = statusConfig[proposal.computedStatus] ?? statusConfig.em_aberto;
  const isEditable = proposal.computedStatus !== "cancelada" && proposal.computedStatus !== "pendente_aprovacao";
  const alreadyAssignedTransportIds = proposal.driverResponses
    .filter(dr => dr.assignedTransportId)
    .map(dr => dr.assignedTransportId!);

  const unassignedLinkedTransports = proposal.items.filter(
    t => !alreadyAssignedTransportIds.includes(t.id)
  );

  const availableSystemTransports = allTransports.filter((t: any) =>
    t.status === "pendente" &&
    t.originYardId === proposal.originYardId &&
    t.deliveryLocationId === proposal.deliveryLocationId &&
    !t.driverId &&
    !alreadyAssignedTransportIds.includes(t.id) &&
    !proposal.items.some((item: any) => item.id === t.id)
  );

  const assignableTransports = proposal.items.length > 0
    ? unassignedLinkedTransports
    : availableSystemTransports;

  const hasAssignableTransports = assignableTransports.length > 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Detalhes da Proposta"
        breadcrumbs={[{ label: "Propostas de Transporte", href: "/proposta-transporte" }, { label: proposal.proposalNumber || `#${proposal.id.slice(0, 8)}` }]}
        actions={
          <div className="flex gap-2">
            {isEditable && (
              <>
                <Button
                  size="sm"
                  variant={proposal.isEmergency === "true" ? "default" : "outline"}
                  className={proposal.isEmergency === "true" ? "bg-red-600 hover:bg-red-700 text-white" : "text-red-600 border-red-200 hover:bg-red-50"}
                  onClick={() => toggleEmergencyMutation.mutate(proposal.isEmergency === "true" ? "false" : "true")}
                  disabled={toggleEmergencyMutation.isPending}
                  data-testid="button-toggle-emergency"
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {proposal.isEmergency === "true" ? "Remover Emergência" : "Emergência"}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateProposalStatusMutation.mutate("cancelada")} data-testid="button-cancelar">
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {proposal.computedStatus === "pendente_aprovacao" && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid="banner-pendente-aprovacao">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Proposta aguardando aprovação de tarifa</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">A tarifa selecionada requer aprovação antes que esta proposta possa ser operada. Ações de edição estão bloqueadas até a aprovação.</p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Informações da Proposta</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => resendPushMutation.mutate()}
                  disabled={resendPushMutation.isPending}
                  data-testid="button-resend-push"
                >
                  {resendPushMutation.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Bell className="h-3.5 w-3.5" />}
                  Reenviar Notificação
                </Button>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Pátio de Saída</p>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-yard">{proposal.originYard?.name ?? "-"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[proposal.originYard?.address, proposal.originYard?.addressNumber, proposal.originYard?.city, proposal.originYard?.state].filter(Boolean).join(", ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Cliente / Local de Entrega</p>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-client">{proposal.client?.name ?? "-"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {proposal.deliveryLocation?.name} · {[proposal.deliveryLocation?.address, proposal.deliveryLocation?.city].filter(Boolean).join(", ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Data de Início</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-start-date">
                    {proposal.startDate ? format(new Date(proposal.startDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Distância</p>
                <div className="flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-distance">{proposal.distanceKm ? `${Number(proposal.distanceKm).toFixed(0)} km` : "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Slots</p>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-slots">{proposal.occupiedSlots} / {proposal.totalSlots} ocupados</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (proposal.occupiedSlots / proposal.totalSlots) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Tarifa de Viagem</p>
                <div className="flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium" data-testid="text-travel-rate">
                    {proposal.travelRate
                      ? `${proposal.travelRate.name} — R$ ${Number(proposal.travelRate.rateValue).toFixed(2)} (${proposal.travelRate.rateType === "fixo" ? "Fixo" : proposal.travelRate.rateType === "por_km" ? "Por Km" : proposal.travelRate.rateType})`
                      : "Nenhuma tarifa"}
                  </span>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-1"
                      data-testid="button-change-rate"
                      onClick={() => {
                        setSelectedRateId(proposal.travelRateId || "");
                        setShowChangeRate(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Valor Aproximado</p>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={`font-medium ${proposal.estimatedValue ? "text-green-700 dark:text-green-400" : ""}`} data-testid="text-estimated-value">
                    {proposal.estimatedValue
                      ? `R$ ${Number(proposal.estimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </div>
              </div>
              {proposal.notes && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Observações</p>
                  <p className="text-sm">{proposal.notes}</p>
                </div>
              )}

              {/* Approval status block */}
              {proposal.travelRate && (proposal.rateApprovalStatus || proposal.rateApprovalNote) && (
                <div className="col-span-2 md:col-span-3">
                  <div className={`rounded-lg border px-4 py-3 space-y-2 ${
                    proposal.rateApprovalStatus === "aprovado"
                      ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                      : proposal.rateApprovalStatus === "rejeitado"
                        ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
                        : "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
                  }`}>
                    {/* Status header */}
                    <div className="flex items-center gap-2">
                      {proposal.rateApprovalStatus === "aprovado" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : proposal.rateApprovalStatus === "rejeitado" ? (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <p className={`text-sm font-semibold ${
                        proposal.rateApprovalStatus === "aprovado" ? "text-green-700 dark:text-green-400"
                          : proposal.rateApprovalStatus === "rejeitado" ? "text-red-700 dark:text-red-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`}>
                        {proposal.rateApprovalStatus === "aprovado"
                          ? "Tarifa especial aprovada"
                          : proposal.rateApprovalStatus === "rejeitado"
                            ? "Tarifa especial rejeitada"
                            : "Tarifa especial aguardando aprovação"}
                      </p>
                    </div>

                    {/* Who approved + when */}
                    {(proposal.rateApprovalStatus === "aprovado" || proposal.rateApprovalStatus === "rejeitado") && proposal.rateApprovedBy && (
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {proposal.rateApprovalStatus === "aprovado" ? "Aprovado por:" : "Rejeitado por:"}
                          </span>
                          <span className="font-semibold text-foreground">{proposal.rateApprovedBy}</span>
                        </span>
                        {proposal.rateApprovedAt && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Em:</span>
                            <span className="font-medium text-foreground">
                              {format(new Date(proposal.rateApprovedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Approval / rejection note */}
                    {proposal.rateApprovalNote && (
                      <p className="text-xs text-muted-foreground italic border-t border-current/10 pt-2 mt-1">
                        <span className="not-italic font-medium text-foreground">
                          {proposal.rateApprovalStatus === "rejeitado" ? "Motivo da rejeição:" : "Observação:"}
                        </span>{" "}
                        {proposal.rateApprovalNote}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(() => {
              const aceitos = proposal.driverResponses.filter((dr: DriverResponse) => dr.status === "aceito");
              const pendentes = proposal.driverResponses.filter((dr: DriverResponse) => dr.status === "pendente");
              const recusados = proposal.driverResponses.filter((dr: DriverResponse) => dr.status === "recusado");
              const total = proposal.driverResponses.length;

              return (
                <div className="mt-5 pt-4 border-t" data-testid="section-driver-summary">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">Resumo de Motoristas</p>
                    </div>
                    {total > 0 && (
                      <Badge variant="secondary" className="text-xs">{total} candidato{total !== 1 ? "s" : ""}</Badge>
                    )}
                  </div>

                  {total === 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 w-fit" data-testid="summary-online-empty">
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10 relative">
                          <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-none">{onlineData?.count ?? 0}</p>
                          <p className="text-[10px] text-emerald-600/70 uppercase font-medium tracking-wider">Motoristas Online</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-muted/40 text-muted-foreground">
                        <Users className="h-4 w-4 opacity-40" />
                        <p className="text-xs">Nenhum motorista se candidatou a esta proposta ainda.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15" data-testid="summary-online">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10 relative">
                            <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-none">{onlineData?.count ?? 0}</p>
                            <p className="text-[10px] text-emerald-600/70 uppercase font-medium tracking-wider">Online</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/5 border border-green-500/15" data-testid="summary-aceitos">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-500/10">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400 leading-none">{aceitos.length}</p>
                            <p className="text-[10px] text-green-600/70 uppercase font-medium tracking-wider">Aceitos</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/15" data-testid="summary-pendentes">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-yellow-500/10">
                            <Clock className="h-3.5 w-3.5 text-yellow-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400 leading-none">{pendentes.length}</p>
                            <p className="text-[10px] text-yellow-600/70 uppercase font-medium tracking-wider">Pendentes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/15" data-testid="summary-recusados">
                          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-red-500/10">
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-red-700 dark:text-red-400 leading-none">{recusados.length}</p>
                            <p className="text-[10px] text-red-500/70 uppercase font-medium tracking-wider">Recusados</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Transports */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Transportes Vinculados ({proposal.items.length})
              </CardTitle>
              {isEditable && (
                <Button size="sm" onClick={() => setShowAddTransport(true)} data-testid="button-add-transport">
                  <Plus className="h-4 w-4 mr-1" />
                  Vincular Transporte
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {proposal.items.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum transporte vinculado a esta proposta.</p>
            ) : (
              <div className="divide-y">
                {proposal.items.map((t: any) => {
                  const assignedDriver = proposal.driverResponses.find(dr => dr.assignedTransportId === t?.id);
                  return (
                    <div key={t?.id} className="py-3 flex items-start justify-between gap-4" data-testid={`row-transport-${t?.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted mt-0.5">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{t?.requestNumber}</p>
                            <span className="text-xs text-muted-foreground">• {t?.vehicleChassi}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t?.client?.name || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 text-blue-500" />
                              <span className="truncate">{t?.originYard?.name || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0 text-green-500" />
                              <span className="truncate">{t?.deliveryLocation?.name || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Truck className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t?.vehicleModel || "—"} {t?.vehicleColor ? `(${t.vehicleColor})` : ""}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                        {assignedDriver ? (
                          <>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3.5 w-3.5 text-green-600" />
                              <span className="font-medium text-foreground">{assignedDriver.driver?.name}</span>
                            </div>
                            {isEditable && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700"
                                  title="Trocar motorista"
                                  onClick={() => { setChangeDriverDialog({ transportId: t.id, currentDriverName: assignedDriver.driver?.name }); setSelectedDriverForChange(""); }}
                                  data-testid={`button-change-driver-${t?.id}`}
                                >
                                  <RefreshCcw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  title="Remover motorista"
                                  onClick={() => setUnassignTransportId(t.id)}
                                  data-testid={`button-unassign-driver-${t?.id}`}
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground italic">Sem motorista</span>
                            {isEditable && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                title="Remover transporte da proposta"
                                onClick={() => setRemoveTransportId(t.id)}
                                data-testid={`button-remove-transport-${t?.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Driver Responses */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Motoristas ({proposal.driverResponses.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => invalidate()}
                  disabled={isFetching}
                  title="Atualizar aceites"
                  data-testid="button-refresh-drivers"
                >
                  <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  <span className="ml-1 hidden sm:inline">Atualizar Aceites</span>
                </Button>
                {isEditable && proposal.items.length > 0 && (
                  <Button size="sm" onClick={() => setShowAddDriver(true)} data-testid="button-add-driver">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Adicionar Motorista
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {proposal.driverResponses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {proposal.items.length === 0
                    ? "Vincule transportes à proposta antes de adicionar motoristas."
                    : "Nenhum motorista adicionado à proposta."}
                </p>
              </div>
            ) : (
              (() => {
                const aceitosBruto = proposal.driverResponses.filter(dr => dr.status === "aceito");
                const recusados = proposal.driverResponses.filter(dr => dr.status === "recusado");
                const pendentes = proposal.driverResponses.filter(dr => dr.status === "pendente");

                // Ranking ponderado dos aceitos
                const rW = rankingConfig?.ratingWeight ?? 5;
                const tW = rankingConfig?.tripsWeight ?? 5;
                const rtW = rankingConfig?.responseTimeWeight ?? 5;
                const totalW = rW + tW + rtW;

                const withScores = aceitosBruto.map(dr => {
                  const maxTrips = Math.max(1, ...aceitosBruto.map(d => d.monthlyDeliveries ?? 0));
                  const respondedTimes = aceitosBruto
                    .filter(d => d.respondedAt)
                    .map(d => new Date(d.respondedAt!).getTime());
                  const minTime = respondedTimes.length ? Math.min(...respondedTimes) : 0;
                  const maxTime = respondedTimes.length ? Math.max(...respondedTimes) : 0;
                  const timeRange = maxTime - minTime || 1;

                  const normRating = (dr.averageScore ?? 0) / 5;
                  const normTrips = 1 - (dr.monthlyDeliveries ?? 0) / maxTrips;
                  const normTime = dr.respondedAt
                    ? 1 - (new Date(dr.respondedAt).getTime() - minTime) / timeRange
                    : 0;

                  const score = totalW > 0
                    ? (rW * normRating + tW * normTrips + rtW * normTime) / totalW
                    : 0;
                  return { dr, score };
                });

                withScores.sort((a, b) => b.score - a.score);
                const aceitos = withScores.map(ws => ws.dr);
                const rankMap = new Map(withScores.map((ws, i) => [ws.dr.id, i + 1]));

                const renderDriver = (dr: DriverResponse) => {
                  const rank = rankMap.get(dr.id);
                  const dCfg = driverStatusConfig[dr.status];
                  const DIcon = dCfg.icon;
                  return (
                    <div key={dr.id} className="py-3 flex items-center justify-between gap-3" data-testid={`row-driver-${dr.id}`}>
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setDriverInfoDialog(dr)}
                        data-testid={`button-driver-info-${dr.id}`}
                      >
                        {rank != null && (
                          <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 font-bold text-xs ${
                            rank === 1 ? "bg-amber-400 text-white" :
                            rank === 2 ? "bg-slate-300 text-slate-700" :
                            rank === 3 ? "bg-orange-400 text-white" :
                            "bg-muted text-muted-foreground"
                          }`} title={`Ranking: ${rank}º lugar`}>
                            {rank <= 3 ? ["🥇","🥈","🥉"][rank-1] : `#${rank}`}
                          </div>
                        )}
                        <Avatar className="h-9 w-9 shrink-0 border border-border">
                          <AvatarImage src={dr.driver?.profilePhoto ?? undefined} />
                          <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" data-testid={`text-driver-name-${dr.id}`}>{dr.driver?.name ?? dr.driverId}</p>
                          <p className="text-xs text-muted-foreground">{dr.driver?.phone ?? ""}</p>
                          {dr.respondedAt && (
                            <p className="text-xs text-muted-foreground">
                              Respondeu em {format(new Date(dr.respondedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          )}
                          {dr.assignedTransport && (
                            <p className="text-xs text-green-600 font-medium">
                              Atribuído: {(dr.assignedTransport as any)?.requestNumber}
                            </p>
                          )}
                          {dr.rankJustification && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 italic mt-0.5 flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                              <span>Justificativa: {dr.rankJustification}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 mr-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Transportes entregues no mês">
                          <PackageCheck className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground">{dr.monthlyDeliveries ?? 0}</span>
                          <span className="hidden sm:inline">esse mês</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground" title="Nota média do motorista">
                          <Star className={`h-3.5 w-3.5 shrink-0 ${dr.averageScore != null ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                          {dr.averageScore != null
                            ? <span className="font-semibold text-amber-600">{dr.averageScore.toFixed(1)}</span>
                            : <span className="text-muted-foreground/60">—</span>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isEditable && (
                          <>
                            {dr.status === "aceito" && !dr.assignedTransportId && hasAssignableTransports && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => { setAssignDialog({ driverEntry: dr }); setSelectedTransportForAssign(assignableTransports.length === 1 ? (assignableTransports[0] as any).id : ""); }}
                                data-testid={`button-assign-${dr.id}`}
                              >
                                <Truck className="h-3.5 w-3.5 mr-1" />
                                Atribuir
                              </Button>
                            )}
                            {dr.status !== "aceito" && (
                              <Select
                                value={dr.status}
                                onValueChange={newStatus => setChangeStatusDialog({ driverEntry: dr, newStatus })}
                              >
                                <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-status-driver-${dr.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="aceito">Aceito</SelectItem>
                                  <SelectItem value="recusado">Recusado</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </>
                        )}
                        {(!isEditable || dr.status === "aceito") && (
                          <Badge variant={dCfg.variant} className="text-xs whitespace-nowrap" data-testid={`badge-status-${dr.id}`}>
                            <DIcon className="h-3 w-3 mr-1" />
                            {dCfg.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                };

                const DRIVERS_PER_PAGE = 10;

                const tabConfig = {
                  aceitos: { drivers: aceitos, icon: CheckCircle2, label: "Aceitos", iconClass: "text-green-600", activeClass: "bg-green-600 text-white", borderClass: "border-green-200", bgClass: "bg-green-50/30" },
                  pendentes: { drivers: pendentes, icon: Clock, label: "Aguardando", iconClass: "text-yellow-600", activeClass: "bg-yellow-500 text-white", borderClass: "border-yellow-200", bgClass: "bg-yellow-50/30" },
                  recusados: { drivers: recusados, icon: XCircle, label: "Recusados", iconClass: "text-red-500", activeClass: "bg-red-500 text-white", borderClass: "border-red-200", bgClass: "bg-red-50/30" },
                };

                const currentTab = tabConfig[driverTab];
                const currentDrivers = currentTab.drivers;
                const page = driverPages[driverTab] ?? 1;
                const totalPages = Math.ceil(currentDrivers.length / DRIVERS_PER_PAGE);
                const paginated = currentDrivers.slice((page - 1) * DRIVERS_PER_PAGE, page * DRIVERS_PER_PAGE);
                const setPage = (p: number) => setDriverPages(prev => ({ ...prev, [driverTab]: p }));

                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg" data-testid="driver-tabs">
                      {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(key => {
                        const tab = tabConfig[key];
                        const TabIcon = tab.icon;
                        const isActive = driverTab === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setDriverTab(key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isActive ? tab.activeClass : "text-muted-foreground hover:text-foreground hover:bg-background"}`}
                            data-testid={`tab-drivers-${key}`}
                          >
                            <TabIcon className="h-3.5 w-3.5" />
                            {tab.label}
                            <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${isActive ? "bg-white/20" : "bg-muted"}`}>
                              {tab.drivers.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {currentDrivers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum motorista nesta categoria.</p>
                      </div>
                    ) : (
                      <>
                        <div className={`divide-y rounded-lg border ${currentTab.borderClass} ${currentTab.bgClass} px-3`}>
                          {paginated.map(renderDriver)}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-1 pt-1">
                            <span className="text-xs text-muted-foreground">
                              {((page - 1) * DRIVERS_PER_PAGE) + 1}–{Math.min(page * DRIVERS_PER_PAGE, currentDrivers.length)} de {currentDrivers.length}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                                data-testid={`button-prev-${driverTab}`}
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                disabled={page >= totalPages}
                                onClick={() => setPage(page + 1)}
                                data-testid={`button-next-${driverTab}`}
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
        {/* Activity Log */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Atividades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const actionConfig: Record<string, { color: string; label: string }> = {
                add_driver: { color: "text-green-600", label: "Motorista adicionado" },
                remove_driver: { color: "text-red-500", label: "Motorista removido" },
                change_status: { color: "text-blue-600", label: "Status alterado" },
                assign_driver: { color: "text-emerald-600", label: "Motorista atribuído" },
                unassign_driver: { color: "text-orange-500", label: "Motorista desvinculado" },
                change_driver: { color: "text-purple-600", label: "Motorista trocado" },
                change_rate: { color: "text-amber-600", label: "Tarifa alterada" },
              };

              const responseActions = new Set(["change_status"]);
              const slotActions = new Set(["assign_driver", "unassign_driver", "change_driver", "add_driver", "remove_driver"]);

              const allLogs = proposal.logs ?? [];
              const responseLogs = allLogs.filter((l: any) => responseActions.has(l.action));
              const slotLogs = allLogs.filter((l: any) => slotActions.has(l.action));

              const currentLogs = logTab === "respostas" ? responseLogs : slotLogs;

              const renderLogList = (logs: any[]) => {
                if (logs.length === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma atividade nesta categoria.</p>
                    </div>
                  );
                }
                return (
                  <div className="relative">
                    <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-3">
                      {logs.map((log: any) => {
                        const cfg = actionConfig[log.action] ?? { color: "text-muted-foreground", label: log.action };
                        return (
                          <div key={log.id} className="flex items-start gap-3 pl-1" data-testid={`log-entry-${log.id}`}>
                            <div className="relative z-10 mt-1 h-5 w-5 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                              <div className={`h-2 w-2 rounded-full ${cfg.color.replace("text-", "bg-")}`} />
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs font-medium text-foreground">{log.performedBy}</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                  {log.createdAt ? format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg" data-testid="log-tabs">
                    <button
                      onClick={() => setLogTab("respostas")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${logTab === "respostas" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-background"}`}
                      data-testid="tab-log-respostas"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aceites / Recusas
                      <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${logTab === "respostas" ? "bg-white/20" : "bg-muted"}`}>
                        {responseLogs.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setLogTab("slots")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${logTab === "slots" ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-background"}`}
                      data-testid="tab-log-slots"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Motoristas / Slots
                      <span className={`ml-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${logTab === "slots" ? "bg-white/20" : "bg-muted"}`}>
                        {slotLogs.length}
                      </span>
                    </button>
                  </div>
                  {renderLogList(currentLogs)}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Add Driver Dialog */}
      <Dialog open={showAddDriver} onOpenChange={open => { setShowAddDriver(open); if (!open) setSelectedDriverId(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Motorista</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger data-testid="select-add-driver">
                <SelectValue placeholder="Selecione um motorista" />
              </SelectTrigger>
              <SelectContent>
                {availableDrivers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name} – {d.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDriver(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedDriverId && addDriverMutation.mutate(selectedDriverId)}
              disabled={!selectedDriverId || addDriverMutation.isPending}
              data-testid="button-confirm-add-driver"
            >
              {addDriverMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Transport Dialog */}
      {assignDialog && (() => {
        // Compute rank context for the assign dialog
        const rW2 = rankingConfig?.ratingWeight ?? 5;
        const tW2 = rankingConfig?.tripsWeight ?? 5;
        const rtW2 = rankingConfig?.responseTimeWeight ?? 5;
        const totalW2 = rW2 + tW2 + rtW2;
        const aceitosForRank = (proposal?.driverResponses ?? []).filter(dr => dr.status === "aceito" && !dr.assignedTransportId);
        const withScores2 = aceitosForRank.map(dr => {
          const maxTrips2 = Math.max(1, ...aceitosForRank.map(d => d.monthlyDeliveries ?? 0));
          const respondedTimes2 = aceitosForRank.filter(d => d.respondedAt).map(d => new Date(d.respondedAt!).getTime());
          const minTime2 = respondedTimes2.length ? Math.min(...respondedTimes2) : 0;
          const maxTime2 = respondedTimes2.length ? Math.max(...respondedTimes2) : 0;
          const timeRange2 = maxTime2 - minTime2 || 1;
          const normRating2 = (dr.averageScore ?? 0) / 5;
          const normTrips2 = 1 - (dr.monthlyDeliveries ?? 0) / maxTrips2;
          const normTime2 = dr.respondedAt ? 1 - (new Date(dr.respondedAt).getTime() - minTime2) / timeRange2 : 0;
          const score2 = totalW2 > 0 ? (rW2 * normRating2 + tW2 * normTrips2 + rtW2 * normTime2) / totalW2 : 0;
          return { dr, score: score2 };
        });
        withScores2.sort((a, b) => b.score - a.score);
        const assignedDriverRankPos = withScores2.findIndex(ws => ws.dr.id === assignDialog.driverEntry.id);
        const higherRankedUnassigned = assignedDriverRankPos > 0
          ? withScores2.slice(0, assignedDriverRankPos).map(ws => ws.dr)
          : [];
        const needsJustification = higherRankedUnassigned.length > 0;
        const canConfirm = !!selectedTransportForAssign && (!needsJustification || rankJustification.trim().length >= 10);

        return (
          <Dialog open onOpenChange={() => { setAssignDialog(null); setRankJustification(""); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Atribuir Motorista ao Transporte</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Motorista: <span className="font-medium text-foreground">{assignDialog.driverEntry.driver?.name}</span>
                  {assignedDriverRankPos >= 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (ranking #{assignedDriverRankPos + 1} entre não atribuídos)
                    </span>
                  )}
                </p>
                {needsJustification && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-800 dark:text-amber-300">
                        <p className="font-semibold mb-1">Motorista com ranking inferior selecionado</p>
                        <p>Os seguintes motoristas têm classificação superior e ainda não foram atribuídos:</p>
                        <ul className="mt-1 space-y-0.5">
                          {higherRankedUnassigned.map((dr, i) => (
                            <li key={dr.id} className="font-medium">
                              {["🥇","🥈","🥉"][i] ?? `#${i+1}`} {dr.driver?.name ?? dr.driverId}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="rank-justification" className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        Justificativa obrigatória (mínimo 10 caracteres)
                      </Label>
                      <textarea
                        id="rank-justification"
                        className="w-full rounded-md border border-amber-300 bg-white dark:bg-background p-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                        rows={3}
                        placeholder="Informe o motivo da escolha deste motorista..."
                        value={rankJustification}
                        onChange={e => setRankJustification(e.target.value)}
                        data-testid="input-rank-justification"
                      />
                      <p className="text-xs text-muted-foreground text-right">{rankJustification.trim().length}/10 mín.</p>
                    </div>
                  </div>
                )}
                <Select value={selectedTransportForAssign} onValueChange={setSelectedTransportForAssign}>
                  <SelectTrigger data-testid="select-assign-transport">
                    <SelectValue placeholder="Selecione o transporte" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableTransports.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.requestNumber} · {t.vehicleChassi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAssignDialog(null); setRankJustification(""); }}>Cancelar</Button>
                <Button
                  onClick={() => assignTransportMutation.mutate({
                    entryId: assignDialog.driverEntry.id,
                    transportId: selectedTransportForAssign,
                    justification: needsJustification ? rankJustification.trim() : undefined,
                  })}
                  disabled={!canConfirm || assignTransportMutation.isPending}
                  data-testid="button-confirm-assign"
                >
                  {assignTransportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Atribuir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Remove Driver Alert */}
      <AlertDialog open={!!removeDriverId} onOpenChange={open => !open && setRemoveDriverId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Motorista?</AlertDialogTitle>
            <AlertDialogDescription>O motorista será removido desta proposta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeDriverId && removeDriverMutation.mutate(removeDriverId)}
              data-testid="button-confirm-remove-driver"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Driver Status Confirm */}
      {changeStatusDialog && (
        <AlertDialog open onOpenChange={() => setChangeStatusDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Alterar Status?</AlertDialogTitle>
              <AlertDialogDescription>
                Alterar o status de <strong>{changeStatusDialog.driverEntry.driver?.name}</strong> para{" "}
                <strong>{driverStatusConfig[changeStatusDialog.newStatus as keyof typeof driverStatusConfig]?.label}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => updateDriverStatusMutation.mutate({ entryId: changeStatusDialog.driverEntry.id, status: changeStatusDialog.newStatus })}
                data-testid="button-confirm-status-change"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Unassign Driver from Transport */}
      <AlertDialog open={!!unassignTransportId} onOpenChange={open => !open && setUnassignTransportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Motorista do Transporte?</AlertDialogTitle>
            <AlertDialogDescription>O motorista será desvinculado deste transporte. O transporte ficará sem motorista atribuído.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => unassignTransportId && unassignDriverMutation.mutate(unassignTransportId)}
              data-testid="button-confirm-unassign"
            >
              {unassignDriverMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Driver on Transport Dialog */}
      {changeDriverDialog && (
        <Dialog open onOpenChange={() => { setChangeDriverDialog(null); setSelectedDriverForChange(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Trocar Motorista</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {changeDriverDialog.currentDriverName && (
                <p className="text-sm text-muted-foreground">
                  Motorista atual: <span className="font-medium text-foreground">{changeDriverDialog.currentDriverName}</span>
                </p>
              )}
              <Select value={selectedDriverForChange} onValueChange={setSelectedDriverForChange}>
                <SelectTrigger data-testid="select-change-driver">
                  <SelectValue placeholder="Selecione o novo motorista" />
                </SelectTrigger>
                <SelectContent>
                  {proposal?.driverResponses
                    .filter(dr => dr.status === "aceito" && !dr.assignedTransportId)
                    .map(dr => (
                      <SelectItem key={dr.id} value={dr.id}>
                        {dr.driver?.name ?? dr.driverId}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {proposal?.driverResponses.filter(dr => dr.status === "aceito" && !dr.assignedTransportId).length === 0 && (
                <p className="text-xs text-amber-600">Nenhum motorista aceito disponível sem transporte atribuído.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeDriverDialog(null)}>Cancelar</Button>
              <Button
                onClick={() => changeDriverMutation.mutate({ transportId: changeDriverDialog.transportId, newDriverEntryId: selectedDriverForChange })}
                disabled={!selectedDriverForChange || changeDriverMutation.isPending}
                data-testid="button-confirm-change-driver"
              >
                {changeDriverMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Trocar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showChangeRate} onOpenChange={(o) => { if (!o) { setShowChangeRate(false); setShowNewRate(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Tarifa de Viagem</DialogTitle>
          </DialogHeader>

          {!showNewRate ? (
            <div className="space-y-4 py-2">
              {proposal?.travelRate && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Tarifa Atual</p>
                  <p className="font-medium">{proposal.travelRate.name} — R$ {Number(proposal.travelRate.rateValue).toFixed(2)} ({proposal.travelRate.rateType === "fixo" ? "Fixo" : proposal.travelRate.rateType === "por_km" ? "Por Km" : proposal.travelRate.rateType})</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Selecionar Tarifa Existente</Label>
                <Select value={selectedRateId} onValueChange={setSelectedRateId}>
                  <SelectTrigger data-testid="select-travel-rate">
                    <SelectValue placeholder="Selecione uma tarifa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma tarifa</SelectItem>
                    {travelRates.filter((r: any) => r.isActive !== "false").map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} — R$ {Number(r.rateValue).toFixed(2)} ({r.rateType === "fixo" ? "Fixo" : r.rateType === "por_km" ? "Por Km" : r.rateType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowNewRate(true)} data-testid="button-new-rate">
                + Criar Nova Tarifa
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="rate-name">Nome da Tarifa</Label>
                <Input
                  id="rate-name"
                  value={newRateForm.name}
                  onChange={(e) => setNewRateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Tarifa SP-RJ Especial"
                  data-testid="input-rate-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate-value">Valor (R$)</Label>
                <Input
                  id="rate-value"
                  type="number"
                  step="0.01"
                  value={newRateForm.rateValue}
                  onChange={(e) => setNewRateForm(f => ({ ...f, rateValue: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-rate-value"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newRateForm.rateType} onValueChange={(v) => setNewRateForm(f => ({ ...f, rateType: v }))}>
                  <SelectTrigger data-testid="select-rate-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo</SelectItem>
                    <SelectItem value="por_km">Por Km</SelectItem>
                    <SelectItem value="percentual">Percentual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {showNewRate && (
              <Button variant="outline" onClick={() => setShowNewRate(false)}>Voltar</Button>
            )}
            {!showNewRate ? (
              <Button
                onClick={() => changeRateMutation.mutate(selectedRateId === "none" ? null : selectedRateId)}
                disabled={!selectedRateId || changeRateMutation.isPending}
                data-testid="button-confirm-change-rate"
              >
                {changeRateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            ) : (
              <Button
                onClick={() => createRateMutation.mutate(newRateForm)}
                disabled={!newRateForm.name || !newRateForm.rateValue || createRateMutation.isPending}
                data-testid="button-confirm-create-rate"
              >
                {createRateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar e Aplicar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTransport} onOpenChange={(o) => { if (!o) { setShowAddTransport(false); setSelectedTransportIds(new Set()); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vincular Transportes à Proposta</DialogTitle>
          </DialogHeader>
          {(() => {
            const linkedIds = new Set(proposal?.items?.map((t: any) => t?.id) ?? []);
            const available = allTransports.filter((t: any) => !linkedIds.has(t.id) && !t.driverId);
            const allSelected = available.length > 0 && available.every(t => selectedTransportIds.has(t.id));
            return (
              <>
                {available.length > 0 && (
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTransportIds(new Set(available.map(t => t.id)));
                          } else {
                            setSelectedTransportIds(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all-transports"
                      />
                      Selecionar todos ({available.length})
                    </label>
                    {selectedTransportIds.size > 0 && (
                      <span className="text-sm font-medium text-primary">{selectedTransportIds.size} selecionado(s)</span>
                    )}
                  </div>
                )}
                <div className="space-y-2 py-1 max-h-[400px] overflow-y-auto">
                  {available.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum transporte disponível para vincular.</p>
                  ) : (
                    available.map((t: any) => {
                      const isChecked = selectedTransportIds.has(t.id);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isChecked ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"}`}
                          data-testid={`row-available-transport-${t.id}`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedTransportIds);
                              if (checked) next.add(t.id); else next.delete(t.id);
                              setSelectedTransportIds(next);
                            }}
                            className="mt-1"
                            data-testid={`checkbox-transport-${t.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{t.requestNumber || "Sem número"}</span>
                              <span className="text-xs text-muted-foreground">• {t.vehicleChassi || "—"}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3 shrink-0" />
                                <span className="truncate">{t.client?.name || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0 text-blue-500" />
                                <span className="truncate">{t.originYard?.name || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0 text-green-500" />
                                <span className="truncate">{t.deliveryLocation?.name || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Truck className="h-3 w-3 shrink-0" />
                                <span className="truncate">{t.vehicleModel || "—"} {t.vehicleColor ? `(${t.vehicleColor})` : ""}</span>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddTransport(false); setSelectedTransportIds(new Set()); }}>Cancelar</Button>
            <Button
              onClick={() => addTransportMutation.mutate(Array.from(selectedTransportIds))}
              disabled={selectedTransportIds.size === 0 || addTransportMutation.isPending}
              data-testid="button-confirm-link-transports"
            >
              {addTransportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Vincular {selectedTransportIds.size > 0 ? `(${selectedTransportIds.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTransportId} onOpenChange={(o) => { if (!o) setRemoveTransportId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Transporte</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover este transporte da proposta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTransportId && removeTransportMutation.mutate(removeTransportId)}
              className="bg-destructive text-white hover:bg-destructive/90"
              data-testid="button-confirm-remove-transport"
            >
              {removeTransportMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!driverInfoDialog} onOpenChange={(o) => { if (!o) setDriverInfoDialog(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-driver-info">
          <DialogHeader>
            <DialogTitle>Informações do Motorista</DialogTitle>
          </DialogHeader>
          {driverInfoDialog?.driver && (() => {
            const d = driverInfoDialog.driver!;
            const statusCfg = driverStatusConfig[driverInfoDialog.status];
            const StatusIcon = statusCfg.icon;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-border">
                    <AvatarImage src={d.profilePhoto ?? undefined} />
                    <AvatarFallback><User className="h-7 w-7" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg truncate" data-testid="text-dialog-driver-name">{d.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusCfg.variant} className="text-xs">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusCfg.label}
                      </Badge>
                      {d.isApto === "true" && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                          <BadgeCheck className="h-3 w-3 mr-1" />
                          Apto
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <PackageCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Entregas no mês</p>
                      <p className="text-sm font-semibold">{driverInfoDialog.monthlyDeliveries ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                    <Star className={`h-4 w-4 shrink-0 ${driverInfoDialog.averageScore != null ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                    <div>
                      <p className="text-[11px] text-muted-foreground">Nota média</p>
                      <p className="text-sm font-semibold">
                        {driverInfoDialog.averageScore != null ? driverInfoDialog.averageScore.toFixed(1) : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  {d.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span data-testid="text-dialog-driver-phone">{d.phone}</span>
                    </div>
                  )}
                  {d.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span data-testid="text-dialog-driver-email">{d.email}</span>
                    </div>
                  )}
                  {d.cpf && (
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>CPF: {d.cpf}</span>
                    </div>
                  )}
                  {d.cnhType && (
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>CNH: {d.cnhType}</span>
                    </div>
                  )}
                  {(d.city || d.state) && (
                    <div className="flex items-center gap-2.5">
                      <MapPinned className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{[d.city, d.state].filter(Boolean).join(" - ")}</span>
                    </div>
                  )}
                  {d.driverType && (
                    <div className="flex items-center gap-2.5">
                      <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{d.driverType === "agregado" ? "Agregado" : d.driverType === "autonomo" ? "Autônomo" : d.driverType}</span>
                    </div>
                  )}
                </div>

                {driverInfoDialog.assignedTransport && (
                  <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" />
                      Atribuído ao transporte: {(driverInfoDialog.assignedTransport as any)?.requestNumber}
                    </p>
                  </div>
                )}

                {driverInfoDialog.respondedAt && (
                  <p className="text-xs text-muted-foreground">
                    Respondeu em {format(new Date(driverInfoDialog.respondedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
