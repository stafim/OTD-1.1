import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Wifi,
  WifiOff,
  Users,
  MapPin,
  Clock,
  RefreshCw,
  Phone,
  Mail,
  Globe,
  Building2,
  Navigation,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DriverStatus {
  userId: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  driverType: string | null;
  isOnline: boolean;
  isActive: boolean;
  lastLogin: string | null;
  refreshTokenVersion: string | null;
  profilePhoto: string | null;
}

interface StatusOverview {
  totalDrivers: number;
  onlineCount: number;
  offlineCount: number;
  inactiveCount: number;
  onlineDrivers: DriverStatus[];
  offlineDrivers: DriverStatus[];
  byState: Record<string, number>;
  byRegion: Record<string, number>;
}

interface NearbyDriver {
  driverId: string;
  name: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  driverType: string | null;
  profilePhoto: string | null;
  distanceKm: number;
  lastLogin: string | null;
}

interface YardNearby {
  yardId: string;
  yardName: string;
  yardCity: string | null;
  yardState: string | null;
  nearbyCount: number;
  drivers: NearbyDriver[];
}

const regionColors: Record<string, string> = {
  Norte: "bg-emerald-500",
  Nordeste: "bg-amber-500",
  "Centro-Oeste": "bg-blue-500",
  Sudeste: "bg-violet-500",
  Sul: "bg-rose-500",
  "N/D": "bg-gray-400",
};

const stateNames: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function DriverStatusPage() {
  const { data, isLoading, isError } = useQuery<StatusOverview>({
    queryKey: ["/api/drivers/status-overview"],
    refetchInterval: 30000,
  });

  const { data: nearYards } = useQuery<YardNearby[]>({
    queryKey: ["/api/drivers/near-yards"],
    refetchInterval: 30000,
  });

  if (isLoading || isError || !data) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader
          title="Status dos Motoristas"
          breadcrumbs={[{ label: "Motoristas", href: "/motoristas" }, { label: "Status dos Motoristas" }]}
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const overview = data;
  const onlinePercentage = overview.totalDrivers > 0 ? Math.round((overview.onlineCount / overview.totalDrivers) * 100) : 0;

  const sortedStates = Object.entries(overview.byState).sort((a, b) => b[1] - a[1]);
  const sortedRegions = Object.entries(overview.byRegion).sort((a, b) => b[1] - a[1]);
  const maxRegionCount = sortedRegions.length > 0 ? sortedRegions[0][1] : 1;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Status dos Motoristas"
        breadcrumbs={[{ label: "Motoristas", href: "/motoristas" }, { label: "Status dos Motoristas" }]}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <Wifi className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400" data-testid="count-online">{overview.onlineCount}</p>
                  <p className="text-sm text-muted-foreground">Online</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${onlinePercentage}%` }} />
                </div>
                <span className="text-xs font-medium text-emerald-600">{onlinePercentage}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gray-500/10 flex items-center justify-center">
                  <WifiOff className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold" data-testid="count-offline">{overview.offlineCount}</p>
                  <p className="text-sm text-muted-foreground">Offline</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold" data-testid="count-total">{overview.totalDrivers}</p>
                  <p className="text-sm text-muted-foreground">Total Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-3xl font-bold" data-testid="count-states">{Object.keys(overview.byState).filter(s => s !== "N/D").length}</p>
                  <p className="text-sm text-muted-foreground">Estados com Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {nearYards && nearYards.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                Motoristas Online Próximos dos Pátios
                <Badge variant="secondary" className="ml-auto">
                  Raio de 100km
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nearYards.map(yard => (
                  <div key={yard.yardId} className="rounded-xl border bg-card p-4 space-y-3" data-testid={`yard-nearby-${yard.yardId}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{yard.yardName}</p>
                        <p className="text-xs text-muted-foreground">
                          {yard.yardCity}/{yard.yardState}
                        </p>
                      </div>
                      <Badge variant={yard.nearbyCount > 0 ? "default" : "outline"} className="ml-auto flex-shrink-0">
                        {yard.nearbyCount}
                      </Badge>
                    </div>

                    {yard.drivers.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Nenhum motorista online próximo</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {yard.drivers.map(driver => (
                          <div key={driver.driverId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors" data-testid={`yard-driver-${driver.driverId}`}>
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              {driver.profilePhoto && <AvatarImage src={driver.profilePhoto} />}
                              <AvatarFallback className="bg-emerald-500/10 text-emerald-700 text-[9px] font-bold">
                                {getInitials(driver.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{driver.name}</p>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                {driver.city && driver.state && (
                                  <span className="truncate">{driver.city}/{driver.state}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                              <Navigation className="h-3 w-3" />
                              <span className="font-medium">{driver.distanceKm} km</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-emerald-500" />
                  Motoristas Online
                  <Badge variant="secondary" className="ml-auto">{overview.onlineCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.onlineDrivers.length === 0 ? (
                  <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                    <WifiOff className="h-5 w-5" />
                    <p className="text-sm">Nenhum motorista online no momento</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {overview.onlineDrivers.map(driver => (
                      <div key={driver.userId} className="flex items-center gap-3 p-3 rounded-lg border bg-emerald-500/[0.02] hover:bg-emerald-500/5 transition-colors" data-testid={`driver-online-${driver.userId}`}>
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            {driver.profilePhoto && <AvatarImage src={driver.profilePhoto} />}
                            <AvatarFallback className="bg-emerald-500/10 text-emerald-700 text-xs font-bold">
                              {getInitials(driver.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">{driver.name}</p>
                            {driver.driverType && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {driver.driverType === "coleta" ? "Coleta" : "Transporte"}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {driver.city && driver.state && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {driver.city}/{driver.state}
                              </span>
                            )}
                            {driver.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {driver.phone}
                              </span>
                            )}
                            {driver.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3" />
                                {driver.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {driver.lastLogin
                              ? formatDistanceToNow(new Date(driver.lastLogin), { addSuffix: true, locale: ptBR })
                              : "—"}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5">
                            <RefreshCw className="h-2.5 w-2.5" />
                            {driver.refreshTokenVersion
                              ? format(new Date(driver.refreshTokenVersion), "dd/MM HH:mm", { locale: ptBR })
                              : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-gray-400" />
                  Motoristas Offline
                  <Badge variant="outline" className="ml-auto">{overview.offlineCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.offlineDrivers.length === 0 ? (
                  <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                    <Wifi className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm">Todos os motoristas estão online!</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {overview.offlineDrivers.map(driver => (
                      <div key={driver.userId} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors" data-testid={`driver-offline-${driver.userId}`}>
                        <Avatar className="h-8 w-8">
                          {driver.profilePhoto && <AvatarImage src={driver.profilePhoto} />}
                          <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold">
                            {getInitials(driver.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {driver.city && driver.state ? `${driver.city}/${driver.state}` : "Localização não informada"}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {driver.lastLogin
                              ? formatDistanceToNow(new Date(driver.lastLogin), { addSuffix: true, locale: ptBR })
                              : "Nunca logou"}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 mt-0.5">
                            <RefreshCw className="h-2.5 w-2.5" />
                            {driver.refreshTokenVersion
                              ? format(new Date(driver.refreshTokenVersion), "dd/MM HH:mm", { locale: ptBR })
                              : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-500" />
                  Distribuição por Região
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedRegions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados de região</p>
                ) : (
                  sortedRegions.map(([region, count]) => (
                    <div key={region} className="space-y-1" data-testid={`region-${region}`}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${regionColors[region] || "bg-gray-400"}`} />
                          <span className="font-medium">{region}</span>
                        </div>
                        <span className="font-bold">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${regionColors[region] || "bg-gray-400"}`}
                          style={{ width: `${(count / maxRegionCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-violet-500" />
                  Distribuição por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sortedStates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem dados de estado</p>
                ) : (
                  <div className="space-y-2">
                    {sortedStates.map(([state, count]) => (
                      <div key={state} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40" data-testid={`state-${state}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-8 justify-center text-xs font-bold">{state}</Badge>
                          <span className="text-sm">{stateNames[state] || state}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                              <div key={i} className="h-2 w-2 rounded-full bg-emerald-500 -ml-0.5 first:ml-0" />
                            ))}
                            {count > 5 && <span className="text-[10px] text-muted-foreground ml-1">+{count - 5}</span>}
                          </div>
                          <span className="text-sm font-bold w-6 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
