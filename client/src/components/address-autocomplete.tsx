import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressComponents {
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: AddressComponents) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  testId?: string;
}

interface Prediction {
  description: string;
  place_id: string;
}

let googleMapsLoaded = false;
let googleMapsLoading = false;
let loadCallbacks: (() => void)[] = [];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    if (googleMapsLoading) {
      loadCallbacks.push(() => resolve());
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      // Script exists, wait for it to load (with 8s timeout fallback)
      let elapsed = 0;
      const checkInterval = setInterval(() => {
        elapsed += 100;
        if (window.google?.maps?.places) {
          clearInterval(checkInterval);
          googleMapsLoaded = true;
          resolve();
        } else if (elapsed >= 8000) {
          clearInterval(checkInterval);
          reject(new Error("Autocomplete indisponível (Google Maps sem biblioteca Places)"));
        }
      }, 100);
      return;
    }

    googleMapsLoading = true;

    fetch("/api/integrations/google-maps/api-key")
      .then((res) => res.json())
      .then(({ apiKey }) => {
        if (!apiKey) {
          reject(new Error("Google Maps API key not configured"));
          return;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=pt-BR`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          googleMapsLoaded = true;
          googleMapsLoading = false;
          loadCallbacks.forEach((cb) => cb());
          loadCallbacks = [];
          resolve();
        };

        script.onerror = () => {
          googleMapsLoading = false;
          reject(new Error("Failed to load Google Maps script"));
        };

        document.head.appendChild(script);
      })
      .catch(reject);
  });
}

function parseAddressComponents(place: google.maps.places.PlaceResult): AddressComponents {
  const components: AddressComponents = {
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    formattedAddress: place.formatted_address || "",
    latitude: place.geometry?.location?.lat(),
    longitude: place.geometry?.location?.lng(),
  };

  if (!place.address_components) return components;

  for (const component of place.address_components) {
    const types = component.types;

    if (types.includes("street_number")) {
      components.addressNumber = component.long_name;
    }
    if (types.includes("route")) {
      components.address = component.long_name;
    }
    if (types.includes("sublocality_level_1") || types.includes("sublocality")) {
      components.neighborhood = component.long_name;
    }
    if (types.includes("administrative_area_level_2") || types.includes("locality")) {
      components.city = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      components.state = component.short_name;
    }
    if (types.includes("postal_code")) {
      components.cep = component.long_name.replace("-", "");
    }
  }

  return components;
}

export function AddressAutocomplete({
  value,
  onChange,
  onInputChange,
  placeholder = "Digite um endereço...",
  testId = "input-address-autocomplete",
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (window.google?.maps?.places) {
          autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
          const mapDiv = document.createElement("div");
          placesServiceRef.current = new google.maps.places.PlacesService(mapDiv);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      return;
    }

    setIsFetching(true);

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setIsFetching(false);
        return;
      }

      const response = await fetch(`/api/integrations/google-maps/places/search?query=${encodeURIComponent(input)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setIsFetching(false);
        setPredictions([]);
        return;
      }

      const data = await response.json();
      
      if (data.predictions && data.predictions.length > 0) {
        setPredictions(
          data.predictions.map((p: { placeId: string; description: string }) => ({
            description: p.description,
            place_id: p.placeId,
          }))
        );
        setShowDropdown(true);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error("Error fetching predictions:", error);
      setPredictions([]);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedIndex(-1);
    onInputChange?.(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  const handleSelectPlace = useCallback(async (placeId: string, description: string) => {
    setInputValue(description);
    setShowDropdown(false);
    setPredictions([]);
    setSelectedIndex(-1);

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(`/api/integrations/google-maps/places/${placeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to get place details");
        return;
      }

      const data = await response.json();
      
      const addressData: AddressComponents = {
        address: "",
        addressNumber: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        cep: "",
        formattedAddress: data.address || description,
        latitude: data.lat,
        longitude: data.lng,
      };
      
      // Parse the address from the formatted string
      // Examples: 
      // "R. Antônio Singer, 2682 - Campina do Taquaral, São José dos Pinhais - PR, 83091-002, Brazil"
      // "BR-153, s/n - Retiro do Bosque, Aparecida de Goiânia - GO, 74990-728, Brazil"
      if (data.address) {
        const parts = data.address.split(",").map((p: string) => p.trim());
        
        // First part is the street name (keep it complete, including highway numbers like BR-153)
        if (parts.length > 0) {
          addressData.address = parts[0];
        }
        
        // Second part may be "Number - Neighborhood", "s/n - Neighborhood", just "Number", or just "Neighborhood"
        if (parts.length > 1) {
          const secondPart = parts[1];
          // Match patterns like "2682 - Campina do Taquaral" or "s/n - Retiro do Bosque"
          const numberNeighborhoodMatch = secondPart.match(/^(\d+|s\/n)\s*-\s*(.+)$/i);
          if (numberNeighborhoodMatch) {
            addressData.addressNumber = numberNeighborhoodMatch[1];
            addressData.neighborhood = numberNeighborhoodMatch[2];
          } else if (/^\d+$/.test(secondPart)) {
            // Just a number
            addressData.addressNumber = secondPart;
          } else if (/^s\/n$/i.test(secondPart)) {
            // Just "s/n" (sem número)
            addressData.addressNumber = "s/n";
          } else {
            // It's the neighborhood
            addressData.neighborhood = secondPart;
          }
        }
        
        // Third part is usually "City - State"
        if (parts.length > 2) {
          const cityStatePart = parts[2];
          const cityStateMatch = cityStatePart.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
          if (cityStateMatch) {
            addressData.city = cityStateMatch[1].trim();
            addressData.state = cityStateMatch[2];
          } else {
            addressData.city = cityStatePart;
          }
        }
        
        // Fourth part is usually the CEP
        if (parts.length > 3) {
          const cepPart = parts[3];
          // Check if it's a CEP (format: XXXXX-XXX or XXXXXXXX)
          const cepMatch = cepPart.match(/^(\d{5}-?\d{3})$/);
          if (cepMatch) {
            addressData.cep = cepMatch[1].replace("-", "");
          }
        }
      }

      setInputValue(addressData.formattedAddress);
      onChange(addressData);
    } catch (error) {
      console.error("Error getting place details:", error);
    }
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          const selected = predictions[selectedIndex];
          handleSelectPlace(selected.place_id, selected.description);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  if (error) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onInputChange?.(e.target.value);
          }}
          placeholder={placeholder}
          className="pl-9"
          data-testid={testId}
        />
        <p className="text-xs text-destructive mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (predictions.length > 0) {
            setShowDropdown(true);
          }
        }}
        placeholder={placeholder}
        className="pl-9 pr-9"
        data-testid={testId}
        autoComplete="off"
      />
      {(isLoading || isFetching) && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {predictions.map((prediction, index) => (
            <div
              key={prediction.place_id}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectPlace(prediction.place_id, prediction.description);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span>{prediction.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
