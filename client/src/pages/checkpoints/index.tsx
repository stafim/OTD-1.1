/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, MapPin } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Checkpoint } from "@shared/schema";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

interface CheckpointFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
}

function CheckpointFormDialog({
  open,
  onOpenChange,
  editingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
}) {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const { data: apiKeyData } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  const [formData, setFormData] = useState<CheckpointFormData>({
    name: "",
    address: "",
    city: "",
    state: "",
    latitude: "",
    longitude: "",
  });

  const { data: checkpoint, isLoading: isLoadingCheckpoint } = useQuery<Checkpoint>({
    queryKey: ["/api/checkpoints", editingId],
    enabled: !!editingId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CheckpointFormData) => {
      await apiRequest("POST", "/api/checkpoints", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkpoints"] });
      toast({ title: "Check Point criado com sucesso" });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar check point", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CheckpointFormData) => {
      await apiRequest("PATCH", `/api/checkpoints/${editingId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkpoints"] });
      toast({ title: "Check Point atualizado com sucesso" });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar check point", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      state: "",
      latitude: "",
      longitude: "",
    });
  };

  useEffect(() => {
    if (checkpoint && editingId) {
      setFormData({
        name: checkpoint.name || "",
        address: checkpoint.address || "",
        city: checkpoint.city || "",
        state: checkpoint.state || "",
        latitude: checkpoint.latitude || "",
        longitude: checkpoint.longitude || "",
      });
    } else if (!editingId) {
      resetForm();
    }
  }, [checkpoint, editingId]);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const defaultLat = formData.latitude ? parseFloat(formData.latitude) : -23.5505;
    const defaultLng = formData.longitude ? parseFloat(formData.longitude) : -46.6333;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
    });
    mapInstanceRef.current = map;

    const marker = new google.maps.Marker({
      map,
      draggable: true,
      position: formData.latitude && formData.longitude
        ? { lat: defaultLat, lng: defaultLng }
        : undefined,
      visible: !!(formData.latitude && formData.longitude),
    });
    markerRef.current = marker;

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        updateMarkerPosition(e.latLng.lat(), e.latLng.lng());
        reverseGeocode(e.latLng.lat(), e.latLng.lng());
      }
    });

    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (pos) {
        setFormData((prev) => ({
          ...prev,
          latitude: pos.lat().toFixed(6),
          longitude: pos.lng().toFixed(6),
        }));
        reverseGeocode(pos.lat(), pos.lng());
      }
    });

    if (searchInputRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
        componentRestrictions: { country: "br" },
        fields: ["address_components", "geometry", "formatted_address"],
      });
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();

          map.setCenter({ lat, lng });
          map.setZoom(15);
          updateMarkerPosition(lat, lng);

          let city = "";
          let state = "";
          place.address_components?.forEach((component) => {
            if (component.types.includes("administrative_area_level_2")) {
              city = component.long_name;
            }
            if (component.types.includes("administrative_area_level_1")) {
              state = component.short_name;
            }
          });

          setFormData((prev) => ({
            ...prev,
            address: place.formatted_address || "",
            city,
            state,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          }));
        }
      });
    }
  }, [formData.latitude, formData.longitude]);

  const updateMarkerPosition = (lat: number, lng: number) => {
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng });
      markerRef.current.setVisible(true);
    }
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  };

  const reverseGeocode = (lat: number, lng: number) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        let city = "";
        let state = "";
        results[0].address_components?.forEach((component) => {
          if (component.types.includes("administrative_area_level_2")) {
            city = component.long_name;
          }
          if (component.types.includes("administrative_area_level_1")) {
            state = component.short_name;
          }
        });
        setFormData((prev) => ({
          ...prev,
          address: results[0].formatted_address || "",
          city,
          state,
        }));
      }
    });
  };

  useEffect(() => {
    if (!open || !apiKeyData?.apiKey) return;

    const loadGoogleMapsScript = () => {
      if (window.google) {
        setMapsLoaded(true);
        return;
      }

      const existingScript = document.querySelector(
        `script[src*="maps.googleapis.com"]`
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => setMapsLoaded(true));
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapsLoaded(true);
      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, [open, apiKeyData?.apiKey]);

  useEffect(() => {
    if (mapsLoaded && open) {
      setTimeout(initMap, 100);
    }
  }, [mapsLoaded, open, initMap]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      toast({ title: "Selecione um local no mapa", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Editar Check Point" : "Novo Check Point"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                data-testid="input-checkpoint-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Nome do check point"
              />
            </div>
            <div className="space-y-2">
              <Label>Buscar Endereço</Label>
              <Input
                ref={searchInputRef}
                data-testid="input-checkpoint-search"
                placeholder="Digite o endereço para buscar..."
              />
            </div>
          </div>

          <div
            ref={mapRef}
            className="w-full h-80 rounded-lg border bg-muted"
            data-testid="checkpoint-map"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                data-testid="input-checkpoint-address"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Endereço completo"
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                data-testid="input-checkpoint-city"
                value={formData.city}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, city: e.target.value }))
                }
                placeholder="Cidade"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>UF</Label>
              <Select
                value={formData.state}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, state: value }))
                }
              >
                <SelectTrigger data-testid="select-checkpoint-state">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input
                data-testid="input-checkpoint-latitude"
                value={formData.latitude}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input
                data-testid="input-checkpoint-longitude"
                value={formData.longitude}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-checkpoint-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="button-checkpoint-save"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CheckpointsPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: checkpoints, isLoading } = useQuery<Checkpoint[]>({
    queryKey: ["/api/checkpoints"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/checkpoints/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checkpoints"] });
      toast({ title: "Check Point excluído com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir check point", variant: "destructive" });
    },
  });

  const filteredData = checkpoints?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase())
  );

  const handleNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleEdit = (c: Checkpoint) => {
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const columns = [
    { key: "name", label: "Nome" },
    { key: "address", label: "Endereço" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "UF" },
    {
      key: "coordinates",
      label: "Coordenadas",
      render: (c: Checkpoint) =>
        c.latitude && c.longitude ? (
          <div className="flex items-center gap-1 text-xs">
            <MapPin className="h-3 w-3" />
            {parseFloat(c.latitude).toFixed(4)}, {parseFloat(c.longitude).toFixed(4)}
          </div>
        ) : (
          <Badge variant="secondary">Sem localização</Badge>
        ),
    },
    {
      key: "actions",
      label: "Ações",
      render: (c: Checkpoint) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleEdit(c)}
            data-testid={`button-edit-checkpoint-${c.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDeleteId(c.id)}
            data-testid={`button-delete-checkpoint-${c.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Check Points" />

      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar check points..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-checkpoints"
            />
          </div>
          <Button onClick={handleNew} data-testid="button-new-checkpoint">
            <Plus className="h-4 w-4 mr-2" />
            Novo Check Point
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredData || []}
          isLoading={isLoading}
          emptyMessage="Nenhum check point cadastrado"
          keyField="id"
        />
      </div>

      <CheckpointFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Check Point</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este check point? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
