import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Truck, MapPin, Clock, User, Building2, Package, Navigation, AlertTriangle, ArrowRight, RefreshCcw, Phone, Mail, Calendar, Route, Timer, X } from "lucide-react";
import type { Transport, Collect, Driver, Yard, Manufacturer, Client, DeliveryLocation } from "@shared/schema";
import { format, formatDistanceToNow, differenceInHours, addSeconds } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type TransportWithRelations = Transport & {
  vehicle?: { chassi: string; color?: string | null };
  driver?: Driver | null;
  client?: Client;
  originYard?: Yard;
  deliveryLocation?: DeliveryLocation;
};

type CollectWithRelations = Collect & {
  manufacturer?: Manufacturer;
  yard?: Yard;
  driver?: Driver | null;
};

type VehicleMarker = {
  id: string;
  type: "transport" | "collect";
  lat: number;
  lng: number;
  chassi: string;
  driverName: string;
  status: string;
  isDelayed: boolean;
  hoursInTransit: number;
  origin: string;
  destination: string;
};

export default function TrafficPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleMarker | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [selectedDelayedTransport, setSelectedDelayedTransport] = useState<TransportWithRelations | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    durationInTraffic: string;
    arrivalTime: Date;
  } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const { data: apiKeyData } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  useEffect(() => {
    if (!apiKeyData?.apiKey) return;

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript || (window.google && window.google.maps)) {
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, [apiKeyData]);

  const { data: transports, isLoading: loadingTransports, refetch: refetchTransports } = useQuery<TransportWithRelations[]>({
    queryKey: ["/api/transports"],
    refetchInterval: 30000,
  });

  const { data: collects, isLoading: loadingCollects, refetch: refetchCollects } = useQuery<CollectWithRelations[]>({
    queryKey: ["/api/collects"],
    refetchInterval: 30000,
  });

  const handleRefresh = useCallback(() => {
    refetchTransports();
    refetchCollects();
    setLastUpdate(new Date());
  }, [refetchTransports, refetchCollects]);

  const calculateRouteForTransport = useCallback((transport: TransportWithRelations) => {
    if (!window.google || !window.google.maps) return;
    const origin = transport.checkinLocation;
    const dest = transport.deliveryLocation;
    if (!origin || !dest?.latitude || !dest?.longitude) {
      setRouteInfo(null);
      return;
    }
    setLoadingRoute(true);
    setRouteInfo(null);
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: { lat: origin.coordinates[1], lng: origin.coordinates[0] },
        destination: { lat: parseFloat(dest.latitude), lng: parseFloat(dest.longitude) },
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        setLoadingRoute(false);
        if (status === "OK" && result?.routes?.[0]?.legs?.[0]) {
          const leg = result.routes[0].legs[0];
          const durationSec = leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0;
          setRouteInfo({
            distance: leg.distance?.text ?? "-",
            duration: leg.duration?.text ?? "-",
            durationInTraffic: leg.duration_in_traffic?.text ?? leg.duration?.text ?? "-",
            arrivalTime: addSeconds(new Date(), durationSec),
          });
        }
      }
    );
  }, []);

  useEffect(() => {
    if (selectedDelayedTransport && mapsLoaded) {
      calculateRouteForTransport(selectedDelayedTransport);
    } else {
      setRouteInfo(null);
    }
  }, [selectedDelayedTransport, mapsLoaded, calculateRouteForTransport]);

  const activeTransports = transports?.filter(
    (t) => t.status === "em_transito" || t.status === "aguardando_saida"
  ) || [];

  const activeCollects = collects?.filter(
    (c) => c.status === "em_transito" || (c.checkinDateTime && !c.checkoutDateTime)
  ) || [];

  const delayedTransports = activeTransports.filter((t) => {
    if (!t.checkinDateTime) return false;
    const hoursInTransit = differenceInHours(new Date(), new Date(t.checkinDateTime));
    return hoursInTransit > 24;
  });

  const delayedCollects = activeCollects.filter((c) => {
    if (!c.checkinDateTime) return false;
    const hoursInTransit = differenceInHours(new Date(), new Date(c.checkinDateTime));
    return hoursInTransit > 24;
  });

  const pendingTransports = transports?.filter((t) => t.status === "pendente") || [];
  const deliveredTransports = transports?.filter((t) => t.status === "entregue") || [];

  const vehicleMarkers: VehicleMarker[] = useMemo(() => [
    ...activeTransports
      .filter((t) => t.checkinLocation)
      .map((t) => {
        const hoursInTransit = t.checkinDateTime 
          ? differenceInHours(new Date(), new Date(t.checkinDateTime))
          : 0;
        return {
          id: t.id,
          type: "transport" as const,
          lat: t.checkinLocation!.coordinates[1],
          lng: t.checkinLocation!.coordinates[0],
          chassi: t.vehicleChassi || t.vehicle?.chassi || "N/A",
          driverName: t.driver?.name || "Sem motorista",
          status: t.status,
          isDelayed: hoursInTransit > 24,
          hoursInTransit,
          origin: t.originYard?.name || "N/A",
          destination: t.deliveryLocation?.name || "N/A",
        };
      }),
    ...activeCollects
      .filter((c) => c.checkinLocation)
      .map((c) => {
        const hoursInTransit = c.checkinDateTime 
          ? differenceInHours(new Date(), new Date(c.checkinDateTime))
          : 0;
        return {
          id: c.id,
          type: "collect" as const,
          lat: c.checkinLocation!.coordinates[1],
          lng: c.checkinLocation!.coordinates[0],
          chassi: c.vehicleChassi,
          driverName: c.driver?.name || "Sem motorista",
          status: c.status,
          isDelayed: hoursInTransit > 24,
          hoursInTransit,
          origin: c.manufacturer?.name || "N/A",
          destination: c.yard?.name || "N/A",
        };
      }),
  ], [activeTransports, activeCollects]);

  const markersKey = useMemo(() => 
    vehicleMarkers.map(v => `${v.id}:${v.lat}:${v.lng}:${v.status}:${v.isDelayed}`).join("|"),
    [vehicleMarkers]
  );

  type ActiveItem = {
    id: string;
    type: "transport" | "collect";
    chassi: string;
    driverName: string;
    origin: string;
    destination: string;
    isDelayed: boolean;
    hoursInTransit: number;
    hasLocation: boolean;
    lat: number | null;
    lng: number | null;
    status: string;
    requestNumber: string | null;
    clientName: string | null;
    clientPhone: string | null;
    checkinDateTime: string | null;
  };

  const allActiveItems: ActiveItem[] = useMemo(() => [
    ...activeTransports.map((t) => ({
      id: t.id,
      type: "transport" as const,
      chassi: t.vehicleChassi || t.vehicle?.chassi || "N/A",
      driverName: t.driver?.name || "Sem motorista",
      origin: t.originYard?.name || "N/A",
      destination: t.deliveryLocation?.name || "N/A",
      isDelayed: delayedTransports.some((d) => d.id === t.id),
      hoursInTransit: t.checkinDateTime ? differenceInHours(new Date(), new Date(t.checkinDateTime)) : 0,
      hasLocation: !!t.checkinLocation,
      lat: t.checkinLocation ? t.checkinLocation.coordinates[1] : null,
      lng: t.checkinLocation ? t.checkinLocation.coordinates[0] : null,
      status: t.status,
      requestNumber: t.requestNumber || null,
      clientName: t.client?.name || null,
      clientPhone: t.deliveryLocation?.responsiblePhone || t.client?.phone || null,
      checkinDateTime: t.checkinDateTime || null,
    })),
    ...activeCollects.map((c) => ({
      id: c.id,
      type: "collect" as const,
      chassi: c.vehicleChassi || "N/A",
      driverName: c.driver?.name || "Sem motorista",
      origin: c.manufacturer?.name || "N/A",
      destination: c.yard?.name || "N/A",
      isDelayed: delayedCollects.some((d) => d.id === c.id),
      hoursInTransit: c.checkinDateTime ? differenceInHours(new Date(), new Date(c.checkinDateTime)) : 0,
      hasLocation: !!c.checkinLocation,
      lat: c.checkinLocation ? c.checkinLocation.coordinates[1] : null,
      lng: c.checkinLocation ? c.checkinLocation.coordinates[0] : null,
      status: c.status,
      requestNumber: null,
      clientName: null,
      clientPhone: null,
      checkinDateTime: c.checkinDateTime || null,
    })),
  ].sort((a, b) => Number(b.isDelayed) - Number(a.isDelayed)), [activeTransports, activeCollects, delayedTransports, delayedCollects]);

  const focusOnVehicle = useCallback((item: ActiveItem) => {
    if (!item.hasLocation || !mapInstanceRef.current || item.lat === null || item.lng === null) return;
    mapInstanceRef.current.panTo({ lat: item.lat, lng: item.lng });
    mapInstanceRef.current.setZoom(12);
    const marker = vehicleMarkers.find((m) => m.id === item.id);
    if (marker) setSelectedVehicle(marker);
  }, [vehicleMarkers]);

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded || !window.google) return;

    const initMap = async () => {
      const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new Map(mapRef.current!, {
          center: { lat: -15.7801, lng: -47.9292 },
          zoom: 4,
          mapId: "traffic_map",
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
      }

      markersRef.current.forEach((marker) => (marker.map = null));
      markersRef.current = [];

      vehicleMarkers.forEach((vehicle) => {
        const markerElement = document.createElement("div");
        markerElement.className = "relative";
        
        const iconColor = vehicle.isDelayed 
          ? "bg-red-500" 
          : vehicle.type === "transport" 
            ? "bg-orange-500" 
            : "bg-blue-500";
        
        markerElement.innerHTML = `
          <div class="flex flex-col items-center cursor-pointer transform hover:scale-110 transition-transform">
            <div class="${iconColor} rounded-full p-2 shadow-lg border-2 border-white ${vehicle.isDelayed ? 'animate-pulse' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                <path d="M15 18H9"/>
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
                <circle cx="17" cy="18" r="2"/>
                <circle cx="7" cy="18" r="2"/>
              </svg>
            </div>
            ${vehicle.isDelayed ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-ping"></div>' : ''}
          </div>
        `;

        const marker = new AdvancedMarkerElement({
          map: mapInstanceRef.current!,
          position: { lat: vehicle.lat, lng: vehicle.lng },
          content: markerElement,
          title: vehicle.chassi,
        });

        marker.addListener("click", () => {
          setSelectedVehicle(vehicle);
        });

        markersRef.current.push(marker);
      });

      if (vehicleMarkers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        vehicleMarkers.forEach((v) => bounds.extend({ lat: v.lat, lng: v.lng }));
        mapInstanceRef.current.fitBounds(bounds, 50);
      }
    };

    initMap();
  }, [markersKey, mapsLoaded]);

  const isLoading = loadingTransports || loadingCollects;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalDelayed = delayedTransports.length + delayedCollects.length;
  const totalInTransit = activeTransports.length + activeCollects.length;

  return (
    <>
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tráfego Agora (Em dev)"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Tráfego Agora" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Última atualização: {format(lastUpdate, "HH:mm:ss", { locale: ptBR })}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Transportes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                <span className="text-2xl font-bold text-orange-600">{activeTransports.length}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">em trânsito</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Coletas</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">{activeCollects.length}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">em trânsito</p>
            </CardContent>
          </Card>

          <Card className={totalDelayed > 0 ? "border-red-500/50 bg-red-500/5" : ""}>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Atrasados</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${totalDelayed > 0 ? "text-red-500 animate-pulse" : "text-muted-foreground"}`} />
                <span className={`text-2xl font-bold ${totalDelayed > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {totalDelayed}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">&gt;24h em trânsito</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-600">{pendingTransports.length}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">aguardando</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Entregues Hoje</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold text-green-600">
                  {transports?.filter((t) => {
                    if (t.status !== "entregue" || !t.checkoutDateTime) return false;
                    const today = new Date();
                    const checkoutDate = new Date(t.checkoutDateTime);
                    return checkoutDate.toDateString() === today.toDateString();
                  }).length || 0}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">concluídos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">No Mapa</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">{vehicleMarkers.length}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">com localização</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="h-[500px]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    Mapa de Operações
                  </CardTitle>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>Transporte</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Coleta</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span>Atrasado</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-60px)]">
                <div ref={mapRef} className="w-full h-full rounded-b-lg" />
              </CardContent>
            </Card>

            {selectedVehicle && (
              <Card className="mt-4 border-primary">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Detalhes do Veículo</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedVehicle(null)}>
                      Fechar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Chassi</p>
                      <p className="font-mono font-medium">{selectedVehicle.chassi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Motorista</p>
                      <p className="font-medium">{selectedVehicle.driverName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <Badge variant={selectedVehicle.type === "transport" ? "default" : "secondary"}>
                        {selectedVehicle.type === "transport" ? "Transporte" : "Coleta"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo em Trânsito</p>
                      <p className={`font-medium ${selectedVehicle.isDelayed ? "text-red-600" : ""}`}>
                        {selectedVehicle.hoursInTransit}h
                        {selectedVehicle.isDelayed && " (ATRASADO)"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Origem</p>
                      <p className="font-medium">{selectedVehicle.origin}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="font-medium">{selectedVehicle.destination}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista de todos os em andamento */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Em Andamento ({allActiveItems.length})
                  <span className="text-xs font-normal text-muted-foreground ml-1">— clique para localizar no mapa</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {allActiveItems.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma operação em andamento
                  </div>
                ) : (
                  <div className="divide-y max-h-72 overflow-auto">
                    {allActiveItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => focusOnVehicle(item)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          item.hasLocation
                            ? "cursor-pointer hover:bg-muted/50"
                            : "opacity-60 cursor-default"
                        } ${selectedVehicle?.id === item.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                        data-testid={`list-item-${item.type}-${item.id}`}
                      >
                        {/* Indicador de cor */}
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          item.isDelayed ? "bg-red-500 animate-pulse" :
                          item.type === "transport" ? "bg-orange-500" : "bg-blue-500"
                        }`} />

                        {/* Conteúdo principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{item.chassi}</span>
                            <Badge
                              variant={item.type === "transport" ? "default" : "secondary"}
                              className="text-[10px] px-1.5 py-0 h-4"
                            >
                              {item.type === "transport" ? "Transporte" : "Coleta"}
                            </Badge>
                            {item.isDelayed && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                {item.hoursInTransit}h atrasado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <span className="truncate max-w-[120px]">{item.origin}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{item.destination}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-[140px]">{item.driverName}</span>
                            </div>
                            {item.clientName && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Building2 className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{item.clientName}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Lado direito: localização + hora */}
                        <div className="text-right shrink-0">
                          {item.checkinDateTime && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(item.checkinDateTime), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          )}
                          {item.hasLocation ? (
                            <div className="flex items-center gap-1 text-[10px] text-primary mt-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              <span>Ver no mapa</span>
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Sem localização</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Tabs defaultValue="delayed" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="delayed" className="relative">
                  Atrasados
                  {totalDelayed > 0 && (
                    <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0 min-w-[18px] h-4">
                      {totalDelayed}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="active">Em Trânsito</TabsTrigger>
              </TabsList>
              
              <TabsContent value="delayed" className="mt-4 space-y-3 max-h-[450px] overflow-auto">
                {totalDelayed === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>Nenhum veículo atrasado</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {delayedTransports.map((transport) => (
                      <Card
                        key={transport.id}
                        className="overflow-hidden border-red-500/50 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedDelayedTransport(transport)}
                        data-testid={`card-delayed-transport-${transport.id}`}
                      >
                        <div className="h-1 bg-red-500" />
                        <CardContent className="pt-3 pb-3">
                          <div className="space-y-2">
                            {/* Header: atraso + número */}
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="destructive" className="text-[10px]">
                                {differenceInHours(new Date(), new Date(transport.checkinDateTime!))}h ATRASADO
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">{transport.requestNumber}</span>
                            </div>

                            {/* Chassi */}
                            <p className="font-mono text-sm font-semibold">{transport.vehicleChassi}</p>

                            {/* Cliente */}
                            {transport.client && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-medium">{transport.client.name}</span>
                              </div>
                            )}

                            {/* Telefone do responsável (cliente ou local de entrega) */}
                            {(transport.deliveryLocation?.responsiblePhone || transport.client?.phone) && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                <a
                                  href={`tel:${transport.deliveryLocation?.responsiblePhone || transport.client?.phone}`}
                                  className="text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`link-client-phone-${transport.id}`}
                                >
                                  {transport.deliveryLocation?.responsiblePhone || transport.client?.phone}
                                </a>
                                {transport.deliveryLocation?.responsibleName && (
                                  <span className="text-muted-foreground truncate">— {transport.deliveryLocation.responsibleName}</span>
                                )}
                              </div>
                            )}

                            {/* Motorista */}
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{transport.driver?.name || "Sem motorista"}</span>
                            </div>

                            {/* Rota */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{transport.originYard?.name}</span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{transport.deliveryLocation?.name}</span>
                            </div>

                            {/* Datas de saída e previsão de chegada */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-md bg-muted/50 px-2 py-1.5 text-[10px]">
                              <div>
                                <span className="text-muted-foreground">Saída: </span>
                                <span className="font-medium">
                                  {transport.checkinDateTime
                                    ? format(new Date(transport.checkinDateTime), "dd/MM HH:mm", { locale: ptBR })
                                    : "-"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Previsão: </span>
                                <span className="font-medium">
                                  {transport.deliveryDate
                                    ? format(new Date(transport.deliveryDate), "dd/MM/yyyy", { locale: ptBR })
                                    : "-"}
                                </span>
                              </div>
                            </div>

                            <p className="text-[10px] text-primary">Clique para ver detalhes →</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {delayedCollects.map((collect) => (
                      <Card key={collect.id} className="overflow-hidden border-red-500/50">
                        <div className="h-1 bg-red-500" />
                        <CardContent className="pt-3 pb-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="destructive" className="text-[10px]">
                                {differenceInHours(new Date(), new Date(collect.checkinDateTime!))}h ATRASADO
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">Coleta</Badge>
                            </div>
                            <p className="font-mono text-sm">{collect.vehicleChassi}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{collect.driver?.name || "Sem motorista"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="truncate">{collect.manufacturer?.name}</span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{collect.yard?.name}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="active" className="mt-4 space-y-3 max-h-[450px] overflow-auto">
                {totalInTransit === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Truck className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>Nenhum veículo em trânsito</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {activeTransports.map((transport) => (
                      <Card key={transport.id} className="overflow-hidden">
                        <div className="h-1 bg-orange-500" />
                        <CardContent className="pt-3 pb-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className="bg-orange-100 text-orange-700 text-[10px]">
                                {transport.status === "aguardando_saida" ? "Aguardando" : "Em Trânsito"}
                              </Badge>
                              <span className="font-mono text-xs">{transport.requestNumber}</span>
                            </div>
                            <p className="font-mono text-sm">{transport.vehicleChassi}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{transport.driver?.name || "Sem motorista"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="truncate">{transport.originYard?.name}</span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{transport.deliveryLocation?.name}</span>
                            </div>
                            {transport.checkinDateTime && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  Saiu {formatDistanceToNow(new Date(transport.checkinDateTime), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {activeCollects.map((collect) => (
                      <Card key={collect.id} className="overflow-hidden">
                        <div className="h-1 bg-blue-500" />
                        <CardContent className="pt-3 pb-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                                Coleta em Trânsito
                              </Badge>
                            </div>
                            <p className="font-mono text-sm">{collect.vehicleChassi}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{collect.driver?.name || "Sem motorista"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="truncate">{collect.manufacturer?.name}</span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{collect.yard?.name}</span>
                            </div>
                            {collect.checkinDateTime && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  Saiu {formatDistanceToNow(new Date(collect.checkinDateTime), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>

    <Dialog
      open={!!selectedDelayedTransport}
      onOpenChange={(open) => { if (!open) { setSelectedDelayedTransport(null); setRouteInfo(null); } }}
    >
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Transporte Atrasado — {selectedDelayedTransport?.requestNumber}
          </DialogTitle>
        </DialogHeader>

        {selectedDelayedTransport && (
          <div className="space-y-4 text-sm">
            {/* Atraso */}
            <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400">
              <Timer className="h-4 w-4 shrink-0" />
              <span className="font-semibold">
                {differenceInHours(new Date(), new Date(selectedDelayedTransport.checkinDateTime!))}h em trânsito
              </span>
              <span className="text-xs opacity-75">
                (saiu {formatDistanceToNow(new Date(selectedDelayedTransport.checkinDateTime!), { addSuffix: true, locale: ptBR })})
              </span>
            </div>

            {/* Datas */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datas</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {selectedDelayedTransport.createdAt
                        ? format(new Date(selectedDelayedTransport.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Previsão de entrega</p>
                    <p className="font-medium">
                      {selectedDelayedTransport.deliveryDate
                        ? format(new Date(selectedDelayedTransport.deliveryDate), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Truck className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Saída (checkin)</p>
                    <p className="font-medium">
                      {selectedDelayedTransport.checkinDateTime
                        ? format(new Date(selectedDelayedTransport.checkinDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Chassis / Pedido</p>
                    <p className="font-mono font-medium">{selectedDelayedTransport.vehicleChassi}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Rota */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rota</p>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{selectedDelayedTransport.originYard?.name || "-"}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{selectedDelayedTransport.deliveryLocation?.name || "-"}</span>
              </div>
              {selectedDelayedTransport.deliveryLocation?.city && (
                <p className="mt-0.5 pl-5 text-xs text-muted-foreground">
                  {selectedDelayedTransport.deliveryLocation.city}, {selectedDelayedTransport.deliveryLocation.state}
                </p>
              )}
            </div>

            <Separator />

            {/* Motorista */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motorista</p>
              {selectedDelayedTransport.driver ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{selectedDelayedTransport.driver.name}</span>
                  </div>
                  {selectedDelayedTransport.driver.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${selectedDelayedTransport.driver.phone}`}
                        className="text-primary hover:underline"
                        data-testid="link-driver-phone"
                      >
                        {selectedDelayedTransport.driver.phone}
                      </a>
                    </div>
                  )}
                  {selectedDelayedTransport.driver.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`mailto:${selectedDelayedTransport.driver.email}`}
                        className="text-primary hover:underline"
                        data-testid="link-driver-email"
                      >
                        {selectedDelayedTransport.driver.email}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Sem motorista atribuído</p>
              )}
            </div>

            <Separator />

            {/* Previsão de chegada */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5" />
                Previsão de Chegada (Google Maps)
              </p>
              {!selectedDelayedTransport.checkinLocation ? (
                <p className="text-xs text-muted-foreground">Localização de saída não disponível para calcular rota.</p>
              ) : !selectedDelayedTransport.deliveryLocation?.latitude ? (
                <p className="text-xs text-muted-foreground">Coordenadas do destino não disponíveis.</p>
              ) : loadingRoute ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Calculando rota com tráfego...</span>
                </div>
              ) : routeInfo ? (
                <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/50 p-3">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Distância</p>
                    <p className="font-semibold">{routeInfo.distance}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Tempo c/ tráfego</p>
                    <p className="font-semibold">{routeInfo.durationInTraffic}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground">Chegada estimada</p>
                    <p className="font-semibold text-primary">
                      {format(routeInfo.arrivalTime, "HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(routeInfo.arrivalTime, "dd/MM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Não foi possível calcular a rota.</p>
              )}
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                * Calculado a partir da posição de saída do motorista
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
