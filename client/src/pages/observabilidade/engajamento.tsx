import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  Users,
  Filter,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Medal,
  ArrowRight,
} from "lucide-react";

interface RouteEngagement {
  originYard: string;
  originCity: string;
  originState: string;
  destination: string;
  destinationCity: string;
  destinationState: string;
  totalProposals: number;
  totalAccepted: number;
  totalRejected: number;
  totalPending: number;
  uniqueDriversReached: number;
  acceptanceRate: number;
  rejectionRate: number;
  hasEnoughData: boolean;
}

interface EngagementData {
  mostAcceptedRoutes: RouteEngagement[];
  leastAcceptedRoutes: RouteEngagement[];
  insufficientDataRoutes: RouteEngagement[];
  totalRoutes: number;
  totalProposals: number;
  totalDriversReached: number;
  overallAcceptanceRate: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-white font-bold text-sm shadow" title="1º lugar">
        🥇
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-300 text-white font-bold text-sm shadow" title="2º lugar">
        🥈
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-600 text-white font-bold text-sm shadow" title="3º lugar">
        🥉
      </div>
    );
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-bold text-sm border">
      {rank}
    </div>
  );
}

function RankedRouteCard({
  route,
  rank,
  mode,
}: {
  route: RouteEngagement;
  rank: number;
  mode: "acceptance" | "rejection";
}) {
  const [expanded, setExpanded] = useState(false);
  const total = route.totalProposals;
  const rate = mode === "acceptance" ? route.acceptanceRate : route.rejectionRate;
  const rateLabel = mode === "acceptance" ? "aceite" : "rejeição";
  const rateColor =
    mode === "acceptance"
      ? rate >= 60
        ? "text-emerald-600"
        : rate >= 30
        ? "text-amber-600"
        : "text-red-500"
      : rate >= 60
      ? "text-red-600"
      : rate >= 30
      ? "text-amber-600"
      : "text-emerald-600";

  const borderColor =
    mode === "acceptance"
      ? rank === 1
        ? "border-l-emerald-500"
        : rank === 2
        ? "border-l-emerald-400"
        : rank === 3
        ? "border-l-emerald-300"
        : "border-l-border"
      : rank === 1
      ? "border-l-red-500"
      : rank === 2
      ? "border-l-red-400"
      : rank === 3
      ? "border-l-red-300"
      : "border-l-border";

  const acceptedPct = total > 0 ? (route.totalAccepted / total) * 100 : 0;
  const rejectedPct = total > 0 ? (route.totalRejected / total) * 100 : 0;
  const pendingPct = total > 0 ? (route.totalPending / total) * 100 : 0;

  return (
    <div
      data-testid={`ranked-route-${rank}-${mode}`}
      className={`rounded-lg border border-l-4 ${borderColor} bg-card transition-all`}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        data-testid={`toggle-route-${rank}`}
      >
        <RankBadge rank={rank} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{route.originCity}</span>
            <span className="text-muted-foreground text-xs">{route.originState}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-semibold text-sm">{route.destinationCity}</span>
            <span className="text-muted-foreground text-xs">{route.destinationState}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {route.originYard} → {route.destination}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${acceptedPct}%` }}
                title={`Aceitos: ${route.totalAccepted}`}
              />
              <div
                className="bg-red-400 h-full"
                style={{ width: `${rejectedPct}%` }}
                title={`Recusados: ${route.totalRejected}`}
              />
              <div
                className="bg-amber-400 h-full"
                style={{ width: `${pendingPct}%` }}
                title={`Pendentes: ${route.totalPending}`}
              />
            </div>
            <span className={`text-xs font-semibold tabular-nums w-16 text-right ${rateColor}`}>
              {rate.toFixed(1)}% {rateLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-1">
          <span className="text-xs text-muted-foreground tabular-nums">{total} respostas</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t pt-4 space-y-4" data-testid={`detail-route-${rank}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center border border-emerald-200 dark:border-emerald-800">
              <p className="text-2xl font-bold text-emerald-600">{route.totalAccepted}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">Aceitos</p>
              <p className="text-[11px] text-muted-foreground">{acceptedPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center border border-red-200 dark:border-red-800">
              <p className="text-2xl font-bold text-red-500">{route.totalRejected}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Recusados</p>
              <p className="text-[11px] text-muted-foreground">{rejectedPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center border border-amber-200 dark:border-amber-800">
              <p className="text-2xl font-bold text-amber-600">{route.totalPending}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Aguardando</p>
              <p className="text-[11px] text-muted-foreground">{pendingPct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3 text-center border border-blue-200 dark:border-blue-800">
              <p className="text-2xl font-bold text-blue-600">{route.uniqueDriversReached}</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Motoristas</p>
              <p className="text-[11px] text-muted-foreground">únicos</p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">Aceite</span>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${acceptedPct}%` }} />
              </div>
              <span className="w-10 text-right font-semibold text-emerald-600">{acceptedPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">Rejeição</span>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className="bg-red-400 h-full rounded-full" style={{ width: `${rejectedPct}%` }} />
              </div>
              <span className="w-10 text-right font-semibold text-red-500">{rejectedPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">Aguardando</span>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pendingPct}%` }} />
              </div>
              <span className="w-10 text-right font-semibold text-amber-600">{pendingPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EngajamentoPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");

  const params = new URLSearchParams();
  if (appliedStart) params.set("startDate", appliedStart);
  if (appliedEnd) params.set("endDate", appliedEnd);
  const queryString = params.toString();

  const { data, isLoading } = useQuery<EngagementData>({
    queryKey: ["/api/analytics/routes-engagement", queryString],
    queryFn: async () => {
      const url = `/api/analytics/routes-engagement${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar dados");
      return res.json();
    },
  });

  const handleFilter = () => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const handleClear = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStart("");
    setAppliedEnd("");
  };

  const best = data?.mostAcceptedRoutes[0];
  const worst = data?.leastAcceptedRoutes[0];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 pb-0">
        <h1 className="text-2xl font-bold mb-1">Engajamento de Trechos</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Ranking de trechos por taxa de aceite e rejeição nas propostas de transporte
        </p>

        <div className="flex flex-wrap items-end gap-3 mb-6 p-4 border rounded-lg bg-muted/30">
          <div className="flex flex-col gap-1">
            <Label htmlFor="start-date" className="text-xs">Data inicial</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40 h-8 text-sm"
              data-testid="input-start-date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="end-date" className="text-xs">Data final</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40 h-8 text-sm"
              data-testid="input-end-date"
            />
          </div>
          <Button size="sm" onClick={handleFilter} data-testid="button-apply-filter" className="gap-1">
            <Filter className="h-3.5 w-3.5" />
            Filtrar
          </Button>
          {(appliedStart || appliedEnd) && (
            <Button size="sm" variant="ghost" onClick={handleClear} data-testid="button-clear-filter">
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 pt-0 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard label="Total de Trechos" value={data?.totalRoutes ?? 0} icon={MapPin} color="bg-blue-500" />
              <StatCard label="Total de Respostas" value={data?.totalProposals ?? 0} icon={CheckCircle2} color="bg-indigo-500" />
              <StatCard label="Motoristas Únicos" value={data?.totalDriversReached ?? 0} icon={Users} color="bg-violet-500" />
              <StatCard
                label="Taxa Global de Aceite"
                value={`${(data?.overallAcceptanceRate ?? 0).toFixed(1)}%`}
                icon={TrendingUp}
                color={(data?.overallAcceptanceRate ?? 0) >= 50 ? "bg-emerald-500" : "bg-amber-500"}
              />
            </>
          )}
        </div>

        {!isLoading && best && worst && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                  Trecho mais atrativo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold">{best.originCity}/{best.originState}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">{best.destinationCity}/{best.destinationState}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{best.originYard} → {best.destination}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-emerald-600 font-bold text-lg">{best.acceptanceRate.toFixed(1)}%</span>
                  <span className="text-sm text-muted-foreground">de aceite · {best.totalProposals} respostas</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-400 bg-red-50/40 dark:bg-red-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
                  <TrendingDown className="h-4 w-4" />
                  Trecho mais problemático
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold">{worst.originCity}/{worst.originState}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-bold">{worst.destinationCity}/{worst.destinationState}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{worst.originYard} → {worst.destination}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-red-500 font-bold text-lg">{worst.rejectionRate.toFixed(1)}%</span>
                  <span className="text-sm text-muted-foreground">de rejeição · {worst.totalProposals} respostas</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : (
          <>
            {(data?.mostAcceptedRoutes?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Medal className="h-4 w-4 text-yellow-500" />
                    Ranking por Taxa de Aceite
                    <Badge variant="secondary" className="text-xs font-normal ml-1">
                      {data!.mostAcceptedRoutes.length} trechos · clique para detalhar
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2" data-testid="list-ranking-acceptance">
                  {data!.mostAcceptedRoutes.map((route, i) => (
                    <RankedRouteCard
                      key={`acc-${route.originCity}-${route.destinationCity}-${i}`}
                      route={route}
                      rank={i + 1}
                      mode="acceptance"
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {(data?.leastAcceptedRoutes?.length ?? 0) > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Ranking por Taxa de Rejeição
                    <Badge variant="secondary" className="text-xs font-normal ml-1">
                      {data!.leastAcceptedRoutes.length} trechos · clique para detalhar
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2" data-testid="list-ranking-rejection">
                  {data!.leastAcceptedRoutes.map((route, i) => (
                    <RankedRouteCard
                      key={`rej-${route.originCity}-${route.destinationCity}-${i}`}
                      route={route}
                      rank={i + 1}
                      mode="rejection"
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {(data?.insufficientDataRoutes?.length ?? 0) > 0 && (
              <Card className="opacity-70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Sem Dados Suficientes
                    <Badge variant="outline" className="text-xs ml-1">
                      mín. 5 respostas
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2" data-testid="list-insufficient-data">
                  {data!.insufficientDataRoutes.map((route, i) => (
                    <RankedRouteCard
                      key={`insuf-${route.originCity}-${route.destinationCity}-${i}`}
                      route={route}
                      rank={i + 1}
                      mode="acceptance"
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {data?.totalRoutes === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhum dado encontrado para o período selecionado.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
