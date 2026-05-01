import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardList,
  Plus,
  Search,
  Building2,
  MapPin,
  Calendar,
  Ruler,
  Users,
  Ban,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  Truck,
  UserCheck,
  UserX,
  Flame,
  AlertTriangle,
  Warehouse,
  FileText,
  DollarSign,
  ArrowDown,
  PackageCheck,
  Send,
  Wifi,
  Route,
  Navigation,
} from "lucide-react";
import type { Yard, Client, DeliveryLocation, Transport, TravelRate } from "@shared/schema";

interface RouteWithRelations {
  id: string;
  name: string;
  originYardId: string;
  destinationLocationId: string;
  distanceKm: string | null;
  originYard: Yard | null;
  destinationLocation: (DeliveryLocation & { clientId: string }) | null;
  client: { id: string; name: string } | null;
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
  computedStatus: "em_aberto" | "fechada" | "cancelada" | "pendente_aprovacao";
  notes: string | null;
  createdAt: string;
  originYard?: Yard;
  client?: Client;
  deliveryLocation?: DeliveryLocation;
  travelRate?: TravelRate | null;
  items: Transport[];
  driverResponses: any[];
}

const statusConfig = {
  em_aberto: { label: "Em Aberto", variant: "default" as const, icon: Clock, color: "text-blue-600" },
  pendente_aprovacao: { label: "Pendente Aprovação", variant: "outline" as const, icon: AlertTriangle, color: "text-amber-600" },
  fechada: { label: "Fechada", variant: "secondary" as const, icon: CheckCircle2, color: "text-green-600" },
  cancelada: { label: "Cancelada", variant: "destructive" as const, icon: XCircle, color: "text-red-500" },
};

const emptyForm = {
  originYardId: "",
  clientId: "",
  deliveryLocationId: "",
  travelRateId: "",
  startDate: "",
  notes: "",
  rateApprovalNote: "",
  advanceAmount: "",
  advanceMethod: "",
  transportIds: [] as string[],
};

export default function TransportProposalsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("em_aberto");
  const [filterChassi, setFilterChassi] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [selectedTransportIds, setSelectedTransportIds] = useState<string[]>([]);
  const [showCreateRouteDialog, setShowCreateRouteDialog] = useState(false);
  const [newRouteForm, setNewRouteForm] = useState({ name: "", originYardId: "", clientId: "", destinationLocationId: "", distanceKm: "" });
  const [newRouteCalcLoading, setNewRouteCalcLoading] = useState(false);
  const [appliedRouteId, setAppliedRouteId] = useState<string | null>(null);
  const [routeLockedFromTransport, setRouteLockedFromTransport] = useState(false);

  const { data: proposals = [], isLoading } = useQuery<ProposalWithRelations[]>({
    queryKey: ["/api/transport-proposals"],
    refetchInterval: 60000,
  });

  const { data: yards = [] } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: allDeliveryLocations = [] } = useQuery<DeliveryLocation[]>({ queryKey: ["/api/delivery-locations"] });
  const { data: allTransports = [] } = useQuery<any[]>({ queryKey: ["/api/transports"], refetchInterval: 60000 });
  const { data: travelRates = [] } = useQuery<TravelRate[]>({ queryKey: ["/api/travel-rates"] });
  const { data: onlineData } = useQuery<{ count: number }>({ queryKey: ["/api/drivers/online-count"], refetchInterval: 30000 });
  const { data: savedRoutes = [], isSuccess: savedRoutesLoaded } = useQuery<RouteWithRelations[]>({ queryKey: ["/api/routes"] });

  const [pendingTransportId, setPendingTransportId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("transportId");
    if (id) window.history.replaceState({}, "", window.location.pathname);
    return id;
  });

  useEffect(() => {
    if (!pendingTransportId) return;
    if (!allTransports.length || !allDeliveryLocations.length || !savedRoutesLoaded) return;
    const transport = allTransports.find((t: any) => t.id === pendingTransportId);
    if (!transport) return;

    // Try to find a matching saved route for this transport
    const matchingRoute = savedRoutes.find(
      r => r.originYardId === transport.originYardId && r.destinationLocationId === transport.deliveryLocationId
    );

    // Convert transitStartedAt to datetime-local format (YYYY-MM-DDTHH:MM) in local time
    const toDatetimeLocal = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const prefillStartDate = transport.transitStartedAt ? toDatetimeLocal(transport.transitStartedAt) : "";

    if (matchingRoute) {
      applyRoute(matchingRoute);
      setRouteLockedFromTransport(true);
    } else {
      setForm(f => ({
        ...f,
        originYardId: transport.originYardId ?? "",
        clientId: transport.clientId ?? "",
        deliveryLocationId: transport.deliveryLocationId ?? "",
      }));
    }

    if (prefillStartDate) {
      setForm(f => ({ ...f, startDate: prefillStartDate }));
    }

    setSelectedTransportIds([pendingTransportId]);
    setShowCreate(true);
    setPendingTransportId(null);
  }, [pendingTransportId, allTransports, allDeliveryLocations, savedRoutes, savedRoutesLoaded]);

  const filteredDeliveryLocations = allDeliveryLocations.filter(dl => dl.clientId === form.clientId);
  const pendingTransports = allTransports.filter(t =>
    t.status === "pendente" &&
    t.originYardId === form.originYardId &&
    t.deliveryLocationId === form.deliveryLocationId
  );

  const selectedYard = yards.find(y => y.id === form.originYardId);
  const selectedLocation = allDeliveryLocations.find(l => l.id === form.deliveryLocationId);

  async function calculateDistance() {
    if (!selectedYard || !selectedLocation) return;
    setDistanceLoading(true);
    try {
      const hasCoords =
        selectedYard.latitude && selectedYard.longitude &&
        selectedLocation.latitude && selectedLocation.longitude;

      let distanceKm: number | null = null;

      if (hasCoords) {
        const res = await apiRequest("POST", "/api/routing/calculate", {
          origin: {
            lat: parseFloat(selectedYard.latitude!),
            lng: parseFloat(selectedYard.longitude!),
          },
          destination: {
            lat: parseFloat(selectedLocation.latitude!),
            lng: parseFloat(selectedLocation.longitude!),
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erro ao calcular rota");
        distanceKm = data.distance?.value ? data.distance.value / 1000 : null;
      } else {
        const originAddress = [
          selectedYard.address,
          selectedYard.city,
          selectedYard.state,
          "Brasil",
        ].filter(Boolean).join(", ");
        const destinationAddress = [
          selectedLocation.address,
          selectedLocation.city,
          selectedLocation.state,
          "Brasil",
        ].filter(Boolean).join(", ");
        const res = await apiRequest("POST", "/api/routing/distance-by-address", {
          originAddress,
          destinationAddress,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Endereço não encontrado");
        distanceKm = data.distance?.value ? data.distance.value / 1000 : null;
      }

      setCalculatedDistance(distanceKm);
      if (distanceKm) {
        toast({ title: "Distância calculada", description: `${distanceKm.toFixed(1)} km via Google Maps.` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao calcular distância", description: err?.message ?? "Verifique se o pátio e local de entrega possuem endereço cadastrado.", variant: "destructive" });
    } finally {
      setDistanceLoading(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: typeof form & { distanceKm?: number | null }) =>
      apiRequest("POST", "/api/transport-proposals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-proposals"] });
      setShowCreate(false);
      setForm(emptyForm);
      setCalculatedDistance(null);
      setSelectedTransportIds([]);
      setAppliedRouteId(null);
      setRouteLockedFromTransport(false);
      toast({ title: "Proposta criada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar proposta", description: err.message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/transport-proposals/${id}`, { status: "cancelada" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport-proposals"] });
      setCloseId(null);
      toast({ title: "Proposta encerrada com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao encerrar proposta", description: err.message, variant: "destructive" });
    },
  });

  const filtered = proposals.filter(p => {
    const matchSearch =
      p.originYard?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.deliveryLocation?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      (p.proposalNumber && p.proposalNumber.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = filterStatus === "all" || p.computedStatus === filterStatus;
    const matchChassi = !filterChassi.trim() ||
      p.items.some((t: any) => t?.vehicleChassi?.toLowerCase().includes(filterChassi.trim().toLowerCase()));
    return matchSearch && matchStatus && matchChassi;
  }).sort((a, b) => {
    const aEmergency = a.isEmergency === "true" ? 1 : 0;
    const bEmergency = b.isEmergency === "true" ? 1 : 0;
    if (aEmergency !== bEmergency) return bEmergency - aEmergency;
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  function toggleTransport(id: string) {
    setSelectedTransportIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const newRouteFilteredLocations = allDeliveryLocations.filter(
    dl => dl.clientId === newRouteForm.clientId && (dl as any).isActive !== "false"
  );

  function applyRoute(route: RouteWithRelations) {
    const clientId = route.client?.id ?? route.destinationLocation?.clientId ?? "";
    setForm(f => ({
      ...f,
      originYardId: route.originYardId,
      clientId,
      deliveryLocationId: route.destinationLocationId,
    }));
    if (route.distanceKm) {
      setCalculatedDistance(parseFloat(route.distanceKm));
    } else {
      setCalculatedDistance(null);
    }
    setAppliedRouteId(route.id);
    setSelectedTransportIds([]);
  }

  async function calculateNewRouteDistance(yardId: string, locationId: string) {
    if (!yardId || !locationId) return;
    setNewRouteCalcLoading(true);
    try {
      const res = await apiRequest("POST", "/api/routes/calculate-route", {
        originYardId: yardId,
        destinationLocationId: locationId,
        truckAxles: "2",
      });
      const data = await res.json();
      if (data.distanceKm) {
        setNewRouteForm(f => ({ ...f, distanceKm: String(parseFloat(data.distanceKm).toFixed(1)) }));
      }
    } catch {
      // user can enter manually
    } finally {
      setNewRouteCalcLoading(false);
    }
  }

  const createRouteMutation = useMutation({
    mutationFn: (data: { name: string; originYardId: string; destinationLocationId: string; distanceKm?: string }) =>
      apiRequest("POST", "/api/routes", data),
    onSuccess: async (res) => {
      const created: RouteWithRelations = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: `Rota "${created.name}" criada!`, description: "A rota foi aplicada à proposta." });
      applyRoute(created);
      setShowCreateRouteDialog(false);
      setNewRouteForm({ name: "", originYardId: "", clientId: "", destinationLocationId: "", distanceKm: "" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar rota", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit() {
    if (!form.originYardId || !form.clientId || !form.deliveryLocationId || !form.startDate) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const selectedRate = travelRates.find(r => r.id === form.travelRateId);
    if (selectedRate?.requiresApproval === "true" && !form.rateApprovalNote.trim()) {
      toast({ title: "Informe o motivo da tarifa especial", description: "O campo de motivo é obrigatório para tarifas que requerem aprovação.", variant: "destructive" });
      return;
    }
    const approxValue = calculatedDistance && selectedRate ? calculatedDistance * Number(selectedRate.rateValue) : null;
    // Ensure startDate is a fully qualified ISO string (datetime-local gives "YYYY-MM-DDTHH:mm" without seconds)
    const startDateISO = form.startDate
      ? new Date(form.startDate.length === 16 ? `${form.startDate}:00` : form.startDate).toISOString()
      : form.startDate;
    createMutation.mutate({
      ...form,
      startDate: startDateISO,
      travelRateId: form.travelRateId || null,
      rateApprovalNote: selectedRate?.requiresApproval === "true" ? form.rateApprovalNote.trim() : null,
      transportIds: selectedTransportIds,
      distanceKm: calculatedDistance,
      estimatedValue: approxValue ? approxValue.toFixed(2) : null,
      advanceAmount: form.advanceAmount ? form.advanceAmount : null,
      advanceMethod: form.advanceMethod || null,
    });
  }

  const transportCounts = {
    total: allTransports.length,
    withDriver: allTransports.filter((t: any) => t.driverId).length,
    withoutDriver: allTransports.filter((t: any) => !t.driverId).length,
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Propostas de Transporte"
        breadcrumbs={[{ label: "Operação", href: "/transportes" }, { label: "Propostas de Transporte" }]}
        actions={
          <Button onClick={() => setShowCreate(true)} data-testid="button-nova-proposta">
            <Plus className="h-4 w-4 mr-2" />
            Nova Proposta
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Truck className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="count-total-transports">{transportCounts.total}</p>
                  <p className="text-sm text-muted-foreground">Transportes Criados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <UserCheck className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="count-with-driver">{transportCounts.withDriver}</p>
                  <p className="text-sm text-muted-foreground">Com Motorista</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <UserX className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="count-without-driver">{transportCounts.withoutDriver}</p>
                  <p className="text-sm text-muted-foreground">Sem Motorista</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Wifi className="h-8 w-8 text-emerald-500" />
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400" data-testid="count-online-drivers">{onlineData?.count ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Motoristas Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por pátio, cliente ou local..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <div className="relative w-52">
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 font-mono"
              placeholder="Filtrar por chassi..."
              value={filterChassi}
              onChange={e => setFilterChassi(e.target.value)}
              data-testid="input-filter-chassi"
            />
            {filterChassi && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setFilterChassi("")}
                data-testid="button-clear-chassi-filter"
                type="button"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="em_aberto">Em Aberto</SelectItem>
              <SelectItem value="pendente_aprovacao">Pendente Aprovação</SelectItem>
              <SelectItem value="fechada">Fechada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhuma proposta encontrada</p>
            <p className="text-sm">Crie uma nova proposta de transporte para os motoristas.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_1fr_120px_120px_80px_80px_80px_40px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b items-center">
              <span className="w-5" />
              <span>Pátio / Origem</span>
              <span>Cliente / Destino</span>
              <span>Criação</span>
              <span>Saída</span>
              <span>Dist.</span>
              <span>Slots</span>
              <span>Status</span>
              <span />
            </div>
            <div className="divide-y">
              {filtered.map(p => {
                const cfg = statusConfig[p.computedStatus] ?? statusConfig.em_aberto;
                const StatusIcon = cfg.icon;
                const now = new Date();
                const startDateObj = p.startDate ? new Date(p.startDate) : null;
                const hoursUntilStart = startDateObj ? (startDateObj.getTime() - now.getTime()) / (1000 * 60 * 60) : null;
                const isUrgent = p.computedStatus === "em_aberto" && hoursUntilStart !== null && hoursUntilStart >= 0 && hoursUntilStart <= 48;
                const isEmergency = p.isEmergency === "true";
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[auto_1fr_1fr_120px_120px_80px_80px_80px_40px] gap-2 px-3 py-2.5 items-center hover:bg-muted/30 cursor-pointer transition-colors ${isEmergency ? "animate-emergency-pulse bg-red-50/80 border-l-4 border-l-red-500" : isUrgent ? "bg-orange-50/60" : ""}`}
                    onClick={() => navigate(`/proposta-transporte/${p.id}`)}
                    data-testid={`row-proposal-${p.id}`}
                  >
                    <div className="w-5 flex items-center justify-center">
                      {isEmergency ? (
                        <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" data-testid={`badge-emergency-${p.id}`} />
                      ) : isUrgent ? (
                        <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" data-testid={`badge-urgent-${p.id}`} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.originYard?.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground truncate font-mono">{p.proposalNumber || `#${p.id.slice(0, 8)}`}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{p.client?.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.deliveryLocation?.name ?? "-"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground" data-testid={`text-created-${p.id}`}>
                      {p.createdAt ? format(new Date(p.createdAt), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                    </span>
                    <span className={`text-xs ${isUrgent ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>
                      {startDateObj ? format(startDateObj, "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.distanceKm ? `${Number(p.distanceKm).toFixed(0)} km` : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.occupiedSlots}/{p.totalSlots}
                    </span>
                    <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0 h-5 justify-center">
                      {cfg.label}
                    </Badge>
                    <div onClick={e => e.stopPropagation()}>
                      {p.computedStatus !== "cancelada" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setCloseId(p.id)}
                          title="Encerrar proposta"
                          data-testid={`button-close-${p.id}`}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { setShowCreate(open); if (!open) { setForm(emptyForm); setCalculatedDistance(null); setSelectedTransportIds([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                  <ClipboardList className="h-5 w-5" />
                </div>
                Nova Proposta de Transporte
              </DialogTitle>
              <DialogDescription className="text-muted-foreground ml-[56px]">
                Configure a rota, tarifa e vincule os transportes
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Rota do Transporte</h3>
                </div>
              </div>

              {/* Route selector from saved routes */}
              <div className="mb-4 space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Route className="h-3 w-3" />
                  Selecionar Rota Salva
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={appliedRouteId ?? ""}
                    onValueChange={(id) => {
                      if (routeLockedFromTransport) return;
                      const route = savedRoutes.find(r => r.id === id);
                      if (route) applyRoute(route);
                    }}
                    disabled={routeLockedFromTransport}
                  >
                    <SelectTrigger
                      className={`h-10 ${routeLockedFromTransport ? "bg-muted/60 cursor-not-allowed opacity-80" : ""}`}
                      data-testid="select-saved-route"
                    >
                      <div className="flex items-center gap-2">
                        <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <SelectValue placeholder={savedRoutes.length === 0 ? "Nenhuma rota salva" : "Escolha uma rota salva..."} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {savedRoutes.length === 0 ? (
                        <SelectItem value="__none__" disabled>Nenhuma rota cadastrada</SelectItem>
                      ) : (
                        savedRoutes.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{r.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {r.originYard?.name ?? "—"} → {r.client?.name ?? "—"}
                                {r.distanceKm ? ` • ${parseFloat(r.distanceKm).toFixed(0)} km` : ""}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {!routeLockedFromTransport && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0 gap-1.5 text-xs"
                      onClick={() => setShowCreateRouteDialog(true)}
                      data-testid="button-new-saved-route"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nova Rota
                    </Button>
                  )}
                </div>
              </div>

              {appliedRouteId && form.originYardId && form.deliveryLocationId ? (
                <div className="relative flex flex-col gap-0">
                  <div className="absolute left-[19px] top-[40px] bottom-[40px] w-[2px] bg-gradient-to-b from-indigo-500 via-indigo-300 to-emerald-500 z-0 rounded-full" />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                      <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Origem — Pátio</span>
                    </div>
                    <div className="ml-7 rounded-lg border bg-muted/40 px-3 py-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Warehouse className="h-4 w-4 shrink-0 text-indigo-600" />
                        {selectedYard?.name ?? "—"}
                      </p>
                      {selectedYard && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-6">{[selectedYard.address, selectedYard.city, selectedYard.state].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center my-1.5 relative z-10">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-b from-indigo-100 to-emerald-100 dark:from-indigo-900/30 dark:to-emerald-900/30 border shadow-sm">
                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Destino — Local de Entrega</span>
                    </div>
                    <div className="ml-7 rounded-lg border bg-muted/40 px-3 py-2 space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        {clients.find(c => c.id === form.clientId)?.name ?? "—"}
                      </p>
                      <p className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
                        {selectedLocation ? `${selectedLocation.name} – ${selectedLocation.city}/${selectedLocation.state}` : "—"}
                      </p>
                      {selectedLocation && (
                        <p className="text-xs text-muted-foreground ml-6">{[selectedLocation.address, selectedLocation.addressNumber].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  Selecione uma rota acima para definir a origem e o destino
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">Programação e Distância</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Data Início de Viagem *
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="h-11"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <PackageCheck className="h-3 w-3" />
                    Total de Slots
                  </Label>
                  <div
                    className="flex h-11 w-full items-center rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
                    data-testid="display-total-slots"
                  >
                    {selectedTransportIds.length} {selectedTransportIds.length === 1 ? "chassi selecionado" : "chassis selecionados"}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Ruler className="h-3 w-3" />
                  Distância (km)
                  {appliedRouteId && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                      <Route className="h-2.5 w-2.5" />
                      da rota salva
                    </span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Distância em km"
                    value={calculatedDistance ?? ""}
                    onChange={e => setCalculatedDistance(e.target.value ? parseFloat(e.target.value) : null)}
                    className={`h-11 ${appliedRouteId ? "bg-muted/60 cursor-not-allowed text-muted-foreground" : ""}`}
                    readOnly={!!appliedRouteId}
                    data-testid="input-distance"
                  />
                  {!appliedRouteId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={calculateDistance}
                      disabled={distanceLoading || !form.originYardId || !form.deliveryLocationId}
                      className="h-11 shrink-0"
                      data-testid="button-calc-distance"
                    >
                      {distanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ruler className="h-4 w-4" />}
                      Calcular
                    </Button>
                  )}
                </div>
                {appliedRouteId && (
                  <p className="text-xs text-muted-foreground">
                    Distância definida pela rota selecionada.{" "}
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() => setAppliedRouteId(null)}
                    >
                      Editar manualmente
                    </button>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-green-600" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">Tarifa e Valor</h3>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="h-3 w-3" />
                    Tarifa de Viagem
                  </Label>
                  <Select
                    value={form.travelRateId}
                    onValueChange={v => {
                      const rate = travelRates.find(r => r.id === v);
                      setForm(f => ({ ...f, travelRateId: v, rateApprovalNote: rate?.requiresApproval === "true" ? f.rateApprovalNote : "" }));
                    }}
                  >
                    <SelectTrigger data-testid="select-travel-rate" className="h-11">
                      <SelectValue placeholder="Selecione a tarifa" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...(travelRates.filter(r => r.isActive === "true"))].sort((a, b) => {
                        const aPadrao = a.name.toLowerCase().includes("padrão") || a.name.toLowerCase().includes("padrao");
                        const bPadrao = b.name.toLowerCase().includes("padrão") || b.name.toLowerCase().includes("padrao");
                        return aPadrao === bPadrao ? 0 : aPadrao ? -1 : 1;
                      }).map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}{r.requiresApproval === "true" ? " (requer aprovação)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.travelRateId && travelRates.find(r => r.id === form.travelRateId)?.requiresApproval === "true" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Esta tarifa é especial e requerirá aprovação antes de ser processada.
                      </p>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-700 dark:text-amber-400">
                          Motivo da solicitação <span className="font-bold">(obrigatório)</span>
                        </Label>
                        <Textarea
                          value={form.rateApprovalNote}
                          onChange={e => setForm(f => ({ ...f, rateApprovalNote: e.target.value }))}
                          placeholder="Descreva o motivo pelo qual esta tarifa especial é necessária para esta proposta..."
                          rows={3}
                          className="text-xs resize-none bg-white dark:bg-amber-950/40 border-amber-200 dark:border-amber-700 focus-visible:ring-amber-400/40"
                          data-testid="textarea-rate-approval-note"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {(() => {
                  const selectedRate = travelRates.find(r => r.id === form.travelRateId);
                  const approxValue = calculatedDistance && selectedRate ? calculatedDistance * Number(selectedRate.rateValue) : null;
                  return (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <DollarSign className="h-3 w-3" />
                        Valor Aproximado
                      </Label>
                      <div
                        className={`flex h-11 w-full items-center rounded-lg border px-3 py-2 text-sm font-semibold ${approxValue !== null ? "bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400" : "bg-muted/50 border-input text-muted-foreground"}`}
                        data-testid="display-approx-value"
                      >
                        {approxValue !== null
                          ? `R$ ${approxValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "Preencha distância e tarifa"
                        }
                      </div>
                      {approxValue !== null && calculatedDistance && selectedRate && (
                        <p className="text-xs text-muted-foreground">
                          {calculatedDistance.toFixed(1)} km × R$ {Number(selectedRate.rateValue).toFixed(2)}/km
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Truck className="h-3.5 w-3.5 text-cyan-600" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">Transportes Vinculados</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Selecione um ou mais transportes existentes para incluir nesta proposta.</p>
              {pendingTransports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <Truck className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">
                    {!form.originYardId || !form.deliveryLocationId
                      ? "Selecione o pátio de saída e o local de entrega para ver os transportes disponíveis."
                      : "Nenhum transporte pendente disponível para este pátio e local de entrega."}
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                    <span className="w-4 shrink-0" />
                    <span className="font-mono shrink-0 w-24">Nº</span>
                    <span className="flex-1">Chassi</span>
                    <span className="shrink-0 w-28">Início viagem</span>
                    <span className="shrink-0 w-20">Entrega</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y">
                  {pendingTransports.map(t => (
                    <label
                      key={t.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${selectedTransportIds.includes(t.id) ? "bg-primary/5" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTransportIds.includes(t.id)}
                        onChange={() => toggleTransport(t.id)}
                        className="rounded"
                        data-testid={`checkbox-transport-${t.id}`}
                      />
                      <span className="text-sm font-mono shrink-0">{t.requestNumber}</span>
                      <span className="text-sm text-muted-foreground truncate flex-1">{t.vehicleChassi}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t.transitStartedAt
                          ? format(new Date(t.transitStartedAt), "dd/MM/yy HH:mm", { locale: ptBR })
                          : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t.deliveryDate
                          ? format(new Date(t.deliveryDate), "dd/MM/yy", { locale: ptBR })
                          : "—"}
                      </span>
                    </label>
                  ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-green-600" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">Adiantamento</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">Valor de Adiantamento (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={form.advanceAmount}
                    onChange={e => setForm(f => ({ ...f, advanceAmount: e.target.value }))}
                    className="rounded-lg"
                    data-testid="input-advance-amount"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1 block">Forma do Adiantamento</Label>
                  <Select
                    value={form.advanceMethod || undefined}
                    onValueChange={v => setForm(f => ({ ...f, advanceMethod: v }))}
                  >
                    <SelectTrigger className="rounded-lg" data-testid="select-advance-method">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="credito_conta">Crédito em conta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                  <FileText className="h-3.5 w-3.5 text-violet-600" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">Observações</h3>
              </div>
              <Textarea
                placeholder="Informações adicionais sobre a proposta..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="rounded-lg"
                data-testid="input-notes"
              />
            </div>

          </div>

          <div className="flex items-center gap-3 px-6 py-4 border-t bg-muted/30 flex-shrink-0">
            <Button variant="outline" onClick={() => { setShowCreate(false); setRouteLockedFromTransport(false); setAppliedRouteId(null); setForm(emptyForm); setCalculatedDistance(null); setSelectedTransportIds([]); }} className="flex-1">Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-md"
              data-testid="button-submit-create"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Criar Proposta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Route Mini-Dialog */}
      <Dialog open={showCreateRouteDialog} onOpenChange={(open) => { setShowCreateRouteDialog(open); if (!open) setNewRouteForm({ name: "", originYardId: "", clientId: "", destinationLocationId: "", distanceKm: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              Nova Rota
            </DialogTitle>
            <DialogDescription>Crie uma rota e ela será aplicada automaticamente à proposta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome da Rota *</Label>
              <Input
                placeholder="Ex: SP → Santos"
                value={newRouteForm.name}
                onChange={e => setNewRouteForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-new-route-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pátio de Origem *</Label>
              <Select value={newRouteForm.originYardId} onValueChange={v => { setNewRouteForm(f => ({ ...f, originYardId: v, distanceKm: "" })); }}>
                <SelectTrigger data-testid="select-new-route-yard">
                  <SelectValue placeholder="Selecione o pátio" />
                </SelectTrigger>
                <SelectContent>
                  {yards.filter(y => y.isActive !== "false").map(y => (
                    <SelectItem key={y.id} value={y.id}>{y.name}{y.city ? ` — ${y.city}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente *</Label>
              <Select value={newRouteForm.clientId} onValueChange={v => setNewRouteForm(f => ({ ...f, clientId: v, destinationLocationId: "", distanceKm: "" }))}>
                <SelectTrigger data-testid="select-new-route-client">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.isActive !== "false").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Local de Entrega *</Label>
              <Select
                value={newRouteForm.destinationLocationId}
                onValueChange={v => {
                  setNewRouteForm(f => ({ ...f, destinationLocationId: v, distanceKm: "" }));
                  calculateNewRouteDistance(newRouteForm.originYardId, v);
                }}
                disabled={!newRouteForm.clientId}
              >
                <SelectTrigger data-testid="select-new-route-location">
                  <SelectValue placeholder={newRouteForm.clientId ? "Selecione o local" : "Selecione o cliente primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {newRouteFilteredLocations.length === 0 ? (
                    <SelectItem value="__none__" disabled>Nenhum local para este cliente</SelectItem>
                  ) : (
                    newRouteFilteredLocations.map(dl => (
                      <SelectItem key={dl.id} value={dl.id}>{dl.name}{dl.city ? ` — ${dl.city}` : ""}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                Distância (km)
                {newRouteCalcLoading && <span className="flex items-center gap-1 text-muted-foreground font-normal"><Loader2 className="h-3 w-3 animate-spin" /> Calculando...</span>}
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="Ex: 120.5"
                value={newRouteForm.distanceKm}
                onChange={e => setNewRouteForm(f => ({ ...f, distanceKm: e.target.value }))}
                data-testid="input-new-route-km"
              />
              <p className="text-xs text-muted-foreground">Calculado automaticamente ao selecionar origem e destino.</p>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setShowCreateRouteDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!newRouteForm.name || !newRouteForm.originYardId || !newRouteForm.destinationLocationId) {
                  toast({ title: "Preencha nome, pátio e local de entrega", variant: "destructive" });
                  return;
                }
                createRouteMutation.mutate({
                  name: newRouteForm.name,
                  originYardId: newRouteForm.originYardId,
                  destinationLocationId: newRouteForm.destinationLocationId,
                  distanceKm: newRouteForm.distanceKm || undefined,
                });
              }}
              disabled={createRouteMutation.isPending}
              data-testid="button-save-new-route"
            >
              {createRouteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar e Aplicar Rota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Proposal Alert */}
      <AlertDialog open={!!closeId} onOpenChange={open => !open && setCloseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              A proposta será encerrada e não poderá mais ser editada. Todo o histórico será mantido para consulta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => closeId && closeMutation.mutate(closeId)}
              data-testid="button-confirm-close"
            >
              {closeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
