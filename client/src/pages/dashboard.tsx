import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Truck, Package, Users, Warehouse, TrendingUp, DollarSign,
  Clock, MapPin, CheckCircle2, AlertCircle, Timer, Activity,
  Target, Calendar, Building2, ArrowLeftRight, UserX,
  AlertTriangle, RefreshCw, Gauge, ShieldCheck, Package2,
  TrendingDown, Zap, BarChart3, CircleDot, ArrowRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  AreaChart, Area, RadialBarChart, RadialBar,
} from "recharts";

const COLORS = {
  blue:    "hsl(221, 83%, 53%)",
  green:   "hsl(142, 71%, 45%)",
  yellow:  "hsl(38, 92%, 50%)",
  red:     "hsl(0, 84%, 60%)",
  purple:  "hsl(262, 83%, 58%)",
  orange:  "hsl(25, 95%, 53%)",
  teal:    "hsl(173, 80%, 40%)",
  muted:   "hsl(var(--muted-foreground))",
};

const STATUS_COLORS: Record<string, string> = {
  pendente:         COLORS.yellow,
  aguardando_saida: COLORS.purple,
  em_transito:      COLORS.blue,
  entregue:         COLORS.green,
  cancelado:        COLORS.red,
  em_estoque:       COLORS.green,
  pre_estoque:      COLORS.yellow,
  em_transferencia: COLORS.blue,
  despachado:       COLORS.purple,
  retirado:         COLORS.muted,
};

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  },
};

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="h-4 w-28 mb-3" />
        <Skeleton className="h-9 w-20 mb-2" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function KPICard({
  title, value, subtitle, icon: Icon, color = "blue", badge, isLoading, testId,
}: {
  title: string; value: string | number; subtitle?: string;
  icon: any; color?: "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "teal";
  badge?: string; isLoading?: boolean; testId: string;
}) {
  const bgMap: Record<string, string> = {
    blue:   "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green:  "bg-green-500/10 text-green-600 dark:text-green-400",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    red:    "bg-red-500/10 text-red-600 dark:text-red-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    teal:   "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  };
  if (isLoading) return <SkeletonCard />;
  return (
    <Card data-testid={testId} className="hover-elevate transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate mb-1">{title}</p>
            <p className="text-2xl font-bold tracking-tight leading-none mb-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg shrink-0 ${bgMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {badge && (
          <Badge variant="secondary" className="mt-2 text-[10px]">{badge}</Badge>
        )}
      </CardContent>
    </Card>
  );
}

function GaugeKPI({
  title, value, max = 100, color, isLoading, icon: Icon, description,
}: {
  title: string; value: number; max?: number; color: string;
  isLoading?: boolean; icon: any; description?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const statusColor = value >= 80 ? "text-green-600" : value >= 60 ? "text-yellow-600" : "text-red-600";
  if (isLoading) return <SkeletonCard />;
  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`h-4 w-4 ${statusColor}`} />
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
        </div>
        <p className={`text-3xl font-bold tracking-tight ${statusColor}`}>{value}%</p>
        <Progress value={pct} className="mt-2 h-2" style={{ "--progress-color": color } as any} />
        {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message = "Sem dados no período" }: { message?: string }) {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-2">
      <BarChart3 className="h-10 w-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("all");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const monthsMap: Record<string, string> = { month: "1", quarter: "3", semester: "6", all: "24" };

  const { data: analytics, isLoading: analyticsLoading, isFetching, refetch } = useQuery<any>({
    queryKey: [`/api/dashboard/analytics?period=${period}`],
    staleTime: 30_000,
  });

  const { data: yardStats, isLoading: yardsLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/yard-stats"],
    staleTime: 30_000,
  });

  const { data: operation, isLoading: opLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/operation"],
    staleTime: 30_000,
  });

  const { data: indicadores, isLoading: indLoading } = useQuery<any>({
    queryKey: [`/api/indicadores?period=${monthsMap[period] || "24"}`],
    staleTime: 30_000,
  });

  const loading = analyticsLoading || yardsLoading || opLoading || indLoading;

  const m = analytics?.metrics;
  const s = analytics?.transportsByStatus;
  const cs = analytics?.collectsByStatus;
  const fin = analytics?.financials;
  const ind = indicadores?.summary;

  const transportStatusData = s ? [
    { name: "Pendente",       value: s.pendente,         color: STATUS_COLORS.pendente },
    { name: "Ag. Saída",      value: s.aguardando_saida, color: STATUS_COLORS.aguardando_saida },
    { name: "Em Trânsito",    value: s.em_transito,      color: STATUS_COLORS.em_transito },
    { name: "Entregue",       value: s.entregue,         color: STATUS_COLORS.entregue },
    { name: "Cancelado",      value: s.cancelado,        color: STATUS_COLORS.cancelado },
  ].filter(d => d.value > 0) : [];

  const collectStatusData = cs ? [
    { name: "Em Trânsito",    value: cs.em_transito, color: STATUS_COLORS.em_transito },
    { name: "Finalizada",     value: cs.entregue,    color: STATUS_COLORS.entregue },
    { name: "Pendente",       value: cs.pendente,    color: STATUS_COLORS.pendente },
    { name: "Cancelada",      value: cs.cancelado,   color: STATUS_COLORS.cancelado },
  ].filter(d => d.value > 0) : [];

  const vehiclesTotalData = yardStats?.totals ? [
    { name: "Em Estoque",        value: yardStats.totals.em_estoque,       color: STATUS_COLORS.em_estoque },
    { name: "Pré-Estoque",       value: yardStats.totals.pre_estoque,      color: STATUS_COLORS.pre_estoque },
    { name: "Em Transferência",  value: yardStats.totals.em_transferencia, color: STATUS_COLORS.em_transferencia },
    { name: "Despachado",        value: yardStats.totals.despachado,       color: STATUS_COLORS.despachado },
  ].filter(d => d.value > 0) : [];

  const combinedMonthlyData = analytics?.transportsByMonth?.map((t: any, i: number) => ({
    name: t.name,
    Transportes: t.transportes,
    Coletas: analytics.collectsByMonth[i]?.coletas || 0,
  })) ?? [];

  const yardChartData = yardStats?.yardStats?.map((y: any) => {
    const row: Record<string, any> = { name: y.name.replace(/OTD\s*/i, "") };
    y.statusBreakdown.forEach((sb: any) => { row[sb.label] = sb.count; });
    return row;
  }) ?? [];

  const opStats = operation?.stats;
  const noDriver = operation?.noDriverTransports ?? [];

  const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader title="Dashboard" description="Visão operacional e indicadores em tempo real" />

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <SectionTitle>Período</SectionTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="semester">Semestre</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── ALERTAS OPERACIONAIS ── */}
      {!opLoading && opStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/15 text-blue-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ativos Total</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{opStats.totalActive}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-indigo-500/15 text-indigo-600">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Trânsito</p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{opStats.totalInTransit}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/15 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{opStats.totalPending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 ${opStats.totalNoDriver > 0 ? "ring-1 ring-red-400" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/15 text-red-600">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sem Motorista</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{opStats.totalNoDriver}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="geral" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
          <TabsTrigger value="transportes" className="text-xs sm:text-sm">Transportes</TabsTrigger>
          <TabsTrigger value="coletas" className="text-xs sm:text-sm">Coletas</TabsTrigger>
          <TabsTrigger value="estoque" className="text-xs sm:text-sm">Estoque & Pátios</TabsTrigger>
          <TabsTrigger value="indicadores" className="text-xs sm:text-sm">Indicadores</TabsTrigger>
          <TabsTrigger value="motoristas" className="text-xs sm:text-sm">Motoristas</TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════ TAB: VISÃO GERAL */}
        <TabsContent value="geral" className="space-y-5">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <KPICard title="Total Transportes"   value={m?.totalTransports ?? 0}              icon={Truck}       color="blue"   isLoading={analyticsLoading} testId="kpi-total-transports" />
            <KPICard title="Coletas Realizadas"  value={m?.totalCollects ?? 0}                icon={Package}     color="teal"   isLoading={analyticsLoading} testId="kpi-total-collects" />
            <KPICard title="Veículos em Estoque" value={m?.vehiclesInStock ?? 0}              subtitle={`de ${m?.totalVehicles ?? 0} total`} icon={Warehouse} color="green" isLoading={analyticsLoading} testId="kpi-vehicles-stock" />
            <KPICard title="Motoristas Ativos"   value={m?.totalDrivers ?? 0}                icon={Users}       color="purple" isLoading={analyticsLoading} testId="kpi-active-drivers" />
            <KPICard title="Km Percorridos"      value={(m?.totalDistanceKm ?? 0).toLocaleString("pt-BR")} subtitle="Total acumulado" icon={MapPin} color="orange" isLoading={analyticsLoading} testId="kpi-total-km" />
            <KPICard title="Despesas Totais"     value={`R$ ${((fin?.totalExpenses ?? 0) / 1000).toFixed(1)}k`} subtitle={`${fin?.approvedSettlements ?? 0} aprovadas`} icon={DollarSign} color="yellow" isLoading={analyticsLoading} testId="kpi-expenses" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-testid="chart-monthly-volume">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Volume Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? <Skeleton className="h-[260px]" /> : combinedMonthlyData.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={combinedMonthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="Transportes" stroke={COLORS.blue} fill="url(#gT)" strokeWidth={2} />
                      <Area type="monotone" dataKey="Coletas"     stroke={COLORS.teal} fill="url(#gC)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card data-testid="chart-transport-status-geral">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Status Transportes</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? <Skeleton className="h-[260px]" /> : transportStatusData.length === 0 ? <EmptyChart /> : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={transportStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" labelLine={false} label={CustomPieLabel}>
                          {transportStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-1">
                      {transportStatusData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-muted-foreground">{d.name}</span>
                          </div>
                          <span className="font-semibold">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" data-testid="chart-indicadores-geral">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Indicadores de Qualidade</CardTitle>
              </CardHeader>
              <CardContent>
                {indLoading ? <Skeleton className="h-[120px]" /> : (
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "OTD (No Prazo)", value: ind?.otdRate ?? 0, color: COLORS.green },
                      { label: "OTIF",           value: ind?.otifRate ?? 0, color: COLORS.blue },
                      { label: "Sem Avaria",     value: ind?.damageFreeRate ?? 0, color: COLORS.teal },
                    ].map((kpi, i) => (
                      <div key={i} className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                        <p className={`text-3xl font-bold ${kpi.value >= 80 ? "text-green-600" : kpi.value >= 60 ? "text-yellow-600" : "text-red-600"}`}>{kpi.value}%</p>
                        <Progress value={kpi.value} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="kpi-financials">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Prestação de Contas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analyticsLoading ? <Skeleton className="h-[120px]" /> : (
                  <>
                    {[
                      { label: "Total em Despesas", value: `R$ ${(fin?.totalExpenses ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "text-foreground" },
                      { label: "Prestações Aprovadas", value: fin?.approvedSettlements ?? 0, color: "text-green-600" },
                      { label: "Prestações Pendentes", value: fin?.pendingSettlements ?? 0, color: fin?.pendingSettlements > 0 ? "text-amber-600" : "text-foreground" },
                      { label: "Total de Prestações", value: fin?.totalSettlements ?? 0, color: "text-muted-foreground" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className={`font-semibold ${row.color}`}>{row.value}</span>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate("/prestacao-de-contas")}>
                      Ver detalhes <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ TAB: TRANSPORTES */}
        <TabsContent value="transportes" className="space-y-5">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { title: "Total",        value: m?.totalTransports ?? 0,          color: "blue"   as const, icon: Truck },
              { title: "Entregues",    value: s?.entregue ?? 0,                 color: "green"  as const, icon: CheckCircle2 },
              { title: "Em Trânsito",  value: s?.em_transito ?? 0,              color: "blue"   as const, icon: Activity },
              { title: "Pendentes",    value: s?.pendente ?? 0,                 color: "yellow" as const, icon: Clock },
              { title: "Cancelados",   value: s?.cancelado ?? 0,                color: "red"    as const, icon: AlertCircle },
            ].map((kpi, i) => (
              <KPICard key={i} title={kpi.title} value={kpi.value} icon={kpi.icon} color={kpi.color} isLoading={analyticsLoading} testId={`kpi-t-${i}`} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-testid="chart-transport-status-donut">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Distribuição por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? <Skeleton className="h-[260px]" /> : transportStatusData.length === 0 ? <EmptyChart /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={220}>
                      <PieChart>
                        <Pie data={transportStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" labelLine={false} label={CustomPieLabel}>
                          {transportStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {transportStatusData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground truncate">{d.name}</span>
                              <span className="font-bold ml-1">{d.value}</span>
                            </div>
                            <Progress value={m?.totalTransports ? (d.value / m.totalTransports) * 100 : 0} className="h-1 mt-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="chart-transport-monthly">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Transportes por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? <Skeleton className="h-[260px]" /> : (analytics?.transportsByMonth?.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analytics?.transportsByMonth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="transportes" name="Transportes" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Transportes sem motorista */}
          {!opLoading && noDriver.length > 0 && (
            <Card className="border-red-200 dark:border-red-900" data-testid="list-no-driver">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                  <UserX className="h-4 w-4" />
                  Transportes sem Motorista ({noDriver.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {noDriver.slice(0, 8).map((t: any) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-xs mr-2">{t.requestNumber}</span>
                        <span className="text-muted-foreground text-xs truncate">{t.vehicleChassi}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.originYardName && <Badge variant="outline" className="text-xs">{t.originYardName}</Badge>}
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => navigate("/transportes")}>
                          Atribuir <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {noDriver.length > 8 && (
                  <p className="text-xs text-muted-foreground mt-2">+ {noDriver.length - 8} outros sem motorista</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ TAB: COLETAS */}
        <TabsContent value="coletas" className="space-y-5">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Total de Coletas",  value: m?.totalCollects ?? 0,  color: "teal"   as const, icon: Package },
              { title: "Em Trânsito",       value: cs?.em_transito ?? 0,   color: "blue"   as const, icon: ArrowLeftRight },
              { title: "Finalizadas",       value: cs?.entregue ?? 0,      color: "green"  as const, icon: CheckCircle2 },
              { title: "Canceladas",        value: cs?.cancelado ?? 0,     color: "red"    as const, icon: AlertCircle },
            ].map((kpi, i) => (
              <KPICard key={i} title={kpi.title} value={kpi.value} icon={kpi.icon} color={kpi.color} isLoading={analyticsLoading} testId={`kpi-c-${i}`} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-testid="chart-collect-status">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Distribuição de Coletas</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? <Skeleton className="h-[260px]" /> : collectStatusData.length === 0 ? <EmptyChart /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={220}>
                      <PieChart>
                        <Pie data={collectStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" labelLine={false} label={CustomPieLabel}>
                          {collectStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {collectStatusData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{d.name}</span>
                              <span className="font-bold ml-1">{d.value}</span>
                            </div>
                            <Progress value={m?.totalCollects ? (d.value / m.totalCollects) * 100 : 0} className="h-1 mt-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="chart-collect-monthly">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Coletas por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? <Skeleton className="h-[260px]" /> : (analytics?.collectsByMonth?.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={analytics?.collectsByMonth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Bar dataKey="coletas" name="Coletas" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ TAB: ESTOQUE & PÁTIOS */}
        <TabsContent value="estoque" className="space-y-5">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Em Estoque",        value: yardStats?.totals?.em_estoque ?? 0,       color: "green"  as const, icon: Warehouse },
              { title: "Pré-Estoque",       value: yardStats?.totals?.pre_estoque ?? 0,      color: "yellow" as const, icon: Package2 },
              { title: "Em Transferência",  value: yardStats?.totals?.em_transferencia ?? 0, color: "blue"   as const, icon: ArrowLeftRight },
              { title: "Despachados",       value: yardStats?.totals?.despachado ?? 0,       color: "purple" as const, icon: Truck },
            ].map((kpi, i) => (
              <KPICard key={i} title={kpi.title} value={kpi.value} icon={kpi.icon} color={kpi.color} isLoading={yardsLoading} testId={`kpi-yard-${i}`} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-testid="chart-vehicle-status">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Veículos por Status</CardTitle>
              </CardHeader>
              <CardContent>
                {yardsLoading ? <Skeleton className="h-[260px]" /> : vehiclesTotalData.length === 0 ? <EmptyChart /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={220}>
                      <PieChart>
                        <Pie data={vehiclesTotalData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" labelLine={false} label={CustomPieLabel}>
                          {vehiclesTotalData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {vehiclesTotalData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{d.name}</span>
                              <span className="font-bold ml-1">{d.value}</span>
                            </div>
                            <Progress value={yardStats?.totals?.totalVehicles ? (d.value / yardStats.totals.totalVehicles) * 100 : 0} className="h-1 mt-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="chart-yard-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Veículos por Pátio</CardTitle>
              </CardHeader>
              <CardContent>
                {yardsLoading ? <Skeleton className="h-[260px]" /> : yardChartData.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={yardChartData} layout="vertical" margin={{ top: 5, right: 10, left: 40, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                      <Tooltip {...TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Em Estoque"       fill={STATUS_COLORS.em_estoque}       stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Pré-Estoque"      fill={STATUS_COLORS.pre_estoque}      stackId="a" />
                      <Bar dataKey="Em Transferência" fill={STATUS_COLORS.em_transferencia} stackId="a" />
                      <Bar dataKey="Despachado"       fill={STATUS_COLORS.despachado}       stackId="a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cards por pátio */}
          {!yardsLoading && yardStats?.yardStats?.length > 0 && (
            <div>
              <SectionTitle>Detalhamento por Pátio</SectionTitle>
              <div className="grid gap-3 mt-3 sm:grid-cols-2 lg:grid-cols-3">
                {yardStats.yardStats.map((yard: any) => (
                  <Card key={yard.id} data-testid={`card-yard-${yard.id}`}>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {yard.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{yard.city}, {yard.state}</p>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Total de veículos</span>
                        <span className="text-xl font-bold">{yard.total}</span>
                      </div>
                      <div className="space-y-1.5">
                        {yard.statusBreakdown.map((sb: any) => (
                          <div key={sb.status} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[sb.status] || COLORS.muted }} />
                              <span className="text-muted-foreground">{sb.label}</span>
                            </div>
                            <span className="font-semibold">{sb.count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ TAB: INDICADORES */}
        <TabsContent value="indicadores" className="space-y-5">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <GaugeKPI title="OTD — Entrega no Prazo"  value={ind?.otdRate ?? 0}         icon={Target}      color={COLORS.green}  isLoading={indLoading} description={`${ind?.onTimeCount ?? 0} no prazo / ${ind?.lateCount ?? 0} atrasados`} />
            <GaugeKPI title="OTIF (Prazo + Sem Avaria)" value={ind?.otifRate ?? 0}       icon={ShieldCheck} color={COLORS.blue}   isLoading={indLoading} description={`${ind?.otifCount ?? 0} entregas OTIF`} />
            <GaugeKPI title="Sem Avaria"               value={ind?.damageFreeRate ?? 0} icon={CheckCircle2} color={COLORS.teal}  isLoading={indLoading} description={`${ind?.withDamageCount ?? 0} com avaria registrada`} />
            <KPICard title="Lead Time Médio" value={`${ind?.avgLeadTimeHours ?? 0}h`} subtitle="Da saída à entrega" icon={Timer} color="orange" isLoading={indLoading} testId="kpi-lead-time" />
          </div>

          <Card data-testid="chart-monthly-kpis">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Evolução Mensal dos Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              {indLoading ? <Skeleton className="h-[280px]" /> : !indicadores?.monthlyTrend?.length ? <EmptyChart message="Nenhuma entrega com dados suficientes no período" /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={indicadores.monthlyTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="otd"        name="OTD %"       stroke={COLORS.green}  strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="otif"       name="OTIF %"      stroke={COLORS.blue}   strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="damageFree" name="Sem Avaria %" stroke={COLORS.teal}  strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-testid="chart-lead-time">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Lead Time por Mês (horas)</CardTitle>
              </CardHeader>
              <CardContent>
                {indLoading ? <Skeleton className="h-[200px]" /> : !indicadores?.monthlyTrend?.length ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={indicadores.monthlyTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => `${v}h`} />
                      <Bar dataKey="leadTime" name="Lead Time (h)" fill={COLORS.orange} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card data-testid="summary-indicadores">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Resumo do Período</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {indLoading ? <Skeleton className="h-[200px]" /> : (
                  <>
                    {[
                      { label: "Total de entregas",           value: ind?.totalDelivered ?? 0,       icon: CheckCircle2, color: "text-green-600" },
                      { label: "Entregas no prazo (OTD)",     value: ind?.onTimeCount ?? 0,          icon: Target,       color: "text-green-600" },
                      { label: "Entregas atrasadas",          value: ind?.lateCount ?? 0,            icon: AlertTriangle, color: ind?.lateCount > 0 ? "text-amber-600" : "text-muted-foreground" },
                      { label: "Com avaria",                  value: ind?.withDamageCount ?? 0,      icon: AlertCircle,  color: ind?.withDamageCount > 0 ? "text-red-600" : "text-muted-foreground" },
                      { label: "Dados insuficientes",         value: ind?.insufficientDataCount ?? 0, icon: CircleDot,   color: "text-muted-foreground" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <row.icon className={`h-4 w-4 ${row.color}`} />
                          <span className="text-muted-foreground">{row.label}</span>
                        </div>
                        <span className={`font-semibold ${row.color}`}>{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════ TAB: MOTORISTAS */}
        <TabsContent value="motoristas" className="space-y-5">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <KPICard title="Motoristas Ativos" value={m?.totalDrivers ?? 0} icon={Users} color="purple" isLoading={analyticsLoading} testId="kpi-drivers-active" />
            <KPICard title="Tempo Médio Entrega" value={`${m?.avgDeliveryTimeHours ?? 0}h`} subtitle="Após saída do pátio" icon={Timer} color="orange" isLoading={analyticsLoading} testId="kpi-avg-delivery" />
            <KPICard title="Entregas no Prazo" value={`${m?.deliveryRate ?? 0}%`} subtitle={`${m?.onTimeDeliveries ?? 0} de ${m?.totalDeliveredWithDate ?? 0} com data`} icon={Target} color="green" isLoading={analyticsLoading} testId="kpi-delivery-rate" />
          </div>

          <Card data-testid="chart-driver-performance">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Performance por Motorista</CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? <Skeleton className="h-[300px]" /> : !analytics?.driverPerformance?.length ? <EmptyChart message="Sem dados de performance no período" /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.driverPerformance} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="entregues"  name="Entregues"   fill={COLORS.green}  stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="emAndamento" name="Em Andamento" fill={COLORS.blue} stackId="a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {analytics?.driverPerformance?.length > 0 && (
            <Card data-testid="table-driver-ranking">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Ranking de Motoristas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {analytics.driverPerformance.map((d: any, i: number) => (
                    <div key={i} className="py-2.5 flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <Progress value={d.total > 0 ? (d.entregues / d.total) * 100 : 0} className="h-1.5 mt-1" />
                      </div>
                      <div className="flex gap-3 shrink-0 text-xs">
                        <div className="text-center">
                          <p className="font-bold text-green-600">{d.entregues}</p>
                          <p className="text-muted-foreground">Entregues</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-blue-600">{d.emAndamento}</p>
                          <p className="text-muted-foreground">Andamento</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold">{d.total}</p>
                          <p className="text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
