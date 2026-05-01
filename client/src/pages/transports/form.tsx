import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { normalizeImageUrl } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ChevronsUpDown, Upload, X, MapPin, Camera, CheckCircle, Clock, Route, Building2, XCircle, ClipboardList, Users, User, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transport, Client, Yard, Vehicle, DeliveryLocation, Driver, TravelRate } from "@shared/schema";

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

interface PhotoUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  testId: string;
}

function PhotoUpload({ label, value, onChange, testId }: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          name: file.name,
          isPublic: false,
        }),
      });
      if (!response.ok) throw new Error("Failed to get upload URL");

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      onChange(objectPath);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="h-24 w-24 rounded-md object-cover border" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
            data-testid={testId}
          />
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <Camera className="h-6 w-6 text-muted-foreground" />
          )}
        </label>
      )}
    </div>
  );
}

interface MultiPhotoUploadProps {
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
  testId: string;
  maxPhotos?: number;
}

function MultiPhotoUpload({ label, values = [], onChange, testId, maxPhotos = 5 }: MultiPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          name: file.name,
          isPublic: false,
        }),
      });
      if (!response.ok) throw new Error("Failed to get upload URL");

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      onChange([...values, objectPath]);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((url, index) => (
          <div key={index} className="relative">
            <img src={url} alt={`${label} ${index + 1}`} className="h-20 w-20 rounded-md object-cover border" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5"
              onClick={() => removePhoto(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {values.length < maxPhotos && (
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
              data-testid={testId}
            />
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
          </label>
        )}
      </div>
    </div>
  );
}

const formSchema = z.object({
  vehicleChassi: z.string().min(1, "Veículo é obrigatório"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  originYardId: z.string().min(1, "Pátio de origem é obrigatório"),
  deliveryLocationId: z.string().min(1, "Local de entrega é obrigatório"),
  driverId: z.string().optional(),
  travelRateId: z.string().optional(),
  status: z.enum(["pendente", "pendente_aprovacao", "aguardando_saida", "em_transito", "entregue", "cancelado"]),
  deliveryDate: z.string().optional(),
  scheduledDeparture: z.string().optional(),
  transitStartedAt: z.string().optional(),
  notes: z.string().optional(),
  // Check-in fields
  checkinLatitude: z.string().optional(),
  checkinLongitude: z.string().optional(),

  checkinFrontalPhoto: z.string().optional(),
  checkinLateral1Photo: z.string().optional(),
  checkinLateral2Photo: z.string().optional(),
  checkinTraseiraPhoto: z.string().optional(),
  checkinOdometerPhoto: z.string().optional(),
  checkinFuelLevelPhoto: z.string().optional(),
  checkinDamagePhotos: z.array(z.string()).optional(),
  checkinSelfiePhoto: z.string().optional(),
  checkinNotes: z.string().optional(),
  // Check-out fields
  checkoutLatitude: z.string().optional(),
  checkoutLongitude: z.string().optional(),
  checkoutFrontalPhoto: z.string().optional(),
  checkoutLateral1Photo: z.string().optional(),
  checkoutLateral2Photo: z.string().optional(),
  checkoutTraseiraPhoto: z.string().optional(),
  checkoutOdometerPhoto: z.string().optional(),
  checkoutFuelLevelPhoto: z.string().optional(),
  checkoutDamagePhotos: z.array(z.string()).optional(),
  checkoutSelfiePhoto: z.string().optional(),
  checkoutNotes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function TransportFormPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = id && id !== "novo";
  const [chassiOpen, setChassiOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [gettingCheckinLocation, setGettingCheckinLocation] = useState(false);
  const [gettingCheckoutLocation, setGettingCheckoutLocation] = useState(false);

  const { data: transport, isLoading: transportLoading } = useQuery<Transport>({
    queryKey: ["/api/transports", id],
    enabled: !!isEditing,
  });

  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: travelRates } = useQuery<TravelRate[]>({ queryKey: ["/api/travel-rates"] });
  const { data: savedRoutes = [] } = useQuery<RouteWithRelations[]>({ queryKey: ["/api/routes"] });

  interface TransportProposalSummary {
    id: string;
    proposalNumber: string | null;
    status: string;
    startDate: string | null;
    createdAt: string | null;
    totalDriverResponses: number;
    acceptedDrivers: number;
    assignedDriver: { id: string; name: string } | null;
  }
  const { data: linkedProposals = [] } = useQuery<TransportProposalSummary[]>({
    queryKey: ["/api/transports", id, "proposals"],
    enabled: !!isEditing,
    staleTime: 0,
  });

  const [appliedRouteId, setAppliedRouteId] = useState<string | null>(null);
  const [pendingDeliveryLocationId, setPendingDeliveryLocationId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vehicleChassi: "",
      clientId: "",
      originYardId: "",
      deliveryLocationId: "",
      driverId: "",
      travelRateId: undefined,
      status: "pendente",
      deliveryDate: "",
      scheduledDeparture: "",
      transitStartedAt: "",
      notes: "",
      // Check-in fields
      checkinLatitude: "",
      checkinLongitude: "",
      checkinFrontalPhoto: "",
      checkinLateral1Photo: "",
      checkinLateral2Photo: "",
      checkinTraseiraPhoto: "",
      checkinOdometerPhoto: "",
      checkinFuelLevelPhoto: "",
      checkinDamagePhotos: [],
      checkinSelfiePhoto: "",
      checkinNotes: "",
      // Check-out fields
      checkoutLatitude: "",
      checkoutLongitude: "",
      checkoutFrontalPhoto: "",
      checkoutLateral1Photo: "",
      checkoutLateral2Photo: "",
      checkoutTraseiraPhoto: "",
      checkoutOdometerPhoto: "",
      checkoutFuelLevelPhoto: "",
      checkoutDamagePhotos: [],
      checkoutSelfiePhoto: "",
      checkoutNotes: "",
    },
  });

  const clientId = form.watch("clientId");

  const { data: deliveryLocations } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/clients", clientId, "locations"],
    enabled: !!clientId,
  });

  useEffect(() => {
    if (transport) {
      form.reset({
        vehicleChassi: transport.vehicleChassi || "",
        clientId: transport.clientId || "",
        originYardId: transport.originYardId || "",
        deliveryLocationId: transport.deliveryLocationId || "",
        driverId: transport.driverId || "",
        travelRateId: transport.travelRateId || undefined,
        status: transport.status,
        deliveryDate: transport.deliveryDate
          ? format(new Date(transport.deliveryDate as unknown as string), "yyyy-MM-dd")
          : "",
        scheduledDeparture: transport.scheduledDeparture
          ? format(new Date(transport.scheduledDeparture as unknown as string), "yyyy-MM-dd'T'HH:mm")
          : "",
        transitStartedAt: transport.transitStartedAt
          ? format(new Date(transport.transitStartedAt as unknown as string), "yyyy-MM-dd'T'HH:mm")
          : "",
        notes: transport.notes || "",
        // Check-in fields
        checkinLatitude: transport.checkinLocation ? String(transport.checkinLocation.coordinates[1]) : "",
        checkinLongitude: transport.checkinLocation ? String(transport.checkinLocation.coordinates[0]) : "",
        checkinFrontalPhoto: transport.checkinFrontalPhoto || "",
        checkinLateral1Photo: transport.checkinLateral1Photo || "",
        checkinLateral2Photo: transport.checkinLateral2Photo || "",
        checkinTraseiraPhoto: transport.checkinTraseiraPhoto || "",
        checkinOdometerPhoto: transport.checkinOdometerPhoto || "",
        checkinFuelLevelPhoto: transport.checkinFuelLevelPhoto || "",
        checkinDamagePhotos: transport.checkinDamagePhotos || [],
        checkinSelfiePhoto: transport.checkinSelfiePhoto || "",
        checkinNotes: transport.checkinNotes || "",
        // Check-out fields
        checkoutLatitude: transport.checkoutLocation ? String(transport.checkoutLocation.coordinates[1]) : "",
        checkoutLongitude: transport.checkoutLocation ? String(transport.checkoutLocation.coordinates[0]) : "",
        checkoutFrontalPhoto: transport.checkoutFrontalPhoto || "",
        checkoutLateral1Photo: transport.checkoutLateral1Photo || "",
        checkoutLateral2Photo: transport.checkoutLateral2Photo || "",
        checkoutTraseiraPhoto: transport.checkoutTraseiraPhoto || "",
        checkoutOdometerPhoto: transport.checkoutOdometerPhoto || "",
        checkoutFuelLevelPhoto: transport.checkoutFuelLevelPhoto || "",
        checkoutDamagePhotos: transport.checkoutDamagePhotos || [],
        checkoutSelfiePhoto: transport.checkoutSelfiePhoto || "",
        checkoutNotes: transport.checkoutNotes || "",
      });
    }
  }, [transport, form]);

  useEffect(() => {
    if (!isEditing && travelRates && travelRates.length > 0) {
      const currentValue = form.getValues("travelRateId");
      if (!currentValue) {
        const padrao = travelRates.find((r) =>
          r.name.toLowerCase().includes("padrão") || r.name.toLowerCase().includes("padrao")
        );
        const defaultRate = padrao ?? travelRates.find((r) => r.isActive === "true") ?? travelRates[0];
        if (defaultRate) form.setValue("travelRateId", defaultRate.id);
      }
    }
  }, [travelRates, isEditing]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        driverId: data.driverId || null,
        travelRateId: data.travelRateId || null,
      };
      if (isEditing) {
        return apiRequest("PATCH", `/api/transports/${id}`, payload);
      }
      return apiRequest("POST", "/api/transports", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: isEditing ? "Transporte atualizado com sucesso" : "Transporte criado com sucesso" });
      navigate("/transportes");
    },
    onError: () => {
      toast({ title: "Erro ao salvar transporte", variant: "destructive" });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const data = form.getValues();
      return apiRequest("PATCH", `/api/transports/${id}/checkin`, {
        latitude: data.checkinLatitude,
        longitude: data.checkinLongitude,
        frontalPhoto: data.checkinFrontalPhoto,
        lateral1Photo: data.checkinLateral1Photo,
        lateral2Photo: data.checkinLateral2Photo,
        traseiraPhoto: data.checkinTraseiraPhoto,
        odometerPhoto: data.checkinOdometerPhoto,
        fuelLevelPhoto: data.checkinFuelLevelPhoto,
        damagePhotos: data.checkinDamagePhotos,
        selfiePhoto: data.checkinSelfiePhoto,
        notes: data.checkinNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transports", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Check-in realizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao realizar check-in", variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const data = form.getValues();
      return apiRequest("PATCH", `/api/transports/${id}/checkout`, {
        latitude: data.checkoutLatitude,
        longitude: data.checkoutLongitude,
        frontalPhoto: data.checkoutFrontalPhoto,
        lateral1Photo: data.checkoutLateral1Photo,
        lateral2Photo: data.checkoutLateral2Photo,
        traseiraPhoto: data.checkoutTraseiraPhoto,
        odometerPhoto: data.checkoutOdometerPhoto,
        fuelLevelPhoto: data.checkoutFuelLevelPhoto,
        damagePhotos: data.checkoutDamagePhotos,
        selfiePhoto: data.checkoutSelfiePhoto,
        notes: data.checkoutNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transports", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Check-out realizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao realizar check-out", variant: "destructive" });
    },
  });

  const getCheckinLocation = () => {
    setGettingCheckinLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("checkinLatitude", position.coords.latitude.toString());
        form.setValue("checkinLongitude", position.coords.longitude.toString());
        setGettingCheckinLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({ title: "Erro ao obter localização", variant: "destructive" });
        setGettingCheckinLocation(false);
      }
    );
  };

  const getCheckoutLocation = () => {
    setGettingCheckoutLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("checkoutLatitude", position.coords.latitude.toString());
        form.setValue("checkoutLongitude", position.coords.longitude.toString());
        setGettingCheckoutLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({ title: "Erro ao obter localização", variant: "destructive" });
        setGettingCheckoutLocation(false);
      }
    );
  };

  // Only show chassis that already have an associated client. The currently
  // selected vehicle (when editing an existing transport) is always kept in
  // the list so the form can still display it even if it doesn't match the
  // filter anymore.
  const availableVehicles = vehicles?.filter(
    (v) => v.chassi === transport?.vehicleChassi || (v.status === "em_estoque" && !!v.clientId),
  );
  const activeDrivers = drivers?.filter((d) => d.isActive === "true" && d.isApto === "true");

  function applyRoute(route: RouteWithRelations) {
    const newClientId = route.client?.id ?? route.destinationLocation?.clientId ?? "";
    form.setValue("originYardId", route.originYardId, { shouldValidate: true });
    form.setValue("clientId", newClientId, { shouldValidate: true });
    form.setValue("deliveryLocationId", "", { shouldValidate: false });
    setPendingDeliveryLocationId(route.destinationLocationId);
    setAppliedRouteId(route.id);
  }

  useEffect(() => {
    if (!pendingDeliveryLocationId || !deliveryLocations?.length) return;
    const exists = deliveryLocations.find(dl => dl.id === pendingDeliveryLocationId);
    if (exists) {
      form.setValue("deliveryLocationId", pendingDeliveryLocationId, { shouldValidate: true });
      setPendingDeliveryLocationId(null);
    }
  }, [deliveryLocations, pendingDeliveryLocationId]);

  if (isEditing && transportLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title={isEditing ? "Editar Transporte" : "Novo Transporte"}
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Transportes", href: "/transportes" },
          { label: isEditing ? "Editar" : "Novo" },
        ]}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-6">
        {isEditing && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-violet-500" />
                Propostas de Transporte Vinculadas
                {linkedProposals.length > 0 && (
                  <span className="ml-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold px-2 py-0.5">
                    {linkedProposals.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {linkedProposals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma proposta vinculada a este transporte.</p>
              ) : (
                <div className="divide-y divide-border rounded-md border">
                  {linkedProposals.map(p => {
                    const statusLabel: Record<string, string> = { ativa: "Ativa", encerrada: "Encerrada", cancelada: "Cancelada" };
                    const statusColor: Record<string, string> = {
                      ativa: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                      encerrada: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                      cancelada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                    };
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors" data-testid={`row-proposal-${p.id}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" data-testid={`text-proposal-number-${p.id}`}>{p.proposalNumber ?? "—"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status] ?? "bg-muted text-muted-foreground"}`}>
                              {statusLabel[p.status] ?? p.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                            {p.startDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(p.startDate), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {p.acceptedDrivers}/{p.totalDriverResponses} aceitos
                            </span>
                            {p.assignedDriver && (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                <User className="h-3 w-3" />
                                {p.assignedDriver.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/proposta-transporte/${p.id}`}
                          className="shrink-0 p-1.5 rounded-md hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 hover:text-violet-700 transition-colors"
                          title="Ver proposta"
                          data-testid={`link-proposal-${p.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Form {...form}>
          <form id="transport-form" onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados do Transporte</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {/* Route selector */}
                {!isEditing && savedRoutes.length > 0 && (
                  <div className="md:col-span-2">
                    {appliedRouteId ? (
                      <div className="flex items-center justify-between rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Route className="h-4 w-4 text-violet-600 shrink-0" />
                          <div>
                            <span className="text-sm font-medium text-violet-900 dark:text-violet-200">
                              Rota aplicada:{" "}
                              <span className="font-semibold">
                                {savedRoutes.find(r => r.id === appliedRouteId)?.name}
                              </span>
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-violet-700 dark:text-violet-300">
                              {savedRoutes.find(r => r.id === appliedRouteId)?.client?.name && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {savedRoutes.find(r => r.id === appliedRouteId)?.client?.name}
                                </span>
                              )}
                              {savedRoutes.find(r => r.id === appliedRouteId)?.destinationLocation && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {savedRoutes.find(r => r.id === appliedRouteId)?.destinationLocation?.name}
                                  {" – "}
                                  {savedRoutes.find(r => r.id === appliedRouteId)?.destinationLocation?.city}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-violet-500 hover:text-violet-700 p-1 rounded"
                          onClick={() => { setAppliedRouteId(null); setPendingDeliveryLocationId(null); }}
                          title="Remover rota"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                          <Route className="h-3.5 w-3.5" />
                          Definir via rota salva
                        </label>
                        <Select onValueChange={(id) => {
                          const route = savedRoutes.find(r => r.id === id);
                          if (route) applyRoute(route);
                        }}>
                          <SelectTrigger className="h-10" data-testid="select-route">
                            <SelectValue placeholder="Selecione uma rota para preencher automaticamente…" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedRoutes.map(route => (
                              <SelectItem key={route.id} value={route.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{route.name}</span>
                                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                                    {route.client?.name && (
                                      <span className="flex items-center gap-1">
                                        <Building2 className="h-3 w-3" />
                                        {route.client.name}
                                      </span>
                                    )}
                                    {route.destinationLocation && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {route.destinationLocation.name} – {route.destinationLocation.city}/{route.destinationLocation.state}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="vehicleChassi"
                  render={({ field }) => {
                    const selectedVehicle = availableVehicles?.find(v => v.chassi === field.value);
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Veículo (Chassi) *</FormLabel>
                        <Popover open={chassiOpen} onOpenChange={setChassiOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={chassiOpen}
                                className={cn(
                                  "justify-between font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="select-transport-vehicle"
                              >
                                {selectedVehicle
                                  ? selectedVehicle.chassi
                                  : "Buscar chassi..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Digite para buscar chassi..." />
                              <CommandList>
                                <CommandEmpty>Nenhum veículo encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {availableVehicles?.map((v) => (
                                    <CommandItem
                                      key={v.chassi}
                                      value={v.chassi}
                                      onSelect={() => {
                                        field.onChange(v.chassi);
                                        setChassiOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === v.chassi ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {v.chassi}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-transport-status">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="aguardando_saida">Aguardando Saída</SelectItem>
                          <SelectItem value="em_transito">Em Trânsito</SelectItem>
                          <SelectItem value="entregue">Entregue</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originYardId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pátio de Origem *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-transport-origin">
                            <SelectValue placeholder="Selecione o pátio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {yards?.map((y) => (
                            <SelectItem key={y.id} value={y.id}>
                              {y.name}
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
                      <FormLabel>Cliente *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("deliveryLocationId", "");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-transport-client">
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((c) => (
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
                  name="deliveryLocationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local de Entrega *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!clientId}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-transport-delivery">
                            <SelectValue placeholder={clientId ? "Selecione o local" : "Selecione um cliente primeiro"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {deliveryLocations?.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name} - {loc.city}/{loc.state}
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
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Entrega</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-transport-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledDeparture"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data da Saída</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-transport-departure" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="transitStartedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início de Viagem</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-transport-transit-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="driverId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motorista</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-transport-driver">
                            <SelectValue placeholder="Selecione o motorista" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground italic">— Sem motorista —</span>
                          </SelectItem>
                          {activeDrivers?.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} - {d.phone}
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
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-transport-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {isEditing && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-base">Check-in (Retirada do Pátio)</CardTitle>
                    <div className="flex items-center gap-2">
                      {transport?.checkinDateTime ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Realizado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {transport?.checkinDateTime && (
                      <p className="text-sm text-muted-foreground">
                        Realizado em {format(new Date(transport.checkinDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}

                    {isEditMode && !transport?.checkinDateTime ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="checkinLatitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Latitude</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Latitude" data-testid="input-checkin-latitude" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="checkinLongitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Longitude</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Longitude" data-testid="input-checkin-longitude" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={getCheckinLocation}
                          disabled={gettingCheckinLocation}
                        >
                          {gettingCheckinLocation ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <MapPin className="mr-2 h-4 w-4" />
                          )}
                          Obter Localização
                        </Button>

                        {/* Seção: Fotos do Veículo */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Veículo</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <FormField
                              control={form.control}
                              name="checkinFrontalPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Frontal"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkin-frontal"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkinLateral1Photo"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Lateral 1"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkin-lateral1"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkinLateral2Photo"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Lateral 2"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkin-lateral2"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkinTraseiraPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Traseira"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkin-traseira"
                                />
                              )}
                            />
                          </div>
                        </div>

                        {/* Seção: Fotos do Painel */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Painel</h3>
                          <div className="grid grid-cols-2 gap-4 justify-items-center">
                            <FormField
                              control={form.control}
                              name="checkinOdometerPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Foto do Odômetro"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkin-odometer"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkinFuelLevelPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Nível de Combustível"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkin-fuel"
                                />
                              )}
                            />
                          </div>
                        </div>

                        {/* Seção: Avarias */}
                        <div className="rounded-lg border p-4">
                          <FormField
                            control={form.control}
                            name="checkinDamagePhotos"
                            render={({ field }) => (
                              <>
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                                  Avarias <span className="font-normal">({(field.value || []).length}/10)</span>
                                </h3>
                                <MultiPhotoUpload
                                  label=""
                                  values={field.value || []}
                                  onChange={field.onChange}
                                  testId="upload-checkin-damage"
                                  maxPhotos={10}
                                />
                              </>
                            )}
                          />
                        </div>

                        {/* Seção: Selfie */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Selfie do Motorista</h3>
                          <FormField
                            control={form.control}
                            name="checkinSelfiePhoto"
                            render={({ field }) => (
                              <PhotoUpload
                                label=""
                                value={field.value || ""}
                                onChange={field.onChange}
                                testId="upload-checkin-selfie"
                              />
                            )}
                          />
                        </div>

                        {/* Seção: Observações */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Observações</h3>
                          <FormField
                            control={form.control}
                            name="checkinNotes"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea {...field} placeholder="Observações sobre o veículo..." data-testid="input-checkin-notes" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button
                          type="button"
                          onClick={() => checkinMutation.mutate()}
                          disabled={checkinMutation.isPending}
                          className="w-full"
                          data-testid="button-checkin"
                        >
                          {checkinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Realizar Check-in
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Latitude</p>
                            <p className="text-sm font-mono">{transport?.checkinLocation ? String(transport.checkinLocation.coordinates[1]) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Longitude</p>
                            <p className="text-sm font-mono">{transport?.checkinLocation ? String(transport.checkinLocation.coordinates[0]) : "-"}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Fotos do Veículo</p>
                        <div className="flex flex-wrap gap-2">
                          {transport?.checkinFrontalPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Frontal</p>
                              <img src={transport.checkinFrontalPhoto} alt="Frontal" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkinLateral1Photo && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Lateral 1</p>
                              <img src={transport.checkinLateral1Photo} alt="Lateral 1" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkinLateral2Photo && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Lateral 2</p>
                              <img src={transport.checkinLateral2Photo} alt="Lateral 2" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkinTraseiraPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Traseira</p>
                              <img src={transport.checkinTraseiraPhoto} alt="Traseira" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Painel</p>
                        <div className="flex flex-wrap gap-2">
                          {transport?.checkinOdometerPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Odômetro</p>
                              <img src={transport.checkinOdometerPhoto} alt="Odômetro" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkinFuelLevelPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Combustível</p>
                              <img src={transport.checkinFuelLevelPhoto} alt="Combustível" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                        </div>
                        {transport?.checkinDamagePhotos?.length ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Fotos de Avarias</p>
                            <div className="flex flex-wrap gap-2">
                              {transport.checkinDamagePhotos.map((photo, i) => (
                                <img key={i} src={photo} alt={`Avaria ${i + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {transport?.checkinSelfiePhoto && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Selfie do Motorista</p>
                            <img src={transport.checkinSelfiePhoto} alt="Selfie" className="h-16 w-16 rounded-md object-cover border" />
                          </div>
                        )}
                        {transport?.checkinNotes && (
                          <div>
                            <p className="text-xs text-muted-foreground">Observações</p>
                            <p className="text-sm">{transport.checkinNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-base">Check-out (Entrega ao Cliente)</CardTitle>
                    <div className="flex items-center gap-2">
                      {transport?.checkoutDateTime ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Realizado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="mr-1 h-3 w-3" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {transport?.checkoutDateTime && (
                      <p className="text-sm text-muted-foreground">
                        Realizado em {format(new Date(transport.checkoutDateTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}

                    {isEditMode && !transport?.checkoutDateTime && transport?.checkinDateTime ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="checkoutLatitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Latitude</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Latitude" data-testid="input-checkout-latitude" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="checkoutLongitude"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Longitude</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Longitude" data-testid="input-checkout-longitude" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={getCheckoutLocation}
                          disabled={gettingCheckoutLocation}
                        >
                          {gettingCheckoutLocation ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <MapPin className="mr-2 h-4 w-4" />
                          )}
                          Obter Localização
                        </Button>

                        {/* Seção: Fotos do Veículo */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Veículo</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <FormField
                              control={form.control}
                              name="checkoutFrontalPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Frontal"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkout-frontal"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkoutLateral1Photo"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Lateral 1"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkout-lateral1"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkoutLateral2Photo"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Lateral 2"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkout-lateral2"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkoutTraseiraPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Traseira"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkout-traseira"
                                />
                              )}
                            />
                          </div>
                        </div>

                        {/* Seção: Fotos do Painel */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Painel</h3>
                          <div className="grid grid-cols-2 gap-4 justify-items-center">
                            <FormField
                              control={form.control}
                              name="checkoutOdometerPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Foto do Odômetro"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkout-odometer"
                                />
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="checkoutFuelLevelPhoto"
                              render={({ field }) => (
                                <PhotoUpload
                                  label="Nível de Combustível"
                                  value={field.value || ""}
                                  onChange={field.onChange}
                                  testId="upload-checkout-fuel"
                                />
                              )}
                            />
                          </div>
                        </div>

                        {/* Seção: Avarias */}
                        <div className="rounded-lg border p-4">
                          <FormField
                            control={form.control}
                            name="checkoutDamagePhotos"
                            render={({ field }) => (
                              <>
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                                  Avarias <span className="font-normal">({(field.value || []).length}/10)</span>
                                </h3>
                                <MultiPhotoUpload
                                  label=""
                                  values={field.value || []}
                                  onChange={field.onChange}
                                  testId="upload-checkout-damage"
                                  maxPhotos={10}
                                />
                              </>
                            )}
                          />
                        </div>

                        {/* Seção: Selfie */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Selfie do Motorista</h3>
                          <FormField
                            control={form.control}
                            name="checkoutSelfiePhoto"
                            render={({ field }) => (
                              <PhotoUpload
                                label=""
                                value={field.value || ""}
                                onChange={field.onChange}
                                testId="upload-checkout-selfie"
                              />
                            )}
                          />
                        </div>

                        {/* Seção: Observações */}
                        <div className="rounded-lg border p-4">
                          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Observações</h3>
                          <FormField
                            control={form.control}
                            name="checkoutNotes"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea {...field} placeholder="Observações sobre o veículo..." data-testid="input-checkout-notes" />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button
                          type="button"
                          onClick={() => checkoutMutation.mutate()}
                          disabled={checkoutMutation.isPending}
                          className="w-full"
                          data-testid="button-checkout"
                        >
                          {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Realizar Check-out
                        </Button>
                      </>
                    ) : !transport?.checkinDateTime ? (
                      <p className="text-sm text-muted-foreground">
                        Realize o check-in primeiro para habilitar o check-out.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Latitude</p>
                            <p className="text-sm font-mono">{transport?.checkoutLocation ? String(transport.checkoutLocation.coordinates[1]) : "-"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Longitude</p>
                            <p className="text-sm font-mono">{transport?.checkoutLocation ? String(transport.checkoutLocation.coordinates[0]) : "-"}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Fotos do Veículo</p>
                        <div className="flex flex-wrap gap-2">
                          {transport?.checkoutFrontalPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Frontal</p>
                              <img src={transport.checkoutFrontalPhoto} alt="Frontal" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkoutLateral1Photo && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Lateral 1</p>
                              <img src={transport.checkoutLateral1Photo} alt="Lateral 1" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkoutLateral2Photo && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Lateral 2</p>
                              <img src={transport.checkoutLateral2Photo} alt="Lateral 2" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkoutTraseiraPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Traseira</p>
                              <img src={transport.checkoutTraseiraPhoto} alt="Traseira" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Painel</p>
                        <div className="flex flex-wrap gap-2">
                          {transport?.checkoutOdometerPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Odômetro</p>
                              <img src={transport.checkoutOdometerPhoto} alt="Odômetro" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                          {transport?.checkoutFuelLevelPhoto && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Combustível</p>
                              <img src={transport.checkoutFuelLevelPhoto} alt="Combustível" className="h-16 w-16 rounded-md object-cover border" />
                            </div>
                          )}
                        </div>
                        {transport?.checkoutDamagePhotos?.length ? (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Fotos de Avarias</p>
                            <div className="flex flex-wrap gap-2">
                              {transport.checkoutDamagePhotos.map((photo, i) => (
                                <img key={i} src={photo} alt={`Avaria ${i + 1}`} className="h-16 w-16 rounded-md object-cover border" />
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {transport?.checkoutSelfiePhoto && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Selfie do Motorista</p>
                            <img src={transport.checkoutSelfiePhoto} alt="Selfie" className="h-16 w-16 rounded-md object-cover border" />
                          </div>
                        )}
                        {transport?.checkoutNotes && (
                          <div>
                            <p className="text-xs text-muted-foreground">Observações</p>
                            <p className="text-sm">{transport.checkoutNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

          </form>
        </Form>
        </div>
        <aside className="w-56 shrink-0 border-l bg-card flex flex-col gap-4 p-4 overflow-y-auto">
          {isEditing && transport && (
            <div className="space-y-2 pb-4 border-b">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transporte</p>
              <p className="font-semibold text-sm">{(transport as any).requestNumber ?? id}</p>
              <Badge variant="outline" className="text-xs capitalize">
                {transport.status?.replace(/_/g, " ")}
              </Badge>
            </div>
          )}
          {isEditing && linkedProposals.length > 0 && (
            <div className="space-y-1.5 pb-3 border-b">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-violet-500" />
                Propostas ({linkedProposals.length})
              </p>
              {linkedProposals.map(p => (
                <Link
                  key={p.id}
                  href={`/proposta-transporte/${p.id}`}
                  className="flex items-center justify-between gap-1 rounded px-1.5 py-1 hover:bg-muted transition-colors group"
                  data-testid={`sidebar-link-proposal-${p.id}`}
                >
                  <span className="text-xs font-medium truncate group-hover:text-violet-600">{p.proposalNumber ?? "—"}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-violet-600 shrink-0" />
                </Link>
              ))}
            </div>
          )}
          {isEditing && (
            <Button
              type="button"
              variant={isEditMode ? "default" : "outline"}
              onClick={() => setIsEditMode(!isEditMode)}
              className="w-full"
              data-testid="button-toggle-edit"
            >
              {isEditMode ? "Visualizar" : "Editar"}
            </Button>
          )}
          <div className="mt-auto flex flex-col gap-2">
            <Button
              type="button"
              className="w-full"
              disabled={mutation.isPending || (!!isEditing && !isEditMode)}
              onClick={() => form.handleSubmit((data) => mutation.mutate(data))()}
              data-testid="button-save-transport"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : "Criar Transporte"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/transportes")}
            >
              Cancelar
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
