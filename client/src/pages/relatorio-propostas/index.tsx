import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardList,
  Search,
  Building2,
  MapPin,
  Calendar,
  Ruler,
  Users,
  Truck,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  UserCheck,
  Clock,
} from "lucide-react";
import type { Yard, Client, DeliveryLocation, Transport, TravelRate } from "@shared/schema";

interface ProposalLog {
  id: string;
  proposalId: string;
  action: string;
  description: string;
  performedBy: string;
  createdAt: string;
}

interface ProposalWithRelations {
  id: string;
  proposalNumber: string | null;
  originYardId: string;
  clientId: string;
  deliveryLocationId: string;
  travelRateId: string | null;
  startDate: string;
  distanceKm: string | null;
  totalSlots: number;
  occupiedSlots: number;
  status: string;
  computedStatus: string;
  notes: string | null;
  createdAt: string;
  isEmergency?: string;
  rateApprovalStatus?: string;
  originYard?: Yard;
  client?: Client;
  deliveryLocation?: DeliveryLocation;
  travelRate?: TravelRate | null;
  items: Transport[];
  driverResponses: any[];
  logs?: ProposalLog[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive"; icon: any; color: string }> = {
  encerrada: { label: "Encerrada", variant: "secondary", icon: CheckCircle2, color: "text-green-600" },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle, color: "text-red-500" },
};

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function fmtDatetime(date: string | null | undefined) {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

function ProposalDetailDialog({
  proposal,
  open,
  onClose,
}: {
  proposal: ProposalWithRelations;
  open: boolean;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useQuery<ProposalWithRelations>({
    queryKey: ["/api/transport-proposals", proposal.id],
    enabled: open,
  });

  const cfg = statusConfig[proposal.status] ?? statusConfig["encerrada"];
  const Icon = cfg.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Histórico da Proposta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-mono">{proposal.proposalNumber || `ID: ${proposal.id.slice(0, 8).toUpperCase()}`}</p>
              <p className="text-sm text-muted-foreground">Criada em {fmtDatetime(proposal.createdAt)}</p>
            </div>
            <Badge variant={cfg.variant} className="flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
            </Badge>
          </div>

          <Separator />

          {/* Proposal details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Pátio de Origem</p>
                  <p className="text-sm font-medium">{proposal.originYard?.name ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="text-sm font-medium">{proposal.deliveryLocation?.name ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{proposal.client?.name ?? "—"}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Data de Início</p>
                  <p className="text-sm font-medium">{fmt(proposal.startDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="text-sm font-medium">
                    {proposal.distanceKm ? `${Number(proposal.distanceKm).toLocaleString("pt-BR")} km` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Veículos / Motoristas</p>
                  <p className="text-sm font-medium">{proposal.totalSlots} veíc. / {proposal.occupiedSlots} motoristas</p>
                </div>
              </div>
            </div>
          </div>

          {proposal.notes && (
            <div className="bg-muted/40 rounded-md p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Observações</p>
              {proposal.notes}
            </div>
          )}

          {/* Drivers */}
          {detail?.driverResponses && detail.driverResponses.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Motoristas Vinculados
                </p>
                <div className="space-y-2">
                  {detail.driverResponses.map((dr: any) => (
                    <div key={dr.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                      <span className="font-medium">{dr.driver?.name ?? "—"}</span>
                      <div className="flex items-center gap-2">
                        {dr.assignedTransportId && (
                          <span className="text-xs text-muted-foreground">
                            Chassi: {dr.assignedTransport?.chassi ?? "—"}
                          </span>
                        )}
                        <Badge variant={dr.status === "aceito" ? "default" : dr.status === "recusado" ? "destructive" : "outline"} className="text-xs">
                          {dr.status === "aceito" ? "Aceito" : dr.status === "recusado" ? "Recusado" : "Pendente"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Logs */}
          <Separator />
          <div>
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Histórico de Ações
            </p>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : detail?.logs && detail.logs.length > 0 ? (
              <div className="space-y-2">
                {detail.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{log.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDatetime(log.createdAt)} — por {log.performedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RelatorioPropostasPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todas");
  const [filterClient, setFilterClient] = useState("todos");
  const [selectedProposal, setSelectedProposal] = useState<ProposalWithRelations | null>(null);

  const { data: proposals = [], isLoading } = useQuery<ProposalWithRelations[]>({
    queryKey: ["/api/transport-proposals"],
  });

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const closedProposals = proposals.filter(
    (p) => p.status === "encerrada" || p.status === "cancelada"
  );

  const filtered = closedProposals.filter((p) => {
    const matchSearch =
      !search ||
      p.originYard?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.deliveryLocation?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todas" || p.status === filterStatus;
    const matchClient = filterClient === "todos" || p.clientId === filterClient;
    return matchSearch && matchStatus && matchClient;
  });

  const totalEncerradas = closedProposals.filter(p => p.status === "encerrada").length;
  const totalCanceladas = closedProposals.filter(p => p.status === "cancelada").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Relatório de Propostas de Transporte"
        description="Histórico de propostas encerradas e canceladas"
        icon={<ClipboardList className="h-6 w-6" />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Encerradas</p>
            <p className="text-2xl font-bold text-green-600">{totalEncerradas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Canceladas</p>
            <p className="text-2xl font-bold text-red-500">{totalCanceladas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Registros</p>
            <p className="text-2xl font-bold">{closedProposals.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pátio, destino ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-propostas"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            <SelectItem value="encerrada">Encerradas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-client">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Origem</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Destino</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Distância</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Veíc.</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Motoristas</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>Nenhuma proposta encerrada ou cancelada encontrada.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const cfg = statusConfig[p.status] ?? statusConfig["encerrada"];
                  const Icon = cfg.icon;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedProposal(p)}
                      data-testid={`row-proposta-${p.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.proposalNumber || p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-medium">{p.client?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.originYard?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.deliveryLocation?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmt(p.startDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.distanceKm ? `${Number(p.distanceKm).toLocaleString("pt-BR")} km` : "—"}
                      </td>
                      <td className="px-4 py-3">{p.totalSlots}</td>
                      <td className="px-4 py-3">{p.occupiedSlots}</td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant} className="flex items-center gap-1 w-fit text-xs">
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => { e.stopPropagation(); setSelectedProposal(p); }}
                          data-testid={`button-historico-${p.id}`}
                        >
                          <History className="h-3.5 w-3.5" />
                          Histórico
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} {filtered.length === 1 ? "registro" : "registros"} encontrado{filtered.length !== 1 ? "s" : ""}
      </p>

      {selectedProposal && (
        <ProposalDetailDialog
          proposal={selectedProposal}
          open={!!selectedProposal}
          onClose={() => setSelectedProposal(null)}
        />
      )}
    </div>
  );
}
