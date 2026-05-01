import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, AlertCircle } from "lucide-react";

interface CollectRouteMapProps {
  startLatitude: string | null | undefined;
  startLongitude: string | null | undefined;
  endLatitude: string | null | undefined;
  endLongitude: string | null | undefined;
  originLabel?: string;
  destinationLabel?: string;
}

interface GoogleMapsApiResponse {
  configured: boolean;
  apiKey: string | null;
}

declare global {
  interface Window {
    google: typeof google;
  }
}

export function CollectRouteMap({
  startLatitude,
  startLongitude,
  endLatitude,
  endLongitude,
  originLabel = "Origem",
  destinationLabel = "Destino",
}: CollectRouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: apiKeyData, isLoading: isLoadingKey } = useQuery<GoogleMapsApiResponse>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  const startLat = startLatitude ? parseFloat(startLatitude) : null;
  const startLng = startLongitude ? parseFloat(startLongitude) : null;
  const endLat = endLatitude ? parseFloat(endLatitude) : null;
  const endLng = endLongitude ? parseFloat(endLongitude) : null;

  const hasStart = startLat !== null && startLng !== null && !isNaN(startLat) && !isNaN(startLng);
  const hasEnd = endLat !== null && endLng !== null && !isNaN(endLat) && !isNaN(endLng);

  useEffect(() => {
    if (!apiKeyData?.configured || !apiKeyData?.apiKey || !hasStart) return;

    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      if (window.google?.maps) {
        setMapLoaded(true);
      } else {
        existingScript.addEventListener("load", () => setMapLoaded(true));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&libraries=places&language=pt-BR`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => setError("Erro ao carregar Google Maps");
    document.head.appendChild(script);
  }, [apiKeyData, hasStart]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !hasStart || !startLat || !startLng) return;

    try {
      const startPos = { lat: startLat, lng: startLng };
      const endPos = hasEnd && endLat && endLng ? { lat: endLat, lng: endLng } : null;

      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(startPos);
      if (endPos) bounds.extend(endPos);

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: startPos,
          zoom: hasEnd ? 10 : 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });
      }

      const map = mapInstanceRef.current;

      const originMarker = new window.google.maps.Marker({
        position: startPos,
        map,
        title: originLabel,
        label: {
          text: "A",
          color: "white",
          fontWeight: "bold",
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      const originInfo = new window.google.maps.InfoWindow({
        content: `<div style="font-size:13px;font-weight:600;padding:2px 4px">${originLabel}</div>`,
      });
      originMarker.addListener("click", () => originInfo.open(map, originMarker));

      if (endPos) {
        const destMarker = new window.google.maps.Marker({
          position: endPos,
          map,
          title: destinationLabel,
          label: {
            text: "B",
            color: "white",
            fontWeight: "bold",
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        const destInfo = new window.google.maps.InfoWindow({
          content: `<div style="font-size:13px;font-weight:600;padding:2px 4px">${destinationLabel}</div>`,
        });
        destMarker.addListener("click", () => destInfo.open(map, destMarker));

        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#f97316",
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        });

        directionsService.route(
          {
            origin: startPos,
            destination: endPos,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK" && result) {
              directionsRenderer.setDirections(result);
            } else {
              new window.google.maps.Polyline({
                path: [startPos, endPos],
                map,
                strokeColor: "#f97316",
                strokeWeight: 3,
                strokeOpacity: 0.7,
                geodesic: true,
              });
            }
            map.fitBounds(bounds);
            map.setZoom(Math.min((map.getZoom() ?? 12), 14));
          }
        );
      } else {
        map.setCenter(startPos);
        map.setZoom(14);
      }
    } catch (err) {
      console.error("Error initializing collect route map:", err);
      setError("Erro ao inicializar o mapa");
    }
  }, [mapLoaded, startLat, startLng, endLat, endLng, hasStart, hasEnd, originLabel, destinationLabel]);

  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center h-56 bg-muted/50 rounded-lg">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!apiKeyData?.configured) {
    return (
      <div className="flex flex-col items-center justify-center h-56 bg-muted/30 rounded-lg border border-dashed">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Google Maps não configurado</p>
        <p className="text-xs text-muted-foreground">Configure em Configurações › Integrações</p>
      </div>
    );
  }

  if (!hasStart) {
    return (
      <div className="flex flex-col items-center justify-center h-56 bg-muted/30 rounded-lg border border-dashed">
        <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Localização de início não disponível</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-56 bg-destructive/10 rounded-lg border border-destructive/30">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white font-bold text-[10px]">A</span>
          {originLabel}
        </span>
        {hasEnd && (
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white font-bold text-[10px]">B</span>
            {destinationLabel}
          </span>
        )}
      </div>
      <div
        ref={mapRef}
        className="h-56 w-full rounded-lg overflow-hidden border"
        data-testid="map-collect-route"
      >
        {!mapLoaded && (
          <div className="flex items-center justify-center h-full bg-muted/50">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
