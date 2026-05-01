import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Radio, Send, Users, Eye, MapPin, Trash2,
  Circle, Hexagon, Loader2, ChevronRight, Info,
  AlertTriangle, Zap, Flame, CheckCircle2,
  Filter, X, MapPinned, Baby, Truck, ShieldCheck,
  ChevronDown, RotateCcw, Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoogleMapsApiResponse { configured: boolean; apiKey: string | null; }
type GeoFilterCircle = { type: "circle"; center: { lat: number; lng: number }; radius: number };
type GeoFilterPolygon = { type: "polygon"; coords: { lat: number; lng: number }[] };
type GeoFilter = GeoFilterCircle | GeoFilterPolygon | null;

interface DriverFilter {
  states?: string[];
  cities?: string[];
  minAge?: number;
  maxAge?: number;
  driverTypes?: string[];
  modalities?: string[];
  cnhTypes?: string[];
  isApto?: boolean;
  documentsApproved?: string[];
}

interface PreviewResult { total: number; withToken: number; eligible: number; }
interface BroadcastStats { sent: number; received: number; read: number; }
interface BroadcastItem {
  id: string; title: string; message: string; severity: string;
  geoFilter: GeoFilter; driverFilter: DriverFilter | null; totalSent: number; createdAt: string;
  stats: BroadcastStats;
}
interface BroadcastDetail extends BroadcastItem {
  recipients: Array<{
    id: string; driverId: string; sentAt: string | null;
    receivedAt: string | null; readAt: string | null;
    driver: { id: string; name: string; city: string; state: string } | null;
  }>;
}

const SEVERITY_CONFIG = {
  info:    { label: "Informativo", icon: Info,          color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
  alerta:  { label: "Alerta",      icon: AlertTriangle, color: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300" },
  urgente: { label: "Urgente",     icon: Zap,           color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300" },
  critico: { label: "Crítico",     icon: Flame,         color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300" },
} as const;

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const CNH_TYPES = ["A","B","C","D","E","AB","AC","AD","AE"];

const DRIVER_TYPE_LABELS: Record<string, string> = {
  coleta: "Coleta",
  transporte: "Transporte",
};

const MODALITY_LABELS: Record<string, string> = {
  pj: "PJ",
  clt: "CLT",
  agregado: "Agregado",
};

const DOC_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  em_analise: "Em análise",
};

function isDriverFilterEmpty(f: DriverFilter): boolean {
  return (
    (!f.states || f.states.length === 0) &&
    (!f.cities || f.cities.length === 0) &&
    f.minAge === undefined && f.maxAge === undefined &&
    (!f.driverTypes || f.driverTypes.length === 0) &&
    (!f.modalities || f.modalities.length === 0) &&
    (!f.cnhTypes || f.cnhTypes.length === 0) &&
    f.isApto === undefined &&
    (!f.documentsApproved || f.documentsApproved.length === 0)
  );
}

function countActiveFilters(f: DriverFilter): number {
  let n = 0;
  if (f.states && f.states.length > 0) n++;
  if (f.cities && f.cities.length > 0) n++;
  if (f.minAge !== undefined || f.maxAge !== undefined) n++;
  if (f.driverTypes && f.driverTypes.length > 0) n++;
  if (f.modalities && f.modalities.length > 0) n++;
  if (f.cnhTypes && f.cnhTypes.length > 0) n++;
  if (f.isApto !== undefined) n++;
  if (f.documentsApproved && f.documentsApproved.length > 0) n++;
  return n;
}

function toggleArray<T>(arr: T[] | undefined, val: T): T[] {
  const a = arr ?? [];
  return a.includes(val) ? a.filter(x => x !== val) : [...a, val];
}

declare global { interface Window { google: typeof google; } }

// ─── MAP component (unchanged logic) ────────────────────────────────────────
function BroadcastMap({ apiKey, onGeoChange, onPreviewUpdate }: {
  apiKey: string;
  onGeoChange: (geo: GeoFilter) => void;
  onPreviewUpdate: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<any>(null);
  const currentShapeRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [drawMode, setDrawMode] = useState<"circle" | "polygon" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const schedulePreview = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(onPreviewUpdate, 500);
  }, [onPreviewUpdate]);

  useEffect(() => {
    if (window.google?.maps) { setLoaded(true); return; }
    const existing = document.getElementById("gm-broadcast");
    if (existing) { existing.addEventListener("load", () => setLoaded(true)); return; }
    const script = document.createElement("script");
    script.id = "gm-broadcast";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: -15.7801, lng: -47.9292 }, zoom: 5,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    });
    mapInstanceRef.current = map;
    const dm = new (window.google.maps as any).drawing.DrawingManager({
      drawingMode: null, drawingControl: false,
      circleOptions: { fillColor: "#f97316", fillOpacity: 0.25, strokeColor: "#f97316", strokeWeight: 2, clickable: false, editable: true, zIndex: 1 },
      polygonOptions: { fillColor: "#f97316", fillOpacity: 0.25, strokeColor: "#f97316", strokeWeight: 2, clickable: false, editable: true, zIndex: 1 },
    });
    dm.setMap(map);
    drawingManagerRef.current = dm;

    window.google.maps.event.addListener(dm, "circlecomplete", (circle: any) => {
      if (currentShapeRef.current) currentShapeRef.current.setMap(null);
      currentShapeRef.current = circle;
      dm.setDrawingMode(null); setDrawMode(null);
      const update = () => {
        const center = circle.getCenter();
        onGeoChange({ type: "circle", center: { lat: center.lat(), lng: center.lng() }, radius: circle.getRadius() });
        schedulePreview();
      };
      update();
      circle.addListener("radius_changed", update);
      circle.addListener("center_changed", update);
    });

    window.google.maps.event.addListener(dm, "polygoncomplete", (polygon: any) => {
      if (currentShapeRef.current) currentShapeRef.current.setMap(null);
      currentShapeRef.current = polygon;
      dm.setDrawingMode(null); setDrawMode(null);
      const update = () => {
        const path = polygon.getPath();
        const coords: { lat: number; lng: number }[] = [];
        path.forEach((pt: any) => coords.push({ lat: pt.lat(), lng: pt.lng() }));
        onGeoChange({ type: "polygon", coords });
        schedulePreview();
      };
      update();
      polygon.getPath().addListener("set_at", update);
      polygon.getPath().addListener("insert_at", update);
    });
  }, [loaded, schedulePreview, onGeoChange]);

  const activateDrawing = (mode: "circle" | "polygon") => {
    if (!drawingManagerRef.current) return;
    const newMode = drawMode === mode ? null : mode;
    setDrawMode(newMode);
    drawingManagerRef.current.setDrawingMode(
      newMode === "circle" ? (window.google.maps as any).drawing.OverlayType.CIRCLE
        : newMode === "polygon" ? (window.google.maps as any).drawing.OverlayType.POLYGON
          : null
    );
  };

  const clearShape = () => {
    if (currentShapeRef.current) { currentShapeRef.current.setMap(null); currentShapeRef.current = null; }
    onGeoChange(null);
    onPreviewUpdate();
    if (drawingManagerRef.current) drawingManagerRef.current.setDrawingMode(null);
    setDrawMode(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Ferramenta:</span>
        <Button type="button" size="sm" variant={drawMode === "circle" ? "default" : "outline"} onClick={() => activateDrawing("circle")} className="gap-1.5" disabled={!loaded} data-testid="button-draw-circle">
          <Circle className="h-4 w-4" /> Círculo
        </Button>
        <Button type="button" size="sm" variant={drawMode === "polygon" ? "default" : "outline"} onClick={() => activateDrawing("polygon")} className="gap-1.5" disabled={!loaded} data-testid="button-draw-polygon">
          <Hexagon className="h-4 w-4" /> Polígono
        </Button>
        {currentShapeRef.current && (
          <Button type="button" size="sm" variant="ghost" onClick={clearShape} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Limpar área
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {!loaded ? "Carregando mapa..." : drawMode ? `Clique no mapa para desenhar` : "Selecione uma ferramenta para filtrar por área"}
        </span>
      </div>
      <div ref={mapRef} className="w-full rounded-lg border overflow-hidden" style={{ height: 320 }}>
        {!loaded && (
          <div className="flex h-full items-center justify-center bg-muted/30">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DRIVER FILTERS component ────────────────────────────────────────────────
function DriverFiltersPanel({ filter, onChange, onPreviewUpdate }: {
  filter: DriverFilter;
  onChange: (f: DriverFilter) => void;
  onPreviewUpdate: () => void;
}) {
  const [localityOpen, setLocalityOpen] = useState(true);
  const [ageOpen, setAgeOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [cityInput, setCityInput] = useState("");

  const update = (patch: Partial<DriverFilter>) => {
    onChange({ ...filter, ...patch });
    setTimeout(onPreviewUpdate, 300);
  };

  const addCity = () => {
    const c = cityInput.trim();
    if (!c) return;
    update({ cities: [...(filter.cities ?? []), c] });
    setCityInput("");
  };

  const removeCity = (c: string) => update({ cities: (filter.cities ?? []).filter(x => x !== c) });

  return (
    <div className="space-y-2">

      {/* ── Localidade ── */}
      <Collapsible open={localityOpen} onOpenChange={setLocalityOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors text-sm font-medium" data-testid="filter-section-localidade">
            <span className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-blue-500" />
              Localidade
              {((filter.states?.length ?? 0) + (filter.cities?.length ?? 0)) > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 h-4">{(filter.states?.length ?? 0) + (filter.cities?.length ?? 0)}</Badge>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${localityOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pt-2 pb-3 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Estado (UF)</p>
            <div className="grid grid-cols-7 gap-1">
              {BR_STATES.map(uf => (
                <button
                  key={uf}
                  type="button"
                  onClick={() => update({ states: toggleArray(filter.states, uf) })}
                  data-testid={`filter-state-${uf}`}
                  className={`text-[11px] font-bold py-1 rounded border transition-colors ${
                    filter.states?.includes(uf)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {uf}
                </button>
              ))}
            </div>
            {filter.states && filter.states.length > 0 && (
              <button type="button" onClick={() => update({ states: [] })} className="text-xs text-muted-foreground hover:text-destructive mt-1.5 flex items-center gap-1">
                <X className="h-3 w-3" /> Limpar estados
              </button>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Cidade</p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: São Paulo"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCity())}
                className="text-sm h-8"
                data-testid="filter-city-input"
              />
              <Button type="button" size="sm" variant="outline" onClick={addCity} className="h-8 px-3">
                Adicionar
              </Button>
            </div>
            {filter.cities && filter.cities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filter.cities.map(c => (
                  <Badge key={c} variant="secondary" className="gap-1 text-xs">
                    {c}
                    <button type="button" onClick={() => removeCity(c)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Idade ── */}
      <Collapsible open={ageOpen} onOpenChange={setAgeOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors text-sm font-medium" data-testid="filter-section-idade">
            <span className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-purple-500" />
              Faixa Etária
              {(filter.minAge !== undefined || filter.maxAge !== undefined) && (
                <Badge variant="secondary" className="text-xs px-1.5 h-4">
                  {filter.minAge ?? "—"}–{filter.maxAge ?? "—"} anos
                </Badge>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${ageOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pt-2 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Idade mínima</Label>
              <Input
                type="number" min={18} max={80} placeholder="Ex: 25"
                value={filter.minAge ?? ""}
                onChange={e => update({ minAge: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
                data-testid="filter-min-age"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Idade máxima</Label>
              <Input
                type="number" min={18} max={80} placeholder="Ex: 60"
                value={filter.maxAge ?? ""}
                onChange={e => update({ maxAge: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
                data-testid="filter-max-age"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "18–30 anos", min: 18, max: 30 },
              { label: "31–45 anos", min: 31, max: 45 },
              { label: "46–60 anos", min: 46, max: 60 },
              { label: "60+ anos", min: 60, max: undefined },
            ].map(preset => (
              <Button
                key={preset.label} type="button" size="sm" variant="outline"
                className="h-7 text-xs"
                onClick={() => update({ minAge: preset.min, maxAge: preset.max })}
                data-testid={`filter-age-preset-${preset.label}`}
              >
                {preset.label}
              </Button>
            ))}
            {(filter.minAge !== undefined || filter.maxAge !== undefined) && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => update({ minAge: undefined, maxAge: undefined })}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Tipo de Motorista ── */}
      <Collapsible open={typeOpen} onOpenChange={setTypeOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors text-sm font-medium" data-testid="filter-section-tipo">
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" />
              Tipo de Motorista
              {((filter.driverTypes?.length ?? 0) + (filter.modalities?.length ?? 0) + (filter.cnhTypes?.length ?? 0)) > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 h-4">
                  {(filter.driverTypes?.length ?? 0) + (filter.modalities?.length ?? 0) + (filter.cnhTypes?.length ?? 0)}
                </Badge>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${typeOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pt-2 pb-3 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Função</p>
            <div className="flex gap-3">
              {Object.entries(DRIVER_TYPE_LABELS).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`filter-drivertype-${val}`}>
                  <Checkbox
                    checked={filter.driverTypes?.includes(val) ?? false}
                    onCheckedChange={() => update({ driverTypes: toggleArray(filter.driverTypes, val) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Modalidade</p>
            <div className="flex gap-3">
              {Object.entries(MODALITY_LABELS).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`filter-modality-${val}`}>
                  <Checkbox
                    checked={filter.modalities?.includes(val) ?? false}
                    onCheckedChange={() => update({ modalities: toggleArray(filter.modalities, val) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Categoria CNH</p>
            <div className="flex flex-wrap gap-1.5">
              {CNH_TYPES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => update({ cnhTypes: toggleArray(filter.cnhTypes, cat) })}
                  data-testid={`filter-cnh-${cat}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded border transition-colors ${
                    filter.cnhTypes?.includes(cat)
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Status / Outros ── */}
      <Collapsible open={statusOpen} onOpenChange={setStatusOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors text-sm font-medium" data-testid="filter-section-status">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Status e Documentos
              {(filter.isApto !== undefined || (filter.documentsApproved?.length ?? 0) > 0) && (
                <Badge variant="secondary" className="text-xs px-1.5 h-4">
                  {(filter.isApto !== undefined ? 1 : 0) + (filter.documentsApproved?.length ?? 0)}
                </Badge>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${statusOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pt-2 pb-3 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Aptidão</p>
            <div className="flex gap-2">
              {[
                { val: undefined, label: "Todos" },
                { val: true, label: "Aptos" },
                { val: false, label: "Não aptos" },
              ].map(opt => (
                <Button
                  key={String(opt.val)}
                  type="button" size="sm" variant="outline"
                  className={`h-7 text-xs ${filter.isApto === opt.val ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground" : ""}`}
                  onClick={() => update({ isApto: opt.val })}
                  data-testid={`filter-apto-${opt.val}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Status dos documentos</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(DOC_STATUS_LABELS).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`filter-docs-${val}`}>
                  <Checkbox
                    checked={filter.documentsApproved?.includes(val) ?? false}
                    onCheckedChange={() => update({ documentsApproved: toggleArray(filter.documentsApproved, val) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── DETAIL DIALOG ────────────────────────────────────────────────────────────
function DetailDialog({ broadcastId, open, onClose }: { broadcastId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<BroadcastDetail>({
    queryKey: ["/api/broadcasts", broadcastId],
    enabled: !!broadcastId && open,
  });
  const sv = data ? SEVERITY_CONFIG[data.severity as keyof typeof SEVERITY_CONFIG] : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" /> Detalhes do Broadcast
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : data ? (
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${sv?.color}`}>
              <div className="flex items-start gap-3">
                {sv && <sv.icon className="h-5 w-5 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-semibold text-base">{data.title}</p>
                  <p className="text-sm mt-1 opacity-90">{data.message}</p>
                  <p className="text-xs mt-2 opacity-70">
                    {format(new Date(data.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {data.geoFilter && ` · Área: ${data.geoFilter.type === "circle" ? `Círculo (${(data.geoFilter.radius / 1000).toFixed(1)}km)` : "Polígono"}`}
                  </p>
                </div>
              </div>
            </div>

            {data.driverFilter && !isDriverFilterEmpty(data.driverFilter) && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" /> Filtros aplicados
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.driverFilter.states?.map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                  {data.driverFilter.cities?.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                  {(data.driverFilter.minAge !== undefined || data.driverFilter.maxAge !== undefined) && (
                    <Badge variant="outline" className="text-xs">{data.driverFilter.minAge ?? "—"}–{data.driverFilter.maxAge ?? "—"} anos</Badge>
                  )}
                  {data.driverFilter.driverTypes?.map(t => <Badge key={t} variant="outline" className="text-xs">{DRIVER_TYPE_LABELS[t] ?? t}</Badge>)}
                  {data.driverFilter.modalities?.map(m => <Badge key={m} variant="outline" className="text-xs">{MODALITY_LABELS[m] ?? m}</Badge>)}
                  {data.driverFilter.cnhTypes?.map(c => <Badge key={c} variant="outline" className="text-xs">CNH {c}</Badge>)}
                  {data.driverFilter.isApto !== undefined && (
                    <Badge variant="outline" className="text-xs">{data.driverFilter.isApto ? "Aptos" : "Não aptos"}</Badge>
                  )}
                  {data.driverFilter.documentsApproved?.map(d => <Badge key={d} variant="outline" className="text-xs">Docs: {DOC_STATUS_LABELS[d] ?? d}</Badge>)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Enviados", value: data.stats.sent, icon: Send, color: "text-blue-600" },
                { label: "Recebidos", value: data.stats.received, icon: CheckCircle2, color: "text-green-600" },
                { label: "Lidos", value: data.stats.read, icon: Eye, color: "text-purple-600" },
              ].map(s => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Destinatários ({data.recipients.length})
              </h4>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {data.recipients.map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{r.driver?.name ?? r.driverId}</span>
                      {r.driver && <span className="text-muted-foreground text-xs ml-2">{r.driver.city}/{r.driver.state}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${r.sentAt ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                        <Send className="h-3 w-3" /> {r.sentAt ? "Enviado" : "Falhou"}
                      </span>
                      {r.receivedAt && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" /> Recebido
                        </span>
                      )}
                      {r.readAt && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <Eye className="h-3 w-3" /> Lido
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {data.recipients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum destinatário registrado</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function BroadcastPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const severity: "info" | "alerta" | "urgente" | "critico" = "info";
  const [geoFilter, setGeoFilter] = useState<GeoFilter>(null);
  const [driverFilter, setDriverFilter] = useState<DriverFilter>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mapEnabled, setMapEnabled] = useState(false);
  const [filtersEnabled, setFiltersEnabled] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historySeverity, setHistorySeverity] = useState<string>("all");

  const geoFilterRef = useRef<GeoFilter>(null);
  const driverFilterRef = useRef<DriverFilter>({});

  useEffect(() => { geoFilterRef.current = geoFilter; }, [geoFilter]);
  useEffect(() => { driverFilterRef.current = driverFilter; }, [driverFilter]);

  const { data: apiKeyData } = useQuery<GoogleMapsApiResponse>({
    queryKey: ["/api/integrations/google-maps/api-key"],
  });

  const { data: broadcastList = [], isLoading: listLoading } = useQuery<BroadcastItem[]>({
    queryKey: ["/api/broadcasts"],
    refetchInterval: 10000,
  });

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const body: any = { geoFilter: geoFilterRef.current };
      const df = driverFilterRef.current;
      if (!isDriverFilterEmpty(df)) body.driverFilter = df;
      const res = await fetch("/api/broadcasts/preview-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) setPreview(await res.json());
    } catch { /* ignore */ }
    finally { setPreviewLoading(false); }
  }, []);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/broadcasts", {
      title: title.trim(), message: message.trim(), severity, geoFilter,
      driverFilter: isDriverFilterEmpty(driverFilter) ? null : driverFilter,
    }),
    onSuccess: (data: any) => {
      toast({ title: "Mensagem enviada!", description: `${data.totalSent} motorista(s) notificado(s).` });
      setTitle(""); setMessage(""); setGeoFilter(null);
      setDriverFilter({}); setPreview(null);
      queryClient.refetchQueries({ queryKey: ["/api/broadcasts"] });
      fetchPreview();
    },
    onError: (e: any) => toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" }),
  });

  const handleGeoChange = useCallback((geo: GeoFilter) => {
    setGeoFilter(geo);
    geoFilterRef.current = geo;
  }, []);

  const resetDriverFilter = () => {
    setDriverFilter({});
    driverFilterRef.current = {};
    setTimeout(fetchPreview, 300);
  };

  const sv = SEVERITY_CONFIG[severity];
  const canSend = title.trim().length > 0 && message.trim().length > 0 && !sendMutation.isPending;
  const activeFilterCount = countActiveFilters(driverFilter);

  const filteredBroadcastList = broadcastList.filter(b => {
    if (historySeverity !== "all" && b.severity !== historySeverity) return false;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      if (!b.title.toLowerCase().includes(q) && !b.message.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Mensagens" description="Envio de alertas em massa para motoristas via push notification" icon={<Radio className="h-5 w-5" />} />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── LEFT: Compose + Filters ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4" /> Compor mensagem
                </CardTitle>
                <CardDescription>Preencha os campos e defina o público-alvo antes de enviar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bc-title">Título <span className="text-destructive">*</span></Label>
                  <Input
                    id="bc-title" placeholder="Ex: Alerta de chuva na BR-116"
                    value={title} onChange={(e) => setTitle(e.target.value)}
                    maxLength={100} data-testid="input-broadcast-title"
                  />
                  <p className="text-xs text-muted-foreground text-right">{title.length}/100</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bc-message">Mensagem <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="bc-message" placeholder="Descreva o alerta ou aviso para os motoristas..."
                    value={message} onChange={(e) => setMessage(e.target.value)}
                    rows={4} maxLength={500} data-testid="input-broadcast-message"
                  />
                  <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
                </div>

                {/* Preview banner */}
                <div className={`rounded-lg border p-3 flex items-center gap-3 transition-opacity ${previewLoading ? "opacity-60" : ""}`}>
                  <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    {preview ? (
                      <>
                        <p className="text-sm font-medium">
                          <span className="text-primary font-bold text-base">{preview.eligible}</span>
                          {" "}motorista{preview.eligible !== 1 ? "s" : ""} {activeFilterCount > 0 || geoFilter ? "com filtros aplicados" : "com push habilitado"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cadastrados: {preview.total} · Com token FCM: {preview.withToken}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Calculando público-alvo...</p>
                    )}
                  </div>
                  {previewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                </div>

                {/* Notification preview */}
                {(title || message) && (
                  <div className={`rounded-lg border p-3 ${sv.color}`}>
                    <div className="flex items-start gap-2">
                      <sv.icon className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{title || "Título da mensagem"}</p>
                        <p className="text-xs mt-0.5 opacity-80">{message || "Conteúdo da mensagem..."}</p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => sendMutation.mutate()} disabled={!canSend}
                  className="w-full gap-2" data-testid="button-send-broadcast"
                >
                  {sendMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                    : <><Send className="h-4 w-4" /> Enviar Broadcast</>}
                </Button>
              </CardContent>
            </Card>

            {/* ── Driver Filters ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros de Motoristas
                    {activeFilterCount > 0 && (
                      <Badge className="text-xs">{activeFilterCount} ativo{activeFilterCount !== 1 ? "s" : ""}</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {filtersEnabled && activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetDriverFilter} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <RotateCcw className="h-3 w-3" /> Resetar
                      </Button>
                    )}
                    <Button
                      variant={filtersEnabled ? "default" : "outline"} size="sm"
                      onClick={() => setFiltersEnabled(v => !v)}
                      data-testid="button-toggle-filters"
                    >
                      {filtersEnabled ? "Ocultar filtros" : "Ativar filtros"}
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Sem filtros, todos os motoristas ativos com token FCM receberão a mensagem.
                </CardDescription>
              </CardHeader>
              {filtersEnabled && (
                <CardContent>
                  <DriverFiltersPanel
                    filter={driverFilter}
                    onChange={setDriverFilter}
                    onPreviewUpdate={fetchPreview}
                  />
                </CardContent>
              )}
            </Card>

            {/* ── Geo Filter ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Filtro Geográfico
                    <Badge variant="secondary" className="text-xs font-normal">opcional</Badge>
                  </CardTitle>
                  <Button
                    variant={mapEnabled ? "default" : "outline"} size="sm"
                    onClick={() => setMapEnabled(v => !v)} data-testid="button-toggle-map"
                  >
                    {mapEnabled ? "Ocultar mapa" : "Ativar filtro"}
                  </Button>
                </div>
                <CardDescription>
                  Delimite uma área no mapa para filtrar por localização em tempo real.
                </CardDescription>
              </CardHeader>
              {mapEnabled && apiKeyData?.configured && apiKeyData.apiKey && (
                <CardContent>
                  <BroadcastMap apiKey={apiKeyData.apiKey} onGeoChange={handleGeoChange} onPreviewUpdate={fetchPreview} />
                  {geoFilter && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {geoFilter.type === "circle"
                        ? `Círculo com raio de ${(geoFilter.radius / 1000).toFixed(1)} km`
                        : `Polígono com ${geoFilter.coords.length} pontos`}
                    </p>
                  )}
                </CardContent>
              )}
              {mapEnabled && (!apiKeyData?.configured || !apiKeyData.apiKey) && (
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Google Maps não configurado. Adicione a chave de API em Integrações.
                  </p>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ── RIGHT: History ── */}
          <div>
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="h-4 w-4" /> Histórico
                  <Badge variant="outline" className="ml-auto">
                    {filteredBroadcastList.length}
                    {filteredBroadcastList.length !== broadcastList.length && (
                      <span className="text-muted-foreground ml-1">/ {broadcastList.length}</span>
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription>Mensagens enviadas anteriormente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* ── Search + Severity filter ── */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Buscar por título ou mensagem..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-history-search"
                    />
                    {historySearch && (
                      <button
                        type="button"
                        onClick={() => setHistorySearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={historySeverity} onValueChange={setHistorySeverity}>
                    <SelectTrigger className="h-8 w-[130px] text-sm" data-testid="select-history-severity">
                      <SelectValue placeholder="Severidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-1.5">
                            <cfg.icon className="h-3.5 w-3.5" /> {cfg.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {listLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : broadcastList.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Radio className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Nenhum broadcast enviado ainda</p>
                  </div>
                ) : filteredBroadcastList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Nenhum resultado encontrado</p>
                    <button
                      type="button"
                      onClick={() => { setHistorySearch(""); setHistorySeverity("all"); }}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[660px] overflow-y-auto pr-1">
                    {filteredBroadcastList.map(b => {
                      const cfg = SEVERITY_CONFIG[b.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
                      const dfCount = b.driverFilter ? countActiveFilters(b.driverFilter) : 0;
                      return (
                        <button
                          key={b.id}
                          onClick={() => setDetailId(b.id)}
                          className="w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition-colors space-y-2"
                          data-testid={`broadcast-item-${b.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <cfg.icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color.split(" ")[1]}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{b.title}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{b.message}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Send className="h-3 w-3 text-blue-500" /> {b.stats.sent}
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" /> {b.stats.received}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3 text-purple-500" /> {b.stats.read}
                            </span>
                            <span className="ml-auto">
                              {format(new Date(b.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          {(b.geoFilter || dfCount > 0) && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {b.geoFilter && (
                                <Badge variant="outline" className="text-[10px] px-1.5 h-4 gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {b.geoFilter.type === "circle" ? `${(b.geoFilter.radius / 1000).toFixed(0)}km` : "Polígono"}
                                </Badge>
                              )}
                              {dfCount > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 h-4 gap-0.5">
                                  <Filter className="h-2.5 w-2.5" />
                                  {dfCount} filtro{dfCount !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DetailDialog broadcastId={detailId} open={!!detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
