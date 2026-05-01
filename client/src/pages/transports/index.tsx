import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, LogIn, LogOut, MapPin, Loader2, Camera, Upload, X, CheckCircle, XCircle, Eye, Navigation, Clock, Fuel, Receipt, Route, Car, Info, Check, ChevronsUpDown, PackageCheck, MoreHorizontal, UserPlus, Building2, Truck, User, CalendarDays, FileText, ArrowDown, ClipboardList, RefreshCw, DollarSign, Wallet } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { normalizeImageUrl, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Transport, Client, Yard, Vehicle, DeliveryLocation, Driver, DeletedTransport } from "@shared/schema";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ptBR } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

interface TransportWithRelations extends Transport {
  client?: { name: string };
  driver?: { name: string; phone: string };
  originYard?: { id: string; name: string; city: string | null; state: string | null } | null;
  deliveryLocation?: { name: string; city: string; state: string };
  createdByUser?: { id: string; username: string; firstName: string | null; lastName: string | null };
  driverAssignedByUser?: { id: string; username: string; firstName: string | null; lastName: string | null };
  travelRate?: { id: string; name: string; rateType: string; rateValue: string; requiresApproval: string | null } | null;
  travelRateApprovedByUser?: { id: string; username: string; firstName: string | null; lastName: string | null } | null;
}

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
      // Try Object Storage first
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          name: file.name,
          isPublic: false,
        }),
      });
      if (!response.ok) throw new Error("Object Storage unavailable");

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      onChange(objectPath);
    } catch {
      // Fallback to local upload
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const token = localStorage.getItem("accessToken");
        const localResponse = await fetch("/api/uploads/local", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: base64,
            filename: file.name,
            contentType: file.type,
          }),
        });
        if (!localResponse.ok) throw new Error("Failed to upload locally");
        const { objectPath } = await localResponse.json();
        onChange(objectPath);
      } catch (error) {
        console.error("Upload failed:", error);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt={label} className="h-16 w-16 rounded-md object-cover border" />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 w-5"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
            data-testid={testId}
          />
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Camera className="h-4 w-4 text-muted-foreground" />
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
      // Try Object Storage first
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type,
          name: file.name,
          isPublic: false,
        }),
      });
      if (!response.ok) throw new Error("Object Storage unavailable");

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      onChange([...values, objectPath]);
    } catch {
      // Fallback to local upload
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const token = localStorage.getItem("accessToken");
        const localResponse = await fetch("/api/uploads/local", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: base64,
            filename: file.name,
            contentType: file.type,
          }),
        });
        if (!localResponse.ok) throw new Error("Failed to upload locally");
        const { objectPath } = await localResponse.json();
        onChange([...values, objectPath]);
      } catch (error) {
        console.error("Upload failed:", error);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((url, index) => (
          <div key={index} className="relative">
            <img src={url} alt={`${label} ${index + 1}`} className="h-14 w-14 rounded-md object-cover border" />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-4 w-4"
              onClick={() => removePhoto(index)}
            >
              <X className="h-2 w-2" />
            </Button>
          </div>
        ))}
        {values.length < maxPhotos && (
          <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
              data-testid={testId}
            />
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
          </label>
        )}
      </div>
    </div>
  );
}

interface CheckFormData {
  latitude: string;
  longitude: string;
  frontalPhoto: string;
  lateral1Photo: string;
  lateral2Photo: string;
  traseiraPhoto: string;
  odometerPhoto: string;
  fuelLevelPhoto: string;
  damagePhotos: string[];
  selfiePhoto: string;
  notes: string;
}

const initialCheckFormData: CheckFormData = {
  latitude: "",
  longitude: "",
  frontalPhoto: "",
  lateral1Photo: "",
  lateral2Photo: "",
  traseiraPhoto: "",
  odometerPhoto: "",
  fuelLevelPhoto: "",
  damagePhotos: [],
  selfiePhoto: "",
  notes: "",
};

const fmtBR = (d: Date | string | null | undefined, fmt: string) =>
  d ? formatInTimeZone(new Date(d as string), 'UTC', fmt, { locale: ptBR }) : "-";

// For server-recorded timestamps (checkin/checkout) which are true UTC moments
const fmtBRLocal = (d: Date | string | null | undefined, fmt: string) =>
  d ? formatInTimeZone(new Date(d as string), 'America/Sao_Paulo', fmt, { locale: ptBR }) : "-";

export default function TransportsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeletedHistory, setShowDeletedHistory] = useState(false);
  const [viewTransport, setViewTransport] = useState<TransportWithRelations | null>(null);
  const [checkinTransport, setCheckinTransport] = useState<TransportWithRelations | null>(null);
  const [checkoutTransport, setCheckoutTransport] = useState<TransportWithRelations | null>(null);
  const [checkinData, setCheckinData] = useState<CheckFormData>(initialCheckFormData);
  const [checkoutData, setCheckoutData] = useState<CheckFormData>(initialCheckFormData);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [clearCheckinId, setClearCheckinId] = useState<string | null>(null);
  const [clearCheckoutId, setClearCheckoutId] = useState<string | null>(null);
  const [concludeTransportId, setConcludeTransportId] = useState<string | null>(null);
  const [assignDriverTransport, setAssignDriverTransport] = useState<TransportWithRelations | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [assignDriverId, setAssignDriverId] = useState<string>("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [chassiComboOpen, setChassiComboOpen] = useState(false);
  const [newTransportData, setNewTransportData] = useState({
    vehicleChassi: "",
    clientId: "",
    originYardId: "",
    deliveryLocationId: "",
    driverId: "",
    travelRateId: "",
    deliveryDate: "",
    transitStartedAt: "",
    notes: "",
  });
  const [routeSummary, setRouteSummary] = useState<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    durationInTraffic: { text: string; value: number } | null;
    tollCost: { amount: string; currency: string; isEstimate?: boolean } | null;
    originAddress: string;
    destinationAddress: string;
    fuelCost: number;
  } | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const { toast } = useToast();

  const { data: transports, isLoading, isFetching, refetch } = useQuery<TransportWithRelations[]>({
    queryKey: ["/api/transports"],
  });

  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: deliveryLocations } = useQuery<DeliveryLocation[]>({ queryKey: ["/api/delivery-locations"] });
  const { data: savedRoutes = [] } = useQuery<RouteWithRelations[]>({ queryKey: ["/api/routes"] });

  interface TransportProposalSummary {
    id: string;
    proposalNumber: string | null;
    status: string;
    startDate: string | null;
    totalDriverResponses: number;
    acceptedDrivers: number;
    assignedDriver: { id: string; name: string } | null;
  }
  const { data: viewTransportProposals = [] } = useQuery<TransportProposalSummary[]>({
    queryKey: ["/api/transports", viewTransport?.id, "proposals"],
    enabled: !!viewTransport?.id,
    staleTime: 0,
  });

  interface TransportRouteInfo {
    associatedRoute: {
      id: string;
      name: string;
      fuelCost: string | null;
      tollCost: string | null;
      driverDailyCost: string | null;
      foodCost: string | null;
      othersCost: string | null;
      totalCost: string | null;
    } | null;
    advanceAmount: string | null;
    advanceMethod: string | null;
  }
  const { data: viewTransportRouteInfo } = useQuery<TransportRouteInfo>({
    queryKey: ["/api/transports", viewTransport?.id, "route-info"],
    enabled: !!viewTransport?.id,
    staleTime: 0,
  });

  const [appliedDialogRouteId, setAppliedDialogRouteId] = useState<string | null>(null);
  const chassisInActiveTransport = new Set(
    transports?.filter(t => t.status !== "entregue" && t.status !== "cancelado").map(t => t.vehicleChassi) || []
  );
  // New-transport dialog: only chassis that are in stock, not in another active
  // transport, AND already have an associated client.
  const availableVehicles = vehicles?.filter(v => v.status === "em_estoque" && !!v.clientId && !chassisInActiveTransport.has(v.chassi)) || [];
  const activeDrivers = drivers?.filter(d => d.isActive === "true" && d.isApto === "true") || [];

  const clientDeliveryLocations = deliveryLocations?.filter(
    loc => loc.clientId === newTransportData.clientId
  ) || [];

  // Fetch route summary when origin and destination are selected
  useEffect(() => {
    // Reset summary immediately when inputs change
    setRouteSummary(null);
    
    const originYardId = newTransportData.originYardId;
    const deliveryLocationId = newTransportData.deliveryLocationId;
    
    if (!originYardId || !deliveryLocationId) {
      return;
    }

    const originYard = yards?.find(y => y.id === originYardId);
    const destLocation = deliveryLocations?.find(l => l.id === deliveryLocationId);

    if (!originYard || !destLocation) {
      return;
    }

    const fetchRouteSummary = async () => {
      setLoadingRoute(true);
      try {
        let data: any;

        const hasCoords =
          originYard.latitude && originYard.longitude &&
          destLocation.latitude && destLocation.longitude;

        if (hasCoords) {
          const response = await apiRequest("POST", "/api/routing/calculate", {
            origin: { lat: parseFloat(originYard.latitude!), lng: parseFloat(originYard.longitude!) },
            destination: { lat: parseFloat(destLocation.latitude!), lng: parseFloat(destLocation.longitude!) },
          });
          data = await response.json();
        } else {
          const buildAddress = (obj: { address?: string | null; addressNumber?: string | null; city?: string | null; state?: string | null }) =>
            [obj.address, obj.addressNumber, obj.city, obj.state, "Brasil"]
              .filter(Boolean)
              .join(", ");

          const originAddress = buildAddress(originYard);
          const destinationAddress = buildAddress(destLocation);

          const response = await fetch("/api/routing/distance-by-address", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ originAddress, destinationAddress }),
          });
          data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "Erro ao calcular rota");
          }
        }

        const distanceKm = data.distance.value / 1000;
        const litersNeeded = distanceKm / 4;
        const fuelPricePerLiter = 6.50;
        const fuelCost = litersNeeded * fuelPricePerLiter;

        setRouteSummary({
          ...data,
          fuelCost,
        });
      } catch (error) {
        console.error("Error fetching route:", error);
        setRouteSummary(null);
      } finally {
        setLoadingRoute(false);
      }
    };

    fetchRouteSummary();
  }, [newTransportData.originYardId, newTransportData.deliveryLocationId, yards, deliveryLocations]);

  const deleteMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("DELETE", `/api/transports/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-transports"] });
      toast({ title: "Transporte excluído — veículo retornou ao estoque" });
      setDeleteId(null);
      setDeleteReason("");
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Erro ao excluir transporte", variant: "destructive" });
    },
  });

  const { data: deletedTransports } = useQuery<DeletedTransport[]>({
    queryKey: ["/api/deleted-transports"],
    enabled: showDeletedHistory,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTransportData) => {
      return apiRequest("POST", "/api/transports", {
        ...data,
        driverId: data.driverId || null,
        travelRateId: data.travelRateId || null,
        deliveryDate: data.deliveryDate || null,
        transitStartedAt: (() => {
          if (!data.transitStartedAt) return null;
          // datetime-local inputs return "YYYY-MM-DDTHH:mm" without timezone.
          // new Date() in the browser treats that as LOCAL time, so .toISOString()
          // converts it to UTC correctly, avoiding the -3h display shift on server.
          const d = new Date(data.transitStartedAt);
          const year = d.getFullYear();
          if (isNaN(d.getTime()) || year < 2010 || year > 2099) return null;
          return d.toISOString();
        })(),
        notes: data.notes || null,
        status: "pendente",
        routeDistanceKm: routeSummary ? (routeSummary.distance.value / 1000).toFixed(2) : null,
        routeDurationMinutes: routeSummary ? Math.round(routeSummary.duration.value / 60) : null,
        estimatedTolls: routeSummary?.tollCost ? routeSummary.tollCost.amount : null,
        estimatedFuel: routeSummary ? routeSummary.fuelCost.toFixed(2) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Transporte criado com sucesso" });
      setShowNewDialog(false);
      setAppliedDialogRouteId(null);
      setNewTransportData({
        vehicleChassi: "",
        clientId: "",
        originYardId: "",
        deliveryLocationId: "",
        driverId: "",
        travelRateId: "",
        deliveryDate: "",
        transitStartedAt: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao criar transporte", variant: "destructive" });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CheckFormData }) => {
      return apiRequest("PATCH", `/api/transports/${id}/checkin`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Check-in realizado com sucesso" });
      setCheckinTransport(null);
      setCheckinData(initialCheckFormData);
    },
    onError: () => {
      toast({ title: "Erro ao realizar check-in", variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CheckFormData }) => {
      return apiRequest("PATCH", `/api/transports/${id}/checkout`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Check-out realizado com sucesso" });
      setCheckoutTransport(null);
      setCheckoutData(initialCheckFormData);
    },
    onError: () => {
      toast({ title: "Erro ao realizar check-out", variant: "destructive" });
    },
  });

  const clearCheckinMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transports/${id}/checkin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Check-in excluído com sucesso" });
      setClearCheckinId(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao excluir check-in", variant: "destructive" });
    },
  });

  const clearCheckoutMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transports/${id}/checkout`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Check-out excluído com sucesso" });
      setClearCheckoutId(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao excluir check-out", variant: "destructive" });
    },
  });

  const concludeTransportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/transports/${id}/conclude`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Transporte concluído com sucesso" });
      setConcludeTransportId(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao concluir transporte", variant: "destructive" });
      setConcludeTransportId(null);
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string | null }) => {
      await apiRequest("PATCH", `/api/transports/${id}`, { driverId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports"] });
      toast({ title: "Motorista atualizado com sucesso" });
      setAssignDriverTransport(null);
      setAssignDriverId("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao atribuir motorista", variant: "destructive" });
    },
  });

  const getLocation = (setter: (data: CheckFormData) => void, data: CheckFormData) => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setter({
          ...data,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        });
        setGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        toast({ title: "Erro ao obter localização", variant: "destructive" });
        setGettingLocation(false);
      }
    );
  };

  const filteredData = transports?.filter((t) => {
    const matchesSearch =
      t.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.vehicleChassi.toLowerCase().includes(search.toLowerCase()) ||
      t.client?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      key: "status",
      label: "Status",
      render: (t: TransportWithRelations) => <StatusBadge status={t.status} />,
    },
    { key: "requestNumber", label: "Nº Solicitação" },
    { key: "vehicleChassi", label: "Chassi" },
    {
      key: "clientName",
      label: "Cliente",
      render: (t: TransportWithRelations) => t.client?.name || "-",
    },
    {
      key: "deliveryLocation",
      label: "Local de Entrega",
      render: (t: TransportWithRelations) =>
        t.deliveryLocation
          ? `${t.deliveryLocation.name} - ${t.deliveryLocation.city}/${t.deliveryLocation.state}`
          : "-",
    },
    {
      key: "createdAt",
      label: "Data Criação",
      render: (t: TransportWithRelations) =>
        fmtBRLocal(t.createdAt, "dd/MM/yyyy HH:mm"),
    },
    {
      key: "transitStartedAt",
      label: "Início de Viagem",
      render: (t: TransportWithRelations) =>
        fmtBRLocal(t.transitStartedAt, "dd/MM/yyyy HH:mm"),
    },
    {
      key: "deliveryDate",
      label: "Previsão de Entrega",
      render: (t: TransportWithRelations) =>
        fmtBR(t.deliveryDate, "dd/MM/yyyy HH:mm"),
    },
    {
      key: "driverName",
      label: "Motorista",
      render: (t: TransportWithRelations) => {
        if (!t.driver?.name) return "-";
        const phone = t.driver.phone?.replace(/\D/g, "");
        const waPhone = phone?.startsWith("55") ? phone : `55${phone}`;
        return (
          <div className="flex items-center gap-1.5">
            <span className="truncate">{t.driver.name}</span>
            {phone && (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-green-600 hover:text-green-700 transition-colors shrink-0"
                title={`WhatsApp: ${t.driver.phone}`}
                data-testid={`link-whatsapp-${t.id}`}
              >
                <SiWhatsapp className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      className: "w-10",
      render: (t: TransportWithRelations) => (
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-checkinout-menu-${t.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Check-in / Check-out</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!!t.checkinDateTime}
                onClick={() => setCheckinTransport(t)}
                data-testid={`button-checkin-${t.id}`}
              >
                <LogIn className="h-4 w-4 mr-2" />
                {t.checkinDateTime ? "Check-in realizado" : "Realizar Check-in"}
              </DropdownMenuItem>
              {t.checkinDateTime && !t.checkoutDateTime && (
                <DropdownMenuItem
                  onClick={() => setClearCheckinId(t.id)}
                  className="text-destructive focus:text-destructive"
                  data-testid={`button-clear-checkin-${t.id}`}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Excluir Check-in
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!t.checkinDateTime || !!t.checkoutDateTime}
                onClick={() => setCheckoutTransport(t)}
                data-testid={`button-checkout-${t.id}`}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t.checkoutDateTime
                  ? "Check-out realizado"
                  : !t.checkinDateTime
                    ? "Faça o check-in primeiro"
                    : "Realizar Check-out"}
              </DropdownMenuItem>
              {t.checkoutDateTime && (
                <DropdownMenuItem
                  onClick={() => setClearCheckoutId(t.id)}
                  className="text-destructive focus:text-destructive"
                  data-testid={`button-clear-checkout-${t.id}`}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Excluir Check-out
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setAssignDriverId(t.driverId || "");
                  setAssignDriverTransport(t);
                }}
                data-testid={`button-assign-driver-${t.id}`}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {t.driverId ? "Alterar Motorista" : "Adicionar Motorista"}
              </DropdownMenuItem>
              {t.status !== "entregue" && t.status !== "cancelado" && (
                <DropdownMenuItem
                  onClick={() => setConcludeTransportId(t.id)}
                  data-testid={`button-conclude-${t.id}`}
                  className="text-green-600 focus:text-green-600"
                >
                  <PackageCheck className="h-4 w-4 mr-2" />
                  Concluir Transporte
                </DropdownMenuItem>
              )}
              {t.status === "pendente" && (
                <DropdownMenuItem
                  onClick={() => navigate(`/proposta-transporte?transportId=${t.id}`)}
                  data-testid={`button-create-proposal-${t.id}`}
                  className="text-violet-600 focus:text-violet-600"
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Criar Proposta de Transporte
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => navigate(`/transportes/${t.id}`)}
                data-testid={`button-edit-${t.id}`}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              {t.status !== "entregue" && !t.driverId && (
                <DropdownMenuItem
                  onClick={() => setDeleteId(t.id)}
                  className="text-destructive focus:text-destructive"
                  data-testid={`button-delete-${t.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Apagar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Transportes"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Transportes" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nº solicitação, chassi ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-transports"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aguardando_saida">Aguardando Saída</SelectItem>
                <SelectItem value="em_transito">Em Trânsito</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeletedHistory(!showDeletedHistory)}
              data-testid="button-toggle-deleted-history"
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {showDeletedHistory ? "Ocultar" : "Ver"} histórico de exclusões
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-transports"
              title="Atualizar lista de transportes"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => { setNewTransportData({ vehicleChassi: "", clientId: "", originYardId: "", deliveryLocationId: "", driverId: "", travelRateId: "", deliveryDate: "", transitStartedAt: "", notes: "" }); setRouteSummary(null); setAppliedDialogRouteId(null); setShowNewDialog(true); }} data-testid="button-add-transport">
              <Plus className="mr-2 h-4 w-4" />
              Novo Transporte
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredData ?? []}
          isLoading={isLoading}
          keyField="id"
          onRowClick={(t) => setViewTransport(t)}
          emptyMessage="Nenhum transporte encontrado"
        />

        {/* Histórico de transportes excluídos */}
        {showDeletedHistory && (
          <Card className="mt-4 border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Histórico de Transportes Excluídos ({deletedTransports?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!deletedTransports || deletedTransports.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum transporte excluído</p>
              ) : (
                <div className="divide-y">
                  {deletedTransports.map((dt) => (
                    <div key={dt.id} className="px-4 py-3 text-sm" data-testid={`row-deleted-transport-${dt.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold">{dt.requestNumber}</span>
                            <span className="text-muted-foreground">—</span>
                            <span className="font-mono text-muted-foreground">{dt.vehicleChassi}</span>
                            {dt.clientName && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">{dt.clientName}</span>
                            )}
                            {dt.status && <StatusBadge status={dt.status} />}
                          </div>
                          {(dt.originYardName || dt.deliveryLocationName) && (
                            <p className="text-xs text-muted-foreground">
                              {dt.originYardName} → {dt.deliveryLocationName}
                            </p>
                          )}
                          {dt.driverName && (
                            <p className="text-xs text-muted-foreground">Motorista: {dt.driverName}</p>
                          )}
                          <div className="mt-1.5 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
                            <p className="text-xs font-medium text-destructive mb-0.5">Motivo da exclusão:</p>
                            <p className="text-xs">{dt.deletionReason}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-xs text-muted-foreground space-y-0.5">
                          <p>{fmtBRLocal(dt.deletedAt, "dd/MM/yyyy HH:mm")}</p>
                          {dt.deletedByUsername && <p>por {dt.deletedByUsername}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diálogo de exclusão com motivo obrigatório */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleteReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Excluir Transporte
            </DialogTitle>
            <DialogDescription>
              O chassi voltará automaticamente ao status <strong>Em Estoque</strong>. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="delete-reason">Motivo da exclusão <span className="text-destructive">*</span></Label>
            <Textarea
              id="delete-reason"
              placeholder="Descreva o motivo da exclusão deste transporte..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              data-testid="textarea-delete-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteReason(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteReason.trim() || deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId, reason: deleteReason })}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTransport} onOpenChange={() => setViewTransport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes do Transporte
              {viewTransport && <StatusBadge status={viewTransport.status} />}
            </DialogTitle>
          </DialogHeader>
          {viewTransport && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informações Gerais</h3>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                    <p><span className="font-medium">Nº Solicitação:</span> {viewTransport.requestNumber}</p>
                    <p><span className="font-medium">Chassi:</span> {viewTransport.vehicleChassi}</p>
                    <p><span className="font-medium">Cliente:</span> {viewTransport.client?.name || "-"}</p>
                    <p><span className="font-medium">Local de Entrega:</span> {viewTransport.deliveryLocation ? `${viewTransport.deliveryLocation.name} - ${viewTransport.deliveryLocation.city}/${viewTransport.deliveryLocation.state}` : "-"}</p>
                    <p><span className="font-medium">Motorista:</span> {viewTransport.driver?.name || "-"}</p>
                    <p><span className="font-medium">Data de Entrega:</span> {viewTransport.checkoutDateTime ? fmtBRLocal(viewTransport.checkoutDateTime, "dd/MM/yyyy HH:mm") : fmtBR(viewTransport.deliveryDate, "dd/MM/yyyy HH:mm")}</p>
                    {viewTransport.notes && <p><span className="font-medium">Observações:</span> {viewTransport.notes}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Rastreabilidade</h3>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                    <p><span className="font-medium">Criado por:</span> {viewTransport.createdByUser ? `${viewTransport.createdByUser.firstName || ''} ${viewTransport.createdByUser.lastName || ''} (${viewTransport.createdByUser.username})`.trim() : "-"}</p>
                    <p><span className="font-medium">Criado em:</span> {fmtBRLocal(viewTransport.createdAt, "dd/MM/yyyy HH:mm")}</p>
                    <p><span className="font-medium">Motorista adicionado por:</span> {viewTransport.driverAssignedByUser ? `${viewTransport.driverAssignedByUser.firstName || ''} ${viewTransport.driverAssignedByUser.lastName || ''} (${viewTransport.driverAssignedByUser.username})`.trim() : "-"}</p>
                    <p><span className="font-medium">Motorista adicionado em:</span> {fmtBRLocal(viewTransport.driverAssignedAt, "dd/MM/yyyy HH:mm")}</p>
                    <p><span className="font-medium">Saída para trânsito:</span> {fmtBRLocal(viewTransport.transitStartedAt, "dd/MM/yyyy HH:mm")}</p>
                    <p><span className="font-medium">Check-in:</span> {fmtBRLocal(viewTransport.checkinDateTime, "dd/MM/yyyy HH:mm")}</p>
                    <p><span className="font-medium">Check-out:</span> {fmtBRLocal(viewTransport.checkoutDateTime, "dd/MM/yyyy HH:mm")}</p>
                  </div>
                </div>
              </div>

              {viewTransport.travelRate && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Tarifa de Viagem</h3>
                  <div className={`rounded-lg p-4 space-y-2 text-sm border ${
                    viewTransport.travelRateApprovalStatus === "aprovado"
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      : viewTransport.travelRateApprovalStatus === "rejeitado"
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                      : viewTransport.travelRateApprovalStatus === "pendente"
                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      : "bg-muted/50 border-transparent"
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-semibold text-base">{viewTransport.travelRate.name}</p>
                      {viewTransport.travelRateApprovalStatus && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          viewTransport.travelRateApprovalStatus === "aprovado"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : viewTransport.travelRateApprovalStatus === "rejeitado"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}>
                          {viewTransport.travelRateApprovalStatus === "aprovado" ? "✓ Aprovado" : viewTransport.travelRateApprovalStatus === "rejeitado" ? "✗ Rejeitado" : "⏳ Aguardando Aprovação"}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <p><span className="font-medium">Tipo:</span> {
                        viewTransport.travelRate.rateType === "por_km" ? "Por Quilômetro" :
                        viewTransport.travelRate.rateType === "por_veiculo" ? "Por Veículo" : "Fixo"
                      }</p>
                      <p><span className="font-medium">Valor:</span> {
                        viewTransport.travelRate.rateValue
                          ? `R$ ${parseFloat(viewTransport.travelRate.rateValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "-"
                      }</p>
                    </div>
                    {viewTransport.travelRate.requiresApproval === "true" && !viewTransport.travelRateApprovalStatus && (
                      <p className="text-amber-700 dark:text-amber-400 text-xs">⚠️ Tarifa especial — aprovação necessária</p>
                    )}
                    {(viewTransport.travelRateApprovalStatus === "aprovado" || viewTransport.travelRateApprovalStatus === "rejeitado") && (
                      <div className="pt-1 border-t border-current/10 space-y-1">
                        {viewTransport.travelRateApprovedByUser && (
                          <p><span className="font-medium">{viewTransport.travelRateApprovalStatus === "aprovado" ? "Aprovado por:" : "Rejeitado por:"}</span>{" "}
                            {`${viewTransport.travelRateApprovedByUser.firstName || ""} ${viewTransport.travelRateApprovedByUser.lastName || ""} (${viewTransport.travelRateApprovedByUser.username})`.trim()}
                          </p>
                        )}
                        {viewTransport.travelRateApprovedAt && (
                          <p><span className="font-medium">Em:</span> {fmtBRLocal(viewTransport.travelRateApprovedAt, "dd/MM/yyyy HH:mm")}</p>
                        )}
                        {viewTransport.travelRateApprovalNote && (
                          <p><span className="font-medium">Motivo:</span> {viewTransport.travelRateApprovalNote}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Check-in (Retirada do Pátio)
                  </h3>
                  {viewTransport.checkinDateTime ? (
                    <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Realizado em {fmtBRLocal(viewTransport.checkinDateTime, "dd/MM/yyyy HH:mm")}</span>
                      </div>
                      <div className="text-sm space-y-1">
                        {viewTransport.checkinLocation && (
                          <p><span className="font-medium">Localização:</span> {viewTransport.checkinLocation.coordinates[1]}, {viewTransport.checkinLocation.coordinates[0]}</p>
                        )}
                        {viewTransport.checkinNotes && <p><span className="font-medium">Observações:</span> {viewTransport.checkinNotes}</p>}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {viewTransport.checkinFrontalPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Frontal</p>
                            <img src={normalizeImageUrl(viewTransport.checkinFrontalPhoto)} alt="Frontal" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinFrontalPhoto!), alt: "Frontal" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkinLateral1Photo && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Lateral 1</p>
                            <img src={normalizeImageUrl(viewTransport.checkinLateral1Photo)} alt="Lateral 1" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinLateral1Photo!), alt: "Lateral 1" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkinLateral2Photo && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Lateral 2</p>
                            <img src={normalizeImageUrl(viewTransport.checkinLateral2Photo)} alt="Lateral 2" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinLateral2Photo!), alt: "Lateral 2" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkinTraseiraPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Traseira</p>
                            <img src={normalizeImageUrl(viewTransport.checkinTraseiraPhoto)} alt="Traseira" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinTraseiraPhoto!), alt: "Traseira" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkinOdometerPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Hodômetro</p>
                            <img src={normalizeImageUrl(viewTransport.checkinOdometerPhoto)} alt="Hodômetro" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinOdometerPhoto!), alt: "Hodômetro" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkinFuelLevelPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Combustível</p>
                            <img src={normalizeImageUrl(viewTransport.checkinFuelLevelPhoto)} alt="Combustível" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinFuelLevelPhoto!), alt: "Combustível" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkinSelfiePhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Selfie</p>
                            <img src={normalizeImageUrl(viewTransport.checkinSelfiePhoto)} alt="Selfie" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkinSelfiePhoto!), alt: "Selfie" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                      </div>
                      {viewTransport.checkinDamagePhotos && viewTransport.checkinDamagePhotos.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Fotos de Avarias ({viewTransport.checkinDamagePhotos.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {viewTransport.checkinDamagePhotos.map((photo, idx) => (
                              <img key={idx} src={normalizeImageUrl(photo)} alt={`Avaria ${idx + 1}`} onClick={() => setLightboxImage({ src: normalizeImageUrl(photo), alt: `Avaria ${idx + 1}` })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                      Check-in não realizado
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Check-out (Entrega ao Cliente)
                  </h3>
                  {viewTransport.checkoutDateTime ? (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Realizado em {fmtBRLocal(viewTransport.checkoutDateTime, "dd/MM/yyyy HH:mm")}</span>
                      </div>
                      <div className="text-sm space-y-1">
                        {viewTransport.checkoutLocation && (
                          <p><span className="font-medium">Localização:</span> {viewTransport.checkoutLocation.coordinates[1]}, {viewTransport.checkoutLocation.coordinates[0]}</p>
                        )}
                        {viewTransport.checkoutNotes && <p><span className="font-medium">Observações:</span> {viewTransport.checkoutNotes}</p>}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {viewTransport.checkoutFrontalPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Frontal</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutFrontalPhoto)} alt="Frontal" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutFrontalPhoto!), alt: "Frontal" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkoutLateral1Photo && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Lateral 1</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutLateral1Photo)} alt="Lateral 1" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutLateral1Photo!), alt: "Lateral 1" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkoutLateral2Photo && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Lateral 2</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutLateral2Photo)} alt="Lateral 2" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutLateral2Photo!), alt: "Lateral 2" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkoutTraseiraPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Traseira</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutTraseiraPhoto)} alt="Traseira" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutTraseiraPhoto!), alt: "Traseira" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkoutOdometerPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Hodômetro</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutOdometerPhoto)} alt="Hodômetro" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutOdometerPhoto!), alt: "Hodômetro" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkoutFuelLevelPhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Combustível</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutFuelLevelPhoto)} alt="Combustível" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutFuelLevelPhoto!), alt: "Combustível" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                        {viewTransport.checkoutSelfiePhoto && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Selfie</p>
                            <img src={normalizeImageUrl(viewTransport.checkoutSelfiePhoto)} alt="Selfie" onClick={() => setLightboxImage({ src: normalizeImageUrl(viewTransport.checkoutSelfiePhoto!), alt: "Selfie" })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                          </div>
                        )}
                      </div>
                      {viewTransport.checkoutDamagePhotos && viewTransport.checkoutDamagePhotos.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Fotos de Avarias ({viewTransport.checkoutDamagePhotos.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {viewTransport.checkoutDamagePhotos.map((photo, idx) => (
                              <img key={idx} src={normalizeImageUrl(photo)} alt={`Avaria ${idx + 1}`} onClick={() => setLightboxImage({ src: normalizeImageUrl(photo), alt: `Avaria ${idx + 1}` })} className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity" />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                      Check-out não realizado
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Propostas de Transporte Vinculadas
                  {viewTransportProposals.length > 0 && (
                    <span className="ml-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold px-2 py-0.5">
                      {viewTransportProposals.length}
                    </span>
                  )}
                </h3>
                {viewTransportProposals.length === 0 ? (
                  <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                    Nenhuma proposta vinculada a este transporte.
                  </div>
                ) : (
                  <div className="divide-y divide-border rounded-md border">
                    {viewTransportProposals.map(p => {
                      const statusLabel: Record<string, string> = { ativa: "Ativa", encerrada: "Encerrada", cancelada: "Cancelada" };
                      const statusColor: Record<string, string> = {
                        ativa: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                        encerrada: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                        cancelada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                      };
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors" data-testid={`row-view-proposal-${p.id}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{p.proposalNumber ?? "—"}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[p.status] ?? "bg-muted text-muted-foreground"}`}>
                                {statusLabel[p.status] ?? p.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              {p.startDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {fmtBR(p.startDate, "dd/MM/yyyy")}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {p.acceptedDrivers}/{p.totalDriverResponses} aceitos
                              </span>
                              {p.assignedDriver && (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                                  <Check className="h-3 w-3" />
                                  {p.assignedDriver.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                            onClick={() => { setViewTransport(null); navigate(`/proposta-transporte/${p.id}`); }}
                            data-testid={`button-view-proposal-${p.id}`}
                          >
                            Ver proposta
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rota Realizada */}
              {(viewTransport.routeDistanceKm || viewTransport.routeDurationMinutes || viewTransport.estimatedTolls || viewTransport.estimatedFuel || viewTransport.travelRate || viewTransport.scheduledDeparture) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    Rota Realizada
                  </h3>
                  <div className="rounded-md border divide-y divide-border">
                    {/* Origem → Destino */}
                    <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-green-500" />
                        <span className="text-sm truncate">
                          {viewTransport.originYard
                            ? `${viewTransport.originYard.name}${viewTransport.originYard.city ? ` — ${viewTransport.originYard.city}/${viewTransport.originYard.state}` : ""}`
                            : "—"}
                        </span>
                      </div>
                      <Navigation className="h-3.5 w-3.5 shrink-0 text-muted-foreground hidden sm:block" />
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="text-sm truncate">
                          {viewTransport.deliveryLocation
                            ? `${viewTransport.deliveryLocation.name} — ${viewTransport.deliveryLocation.city}/${viewTransport.deliveryLocation.state}`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="px-3 py-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {viewTransport.routeDistanceKm && (
                        <div className="flex items-center gap-2">
                          <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Distância</span>
                          <span className="text-sm font-medium ml-auto">
                            {parseFloat(viewTransport.routeDistanceKm).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} km
                          </span>
                        </div>
                      )}
                      {viewTransport.routeDurationMinutes && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Duração est.</span>
                          <span className="text-sm font-medium ml-auto">
                            {Math.floor(viewTransport.routeDurationMinutes / 60)}h {viewTransport.routeDurationMinutes % 60}min
                          </span>
                        </div>
                      )}
                      {viewTransport.estimatedTolls && (
                        <div className="flex items-center gap-2">
                          <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Pedágios est.</span>
                          <span className="text-sm font-medium ml-auto">
                            {parseFloat(viewTransport.estimatedTolls).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </div>
                      )}
                      {viewTransport.estimatedFuel && (
                        <div className="flex items-center gap-2">
                          <Fuel className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Combustível est.</span>
                          <span className="text-sm font-medium ml-auto">
                            {parseFloat(viewTransport.estimatedFuel).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </div>
                      )}
                      {viewTransport.scheduledDeparture && (
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Partida agendada</span>
                          <span className="text-sm font-medium ml-auto">
                            {fmtBR(viewTransport.scheduledDeparture, "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Taxa de viagem */}
                    {viewTransport.travelRate && (
                      <div className="px-3 py-2.5 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">Taxa de viagem</span>
                        <span className="text-sm font-medium ml-auto">
                          {viewTransport.travelRate.name}
                          {" · "}
                          {viewTransport.travelRate.rateType === "por_km" ? "por km" : viewTransport.travelRate.rateType}
                          {" · "}
                          {parseFloat(viewTransport.travelRate.rateValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    )}

                    {/* Custo da Rota + Adiantamento */}
                    {viewTransportRouteInfo && (viewTransportRouteInfo.associatedRoute || viewTransportRouteInfo.advanceAmount) && (
                      <div className="px-3 py-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-border/50 bg-muted/20">
                        {viewTransportRouteInfo.associatedRoute && (() => {
                          const r = viewTransportRouteInfo.associatedRoute!;
                          const total = r.totalCost
                            ? parseFloat(r.totalCost)
                            : (parseFloat(r.fuelCost || "0") + parseFloat(r.tollCost || "0") + parseFloat(r.driverDailyCost || "0") + parseFloat(r.foodCost || "0") + parseFloat(r.othersCost || "0"));
                          return (
                            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground">Custo da rota</span>
                              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 ml-auto" title={r.name}>
                                {total > 0 ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                              </span>
                            </div>
                          );
                        })()}
                        {viewTransportRouteInfo.advanceAmount && parseFloat(viewTransportRouteInfo.advanceAmount) > 0 && (
                          <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                            <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">Adiantamento</span>
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400 ml-auto">
                              {parseFloat(viewTransportRouteInfo.advanceAmount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              {viewTransportRouteInfo.advanceMethod && (
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  · {viewTransportRouteInfo.advanceMethod === "pix" ? "PIX" : viewTransportRouteInfo.advanceMethod === "dinheiro" ? "Dinheiro" : viewTransportRouteInfo.advanceMethod === "transferencia" ? "Transferência" : viewTransportRouteInfo.advanceMethod}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTransport(null)}>
              Fechar
            </Button>
            <Button onClick={() => {
              if (viewTransport) navigate(`/transportes/${viewTransport.id}`);
            }}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black border-0" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>{lightboxImage?.alt}</DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="w-full max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkinTransport} onOpenChange={() => setCheckinTransport(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check-in - Retirada do Pátio</DialogTitle>
          </DialogHeader>
          {checkinTransport && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-md text-sm">
                <p><strong>Solicitação:</strong> {checkinTransport.requestNumber}</p>
                <p><strong>Chassi:</strong> {checkinTransport.vehicleChassi}</p>
                <p><strong>Cliente:</strong> {checkinTransport.client?.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    value={checkinData.latitude}
                    onChange={(e) => setCheckinData({ ...checkinData, latitude: e.target.value })}
                    placeholder="Latitude"
                    data-testid="input-checkin-lat"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    value={checkinData.longitude}
                    onChange={(e) => setCheckinData({ ...checkinData, longitude: e.target.value })}
                    placeholder="Longitude"
                    data-testid="input-checkin-lng"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => getLocation(setCheckinData, checkinData)}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Obter Localização
              </Button>

              {/* Seção: Fotos do Veículo */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Veículo</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <PhotoUpload
                    label="Frontal"
                    value={checkinData.frontalPhoto}
                    onChange={(url) => setCheckinData({ ...checkinData, frontalPhoto: url })}
                    testId="upload-checkin-frontal"
                  />
                  <PhotoUpload
                    label="Lateral 1"
                    value={checkinData.lateral1Photo}
                    onChange={(url) => setCheckinData({ ...checkinData, lateral1Photo: url })}
                    testId="upload-checkin-lateral1"
                  />
                  <PhotoUpload
                    label="Lateral 2"
                    value={checkinData.lateral2Photo}
                    onChange={(url) => setCheckinData({ ...checkinData, lateral2Photo: url })}
                    testId="upload-checkin-lateral2"
                  />
                  <PhotoUpload
                    label="Traseira"
                    value={checkinData.traseiraPhoto}
                    onChange={(url) => setCheckinData({ ...checkinData, traseiraPhoto: url })}
                    testId="upload-checkin-traseira"
                  />
                </div>
              </div>

              {/* Seção: Fotos do Painel */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Painel</h3>
                <div className="grid grid-cols-2 gap-3 justify-items-center">
                  <PhotoUpload
                    label="Foto do Odômetro"
                    value={checkinData.odometerPhoto}
                    onChange={(url) => setCheckinData({ ...checkinData, odometerPhoto: url })}
                    testId="upload-checkin-odometer"
                  />
                  <PhotoUpload
                    label="Nível de Combustível"
                    value={checkinData.fuelLevelPhoto}
                    onChange={(url) => setCheckinData({ ...checkinData, fuelLevelPhoto: url })}
                    testId="upload-checkin-fuel"
                  />
                </div>
              </div>

              {/* Seção: Avarias */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Avarias <span className="font-normal">({checkinData.damagePhotos.length}/10)</span>
                </h3>
                <MultiPhotoUpload
                  label=""
                  values={checkinData.damagePhotos}
                  onChange={(urls) => setCheckinData({ ...checkinData, damagePhotos: urls })}
                  testId="upload-checkin-damage"
                  maxPhotos={10}
                />
              </div>

              {/* Seção: Selfie */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Selfie do Motorista</h3>
                <PhotoUpload
                  label=""
                  value={checkinData.selfiePhoto}
                  onChange={(url) => setCheckinData({ ...checkinData, selfiePhoto: url })}
                  testId="upload-checkin-selfie"
                />
              </div>

              {/* Seção: Observações */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Observações</h3>
                <Textarea
                  value={checkinData.notes}
                  onChange={(e) => setCheckinData({ ...checkinData, notes: e.target.value })}
                  placeholder="Observações sobre o veículo..."
                  data-testid="input-checkin-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinTransport(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => checkinTransport && checkinMutation.mutate({ id: checkinTransport.id, data: checkinData })}
              disabled={checkinMutation.isPending}
              data-testid="button-confirm-checkin"
            >
              {checkinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirmar Check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkoutTransport} onOpenChange={() => setCheckoutTransport(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check-out - Entrega ao Cliente</DialogTitle>
          </DialogHeader>
          {checkoutTransport && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-md text-sm">
                <p><strong>Solicitação:</strong> {checkoutTransport.requestNumber}</p>
                <p><strong>Chassi:</strong> {checkoutTransport.vehicleChassi}</p>
                <p><strong>Cliente:</strong> {checkoutTransport.client?.name}</p>
                <p><strong>Local:</strong> {checkoutTransport.deliveryLocation?.name} - {checkoutTransport.deliveryLocation?.city}/{checkoutTransport.deliveryLocation?.state}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    value={checkoutData.latitude}
                    onChange={(e) => setCheckoutData({ ...checkoutData, latitude: e.target.value })}
                    placeholder="Latitude"
                    data-testid="input-checkout-lat"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    value={checkoutData.longitude}
                    onChange={(e) => setCheckoutData({ ...checkoutData, longitude: e.target.value })}
                    placeholder="Longitude"
                    data-testid="input-checkout-lng"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => getLocation(setCheckoutData, checkoutData)}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Obter Localização
              </Button>

              {/* Seção: Fotos do Veículo */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Veículo</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <PhotoUpload
                    label="Frontal"
                    value={checkoutData.frontalPhoto}
                    onChange={(url) => setCheckoutData({ ...checkoutData, frontalPhoto: url })}
                    testId="upload-checkout-frontal"
                  />
                  <PhotoUpload
                    label="Lateral 1"
                    value={checkoutData.lateral1Photo}
                    onChange={(url) => setCheckoutData({ ...checkoutData, lateral1Photo: url })}
                    testId="upload-checkout-lateral1"
                  />
                  <PhotoUpload
                    label="Lateral 2"
                    value={checkoutData.lateral2Photo}
                    onChange={(url) => setCheckoutData({ ...checkoutData, lateral2Photo: url })}
                    testId="upload-checkout-lateral2"
                  />
                  <PhotoUpload
                    label="Traseira"
                    value={checkoutData.traseiraPhoto}
                    onChange={(url) => setCheckoutData({ ...checkoutData, traseiraPhoto: url })}
                    testId="upload-checkout-traseira"
                  />
                </div>
              </div>

              {/* Seção: Fotos do Painel */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Fotos do Painel</h3>
                <div className="grid grid-cols-2 gap-3 justify-items-center">
                  <PhotoUpload
                    label="Foto do Odômetro"
                    value={checkoutData.odometerPhoto}
                    onChange={(url) => setCheckoutData({ ...checkoutData, odometerPhoto: url })}
                    testId="upload-checkout-odometer"
                  />
                  <PhotoUpload
                    label="Nível de Combustível"
                    value={checkoutData.fuelLevelPhoto}
                    onChange={(url) => setCheckoutData({ ...checkoutData, fuelLevelPhoto: url })}
                    testId="upload-checkout-fuel"
                  />
                </div>
              </div>

              {/* Seção: Avarias */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Avarias <span className="font-normal">({checkoutData.damagePhotos.length}/10)</span>
                </h3>
                <MultiPhotoUpload
                  label=""
                  values={checkoutData.damagePhotos}
                  onChange={(urls) => setCheckoutData({ ...checkoutData, damagePhotos: urls })}
                  testId="upload-checkout-damage"
                  maxPhotos={10}
                />
              </div>

              {/* Seção: Selfie */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Selfie do Motorista</h3>
                <PhotoUpload
                  label=""
                  value={checkoutData.selfiePhoto}
                  onChange={(url) => setCheckoutData({ ...checkoutData, selfiePhoto: url })}
                  testId="upload-checkout-selfie"
                />
              </div>

              {/* Seção: Observações */}
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Observações</h3>
                <Textarea
                  value={checkoutData.notes}
                  onChange={(e) => setCheckoutData({ ...checkoutData, notes: e.target.value })}
                  placeholder="Observações sobre o veículo..."
                  data-testid="input-checkout-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutTransport(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => checkoutTransport && checkoutMutation.mutate({ id: checkoutTransport.id, data: checkoutData })}
              disabled={checkoutMutation.isPending}
              data-testid="button-confirm-checkout"
            >
              {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirmar Check-out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!clearCheckinId} onOpenChange={() => setClearCheckinId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Check-in</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este check-in? O transporte voltará ao status "Pendente" e o veículo voltará ao status "Em Estoque". Esta ação permitirá refazer o check-in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => clearCheckinId && clearCheckinMutation.mutate(clearCheckinId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Check-in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clearCheckoutId} onOpenChange={() => setClearCheckoutId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Check-out</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este check-out? O transporte voltará ao status "Em Trânsito" e o veículo voltará ao status "Despachado". Esta ação permitirá refazer o check-out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => clearCheckoutId && clearCheckoutMutation.mutate(clearCheckoutId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Check-out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!concludeTransportId} onOpenChange={() => setConcludeTransportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-600" />
              Concluir Transporte
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja concluir este transporte? O status será marcado como <strong>Entregue</strong> e o veículo também será atualizado. Esta ação não pode ser desfeita facilmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => concludeTransportId && concludeTransportMutation.mutate(concludeTransportId)}
              className="bg-green-600 text-white hover:bg-green-700"
              data-testid="button-confirm-conclude"
            >
              {concludeTransportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Concluir Transporte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Incluir Motorista */}
      <Dialog
        open={!!assignDriverTransport}
        onOpenChange={(open) => {
          if (!open) { setAssignDriverTransport(null); setAssignDriverId(""); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              {assignDriverTransport?.driverId ? "Alterar Motorista" : "Incluir Motorista"}
            </DialogTitle>
            <DialogDescription>
              Selecione o motorista para este transporte
              {assignDriverTransport?.vehicleChassi ? ` (Chassi: ${assignDriverTransport.vehicleChassi})` : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            <Label>Motorista</Label>
            <Select
              value={assignDriverId}
              onValueChange={(val) => setAssignDriverId(val === "__none__" ? "" : val)}
            >
              <SelectTrigger data-testid="select-assign-driver">
                <SelectValue placeholder="Selecione o motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground italic">— Sem motorista —</span>
                </SelectItem>
                {activeDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name} — {driver.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setAssignDriverTransport(null); setAssignDriverId(""); }}
              disabled={assignDriverMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!assignDriverTransport) return;
                assignDriverMutation.mutate({
                  id: assignDriverTransport.id,
                  driverId: assignDriverId || null,
                });
              }}
              disabled={assignDriverMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-confirm-assign-driver"
            >
              {assignDriverMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Novo Transporte */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
                Novo Transporte
              </DialogTitle>
              <DialogDescription className="text-muted-foreground ml-[52px]">
                Configure os detalhes do transporte de veículo
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Veículo</h3>
              </div>
              <Popover open={chassiComboOpen} onOpenChange={setChassiComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={chassiComboOpen}
                    className={cn(
                      "w-full justify-between font-mono h-11 text-base",
                      !newTransportData.vehicleChassi && "text-muted-foreground font-normal font-sans"
                    )}
                    data-testid="select-vehicle"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 shrink-0 opacity-50" />
                      {newTransportData.vehicleChassi || "Buscar chassi..."}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Digite para buscar chassi..." />
                    <CommandList>
                      <CommandEmpty>Nenhum veículo em estoque encontrado.</CommandEmpty>
                      <CommandGroup>
                        {availableVehicles.map((vehicle) => (
                          <CommandItem
                            key={vehicle.chassi}
                            value={vehicle.chassi}
                            onSelect={() => {
                              setNewTransportData(prev => ({ ...prev, vehicleChassi: vehicle.chassi, originYardId: vehicle.yardId || prev.originYardId }));
                              setChassiComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newTransportData.vehicleChassi === vehicle.chassi ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {vehicle.chassi}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {availableVehicles.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhum veículo em estoque disponível</p>
              )}
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Route className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rota</h3>
              </div>

              {/* Saved route selector */}
              {savedRoutes.length > 0 && (
                <div className="mb-4">
                  {appliedDialogRouteId ? (
                    <div className="flex items-center justify-between rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Route className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
                            {savedRoutes.find(r => r.id === appliedDialogRouteId)?.name}
                          </p>
                          <p className="text-xs text-violet-600 dark:text-violet-400 flex items-center gap-2 mt-0.5">
                            {savedRoutes.find(r => r.id === appliedDialogRouteId)?.client?.name && (
                              <span>{savedRoutes.find(r => r.id === appliedDialogRouteId)?.client?.name}</span>
                            )}
                            {savedRoutes.find(r => r.id === appliedDialogRouteId)?.destinationLocation && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {savedRoutes.find(r => r.id === appliedDialogRouteId)?.destinationLocation?.name}
                                {" – "}
                                {savedRoutes.find(r => r.id === appliedDialogRouteId)?.destinationLocation?.city}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-violet-400 hover:text-violet-700 p-0.5 rounded shrink-0"
                        onClick={() => { setAppliedDialogRouteId(null); }}
                        title="Remover rota"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Route className="h-3 w-3" />
                        Selecionar via rota cadastrada
                      </Label>
                      <Select onValueChange={(id) => {
                        const route = savedRoutes.find(r => r.id === id);
                        if (!route) return;
                        const clientId = route.client?.id ?? route.destinationLocation?.clientId ?? "";
                        setNewTransportData(prev => ({
                          ...prev,
                          originYardId: route.originYardId,
                          clientId,
                          deliveryLocationId: route.destinationLocationId,
                        }));
                        setAppliedDialogRouteId(route.id);
                        setRouteSummary(null);
                      }}>
                        <SelectTrigger className="h-9" data-testid="select-saved-route">
                          <SelectValue placeholder="Escolha uma rota para preencher automaticamente…" />
                        </SelectTrigger>
                        <SelectContent>
                          {savedRoutes.map(route => (
                            <SelectItem key={route.id} value={route.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{route.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {route.client?.name && <span>{route.client.name}</span>}
                                  {route.destinationLocation && (
                                    <span className="ml-2 flex items-center gap-1 inline-flex">
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

              {appliedDialogRouteId && newTransportData.originYardId && newTransportData.deliveryLocationId ? (
                <div className="relative flex flex-col gap-0">
                  <div className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-green-500/20 shrink-0" />
                      <div className="w-px flex-1 bg-border my-1" />
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Pátio de Origem</p>
                      <p className="mt-1 text-sm font-medium">
                        {yards?.find(y => y.id === newTransportData.originYardId)?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-px flex-1 bg-border mb-1" />
                      <ArrowDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="w-px flex-1 bg-border mt-1" />
                    </div>
                    <div className="flex-1 py-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
                      <p className="mt-1 text-sm font-medium">
                        {clients?.find(c => c.id === newTransportData.clientId)?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-stretch gap-3">
                    <div className="flex flex-col items-center pb-1">
                      <div className="w-px flex-1 bg-border mb-1" />
                      <div className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-500/20 shrink-0" />
                    </div>
                    <div className="flex-1 pt-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Local de Entrega</p>
                      <p className="mt-1 text-sm font-medium">
                        {(() => {
                          const loc = deliveryLocations?.find(l => l.id === newTransportData.deliveryLocationId);
                          return loc ? `${loc.name} – ${loc.city}/${loc.state}` : "—";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3 border border-dashed rounded-lg">
                  Selecione uma rota acima para definir a origem e o destino
                </p>
              )}
            </div>

            {(loadingRoute || routeSummary) && (
              <Card className="bg-gradient-to-br from-muted/50 to-muted/20 border-dashed">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 font-medium">
                    <Navigation className="h-4 w-4 text-primary" />
                    Resumo da Viagem
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  {loadingRoute ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Calculando rota...</span>
                    </div>
                  ) : routeSummary ? (
                    <div className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2 p-2 bg-background rounded-lg border">
                          <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Origem</p>
                            <p className="text-sm font-medium break-words leading-snug" title={routeSummary.originAddress}>
                              {routeSummary.originAddress}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 bg-background rounded-lg border">
                          <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Destino</p>
                            <p className="text-sm font-medium break-words leading-snug" title={routeSummary.destinationAddress}>
                              {routeSummary.destinationAddress}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
                        <div className="text-center p-2.5 bg-background rounded-lg border">
                          <Route className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Distância</p>
                          <p className="font-bold text-primary text-sm mt-0.5">{routeSummary.distance.text}</p>
                        </div>
                        <div className="text-center p-2.5 bg-background rounded-lg border">
                          <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tempo Est.</p>
                          <p className="font-bold text-primary text-sm mt-0.5">{routeSummary.duration.text}</p>
                        </div>
                        <div className="text-center p-2.5 bg-background rounded-lg border">
                          <Receipt className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                            Pedágios{routeSummary.tollCost?.isEstimate ? "*" : ""}
                          </p>
                          <p className="font-bold text-orange-600 text-sm mt-0.5">
                            {routeSummary.tollCost 
                              ? `R$ ${parseFloat(routeSummary.tollCost.amount).toFixed(2)}`
                              : "—"}
                          </p>
                        </div>
                        <div className="text-center p-2.5 bg-background rounded-lg border">
                          <Fuel className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Combustível</p>
                          <p className="font-bold text-blue-600 text-sm mt-0.5">
                            R$ {routeSummary.fuelCost.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Custo Total Estimado</p>
                          <p className="font-bold text-lg">
                            R$ {(routeSummary.fuelCost + (routeSummary.tollCost ? parseFloat(routeSummary.tollCost.amount) : 0)).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRouteDetails(true)}
                          data-testid="button-view-route-details"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Detalhes
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        * Baseado em consumo de 4 km/litro e diesel a R$ 6,50/litro
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Programação</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Previsão de Entrega</Label>
                  <div className="relative">
                    <Input
                      type="datetime-local"
                      value={newTransportData.deliveryDate}
                      onChange={(e) => setNewTransportData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                      data-testid="input-delivery-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Início de Viagem</Label>
                  <div className="relative">
                    <Input
                      type="datetime-local"
                      value={newTransportData.transitStartedAt}
                      onChange={(e) => setNewTransportData(prev => ({ ...prev, transitStartedAt: e.target.value }))}
                      min="2010-01-01T00:00"
                      max="2099-12-31T23:59"
                      data-testid="input-transit-started-at"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Observações</h3>
              </div>
              <Textarea
                value={newTransportData.notes}
                onChange={(e) => setNewTransportData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Informações adicionais sobre o transporte..."
                className="min-h-[80px] resize-none"
                data-testid="input-notes"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(newTransportData)}
              disabled={
                createMutation.isPending ||
                !newTransportData.vehicleChassi ||
                !newTransportData.clientId ||
                !newTransportData.originYardId ||
                !newTransportData.deliveryLocationId
              }
              data-testid="button-save-transport"
              className="min-w-[120px]"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Criar Transporte
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Route Details Dialog */}
      <Dialog open={showRouteDetails} onOpenChange={setShowRouteDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Detalhes da Rota
            </DialogTitle>
            <DialogDescription>
              Informações detalhadas sobre a rota calculada
            </DialogDescription>
          </DialogHeader>
          
          {routeSummary && (
            <div className="space-y-4">
              {/* Origin and Destination */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                  <MapPin className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">ORIGEM</p>
                    <p className="text-sm font-medium break-words">{routeSummary.originAddress}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                  <MapPin className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">DESTINO</p>
                    <p className="text-sm font-medium break-words">{routeSummary.destinationAddress}</p>
                  </div>
                </div>
              </div>

              {/* Route Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Distância</span>
                  </div>
                  <p className="text-lg font-bold">{routeSummary.distance.text}</p>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tempo Estimado</span>
                  </div>
                  <p className="text-lg font-bold">{routeSummary.duration.text}</p>
                </div>
                
                {routeSummary.durationInTraffic && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="text-xs text-muted-foreground">Com Trânsito</span>
                    </div>
                    <p className="text-lg font-bold text-orange-600">{routeSummary.durationInTraffic.text}</p>
                  </div>
                )}
                
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Fuel className="h-4 w-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Consumo Estimado</span>
                  </div>
                  <p className="text-lg font-bold text-blue-600">
                    {(routeSummary.distance.value / 1000 / 4).toFixed(1)} L
                  </p>
                  <p className="text-xs text-muted-foreground">Base: 4 km/litro</p>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Custos Estimados
                </h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Combustível</span>
                    </div>
                    <span className="font-medium">R$ {routeSummary.fuelCost.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">
                        Pedágios{routeSummary.tollCost?.isEstimate ? " (est.)" : ""}
                      </span>
                    </div>
                    <span className="font-medium">
                      {routeSummary.tollCost 
                        ? `R$ ${parseFloat(routeSummary.tollCost.amount).toFixed(2)}`
                        : "Sem pedágios"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <span className="font-medium">Total Estimado</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {(routeSummary.fuelCost + (routeSummary.tollCost ? parseFloat(routeSummary.tollCost.amount) : 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-muted-foreground">
                  <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Observações:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Combustível calculado a R$ 6,50/litro (diesel)</li>
                    <li>Consumo base de 4 km/litro</li>
                    <li>Pedágios são estimativas para veículos comerciais</li>
                    <li>Valores podem variar conforme condições da viagem</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRouteDetails(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
