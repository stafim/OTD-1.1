import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Route, Clock, MapPin, DollarSign, Navigation, ArrowRight, Plus, X, GripVertical, Search } from "lucide-react";
import type { Yard, Client, DeliveryLocation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface Waypoint {
  id: string;
  address: string;
  lat?: number;
  lng?: number;
}

interface AddressSuggestion {
  placeId: string;
  description: string;
}

interface RouteResult {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  durationInTraffic?: { text: string; value: number };
  tollCost?: { amount: string; currency: string };
  originAddress: string;
  destinationAddress: string;
  waypointAddresses?: string[];
  polyline?: string;
}

export default function RoutingPage() {
  const [selectedYard, setSelectedYard] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [newWaypointAddress, setNewWaypointAddress] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSearchingWaypoint, setIsSearchingWaypoint] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: yards } = useQuery<Yard[]>({
    queryKey: ["/api/yards"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: deliveryLocations } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/clients", selectedClient, "locations"],
    enabled: !!selectedClient,
  });

  const { data: apiKeyData } = useQuery<{ configured: boolean; apiKey: string }>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  const activeYards = yards?.filter(y => y.isActive === "true") || [];
  const activeClients = clients?.filter(c => c.isActive === "true") || [];

  useEffect(() => {
    if (!apiKeyData?.apiKey || !mapRef.current) return;

    const existingScript = document.getElementById("google-maps-script");
    if (existingScript) {
      initMap();
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKeyData.apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, [apiKeyData?.apiKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: -23.5505, lng: -46.6333 },
      zoom: 5,
      mapTypeControl: false,
      streetViewControl: false,
    });

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapInstanceRef.current,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#4285F4",
        strokeWeight: 5,
      },
    });

    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    placesServiceRef.current = new google.maps.places.PlacesService(mapInstanceRef.current);
    setIsMapReady(true);
  };

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchAddress = (query: string) => {
    setNewWaypointAddress(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          console.warn("[searchAddress] No token available");
          return;
        }
        
        const response = await fetch(`/api/integrations/google-maps/places/search?query=${encodeURIComponent(query)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          console.error("[searchAddress] Response not ok:", response.status);
          return;
        }
        
        const data = await response.json();
        
        if (data.predictions && data.predictions.length > 0) {
          setSuggestions(data.predictions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error: any) {
        console.error("[searchAddress] Error:", error?.message || error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  };

  const selectSuggestion = async (suggestion: AddressSuggestion) => {
    setIsSearchingWaypoint(true);
    setShowSuggestions(false);

    try {
      const response = await apiRequest("GET", `/api/integrations/google-maps/places/${suggestion.placeId}`);
      const data = await response.json();

      if (data.lat && data.lng) {
        const newWaypoint: Waypoint = {
          id: Date.now().toString(),
          address: data.address || suggestion.description,
          lat: data.lat,
          lng: data.lng,
        };
        setWaypoints([...waypoints, newWaypoint]);
        setNewWaypointAddress("");
        setSuggestions([]);
        setError(null);
      } else {
        setError("Não foi possível obter detalhes do endereço");
      }
    } catch {
      setError("Não foi possível obter detalhes do endereço");
    } finally {
      setIsSearchingWaypoint(false);
    }
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id));
  };

  const calculateRoute = async () => {
    if (!selectedYard || !selectedLocation) {
      setError("Selecione o pátio de origem e o local de entrega");
      return;
    }

    const yard = activeYards.find(y => y.id === selectedYard);
    const location = deliveryLocations?.find(l => l.id === selectedLocation);

    if (!yard?.latitude || !yard?.longitude) {
      setError("O pátio selecionado não possui coordenadas cadastradas");
      return;
    }

    if (!location?.latitude || !location?.longitude) {
      setError("O local de entrega não possui coordenadas cadastradas");
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const waypointsData = waypoints
        .filter(wp => wp.lat && wp.lng)
        .map(wp => ({ lat: wp.lat!, lng: wp.lng!, address: wp.address }));

      const response = await apiRequest("POST", "/api/routing/calculate", {
        origin: { lat: parseFloat(yard.latitude), lng: parseFloat(yard.longitude) },
        destination: { lat: parseFloat(location.latitude), lng: parseFloat(location.longitude) },
        waypoints: waypointsData,
        avoidTolls,
        avoidHighways,
      });

      const result = await response.json();
      setRouteResult(result);

      if (mapInstanceRef.current && directionsRendererRef.current) {
        const directionsService = new google.maps.DirectionsService();
        
        const waypointsForMaps = waypoints
          .filter(wp => wp.lat && wp.lng)
          .map(wp => ({
            location: { lat: wp.lat!, lng: wp.lng! },
            stopover: true,
          }));

        directionsService.route(
          {
            origin: { lat: parseFloat(yard.latitude), lng: parseFloat(yard.longitude) },
            destination: { lat: parseFloat(location.latitude), lng: parseFloat(location.longitude) },
            waypoints: waypointsForMaps,
            travelMode: google.maps.TravelMode.DRIVING,
            avoidTolls,
            avoidHighways,
          },
          (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRendererRef.current?.setDirections(result);
            }
          }
        );
      }
    } catch {
      setError("Erro ao calcular rota. Verifique se os endereços estão corretos.");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId);
    setSelectedLocation("");
    setRouteResult(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Rotograma</h1>
          <p className="text-sm text-muted-foreground">
            Planeje rotas entre pátios e locais de entrega com pontos intermediários
          </p>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Configurar Rota
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pátio de Origem</Label>
                <Select value={selectedYard} onValueChange={setSelectedYard}>
                  <SelectTrigger data-testid="select-yard-origin">
                    <SelectValue placeholder="Selecione o pátio" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeYards.map((yard) => (
                      <SelectItem key={yard.id} value={yard.id}>
                        {yard.name} - {yard.city}/{yard.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pontos Intermediários (Desvios)</Label>
                </div>
                
                {waypoints.length > 0 && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                    {waypoints.map((wp, index) => (
                      <div key={wp.id} className="flex items-center gap-2 text-sm">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate" title={wp.address}>
                          {index + 1}. {wp.address}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeWaypoint(wp.id)}
                          data-testid={`button-remove-waypoint-${index}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="relative" ref={suggestionsRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={isMapReady ? "Buscar cidade, endereço ou local..." : "Aguarde o mapa carregar..."}
                      value={newWaypointAddress}
                      onChange={(e) => searchAddress(e.target.value)}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      disabled={!isMapReady || isSearchingWaypoint}
                      className="pl-9"
                      data-testid="input-waypoint"
                    />
                    {isSearchingWaypoint && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                  
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center gap-2"
                          onClick={() => selectSuggestion(suggestion)}
                          data-testid={`suggestion-${suggestion.placeId}`}
                        >
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{suggestion.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite e selecione da lista: "Lima, Peru", "Buenos Aires", "Assunção, Paraguai"
                </p>
              </div>

              <div className="flex justify-center py-2">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={selectedClient} onValueChange={handleClientChange}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Local de Entrega</Label>
                <Select 
                  value={selectedLocation} 
                  onValueChange={setSelectedLocation}
                  disabled={!selectedClient}
                >
                  <SelectTrigger data-testid="select-delivery-location">
                    <SelectValue placeholder={selectedClient ? "Selecione o local" : "Selecione um cliente primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryLocations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} - {location.city}/{location.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm text-muted-foreground">Opções de Rota</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={avoidTolls ? "default" : "outline"}
                    onClick={() => setAvoidTolls(!avoidTolls)}
                    data-testid="button-avoid-tolls"
                  >
                    {avoidTolls ? "Evitando Pedágios" : "Evitar Pedágios"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={avoidHighways ? "default" : "outline"}
                    onClick={() => setAvoidHighways(!avoidHighways)}
                    data-testid="button-avoid-highways"
                  >
                    {avoidHighways ? "Evitando Rodovias" : "Evitar Rodovias"}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={calculateRoute}
                disabled={isCalculating || !selectedYard || !selectedLocation}
                data-testid="button-calculate-route"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-4 w-4" />
                    Calcular Rota
                  </>
                )}
              </Button>

              {routeResult && (
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium">Resultado da Rota</h4>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Distância:</span>
                    <span>{routeResult.distance.text}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Tempo estimado:</span>
                    <span>{routeResult.duration.text}</span>
                  </div>

                  {routeResult.durationInTraffic && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Com trânsito:</span>
                      <span>{routeResult.durationInTraffic.text}</span>
                    </div>
                  )}

                  {routeResult.tollCost && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Pedágio estimado:</span>
                      <span>R$ {routeResult.tollCost.amount}</span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
                    <p><strong>Origem:</strong> {routeResult.originAddress}</p>
                    {routeResult.waypointAddresses && routeResult.waypointAddresses.length > 0 && (
                      <div>
                        <strong>Passando por:</strong>
                        <ul className="list-disc list-inside ml-2">
                          {routeResult.waypointAddresses.map((addr, i) => (
                            <li key={i}>{addr}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p><strong>Destino:</strong> {routeResult.destinationAddress}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa da Rota
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={mapRef} 
                className="w-full h-[500px] rounded-md border bg-muted"
                data-testid="routing-map"
              >
                {!apiKeyData?.apiKey && (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    Carregando mapa...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
