import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  User,
  Truck,
  MapPin,
  Star,
  StarOff,
  AlertTriangle,
  FileText,
  Calendar,
  Clock,
  Route,
  TrendingUp,
  ChevronsUpDown,
  Check,
  Search,
  ShieldCheck,
  ShieldAlert,
  Shield,
  CheckCircle2,
  Activity,
  Printer,
  ClipboardList,
  Smartphone,
  Phone,
  Mail,
  Contact,
  Building2,
  Award,
  Hash,
  Navigation,
  Info,
  RefreshCw,
} from "lucide-react";
import type { Driver, Yard, DeliveryLocation } from "@shared/schema";
import { normalizeImageUrl } from "@/lib/utils";

interface DriverEvaluation {
  id: string;
  weightedScore: string | null;
  averageScore: string | null;
  hadIncident: string | null;
  incidentDescription: string | null;
  createdAt: string;
}

interface TripWithDetails {
  id: string;
  requestNumber: string;
  vehicleChassi: string;
  status: string;
  checkinDateTime: string | null;
  checkoutDateTime: string | null;
  checkinNotes: string | null;
  checkoutNotes: string | null;
  deliveryDate: string | null;
  createdAt: string;
  originYard: Yard | null;
  deliveryLocation: DeliveryLocation | null;
  evaluation: DriverEvaluation | null;
}

interface DriverProfile {
  driver: Driver;
  kpis: {
    totalTrips: number;
    totalKm: string;
    avgScore: string | null;
    incidentCount: number;
  };
  monthlyPerformance: Array<{ month: string; score: number | null; trips: number }>;
  recentTrips: TripWithDetails[];
  infractions: Array<{ id: string; date: string; description: string | null; score: string | null }>;
  isOnTrip: boolean;
  lastAppActivity: string | null;
}

const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

const formatLastAppActivity = (d: string | null | undefined): string => {
  if (!d) return "Nunca acessou";
  const now = new Date();
  const dt = new Date(d);
  const diffMs = now.getTime() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "Agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffH < 24) return `há ${diffH}h`;
  if (diffD === 1) return "ontem";
  if (diffD < 7) return `há ${diffD} dias`;
  if (diffD < 30) return `há ${Math.floor(diffD / 7)} sem.`;
  const diffM = Math.floor(diffD / 30);
  if (diffM < 12) return `há ${diffM} ${diffM === 1 ? "mês" : "meses"}`;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const getTenure = (createdAt: string) => {
  const months = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `${months} mês${months > 1 ? "es" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} ano${years > 1 ? "s" : ""}${rem > 0 ? ` e ${rem} mês${rem > 1 ? "es" : ""}` : ""}`;
};

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

const getModalityLabel = (m: string | null | undefined) => {
  if (m === "pj") return "PJ";
  if (m === "clt") return "CLT";
  if (m === "agregado") return "Agregado";
  return m || "—";
};

const getDriverTypeLabel = (t: string | null | undefined) => {
  if (t === "transporte") return "Transporte";
  if (t === "coleta") return "Coleta";
  return t || "—";
};

function ScoreCircle({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold leading-none" style={{ color }}>{score.toFixed(0)}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function StarRating({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  const stars = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) =>
        s <= stars ? (
          <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        ) : (
          <StarOff key={s} className="h-3.5 w-3.5 text-muted-foreground/40" />
        )
      )}
      <span className="ml-1 text-xs text-muted-foreground">{score.toFixed(0)}</span>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
        <p className="font-medium mb-1">{label}</p>
        <p className="text-primary">Score: <span className="font-bold">{payload[0]?.value ?? "—"}</span></p>
        <p className="text-muted-foreground">Viagens: {payload[0]?.payload?.trips ?? 0}</p>
      </div>
    );
  }
  return null;
};

function EmptyState({ drivers, onSelect }: { drivers: Driver[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Contact className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Selecione um motorista</h3>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
        Escolha um motorista no filtro acima para visualizar o perfil profissional completo.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full max-w-3xl">
        {drivers.slice(0, 8).map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/40 transition-all text-center group"
            data-testid={`driver-card-${d.id}`}
          >
            {d.profilePhoto ? (
              <img src={normalizeImageUrl(d.profilePhoto)} alt={d.name} className="w-12 h-12 rounded-full object-cover border-2 border-border group-hover:border-primary/40 transition-colors" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border group-hover:border-primary/40 transition-colors">
                <span className="text-sm font-bold text-primary">{getInitials(d.name)}</span>
              </div>
            )}
            <div>
              <p className="text-xs font-medium leading-tight line-clamp-2">{d.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{d.city}/{d.state}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DriverProfileMenuPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const { data: allDrivers = [] } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });

  const { data: profile, isLoading } = useQuery<DriverProfile>({
    queryKey: ["/api/drivers", selectedId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/${selectedId}/profile`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar perfil");
      return res.json();
    },
    enabled: !!selectedId,
  });

  const selectedDriver = allDrivers.find((d) => d.id === selectedId);

  const firstTrip = profile?.recentTrips && profile.recentTrips.length > 0
    ? [...profile.recentTrips].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
    : null;

  const tripsWithNotes = profile?.recentTrips?.filter(
    (t) => t.checkinNotes || t.checkoutNotes
  ) || [];

  const avgScore = profile?.kpis.avgScore ? parseFloat(profile.kpis.avgScore) : null;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Perfil do Motorista" />

      {/* Driver selector bar */}
      <div className="border-b bg-muted/30 px-4 md:px-6 py-3 print:hidden">
        <div className="flex items-center gap-3 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal text-sm h-9"
                data-testid="button-driver-selector"
              >
                <span className="truncate">
                  {selectedDriver ? selectedDriver.name : "Selecionar motorista..."}
                </span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar motorista..." data-testid="input-driver-search" />
                <CommandList>
                  <CommandEmpty>Nenhum motorista encontrado.</CommandEmpty>
                  <CommandGroup>
                    {allDrivers.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={d.name}
                        onSelect={() => {
                          setSelectedId(d.id);
                          setOpen(false);
                        }}
                        data-testid={`driver-option-${d.id}`}
                      >
                        <Check className={`mr-2 h-4 w-4 ${d.id === selectedId ? "opacity-100" : "opacity-0"}`} />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {d.profilePhoto ? (
                            <img src={normalizeImageUrl(d.profilePhoto)} alt={d.name} className="w-7 h-7 rounded-full object-cover border shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-primary">{getInitials(d.name)}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm truncate">{d.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.city}/{d.state} · CNH {d.cnhType} · {getModalityLabel(d.modality)}
                            </p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selectedId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedId(null)}
              className="text-xs text-muted-foreground h-9 px-2"
              data-testid="button-clear-driver"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!selectedId ? (
        <EmptyState drivers={allDrivers} onSelect={setSelectedId} />
      ) : isLoading ? (
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : !profile ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">Perfil não encontrado.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6 print:p-4">
          {/* Header Card */}
          <Card className="border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="relative shrink-0">
                  {profile.driver.profilePhoto ? (
                    <img
                      src={normalizeImageUrl(profile.driver.profilePhoto)}
                      alt={profile.driver.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-border shadow"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shadow">
                      <span className="text-2xl font-bold text-primary">{getInitials(profile.driver.name)}</span>
                    </div>
                  )}
                  <span
                    className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-background ${
                      profile.isOnTrip ? "bg-green-500" : "bg-slate-400"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold truncate">{profile.driver.name}</h2>
                    <Badge
                      variant={profile.isOnTrip ? "default" : "secondary"}
                      className={profile.isOnTrip ? "bg-green-500 hover:bg-green-600 text-white" : ""}
                    >
                      {profile.isOnTrip ? "Em Viagem" : "Em Descanso"}
                    </Badge>
                    {profile.driver.isApto === "true" && (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Apto
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-muted-foreground">
                      {getDriverTypeLabel(profile.driver.driverType)}
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground">
                      {getModalityLabel(profile.driver.modality)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      CNH {profile.driver.cnhType}
                    </span>
                    {profile.driver.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {profile.driver.city}/{profile.driver.state}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {getTenure(profile.driver.createdAt!.toString())} de empresa
                    </span>
                    <span
                      className="flex items-center gap-1"
                      title={profile.lastAppActivity ? new Date(profile.lastAppActivity).toLocaleString("pt-BR") : undefined}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Último acesso: {formatLastAppActivity(profile.lastAppActivity)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 print:hidden flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground self-start">Score de Condução</p>
                {avgScore !== null ? (
                  <ScoreCircle score={avgScore} />
                ) : (
                  <div className="h-[110px] flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">Sem dados</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">média ponderada</p>
              </CardContent>
            </Card>

            <KpiCard
              icon={Route}
              label="Km Rodados"
              value={
                parseFloat(profile.kpis.totalKm) > 0
                  ? parseFloat(profile.kpis.totalKm).toLocaleString("pt-BR") + " km"
                  : "—"
              }
              sub="acumulado total"
              color="text-blue-500"
            />

            <KpiCard
              icon={Truck}
              label="Viagens Concluídas"
              value={profile.kpis.totalTrips.toLocaleString("pt-BR")}
              sub="transportes entregues"
              color="text-emerald-500"
            />

            <KpiCard
              icon={AlertTriangle}
              label="Imprevistos"
              value={profile.kpis.incidentCount}
              sub={profile.kpis.incidentCount === 0 ? "nenhum registrado" : "ocorrências registradas"}
              color={profile.kpis.incidentCount === 0 ? "text-green-500" : "text-orange-500"}
            />
          </div>

          {/* Info Pessoal + Documentação */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Informações de Contato */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Contact className="h-4 w-4 text-primary" />
                  Informações Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.driver.phone && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Telefone</p>
                      <p className="text-sm font-medium">{profile.driver.phone}</p>
                    </div>
                  </div>
                )}
                {profile.driver.email && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">E-mail</p>
                      <p className="text-sm font-medium truncate">{profile.driver.email}</p>
                    </div>
                  </div>
                )}
                {profile.driver.cpf && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CPF</p>
                      <p className="text-sm font-medium">{profile.driver.cpf}</p>
                    </div>
                  </div>
                )}
                {profile.driver.birthDate && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Nascimento</p>
                      <p className="text-sm font-medium">{formatDate(profile.driver.birthDate as unknown as string)}</p>
                    </div>
                  </div>
                )}
                {(profile.driver.address || profile.driver.city) && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Endereço</p>
                      <p className="text-sm font-medium">
                        {[profile.driver.address, profile.driver.addressNumber].filter(Boolean).join(", ")}
                        {profile.driver.city && ` — ${profile.driver.city}/${profile.driver.state}`}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linha do Tempo Profissional */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Linha do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                {[
                  {
                    icon: Building2,
                    label: "Data de cadastro",
                    value: formatDate(profile.driver.createdAt?.toString()),
                    color: "text-blue-500",
                    sub: `${getTenure(profile.driver.createdAt!.toString())} de empresa`,
                  },
                  {
                    icon: Navigation,
                    label: "Primeira viagem",
                    value: firstTrip ? formatDate(firstTrip.checkinDateTime || firstTrip.createdAt) : "—",
                    color: "text-emerald-500",
                    sub: firstTrip ? firstTrip.requestNumber : "Nenhuma viagem ainda",
                  },
                  {
                    icon: Clock,
                    label: "Viagem mais recente",
                    value: profile.recentTrips[0]
                      ? formatDate(profile.recentTrips[0].checkinDateTime || profile.recentTrips[0].createdAt)
                      : "—",
                    color: "text-violet-500",
                    sub: profile.recentTrips[0]?.requestNumber || "—",
                  },
                  {
                    icon: Activity,
                    label: "Último acesso ao app",
                    value: formatLastAppActivity(profile.lastAppActivity),
                    color: "text-amber-500",
                    sub: profile.lastAppActivity
                      ? new Date(profile.lastAppActivity).toLocaleString("pt-BR")
                      : "Nunca acessou",
                  },
                ].map((item, idx, arr) => (
                  <div key={idx} className="flex gap-3 py-2.5 relative">
                    {idx < arr.length - 1 && (
                      <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border" />
                    )}
                    <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 z-10`}>
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm font-semibold">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Documentação e Segurança */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Documentação e Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">CNH Tipo {profile.driver.cnhType}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      profile.driver.documentsApproved === "aprovado"
                        ? "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
                        : "text-orange-600 border-orange-300"
                    }
                  >
                    {profile.driver.documentsApproved === "aprovado" ? "Aprovada" : "Pendente"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Aptidão</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      profile.driver.isApto === "true"
                        ? "text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20"
                        : "text-red-600 border-red-300"
                    }
                  >
                    {profile.driver.isApto === "true" ? "Apto" : "Inapto"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Modalidade</span>
                  </div>
                  <Badge variant="outline">{getModalityLabel(profile.driver.modality)}</Badge>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Últimos Imprevistos ({profile.infractions.length})
                  </p>
                  {profile.infractions.length === 0 ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      <Shield className="h-4 w-4 shrink-0" />
                      <span className="text-xs">Nenhum imprevisto registrado</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {profile.infractions.map((inf) => (
                        <div
                          key={inf.id}
                          className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {formatDate(inf.date)}
                            </span>
                            {inf.score && (
                              <span className="text-[10px] text-muted-foreground">Score: {parseFloat(inf.score).toFixed(0)}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{inf.description || "Sem descrição"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance nos Últimos 6 Meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.monthlyPerformance.every((m) => m.score === null) ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Sem avaliações no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={profile.monthlyPerformance} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {profile.monthlyPerformance.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            entry.score === null ? "hsl(var(--muted))"
                            : entry.score >= 80 ? "#22c55e"
                            : entry.score >= 60 ? "#f59e0b"
                            : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Notas por Viagem */}
          {tripsWithNotes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Notas por Viagem ({tripsWithNotes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {tripsWithNotes.map((trip) => (
                    <div key={trip.id} className="px-5 py-4" data-testid={`trip-notes-${trip.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-primary">{trip.requestNumber}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{trip.originYard?.name || "—"}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs text-muted-foreground">
                          {trip.deliveryLocation ? `${trip.deliveryLocation.city}/${trip.deliveryLocation.state}` : "—"}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatDate(trip.checkinDateTime || trip.createdAt)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {trip.checkinNotes && (
                          <div className="flex gap-2 items-start">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">Check-in</span>
                            <p className="text-xs text-muted-foreground">{trip.checkinNotes}</p>
                          </div>
                        )}
                        {trip.checkoutNotes && (
                          <div className="flex gap-2 items-start">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-green-600 dark:text-green-400 mt-0.5 shrink-0">Entrega</span>
                            <p className="text-xs text-muted-foreground">{trip.checkoutNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Histórico de Viagens */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Histórico de Viagens ({profile.recentTrips.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {profile.recentTrips.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Truck className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma viagem registrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">OTD</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Data</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Veículo</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Origem</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Destino</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Check-in</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Entrega</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Avaliação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {profile.recentTrips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-muted/20 transition-colors" data-testid={`trip-row-${trip.id}`}>
                          <td className="px-4 py-3 font-medium text-primary text-xs">{trip.requestNumber}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(trip.deliveryDate || trip.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs hidden sm:table-cell font-mono text-muted-foreground">
                            {trip.vehicleChassi?.slice(-6) || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs hidden md:table-cell text-muted-foreground">
                            {trip.originYard?.name || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs hidden md:table-cell text-muted-foreground">
                            {trip.deliveryLocation
                              ? `${trip.deliveryLocation.city}/${trip.deliveryLocation.state}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                            {formatDateTime(trip.checkinDateTime)}
                          </td>
                          <td className="px-4 py-3 text-xs hidden lg:table-cell text-muted-foreground whitespace-nowrap">
                            {formatDateTime(trip.checkoutDateTime)}
                          </td>
                          <td className="px-4 py-3">
                            <StarRating
                              score={
                                trip.evaluation
                                  ? parseFloat(trip.evaluation.weightedScore || trip.evaluation.averageScore || "0")
                                  : null
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:p-4 { padding: 1rem !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
