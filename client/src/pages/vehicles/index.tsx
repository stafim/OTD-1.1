import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, History, User, Clock, Truck, Building2, Navigation, Camera, Car, Gauge, AlertTriangle, Download, MapPin, Loader2, Copy, Check, ArrowRight, ArrowRightLeft, Package, Route, ChevronsUpDown } from "lucide-react";
import { VehicleFormDialog } from "./form-dialog";
import * as XLSX from "xlsx";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { normalizeImageUrl, cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import type { Vehicle, Manufacturer, Client, Collect, Driver, Yard, DeliveryLocation, Transfer } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type CollectWithRelations = Collect & {
  manufacturer?: Manufacturer;
  yard?: Yard;
  driver?: Driver | null;
};

type TransportWithRelations = {
  id: string;
  vehicleChassi: string;
  clientId: string;
  originYardId: string;
  deliveryLocationId: string;
  driverId: string | null;
  status: string;
  deliveryDate: string | null;
  scheduledDeparture: string | null;
  notes: string | null;
  createdAt: string | null;
  transitStartedAt: string | null;
  checkinDateTime: string | null;
  checkinLocation: { coordinates: number[] } | null;
  checkinSelfiePhoto: string | null;
  checkinOdometerPhoto: string | null;
  checkinFrontalPhoto: string | null;
  checkinLateral1Photo: string | null;
  checkinLateral2Photo: string | null;
  checkinTraseiraPhoto: string | null;
  checkinFuelLevelPhoto: string | null;
  checkinDamagePhotos: string[] | null;
  checkinNotes: string | null;
  checkoutDateTime: string | null;
  checkoutLocation: { coordinates: number[] } | null;
  checkoutSelfiePhoto: string | null;
  checkoutOdometerPhoto: string | null;
  checkoutFrontalPhoto: string | null;
  checkoutLateral1Photo: string | null;
  checkoutLateral2Photo: string | null;
  checkoutTraseiraPhoto: string | null;
  checkoutFuelLevelPhoto: string | null;
  checkoutDamagePhotos: string[] | null;
  checkoutNotes: string | null;
  routeDistanceKm: string | null;
  routeDurationMinutes: number | null;
  estimatedTolls: string | null;
  estimatedFuel: string | null;
  originYard?: Yard | null;
  deliveryLocation?: DeliveryLocation | null;
  driver?: Driver | null;
  client?: Client | null;
};

type TransferWithRelations = Transfer & {
  originYard?: Yard | null;
  destinationYard?: Yard | null;
  driver?: Driver | null;
};

type VehicleJourney = {
  vehicle: Vehicle & {
    manufacturer?: Manufacturer | null;
    yard?: Yard | null;
    client?: Client | null;
  };
  collects: CollectWithRelations[];
  transports: TransportWithRelations[];
  transfers: TransferWithRelations[];
};

const statusOptions = [
  { value: "all", label: "Todos os Status" },
  { value: "pre_estoque", label: "Pré-estoque" },
  { value: "em_estoque", label: "Em estoque" },
  { value: "despachado", label: "Despachado" },
  { value: "entregue", label: "Entregue" },
  { value: "retirado", label: "Retirado" },
];

export default function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [deleteChassi, setDeleteChassi] = useState<string | null>(null);
  const [historyChassi, setHistoryChassi] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChassi, setEditingChassi] = useState<string | null>(null);
  const [copiedChassi, setCopiedChassi] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Assign client dialog state
  const [assignClientVehicle, setAssignClientVehicle] = useState<Vehicle | null>(null);
  const [assignClientId, setAssignClientId] = useState("");
  const [assignClientPopoverOpen, setAssignClientPopoverOpen] = useState(false);

  const { data: vehicleJourney, isLoading: isLoadingJourney } = useQuery<VehicleJourney>({
    queryKey: ["/api/vehicle-journey", historyChassi],
    enabled: !!historyChassi,
  });

  const { data: vehicles, isLoading } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: manufacturers } = useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: yards } = useQuery<Yard[]>({
    queryKey: ["/api/yards"],
  });

  const getManufacturerName = (manufacturerId: string | null) => {
    if (!manufacturerId) return "-";
    const manufacturer = manufacturers?.find(m => m.id === manufacturerId);
    return manufacturer?.name || "-";
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "-";
    const client = clients?.find(c => c.id === clientId);
    return client?.name || "-";
  };

  const getYardName = (yardId: string | null | undefined) => {
    if (!yardId) return "-";
    const yard = yards?.find(y => y.id === yardId);
    return yard?.name || "-";
  };

  const deleteMutation = useMutation({
    mutationFn: async (chassi: string) => {
      await apiRequest("DELETE", `/api/vehicles/${chassi}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Veículo excluído com sucesso" });
      setDeleteChassi(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir veículo", variant: "destructive" });
    },
  });

  const assignClientMutation = useMutation({
    mutationFn: async ({ chassi, clientId }: { chassi: string; clientId: string }) =>
      apiRequest("PATCH", `/api/vehicles/${encodeURIComponent(chassi)}`, { clientId }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Cliente vinculado com sucesso!" });
      setAssignClientVehicle(null);
      setAssignClientId("");
      setAssignClientPopoverOpen(false);
    },
    onError: () => toast({ title: "Erro ao vincular cliente", variant: "destructive" }),
  });

  const filteredData = vehicles?.filter((v) => {
    const manufacturerName = getManufacturerName(v.manufacturerId);
    const matchesSearch =
      v.chassi.toLowerCase().includes(search.toLowerCase()) ||
      manufacturerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || v.status === statusFilter;
    const matchesClient = clientFilter === "all" || v.clientId === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  const statusLabels: Record<string, string> = {
    pre_estoque: "Pré-estoque",
    em_estoque: "Em estoque",
    despachado: "Despachado",
    entregue: "Entregue",
    retirado: "Retirado",
  };

  const handleNew = () => {
    setEditingChassi(null);
    setDialogOpen(true);
  };

  const handleEdit = (v: Vehicle) => {
    setEditingChassi(v.chassi);
    setDialogOpen(true);
  };

  const handleExportExcel = () => {
    if (!vehicles || vehicles.length === 0) {
      toast({ title: "Nenhum veículo para exportar", variant: "destructive" });
      return;
    }

    const exportData = vehicles.map((v) => ({
      Chassi: v.chassi,
      Cliente: getClientName(v.clientId),
      Pátio: getYardName(v.yardId),
      Status: statusLabels[v.status] || v.status,
      "Data Entrada": v.yardEntryDateTime
        ? format(new Date(v.yardEntryDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : v.createdAt
        ? format(new Date(v.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "-",
      "Data Retirada": v.dispatchDateTime
        ? format(new Date(v.dispatchDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : "-",
      Montadora: getManufacturerName(v.manufacturerId),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    
    const colWidths = [
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
    ];
    ws["!cols"] = colWidths;

    const fileName = `estoque_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast({ title: "Planilha exportada com sucesso!" });
  };

  const columns = [
    {
      key: "chassi",
      label: "Chassi",
      render: (v: Vehicle) => (
        <div className="flex items-center gap-1.5 group/chassi">
          <span className="font-mono text-sm">{v.chassi}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(v.chassi);
              setCopiedChassi(v.chassi);
              setTimeout(() => setCopiedChassi(null), 2000);
            }}
            className="opacity-0 group-hover/chassi:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            title="Copiar chassi"
            data-testid={`button-copy-chassi-${v.chassi}`}
          >
            {copiedChassi === v.chassi
              ? <Check className="h-3.5 w-3.5 text-green-500" />
              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </button>
        </div>
      ),
    },
    {
      key: "clientId",
      label: "Cliente",
      render: (v: Vehicle) => getClientName(v.clientId),
    },
    {
      key: "yardId",
      label: "Pátio",
      render: (v: Vehicle) => getYardName(v.yardId),
    },
    {
      key: "status",
      label: "Status",
      render: (v: Vehicle) => <StatusBadge status={v.status} />,
    },
    {
      key: "yardEntryDateTime",
      label: "Data Entrada",
      render: (v: Vehicle) =>
        v.yardEntryDateTime
          ? format(new Date(v.yardEntryDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : v.createdAt
          ? format(new Date(v.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "-",
    },
    {
      key: "dispatchDateTime",
      label: "Data Retirada",
      render: (v: Vehicle) =>
        v.dispatchDateTime
          ? format(new Date(v.dispatchDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "-",
    },
    {
      key: "actions",
      label: "",
      className: "w-40",
      render: (v: Vehicle) => (
        <div className="flex items-center gap-1">
          {v.status === "em_estoque" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setAssignClientVehicle(v);
                setAssignClientId(v.clientId ?? "");
              }}
              data-testid={`button-assign-client-${v.chassi}`}
              title="Vincular Cliente"
            >
              <User className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryChassi(v.chassi);
            }}
            data-testid={`button-history-${v.chassi}`}
            title="Histórico do chassi"
          >
            <History className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(v);
            }}
            data-testid={`button-edit-${v.chassi}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteChassi(v.chassi);
            }}
            data-testid={`button-delete-${v.chassi}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const stockSummary = useMemo(() => {
    const all = vehicles ?? [];
    const count = (status: string) => all.filter(v => v.status === status).length;
    return {
      total: all.length,
      preEstoque: count("pre_estoque"),
      emEstoque: count("em_estoque"),
      emTransporte: count("em_transporte"),
      emTransferencia: count("em_transferencia"),
      despachado: count("despachado"),
      entregue: count("entregue"),
    };
  }, [vehicles]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Estoque de Veículos"
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Estoque" },
        ]}
      />

      {/* Resumo do Estoque */}
      <div className="px-4 md:px-6 pt-4 pb-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border bg-card" data-testid="card-summary-total">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total</p>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{stockSummary.total}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">veículos</p>
            </CardContent>
          </Card>
          <Card className="border bg-card" data-testid="card-summary-pre-estoque">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Pré-Estoque</p>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-yellow-600 dark:text-yellow-400">{stockSummary.preEstoque}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">aguardando</p>
            </CardContent>
          </Card>
          <Card className="border bg-card" data-testid="card-summary-em-estoque">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Em Estoque</p>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{stockSummary.emEstoque}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">no pátio</p>
            </CardContent>
          </Card>
          <Card className="border bg-card" data-testid="card-summary-em-transporte">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Em Transporte</p>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{stockSummary.emTransporte}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">em trânsito</p>
            </CardContent>
          </Card>
          <Card className="border bg-card" data-testid="card-summary-em-transferencia">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Transferência</p>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400">{stockSummary.emTransferencia}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">entre pátios</p>
            </CardContent>
          </Card>
          <Card className="border bg-card" data-testid="card-summary-entregue">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Despachado/Entregue</p>
              {isLoading ? (
                <div className="h-7 w-10 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-muted-foreground">{stockSummary.despachado + stockSummary.entregue}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">concluídos</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap">
            <div className="relative max-w-sm flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por chassi ou montadora..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-vehicles"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-48" data-testid="select-client-filter">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" data-testid="text-total-count">
              {filteredData?.length || 0} chassis
            </span>
            <Button variant="outline" onClick={handleExportExcel} data-testid="button-export-excel">
              <Download className="mr-2 h-4 w-4" />
              Baixar planilha
            </Button>
            <Button onClick={handleNew} data-testid="button-add-vehicle">
              <Plus className="mr-2 h-4 w-4" />
              Novo Veículo
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredData ?? []}
          isLoading={isLoading}
          keyField="chassi"
          onRowClick={(v) => setHistoryChassi(v.chassi)}
          emptyMessage="Nenhum veículo cadastrado"
        />
      </div>

      <AlertDialog open={!!deleteChassi} onOpenChange={() => setDeleteChassi(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este veículo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteChassi && deleteMutation.mutate(deleteChassi)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!historyChassi} onOpenChange={() => setHistoryChassi(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap pr-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <span className="font-mono font-medium">{historyChassi}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => navigator.clipboard.writeText(historyChassi || "")}
                  title="Copiar chassi"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  setHistoryChassi(null);
                  const v = vehicles?.find((x) => x.chassi === historyChassi);
                  if (v) handleEdit(v);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar Veículo
              </Button>
            </DialogTitle>
          </DialogHeader>

          {isLoadingJourney ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-9 w-full rounded" />
                <Skeleton className="h-9 w-full rounded" />
                <Skeleton className="h-9 w-full rounded" />
              </div>
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : vehicleJourney ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
                  <StatusBadge status={vehicleJourney.vehicle.status} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Cliente</p>
                  <p className="text-sm font-medium">{vehicleJourney.vehicle.client?.name || <span className="text-muted-foreground italic">Sem cliente</span>}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Fabricante</p>
                  <p className="text-sm font-medium">{vehicleJourney.vehicle.manufacturer?.name || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pátio Atual</p>
                  <p className="text-sm font-medium">{vehicleJourney.vehicle.yard?.name || <span className="text-muted-foreground italic">Não definido</span>}</p>
                </div>
              </div>

              <Tabs defaultValue="collects">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="collects" className="gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Coletas
                    {vehicleJourney.collects.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 px-1.5">{vehicleJourney.collects.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="transports" className="gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Transportes
                    {vehicleJourney.transports.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 px-1.5">{vehicleJourney.transports.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="transfers" className="gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Transferências
                    {vehicleJourney.transfers.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-4 px-1.5">{vehicleJourney.transfers.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="collects" className="mt-4">
                  {vehicleJourney.collects.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Nenhuma coleta registrada</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {vehicleJourney.collects.map((collect, index) => (
                        <Card key={collect.id} className="overflow-hidden">
                          <CardHeader className="pb-3 bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-b">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <CardTitle className="text-sm">Coleta #{index + 1}</CardTitle>
                              <Badge variant={collect.status === "finalizada" ? "default" : "secondary"}>
                                {collect.status === "finalizada" ? "Finalizada" : "Em Trânsito"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  Motorista
                                </div>
                                <p className="text-sm font-medium">{collect.driver?.name || "Não atribuído"}</p>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  Local de Coleta (Origem)
                                </div>
                                <p className="text-sm font-medium">{collect.manufacturer?.name || "-"}</p>
                                {(collect.manufacturer?.city || collect.manufacturer?.state) && (
                                  <p className="text-xs text-muted-foreground">
                                    {[collect.manufacturer.city, collect.manufacturer.state].filter(Boolean).join(" - ")}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Building2 className="h-3 w-3" />
                                  Finalização (Pátio Destino)
                                </div>
                                <p className="text-sm font-medium">{collect.yard?.name || "-"}</p>
                                {(collect.yard?.city || collect.yard?.state) && (
                                  <p className="text-xs text-muted-foreground">
                                    {[collect.yard.city, collect.yard.state].filter(Boolean).join(" - ")}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-in (Saída da Montadora)</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Horário</div>
                                  <p className="text-sm">{collect.checkinDateTime ? format(new Date(collect.checkinDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}</p>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Navigation className="h-3 w-3" /> Localização</div>
                                  <p className="text-sm font-mono text-xs">{collect.checkinLocation ? `${collect.checkinLocation.coordinates[1]}, ${collect.checkinLocation.coordinates[0]}` : "-"}</p>
                                </div>
                              </div>
                              {(collect.checkinSelfiePhoto || collect.checkinOdometerPhoto || collect.checkinFrontalPhoto || collect.checkinLateral1Photo || collect.checkinLateral2Photo || collect.checkinTraseiraPhoto || (collect.checkinDamagePhotos && collect.checkinDamagePhotos.length > 0)) && (
                                <div className="space-y-2 pt-2">
                                  <p className="text-xs text-muted-foreground">Fotos</p>
                                  <div className="grid grid-cols-4 gap-2">
                                    {collect.checkinSelfiePhoto && (<div className="space-y-1"><a href={collect.checkinSelfiePhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkinSelfiePhoto)} alt="Selfie" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Camera className="h-2.5 w-2.5" /> Selfie</p></div>)}
                                    {collect.checkinOdometerPhoto && (<div className="space-y-1"><a href={collect.checkinOdometerPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkinOdometerPhoto)} alt="Odômetro" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Gauge className="h-2.5 w-2.5" /> Odômetro</p></div>)}
                                    {collect.checkinFrontalPhoto && (<div className="space-y-1"><a href={collect.checkinFrontalPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkinFrontalPhoto)} alt="Frontal" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Frontal</p></div>)}
                                    {collect.checkinLateral1Photo && (<div className="space-y-1"><a href={collect.checkinLateral1Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkinLateral1Photo)} alt="Lateral 1" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 1</p></div>)}
                                    {collect.checkinLateral2Photo && (<div className="space-y-1"><a href={collect.checkinLateral2Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkinLateral2Photo)} alt="Lateral 2" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 2</p></div>)}
                                    {collect.checkinTraseiraPhoto && (<div className="space-y-1"><a href={collect.checkinTraseiraPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkinTraseiraPhoto)} alt="Traseira" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Traseira</p></div>)}
                                    {collect.checkinDamagePhotos?.map((photo: string, i: number) => (<div key={`ci-dmg-${i}`} className="space-y-1"><a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={`Avaria ${i+1}`} className="w-full h-16 object-cover rounded border border-orange-300 hover:opacity-80 transition" /></a><p className="text-[10px] text-orange-600 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Avaria</p></div>))}
                                  </div>
                                </div>
                              )}
                              {collect.checkinNotes && <div className="space-y-1 pt-2"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{collect.checkinNotes}</p></div>}
                            </div>
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-out (Chegada no Pátio)</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Horário</div>
                                  <p className="text-sm">{collect.checkoutDateTime ? format(new Date(collect.checkoutDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}</p>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Navigation className="h-3 w-3" /> Localização</div>
                                  <p className="text-sm font-mono text-xs">{collect.checkoutLocation ? `${collect.checkoutLocation.coordinates[1]}, ${collect.checkoutLocation.coordinates[0]}` : "-"}</p>
                                </div>
                              </div>
                              {(collect.checkoutSelfiePhoto || collect.checkoutOdometerPhoto || collect.checkoutFrontalPhoto || collect.checkoutLateral1Photo || collect.checkoutLateral2Photo || collect.checkoutTraseiraPhoto || (collect.checkoutDamagePhotos && collect.checkoutDamagePhotos.length > 0)) && (
                                <div className="space-y-2 pt-2">
                                  <p className="text-xs text-muted-foreground">Fotos</p>
                                  <div className="grid grid-cols-4 gap-2">
                                    {collect.checkoutSelfiePhoto && (<div className="space-y-1"><a href={collect.checkoutSelfiePhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkoutSelfiePhoto)} alt="Selfie" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Camera className="h-2.5 w-2.5" /> Selfie</p></div>)}
                                    {collect.checkoutOdometerPhoto && (<div className="space-y-1"><a href={collect.checkoutOdometerPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkoutOdometerPhoto)} alt="Odômetro" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Gauge className="h-2.5 w-2.5" /> Odômetro</p></div>)}
                                    {collect.checkoutFrontalPhoto && (<div className="space-y-1"><a href={collect.checkoutFrontalPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkoutFrontalPhoto)} alt="Frontal" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Frontal</p></div>)}
                                    {collect.checkoutLateral1Photo && (<div className="space-y-1"><a href={collect.checkoutLateral1Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkoutLateral1Photo)} alt="Lateral 1" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 1</p></div>)}
                                    {collect.checkoutLateral2Photo && (<div className="space-y-1"><a href={collect.checkoutLateral2Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkoutLateral2Photo)} alt="Lateral 2" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 2</p></div>)}
                                    {collect.checkoutTraseiraPhoto && (<div className="space-y-1"><a href={collect.checkoutTraseiraPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(collect.checkoutTraseiraPhoto)} alt="Traseira" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Traseira</p></div>)}
                                    {collect.checkoutDamagePhotos?.map((photo: string, i: number) => (<div key={`co-dmg-${i}`} className="space-y-1"><a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={`Avaria ${i+1}`} className="w-full h-16 object-cover rounded border border-orange-300 hover:opacity-80 transition" /></a><p className="text-[10px] text-orange-600 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Avaria</p></div>))}
                                  </div>
                                </div>
                              )}
                              {collect.checkoutNotes && <div className="space-y-1 pt-2"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{collect.checkoutNotes}</p></div>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transports" className="mt-4">
                  {vehicleJourney.transports.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Nenhum transporte registrado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {vehicleJourney.transports.map((transport, index) => {
                        const tStatusLabel: Record<string, string> = { pendente: "Pendente", atribuido: "Atribuído", em_transito: "Em Trânsito", finalizado: "Finalizado", cancelado: "Cancelado" };
                        const tStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pendente: "secondary", atribuido: "outline", em_transito: "secondary", finalizado: "default", cancelado: "destructive" };
                        return (
                          <Card key={transport.id} className="overflow-hidden">
                            <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-b">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <CardTitle className="text-sm">Transporte #{index + 1}</CardTitle>
                                <Badge variant={tStatusVariant[transport.status] || "secondary"}>{tStatusLabel[transport.status] || transport.status}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground">Origem</p>
                                  <p className="text-sm font-medium truncate">{transport.originYard?.name || "-"}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0 text-right">
                                  <p className="text-xs text-muted-foreground">Destino</p>
                                  <p className="text-sm font-medium truncate">{transport.deliveryLocation?.name || transport.client?.name || "-"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" /> Motorista</div>
                                  <p className="text-sm font-medium">{transport.driver?.name || "Não atribuído"}</p>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" /> Cliente</div>
                                  <p className="text-sm font-medium">{transport.client?.name || "-"}</p>
                                </div>
                              </div>
                              {(transport.routeDistanceKm || transport.routeDurationMinutes) && (
                                <div className="grid grid-cols-2 gap-4">
                                  {transport.routeDistanceKm && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Route className="h-3 w-3" /> Distância</div>
                                      <p className="text-sm">{parseFloat(transport.routeDistanceKm).toFixed(0)} km</p>
                                    </div>
                                  )}
                                  {transport.routeDurationMinutes && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Duração Est.</div>
                                      <p className="text-sm">{Math.floor(transport.routeDurationMinutes / 60)}h {transport.routeDurationMinutes % 60}min</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              <Separator />
                              <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-in (Retirada do Pátio)</p>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Horário</div>
                                    <p className="text-sm">{transport.checkinDateTime ? format(new Date(transport.checkinDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Navigation className="h-3 w-3" /> Localização</div>
                                    <p className="text-sm font-mono text-xs">{transport.checkinLocation ? `${transport.checkinLocation.coordinates[1]}, ${transport.checkinLocation.coordinates[0]}` : "-"}</p>
                                  </div>
                                </div>
                                {(transport.checkinSelfiePhoto || transport.checkinOdometerPhoto || transport.checkinFrontalPhoto || transport.checkinLateral1Photo || transport.checkinLateral2Photo || transport.checkinTraseiraPhoto || (transport.checkinDamagePhotos && transport.checkinDamagePhotos.length > 0)) && (
                                  <div className="space-y-2 pt-2">
                                    <p className="text-xs text-muted-foreground">Fotos</p>
                                    <div className="grid grid-cols-4 gap-2">
                                      {transport.checkinSelfiePhoto && (<div className="space-y-1"><a href={transport.checkinSelfiePhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkinSelfiePhoto)} alt="Selfie" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Camera className="h-2.5 w-2.5" /> Selfie</p></div>)}
                                      {transport.checkinOdometerPhoto && (<div className="space-y-1"><a href={transport.checkinOdometerPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkinOdometerPhoto)} alt="Odômetro" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Gauge className="h-2.5 w-2.5" /> Odômetro</p></div>)}
                                      {transport.checkinFrontalPhoto && (<div className="space-y-1"><a href={transport.checkinFrontalPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkinFrontalPhoto)} alt="Frontal" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Frontal</p></div>)}
                                      {transport.checkinLateral1Photo && (<div className="space-y-1"><a href={transport.checkinLateral1Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkinLateral1Photo)} alt="Lateral 1" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 1</p></div>)}
                                      {transport.checkinLateral2Photo && (<div className="space-y-1"><a href={transport.checkinLateral2Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkinLateral2Photo)} alt="Lateral 2" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 2</p></div>)}
                                      {transport.checkinTraseiraPhoto && (<div className="space-y-1"><a href={transport.checkinTraseiraPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkinTraseiraPhoto)} alt="Traseira" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Traseira</p></div>)}
                                      {transport.checkinDamagePhotos?.map((photo: string, i: number) => (<div key={`tci-dmg-${i}`} className="space-y-1"><a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={`Avaria ${i+1}`} className="w-full h-16 object-cover rounded border border-orange-300 hover:opacity-80 transition" /></a><p className="text-[10px] text-orange-600 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Avaria</p></div>))}
                                    </div>
                                  </div>
                                )}
                                {transport.checkinNotes && <div className="space-y-1 pt-2"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{transport.checkinNotes}</p></div>}
                              </div>
                              <div className="space-y-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-out (Entrega ao Cliente)</p>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Horário</div>
                                    <p className="text-sm">{transport.checkoutDateTime ? format(new Date(transport.checkoutDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Navigation className="h-3 w-3" /> Localização</div>
                                    <p className="text-sm font-mono text-xs">{transport.checkoutLocation ? `${transport.checkoutLocation.coordinates[1]}, ${transport.checkoutLocation.coordinates[0]}` : "-"}</p>
                                  </div>
                                </div>
                                {(transport.checkoutSelfiePhoto || transport.checkoutOdometerPhoto || transport.checkoutFrontalPhoto || transport.checkoutLateral1Photo || transport.checkoutLateral2Photo || transport.checkoutTraseiraPhoto || (transport.checkoutDamagePhotos && transport.checkoutDamagePhotos.length > 0)) && (
                                  <div className="space-y-2 pt-2">
                                    <p className="text-xs text-muted-foreground">Fotos</p>
                                    <div className="grid grid-cols-4 gap-2">
                                      {transport.checkoutSelfiePhoto && (<div className="space-y-1"><a href={transport.checkoutSelfiePhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkoutSelfiePhoto)} alt="Selfie" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Camera className="h-2.5 w-2.5" /> Selfie</p></div>)}
                                      {transport.checkoutOdometerPhoto && (<div className="space-y-1"><a href={transport.checkoutOdometerPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkoutOdometerPhoto)} alt="Odômetro" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Gauge className="h-2.5 w-2.5" /> Odômetro</p></div>)}
                                      {transport.checkoutFrontalPhoto && (<div className="space-y-1"><a href={transport.checkoutFrontalPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkoutFrontalPhoto)} alt="Frontal" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Frontal</p></div>)}
                                      {transport.checkoutLateral1Photo && (<div className="space-y-1"><a href={transport.checkoutLateral1Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkoutLateral1Photo)} alt="Lateral 1" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 1</p></div>)}
                                      {transport.checkoutLateral2Photo && (<div className="space-y-1"><a href={transport.checkoutLateral2Photo} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkoutLateral2Photo)} alt="Lateral 2" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Lateral 2</p></div>)}
                                      {transport.checkoutTraseiraPhoto && (<div className="space-y-1"><a href={transport.checkoutTraseiraPhoto} target="_blank" rel="noopener noreferrer"><img src={normalizeImageUrl(transport.checkoutTraseiraPhoto)} alt="Traseira" className="w-full h-16 object-cover rounded border hover:opacity-80 transition" /></a><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Car className="h-2.5 w-2.5" /> Traseira</p></div>)}
                                      {transport.checkoutDamagePhotos?.map((photo: string, i: number) => (<div key={`tco-dmg-${i}`} className="space-y-1"><a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt={`Avaria ${i+1}`} className="w-full h-16 object-cover rounded border border-orange-300 hover:opacity-80 transition" /></a><p className="text-[10px] text-orange-600 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Avaria</p></div>))}
                                    </div>
                                  </div>
                                )}
                                {transport.checkoutNotes && <div className="space-y-1 pt-2"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{transport.checkoutNotes}</p></div>}
                              </div>
                              {transport.notes && (<><Separator /><div className="space-y-1"><p className="text-xs text-muted-foreground">Observações Gerais</p><p className="text-sm">{transport.notes}</p></div></>)}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transfers" className="mt-4">
                  {vehicleJourney.transfers.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <ArrowRightLeft className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Nenhuma transferência registrada</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {vehicleJourney.transfers.map((transfer, index) => {
                        const trStatusLabel: Record<string, string> = { pendente: "Pendente", autorizado: "Autorizado", em_transito: "Em Trânsito", finalizado: "Finalizado", cancelado: "Cancelado" };
                        const trStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pendente: "secondary", autorizado: "outline", em_transito: "secondary", finalizado: "default", cancelado: "destructive" };
                        return (
                          <Card key={transfer.id} className="overflow-hidden">
                            <CardHeader className="pb-3 bg-gradient-to-r from-purple-500/10 to-purple-500/5 border-b">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <CardTitle className="text-sm">Transferência #{index + 1}</CardTitle>
                                <Badge variant={trStatusVariant[transfer.status] || "secondary"}>{trStatusLabel[transfer.status] || transfer.status}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground">Origem</p>
                                  <p className="text-sm font-medium truncate">{transfer.originYard?.name || "-"}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0 text-right">
                                  <p className="text-xs text-muted-foreground">Destino</p>
                                  <p className="text-sm font-medium truncate">{transfer.destinationYard?.name || "-"}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" /> Motorista</div>
                                  <p className="text-sm font-medium">{transfer.driver?.name || "Não atribuído"}</p>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Criado em</div>
                                  <p className="text-sm">{transfer.createdAt ? format(new Date(transfer.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}</p>
                                </div>
                              </div>
                              {(transfer.authorizedAt || transfer.completedAt) && (
                                <div className="grid grid-cols-2 gap-4">
                                  {transfer.authorizedAt && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Autorizado em</div>
                                      <p className="text-sm">{format(new Date(transfer.authorizedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                    </div>
                                  )}
                                  {transfer.completedAt && (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Concluído em</div>
                                      <p className="text-sm">{format(new Date(transfer.completedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {transfer.notes && <div className="space-y-1"><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{transfer.notes}</p></div>}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Veículo não encontrado</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VehicleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicleChassi={editingChassi}
      />

      {/* Assign Client Dialog */}
      <Dialog
        open={!!assignClientVehicle}
        onOpenChange={(open) => { if (!open) { setAssignClientVehicle(null); setAssignClientId(""); setAssignClientPopoverOpen(false); } }}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              Vincular Cliente ao Chassi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Chassi: </span>
              <span className="font-mono font-semibold">{assignClientVehicle?.chassi}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assign-client-combobox" className="text-sm font-medium">Cliente</Label>
              <Popover open={assignClientPopoverOpen} onOpenChange={setAssignClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="assign-client-combobox"
                    variant="outline"
                    role="combobox"
                    aria-expanded={assignClientPopoverOpen}
                    className={cn(
                      "w-full justify-between font-normal",
                      !assignClientId && "text-muted-foreground"
                    )}
                    data-testid="select-assign-client"
                  >
                    {assignClientId
                      ? clients?.find(c => c.id === assignClientId)?.name ?? "Selecione um cliente..."
                      : "Selecione um cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." data-testid="input-search-assign-client" />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {clients?.map(c => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setAssignClientId(c.id);
                              setAssignClientPopoverOpen(false);
                            }}
                            data-testid={`option-assign-client-${c.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                assignClientId === c.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setAssignClientVehicle(null); setAssignClientId(""); setAssignClientPopoverOpen(false); }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!assignClientId || assignClientMutation.isPending}
              onClick={() => assignClientVehicle && assignClientMutation.mutate({ chassi: assignClientVehicle.chassi, clientId: assignClientId })}
              data-testid="button-confirm-assign-client"
            >
              {assignClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
