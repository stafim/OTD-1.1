import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Layers, Navigation, ZoomIn, ZoomOut, Locate,
  RefreshCcw, AlertTriangle, CheckCircle, Truck, ArrowRight,
  Clock, TrendingUp, ChevronRight, Radio, Phone, Mail,
  User, MapPin, Calendar, Hash, Building2, Info, X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transport, Yard, DeliveryLocation, Driver } from "@shared/schema";

type TransportWithRelations = Transport & {
  originYard?: Yard | null;
  deliveryLocation?: DeliveryLocation | null;
  driver?: Driver | null;
  vehicle?: { chassi: string } | null;
};

type TrafficStatus = "ok" | "moderado" | "lentidao" | "congestionado" | "sem_dados";

type RouteInfo = {
  transportId: string;
  requestNumber: string;
  chassi: string;
  driverName: string;
  driverPhone: string;
  driverEmail: string;
  origin: string;
  originYardCity: string;
  destination: string;
  destinationCity: string;
  clientName: string;
  deliveryDate: string | null;
  checkinDateTime: string | null;
  durationNormal: string;
  durationTraffic: string;
  normalSec: number;
  trafficSec: number;
  distanceKm: string;
  delayMin: number;
  status: TrafficStatus;
  renderer: google.maps.DirectionsRenderer | null;
  transport: TransportWithRelations;
};

const STATUS_CONFIG: Record<TrafficStatus, {
  label: string; color: string; bgClass: string; textClass: string; borderClass: string;
}> = {
  ok: { label: "Tráfego fluente", color: "#22c55e", bgClass: "bg-green-50 dark:bg-green-950/30", textClass: "text-green-700 dark:text-green-400", borderClass: "border-green-200 dark:border-green-800" },
  moderado: { label: "Tráfego moderado", color: "#eab308", bgClass: "bg-yellow-50 dark:bg-yellow-950/30", textClass: "text-yellow-700 dark:text-yellow-400", borderClass: "border-yellow-200 dark:border-yellow-800" },
  lentidao: { label: "Lentidão", color: "#f97316", bgClass: "bg-orange-50 dark:bg-orange-950/30", textClass: "text-orange-700 dark:text-orange-400", borderClass: "border-orange-200 dark:border-orange-800" },
  congestionado: { label: "Congestionado", color: "#dc2626", bgClass: "bg-red-50 dark:bg-red-950/30", textClass: "text-red-700 dark:text-red-400", borderClass: "border-red-200 dark:border-red-800" },
  sem_dados: { label: "Sem dados", color: "#6b7280", bgClass: "bg-gray-50 dark:bg-gray-950/30", textClass: "text-gray-600 dark:text-gray-400", borderClass: "border-gray-200 dark:border-gray-700" },
};

function getTrafficStatus(normalSec: number, trafficSec: number): TrafficStatus {
  if (!normalSec || !trafficSec) return "sem_dados";
  const ratio = trafficSec / normalSec;
  if (ratio < 1.1) return "ok";
  if (ratio < 1.3) return "moderado";
  if (ratio < 1.5) return "lentidao";
  return "congestionado";
}

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m > 0 ? m + "min" : ""}`;
}

function InfoRow({ icon: Icon, label, value, href }: {
  icon: React.ElementType; label: string; value: string; href?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium text-primary hover:underline break-all">{value}</a>
        ) : (
          <p className="text-sm font-medium break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function MapsAgoraPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const routeRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("roadmap");
  const [locating, setLocating] = useState(false);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [detailRoute, setDetailRoute] = useState<RouteInfo | null>(null);

  const { data: apiKeyData } = useQuery<{ apiKey: string }>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  const { data: transports, refetch: refetchTransports } = useQuery<TransportWithRelations[]>({
    queryKey: ["/api/transports"],
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!apiKeyData?.apiKey) return;
    if (window.google && window.google.maps) { setMapsLoaded(true); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) { existing.addEventListener("load", () => setMapsLoaded(true)); return; }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&libraries=places,marker&language=pt-BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, [apiKeyData]);

  useEffect(() => {
    if (!mapRef.current || !mapsLoaded || !window.google || mapInstanceRef.current) return;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: -15.7801, lng: -47.9292 },
      zoom: 5,
      mapId: "maps_agora",
      mapTypeId: mapType,
      disableDefaultUI: true,
      gestureHandling: "greedy",
    });
    mapInstanceRef.current = map;
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    trafficLayerRef.current = trafficLayer;
  }, [mapsLoaded]);

  const calcRoutes = useCallback(async () => {
    if (!mapsLoaded || !window.google || !mapInstanceRef.current || !transports) return;

    const activeTransports = transports.filter(
      (t) => t.status === "em_transito" || t.status === "aguardando_saida"
    );
    const validTransports = activeTransports.filter((t) =>
      t.originYard?.latitude && t.originYard?.longitude &&
      t.deliveryLocation?.latitude && t.deliveryLocation?.longitude
    );

    if (validTransports.length === 0) { setRoutes([]); return; }

    setLoadingRoutes(true);
    routeRenderersRef.current.forEach((r) => r.setMap(null));
    routeRenderersRef.current = [];

    const directionsService = new google.maps.DirectionsService();
    const newRoutes: RouteInfo[] = [];
    const bounds = new google.maps.LatLngBounds();

    for (const transport of validTransports) {
      const origin = {
        lat: parseFloat(transport.originYard!.latitude!),
        lng: parseFloat(transport.originYard!.longitude!),
      };
      const destination = {
        lat: parseFloat(transport.deliveryLocation!.latitude!),
        lng: parseFloat(transport.deliveryLocation!.longitude!),
      };

      try {
        const result = await directionsService.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS,
          },
          unitSystem: google.maps.UnitSystem.METRIC,
        });

        const leg = result.routes[0]?.legs[0];
        const normalSec = leg?.duration?.value ?? 0;
        const trafficSec = (leg as any)?.duration_in_traffic?.value ?? 0;
        const status = getTrafficStatus(normalSec, trafficSec);
        const cfg = STATUS_CONFIG[status];

        const renderer = new google.maps.DirectionsRenderer({
          map: mapInstanceRef.current!,
          directions: result,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: cfg.color,
            strokeWeight: 5,
            strokeOpacity: 0.85,
          },
        });

        routeRenderersRef.current.push(renderer);
        bounds.extend(origin);
        bounds.extend(destination);

        const delayMin = trafficSec > normalSec ? Math.round((trafficSec - normalSec) / 60) : 0;

        newRoutes.push({
          transportId: transport.id,
          requestNumber: transport.requestNumber,
          chassi: transport.vehicleChassi || transport.vehicle?.chassi || "—",
          driverName: transport.driver?.name || "Sem motorista",
          driverPhone: transport.driver?.phone || "",
          driverEmail: transport.driver?.email || "",
          origin: transport.originYard?.name || "—",
          originYardCity: [transport.originYard?.city, transport.originYard?.state].filter(Boolean).join(" - ") || "",
          destination: transport.deliveryLocation?.name || "—",
          destinationCity: [transport.deliveryLocation?.city, transport.deliveryLocation?.state].filter(Boolean).join(" - ") || "",
          clientName: (transport as any).client?.name || "—",
          deliveryDate: transport.deliveryDate || null,
          checkinDateTime: transport.checkinDateTime?.toString() || null,
          durationNormal: formatDuration(normalSec),
          durationTraffic: formatDuration(trafficSec),
          normalSec,
          trafficSec,
          distanceKm: transport.routeDistanceKm ? `${parseFloat(transport.routeDistanceKm).toFixed(0)} km` : (leg?.distance?.text || "—"),
          delayMin,
          status,
          renderer,
          transport,
        });
      } catch {
        newRoutes.push({
          transportId: transport.id,
          requestNumber: transport.requestNumber,
          chassi: transport.vehicleChassi || transport.vehicle?.chassi || "—",
          driverName: transport.driver?.name || "Sem motorista",
          driverPhone: transport.driver?.phone || "",
          driverEmail: transport.driver?.email || "",
          origin: transport.originYard?.name || "—",
          originYardCity: [transport.originYard?.city, transport.originYard?.state].filter(Boolean).join(" - ") || "",
          destination: transport.deliveryLocation?.name || "—",
          destinationCity: [transport.deliveryLocation?.city, transport.deliveryLocation?.state].filter(Boolean).join(" - ") || "",
          clientName: (transport as any).client?.name || "—",
          deliveryDate: transport.deliveryDate || null,
          checkinDateTime: transport.checkinDateTime?.toString() || null,
          durationNormal: "—",
          durationTraffic: "—",
          normalSec: 0,
          trafficSec: 0,
          distanceKm: transport.routeDistanceKm ? `${parseFloat(transport.routeDistanceKm).toFixed(0)} km` : "—",
          delayMin: 0,
          status: "sem_dados",
          renderer: null,
          transport,
        });
      }
    }

    setRoutes(newRoutes);
    setLoadingRoutes(false);
    if (!bounds.isEmpty()) mapInstanceRef.current!.fitBounds(bounds, 80);
  }, [mapsLoaded, transports]);

  useEffect(() => {
    if (mapsLoaded && transports) calcRoutes();
  }, [mapsLoaded, transports, calcRoutes]);

  const handleRouteClick = (route: RouteInfo) => {
    setSelectedRoute(route.transportId);
    setDetailRoute(route);
    if (route.renderer && mapInstanceRef.current) {
      const dir = route.renderer.getDirections();
      if (dir) {
        const bounds = new google.maps.LatLngBounds();
        dir.routes[0].legs.forEach((leg) => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);
        });
        mapInstanceRef.current.fitBounds(bounds, 100);
      }
    }
  };

  const toggleTraffic = () => {
    if (!trafficLayerRef.current || !mapInstanceRef.current) return;
    if (trafficEnabled) trafficLayerRef.current.setMap(null);
    else trafficLayerRef.current.setMap(mapInstanceRef.current);
    setTrafficEnabled(!trafficEnabled);
  };

  const changeMapType = (type: "roadmap" | "satellite" | "hybrid") => {
    setMapType(type);
    if (mapInstanceRef.current) mapInstanceRef.current.setMapTypeId(type);
  };

  const locateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapInstanceRef.current!.panTo(latlng);
        mapInstanceRef.current!.setZoom(14);
        new google.maps.Marker({
          position: latlng,
          map: mapInstanceRef.current!,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#4285F4", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
        });
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  const zoomIn = () => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() ?? 5) + 1);
  const zoomOut = () => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() ?? 5) - 1);
  const centerBrazil = () => { mapInstanceRef.current?.panTo({ lat: -15.7801, lng: -47.9292 }); mapInstanceRef.current?.setZoom(5); };

  const congestionados = routes.filter((r) => r.status === "congestionado").length;
  const lentidao = routes.filter((r) => r.status === "lentidao").length;
  const moderado = routes.filter((r) => r.status === "moderado").length;
  const ok = routes.filter((r) => r.status === "ok").length;
  const alertas = congestionados + lentidao;

  if (!apiKeyData?.apiKey) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Transportes Agora" breadcrumbs={[{ label: "Operação", href: "/" }, { label: "Transportes Agora" }]} />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Transportes Agora" breadcrumbs={[{ label: "Operação", href: "/" }, { label: "Transportes Agora" }]} />

      <div className="flex flex-1 overflow-hidden">
        {/* MAP */}
        <div className="relative flex-1 overflow-hidden">
          {!mapsLoaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando mapa...</p>
              </div>
            </div>
          )}

          <div ref={mapRef} className="w-full h-full" />

          {mapsLoaded && (
            <>
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                <Button size="sm" variant={trafficEnabled ? "default" : "outline"} onClick={toggleTraffic}
                  className="shadow-md gap-2 bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  data-testid="button-toggle-traffic">
                  <Layers className="h-4 w-4" />
                  {trafficEnabled ? "Trânsito: ON" : "Trânsito: OFF"}
                </Button>
                <div className="flex gap-1">
                  {(["roadmap", "satellite", "hybrid"] as const).map((type) => (
                    <Button key={type} size="sm" variant={mapType === type ? "default" : "outline"} onClick={() => changeMapType(type)}
                      className="text-xs shadow-md bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600 px-2"
                      data-testid={`button-maptype-${type}`}>
                      {type === "roadmap" ? "Mapa" : type === "satellite" ? "Satélite" : "Híbrido"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <Button size="icon" variant="outline" onClick={zoomIn}
                  className="shadow-md bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  data-testid="button-zoom-in"><ZoomIn className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={zoomOut}
                  className="shadow-md bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  data-testid="button-zoom-out"><ZoomOut className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={centerBrazil} title="Centralizar no Brasil"
                  className="shadow-md bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  data-testid="button-center-brazil"><Navigation className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" onClick={locateMe} disabled={locating} title="Minha localização"
                  className="shadow-md bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  data-testid="button-locate-me">
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                </Button>
              </div>

              <div className="absolute bottom-6 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-md px-3 py-2 text-xs border border-gray-200 dark:border-gray-600">
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Legenda de Trânsito</p>
                <div className="flex flex-col gap-1">
                  {[
                    { color: "bg-green-500", label: "Tráfego fluente" },
                    { color: "bg-yellow-400", label: "Moderado" },
                    { color: "bg-orange-500", label: "Lentidão" },
                    { color: "bg-red-600", label: "Congestionamento" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* SIDEBAR PANEL */}
        <div className="w-80 border-l bg-background flex flex-col overflow-hidden">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                Rotas em Tempo Real
              </h2>
              <Button size="sm" variant="ghost" onClick={() => { refetchTransports(); calcRoutes(); }} disabled={loadingRoutes}
                data-testid="button-refresh-routes">
                {loadingRoutes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {alertas > 0 && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 animate-pulse" />
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                  {alertas} rota{alertas > 1 ? "s" : ""} com problemas de tráfego
                </p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { count: ok, label: "OK", colorClass: "text-green-600" },
                { count: moderado, label: "Mod.", colorClass: "text-yellow-600" },
                { count: lentidao, label: "Lento", colorClass: "text-orange-600" },
                { count: congestionados, label: "Cong.", colorClass: "text-red-600" },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-md py-1.5">
                  <p className={`text-lg font-bold ${item.colorClass}`}>{item.count}</p>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {loadingRoutes && routes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Calculando rotas...</p>
                </div>
              )}

              {!loadingRoutes && routes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                  <Truck className="h-10 w-10 opacity-20" />
                  <p className="text-sm text-center">Nenhum transporte ativo com coordenadas cadastradas</p>
                </div>
              )}

              {routes.map((route) => {
                const cfg = STATUS_CONFIG[route.status];
                const isSelected = selectedRoute === route.transportId;
                return (
                  <button
                    key={route.transportId}
                    onClick={() => handleRouteClick(route)}
                    data-testid={`card-route-${route.transportId}`}
                    className={`w-full text-left rounded-lg border p-3 space-y-2 transition-all hover:shadow-md
                      ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                      ${cfg.bgClass} ${cfg.borderClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{route.requestNumber}</span>
                      <div className={`flex items-center gap-1 text-xs font-medium ${cfg.textClass}`}>
                        {route.status === "ok" && <CheckCircle className="h-3.5 w-3.5" />}
                        {route.status === "moderado" && <TrendingUp className="h-3.5 w-3.5" />}
                        {(route.status === "lentidao" || route.status === "congestionado") && <AlertTriangle className="h-3.5 w-3.5" />}
                        {cfg.label}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="truncate max-w-[100px]">{route.origin}</span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[100px]">{route.destination}</span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{route.driverName}</span>
                    </div>

                    {route.status !== "sem_dados" && (
                      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-current/10">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Normal: {route.durationNormal}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={`text-xs font-medium ${cfg.textClass}`}>
                            Tráfego: {route.durationTraffic}
                          </span>
                        </div>
                        {route.delayMin > 0 && (
                          <div className="col-span-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                              +{route.delayMin}min de atraso estimado
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`flex items-center justify-between text-xs pt-0.5 ${cfg.textClass}`}>
                      <span className="flex items-center gap-1 opacity-70">
                        <Info className="h-3 w-3" />
                        Clique para detalhes
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-primary">
                          Visualizando
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* DETAIL DIALOG */}
      <Dialog open={!!detailRoute} onOpenChange={(open) => { if (!open) setDetailRoute(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Detalhes do Transporte
            </DialogTitle>
          </DialogHeader>

          {detailRoute && (() => {
            const cfg = STATUS_CONFIG[detailRoute.status];
            return (
              <div className="space-y-5">
                {/* Traffic status banner */}
                <div className={`rounded-lg border px-4 py-3 space-y-3 ${cfg.bgClass} ${cfg.borderClass}`}>
                  <div className="flex items-center gap-3">
                    {detailRoute.status === "ok" && <CheckCircle className={`h-5 w-5 flex-shrink-0 ${cfg.textClass}`} />}
                    {detailRoute.status === "moderado" && <TrendingUp className={`h-5 w-5 flex-shrink-0 ${cfg.textClass}`} />}
                    {(detailRoute.status === "lentidao" || detailRoute.status === "congestionado") && (
                      <AlertTriangle className={`h-5 w-5 flex-shrink-0 animate-pulse ${cfg.textClass}`} />
                    )}
                    {detailRoute.status === "sem_dados" && <Info className={`h-5 w-5 flex-shrink-0 ${cfg.textClass}`} />}
                    <div>
                      <p className={`font-semibold text-sm ${cfg.textClass}`}>{cfg.label}</p>
                      {detailRoute.delayMin > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">+{detailRoute.delayMin}min de atraso estimado</p>
                      )}
                      {detailRoute.delayMin === 0 && detailRoute.status !== "sem_dados" && (
                        <p className="text-xs text-green-600 dark:text-green-400">Sem impacto no tempo de viagem</p>
                      )}
                    </div>
                  </div>

                  {/* Delay detail analysis */}
                  {detailRoute.delayMin > 0 && detailRoute.normalSec > 0 && (() => {
                    const pct = Math.round(((detailRoute.trafficSec - detailRoute.normalSec) / detailRoute.normalSec) * 100);
                    const normalBar = 100;
                    const trafficBar = Math.min(Math.round((detailRoute.trafficSec / detailRoute.normalSec) * 100), 200);

                    const causeMap: Record<TrafficStatus, string> = {
                      ok: "Volume de veículos ligeiramente acima do normal em trechos da rota. O impacto é pequeno e a viagem prossegue sem restrições significativas.",
                      moderado: "Fluxo de veículos acima da média detectado em trechos da rota. Possível concentração em perímetros urbanos ou rodovias de alto volume.",
                      lentidao: "Lentidão significativa identificada em um ou mais trechos da rota. Provável acúmulo de veículos em horário de pico ou obras na via.",
                      congestionado: "Congestionamento severo detectado. Possível acidente, obra, bloqueio ou evento extraordinário em ponto crítico da rota.",
                      sem_dados: "",
                    };

                    const etaDate = detailRoute.checkinDateTime
                      ? new Date(new Date(detailRoute.checkinDateTime).getTime() + detailRoute.trafficSec * 1000)
                      : null;

                    const deliveryDeadline = detailRoute.deliveryDate
                      ? new Date(detailRoute.deliveryDate)
                      : null;

                    const isLate = etaDate && deliveryDeadline && etaDate > deliveryDeadline;

                    return (
                      <div className="space-y-3 pt-1 border-t border-current/15">
                        {/* Duration bar comparison */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-foreground/70">Comparativo de duração</p>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-24 flex-shrink-0">Sem tráfego</span>
                              <div className="flex-1 bg-background/60 rounded-full h-2">
                                <div className="h-2 rounded-full bg-gray-400" style={{ width: `${normalBar}%` }} />
                              </div>
                              <span className="text-xs font-medium w-14 text-right">{detailRoute.durationNormal}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-24 flex-shrink-0">Com tráfego</span>
                              <div className="flex-1 bg-background/60 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${detailRoute.status === "ok" ? "bg-green-500" : detailRoute.status === "moderado" ? "bg-yellow-500" : detailRoute.status === "lentidao" ? "bg-orange-500" : "bg-red-600"}`}
                                  style={{ width: `${Math.min(trafficBar, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold w-14 text-right ${cfg.textClass}`}>{detailRoute.durationTraffic}</span>
                            </div>
                          </div>
                          <p className="text-xs text-orange-600 dark:text-orange-400">
                            Acréscimo de {pct}% no tempo de viagem (+{detailRoute.delayMin}min)
                          </p>
                        </div>

                        {/* Cause */}
                        <div className="bg-background/50 rounded-md px-3 py-2 space-y-1">
                          <p className="text-xs font-semibold text-foreground/80">Causa provável</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{causeMap[detailRoute.status]}</p>
                        </div>

                        {/* ETA & delivery impact */}
                        {etaDate && (
                          <div className="bg-background/50 rounded-md px-3 py-2 space-y-2">
                            <p className="text-xs font-semibold text-foreground/80">Impacto na entrega</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Chegada estimada</span>
                              <span className="text-xs font-semibold">
                                {format(etaDate, "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {deliveryDeadline && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Prazo de entrega</span>
                                <span className="text-xs font-semibold">
                                  {format(deliveryDeadline, "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            )}
                            <div className={`flex items-center gap-1.5 rounded px-2 py-1 ${isLate ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                              {isLate
                                ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                                : <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                              <span className={`text-xs font-medium ${isLate ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                                {isLate ? "Risco de atraso na entrega ao cliente" : "Dentro do prazo de entrega"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Transport info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informações do Transporte</h3>
                  <div className="space-y-3">
                    <InfoRow icon={Hash} label="Número da Solicitação" value={detailRoute.requestNumber} />
                    <InfoRow icon={Truck} label="Chassi do Veículo" value={detailRoute.chassi} />
                    <InfoRow icon={Building2} label="Cliente" value={detailRoute.clientName} />
                    {detailRoute.deliveryDate && (
                      <InfoRow
                        icon={Calendar}
                        label="Previsão de Entrega"
                        value={format(new Date(detailRoute.deliveryDate), "dd/MM/yyyy", { locale: ptBR })}
                      />
                    )}
                    {detailRoute.checkinDateTime && (
                      <InfoRow
                        icon={Clock}
                        label="Saída do Pátio"
                        value={format(new Date(detailRoute.checkinDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      />
                    )}
                  </div>
                </div>

                <Separator />

                {/* Route info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rota</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Origem</p>
                        <p className="text-sm font-medium">{detailRoute.origin}</p>
                        {detailRoute.originYardCity && (
                          <p className="text-xs text-muted-foreground">{detailRoute.originYardCity}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Destino</p>
                        <p className="text-sm font-medium">{detailRoute.destination}</p>
                        {detailRoute.destinationCity && (
                          <p className="text-xs text-muted-foreground">{detailRoute.destinationCity}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
                        <p className="text-xs text-muted-foreground">Distância</p>
                        <p className="text-sm font-semibold">{detailRoute.distanceKm}</p>
                      </div>
                      <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
                        <p className="text-xs text-muted-foreground">Sem tráfego</p>
                        <p className="text-sm font-semibold">{detailRoute.durationNormal}</p>
                      </div>
                      <div className={`rounded-md px-2 py-2 text-center ${cfg.bgClass}`}>
                        <p className="text-xs text-muted-foreground">Com tráfego</p>
                        <p className={`text-sm font-semibold ${cfg.textClass}`}>{detailRoute.durationTraffic}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Driver contact */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contato do Motorista</h3>
                  <div className="space-y-3">
                    <InfoRow icon={User} label="Nome" value={detailRoute.driverName} />
                    {detailRoute.driverPhone ? (
                      <InfoRow
                        icon={Phone}
                        label="Telefone"
                        value={detailRoute.driverPhone}
                        href={`tel:${detailRoute.driverPhone.replace(/\D/g, "")}`}
                      />
                    ) : (
                      <InfoRow icon={Phone} label="Telefone" value="Não informado" />
                    )}
                    {detailRoute.driverEmail ? (
                      <InfoRow
                        icon={Mail}
                        label="E-mail"
                        value={detailRoute.driverEmail}
                        href={`mailto:${detailRoute.driverEmail}`}
                      />
                    ) : (
                      <InfoRow icon={Mail} label="E-mail" value="Não informado" />
                    )}
                  </div>

                  {detailRoute.driverPhone && (
                    <div className="flex gap-2 pt-1">
                      <a
                        href={`tel:${detailRoute.driverPhone.replace(/\D/g, "")}`}
                        className="flex-1"
                        data-testid="link-call-driver"
                      >
                        <Button variant="default" className="w-full gap-2">
                          <Phone className="h-4 w-4" />
                          Ligar
                        </Button>
                      </a>
                      <a
                        href={`https://wa.me/55${detailRoute.driverPhone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                        data-testid="link-whatsapp-driver"
                      >
                        <Button variant="outline" className="w-full gap-2 text-green-600 border-green-300 hover:bg-green-50">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
