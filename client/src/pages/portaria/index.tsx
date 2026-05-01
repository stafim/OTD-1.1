import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { normalizeImageUrl, cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Truck, CheckCircle, Clock, Building, MapPin, User, DoorOpen,
  Loader2, Search, LogOut, Package, AlertCircle, Plus, ArrowLeftRight,
  ChevronsUpDown, Check as CheckIcon, ArrowRight, CheckCircle2,
  Phone, CreditCard, Calendar, FileText, UserPlus, Factory,
  Warehouse, ArrowDown, Shield
} from "lucide-react";
import type { Collect, Manufacturer, Yard, Driver, Vehicle, Transport, Client, DeliveryLocation } from "@shared/schema";
import { CollectRouteMap } from "@/components/collect-route-map";
import { StatusBadge } from "@/components/status-badge";

interface CollectWithRelations extends Collect {
  manufacturer?: Manufacturer;
  originYard?: Yard | null;
  yard?: Yard;
  driver?: Driver;
  vehicle?: Vehicle;
  checkoutApprovedBy?: { firstName: string | null; lastName: string | null; username: string };
}

interface TransportWithRelations extends Transport {
  client?: Client;
  originYard?: Yard;
  deliveryLocation?: DeliveryLocation;
  driver?: Driver;
  vehicle?: Vehicle;
}

const newCollectFormSchema = z.object({
  collectType: z.enum(["coleta", "transferencia"]).default("coleta"),
  vehicleChassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres"),
  manufacturerId: z.string().min(1, "Montadora é obrigatória"),
  yardId: z.string().min(1, "Pátio de destino é obrigatório"),
  driverId: z.string().optional(),
  collectDate: z.string().optional(),
  notes: z.string().optional(),
});
type NewCollectFormData = z.infer<typeof newCollectFormSchema>;

const TIPO_COLORS = {
  Coleta: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Transporte: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Transferência: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

function TipoBadge({ tipo }: { tipo: "Coleta" | "Transporte" | "Transferência" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${TIPO_COLORS[tipo]}`}>
      {tipo === "Coleta" && <Package className="h-3 w-3" />}
      {tipo === "Transporte" && <Truck className="h-3 w-3" />}
      {tipo === "Transferência" && <ArrowLeftRight className="h-3 w-3" />}
      {tipo}
    </span>
  );
}

export default function PortariaPage() {
  const { toast } = useToast();
  const [searchEntrada, setSearchEntrada] = useState("");
  const [searchSaida, setSearchSaida] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [selectedCollectId, setSelectedCollectId] = useState<string | null>(null);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [showNewCollectDialog, setShowNewCollectDialog] = useState(false);
  const [openManufacturer, setOpenManufacturer] = useState(false);
  const [openYard, setOpenYard] = useState(false);
  const [openDriver, setOpenDriver] = useState(false);
  const [openAssignDriver, setOpenAssignDriver] = useState(false);

  const { data: collects, isLoading: collectsLoading } = useQuery<CollectWithRelations[]>({ queryKey: ["/api/collects"] });
  const { data: transports, isLoading: transportsLoading } = useQuery<TransportWithRelations[]>({ queryKey: ["/api/transports"] });
  const { data: manufacturers } = useQuery<Manufacturer[]>({ queryKey: ["/api/manufacturers"] });
  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });

  const activeDrivers = drivers?.filter((d) => d.isActive === "true" && d.isApto === "true");
  const activeManufacturers = manufacturers?.filter((m) => m.isActive === "true");
  const activeYards = yards?.filter((y) => y.isActive === "true");

  const getManufacturer = (id: string) => manufacturers?.find((m) => m.id === id);
  const getYard = (id: string) => yards?.find((y) => y.id === id);
  const getDriver = (id: string) => drivers?.find((d) => d.id === id);

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatPrevisao = (raw: string | Date | null | undefined): { label: string; urgent: boolean; past: boolean } => {
    if (!raw) return { label: "-", urgent: false, past: false };
    const d = new Date(raw);
    if (isNaN(d.getTime())) return { label: "-", urgent: false, past: false };
    const now = new Date();
    const diffH = (d.getTime() - now.getTime()) / 3_600_000;
    const isToday = d.toDateString() === now.toDateString();
    const past = d < now;
    const urgent = !past && diffH <= 4;
    const label = isToday
      ? `Hoje ${format(d, "HH:mm")}`
      : format(d, "dd/MM HH:mm", { locale: ptBR });
    return { label, urgent, past };
  };

  // --- Entrada: Coletas em trânsito ---
  const pendingCollects = (collects ?? []).filter((c) => {
    if (c.status !== "em_transito") return false;
    if ((c as any).collectType === "transferencia") return false; // transfers go to Saída
    if (!searchEntrada.trim()) return true;
    const s = searchEntrada.toLowerCase();
    return c.vehicleChassi?.toLowerCase().includes(s)
      || getDriver(c.driverId ?? "")?.name?.toLowerCase().includes(s)
      || getManufacturer(c.manufacturerId)?.name?.toLowerCase().includes(s);
  });

  // --- Saída: Transportes pendentes ---
  const pendingTransports = (transports ?? []).filter((t) => {
    if (t.status !== "aguardando_saida" && t.status !== "pendente") return false;
    if (!searchSaida.trim()) return true;
    const s = searchSaida.toLowerCase();
    return t.vehicleChassi?.toLowerCase().includes(s)
      || t.requestNumber?.toLowerCase().includes(s)
      || getDriver(t.driverId ?? "")?.name?.toLowerCase().includes(s);
  });

  // --- Saída: Transferências pendentes (em_transito aguardando saída do pátio de origem) ---
  // Após a portaria autorizar a saída, o veículo passa a "em_transferencia" (em trânsito
  // entre pátios), portanto a coleta deve sair do controle de saída.
  const pendingTransfers = (collects ?? []).filter((c) => {
    if ((c as any).collectType !== "transferencia") return false;
    if (c.status !== "em_transito") return false;
    if ((c as any).vehicle?.status === "em_transferencia") return false;
    if (!searchSaida.trim()) return true;
    const s = searchSaida.toLowerCase();
    return c.vehicleChassi?.toLowerCase().includes(s)
      || getDriver(c.driverId ?? "")?.name?.toLowerCase().includes(s);
  });

  const totalSaida = pendingTransports.length + pendingTransfers.length;

  // --- Mutations ---
  const authorizeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/portaria/authorize/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Entrada autorizada! Veículo atualizado para Em Estoque." });
    },
    onError: () => toast({ title: "Erro ao autorizar entrada", variant: "destructive" }),
  });

  const authorizeExitMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/portaria/authorize-exit/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Saída autorizada! Veículo despachado para entrega." });
    },
    onError: () => toast({ title: "Erro ao autorizar saída", variant: "destructive" }),
  });

  const authorizeTransferExitMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/portaria/authorize-transfer-exit/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Saída da transferência autorizada! Veículo em transferência." });
    },
    onError: () => toast({ title: "Erro ao autorizar saída da transferência", variant: "destructive" }),
  });


  const newCollectForm = useForm<NewCollectFormData>({
    resolver: zodResolver(newCollectFormSchema),
    defaultValues: { collectType: "coleta" as const, vehicleChassi: "", manufacturerId: "", yardId: "", driverId: "", collectDate: formatDateTimeLocal(new Date()), notes: "" },
  });

  const createCollectMutation = useMutation({
    mutationFn: (data: NewCollectFormData) => apiRequest("POST", "/api/collects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Coleta registrada com sucesso!" });
      setShowNewCollectDialog(false);
      newCollectForm.reset({ collectType: "coleta", vehicleChassi: "", manufacturerId: "", yardId: "", driverId: "", collectDate: formatDateTimeLocal(new Date()), notes: "" });
    },
    onError: (error: any) => toast({ title: error?.message || "Erro ao registrar coleta", variant: "destructive" }),
  });

  const selectedCollect = selectedCollectId ? collects?.find((c) => c.id === selectedCollectId) ?? null : null;
  const selectedTransport = selectedTransportId ? transports?.find((t) => t.id === selectedTransportId) as TransportWithRelations | undefined | null : null;

  const loadingEntrada = collectsLoading;
  const loadingSaida = transportsLoading;

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Portaria"
        breadcrumbs={[{ label: "Operação" }, { label: "Portaria" }]}
      />

      <div className="p-4 md:p-6">
        <Tabs defaultValue="entrada">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="w-fit">
              <TabsTrigger value="entrada" className="gap-2" data-testid="tab-entrada">
                <DoorOpen className="h-4 w-4" />
                Controle de Entrada
                {pendingCollects.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{pendingCollects.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="saida" className="gap-2" data-testid="tab-saida">
                <LogOut className="h-4 w-4" />
                Controle de Saída
                {totalSaida > 0 && (
                  <Badge variant="secondary" className="ml-1">{totalSaida}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── ENTRADA ── */}
          <TabsContent value="entrada">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por chassi, motorista ou montadora..."
                  value={searchEntrada}
                  onChange={(e) => setSearchEntrada(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-entrada"
                />
              </div>
              <Button
                onClick={() => {
                  newCollectForm.reset({ collectType: "coleta", vehicleChassi: "", manufacturerId: "", yardId: "", driverId: "", collectDate: formatDateTimeLocal(new Date()), notes: "" });
                  setShowNewCollectDialog(true);
                }}
                data-testid="button-new-collect-portaria"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Coleta
              </Button>
            </div>

            {loadingEntrada ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : pendingCollects.length === 0 ? (
              <div className="text-center py-14 border-2 border-dashed rounded-xl text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhuma entrada aguardando autorização</p>
                <p className="text-sm mt-1">Todos os veículos em trânsito já foram autorizados</p>
              </div>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chassi</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Destino (Pátio)</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motorista</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Previsão</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCollects.map((collect) => {
                        const manufacturer = getManufacturer(collect.manufacturerId);
                        const yard = getYard(collect.yardId);
                        const driver = collect.driverId ? getDriver(collect.driverId) : null;
                        return (
                          <tr
                            key={collect.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedCollectId(collect.id)}
                            data-testid={`row-entrada-${collect.id}`}
                          >
                            <td className="px-4 py-3">
                              <TipoBadge tipo={collect.collectType === "transferencia" ? "Transferência" : "Coleta"} />
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-xs">{collect.vehicleChassi}</td>
                            <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">
                              {collect.collectType === "transferencia"
                                ? (collect.originYard?.name ?? "-")
                                : (manufacturer?.name ?? "-")}
                            </td>
                            <td className="px-4 py-3 font-medium max-w-[160px] truncate">{yard?.name ?? "-"}</td>
                            <td className="px-4 py-3">
                              {driver ? (
                                <div className="flex items-center gap-2">
                                  {driver.profilePhoto && (
                                    <img
                                      src={normalizeImageUrl(driver.profilePhoto)}
                                      alt={driver.name}
                                      className="h-6 w-6 rounded-full object-cover border"
                                      onClick={(e) => { e.stopPropagation(); setLightboxPhoto(driver.profilePhoto!); }}
                                    />
                                  )}
                                  <span>{driver.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">Não informado</span>
                              )}
                            </td>
                            {(() => {
                              const pv = formatPrevisao((collect as any).collectDate);
                              return (
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                  <span className={cn(
                                    pv.label === "-" ? "text-muted-foreground" :
                                    pv.past ? "text-red-600 dark:text-red-400" :
                                    pv.urgent ? "text-amber-600 dark:text-amber-400" :
                                    "text-foreground"
                                  )}>
                                    {pv.label}
                                  </span>
                                </td>
                              );
                            })()}
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); authorizeMutation.mutate(collect.id); }}
                                disabled={authorizeMutation.isPending}
                                data-testid={`button-authorize-entrada-${collect.id}`}
                              >
                                {authorizeMutation.isPending
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  : <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                }
                                Autorizar Entrada
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── SAÍDA ── */}
          <TabsContent value="saida">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por chassi, pedido, motorista..."
                value={searchSaida}
                onChange={(e) => setSearchSaida(e.target.value)}
                className="pl-9"
                data-testid="input-search-saida"
              />
            </div>

            {loadingSaida ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : totalSaida === 0 ? (
              <div className="text-center py-14 border-2 border-dashed rounded-xl text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhuma saída aguardando autorização</p>
              </div>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chassi / Pedido</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Destino</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Motorista</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check-in</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingTransports.map((t) => {
                        const driver = t.driverId ? getDriver(t.driverId) : null;
                        return (
                          <tr
                            key={t.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedTransportId(t.id)}
                            data-testid={`row-saida-transport-${t.id}`}
                          >
                            <td className="px-4 py-3"><TipoBadge tipo="Transporte" /></td>
                            <td className="px-4 py-3">
                              <div className="font-mono font-semibold text-xs">{t.vehicleChassi}</div>
                              {t.requestNumber && <div className="text-xs text-muted-foreground">{t.requestNumber}</div>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">{t.originYard?.name ?? "-"}</td>
                            <td className="px-4 py-3 max-w-[140px] truncate font-medium">{t.deliveryLocation?.name ?? t.client?.name ?? "-"}</td>
                            <td className="px-4 py-3">
                              {driver ? (
                                <div className="flex items-center gap-2">
                                  {driver.profilePhoto && (
                                    <img src={normalizeImageUrl(driver.profilePhoto)} alt={driver.name} className="h-6 w-6 rounded-full object-cover border" onClick={(e) => { e.stopPropagation(); setLightboxPhoto(driver.profilePhoto!); }} />
                                  )}
                                  <span>{driver.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">Não informado</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {(t as any).checkinDateTime ? (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {format(new Date((t as any).checkinDateTime), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                  <Clock className="h-3 w-3" />
                                  Aguardando
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); authorizeExitMutation.mutate(t.id); }}
                                disabled={authorizeExitMutation.isPending}
                                data-testid={`button-authorize-saida-transport-${t.id}`}
                              >
                                {authorizeExitMutation.isPending
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  : <LogOut className="h-3.5 w-3.5 mr-1" />
                                }
                                Autorizar Saída
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {pendingTransfers.map((c) => {
                        const collect = c as CollectWithRelations;
                        const driver = collect.driverId ? getDriver(collect.driverId) : null;
                        return (
                          <tr
                            key={collect.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedCollectId(collect.id)}
                            data-testid={`row-saida-transfer-${collect.id}`}
                          >
                            <td className="px-4 py-3"><TipoBadge tipo="Transferência" /></td>
                            <td className="px-4 py-3 font-mono font-semibold text-xs">{collect.vehicleChassi}</td>
                            <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                              {collect.originYard?.name ?? "-"}
                            </td>
                            <td className="px-4 py-3 max-w-[140px] truncate font-medium">
                              {collect.yard?.name ?? "-"}
                            </td>
                            <td className="px-4 py-3">
                              {driver ? (
                                <div className="flex items-center gap-2">
                                  {driver.profilePhoto && (
                                    <img src={normalizeImageUrl(driver.profilePhoto)} alt={driver.name} className="h-6 w-6 rounded-full object-cover border" onClick={(e) => { e.stopPropagation(); setLightboxPhoto(driver.profilePhoto!); }} />
                                  )}
                                  <span>{driver.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">Não informado</span>
                              )}
                            </td>
                            {(() => {
                              const pv = formatPrevisao((collect as any).collectDate);
                              return (
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                  <span className={cn(
                                    pv.label === "-" ? "text-muted-foreground" :
                                    pv.past ? "text-red-600 dark:text-red-400" :
                                    pv.urgent ? "text-amber-600 dark:text-amber-400" :
                                    "text-foreground"
                                  )}>
                                    {pv.label}
                                  </span>
                                </td>
                              );
                            })()}
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950"
                                onClick={(e) => { e.stopPropagation(); authorizeTransferExitMutation.mutate(collect.id); }}
                                disabled={authorizeTransferExitMutation.isPending}
                                data-testid={`button-authorize-saida-transfer-${collect.id}`}
                              >
                                {authorizeTransferExitMutation.isPending
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  : <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                                }
                                Autorizar Saída
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-2xl p-2 bg-black/90 border-none">
          {lightboxPhoto && (
            <img src={normalizeImageUrl(lightboxPhoto)} alt="Foto motorista" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail: Coleta */}
      <Dialog open={!!selectedCollectId} onOpenChange={() => setSelectedCollectId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
                <Package className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="font-mono text-base">{selectedCollect?.vehicleChassi ?? "..."}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Detalhes da Coleta</p>
              </div>
              {selectedCollect && <StatusBadge status={selectedCollect.status} />}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto divide-y">
            {selectedCollect ? (() => {
              const sc = selectedCollect;
              const mfr = sc.manufacturer ?? getManufacturer(sc.manufacturerId);
              const yd = sc.yard ?? getYard(sc.yardId);
              const drv = sc.driver ?? (sc.driverId ? getDriver(sc.driverId) : null);
              const driverPhoto = sc.checkinSelfiePhoto || drv?.profilePhoto || null;
              return (
                <>
                  {drv && (
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Motorista</p>
                      <div className="flex items-center gap-4">
                        {driverPhoto ? (
                          <img src={normalizeImageUrl(driverPhoto)} alt={drv.name} className="h-14 w-14 rounded-full object-cover border-2 border-muted shrink-0 cursor-pointer" onClick={() => setLightboxPhoto(driverPhoto)} />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-muted border-2 flex items-center justify-center shrink-0"><User className="h-6 w-6 text-muted-foreground" /></div>
                        )}
                        <div>
                          <p className="font-semibold">{drv.name}</p>
                          {drv.phone && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {drv.phone}</p>}
                          {drv.cnhType && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><CreditCard className="h-3 w-3" /> CNH {drv.cnhType}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5" /> Rota</p>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Origem</p>
                        <p className="font-semibold text-sm">
                          {sc.collectType === "transferencia"
                            ? (sc.originYard?.name ?? "-")
                            : (mfr?.name ?? "-")}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-4" />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Destino</p>
                        <p className="font-semibold text-sm">{yd?.name ?? "-"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Datas</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Data da Coleta</p>
                        <p className="font-medium mt-0.5">{sc.collectDate ? format(new Date(sc.collectDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}</p>
                      </div>
                      {sc.checkinDateTime && (
                        <div>
                          <p className="text-xs text-muted-foreground">Check-in</p>
                          <p className="font-medium mt-0.5">{format(new Date(sc.checkinDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                      )}
                      {sc.checkoutDateTime && (
                        <div>
                          <p className="text-xs text-muted-foreground">Check-out</p>
                          <p className="font-medium mt-0.5 text-green-600">{format(new Date(sc.checkoutDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                        </div>
                      )}
                      {sc.checkoutApprovedBy && (
                        <div>
                          <p className="text-xs text-muted-foreground">Autorizado por</p>
                          <p className="font-medium mt-0.5 flex items-center gap-1.5">
                            <Shield className="h-3.5 w-3.5 text-green-600" />
                            {`${sc.checkoutApprovedBy.firstName || ""} ${sc.checkoutApprovedBy.lastName || ""}`.trim() || sc.checkoutApprovedBy.username}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {(sc.notes || sc.checkinNotes) && (
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Observações</p>
                      {sc.notes && <div className="bg-muted/50 rounded-md p-3 text-sm mb-2">{sc.notes}</div>}
                      {sc.checkinNotes && <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3 text-sm">{sc.checkinNotes}</div>}
                    </div>
                  )}
                </>
              );
            })() : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail: Transporte */}
      <Dialog open={!!selectedTransportId} onOpenChange={() => setSelectedTransportId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Detalhes do Transporte
            </DialogTitle>
            <DialogDescription>Informações do transporte aguardando saída</DialogDescription>
          </DialogHeader>
          {selectedTransport ? (() => {
            const t = selectedTransport;
            const driver = t.driver ?? (t.driverId ? getDriver(t.driverId) : null);
            const isPendingCheckin = !t.checkinDateTime;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground text-xs">Pedido</p><p className="font-semibold font-mono">{t.requestNumber}</p></div>
                  <div><p className="text-muted-foreground text-xs">Chassi</p><p className="font-semibold font-mono">{t.vehicleChassi}</p></div>
                  <div><p className="text-muted-foreground text-xs">Cliente</p><p className="font-medium">{t.client?.name ?? "-"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Pátio de Origem</p><p className="font-medium">{t.originYard?.name ?? "-"}</p></div>
                </div>
                {t.deliveryLocation && (
                  <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                    <p className="text-xs font-medium mb-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Local de Entrega</p>
                    <p className="font-medium">{t.deliveryLocation.name}</p>
                    <p className="text-xs text-muted-foreground">{[t.deliveryLocation.address, t.deliveryLocation.city, t.deliveryLocation.state].filter(Boolean).join(", ")}</p>
                  </div>
                )}
                {driver && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    {(t.checkinSelfiePhoto || driver.profilePhoto) ? (
                      <img src={normalizeImageUrl(t.checkinSelfiePhoto || driver.profilePhoto!)} alt={driver.name} className="h-12 w-12 rounded-full object-cover border-2 border-primary cursor-pointer" onClick={() => setLightboxPhoto(t.checkinSelfiePhoto || driver.profilePhoto!)} />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center"><User className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                    <div className="text-sm">
                      <p className="text-xs text-muted-foreground">Motorista</p>
                      <p className="font-medium">{driver.name}</p>
                      {driver.cpf && <p className="text-xs text-muted-foreground">CPF: {driver.cpf}</p>}
                      {driver.phone && <p className="text-xs text-muted-foreground">Tel: {driver.phone}</p>}
                    </div>
                  </div>
                )}
                {isPendingCheckin && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md text-center">
                    <p className="text-sm text-orange-700 dark:text-orange-400 flex items-center justify-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Motorista ainda não realizou o check-in
                    </p>
                  </div>
                )}
                {t.checkinDateTime && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md text-sm">
                    <p className="text-blue-700 dark:text-blue-300 font-medium mb-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Check-in</p>
                    <p>{format(new Date(t.checkinDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                    {t.checkinNotes && <p className="text-muted-foreground mt-1">{t.checkinNotes}</p>}
                  </div>
                )}
                {t.notes && <div className="text-sm bg-muted/50 p-3 rounded-md">{t.notes}</div>}
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>

      {/* New Collect Dialog */}
      <Dialog open={showNewCollectDialog} onOpenChange={(open) => {
        if (!open) { setShowNewCollectDialog(false); setOpenManufacturer(false); setOpenYard(false); setOpenDriver(false); }
      }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-600" />
              Nova Coleta
            </DialogTitle>
            <DialogDescription>Registre a entrada de um veículo sem registro prévio</DialogDescription>
          </DialogHeader>
          <Form {...newCollectForm}>
            <form onSubmit={newCollectForm.handleSubmit((data) => createCollectMutation.mutate(data))} className="space-y-4">
              <FormField control={newCollectForm.control} name="collectType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => field.onChange("coleta")} data-testid="button-type-coleta"
                        className={cn("flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all",
                          field.value === "coleta" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50")}>
                        <Package className="h-4 w-4" /> Coleta
                      </button>
                      <button type="button" onClick={() => field.onChange("transferencia")} data-testid="button-type-transferencia"
                        className={cn("flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all",
                          field.value === "transferencia" ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" : "border-border bg-background text-muted-foreground hover:border-purple-300")}>
                        <ArrowLeftRight className="h-4 w-4" /> Transferência
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={newCollectForm.control} name="vehicleChassi" render={({ field }) => (
                <FormItem>
                  <FormLabel>Chassi *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Digite o chassi" maxLength={17} className="uppercase font-mono" onChange={(e) => field.onChange(e.target.value.toUpperCase())} data-testid="input-new-collect-chassi" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={newCollectForm.control} name="manufacturerId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Montadora (Origem) *</FormLabel>
                  <Popover open={openManufacturer} onOpenChange={setOpenManufacturer}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("justify-between", !field.value && "text-muted-foreground")} data-testid="select-new-collect-manufacturer">
                          <span className="flex items-center gap-2"><Factory className="h-4 w-4 text-muted-foreground" />{field.value ? activeManufacturers?.find((m) => m.id === field.value)?.name : "Selecione"}</span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command><CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>Nenhuma encontrada.</CommandEmpty><CommandGroup>{activeManufacturers?.map((m) => (<CommandItem key={m.id} value={m.name} onSelect={() => { field.onChange(m.id); setOpenManufacturer(false); }}><CheckIcon className={cn("mr-2 h-4 w-4", field.value === m.id ? "opacity-100" : "opacity-0")} />{m.name}</CommandItem>))}</CommandGroup></CommandList></Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={newCollectForm.control} name="yardId" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Pátio de Destino *</FormLabel>
                  <Popover open={openYard} onOpenChange={setOpenYard}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn("justify-between", !field.value && "text-muted-foreground")} data-testid="select-new-collect-yard">
                          <span className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground" />{field.value ? activeYards?.find((y) => y.id === field.value)?.name : "Selecione"}</span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command><CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>Nenhum encontrado.</CommandEmpty><CommandGroup>{activeYards?.map((y) => (<CommandItem key={y.id} value={y.name} onSelect={() => { field.onChange(y.id); setOpenYard(false); }}><CheckIcon className={cn("mr-2 h-4 w-4", field.value === y.id ? "opacity-100" : "opacity-0")} />{y.name}</CommandItem>))}</CommandGroup></CommandList></Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={newCollectForm.control} name="driverId" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Motorista</FormLabel>
                    <Popover open={openDriver} onOpenChange={setOpenDriver}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("justify-between text-sm", !field.value && "text-muted-foreground")} data-testid="select-new-collect-driver">
                            {field.value ? activeDrivers?.find((d) => d.id === field.value)?.name ?? "Opcional" : "Opcional"}
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command><CommandInput placeholder="Buscar..." /><CommandList><CommandEmpty>Nenhum encontrado.</CommandEmpty><CommandGroup>{activeDrivers?.map((d) => (<CommandItem key={d.id} value={d.name} onSelect={() => { field.onChange(d.id); setOpenDriver(false); }}><CheckIcon className={cn("mr-2 h-4 w-4", field.value === d.id ? "opacity-100" : "opacity-0")} />{d.name}</CommandItem>))}</CommandGroup></CommandList></Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={newCollectForm.control} name="collectDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da Coleta</FormLabel>
                    <FormControl>
                      <Input {...field} type="datetime-local" data-testid="input-new-collect-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={newCollectForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Informações adicionais..." rows={2} data-testid="input-new-collect-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewCollectDialog(false)} data-testid="button-cancel-new-collect">Cancelar</Button>
                <Button type="submit" disabled={createCollectMutation.isPending} data-testid="button-submit-new-collect">
                  {createCollectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                  Registrar Coleta
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
