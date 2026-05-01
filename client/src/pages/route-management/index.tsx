import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Trash2,
  MapPin,
  Route,
  Loader2,
  Edit2,
  Navigation,
  Building2,
  User,
  Fuel,
  ReceiptText,
  BedDouble,
  UtensilsCrossed,
  PackageOpen,
  DollarSign,
  ListTree,
  Hash,
} from "lucide-react";
import type { Yard, Client, DeliveryLocation } from "@shared/schema";

const optionalCurrency = z.string().optional().transform(v => (v === "" ? undefined : v));

const routeFormSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  originYardId: z.string().min(1, "Selecione o pátio de origem"),
  clientId: z.string().min(1, "Selecione o cliente"),
  destinationLocationId: z.string().min(1, "Selecione o local de entrega"),
  distanceKm: z.string().optional(),
  fuelCost: optionalCurrency,
  tollCost: optionalCurrency,
  driverDailyCost: optionalCurrency,
  foodCost: optionalCurrency,
  othersCost: optionalCurrency,
  totalCost: optionalCurrency,
});

type RouteFormData = z.infer<typeof routeFormSchema>;
type CostMode = "detailed" | "total";

interface RouteWithRelations {
  id: string;
  name: string;
  originYardId: string;
  destinationLocationId: string;
  distanceKm: string | null;
  fuelCost: string | null;
  tollCost: string | null;
  driverDailyCost: string | null;
  foodCost: string | null;
  othersCost: string | null;
  totalCost: string | null;
  originYard: Yard | null;
  destinationLocation: DeliveryLocation | null;
  client: { id: string; name: string } | null;
}

interface DeliveryLocationWithClient extends DeliveryLocation {
  clientId: string;
}

const COST_FIELDS = [
  { name: "fuelCost" as const, label: "Combustível", icon: Fuel, placeholder: "Ex: 350.00" },
  { name: "tollCost" as const, label: "Pedágio", icon: ReceiptText, placeholder: "Ex: 120.00" },
  { name: "driverDailyCost" as const, label: "Hotel / Diária", icon: BedDouble, placeholder: "Ex: 200.00" },
  { name: "foodCost" as const, label: "Alimentação", icon: UtensilsCrossed, placeholder: "Ex: 80.00" },
  { name: "othersCost" as const, label: "Outros", icon: PackageOpen, placeholder: "Ex: 50.00" },
];

function getDisplayTotal(route: RouteWithRelations): string | null {
  if (route.totalCost) {
    const n = parseFloat(route.totalCost);
    return isNaN(n) ? null : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  const fields = [route.fuelCost, route.tollCost, route.driverDailyCost, route.foodCost, route.othersCost];
  const sum = fields.reduce((acc, v) => acc + (v ? parseFloat(v) : 0), 0);
  return sum > 0 ? sum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
}

export default function RouteManagementPage() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteWithRelations | null>(null);
  const [calculatingKm, setCalculatingKm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [costMode, setCostMode] = useState<CostMode>("detailed");
  const { toast } = useToast();

  const { data: routesList, isLoading } = useQuery<RouteWithRelations[]>({
    queryKey: ["/api/routes"],
  });

  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: allDeliveryLocations } = useQuery<DeliveryLocationWithClient[]>({
    queryKey: ["/api/delivery-locations"],
  });

  const activeYards = yards?.filter((y) => y.isActive === "true") ?? [];
  const activeClients = clientsList?.filter((c) => c.isActive === "true") ?? [];

  const form = useForm<RouteFormData>({
    resolver: zodResolver(routeFormSchema),
    defaultValues: {
      name: "",
      originYardId: "",
      clientId: "",
      destinationLocationId: "",
      distanceKm: "",
      fuelCost: "",
      tollCost: "",
      driverDailyCost: "",
      foodCost: "",
      othersCost: "",
      totalCost: "",
    },
  });

  const selectedClientId = form.watch("clientId");
  const selectedOriginYardId = form.watch("originYardId");
  const selectedDestinationId = form.watch("destinationLocationId");

  const filteredDeliveryLocations =
    allDeliveryLocations?.filter(
      (dl) => dl.isActive === "true" && dl.clientId === selectedClientId
    ) ?? [];

  useEffect(() => {
    form.setValue("destinationLocationId", "");
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedOriginYardId && selectedDestinationId) {
      calculateDistance(selectedOriginYardId, selectedDestinationId);
    }
  }, [selectedOriginYardId, selectedDestinationId]);

  async function calculateDistance(yardId: string, locationId: string) {
    setCalculatingKm(true);
    try {
      const res = await apiRequest("POST", "/api/routes/calculate-route", {
        originYardId: yardId,
        destinationLocationId: locationId,
        truckAxles: "2",
      });
      const data = await res.json();
      if (data.distanceKm) {
        form.setValue("distanceKm", String(parseFloat(data.distanceKm).toFixed(1)));
      }
    } catch {
      // silently fail — user can enter manually
    } finally {
      setCalculatingKm(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: Omit<RouteFormData, "clientId">) =>
      apiRequest("POST", "/api/routes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Rota criada com sucesso!" });
      setShowDialog(false);
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao criar rota", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<RouteFormData, "clientId"> }) =>
      apiRequest("PATCH", `/api/routes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Rota atualizada com sucesso!" });
      setShowDialog(false);
      setEditingRoute(null);
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao atualizar rota", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/routes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/routes"] });
      toast({ title: "Rota excluída." });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir rota", variant: "destructive" });
    },
  });

  function openCreate() {
    setEditingRoute(null);
    setCostMode("detailed");
    form.reset({
      name: "",
      originYardId: "",
      clientId: "",
      destinationLocationId: "",
      distanceKm: "",
      fuelCost: "",
      tollCost: "",
      driverDailyCost: "",
      foodCost: "",
      othersCost: "",
      totalCost: "",
    });
    setShowDialog(true);
  }

  function openEdit(route: RouteWithRelations) {
    setEditingRoute(route);
    const clientId = route.destinationLocation?.clientId ?? route.client?.id ?? "";
    const mode: CostMode = route.totalCost ? "total" : "detailed";
    setCostMode(mode);
    form.reset({
      name: route.name,
      originYardId: route.originYardId,
      clientId,
      destinationLocationId: route.destinationLocationId,
      distanceKm: route.distanceKm ?? "",
      fuelCost: route.fuelCost ?? "",
      tollCost: route.tollCost ?? "",
      driverDailyCost: route.driverDailyCost ?? "",
      foodCost: route.foodCost ?? "",
      othersCost: route.othersCost ?? "",
      totalCost: route.totalCost ?? "",
    });
    setShowDialog(true);
  }

  function onSubmit(values: RouteFormData) {
    const { clientId, ...rest } = values;
    // Clear fields that don't apply to the chosen mode
    if (costMode === "total") {
      rest.fuelCost = undefined;
      rest.tollCost = undefined;
      rest.driverDailyCost = undefined;
      rest.foodCost = undefined;
      rest.othersCost = undefined;
    } else {
      rest.totalCost = undefined;
    }
    if (editingRoute) {
      updateMutation.mutate({ id: editingRoute.id, data: rest });
    } else {
      createMutation.mutate(rest);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Gestão de Rotas"
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Gestão de Rotas" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={openCreate} data-testid="button-new-route">
            <Plus className="mr-2 h-4 w-4" />
            Nova Rota
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Carregando rotas...
          </div>
        ) : !routesList?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Route className="h-12 w-12 opacity-30" />
            <p className="text-sm">Nenhuma rota cadastrada ainda.</p>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira rota
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pátio de Origem</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Local de Entrega</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Distância</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Custo Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {routesList.map((route, idx) => (
                  <tr
                    key={route.id}
                    className={`border-t transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    data-testid={`row-route-${route.id}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Route className="h-4 w-4 text-primary shrink-0" />
                        {route.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {route.originYard?.name ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {route.client?.name ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {route.destinationLocation?.name ?? "-"}
                        {route.destinationLocation?.city
                          ? ` — ${route.destinationLocation.city}/${route.destinationLocation.state}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {route.distanceKm ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          <Navigation className="h-3.5 w-3.5" />
                          {parseFloat(route.distanceKm).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getDisplayTotal(route) ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 dark:text-green-400">
                          <DollarSign className="h-3.5 w-3.5" />
                          {getDisplayTotal(route)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(route)}
                          data-testid={`button-edit-route-${route.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(route.id)}
                          data-testid={`button-delete-route-${route.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setEditingRoute(null); form.reset(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoute ? "Editar Rota" : "Nova Rota"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Rota</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: SP → Santos" {...field} data-testid="input-route-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="originYardId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pátio de Origem</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-origin-yard">
                          <SelectValue placeholder="Selecione o pátio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeYards.map((y) => (
                          <SelectItem key={y.id} value={y.id}>
                            {y.name}{y.city ? ` — ${y.city}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-client">
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeClients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destinationLocationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local de Entrega</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedClientId}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-destination-location">
                          <SelectValue placeholder={selectedClientId ? "Selecione o local" : "Selecione o cliente primeiro"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredDeliveryLocations.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            Nenhum local cadastrado para este cliente
                          </SelectItem>
                        ) : (
                          filteredDeliveryLocations.map((dl) => (
                            <SelectItem key={dl.id} value={dl.id}>
                              {dl.name}{dl.city ? ` — ${dl.city}/${dl.state}` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="distanceKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Distância (km)
                      {calculatingKm && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Calculando...
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Ex: 120.5"
                        {...field}
                        data-testid="input-distance-km"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Calculado automaticamente ao selecionar origem e destino. Você pode editar se necessário.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cost section */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Custos da Rota</span>
                  <div className="flex-1 border-t" />
                  {/* Mode toggle */}
                  <div className="flex items-center rounded-md border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setCostMode("detailed")}
                      data-testid="button-cost-mode-detailed"
                      className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                        costMode === "detailed"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <ListTree className="h-3 w-3" />
                      Detalhado
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostMode("total")}
                      data-testid="button-cost-mode-total"
                      className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors border-l ${
                        costMode === "total"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Hash className="h-3 w-3" />
                      Valor Total
                    </button>
                  </div>
                </div>

                {costMode === "detailed" ? (
                  <div className="grid grid-cols-2 gap-3">
                    {COST_FIELDS.map(({ name, label, icon: Icon, placeholder }) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1.5 text-xs">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {label}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder={placeholder}
                                  className="pl-8"
                                  {...field}
                                  data-testid={`input-cost-${name}`}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <FormField
                    control={form.control}
                    name="totalCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5 text-sm">
                          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                          Custo Total da Rota
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Ex: 800.00"
                              className="pl-10 h-11 text-base"
                              {...field}
                              data-testid="input-total-cost"
                            />
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Informe o custo total da rota sem detalhar por categoria.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowDialog(false); setEditingRoute(null); form.reset(); }}
                  data-testid="button-cancel-route"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-save-route">
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRoute ? "Salvar Alterações" : "Criar Rota"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Rota</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
