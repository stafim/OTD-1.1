import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, AlertCircle } from "lucide-react";

interface VehicleLocationMapProps {
  latitude: string | null | undefined;
  longitude: string | null | undefined;
  title?: string;
}

interface GoogleMapsApiResponse {
  configured: boolean;
  apiKey: string | null;
}

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export function VehicleLocationMap({ latitude, longitude, title = "Localização do Veículo" }: VehicleLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: apiKeyData, isLoading: isLoadingKey } = useQuery<GoogleMapsApiResponse>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  const lat = latitude ? parseFloat(latitude) : null;
  const lng = longitude ? parseFloat(longitude) : null;
  const hasValidCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);

  useEffect(() => {
    if (!apiKeyData?.configured || !apiKeyData?.apiKey || !hasValidCoords) return;

    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        setMapLoaded(true);
        return;
      }

      const existingScript = document.getElementById("google-maps-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => setMapLoaded(true));
        return;
      }

      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      script.onerror = () => setError("Erro ao carregar Google Maps");
      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, [apiKeyData, hasValidCoords]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !hasValidCoords || !lat || !lng) return;

    try {
      const position = { lat, lng };

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: position,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        markerRef.current = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          title: title,
          animation: window.google.maps.Animation.DROP,
        });
      } else {
        mapInstanceRef.current.setCenter(position);
        if (markerRef.current) {
          markerRef.current.setPosition(position);
        }
      }
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Erro ao inicializar o mapa");
    }
  }, [mapLoaded, lat, lng, hasValidCoords, title]);

  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center h-48 bg-muted/50 rounded-md">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!apiKeyData?.configured) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-muted/30 rounded-md border border-dashed">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          Google Maps não configurado
        </p>
        <p className="text-xs text-muted-foreground">
          Configure em Configurações &gt; Integrações
        </p>
      </div>
    );
  }

  if (!hasValidCoords) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-muted/30 rounded-md border border-dashed">
        <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Localização não disponível
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-destructive/10 rounded-md border border-destructive/30">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className="h-48 w-full rounded-md overflow-hidden border"
      data-testid="map-vehicle-location"
    >
      {!mapLoaded && (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
