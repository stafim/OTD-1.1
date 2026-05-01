import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import {
  Users,
  Star,
  AlertTriangle,
  Award,
  ChevronRight,
  BarChart3,
  Activity,
  Truck,
  ShieldCheck,
  Search,
} from "lucide-react";
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

interface DriverRankingData {
  id: string;
  name: string;
  modality: string;
  totalTrips: number;
  tripsLastMonth: number;
  averageScore: number | null;
  totalEvaluations: number;
  incidentCount: number;
  city: string | null;
  state: string | null;
}

interface RankingResponse {
  stats: {
    totalDrivers: number;
    activeDrivers: number;
    totalTrips: number;
    averageScore: number;
    driversWithEvaluations: number;
  };
  drivers: DriverRankingData[];
  topDrivers: DriverRankingData[];
  bottomDrivers: DriverRankingData[];
}

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-500";
  return "text-red-600";
}

function scoreBg(score: number | null) {
  if (score === null) return "bg-muted/40";
  if (score >= 80) return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  if (score >= 60) return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
  if (score >= 40) return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
  return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`font-bold text-base ${scoreColor(score)}`}>
      {score.toFixed(1)}
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-muted/40`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriverPerformancePage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<RankingResponse>({
    queryKey: ["/api/driver-ranking"],
  });

  const allDrivers = data?.drivers ?? [];
  const stats = data?.stats;

  const scoreBands = [
    { label: "90–100", min: 90, max: 100, color: "#16a34a" },
    { label: "80–89", min: 80, max: 90, color: "#22c55e" },
    { label: "70–79", min: 70, max: 80, color: "#84cc16" },
    { label: "60–69", min: 60, max: 70, color: "#eab308" },
    { label: "40–59", min: 40, max: 60, color: "#f97316" },
    { label: "< 40", min: 0, max: 40, color: "#ef4444" },
  ];

  const distributionData = scoreBands.map((band) => ({
    faixa: band.label,
    motoristas: allDrivers.filter(
      (d) =>
        d.averageScore !== null &&
        d.averageScore >= band.min &&
        d.averageScore < band.max
    ).length,
    color: band.color,
  }));

  const withTrips = allDrivers.filter((d) => d.totalTrips > 0);
  const withScore = allDrivers.filter((d) => d.averageScore !== null);
  const excellentCount = withScore.filter((d) => (d.averageScore ?? 0) >= 80).length;
  const atRiskCount = withScore.filter((d) => (d.averageScore ?? 0) < 60).length;
  const incidentDrivers = withTrips.filter((d) => d.incidentCount > 0).length;

  const top5 = [...withScore]
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
    .slice(0, 5);

  const atRisk = [...withScore]
    .filter((d) => (d.averageScore ?? 0) < 60)
    .sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0))
    .slice(0, 5);

  const top10Bar = [...withScore]
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
    .slice(0, 10)
    .map((d) => ({
      name: d.name.split(" ")[0],
      score: parseFloat((d.averageScore ?? 0).toFixed(1)),
    }));

  const modalityMap: Record<string, { trips: number; score: number; count: number }> = {};
  for (const d of withScore) {
    const key = d.modality || "outros";
    if (!modalityMap[key]) modalityMap[key] = { trips: 0, score: 0, count: 0 };
    modalityMap[key].trips += d.totalTrips;
    modalityMap[key].score += d.averageScore ?? 0;
    modalityMap[key].count++;
  }
  const modalityData = Object.entries(modalityMap).map(([mod, v]) => ({
    modalidade: mod.toUpperCase(),
    "Score Médio": parseFloat((v.score / v.count).toFixed(1)),
    "Viagens": v.trips,
  }));

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <PageHeader
        title="Performance Motoristas"
        breadcrumbs={[{ label: "Motoristas", href: "/motoristas" }, { label: "Performance" }]}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <KpiCard
                icon={Users}
                label="Total de Motoristas"
                value={stats?.totalDrivers ?? 0}
                sub={`${stats?.activeDrivers ?? 0} com viagens`}
                color="text-blue-500"
              />
              <KpiCard
                icon={Star}
                label="Score Médio Geral"
                value={stats?.averageScore ? stats.averageScore.toFixed(1) : "—"}
                sub={`${stats?.driversWithEvaluations ?? 0} avaliados`}
                color="text-yellow-500"
              />
              <KpiCard
                icon={Award}
                label="Excelentes (≥ 80)"
                value={excellentCount}
                sub={withScore.length > 0 ? `${Math.round((excellentCount / withScore.length) * 100)}% dos avaliados` : "—"}
                color="text-green-500"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Em Atenção (< 60)"
                value={atRiskCount}
                sub={incidentDrivers > 0 ? `${incidentDrivers} com imprevistos` : "Sem imprevistos"}
                color={atRiskCount > 0 ? "text-orange-500" : "text-green-500"}
              />
            </>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Score distribution */}
          <Card data-testid="chart-score-distribution">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Distribuição de Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={distributionData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => [`${v} motoristas`, "Qtd"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="motoristas" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {distributionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top 10 bar */}
          <Card data-testid="chart-top10-scores">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Top 10 — Melhores Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={top10Bar} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip
                      formatter={(v: number) => [v.toFixed(1), "Score"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {top10Bar.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.score >= 80 ? "#22c55e" : entry.score >= 60 ? "#eab308" : "#f97316"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modality comparison */}
        {modalityData.length > 0 && (
          <Card data-testid="chart-modality-comparison">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                Score Médio por Modalidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-52 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={modalityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="modalidade" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Score Médio" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top performers & At Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card data-testid="card-top-performers">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-green-500" />
                Melhores Performances
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : top5.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Sem dados</div>
              ) : (
                <div className="divide-y divide-border">
                  {top5.map((d, i) => (
                    <Link key={d.id} href={`/motoristas/${d.id}/perfil`}>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors border-l-4 ${scoreBg(d.averageScore)}`}
                        data-testid={`row-top-performer-${d.id}`}
                      >
                        <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.totalTrips} viagens • {d.incidentCount} imprevistos</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ScoreBadge score={d.averageScore} />
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-at-risk">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Requerem Atenção (score &lt; 60)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : atRisk.length === 0 ? (
                <div className="flex items-center gap-3 p-6 rounded-lg">
                  <ShieldCheck className="h-8 w-8 text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Tudo em ordem!</p>
                    <p className="text-xs text-muted-foreground">Nenhum motorista com score abaixo de 60</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {atRisk.map((d) => (
                    <Link key={d.id} href={`/motoristas/${d.id}/perfil`}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors border-l-4 border-orange-400"
                        data-testid={`row-at-risk-${d.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.totalTrips} viagens • {d.incidentCount} {d.incidentCount === 1 ? "imprevisto" : "imprevistos"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ScoreBadge score={d.averageScore} />
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full driver table */}
        <Card data-testid="card-all-drivers-performance">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-base flex items-center gap-2 shrink-0">
                <Users className="h-4 w-4 text-primary" />
                Todos os Motoristas
              </CardTitle>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar motorista..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                  data-testid="input-driver-search"
                />
              </div>
              {search && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {allDrivers.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())).length} resultado(s)
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Motorista</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Modalidade</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">Viagens</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Últ. 30d</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs">Score</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Imprevistos</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const rows = [...allDrivers]
                        .sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1))
                        .filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()));
                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                              Nenhum motorista encontrado para "{search}"
                            </td>
                          </tr>
                        );
                      }
                      return rows.map((d) => (
                        <tr
                          key={d.id}
                          className="hover:bg-muted/20 transition-colors"
                          data-testid={`row-driver-perf-${d.id}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">{d.name}</p>
                            {d.city && (
                              <p className="text-xs text-muted-foreground">{d.city}/{d.state}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">
                              {d.modality?.toUpperCase() ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-sm">{d.totalTrips}</td>
                          <td className="px-4 py-3 text-center text-sm hidden md:table-cell">{d.tripsLastMonth}</td>
                          <td className="px-4 py-3 text-center">
                            <ScoreBadge score={d.averageScore} />
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            {d.incidentCount > 0 ? (
                              <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                                {d.incidentCount}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/motoristas/${d.id}/perfil`}>
                              <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors ml-auto cursor-pointer" />
                            </Link>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
