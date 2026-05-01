import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface FinancialStats {
  totalEstimated: number;
  totalActual: number;
  totalDifference: number;
  differencePercent: number;
  avgDifference: number;
  avgDifferencePercent: number;
  totalSettlements: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvalRate: number;
}

interface MonthlyData {
  month: string;
  estimated: number;
  actual: number;
  difference: number;
}

interface TopOffender {
  driverName: string;
  driverId: string;
  transportRequestNumber: string;
  estimated: number;
  actual: number;
  difference: number;
  differencePercent: number;
}

interface ExpenseTypeBreakdown {
  type: string;
  label: string;
  total: number;
  count: number;
}

interface FinancialDashboardData {
  stats: FinancialStats;
  monthlyData: MonthlyData[];
  topOverspenders: TopOffender[];
  topUnderspenders: TopOffender[];
  expenseBreakdown: ExpenseTypeBreakdown[];
  driverRanking: {
    driverName: string;
    totalSettlements: number;
    avgDifference: number;
    totalDifference: number;
  }[];
}

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899", "#14b8a6"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = "blue",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
}) {
  const colorMap = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    yellow: "bg-yellow-500/10 text-yellow-500",
    purple: "bg-purple-500/10 text-purple-500",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{title}</p>
            </div>
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-muted-foreground"}`}>
              {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
              {trendValue}
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function FinancialDashboardPage() {
  const { data, isLoading } = useQuery<FinancialDashboardData>({
    queryKey: ["/api/financial-dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        <PageHeader title="Dashboard Financeiro" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const differenceIsPositive = (stats?.totalDifference || 0) > 0;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <PageHeader title="Dashboard Financeiro" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Previsto"
          value={formatCurrency(stats?.totalEstimated || 0)}
          icon={DollarSign}
          color="blue"
          subtitle={`${stats?.totalSettlements || 0} prestacoes`}
        />
        <StatCard
          title="Total Realizado"
          value={formatCurrency(stats?.totalActual || 0)}
          icon={DollarSign}
          color={differenceIsPositive ? "red" : "green"}
        />
        <StatCard
          title="Diferenca Total"
          value={formatCurrency(Math.abs(stats?.totalDifference || 0))}
          icon={differenceIsPositive ? TrendingUp : TrendingDown}
          color={differenceIsPositive ? "red" : "green"}
          trend={differenceIsPositive ? "up" : "down"}
          trendValue={`${Math.abs(stats?.differencePercent || 0).toFixed(1)}%`}
          subtitle={differenceIsPositive ? "Acima do previsto" : "Abaixo do previsto"}
        />
        <StatCard
          title="Media por Prestacao"
          value={formatCurrency(Math.abs(stats?.avgDifference || 0))}
          icon={Percent}
          color="purple"
          subtitle={`${stats?.avgDifferencePercent?.toFixed(1) || 0}% de variacao media`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Taxa de Aprovacao"
          value={`${stats?.approvalRate?.toFixed(0) || 0}%`}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Aprovadas"
          value={String(stats?.approvedCount || 0)}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Pendentes"
          value={String(stats?.pendingCount || 0)}
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Rejeitadas"
          value={String(stats?.rejectedCount || 0)}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previsto vs Realizado por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: "var(--foreground)" }}
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                  />
                  <Legend />
                  <Bar dataKey="estimated" name="Previsto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Realizado" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuicao por Tipo de Despesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.expenseBreakdown || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="total"
                    nameKey="label"
                    label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data?.expenseBreakdown?.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-500" />
              Maiores Excessos (Acima do Previsto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data?.topOverspenders?.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.driverName}</p>
                      <p className="text-xs text-muted-foreground">{item.transportRequestNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-500">+{formatCurrency(item.difference)}</p>
                    <p className="text-xs text-muted-foreground">+{item.differencePercent.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
              {(!data?.topOverspenders || data.topOverspenders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum excesso registrado</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              Maiores Economias (Abaixo do Previsto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data?.topUnderspenders?.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.driverName}</p>
                      <p className="text-xs text-muted-foreground">{item.transportRequestNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-500">{formatCurrency(item.difference)}</p>
                    <p className="text-xs text-muted-foreground">{item.differencePercent.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
              {(!data?.topUnderspenders || data.topUnderspenders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma economia registrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ranking de Motoristas por Discrepancia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <div className="grid grid-cols-4 gap-2 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
              <div>Motorista</div>
              <div className="text-center">Prestacoes</div>
              <div className="text-center">Diferenca Media</div>
              <div className="text-center">Diferenca Total</div>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {data?.driverRanking?.map((driver, index) => (
                <div key={index} className="grid grid-cols-4 gap-2 p-3 items-center text-sm">
                  <div className="font-medium truncate">{driver.driverName}</div>
                  <div className="text-center">
                    <Badge variant="secondary">{driver.totalSettlements}</Badge>
                  </div>
                  <div className="text-center">
                    <Badge variant={driver.avgDifference > 0 ? "destructive" : "secondary"}>
                      {driver.avgDifference > 0 ? "+" : ""}{formatCurrency(driver.avgDifference)}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <span className={driver.totalDifference > 0 ? "text-red-500" : "text-green-500"}>
                      {driver.totalDifference > 0 ? "+" : ""}{formatCurrency(driver.totalDifference)}
                    </span>
                  </div>
                </div>
              ))}
              {(!data?.driverRanking || data.driverRanking.length === 0) && (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum dado disponivel
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolucao da Diferenca Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.monthlyData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "var(--foreground)" }}
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
                />
                <Line
                  type="monotone"
                  dataKey="difference"
                  name="Diferenca"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: "#8b5cf6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
