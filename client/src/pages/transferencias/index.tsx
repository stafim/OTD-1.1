import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { normalizeImageUrl } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeftRight,
  Plus,
  Search,
  Truck,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ArrowRight,
  LayoutGrid,
  List,
  UserPlus,
  User,
  Warehouse,
  ArrowDown,
  FileText,
  Car,
  StickyNote,
} from "lucide-react";
import type { Yard, Vehicle, Driver } from "@shared/schema";

interface TransferWithRelations {
  id: string;
  vehicleChassi: string;
  originYardId: string;
  destinationYardId: string;
  driverId?: string | null;
  status: "pendente" | "autorizada" | "em_transito" | "concluida" | "cancelada";
  notes: string | null;
  requestedBy: string | null;
  authorizedBy: string | null;
  authorizedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  vehicle?: Vehicle;
  originYard?: Yard;
  destinationYard?: Yard;
  driver?: Driver | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock },
  autorizada: { label: "Autorizada", variant: "default", icon: CheckCircle2 },
  em_transito: { label: "Em Trânsito", variant: "default", icon: ArrowRight },
  concluida: { label: "Concluída", variant: "outline", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", variant: "destructive", icon: XCircle },
};

export default function TransferenciasPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [assignDriverTransfer, setAssignDriverTransfer] = useState<TransferWithRelations | null>(null);
  const [assignDriverValue, setAssignDriverValue] = useState<string>("");

  const [form, setForm] = useState({
    vehicleChassi: "",
    originYardId: "",
    destinationYardId: "",
    notes: "",
  });

  const { data: transfers = [], isLoading } = useQuery<TransferWithRelations[]>({
    queryKey: ["/api/transfers"],
  });

  const { data: yards = [] } = useQuery<Yard[]>({
    queryKey: ["/api/yards"],
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: drivers = [] } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const stockVehicles = vehicles.filter((v) => v.status === "em_estoque");

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/transfers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      setShowCreate(false);
      setForm({ vehicleChassi: "", originYardId: "", destinationYardId: "", notes: "" });
      toast({ title: "Transferência criada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar transferência", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/transfers/${id}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setCancelId(null);
      toast({ title: "Transferência cancelada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/transfers/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setCompleteId(null);
      toast({ title: "Transferência concluída! Veículo agora em estoque no pátio de destino." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao concluir", description: err.message, variant: "destructive" });
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string | null }) => {
      await apiRequest("PATCH", `/api/transfers/${id}/driver`, { driverId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      toast({ title: "Motorista atualizado com sucesso" });
      setAssignDriverTransfer(null);
      setAssignDriverValue("");
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Erro ao atribuir motorista", variant: "destructive" });
    },
  });

  const filtered = transfers.filter((t) => {
    const matchesSearch =
      t.vehicleChassi.toLowerCase().includes(search.toLowerCase()) ||
      t.originYard?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.destinationYard?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.driver?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    pendente: transfers.filter((t) => t.status === "pendente").length,
    em_transito: transfers.filter((t) => t.status === "em_transito").length,
    concluida: transfers.filter((t) => t.status === "concluida").length,
  };

  const handleVehicleChange = (chassi: string) => {
    const vehicle = stockVehicles.find((v) => v.chassi === chassi);
    const newOrigin = vehicle?.yardId ?? "";
    setForm((f) => ({
      ...f,
      vehicleChassi: chassi,
      originYardId: newOrigin,
      destinationYardId: f.destinationYardId === newOrigin ? "" : f.destinationYardId,
    }));
  };

  const canAssignDriver = (status: string) =>
    status === "pendente" || status === "autorizada" || status === "em_transito";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Transferências"
        breadcrumbs={[
          { label: "Operação", href: "/transportes" },
          { label: "Transferências" },
        ]}
        actions={
          <Button onClick={() => setShowCreate(true)} data-testid="button-nova-transferencia">
            <Plus className="h-4 w-4 mr-2" />
            Transferir
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por chassi, pátio ou motorista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_transito">Em Trânsito</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none px-3"
              onClick={() => setViewMode("cards")}
              data-testid="button-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none px-3"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhuma transferência encontrada</p>
            <p className="text-sm">Crie uma nova transferência para mover um veículo entre pátios.</p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="space-y-3">
            {filtered.map((t) => {
              const cfg = statusConfig[t.status] ?? statusConfig.pendente;
              const StatusIcon = cfg.icon;
              return (
                <Card key={t.id} data-testid={`card-transfer-${t.id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {t.driver?.profilePhoto ? (
                          <Avatar className="h-10 w-10 shrink-0 border border-primary/20">
                            <AvatarImage src={normalizeImageUrl(t.driver.profilePhoto)} alt={t.driver.name} className="object-cover" />
                            <AvatarFallback><User className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="p-2 rounded-lg bg-muted shrink-0">
                            <Truck className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold" data-testid={`text-chassi-${t.id}`}>{t.vehicleChassi}</span>
                            <Badge variant={cfg.variant} className="text-xs">
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="truncate">{t.originYard?.name ?? t.originYardId}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{t.destinationYard?.name ?? t.destinationYardId}</span>
                          </div>
                          {t.driver ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <User className="h-3 w-3" />
                              <span className="font-medium text-foreground" data-testid={`text-driver-${t.id}`}>{t.driver.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground italic mt-0.5">
                              <User className="h-3 w-3" />
                              Sem motorista
                            </div>
                          )}
                          {t.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {format(new Date(t.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {canAssignDriver(t.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => { setAssignDriverValue(t.driverId || ""); setAssignDriverTransfer(t); }}
                            data-testid={`button-assign-driver-${t.id}`}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            {t.driver ? "Trocar Motorista" : "Incluir Motorista"}
                          </Button>
                        )}
                        {t.status === "em_transito" && (
                          <Button
                            size="sm"
                            onClick={() => setCompleteId(t.id)}
                            data-testid={`button-complete-${t.id}`}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Finalizar Transferência
                          </Button>
                        )}
                        {(t.status === "pendente" || t.status === "em_transito") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setCancelId(t.id)}
                            data-testid={`button-cancel-${t.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chassi</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Destino</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motorista</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Observações</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const cfg = statusConfig[t.status] ?? statusConfig.pendente;
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-transfer-${t.id}`}>
                        <td className="px-4 py-3 font-mono font-semibold text-xs" data-testid={`text-chassi-list-${t.id}`}>
                          {t.vehicleChassi}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.variant} className="text-xs whitespace-nowrap">
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                          {t.originYard?.name ?? t.originYardId}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                          {t.destinationYard?.name ?? t.destinationYardId}
                        </td>
                        <td className="px-4 py-3">
                          {t.driver ? (
                            <div className="flex items-center gap-2">
                              {t.driver.profilePhoto && (
                                <Avatar className="h-6 w-6 border border-primary/20">
                                  <AvatarImage src={normalizeImageUrl(t.driver.profilePhoto)} alt={t.driver.name} className="object-cover" />
                                  <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                                </Avatar>
                              )}
                              <span className="font-medium text-sm" data-testid={`text-driver-list-${t.id}`}>{t.driver.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Sem motorista</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(t.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">
                          {t.notes ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {canAssignDriver(t.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                onClick={() => { setAssignDriverValue(t.driverId || ""); setAssignDriverTransfer(t); }}
                                data-testid={`button-assign-driver-list-${t.id}`}
                              >
                                <UserPlus className="h-3.5 w-3.5 mr-1" />
                                {t.driver ? "Trocar" : "Motorista"}
                              </Button>
                            )}
                            {t.status === "em_transito" && (
                              <Button
                                size="sm"
                                onClick={() => setCompleteId(t.id)}
                                data-testid={`button-complete-list-${t.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Finalizar
                              </Button>
                            )}
                            {(t.status === "pendente" || t.status === "em_transito") && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setCancelId(t.id)}
                                data-testid={`button-cancel-list-${t.id}`}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Dialog: Nova Transferência */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-0">
          <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                Nova Transferência
              </DialogTitle>
              <DialogDescription className="text-muted-foreground ml-[52px]">
                Transfira um veículo entre pátios da operação
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Veículo</h3>
              </div>
              <Select value={form.vehicleChassi} onValueChange={handleVehicleChange}>
                <SelectTrigger className="h-11 font-mono text-base" data-testid="select-chassi">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Selecione um veículo em estoque" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {stockVehicles.length === 0 ? (
                    <div className="py-3 text-center text-sm text-muted-foreground">
                      Nenhum veículo em estoque disponível
                    </div>
                  ) : (
                    stockVehicles.map((v) => (
                      <SelectItem key={v.chassi} value={v.chassi}>
                        {v.chassi}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Warehouse className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rota de Transferência</h3>
              </div>

              <div className="relative flex flex-col gap-0">
                <div className="absolute left-[19px] top-[44px] bottom-[44px] w-[2px] bg-gradient-to-b from-amber-500 via-amber-300 to-indigo-500 z-0" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
                    <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Origem</span>
                  </div>
                  <div className="ml-7">
                    <Select value={form.originYardId} onValueChange={(v) => setForm((f) => ({ ...f, originYardId: v, destinationYardId: f.destinationYardId === v ? "" : f.destinationYardId }))}>
                      <SelectTrigger className="h-11" data-testid="select-origin-yard">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-amber-600" />
                          <SelectValue placeholder="Selecione o pátio de origem" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {yards.map((y) => (
                          <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-center my-1 relative z-10">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border">
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
                    <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Destino</span>
                  </div>
                  <div className="ml-7">
                    <Select value={form.destinationYardId} onValueChange={(v) => setForm((f) => ({ ...f, destinationYardId: v }))}>
                      <SelectTrigger className="h-11" data-testid="select-dest-yard">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-indigo-600" />
                          <SelectValue placeholder="Selecione o pátio de destino" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {yards.filter((y) => y.id !== form.originYardId).map((y) => (
                          <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {form.originYardId && form.destinationYardId && (
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-500/10 shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="font-medium truncate">
                    {yards.find((y) => y.id === form.originYardId)?.name ?? "—"}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-indigo-500/10 shrink-0">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="font-medium truncate">
                    {yards.find((y) => y.id === form.destinationYardId)?.name ?? "—"}
                  </span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Observações</h3>
              </div>
              <Textarea
                id="notes"
                placeholder="Motivo da transferência, instruções..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="textarea-notes"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
                className="flex-1"
                data-testid="button-cancel-create"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.vehicleChassi || !form.originYardId || !form.destinationYardId || form.originYardId === form.destinationYardId || createMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-submit-create"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                )}
                Transferir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Atribuir Motorista */}
      <Dialog
        open={!!assignDriverTransfer}
        onOpenChange={(open) => { if (!open) { setAssignDriverTransfer(null); setAssignDriverValue(""); } }}
      >
        <DialogContent data-testid="dialog-assign-driver">
          <DialogHeader>
            <DialogTitle>Atribuir Motorista</DialogTitle>
            <DialogDescription>
              Selecione o motorista responsável por esta transferência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Chassi</Label>
              <p className="font-mono text-sm font-medium">{assignDriverTransfer?.vehicleChassi}</p>
            </div>
            <div className="space-y-1">
              <Label>Rota</Label>
              <p className="text-sm text-muted-foreground">
                {assignDriverTransfer?.originYard?.name ?? assignDriverTransfer?.originYardId}
                {" → "}
                {assignDriverTransfer?.destinationYard?.name ?? assignDriverTransfer?.destinationYardId}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-select">Motorista</Label>
              <Select
                value={assignDriverValue || "__none__"}
                onValueChange={(val) => setAssignDriverValue(val === "__none__" ? "" : val)}
              >
                <SelectTrigger id="driver-select" data-testid="select-driver">
                  <SelectValue placeholder="Selecione um motorista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem motorista —</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAssignDriverTransfer(null); setAssignDriverValue(""); }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                assignDriverTransfer &&
                assignDriverMutation.mutate({ id: assignDriverTransfer.id, driverId: assignDriverValue || null })
              }
              disabled={assignDriverMutation.isPending}
              data-testid="button-confirm-assign-driver"
            >
              {assignDriverMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <UserPlus className="h-4 w-4 mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Transferência</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta transferência? O veículo voltará ao status em estoque no pátio de origem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelId && cancelMutation.mutate(cancelId)}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar Transferência"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!completeId} onOpenChange={() => setCompleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Transferência</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar que o veículo chegou ao pátio de destino? O veículo será atualizado para Em Estoque no novo pátio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => completeId && completeMutation.mutate(completeId)}
              data-testid="button-confirm-complete"
            >
              {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
