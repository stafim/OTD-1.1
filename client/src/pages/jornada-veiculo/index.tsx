import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, Printer, Truck, Warehouse, Package, CheckCircle2,
  Camera, MapPin, Calendar, User, FileText, Clock, Car,
  Loader2, Factory, ArrowRight, Route, FuelIcon, Gauge,
  ShieldCheck, ArrowLeftRight, CheckCircle, XCircle, AlertCircle,
  Building2, Phone, Hash, Flag, ChevronDown, ChevronUp,
  List, Download, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeImageUrl } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

type VehicleJourney = {
  vehicle: {
    chassi: string;
    status: string;
    color?: string | null;
    notes?: string | null;
    collectDateTime?: string | null;
    yardEntryDateTime?: string | null;
    dispatchDateTime?: string | null;
    deliveryDateTime?: string | null;
    manufacturer?: { id: string; name: string } | null;
    yard?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    client?: { id: string; name: string } | null;
  };
  collects: Array<{
    id: string;
    status: string;
    collectDate?: string | null;
    notes?: string | null;
    checkinDateTime?: string | null;
    checkoutDateTime?: string | null;
    checkinLocation?: { type: string; coordinates: [number, number] } | null;
    checkoutLocation?: { type: string; coordinates: [number, number] } | null;
    checkinFrontalPhoto?: string | null;
    checkinLateral1Photo?: string | null;
    checkinLateral2Photo?: string | null;
    checkinTraseiraPhoto?: string | null;
    checkinOdometerPhoto?: string | null;
    checkinFuelLevelPhoto?: string | null;
    checkinDamagePhotos?: string[] | null;
    checkinSelfiePhoto?: string | null;
    checkinNotes?: string | null;
    checkoutNotes?: string | null;
    manufacturer?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    yard?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    driver?: { id: string; name: string; phone?: string | null; cnhType?: string | null } | null;
    checkoutApprovedBy?: { firstName?: string | null; lastName?: string | null; username: string } | null;
  }>;
  transports: Array<{
    id: string;
    requestNumber?: string | null;
    status: string;
    routeDistanceKm?: number | null;
    routeDurationMinutes?: number | null;
    estimatedTolls?: string | null;
    estimatedFuel?: string | null;
    checkinDateTime?: string | null;
    checkoutDateTime?: string | null;
    scheduledDeparture?: string | null;
    transitStartedAt?: string | null;
    checkinLocation?: { type: string; coordinates: [number, number] } | null;
    checkoutLocation?: { type: string; coordinates: [number, number] } | null;
    checkinFrontalPhoto?: string | null;
    checkinLateral1Photo?: string | null;
    checkinLateral2Photo?: string | null;
    checkinTraseiraPhoto?: string | null;
    checkinOdometerPhoto?: string | null;
    checkinFuelLevelPhoto?: string | null;
    checkinDamagePhotos?: string[] | null;
    checkinSelfiePhoto?: string | null;
    checkinNotes?: string | null;
    checkoutFrontalPhoto?: string | null;
    checkoutLateral1Photo?: string | null;
    checkoutLateral2Photo?: string | null;
    checkoutTraseiraPhoto?: string | null;
    checkoutOdometerPhoto?: string | null;
    checkoutFuelLevelPhoto?: string | null;
    checkoutDamagePhotos?: string[] | null;
    checkoutSelfiePhoto?: string | null;
    checkoutNotes?: string | null;
    originYard?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    deliveryLocation?: { id: string; name: string; address?: string | null; addressNumber?: string | null; city?: string | null; state?: string | null; latitude?: string | null; longitude?: string | null } | null;
    driver?: { id: string; name: string; phone?: string | null; cnhType?: string | null } | null;
    client?: { id: string; name: string } | null;
    deliveryDate?: string | null;
  }>;
  transfers: Array<{
    id: string;
    status: string;
    notes?: string | null;
    createdAt?: string | null;
    originYard?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    destinationYard?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    driver?: { id: string; name: string; phone?: string | null } | null;
  }>;
};

type VehicleItem = {
  chassi: string;
  status: string;
  manufacturer?: { name: string } | null;
  client?: { name: string } | null;
};

// Transport list item (from /api/transports)
type TransportListItem = {
  id: string;
  requestNumber?: string | null;
  vehicleChassi?: string | null;
  status: string;
  scheduledDeparture?: string | null;
  checkinDateTime?: string | null;
  checkoutDateTime?: string | null;
  transitStartedAt?: string | null;
  collectDate?: string | null;
  createdAt?: string | null;
  notes?: string | null;
  client?: { id: string; name: string } | null;
  originYard?: { id: string; name: string; city?: string | null } | null;
  deliveryLocation?: { id: string; name: string; city?: string | null; state?: string | null } | null;
  driver?: { id: string; name: string; phone?: string | null } | null;
  routeDistanceKm?: number | null;
};

// ─── Status configs ───────────────────────────────────────────────────────────

const vehicleStatusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pre_estoque:      { label: "Aguardando Coleta",  color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  em_estoque:       { label: "No Pátio",           color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  em_transferencia: { label: "Em Transferência",   color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200" },
  despachado:       { label: "Em Trânsito",        color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200" },
  entregue:         { label: "Entregue",           color: "text-green-700",   bg: "bg-green-50",   border: "border-green-200" },
  retirado:         { label: "Retirado",           color: "text-gray-700",    bg: "bg-gray-50",    border: "border-gray-200" },
};

const collectStatusConfig: Record<string, { label: string; color: string }> = {
  em_transito:        { label: "Em Trânsito",           color: "text-amber-700 bg-amber-50 border-amber-200" },
  autorizado_portaria:{ label: "Autorizado na Portaria", color: "text-blue-700 bg-blue-50 border-blue-200" },
  finalizada:         { label: "Finalizada",            color: "text-green-700 bg-green-50 border-green-200" },
};

const transportStatusConfig: Record<string, { label: string; color: string }> = {
  pendente:         { label: "Pendente",           color: "text-gray-700 bg-gray-50 border-gray-200" },
  aguardando_saida: { label: "Aguardando Saída",   color: "text-amber-700 bg-amber-50 border-amber-200" },
  em_transito:      { label: "Em Trânsito",        color: "text-blue-700 bg-blue-50 border-blue-200" },
  entregue:         { label: "Entregue",           color: "text-green-700 bg-green-50 border-green-200" },
  cancelado:        { label: "Cancelado",          color: "text-red-700 bg-red-50 border-red-200" },
};

const transferStatusConfig: Record<string, { label: string; color: string }> = {
  pendente:    { label: "Pendente",       color: "text-amber-700 bg-amber-50 border-amber-200" },
  autorizada:  { label: "Autorizada",    color: "text-blue-700 bg-blue-50 border-blue-200" },
  em_transito: { label: "Em Trânsito",   color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  concluida:   { label: "Concluída",     color: "text-green-700 bg-green-50 border-green-200" },
  cancelada:   { label: "Cancelada",     color: "text-red-700 bg-red-50 border-red-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val?: string | null) {
  if (!val) return "—";
  try { return format(new Date(val), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return "—"; }
}

function StatusBadgeInline({ cfg }: { cfg: { label: string; color: string } }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border", cfg.color)}>
      {cfg.label}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataRow({ label, value, icon: Icon, href, mono }: { label: string; value?: string | null; icon?: React.ElementType; href?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="w-40 shrink-0 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cn("text-sm font-medium text-primary underline underline-offset-2", mono && "font-mono")}>
            {value}
          </a>
        ) : (
          <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</span>
        )}
      </div>
    </div>
  );
}

function SectionBlock({ title, icon: Icon, accent, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; accent: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-md shrink-0", accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm flex-1">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t">
          {children}
        </div>
      )}
    </div>
  );
}

function PhotoGrid({ photos, title }: { photos: { label: string; url?: string | null }[]; title: string }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const valid = photos.filter((p) => p.url);
  if (valid.length === 0) return (
    <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground">
      <Camera className="h-3.5 w-3.5 opacity-40" />
      Nenhuma foto registrada
    </div>
  );
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
        <Camera className="h-3.5 w-3.5" />{title} ({valid.length})
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {valid.map((p) => (
          <button
            key={p.label}
            onClick={() => setViewing(normalizeImageUrl(p.url)!)}
            className="group relative aspect-square overflow-hidden rounded-md border-2 border-transparent bg-muted hover:border-primary transition-all"
          >
            <img src={normalizeImageUrl(p.url)} alt={p.label} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-0.5 translate-y-full group-hover:translate-y-0 transition-transform">
              <p className="text-[8px] text-white text-center font-medium truncate">{p.label}</p>
            </div>
          </button>
        ))}
      </div>
      {viewing && (
        <Dialog open onOpenChange={() => setViewing(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
            <img src={viewing} alt="Foto ampliada" className="w-full rounded-lg object-contain max-h-[85vh]" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Inline static Google Maps preview (clickable → opens Google Maps in new tab).
// Renders a graceful placeholder when the API key is unavailable.
function LocationMap({ lat, lng, apiKey, label, testId }: {
  lat: number; lng: number; apiKey?: string | null; label: string; testId?: string;
}) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
  const staticMapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=640x280&scale=2&markers=color:red%7C${lat},${lng}&key=${apiKey}`
    : null;
  return (
    <a
      href={mapsLink}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-md border border-border hover:opacity-90 transition-opacity"
      title={`${label} — Abrir no Google Maps`}
      data-testid={testId}
    >
      {staticMapUrl ? (
        <img
          src={staticMapUrl}
          alt={`Mapa — ${label}`}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-44 bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          Ver no Google Maps ({lat.toFixed(5)}, {lng.toFixed(5)})
        </div>
      )}
    </a>
  );
}

function TimelineEvent({ step, label, sublabel, time, icon: Icon, color, done, active, last }: {
  step: number; label: string; sublabel?: string; time?: string | null;
  icon: React.ElementType; color: string; done: boolean; active: boolean; last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0 z-10",
          done   && "border-green-500 bg-green-500 text-white",
          active && !done && `border-primary bg-primary text-primary-foreground`,
          !done && !active && "border-border bg-background text-muted-foreground"
        )}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        {!last && <div className={cn("w-0.5 flex-1 mt-1", done ? "bg-green-300" : "bg-border")} style={{ minHeight: "24px" }} />}
      </div>
      <div className="pb-4 pt-0.5 min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={cn("text-sm font-semibold", done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground")}>
            {label}
          </span>
          {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        </div>
        {time && <p className="text-xs text-muted-foreground mt-0.5">{time}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JornadaVeiculoPage() {
  const [activeTab, setActiveTab]           = useState<"vehicles" | "transports">("transports");
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState("todos");
  const [transportSearch, setTransportSearch] = useState("");
  const [transportStatusFilter, setTransportStatusFilter] = useState("todos");
  const [selectedChassi, setSelectedChassi] = useState<string | null>(null);
  const [lightbox, setLightbox]             = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating]   = useState(false);
  // When a PDF is triggered from the transport list, store the chassi here
  const pendingPdfRef = useRef(false);

  const { data: vehiclesList } = useQuery<VehicleItem[]>({ queryKey: ["/api/vehicles"] });
  const { data: transportsList } = useQuery<TransportListItem[]>({ queryKey: ["/api/transports"] });
  const { data: journey, isLoading } = useQuery<VehicleJourney>({
    queryKey: ["/api/vehicle-journey", selectedChassi],
    enabled: !!selectedChassi,
  });
  const { data: mapsApiKeyData } = useQuery<{ configured: boolean; apiKey: string | null }>({ queryKey: ["/api/integrations/google-maps/api-key"] });
  const { data: journeyDistances } = useQuery<{
    collects:   { id: string; distanceKm: number | null; source: string }[];
    transfers:  { id: string; distanceKm: number | null; source: string }[];
    transports: { id: string; plannedKm: number | null; realizedKm: number | null; source: string }[];
    totals: {
      collectsKm: number;
      transfersKm: number;
      transportsRealizedKm: number;
      transportsPlannedKm: number;
      totalRealizedKm: number;
    };
    apiKeyConfigured: boolean;
  }>({
    queryKey: ["/api/vehicle-journey", selectedChassi, "distances"],
    enabled: !!selectedChassi,
  });

  // Quick lookup maps by entity id
  const collectDistMap   = new Map(journeyDistances?.collects?.map(r   => [r.id, r]) ?? []);
  const transferDistMap  = new Map(journeyDistances?.transfers?.map(r  => [r.id, r]) ?? []);
  const transportDistMap = new Map(journeyDistances?.transports?.map(r => [r.id, r]) ?? []);
  const fmtKm = (n: number | null | undefined) =>
    n != null && n > 0 ? `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : null;
  const sourceLabel = (s?: string) =>
    s === "directions" ? "rota Google" : s === "haversine" ? "linha reta GPS" : "";

  // Auto-trigger PDF when journey loads (from "Exportar PDF" in transport list)
  useEffect(() => {
    if (journey && !isLoading && pendingPdfRef.current) {
      pendingPdfRef.current = false;
      handlePrint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey, isLoading]);

  const filteredVehicles = (vehiclesList ?? []).filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (
      v.chassi.toLowerCase().includes(q) ||
      (v.manufacturer?.name ?? "").toLowerCase().includes(q) ||
      (v.client?.name ?? "").toLowerCase().includes(q)
    );
    const matchStatus = statusFilter === "todos" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredTransports = (transportsList ?? []).filter((t) => {
    const q = transportSearch.toLowerCase();
    const matchSearch = !q || (
      (t.requestNumber ?? "").toLowerCase().includes(q) ||
      (t.vehicleChassi ?? "").toLowerCase().includes(q) ||
      (t.client?.name ?? "").toLowerCase().includes(q) ||
      (t.driver?.name ?? "").toLowerCase().includes(q) ||
      (t.originYard?.name ?? "").toLowerCase().includes(q) ||
      (t.deliveryLocation?.name ?? "").toLowerCase().includes(q)
    );
    const matchStatus = transportStatusFilter === "todos" || t.status === transportStatusFilter;
    return matchSearch && matchStatus;
  });

  const v = journey?.vehicle;
  const vCfg = v ? (vehicleStatusConfig[v.status] ?? vehicleStatusConfig.pre_estoque) : null;

  // Build timeline events from the journey data
  const stepMap: Record<string, number> = {
    pre_estoque: 0, em_estoque: 1, em_transferencia: 2, despachado: 3, entregue: 4, retirado: 4,
  };
  const currentStep = v ? (stepMap[v.status] ?? 0) : 0;

  async function handlePrint() {
    if (!journey || !v) return;
    setPdfGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");

      // Fetch PDF password from settings
      let pdfPassword: string | null = null;
      try {
        const token = localStorage.getItem("accessToken");
        const pwRes = await fetch("/api/settings/pdf-password", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (pwRes.ok) {
          const pwData = await pwRes.json();
          pdfPassword = pwData.password ?? null;
        }
      } catch { /* ignore — generate PDF without password */ }

      // ─── Palette — mirrors the web UI ────────────────────────────────────
      const C = {
        orange:   [234,  88,  12] as [number,number,number],
        dark:     [ 15,  15,  20] as [number,number,number],
        muted:    [ 90,  90, 100] as [number,number,number],
        faint:    [248, 248, 250] as [number,number,number],
        border:   [226, 226, 230] as [number,number,number],
        white:    [255, 255, 255] as [number,number,number],
        // Status colours
        green:    [ 21, 128,  61] as [number,number,number],
        greenBg:  [220, 252, 231] as [number,number,number],
        greenBd:  [134, 239, 172] as [number,number,number],
        blue:     [ 29,  78, 216] as [number,number,number],
        blueBg:   [219, 234, 254] as [number,number,number],
        blueBd:   [147, 197, 253] as [number,number,number],
        purple:   [109,  40, 217] as [number,number,number],
        purpleBg: [237, 233, 254] as [number,number,number],
        amber:    [146,  64,  14] as [number,number,number],
        amberBg:  [254, 243, 199] as [number,number,number],
        red:      [185,  28,  28] as [number,number,number],
        redBg:    [254, 226, 226] as [number,number,number],
      };

      // ─── Page geometry ────────────────────────────────────────────────────
      const pageW = 210, pageH = 297, M = 14, CW = pageW - M * 2; // CW = 182mm
      const LABEL_W = 54; // label column width in DataRow
      const ROW_H   = 8;  // height per data row
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        ...(pdfPassword ? {
          encryption: {
            userPassword: pdfPassword,
            ownerPassword: pdfPassword,
            userPermissions: ["print", "modify", "copy", "annot-forms"] as ("print" | "modify" | "copy" | "annot-forms")[],
          }
        } : {}),
      });
      let y = 0, pageNum = 1;

      // ─── Image loader ─────────────────────────────────────────────────────
      // Returns the data URL plus the natural dimensions so we can preserve
      // aspect ratio when placing the image into the PDF.
      async function loadImg(url: string | null | undefined): Promise<{ data: string; w: number; h: number } | null> {
        if (!url) return null;
        const n = normalizeImageUrl(url);
        if (!n) return null;
        try {
          const img = new Image(); img.crossOrigin = "anonymous";
          await new Promise<void>((ok, fail) => {
            img.onload = () => ok();
            img.onerror = () => fail(new Error("load failed"));
            img.src = n + (n.includes("?") ? "&" : "?") + "ts=" + Date.now();
          });
          const w = img.naturalWidth || 800;
          const h = img.naturalHeight || 600;
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          const ctx = cv.getContext("2d"); if (!ctx) return null;
          ctx.drawImage(img, 0, 0);
          return { data: cv.toDataURL("image/jpeg", 0.82), w, h };
        } catch { return null; }
      }

      // Helper — given an available cell area and the image natural dimensions,
      // return the centered position + scaled size that preserves aspect ratio.
      const fitContain = (
        cellX: number, cellY: number, cellW: number, cellH: number,
        imgW: number, imgH: number,
      ) => {
        const ratio = imgW / imgH;
        const cellRatio = cellW / cellH;
        let drawW: number; let drawH: number;
        if (ratio > cellRatio) {
          drawW = cellW;
          drawH = cellW / ratio;
        } else {
          drawH = cellH;
          drawW = cellH * ratio;
        }
        const drawX = cellX + (cellW - drawW) / 2;
        const drawY = cellY + (cellH - drawH) / 2;
        return { x: drawX, y: drawY, w: drawW, h: drawH };
      };

      // ─── Page break check ─────────────────────────────────────────────────
      const pb = (h: number) => {
        if (y + h > pageH - 14) {
          drawFooter(); doc.addPage(); pageNum++;
          // repeat thin top banner on continuation pages
          doc.setFillColor(...C.orange);
          doc.rect(0, 0, pageW, 6, "F");
          doc.setFontSize(6); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.white);
          doc.text("OTD LOGISTICS · HISTÓRICO DO CHASSI", M, 4.5);
          doc.text(v!.chassi, pageW - M, 4.5, { align: "right" });
          y = 10;
        }
      };

      // ─── Footer ───────────────────────────────────────────────────────────
      const drawFooter = () => {
        doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
        doc.line(M, pageH - 10, pageW - M, pageH - 10);
        doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
        doc.text(`OTD Logistics  ·  Histórico Completo do Chassi  ·  ${v!.chassi}`, M, pageH - 5);
        doc.text(`Pág. ${pageNum}`, pageW - M, pageH - 5, { align: "right" });
      };

      // ─── Section header — mirrors SectionBlock header bar ─────────────────
      // accentBg: the small icon square colour; e.g. "bg-primary/10 text-primary"
      const sectionHdr = (title: string, dotColor: [number,number,number]) => {
        pb(13);
        doc.setFillColor(...C.faint);
        doc.roundedRect(M, y, CW, 10, 1.5, 1.5, "F");
        doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
        doc.roundedRect(M, y, CW, 10, 1.5, 1.5);
        // coloured dot/box — mirrors the icon-box in web
        doc.setFillColor(...dotColor);
        doc.roundedRect(M + 3, y + 2.5, 5, 5, 1, 1, "F");
        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.dark);
        doc.text(title, M + 11, y + 7);
        y += 13;
      };

      // ─── Sub-section label — e.g. "Dados da Coleta", "Check-in" ──────────
      const subLbl = (label: string, dotColor: [number,number,number]) => {
        pb(8);
        // left accent line like "border-l" in web
        doc.setFillColor(...dotColor);
        doc.rect(M, y, 2.5, 6, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...dotColor);
        doc.text(label.toUpperCase(), M + 5, y + 4.5);
        y += 9;
      };

      // ─── DataRow — mirrors the DataRow component ───────────────────────────
      // label (gray, small caps, LABEL_W) | value (dark, normal weight, rest)
      const DR = (label: string, value?: string | null, mono = false) => {
        if (!value) return;
        pb(ROW_H);
        // bottom separator
        doc.setDrawColor(...C.border); doc.setLineWidth(0.2);
        doc.line(M, y + ROW_H - 0.3, M + CW, y + ROW_H - 0.3);
        // label
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
        doc.text(label.toUpperCase(), M + 2, y + 5.5);
        // value
        doc.setFontSize(8); doc.setFont(mono ? "courier" : "helvetica", "normal"); doc.setTextColor(...C.dark);
        const vx = M + LABEL_W;
        const vw = CW - LABEL_W - 2;
        const lines = doc.splitTextToSize(value, vw);
        doc.text(lines[0], vx, y + 5.5);
        y += ROW_H;
      };

      // ─── Status pill — mirrors the StatusBadgeInline component ───────────
      const pill = (label: string, fg: [number,number,number], bg: [number,number,number]) => {
        pb(8);
        const pw = doc.getTextWidth(label) + 6;
        doc.setFillColor(...bg);
        doc.roundedRect(M, y, pw, 6, 1.5, 1.5, "F");
        doc.setDrawColor(...fg); doc.setLineWidth(0.3);
        doc.roundedRect(M, y, pw, 6, 1.5, 1.5);
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...fg);
        doc.text(label, M + pw / 2, y + 4.3, { align: "center" });
        y += 9;
      };

      // ─── Notes block ──────────────────────────────────────────────────────
      const noteBlk = (label: string, text?: string | null) => {
        if (!text) return;
        const lines = doc.splitTextToSize(text, CW - 8);
        const bh = 5 + lines.length * 4.5 + 3;
        pb(bh + 3);
        doc.setFillColor(...C.faint); doc.setDrawColor(...C.border); doc.setLineWidth(0.2);
        doc.roundedRect(M, y, CW, bh, 1.5, 1.5, "FD");
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.muted);
        doc.text(label.toUpperCase(), M + 3, y + 4.5);
        doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.dark);
        doc.text(lines, M + 3, y + 9.5);
        y += bh + 4;
      };

      // ─── Thin spacer ─────────────────────────────────────────────────────
      const gap = (mm = 4) => { pb(mm); y += mm; };

      // ─── Photo grid — 2 wide columns, label below each image ─────────────
      const photoGrid = async (photos: { label: string; url?: string | null }[], title: string, accentColor: [number,number,number]) => {
        const valid = photos.filter(p => p.url);
        if (valid.length === 0) return;
        const loaded = await Promise.all(valid.map(p => loadImg(p.url)));
        const pairs = loaded
          .map((d, i) => d ? { label: valid[i].label, data: d.data, w: d.w, h: d.h } : null)
          .filter(Boolean) as { label: string; data: string; w: number; h: number }[];
        if (pairs.length === 0) return;

        subLbl(`Registro Fotográfico — ${title}  (${pairs.length} foto${pairs.length !== 1 ? "s" : ""})`, accentColor);

        const colW = (CW - 3) / 2;
        // Taller cells so portrait photos (most check-in/checkout shots are vertical)
        // are rendered noticeably larger; landscape photos still fit with extra padding.
        const imgH = colW * 1.15;
        const captH = 6;
        const cellH = imgH + captH;
        // Inner area available to the image (with 0.5mm padding)
        const innerW = colW - 1;
        const innerH = imgH - 1;

        const drawCell = (cx: number, item: { label: string; data: string; w: number; h: number }) => {
          // Card background + border
          doc.setFillColor(...C.faint); doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
          doc.roundedRect(cx, y, colW, cellH, 1.5, 1.5, "FD");
          // Letterbox area (subtle gray fill so unused space looks intentional)
          doc.setFillColor(235, 235, 238);
          doc.rect(cx + 0.5, y + 0.5, innerW, innerH, "F");
          // Compute aspect-preserving rect
          const fit = fitContain(cx + 0.5, y + 0.5, innerW, innerH, item.w, item.h);
          try { doc.addImage(item.data, "JPEG", fit.x, fit.y, fit.w, fit.h); } catch {}
          // Caption bar
          doc.setFillColor(20, 20, 24);
          doc.rect(cx, y + imgH, colW, captH, "F");
          doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
          doc.text(item.label, cx + colW / 2, y + imgH + captH - 1.5, { align: "center" });
        };

        for (let i = 0; i < pairs.length; i += 2) {
          pb(cellH + 4);
          const L = pairs[i], R = pairs[i + 1] ?? null;
          const lx = M, rx = M + colW + 3;

          drawCell(lx, L);
          if (R) drawCell(rx, R);

          y += cellH + 3;
        }
        gap(2);
      };

      // ─── Static map block — single full-width map image with caption ─────
      // Renders nothing if no API key is configured or no coordinates provided.
      const mapsApiKey = mapsApiKeyData?.apiKey;
      const mapBlock = async (
        label: string,
        lat: number | null | undefined,
        lng: number | null | undefined,
        accentColor: [number, number, number],
        markerColor: string = "red",
      ) => {
        if (!mapsApiKey || lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;
        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=640x280&scale=2&markers=color:${markerColor}%7C${lat},${lng}&key=${mapsApiKey}`;
        const loaded = await loadImg(url);
        if (!loaded) return;

        // Cell dimensions — full content width, ~16:7 aspect (matches the 640x280 source)
        const cellW = CW;
        const imgH = cellW * (280 / 640);
        const captH = 6;
        const cellH = imgH + captH;
        const innerW = cellW - 1;
        const innerH = imgH - 1;

        pb(cellH + 4);
        // Card background + border
        doc.setFillColor(...C.faint); doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
        doc.roundedRect(M, y, cellW, cellH, 1.5, 1.5, "FD");
        // Letterbox area
        doc.setFillColor(235, 235, 238);
        doc.rect(M + 0.5, y + 0.5, innerW, innerH, "F");
        // Aspect-preserving image
        const fit = fitContain(M + 0.5, y + 0.5, innerW, innerH, loaded.w, loaded.h);
        try { doc.addImage(loaded.data, "JPEG", fit.x, fit.y, fit.w, fit.h); } catch {}
        // Caption strip with accent bar
        doc.setFillColor(20, 20, 24);
        doc.rect(M, y + imgH, cellW, captH, "F");
        doc.setFillColor(...accentColor);
        doc.rect(M, y + imgH, 2.5, captH, "F");
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
        doc.text(`${label}  ·  GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`, M + cellW / 2, y + imgH + captH - 1.5, { align: "center" });

        y += cellH + 4;
      };

      // ─── Status configs ───────────────────────────────────────────────────
      type SC = { label: string; fg: [number,number,number]; bg: [number,number,number] };
      const tSC: Record<string, SC> = {
        pendente:         { label: "Pendente",         fg: C.amber,  bg: C.amberBg },
        aguardando_saida: { label: "Aguard. Saída",    fg: C.amber,  bg: C.amberBg },
        em_transito:      { label: "Em Trânsito",      fg: C.blue,   bg: C.blueBg },
        entregue:         { label: "Entregue",         fg: C.green,  bg: C.greenBg },
        cancelado:        { label: "Cancelado",        fg: C.red,    bg: C.redBg },
      };
      const cSC: Record<string, SC> = {
        em_transito:         { label: "Em Trânsito",            fg: C.amber,  bg: C.amberBg },
        autorizado_portaria: { label: "Autorizado na Portaria", fg: C.blue,   bg: C.blueBg },
        finalizada:          { label: "Finalizada",             fg: C.green,  bg: C.greenBg },
      };
      const trSC: Record<string, SC> = {
        pendente:    { label: "Pendente",    fg: C.amber,  bg: C.amberBg },
        autorizada:  { label: "Autorizada",  fg: C.blue,   bg: C.blueBg },
        em_transito: { label: "Em Trânsito", fg: C.blue,   bg: C.blueBg },
        concluida:   { label: "Concluída",   fg: C.green,  bg: C.greenBg },
        cancelada:   { label: "Cancelada",   fg: C.red,    bg: C.redBg },
      };

      // ════════════════════════════════════════════════════════════════════
      // ▌ PAGE 1 — REPORT HEADER (mirrors the web report header card)
      // ════════════════════════════════════════════════════════════════════

      // ── Company header block ────────────────────────────────────────────
      const HEADER_H = 22;
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, HEADER_H, "F");
      // bottom border line
      doc.setDrawColor(...C.border); doc.setLineWidth(0.4);
      doc.line(0, HEADER_H, pageW, HEADER_H);

      // Logo — load from public folder
      const logoData = await loadImg("/logo-otd.png");
      if (logoData) {
        // Fit the logo into a 28×12 mm box on the left preserving aspect ratio
        const fit = fitContain(M, 5, 28, 12, logoData.w, logoData.h);
        try { doc.addImage(logoData.data, "PNG", fit.x, fit.y, fit.w, fit.h); } catch {}
      }

      // Company details on the right side
      const detailX = M + 35;
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.dark);
      doc.text("OTD Logistics S/A", detailX, 9);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
      doc.text("R. Antônio Singer, 2682 - Cachoeira de São José, São José dos Pinhais - PR, 83091-002", detailX, 14);
      doc.text("Telefone: (41) 3544-3000", detailX, 19);

      // Emission date top-right
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
      doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - M, 8, { align: "right" });

      // ── Orange band below company header ────────────────────────────────
      doc.setFillColor(...C.orange);
      doc.rect(0, HEADER_H, pageW, 8, "F");
      doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.white);
      doc.text("HISTÓRICO COMPLETO DO CHASSI  —  RELATÓRIO JORNADA DO VEÍCULO", M, HEADER_H + 5.5);
      y = HEADER_H + 12;
      drawFooter();

      // ── Chassi identity box ────────────────────────────────────────────
      // mirrors: "Número do Chassi" label + big mono chassi + status pill
      doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
      doc.roundedRect(M, y, CW, 18, 2, 2);
      doc.setFillColor(...C.faint);
      doc.roundedRect(M, y, CW, 18, 2, 2, "F");
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
      doc.text("NÚMERO DO CHASSI", M + 4, y + 5);
      doc.setFontSize(16); doc.setFont("courier", "bold"); doc.setTextColor(...C.dark);
      doc.text(v.chassi, M + 4, y + 14);
      // status pill top-right
      const vsc = v.status === "entregue" || v.status === "retirado" ? tSC.entregue :
                  v.status === "em_estoque" || v.status === "despachado" ? tSC.em_transito :
                  v.status === "em_transferencia" ? { label: "Em Transferência", fg: C.purple, bg: C.purpleBg } :
                  tSC.pendente;
      const pillW = doc.getTextWidth(vsc.label) + 8;
      doc.setFillColor(...vsc.bg);
      doc.roundedRect(M + CW - pillW - 2, y + 5, pillW, 7, 2, 2, "F");
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...vsc.fg);
      doc.text(vCfg?.label ?? v.status, M + CW - pillW / 2 - 2, y + 10, { align: "center" });
      y += 21;

      // ── Vehicle detail fields (4-grid) ─────────────────────────────────
      // mirrors the 4-col grid: Montadora | Cliente | Cor | Pátio Atual
      const vFields = [
        ["Montadora", v.manufacturer?.name],
        ["Cliente", v.client?.name],
        ["Cor do Veículo", v.color],
        ["Pátio Atual", v.yard ? `${v.yard.name}${v.yard.city ? ` – ${v.yard.city}` : ""}` : null],
      ].filter(([, val]) => val) as [string, string][];

      const gCols = 4, gW = CW / gCols;
      vFields.forEach(([label, val], i) => {
        const col = i % gCols;
        const gx = M + col * gW;
        if (col === 0 && i > 0) { y += 14; }
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
        doc.text(label.toUpperCase(), gx, y + 4);
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.dark);
        const maxC = Math.floor(gW / 2.0);
        doc.text(val.length > maxC ? val.slice(0, maxC - 1) + "…" : val, gx, y + 10);
      });
      y += 14;

      // ── Stats bar — mirrors the 4-cell stats row ───────────────────────
      // Coletas | Transportes | Transferências | Distância Total
      // Use the per-segment realized total when available; fall back to the
      // sum of planned transport distances (legacy behavior).
      const totalDist = journeyDistances?.totals?.totalRealizedKm
        ?? journey.transports.reduce((s, t) => s + (parseFloat(String(t.routeDistanceKm ?? 0)) || 0), 0);
      const stats = [
        { label: "Coleta(s)", val: String(journey.collects.length) },
        { label: "Transporte(s)", val: String(journey.transports.length) },
        { label: "Transferência(s)", val: String(journey.transfers.length) },
        { label: "Distância Total", val: totalDist > 0 ? `${totalDist.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "—" },
      ];
      const sW = CW / stats.length;
      doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
      doc.rect(M, y, CW, 13);
      doc.setFillColor(...C.faint);
      doc.rect(M, y, CW, 13, "F");
      stats.forEach(({ label, val }, i) => {
        const sx = M + i * sW;
        if (i > 0) { doc.setDrawColor(...C.border); doc.setLineWidth(0.2); doc.line(sx, y, sx, y + 13); }
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.dark);
        doc.text(val, sx + sW / 2, y + 7.5, { align: "center" });
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
        doc.text(label, sx + sW / 2, y + 11.5, { align: "center" });
      });
      y += 17;

      // ════════════════════════════════════════════════════════════════════
      // ▌ I. LINHA DO TEMPO
      // ════════════════════════════════════════════════════════════════════
      sectionHdr("I.  Linha do Tempo", C.orange);
      pb(22);

      const tlSteps = [
        { label: "Coleta",      done: journey.collects.length > 0, sub: journey.collects[0]?.manufacturer?.name },
        { label: "Portaria",    done: journey.collects.some(c => ["autorizado_portaria","finalizada"].includes(c.status)), sub: "Entrada autorizada" },
        { label: "Pátio",       done: currentStep >= 1, sub: v.yard?.name },
        { label: "Transporte",  done: journey.transports.some(t => ["entregue","em_transito"].includes(t.status)), sub: journey.transports[0]?.requestNumber },
        { label: "Entrega",     done: journey.transports.some(t => t.status === "entregue"), sub: journey.transports.find(t => t.status === "entregue")?.client?.name },
      ];
      const stW = CW / tlSteps.length;
      tlSteps.forEach((s, i) => {
        const cx = M + stW * i + stW / 2;
        const clr: [number,number,number] = s.done ? C.green : [200,200,200];
        // connector line
        if (i < tlSteps.length - 1) {
          doc.setDrawColor(...(s.done ? C.green : [200,200,200] as [number,number,number]));
          doc.setLineWidth(1.2); doc.line(cx + 4.5, y + 5, cx + stW - 4.5, y + 5);
        }
        // circle
        doc.setFillColor(...clr); doc.circle(cx, y + 5, 4.5, "F");
        if (s.done) {
          // Vector checkmark — Helvetica's WinAnsi encoding has no "✓" glyph,
          // so we draw it with two short white strokes inside the circle.
          doc.setDrawColor(...C.white);
          doc.setLineWidth(0.9);
          doc.setLineCap("round");
          doc.setLineJoin("round");
          doc.line(cx - 1.8, y + 5.1, cx - 0.4, y + 6.6);
          doc.line(cx - 0.4, y + 6.6, cx + 2.1, y + 3.6);
        } else {
          doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.white);
          doc.text(String(i + 1), cx, y + 7.3, { align: "center" });
        }
        // label
        doc.setFontSize(7); doc.setFont("helvetica", s.done ? "bold" : "normal");
        doc.setTextColor(s.done ? C.dark[0] : 160, s.done ? C.dark[1] : 160, s.done ? C.dark[2] : 160);
        doc.text(s.label, cx, y + 14.5, { align: "center" });
        if (s.sub) {
          doc.setFontSize(5.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...C.muted);
          const maxC = Math.floor(stW / 1.5);
          doc.text(s.sub.length > maxC ? s.sub.slice(0, maxC - 1) + "…" : s.sub, cx, y + 18.5, { align: "center" });
        }
      });
      y += 23;

      // ════════════════════════════════════════════════════════════════════
      // ▌ II. COLETA(S)
      // ════════════════════════════════════════════════════════════════════
      for (let ci = 0; ci < journey.collects.length; ci++) {
        const c = journey.collects[ci];
        const cs = cSC[c.status] ?? cSC.em_transito;
        const sectLabel = `II.  Coleta${journey.collects.length > 1 ? ` #${ci + 1}` : ""}  na Montadora`;
        sectionHdr(sectLabel, C.orange);

        pill(cs.label, cs.fg, cs.bg);

        subLbl("Dados da Coleta", C.orange);
        DR("Data / Hora da Coleta",   fmtDate(c.checkinDateTime ?? c.collectDate));
        DR("Motorista",               c.driver?.name);
        DR("Telefone do Motorista",   c.driver?.phone);
        DR("Montadora (Origem)",      c.manufacturer?.name ? `${c.manufacturer.name}${c.manufacturer.city ? ` – ${c.manufacturer.city}` : ""}` : null);
        DR("Pátio de Destino",        c.yard?.name ? `${c.yard.name}${c.yard.city ? ` – ${c.yard.city}` : ""}` : null);
        {
          const d = collectDistMap.get(c.id);
          const km = fmtKm(d?.distanceKm);
          if (km) {
            const src = sourceLabel(d?.source);
            DR("Distância Realizada", src ? `${km} (${src})` : km);
          }
        }
        noteBlk("Observações", c.notes);

        if (c.checkinDateTime || c.checkinSelfiePhoto || c.checkinFrontalPhoto) {
          gap(2);
          subLbl("Check-in do Motorista  —  Saída da Montadora", C.blue);
          DR("Data / Hora do Check-in", fmtDate(c.checkinDateTime));
          DR("Localização GPS",         c.checkinLocation ? `${c.checkinLocation.coordinates[1].toFixed(5)}, ${c.checkinLocation.coordinates[0].toFixed(5)}` : null);
          if (c.checkinLocation?.coordinates) {
            gap(2);
            await mapBlock(
              "Local do Check-in (Saída da Montadora)",
              c.checkinLocation.coordinates[1],
              c.checkinLocation.coordinates[0],
              C.blue,
              "blue",
            );
          }
          noteBlk("Observações do Check-in", c.checkinNotes);

          const cPhotosCi = [
            { label: "Selfie", url: c.checkinSelfiePhoto },
            { label: "Frontal", url: c.checkinFrontalPhoto },
            { label: "Lateral Direita", url: c.checkinLateral1Photo },
            { label: "Lateral Esquerda", url: c.checkinLateral2Photo },
            { label: "Traseira", url: c.checkinTraseiraPhoto },
            { label: "Odômetro", url: c.checkinOdometerPhoto },
            { label: "Combustível", url: c.checkinFuelLevelPhoto },
            ...(c.checkinDamagePhotos ?? []).map((url, di) => ({ label: `Avaria ${di + 1}`, url })),
          ];
          await photoGrid(cPhotosCi, "Check-in da Coleta", C.blue);
        }

        if (c.checkoutDateTime || c.checkoutApprovedBy) {
          gap(2);
          subLbl("Autorização de Entrada  —  Portaria", C.purple);
          DR("Autorizado em",  fmtDate(c.checkoutDateTime));
          DR("Autorizado por", c.checkoutApprovedBy
            ? (`${c.checkoutApprovedBy.firstName || ""} ${c.checkoutApprovedBy.lastName || ""}`).trim() || c.checkoutApprovedBy.username
            : null);
          DR("Localização GPS", c.checkoutLocation ? `${c.checkoutLocation.coordinates[1].toFixed(5)}, ${c.checkoutLocation.coordinates[0].toFixed(5)}` : null);
          if (c.checkoutLocation?.coordinates) {
            gap(2);
            await mapBlock(
              "Local da Autorização da Portaria",
              c.checkoutLocation.coordinates[1],
              c.checkoutLocation.coordinates[0],
              C.purple,
              "purple",
            );
          }
          noteBlk("Observações da Portaria", c.checkoutNotes);
        }

        gap(4);
      }

      // ════════════════════════════════════════════════════════════════════
      // ▌ III. TRANSFERÊNCIAS
      // ════════════════════════════════════════════════════════════════════
      if (journey.transfers.length > 0) {
        for (let ti = 0; ti < journey.transfers.length; ti++) {
          const t = journey.transfers[ti];
          const ts = trSC[t.status] ?? trSC.pendente;
          sectionHdr(`III.  Transferência${journey.transfers.length > 1 ? ` #${ti + 1}` : ""}  entre Pátios`, C.purple);
          pill(ts.label, ts.fg, ts.bg);
          subLbl("Dados da Transferência", C.purple);
          DR("Pátio de Origem",  t.originYard?.name ? `${t.originYard.name}${t.originYard.city ? ` – ${t.originYard.city}` : ""}` : null);
          DR("Pátio de Destino", t.destinationYard?.name ? `${t.destinationYard.name}${t.destinationYard.city ? ` – ${t.destinationYard.city}` : ""}` : null);
          DR("Motorista",        t.driver?.name);
          DR("Telefone",         t.driver?.phone);
          DR("Registrado em",    fmtDate(t.createdAt));
          {
            const d = transferDistMap.get(t.id);
            const km = fmtKm(d?.distanceKm);
            if (km) {
              const src = sourceLabel(d?.source);
              DR("Distância (Pátio→Pátio)", src ? `${km} (${src})` : km);
            }
          }
          noteBlk("Observações", t.notes);
          gap(4);
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // ▌ IV. TRANSPORTE(S)
      // ════════════════════════════════════════════════════════════════════
      const tSectRoman = journey.transfers.length > 0 ? "IV." : "IV.";
      for (let ti = 0; ti < journey.transports.length; ti++) {
        const t = journey.transports[ti];
        const ts = tSC[t.status] ?? tSC.pendente;

        sectionHdr(
          `${tSectRoman}  Transporte${journey.transports.length > 1 ? ` #${ti + 1}` : ""}${t.requestNumber ? `  —  ${t.requestNumber}` : ""}`,
          C.blue
        );
        pill(ts.label, ts.fg, ts.bg);

        subLbl("Dados do Transporte", C.blue);
        DR("Número do Pedido",   t.requestNumber);
        DR("Motorista",          t.driver?.name);
        DR("Telefone",           t.driver?.phone);
        DR("CNH",                t.driver?.cnhType);
        DR("Cliente",            t.client?.name);
        DR("Pátio de Origem",    t.originYard?.name ? `${t.originYard.name}${t.originYard.city ? ` – ${t.originYard.city}` : ""}` : null);
        DR("Local de Entrega",   t.deliveryLocation?.name);
        DR("Cidade / Estado",    [t.deliveryLocation?.city, t.deliveryLocation?.state].filter(Boolean).join(" – ") || null);
        DR("Endereço",           t.deliveryLocation?.address ? [t.deliveryLocation.address, t.deliveryLocation.addressNumber].filter(Boolean).join(", ") : null);

        // Mapa do Local de Entrega
        if (t.deliveryLocation?.latitude && t.deliveryLocation?.longitude) {
          gap(2);
          await mapBlock(
            "Local de Entrega",
            parseFloat(t.deliveryLocation.latitude),
            parseFloat(t.deliveryLocation.longitude),
            C.green,
            "green",
          );
        }

        {
          const dT = transportDistMap.get(t.id);
          const realKm = fmtKm(dT?.realizedKm);
          if (t.routeDistanceKm || t.routeDurationMinutes || realKm) {
            gap(2); subLbl("Informações da Rota", C.blue);
            DR("Distância Planejada", t.routeDistanceKm ? `${parseFloat(String(t.routeDistanceKm)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : null);
            if (realKm) {
              const src = sourceLabel(dT?.source);
              DR("Distância Realizada", src ? `${realKm} (${src})` : realKm);
            }
            DR("Duração Estimada", t.routeDurationMinutes ? `${Math.floor(t.routeDurationMinutes / 60)}h ${t.routeDurationMinutes % 60}min` : null);
          }
        }

        if (t.checkinDateTime || t.checkinSelfiePhoto || t.checkinFrontalPhoto) {
          gap(2); subLbl("Check-in  —  Saída do Pátio (Pré-carregamento)", C.blue);
          DR("Data / Hora", fmtDate(t.checkinDateTime));
          DR("Partida",     fmtDate(t.transitStartedAt));
          DR("GPS Check-in", t.checkinLocation ? `${t.checkinLocation.coordinates[1].toFixed(5)}, ${t.checkinLocation.coordinates[0].toFixed(5)}` : null);
          if (t.checkinLocation?.coordinates) {
            gap(2);
            await mapBlock(
              "Local do Check-in (Saída do Pátio)",
              t.checkinLocation.coordinates[1],
              t.checkinLocation.coordinates[0],
              C.blue,
              "blue",
            );
          }
          noteBlk("Observações do Check-in", t.checkinNotes);

          const tCiPhotos = [
            { label: "Selfie", url: t.checkinSelfiePhoto },
            { label: "Frontal", url: t.checkinFrontalPhoto },
            { label: "Lateral Direita", url: t.checkinLateral1Photo },
            { label: "Lateral Esquerda", url: t.checkinLateral2Photo },
            { label: "Traseira", url: t.checkinTraseiraPhoto },
            { label: "Odômetro", url: t.checkinOdometerPhoto },
            { label: "Combustível", url: t.checkinFuelLevelPhoto },
            ...(t.checkinDamagePhotos ?? []).map((url, di) => ({ label: `Avaria ${di + 1}`, url })),
          ];
          await photoGrid(tCiPhotos, "Check-in (Saída do Pátio)", C.blue);
        }

        if (t.checkoutDateTime || t.checkoutSelfiePhoto || t.checkoutFrontalPhoto) {
          gap(2); subLbl("Checkout  —  Entrega ao Cliente", C.green);
          DR("Data / Hora da Entrega", fmtDate(t.checkoutDateTime));
          DR("GPS Checkout",           t.checkoutLocation ? `${t.checkoutLocation.coordinates[1].toFixed(5)}, ${t.checkoutLocation.coordinates[0].toFixed(5)}` : null);
          if (t.checkoutLocation?.coordinates) {
            gap(2);
            await mapBlock(
              "Local do Checkout (Entrega ao Cliente)",
              t.checkoutLocation.coordinates[1],
              t.checkoutLocation.coordinates[0],
              C.green,
              "green",
            );
          }
          noteBlk("Observações da Entrega", t.checkoutNotes);

          const tCoPhotos = [
            { label: "Selfie", url: t.checkoutSelfiePhoto },
            { label: "Frontal", url: t.checkoutFrontalPhoto },
            { label: "Lateral Direita", url: t.checkoutLateral1Photo },
            { label: "Lateral Esquerda", url: t.checkoutLateral2Photo },
            { label: "Traseira", url: t.checkoutTraseiraPhoto },
            { label: "Odômetro", url: t.checkoutOdometerPhoto },
            { label: "Combustível", url: t.checkoutFuelLevelPhoto },
            ...(t.checkoutDamagePhotos ?? []).map((url, di) => ({ label: `Avaria ${di + 1}`, url })),
          ];
          await photoGrid(tCoPhotos, "Checkout / Entrega ao Cliente", C.green);
        }

        // Delivery confirmation — mirrors the green banner in the web
        if (t.status === "entregue") {
          pb(13);
          doc.setFillColor(...C.greenBg); doc.setDrawColor(...C.green); doc.setLineWidth(0.4);
          doc.roundedRect(M, y, CW, 11, 2, 2, "FD");
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.green);
          doc.text("✓  Veículo entregue com sucesso ao cliente", M + CW / 2, y + 7.5, { align: "center" });
          y += 14;
        }
        if (t.status === "cancelado") {
          pb(13);
          doc.setFillColor(...C.redBg); doc.setDrawColor(...C.red); doc.setLineWidth(0.4);
          doc.roundedRect(M, y, CW, 11, 2, 2, "FD");
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...C.red);
          doc.text("✕  Transporte cancelado", M + CW / 2, y + 7.5, { align: "center" });
          y += 14;
        }

        gap(5);
      }

      drawFooter();
      doc.save(`historico-chassi-${v.chassi}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setPdfGenerating(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Jornada do Veículo"
        breadcrumbs={[{ label: "Relatórios" }, { label: "Jornada do Veículo" }]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">

        {/* ── Tab switcher (only when no chassi selected) ── */}
        {!selectedChassi && (
          <div className="mb-4">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
              {([
                { key: "transports", label: "Transportes",  icon: Truck, count: transportsList?.length },
                { key: "vehicles",   label: "Por Veículo",  icon: Car,   count: vehiclesList?.length },
              ] as const).map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                    activeTab === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`tab-${key}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count !== undefined && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Vehicle Selector ── */}
        {!selectedChassi && activeTab === "vehicles" ? (
          <div>

            {/* ── Toolbar: search + filters ── */}
            <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  placeholder="Buscar por chassi, montadora ou cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 bg-card border-border rounded-xl focus-visible:ring-primary/30"
                  data-testid="input-vehicle-search"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {vehiclesList && [
                  { key: "todos",            label: "Todos",         count: vehiclesList.length },
                  { key: "pre_estoque",      label: "Pré-estoque",   count: vehiclesList.filter(v => v.status === "pre_estoque").length },
                  { key: "em_estoque",       label: "Em Estoque",    count: vehiclesList.filter(v => v.status === "em_estoque").length },
                  { key: "em_transferencia", label: "Transferência", count: vehiclesList.filter(v => v.status === "em_transferencia").length },
                  { key: "despachado",       label: "Despachado",    count: vehiclesList.filter(v => v.status === "despachado").length },
                  { key: "entregue",         label: "Entregue",      count: vehiclesList.filter(v => v.status === "entregue").length },
                ].filter(f => f.key === "todos" || f.count > 0).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    data-testid={`filter-status-${f.key}`}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
                      statusFilter === f.key
                        ? "bg-primary text-white border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {f.label} <span className="ml-0.5 opacity-70">{f.count}</span>
                  </button>
                ))}
                {(search || statusFilter !== "todos") && (
                  <button
                    onClick={() => { setSearch(""); setStatusFilter("todos"); }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-dashed border-border/60 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />Limpar
                  </button>
                )}
              </div>
            </div>

            {/* ── Vehicle list (Table padrão) ── */}
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chassi</TableHead>
                    <TableHead className="hidden sm:table-cell">Fabricante</TableHead>
                    <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!vehiclesList ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {[1,2,3,4,5].map(c => (
                          <TableCell key={c}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Car className="h-8 w-8 opacity-20" />
                          <p className="font-semibold text-foreground text-sm">Nenhum veículo encontrado</p>
                          <p className="text-xs">Tente outro termo ou remova os filtros</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVehicles.slice(0, 60).map((vItem) => {
                      const cfg = vehicleStatusConfig[vItem.status];
                      return (
                        <TableRow
                          key={vItem.chassi}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => { setSelectedChassi(vItem.chassi); setSearch(""); setStatusFilter("todos"); }}
                          data-testid={`option-vehicle-${vItem.chassi}`}
                        >
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-foreground">{vItem.chassi}</span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {vItem.manufacturer?.name ?? "—"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {vItem.client?.name ?? <span className="text-muted-foreground/50 italic text-xs">Sem cliente</span>}
                          </TableCell>
                          <TableCell>
                            {cfg && (
                              <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap", cfg.color, cfg.bg, cfg.border)}>
                                {cfg.label}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {vehiclesList && (
                <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {filteredVehicles.length > 60 ? `Exibindo 60 de ${filteredVehicles.length}` : `${filteredVehicles.length}`} veículo{filteredVehicles.length !== 1 ? "s" : ""}
                    {(search || statusFilter !== "todos") && " encontrados"}
                  </p>
                  {filteredVehicles.length > 60 && (
                    <p className="text-[11px] text-muted-foreground italic">Refine a busca para ver mais</p>
                  )}
                </div>
              )}
            </div>
          </div>

        ) : !selectedChassi && activeTab === "transports" ? (
          <div>

            {/* Search + filter row */}
            <div className="mb-4 flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                  placeholder="Buscar por pedido, chassi, motorista, cliente..."
                  value={transportSearch}
                  onChange={(e) => setTransportSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-card border-border focus-visible:ring-primary/30"
                  data-testid="input-transport-search"
                />
                {transportSearch && (
                  <button onClick={() => setTransportSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Status filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {[
                  { key: "todos",            label: "Todos" },
                  { key: "pendente",         label: "Pendente" },
                  { key: "aguardando_saida", label: "Ag. Saída" },
                  { key: "em_transito",      label: "Em Trânsito" },
                  { key: "entregue",         label: "Entregue" },
                  { key: "cancelado",        label: "Cancelado" },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setTransportStatusFilter(f.key)}
                    className={cn(
                      "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
                      transportStatusFilter === f.key
                        ? "bg-primary text-white border-primary"
                        : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transport table */}
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chassi</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Data Coleta</TableHead>
                    <TableHead className="hidden md:table-cell">Data Transporte</TableHead>
                    <TableHead className="hidden lg:table-cell">Data Conclusão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!transportsList ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {[1,2,3,4,5,6,7].map(c => (
                          <TableCell key={c}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredTransports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Truck className="h-8 w-8 opacity-20" />
                          <p className="font-semibold text-foreground text-sm">Nenhum transporte encontrado</p>
                          <p className="text-xs">Tente outro termo ou remova os filtros</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransports.map((t) => {
                      const sc = transportStatusConfig[t.status];
                      const dataTransporte = t.transitStartedAt ?? t.checkinDateTime ?? t.scheduledDeparture;
                      return (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => { if (t.vehicleChassi) setSelectedChassi(t.vehicleChassi); }}
                          data-testid={`row-transport-${t.id}`}
                        >
                          {/* Chassi */}
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {t.vehicleChassi ?? "—"}
                            </span>
                          </TableCell>

                          {/* Cliente */}
                          <TableCell>
                            <span className="text-sm">{t.client?.name ?? "—"}</span>
                          </TableCell>

                          {/* Data Coleta */}
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {t.collectDate ? fmtDate(t.collectDate) : "—"}
                          </TableCell>

                          {/* Data Transporte (início) */}
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {dataTransporte ? fmtDate(dataTransporte) : "—"}
                          </TableCell>

                          {/* Data Conclusão */}
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {t.checkoutDateTime ? fmtDate(t.checkoutDateTime) : "—"}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            {sc && (
                              <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap", sc.color)}>
                                {sc.label}
                              </span>
                            )}
                          </TableCell>

                          {/* Ações */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); if (t.vehicleChassi) setSelectedChassi(t.vehicleChassi); }}
                                disabled={!t.vehicleChassi}
                                title="Ver Jornada"
                                data-testid={`btn-view-journey-${t.id}`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); if (t.vehicleChassi) { pendingPdfRef.current = true; setSelectedChassi(t.vehicleChassi); } }}
                                disabled={!t.vehicleChassi || pdfGenerating}
                                title="Exportar PDF"
                                data-testid={`btn-pdf-${t.id}`}
                              >
                                {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Footer */}
              {transportsList && (
                <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {filteredTransports.length} transporte{filteredTransports.length !== 1 ? "s" : ""}
                    {(transportSearch || transportStatusFilter !== "todos") && " encontrados"}
                  </p>
                  {(transportSearch || transportStatusFilter !== "todos") && (
                    <button
                      onClick={() => { setTransportSearch(""); setTransportStatusFilter("todos"); }}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">

            {/* ── Report Header ── */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">

              {/* Top gradient band — identity bar */}
              <div className="relative overflow-hidden bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border-b">
                <div className="absolute right-0 top-0 h-full w-48 bg-gradient-to-l from-primary/5 to-transparent" />
                <div className="relative flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Histórico Completo do Chassi — OTD Logistics
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline" size="sm"
                      onClick={handlePrint}
                      disabled={pdfGenerating || isLoading}
                      data-testid="button-print-dossie"
                      className="h-8 gap-1.5 text-xs font-semibold"
                    >
                      {pdfGenerating
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Printer className="h-3.5 w-3.5" />}
                      {pdfGenerating ? "Gerando..." : "Exportar PDF"}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setSelectedChassi(null)}
                      data-testid="button-change-vehicle"
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Trocar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Vehicle identity section */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Hash className="h-2.5 w-2.5" />Número do Chassi
                    </p>
                    <p className="font-mono text-3xl font-black tracking-wider leading-none" data-testid="text-chassi">
                      {v?.chassi ?? <span className="text-muted-foreground">...</span>}
                    </p>
                  </div>
                  {vCfg && (
                    <span
                      className={cn("text-sm font-semibold px-4 py-1.5 rounded-full border mt-1", vCfg.color, vCfg.bg, vCfg.border)}
                      data-testid="badge-status"
                    >
                      {vCfg.label}
                    </span>
                  )}
                </div>

                {/* Vehicle detail fields */}
                {!isLoading && v && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t border-dashed">
                    {[
                      { label: "Montadora",  value: v.manufacturer?.name, icon: Factory },
                      { label: "Cliente",    value: v.client?.name,       icon: Building2 },
                      { label: "Cor",        value: v.color,              icon: Car },
                      { label: "Pátio Atual", value: v.yard ? `${v.yard.name}${v.yard.city ? ` – ${v.yard.city}` : ""}` : undefined, icon: Warehouse },
                    ].map(({ label, value, icon: Icon }) => value ? (
                      <div key={label} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
                          <Icon className="h-2.5 w-2.5" />{label}
                        </p>
                        <p className="text-sm font-semibold truncate">{value}</p>
                      </div>
                    ) : null)}
                  </div>
                )}

                {isLoading && (
                  <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t border-dashed">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 rounded-md" />)}
                  </div>
                )}
              </div>

              {/* Stats row */}
              {!isLoading && journey && (
                <div className="grid grid-cols-4 border-t bg-muted/20">
                  {[
                    { label: "Coleta(s)",       value: journey.collects.length,   icon: Package,   color: "text-amber-600" },
                    { label: "Transporte(s)",   value: journey.transports.length, icon: Truck,     color: "text-blue-600" },
                    { label: "Transferência(s)",value: journey.transfers.length,  icon: Route,     color: "text-purple-600" },
                    {
                      label: "Distância Total",
                      value: (() => {
                        // Prefer the per-segment realized total from the
                        // distances endpoint (covers coleta + transferência +
                        // transporte). Fall back to planned transport km.
                        const total = journeyDistances?.totals?.totalRealizedKm
                          ?? journey.transports.reduce((s, t) => s + (parseFloat(String(t.routeDistanceKm ?? 0)) || 0), 0);
                        return total > 0 ? total.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";
                      })(),
                      unit:  ((journeyDistances?.totals?.totalRealizedKm ?? 0) > 0
                              || journey.transports.some(t => t.routeDistanceKm)) ? " km" : "",
                      icon:  Gauge,
                      color: "text-green-600",
                    },
                  ].map(({ label, value, unit, icon: Icon, color }, i, arr) => (
                    <div key={label} className={cn("px-4 py-3.5 text-center", i < arr.length - 1 && "border-r")}>
                      <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />
                      <p className="text-xl font-black tabular-nums">{value}{unit}</p>
                      <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
              </div>
            )}

            {!isLoading && journey && (<>

              {/* ── I. Timeline Overview ── */}
              <SectionBlock title="I. Linha do Tempo" icon={Clock} accent="bg-primary/10 text-primary">
                <div className="px-5 py-4">
                  {[
                    {
                      icon: Package, label: "Coleta na Montadora",
                      sublabel: journey.collects[0]?.manufacturer?.name,
                      time: (journey.collects[0]?.checkinDateTime ?? journey.collects[0]?.collectDate)
                        ? fmtDate(journey.collects[0].checkinDateTime ?? journey.collects[0].collectDate)
                        : undefined,
                      done: journey.collects.length > 0,
                      active: journey.collects.length > 0 && currentStep === 0,
                    },
                    {
                      icon: ShieldCheck, label: "Autorização de Entrada (Portaria)",
                      sublabel: journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy
                        ? `Aprovado por ${((journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy?.firstName || "") + " " + (journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy?.lastName || "")).trim() || journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy?.username}`
                        : undefined,
                      time: journey.collects.find(c => c.checkoutDateTime)?.checkoutDateTime
                        ? fmtDate(journey.collects.find(c => c.checkoutDateTime)!.checkoutDateTime)
                        : undefined,
                      done: journey.collects.some(c => c.status === "autorizado_portaria" || c.status === "finalizada"),
                      active: false,
                    },
                    {
                      icon: Warehouse, label: "Permanência no Pátio",
                      sublabel: v?.yard?.name,
                      time: v?.yardEntryDateTime ? fmtDate(v.yardEntryDateTime) : undefined,
                      done: currentStep >= 1,
                      active: currentStep === 1,
                    },
                    ...(journey.transfers.length > 0 ? [{
                      icon: ArrowLeftRight, label: `Transferência(s) entre Pátios (${journey.transfers.length})`,
                      sublabel: journey.transfers.map(t => `${t.originYard?.name ?? "?"} → ${t.destinationYard?.name ?? "?"}`).join("; "),
                      time: undefined as string | undefined,
                      done: journey.transfers.some(t => t.status === "concluida"),
                      active: journey.transfers.some(t => t.status === "em_transito" || t.status === "autorizada"),
                    }] : []),
                    {
                      icon: Truck, label: `Transporte(s) (${journey.transports.length})`,
                      sublabel: journey.transports[0]?.requestNumber ?? undefined,
                      time: journey.transports[0]?.checkinDateTime
                        ? fmtDate(journey.transports[0].checkinDateTime) : undefined,
                      done: journey.transports.some(t => t.status === "entregue"),
                      active: journey.transports.some(t => t.status === "em_transito" || t.status === "aguardando_saida"),
                    },
                    {
                      icon: Flag, label: "Entrega Final ao Cliente",
                      sublabel: journey.transports.find(t => t.status === "entregue")?.client?.name,
                      time: journey.transports.find(t => t.status === "entregue")?.checkoutDateTime
                        ? fmtDate(journey.transports.find(t => t.status === "entregue")!.checkoutDateTime)
                        : undefined,
                      done: journey.transports.some(t => t.status === "entregue"),
                      active: false,
                    },
                  ].map((ev, i, arr) => (
                    <TimelineEvent key={i} step={i} {...ev} last={i === arr.length - 1} color="primary" />
                  ))}
                </div>
              </SectionBlock>

              {/* ── II. Coletas ── */}
              {journey.collects.map((c, idx) => {
                const cfg = collectStatusConfig[c.status] ?? { label: c.status, color: "text-gray-700 bg-gray-50 border-gray-200" };
                const checkinPhotos = [
                  { label: "Selfie", url: c.checkinSelfiePhoto },
                  { label: "Frontal", url: c.checkinFrontalPhoto },
                  { label: "Lateral 1", url: c.checkinLateral1Photo },
                  { label: "Lateral 2", url: c.checkinLateral2Photo },
                  { label: "Traseira", url: c.checkinTraseiraPhoto },
                  { label: "Odômetro", url: c.checkinOdometerPhoto },
                  { label: "Combustível", url: c.checkinFuelLevelPhoto },
                  ...(c.checkinDamagePhotos ?? []).map((url, i) => ({ label: `Avaria ${i+1}`, url })),
                ];
                return (
                  <SectionBlock
                    key={c.id}
                    title={`II. Coleta${journey.collects.length > 1 ? ` #${idx+1}` : ""} na Montadora`}
                    icon={Package}
                    accent="bg-amber-100 text-amber-700"
                    data-testid={`section-coleta-${idx}`}
                  >
                    {/* Status bar */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b">
                      <StatusBadgeInline cfg={cfg} />
                      {(c.checkinDateTime ?? c.collectDate) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{fmtDate(c.checkinDateTime ?? c.collectDate)}
                        </span>
                      )}
                    </div>

                    {/* Data */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dados da Coleta</p>
                      <DataRow icon={Calendar} label="Data/Hora" value={fmtDate(c.checkinDateTime ?? c.collectDate)} />
                      <DataRow icon={User} label="Motorista" value={c.driver?.name} />
                      {c.driver?.phone && <DataRow icon={Phone} label="Telefone" value={c.driver.phone} />}
                      <DataRow icon={Factory} label="Montadora (Origem)" value={c.manufacturer?.name ? `${c.manufacturer.name}${c.manufacturer.city ? ` – ${c.manufacturer.city}` : ""}` : undefined} />
                      <DataRow icon={Warehouse} label="Pátio de Destino" value={c.yard?.name ? `${c.yard.name}${c.yard.city ? ` – ${c.yard.city}` : ""}` : undefined} />
                      {(() => {
                        const d = collectDistMap.get(c.id);
                        const km = fmtKm(d?.distanceKm);
                        if (!km) return null;
                        const src = sourceLabel(d?.source);
                        return <DataRow icon={Gauge} label="Distância Realizada" value={src ? `${km} (${src})` : km} />;
                      })()}
                      {c.notes && <DataRow icon={FileText} label="Observações" value={c.notes} />}
                    </div>

                    {/* Check-in */}
                    {(c.checkinDateTime || c.checkinNotes || checkinPhotos.some(p => p.url)) && (
                      <>
                        <Separator />
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            Check-in do Motorista (saída da montadora)
                          </p>
                          {c.checkinDateTime && <DataRow icon={Clock} label="Data/Hora" value={fmtDate(c.checkinDateTime)} />}
                          {c.checkinLocation && (
                            <>
                              <DataRow icon={MapPin} label="Localização GPS"
                                value={`${c.checkinLocation.coordinates[1].toFixed(5)}, ${c.checkinLocation.coordinates[0].toFixed(5)}`}
                                href={`https://maps.google.com/?q=${c.checkinLocation.coordinates[1]},${c.checkinLocation.coordinates[0]}`} />
                              <LocationMap
                                lat={c.checkinLocation.coordinates[1]}
                                lng={c.checkinLocation.coordinates[0]}
                                apiKey={mapsApiKeyData?.apiKey}
                                label="Local do Check-in (saída da montadora)"
                                testId={`map-collect-checkin-${c.id}`}
                              />
                            </>
                          )}
                          {c.checkinNotes && <DataRow icon={FileText} label="Observações" value={c.checkinNotes} />}
                        </div>
                        <PhotoGrid photos={checkinPhotos} title="Fotos do Check-in" />
                      </>
                    )}

                    {/* Portaria authorization */}
                    {(c.checkoutDateTime || c.checkoutApprovedBy) && (
                      <>
                        <Separator />
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Autorização de Entrada — Portaria
                          </p>
                          {c.checkoutDateTime && <DataRow icon={Clock} label="Data/Hora" value={fmtDate(c.checkoutDateTime)} />}
                          {c.checkoutApprovedBy && (
                            <DataRow icon={User} label="Autorizado por"
                              value={`${(c.checkoutApprovedBy.firstName || "")} ${(c.checkoutApprovedBy.lastName || "")}`.trim() || c.checkoutApprovedBy.username} />
                          )}
                          {c.checkoutNotes && <DataRow icon={FileText} label="Observações" value={c.checkoutNotes} />}
                        </div>
                      </>
                    )}
                  </SectionBlock>
                );
              })}

              {/* ── Mapa — Local de Entrega ── */}
              {(() => {
                const delivLoc = journey.transports.find(t => t.deliveryLocation?.latitude && t.deliveryLocation?.longitude)?.deliveryLocation;
                if (!delivLoc?.latitude || !delivLoc?.longitude) return null;
                const lat = parseFloat(delivLoc.latitude);
                const lng = parseFloat(delivLoc.longitude);
                const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
                const staticMapUrl = mapsApiKeyData?.apiKey
                  ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=640x280&scale=2&markers=color:red%7C${lat},${lng}&key=${mapsApiKeyData.apiKey}`
                  : null;
                return (
                  <SectionBlock title="Local de Entrega do Veículo" icon={MapPin} accent="bg-green-100 text-green-700">
                    <div className="px-4 py-3 space-y-3">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold">{delivLoc.name}</p>
                        {(delivLoc.city || delivLoc.state) && (
                          <p className="text-xs text-muted-foreground">{[delivLoc.city, delivLoc.state].filter(Boolean).join(" / ")}</p>
                        )}
                        {delivLoc.address && (
                          <p className="text-xs text-muted-foreground">{[delivLoc.address, delivLoc.addressNumber].filter(Boolean).join(", ")}</p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{lat}, {lng}</p>
                      </div>
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-md border border-border hover:opacity-90 transition-opacity"
                        title="Abrir no Google Maps"
                        data-testid="link-delivery-location-map"
                      >
                        {staticMapUrl ? (
                          <img
                            src={staticMapUrl}
                            alt={`Mapa — ${delivLoc.name}`}
                            className="w-full h-48 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-48 bg-muted flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            Ver no Google Maps ({lat}, {lng})
                          </div>
                        )}
                      </a>
                    </div>
                  </SectionBlock>
                );
              })()}

              {/* ── III. Transferências ── */}
              {journey.transfers.length > 0 && (
                <SectionBlock title={`III. Transferência(s) entre Pátios`} icon={ArrowLeftRight} accent="bg-purple-100 text-purple-700">
                  {journey.transfers.map((t, idx) => {
                    const cfg = transferStatusConfig[t.status] ?? { label: t.status, color: "text-gray-700 bg-gray-50 border-gray-200" };
                    return (
                      <div key={t.id} className={cn(idx > 0 && "border-t")}>
                        <div className="flex items-center gap-3 px-4 py-2 bg-muted/20">
                          {journey.transfers.length > 1 && (
                            <span className="text-xs font-mono font-bold text-muted-foreground">#{idx+1}</span>
                          )}
                          <StatusBadgeInline cfg={cfg} />
                          {t.createdAt && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />{fmtDate(t.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          <DataRow icon={Warehouse} label="Pátio de Origem" value={t.originYard?.name} />
                          <DataRow icon={ArrowRight} label="Pátio de Destino" value={t.destinationYard?.name} />
                          <DataRow icon={User} label="Motorista" value={t.driver?.name} />
                          {t.driver?.phone && <DataRow icon={Phone} label="Telefone" value={t.driver.phone} />}
                          {(() => {
                            const d = transferDistMap.get(t.id);
                            const km = fmtKm(d?.distanceKm);
                            if (!km) return null;
                            const src = sourceLabel(d?.source);
                            return <DataRow icon={Gauge} label="Distância (Pátio→Pátio)" value={src ? `${km} (${src})` : km} />;
                          })()}
                          {t.notes && <DataRow icon={FileText} label="Observações" value={t.notes} />}
                        </div>
                      </div>
                    );
                  })}
                </SectionBlock>
              )}

              {/* ── IV. Transportes ── */}
              {journey.transports.map((t, idx) => {
                const cfg = transportStatusConfig[t.status] ?? { label: t.status, color: "text-gray-700 bg-gray-50 border-gray-200" };
                const checkinPhotos = [
                  { label: "Selfie", url: t.checkinSelfiePhoto },
                  { label: "Frontal", url: t.checkinFrontalPhoto },
                  { label: "Lateral 1", url: t.checkinLateral1Photo },
                  { label: "Lateral 2", url: t.checkinLateral2Photo },
                  { label: "Traseira", url: t.checkinTraseiraPhoto },
                  { label: "Odômetro", url: t.checkinOdometerPhoto },
                  { label: "Combustível", url: t.checkinFuelLevelPhoto },
                  ...(t.checkinDamagePhotos ?? []).map((url, i) => ({ label: `Avaria ${i+1}`, url })),
                ];
                const checkoutPhotos = [
                  { label: "Selfie", url: t.checkoutSelfiePhoto },
                  { label: "Frontal", url: t.checkoutFrontalPhoto },
                  { label: "Lateral 1", url: t.checkoutLateral1Photo },
                  { label: "Lateral 2", url: t.checkoutLateral2Photo },
                  { label: "Traseira", url: t.checkoutTraseiraPhoto },
                  { label: "Odômetro", url: t.checkoutOdometerPhoto },
                  { label: "Combustível", url: t.checkoutFuelLevelPhoto },
                  ...(t.checkoutDamagePhotos ?? []).map((url, i) => ({ label: `Avaria ${i+1}`, url })),
                ];
                const sectionNum = journey.transfers.length > 0 ? "V" : "IV";
                return (
                  <SectionBlock
                    key={t.id}
                    title={`${sectionNum}. Transporte${journey.transports.length > 1 ? ` #${idx+1}` : ""} — ${t.requestNumber ?? "Sem pedido"}`}
                    icon={Truck}
                    accent="bg-blue-100 text-blue-700"
                    data-testid={`section-transport-${idx}`}
                  >
                    {/* Status */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b flex-wrap">
                      <StatusBadgeInline cfg={cfg} />
                      {t.requestNumber && (
                        <span className="text-xs font-mono font-semibold flex items-center gap-1 text-muted-foreground">
                          <Hash className="h-3 w-3" />{t.requestNumber}
                        </span>
                      )}
                      {t.scheduledDeparture && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />Prev. saída: {fmtDate(t.scheduledDeparture)}
                        </span>
                      )}
                    </div>

                    {/* Main data */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Dados do Transporte</p>
                      <DataRow icon={User} label="Motorista" value={t.driver?.name} />
                      {t.driver?.phone && <DataRow icon={Phone} label="Telefone" value={t.driver.phone} />}
                      <DataRow icon={Building2} label="Cliente" value={t.client?.name} />
                      <DataRow icon={Warehouse} label="Pátio de Origem" value={t.originYard?.name ? `${t.originYard.name}${t.originYard.city ? ` – ${t.originYard.city}` : ""}` : undefined} />
                      <DataRow icon={MapPin} label="Local de Entrega" value={t.deliveryLocation ? [t.deliveryLocation.name, t.deliveryLocation.city, t.deliveryLocation.state].filter(Boolean).join(", ") : undefined} />
                      {t.deliveryLocation?.address && (
                        <DataRow icon={MapPin} label="Endereço" value={[t.deliveryLocation.address, t.deliveryLocation.addressNumber].filter(Boolean).join(", ")} />
                      )}
                    </div>

                    {/* Route info */}
                    {(() => {
                      const d = transportDistMap.get(t.id);
                      const realKm = fmtKm(d?.realizedKm);
                      const hasAny = t.routeDistanceKm || t.routeDurationMinutes || realKm;
                      if (!hasAny) return null;
                      const src = sourceLabel(d?.source);
                      return (
                        <>
                          <Separator />
                          <div className="px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                              <Route className="h-3.5 w-3.5" />
                              Informações da Rota
                            </p>
                            {t.routeDistanceKm != null && <DataRow icon={Route} label="Distância Planejada" value={`${parseFloat(String(t.routeDistanceKm)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`} />}
                            {realKm && <DataRow icon={Gauge} label="Distância Realizada" value={src ? `${realKm} (${src})` : realKm} />}
                            {t.routeDurationMinutes != null && <DataRow icon={Clock} label="Duração Estimada" value={`${Math.floor(t.routeDurationMinutes/60)}h ${t.routeDurationMinutes%60}min`} />}
                          </div>
                        </>
                      );
                    })()}

                    {/* Check-in */}
                    {(t.checkinDateTime || checkinPhotos.some(p => p.url)) && (
                      <>
                        <Separator />
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                            Check-in (saída do pátio — pré-carregamento)
                          </p>
                          {t.checkinDateTime && <DataRow icon={Clock} label="Data/Hora" value={fmtDate(t.checkinDateTime)} />}
                          {t.transitStartedAt && <DataRow icon={Clock} label="Partida" value={fmtDate(t.transitStartedAt)} />}
                          {t.checkinLocation && (
                            <>
                              <DataRow icon={MapPin} label="Localização GPS"
                                value={`${t.checkinLocation.coordinates[1].toFixed(5)}, ${t.checkinLocation.coordinates[0].toFixed(5)}`}
                                href={`https://maps.google.com/?q=${t.checkinLocation.coordinates[1]},${t.checkinLocation.coordinates[0]}`} />
                              <LocationMap
                                lat={t.checkinLocation.coordinates[1]}
                                lng={t.checkinLocation.coordinates[0]}
                                apiKey={mapsApiKeyData?.apiKey}
                                label="Local do Check-in (saída do pátio)"
                                testId={`map-transport-checkin-${t.id}`}
                              />
                            </>
                          )}
                          {t.checkinNotes && <DataRow icon={FileText} label="Observações" value={t.checkinNotes} />}
                        </div>
                        <PhotoGrid photos={checkinPhotos} title="Fotos do Check-in" />
                      </>
                    )}

                    {/* Checkout */}
                    {(t.checkoutDateTime || checkoutPhotos.some(p => p.url)) && (
                      <>
                        <Separator />
                        <div className="px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                            <Flag className="h-3.5 w-3.5 text-green-600" />
                            Checkout — Entrega ao Cliente
                          </p>
                          {t.checkoutDateTime && <DataRow icon={Clock} label="Data/Hora" value={fmtDate(t.checkoutDateTime)} />}
                          {t.checkoutLocation && (
                            <>
                              <DataRow icon={MapPin} label="Localização GPS"
                                value={`${t.checkoutLocation.coordinates[1].toFixed(5)}, ${t.checkoutLocation.coordinates[0].toFixed(5)}`}
                                href={`https://maps.google.com/?q=${t.checkoutLocation.coordinates[1]},${t.checkoutLocation.coordinates[0]}`} />
                              <LocationMap
                                lat={t.checkoutLocation.coordinates[1]}
                                lng={t.checkoutLocation.coordinates[0]}
                                apiKey={mapsApiKeyData?.apiKey}
                                label="Local do Checkout (entrega ao cliente)"
                                testId={`map-transport-checkout-${t.id}`}
                              />
                            </>
                          )}
                          {t.checkoutNotes && <DataRow icon={FileText} label="Observações" value={t.checkoutNotes} />}
                        </div>
                        <PhotoGrid photos={checkoutPhotos} title="Fotos do Checkout / Entrega" />
                      </>
                    )}

                    {/* Delivery confirmation */}
                    {t.status === "entregue" && (
                      <div className="mx-4 mb-4 mt-2 flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-green-800 dark:text-green-300">Veículo entregue com sucesso</p>
                          {t.checkoutDateTime && (
                            <p className="text-xs text-green-700 dark:text-green-400">{fmtDate(t.checkoutDateTime)}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {t.status === "cancelado" && (
                      <div className="mx-4 mb-4 mt-2 flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3">
                        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Transporte cancelado</p>
                      </div>
                    )}
                  </SectionBlock>
                );
              })}

              {/* ── Empty state ── */}
              {journey.collects.length === 0 && journey.transports.length === 0 && journey.transfers.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Nenhum registro encontrado para este chassi</p>
                </div>
              )}

            </>)}
          </div>
        )}
      </div>

      {lightbox && (
        <Dialog open onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
            <img src={normalizeImageUrl(lightbox)} alt="Foto" className="w-full rounded-lg object-contain max-h-[85vh]" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
