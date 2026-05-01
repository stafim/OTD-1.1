import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  Users,
  Trophy,
  TrendingUp,
  TrendingDown,
  Star,
  Truck,
  MapPin,
  Calendar,
  Search,
  AlertTriangle,
  Award,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

interface DriverRankingData {
  id: string;
  name: string;
  cpf: string;
  city: string | null;
  state: string | null;
  birthDate: string | null;
  modality: string;
  totalTrips: number;
  tripsLastMonth: number;
  averageScore: number | null;
  totalEvaluations: number;
  incidentCount: number;
}

interface RankingStats {
  totalDrivers: number;
  activeDrivers: number;
  totalTrips: number;
  averageScore: number;
  driversWithEvaluations: number;
}

interface RankingResponse {
  stats: RankingStats;
  drivers: DriverRankingData[];
  topDrivers: DriverRankingData[];
  bottomDrivers: DriverRankingData[];
  mostIncidents: DriverRankingData[];
  leastIncidents: DriverRankingData[];
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function ScoreRating({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-muted-foreground">Sem avaliacao</span>;
  }

  const getColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-yellow-600";
    if (s >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (s >= 60) return "bg-yellow-100 dark:bg-yellow-900/30";
    if (s >= 40) return "bg-orange-100 dark:bg-orange-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  return (
    <div className="flex items-center gap-1">
      <div className={`px-2 py-0.5 rounded ${getBgColor(score)}`}>
        <span className={`text-xs font-bold ${getColor(score)}`}>{score.toFixed(1)}</span>
      </div>
      <span className="text-xs text-muted-foreground">pts</span>
    </div>
  );
}

function RankingBadge({ position, type }: { position: number; type: "top" | "bottom" }) {
  const colors = type === "top" 
    ? position === 1 ? "bg-yellow-500" : position === 2 ? "bg-gray-400" : position === 3 ? "bg-amber-600" : "bg-primary"
    : "bg-red-500";
  
  return (
    <div className={`${colors} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center`}>
      {position}
    </div>
  );
}

export default function DriverRankingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery<RankingResponse>({
    queryKey: ["/api/driver-ranking"],
  });

  const filteredDrivers = data?.drivers.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.city?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <PageHeader title="Ranking de Motoristas" />

      {isLoading ? (
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
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data?.stats.totalDrivers || 0}</p>
                    <p className="text-xs text-muted-foreground">Total de Motoristas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Truck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data?.stats.totalTrips || 0}</p>
                    <p className="text-xs text-muted-foreground">Viagens Realizadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Star className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data?.stats.averageScore?.toFixed(1) || "-"}<span className="text-sm text-muted-foreground font-normal">/100</span></p>
                    <p className="text-xs text-muted-foreground">Nota Media Geral</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Award className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data?.stats.driversWithEvaluations || 0}</p>
                    <p className="text-xs text-muted-foreground">Motoristas Avaliados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Top 10 Melhores Motoristas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data?.topDrivers.map((driver, index) => (
                    <div key={driver.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <RankingBadge position={index + 1} type="top" />
                        <div>
                          <p className="font-medium text-sm">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.city || "-"}, {driver.state || "-"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <ScoreRating score={driver.averageScore} />
                        <p className="text-xs text-muted-foreground">{driver.totalTrips} viagens</p>
                      </div>
                    </div>
                  ))}
                  {(!data?.topDrivers || data.topDrivers.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum motorista avaliado ainda</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  10 Motoristas com Menor Nota
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data?.bottomDrivers.map((driver, index) => (
                    <div key={driver.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <RankingBadge position={index + 1} type="bottom" />
                        <div>
                          <p className="font-medium text-sm">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.city || "-"}, {driver.state || "-"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <ScoreRating score={driver.averageScore} />
                        <p className="text-xs text-muted-foreground">{driver.totalTrips} viagens</p>
                      </div>
                    </div>
                  ))}
                  {(!data?.bottomDrivers || data.bottomDrivers.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum motorista avaliado ainda</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  Menos Incidentes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data?.leastIncidents.map((driver, index) => (
                    <div key={driver.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.totalTrips} viagens realizadas</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {driver.incidentCount} incidentes
                      </Badge>
                    </div>
                  ))}
                  {(!data?.leastIncidents || data.leastIncidents.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponivel</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  Mais Incidentes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data?.mostIncidents.map((driver, index) => (
                    <div key={driver.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{driver.name}</p>
                          <p className="text-xs text-muted-foreground">{driver.totalTrips} viagens realizadas</p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-xs">
                        {driver.incidentCount} incidentes
                      </Badge>
                    </div>
                  ))}
                  {(!data?.mostIncidents || data.mostIncidents.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponivel</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Lista Completa de Motoristas
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar motorista..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-driver"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <div className="grid grid-cols-7 gap-2 p-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <div>Nome</div>
                  <div>Idade</div>
                  <div>Cidade</div>
                  <div className="text-center">Viagens Total</div>
                  <div className="text-center">Ultimo Mes</div>
                  <div className="text-center">Nota</div>
                  <div className="text-center">Incidentes</div>
                </div>
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {filteredDrivers.map((driver) => (
                    <div key={driver.id} className="grid grid-cols-7 gap-2 p-3 items-center text-sm hover-elevate">
                      <div className="font-medium truncate">{driver.name}</div>
                      <div className="text-muted-foreground">
                        {calculateAge(driver.birthDate) ? `${calculateAge(driver.birthDate)} anos` : "-"}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {driver.city ? `${driver.city}/${driver.state}` : "-"}
                      </div>
                      <div className="text-center">
                        <Badge variant="secondary">{driver.totalTrips}</Badge>
                      </div>
                      <div className="text-center">
                        <Badge variant="outline">{driver.tripsLastMonth}</Badge>
                      </div>
                      <div className="flex justify-center">
                        <ScoreRating score={driver.averageScore} />
                      </div>
                      <div className="text-center">
                        {driver.incidentCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {driver.incidentCount}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">0</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredDrivers.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      Nenhum motorista encontrado
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
