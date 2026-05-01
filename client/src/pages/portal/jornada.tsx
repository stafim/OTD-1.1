import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "./layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Search, Truck, Package, CheckCircle2, Camera, MapPin, Clock, FileText,
  Gauge, ShieldCheck, ArrowLeftRight, Building2, Hash, ChevronDown, ChevronUp,
  Route, Warehouse, Car, Phone, ArrowRight, XCircle, Factory,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeImageUrl } from "@/lib/utils";
import { clientFetch } from "@/hooks/use-client-auth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleListItem = {
  chassi: string;
  status: string;
  color?: string | null;
  clientId?: string | null;
  yardName?: string | null;
  manufacturer?: { name: string } | null;
};

type VehicleJourney = {
  vehicle: {
    chassi: string;
    status: string;
    color?: string | null;
    manufacturer?: { id: string; name: string } | null;
    yard?: { id: string; name: string; city?: string | null } | null;
    client?: { id: string; name: string } | null;
  };
  collects: Array<{
    id: string;
    status: string;
    collectDate?: string | null;
    checkinDateTime?: string | null;
    checkoutDateTime?: string | null;
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
    manufacturer?: { id: string; name: string } | null;
    yard?: { id: string; name: string } | null;
    driver?: { id: string; name: string; phone?: string | null } | null;
    checkoutApprovedBy?: { firstName?: string | null; lastName?: string | null; username: string } | null;
  }>;
  transports: Array<{
    id: string;
    requestNumber?: string | null;
    status: string;
    routeDistanceKm?: number | null;
    checkinDateTime?: string | null;
    checkoutDateTime?: string | null;
    transitStartedAt?: string | null;
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
    originYard?: { id: string; name: string; city?: string | null } | null;
    deliveryLocation?: { id: string; name: string; city?: string | null; state?: string | null } | null;
    driver?: { id: string; name: string; phone?: string | null } | null;
  }>;
  transfers: Array<{
    id: string;
    status: string;
    notes?: string | null;
    createdAt?: string | null;
    originYard?: { id: string; name: string } | null;
    destinationYard?: { id: string; name: string } | null;
    driver?: { id: string; name: string; phone?: string | null } | null;
  }>;
};

// ─── Status configs ────────────────────────────────────────────────────────────

const vehicleStatusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pre_estoque:      { label: "Aguardando Coleta",  color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  em_estoque:       { label: "No Pátio",           color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  em_transferencia: { label: "Em Transferência",   color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  despachado:       { label: "Em Trânsito",        color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
  entregue:         { label: "Entregue",           color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  retirado:         { label: "Retirado",           color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
};

const collectStatusConfig: Record<string, { label: string; color: string }> = {
  em_transito:         { label: "Em Trânsito",            color: "text-amber-700 bg-amber-50 border-amber-200" },
  autorizado_portaria: { label: "Autorizado na Portaria", color: "text-blue-700 bg-blue-50 border-blue-200" },
  finalizada:          { label: "Finalizada",             color: "text-green-700 bg-green-50 border-green-200" },
};

const transportStatusConfig: Record<string, { label: string; color: string }> = {
  pendente:         { label: "Pendente",         color: "text-gray-700 bg-gray-50 border-gray-200" },
  aguardando_saida: { label: "Aguardando Saída", color: "text-amber-700 bg-amber-50 border-amber-200" },
  em_transito:      { label: "Em Trânsito",      color: "text-blue-700 bg-blue-50 border-blue-200" },
  entregue:         { label: "Entregue",         color: "text-green-700 bg-green-50 border-green-200" },
  cancelado:        { label: "Cancelado",        color: "text-red-700 bg-red-50 border-red-200" },
};

const transferStatusConfig: Record<string, { label: string; color: string }> = {
  pendente:    { label: "Pendente",    color: "text-amber-700 bg-amber-50 border-amber-200" },
  autorizada:  { label: "Autorizada", color: "text-blue-700 bg-blue-50 border-blue-200" },
  em_transito: { label: "Em Trânsito",color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  concluida:   { label: "Concluída",  color: "text-green-700 bg-green-50 border-green-200" },
  cancelada:   { label: "Cancelada",  color: "text-red-700 bg-red-50 border-red-200" },
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

function DataRow({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="w-40 shrink-0 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{value}</span>
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
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

function PhotoGrid({ photos }: { photos: { label: string; url?: string | null }[] }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const valid = photos.filter(p => p.url);
  if (valid.length === 0) return (
    <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground">
      <Camera className="h-3.5 w-3.5 opacity-40" />
      Nenhuma foto registrada
    </div>
  );
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
        <Camera className="h-3.5 w-3.5" />Fotos ({valid.length})
      </p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {valid.map(p => (
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

function TimelineEvent({ label, sublabel, time, icon: Icon, done, active, last }: {
  label: string; sublabel?: string; time?: string | null;
  icon: React.ElementType; done: boolean; active: boolean; last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0 z-10",
          done   && "border-green-500 bg-green-500 text-white",
          active && !done && "border-primary bg-primary text-primary-foreground",
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

export default function PortalJornadaPage() {
  const [selectedChassi, setSelectedChassi] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // List all client vehicles, filtered to "entregue"
  const { data: vehiclesList, isLoading: listLoading } = useQuery<VehicleListItem[]>({
    queryKey: ["/api/vehicles", "portal"],
    queryFn: () => clientFetch("/api/vehicles").then(r => r.json()),
  });

  const entregues = (vehiclesList ?? []).filter(v => v.status === "entregue");

  const filtered = entregues.filter(v => {
    const q = search.toLowerCase();
    return !q || v.chassi.toLowerCase().includes(q) || (v.manufacturer?.name ?? "").toLowerCase().includes(q);
  });

  // Journey for selected chassi
  const { data: journey, isLoading: journeyLoading } = useQuery<VehicleJourney>({
    queryKey: ["/api/vehicle-journey", selectedChassi, "portal"],
    queryFn: () =>
      clientFetch(`/api/vehicle-journey/${encodeURIComponent(selectedChassi!)}`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).message || "Erro");
        return r.json();
      }),
    enabled: !!selectedChassi,
    retry: false,
  });

  const v = journey?.vehicle;
  const vCfg = v ? (vehicleStatusConfig[v.status] ?? vehicleStatusConfig.pre_estoque) : null;
  const stepMap: Record<string, number> = {
    pre_estoque: 0, em_estoque: 1, em_transferencia: 2, despachado: 3, entregue: 4, retirado: 4,
  };
  const currentStep = v ? (stepMap[v.status] ?? 0) : 0;

  // ── Vehicle list view ──────────────────────────────────────────────────────
  if (!selectedChassi) {
    return (
      <PortalLayout>
        <div className="p-6 overflow-auto flex-1">
          <div className="flex items-center gap-3 mb-6">
            <Route className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Jornada do Veículo</h1>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              data-testid="input-search-chassi"
              className="pl-9"
              placeholder="Buscar chassi ou fabricante..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Veículos Entregues
              </p>
              {!listLoading && (
                <span className="text-xs text-muted-foreground">
                  {filtered.length} veículo{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {listLoading ? (
              <div className="divide-y">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <Route className="h-10 w-10 opacity-20" />
                <p className="font-semibold text-foreground text-sm">
                  {search ? "Nenhum veículo encontrado" : "Nenhum veículo entregue"}
                </p>
                {search && (
                  <p className="text-xs">
                    <button onClick={() => setSearch("")} className="text-primary underline">
                      Limpar busca
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map(vItem => {
                  const cfg = vehicleStatusConfig[vItem.status];
                  return (
                    <button
                      key={vItem.chassi}
                      data-testid={`row-vehicle-${vItem.chassi}`}
                      onClick={() => setSelectedChassi(vItem.chassi)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-bold text-foreground">{vItem.chassi}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {vItem.manufacturer?.name ?? "—"}
                          {vItem.yardName ? ` · ${vItem.yardName}` : ""}
                        </p>
                      </div>
                      {cfg && (
                        <span className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0",
                          cfg.color, cfg.bg, cfg.border
                        )}>
                          {cfg.label}
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PortalLayout>
    );
  }

  // ── Journey detail view ────────────────────────────────────────────────────
  return (
    <PortalLayout>
      <div className="p-6 overflow-auto flex-1">

        {journeyLoading && (
          <div className="space-y-3 max-w-4xl">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
          </div>
        )}

        {journey && !journeyLoading && (
          <div className="space-y-4 max-w-4xl">

            {/* ── Report Header ── */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">

              {/* Top identity bar */}
              <div className="relative overflow-hidden bg-gradient-to-r from-primary/8 via-primary/5 to-transparent border-b">
                <div className="absolute right-0 top-0 h-full w-48 bg-gradient-to-l from-primary/5 to-transparent" />
                <div className="relative flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Histórico Completo do Chassi — OTD Logistics
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setSelectedChassi(null)}
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    data-testid="button-back-list"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Voltar à lista
                  </Button>
                </div>
              </div>

              {/* Vehicle identity */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Hash className="h-2.5 w-2.5" />Número do Chassi
                    </p>
                    <p className="font-mono text-3xl font-black tracking-wider leading-none" data-testid="text-chassi">
                      {v?.chassi}
                    </p>
                  </div>
                  {vCfg && (
                    <span className={cn("text-sm font-semibold px-4 py-1.5 rounded-full border mt-1", vCfg.color, vCfg.bg, vCfg.border)}>
                      {vCfg.label}
                    </span>
                  )}
                </div>

                {v && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pt-4 border-t border-dashed">
                    {[
                      { label: "Montadora",   value: v.manufacturer?.name,  icon: Factory },
                      { label: "Cliente",     value: v.client?.name,        icon: Building2 },
                      { label: "Cor",         value: v.color,               icon: Car },
                      { label: "Pátio Atual", value: v.yard
                          ? `${v.yard.name}${v.yard.city ? ` – ${v.yard.city}` : ""}` : undefined,
                        icon: Warehouse },
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
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 border-t bg-muted/20">
                {[
                  { label: "Coleta(s)",        value: journey.collects.length,   icon: Package,        color: "text-amber-600" },
                  { label: "Transporte(s)",    value: journey.transports.length, icon: Truck,          color: "text-blue-600" },
                  { label: "Transferência(s)", value: journey.transfers.length,  icon: ArrowLeftRight, color: "text-purple-600" },
                  {
                    label: "Distância Total",
                    value: (() => {
                      const total = journey.transports.reduce((s, t) => s + (parseFloat(String(t.routeDistanceKm ?? 0)) || 0), 0);
                      return total > 0 ? total.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—";
                    })(),
                    unit: journey.transports.some(t => t.routeDistanceKm) ? " km" : "",
                    icon: Gauge,
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
            </div>

            {/* ── I. Linha do Tempo ── */}
            <SectionBlock title="I. Linha do Tempo" icon={Clock} accent="bg-primary/10 text-primary">
              <div className="px-5 py-4">
                {[
                  {
                    icon: Package, label: "Coleta na Montadora",
                    sublabel: journey.collects[0]?.manufacturer?.name,
                    time: journey.collects[0]?.checkinDateTime ?? journey.collects[0]?.collectDate
                      ? fmtDate(journey.collects[0].checkinDateTime ?? journey.collects[0].collectDate) : undefined,
                    done: journey.collects.length > 0,
                    active: journey.collects.length > 0 && currentStep === 0,
                  },
                  {
                    icon: ShieldCheck, label: "Autorização de Entrada (Portaria)",
                    sublabel: journey.collects.find(c => c.checkoutApprovedBy)
                      ? `Aprovado por ${(
                          (journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy?.firstName || "") +
                          " " +
                          (journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy?.lastName || "")
                        ).trim() || journey.collects.find(c => c.checkoutApprovedBy)?.checkoutApprovedBy?.username}`
                      : undefined,
                    time: journey.collects.find(c => c.checkoutDateTime)
                      ? fmtDate(journey.collects.find(c => c.checkoutDateTime)!.checkoutDateTime) : undefined,
                    done: journey.collects.some(c => c.status === "autorizado_portaria" || c.status === "finalizada"),
                    active: currentStep === 1,
                  },
                  {
                    icon: Warehouse, label: "Entrada no Pátio",
                    sublabel: v?.yard?.name,
                    time: undefined,
                    done: currentStep >= 1,
                    active: currentStep === 1,
                  },
                  {
                    icon: Truck, label: "Despacho para Entrega",
                    sublabel: journey.transports[0]?.originYard?.name,
                    time: journey.transports[0]?.transitStartedAt
                      ? fmtDate(journey.transports[0].transitStartedAt) : undefined,
                    done: currentStep >= 3,
                    active: currentStep === 3,
                  },
                  {
                    icon: MapPin, label: "Entrega ao Cliente",
                    sublabel: journey.transports[0]?.deliveryLocation?.name,
                    time: journey.transports[0]?.checkoutDateTime
                      ? fmtDate(journey.transports[0].checkoutDateTime) : undefined,
                    done: currentStep >= 4,
                    active: currentStep === 4,
                  },
                ].map((step, i, arr) => (
                  <TimelineEvent key={i} {...step} last={i === arr.length - 1} />
                ))}
              </div>
            </SectionBlock>

            {/* ── II. Coletas ── */}
            {journey.collects.length > 0 && (
              <SectionBlock
                title={`II. Coleta${journey.collects.length > 1 ? "s" : ""} (${journey.collects.length})`}
                icon={Package} accent="bg-amber-500/10 text-amber-600"
              >
                {journey.collects.map((c, idx) => {
                  const cfg = collectStatusConfig[c.status] ?? { label: c.status, color: "text-gray-700 bg-gray-50 border-gray-200" };
                  return (
                    <div key={c.id} className={cn("p-4", idx > 0 && "border-t")}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coleta #{idx + 1}</p>
                        <StatusBadgeInline cfg={cfg} />
                      </div>
                      <div className="divide-y divide-border/50">
                        <DataRow label="Montadora"     value={c.manufacturer?.name}        icon={Factory} />
                        <DataRow label="Pátio Destino" value={c.yard?.name}                 icon={Warehouse} />
                        <DataRow label="Motorista"     value={c.driver?.name}               icon={Truck} />
                        <DataRow label="Telefone"      value={c.driver?.phone}              icon={Phone} />
                        <DataRow label="Data Coleta"   value={fmtDate(c.collectDate)}       icon={Clock} />
                        <DataRow label="Check-in"      value={fmtDate(c.checkinDateTime)}   icon={CheckCircle2} />
                        <DataRow label="Portaria"      value={fmtDate(c.checkoutDateTime)}  icon={ShieldCheck} />
                        {c.checkinNotes && <DataRow label="Obs. Check-in" value={c.checkinNotes} />}
                        {c.checkoutNotes && <DataRow label="Obs. Portaria" value={c.checkoutNotes} />}
                      </div>
                      <div className="mt-3 border-t pt-3">
                        <PhotoGrid photos={[
                          { label: "Frontal",   url: c.checkinFrontalPhoto },
                          { label: "Lateral 1", url: c.checkinLateral1Photo },
                          { label: "Lateral 2", url: c.checkinLateral2Photo },
                          { label: "Traseira",  url: c.checkinTraseiraPhoto },
                          { label: "Hodômetro", url: c.checkinOdometerPhoto },
                          { label: "Comb.",     url: c.checkinFuelLevelPhoto },
                          { label: "Selfie",    url: c.checkinSelfiePhoto },
                          ...(c.checkinDamagePhotos ?? []).map((u, i) => ({ label: `Avaria ${i+1}`, url: u })),
                        ]} />
                      </div>
                    </div>
                  );
                })}
              </SectionBlock>
            )}

            {/* ── III. Transportes ── */}
            {journey.transports.length > 0 && (
              <SectionBlock
                title={`III. Transporte${journey.transports.length > 1 ? "s" : ""} (${journey.transports.length})`}
                icon={Truck} accent="bg-blue-500/10 text-blue-600"
              >
                {journey.transports.map((t, idx) => {
                  const cfg = transportStatusConfig[t.status] ?? { label: t.status, color: "text-gray-700 bg-gray-50 border-gray-200" };
                  return (
                    <div key={t.id} className={cn("p-4", idx > 0 && "border-t")}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                          {t.requestNumber ?? `Transporte #${idx + 1}`}
                        </p>
                        <StatusBadgeInline cfg={cfg} />
                      </div>
                      <div className="divide-y divide-border/50">
                        <DataRow label="Pátio Origem"    value={t.originYard?.name}          icon={Warehouse} />
                        <DataRow label="Destino"         value={t.deliveryLocation
                            ? `${t.deliveryLocation.name}${t.deliveryLocation.city ? ` – ${t.deliveryLocation.city}` : ""}`
                            : undefined}                                                      icon={MapPin} />
                        <DataRow label="Motorista"       value={t.driver?.name}              icon={Truck} />
                        <DataRow label="Telefone"        value={t.driver?.phone}             icon={Phone} />
                        <DataRow label="Início Trânsito" value={fmtDate(t.transitStartedAt)} icon={Clock} />
                        <DataRow label="Check-in"        value={fmtDate(t.checkinDateTime)}  icon={CheckCircle2} />
                        <DataRow label="Entrega"         value={fmtDate(t.checkoutDateTime)} icon={MapPin} />
                        {t.routeDistanceKm && (
                          <DataRow label="Distância" value={`${Number(t.routeDistanceKm).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`} icon={Gauge} />
                        )}
                        {t.checkinNotes && <DataRow label="Obs. Check-in" value={t.checkinNotes} />}
                        {t.checkoutNotes && <DataRow label="Obs. Entrega" value={t.checkoutNotes} />}
                      </div>

                      {(t.checkinFrontalPhoto || t.checkinLateral1Photo || t.checkinLateral2Photo ||
                        t.checkinTraseiraPhoto || t.checkinOdometerPhoto || t.checkinFuelLevelPhoto ||
                        t.checkinSelfiePhoto || (t.checkinDamagePhotos?.length ?? 0) > 0) && (
                        <div className="mt-3 border-t pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fotos — Check-in</p>
                          <PhotoGrid photos={[
                            { label: "Frontal",   url: t.checkinFrontalPhoto },
                            { label: "Lateral 1", url: t.checkinLateral1Photo },
                            { label: "Lateral 2", url: t.checkinLateral2Photo },
                            { label: "Traseira",  url: t.checkinTraseiraPhoto },
                            { label: "Hodômetro", url: t.checkinOdometerPhoto },
                            { label: "Comb.",     url: t.checkinFuelLevelPhoto },
                            { label: "Selfie",    url: t.checkinSelfiePhoto },
                            ...(t.checkinDamagePhotos ?? []).map((u, i) => ({ label: `Avaria ${i+1}`, url: u })),
                          ]} />
                        </div>
                      )}

                      {(t.checkoutFrontalPhoto || t.checkoutLateral1Photo || t.checkoutLateral2Photo ||
                        t.checkoutTraseiraPhoto || t.checkoutOdometerPhoto || t.checkoutFuelLevelPhoto ||
                        t.checkoutSelfiePhoto || (t.checkoutDamagePhotos?.length ?? 0) > 0) && (
                        <div className="mt-3 border-t pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Fotos — Entrega</p>
                          <PhotoGrid photos={[
                            { label: "Frontal",   url: t.checkoutFrontalPhoto },
                            { label: "Lateral 1", url: t.checkoutLateral1Photo },
                            { label: "Lateral 2", url: t.checkoutLateral2Photo },
                            { label: "Traseira",  url: t.checkoutTraseiraPhoto },
                            { label: "Hodômetro", url: t.checkoutOdometerPhoto },
                            { label: "Comb.",     url: t.checkoutFuelLevelPhoto },
                            { label: "Selfie",    url: t.checkoutSelfiePhoto },
                            ...(t.checkoutDamagePhotos ?? []).map((u, i) => ({ label: `Avaria ${i+1}`, url: u })),
                          ]} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </SectionBlock>
            )}

            {/* ── IV. Transferências ── */}
            {journey.transfers.length > 0 && (
              <SectionBlock
                title={`IV. Transferência${journey.transfers.length > 1 ? "s" : ""} (${journey.transfers.length})`}
                icon={ArrowLeftRight} accent="bg-purple-500/10 text-purple-600"
                defaultOpen={false}
              >
                {journey.transfers.map((tr, idx) => {
                  const cfg = transferStatusConfig[tr.status] ?? { label: tr.status, color: "text-gray-700 bg-gray-50 border-gray-200" };
                  return (
                    <div key={tr.id} className={cn("p-4", idx > 0 && "border-t")}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transferência #{idx + 1}</p>
                        <StatusBadgeInline cfg={cfg} />
                      </div>
                      <div className="divide-y divide-border/50">
                        <DataRow label="Origem"    value={tr.originYard?.name}      icon={Warehouse} />
                        <DataRow label="Destino"   value={tr.destinationYard?.name} icon={MapPin} />
                        <DataRow label="Motorista" value={tr.driver?.name}          icon={Truck} />
                        <DataRow label="Data"      value={fmtDate(tr.createdAt)}    icon={Clock} />
                        {tr.notes && <DataRow label="Obs." value={tr.notes} />}
                      </div>
                    </div>
                  );
                })}
              </SectionBlock>
            )}

          </div>
        )}
      </div>
    </PortalLayout>
  );
}
