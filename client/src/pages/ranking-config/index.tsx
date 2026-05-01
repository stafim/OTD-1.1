import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, PackageCheck, Clock, Save, RotateCcw, Trophy, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

type RankingConfig = {
  id: string;
  ratingWeight: number;
  tripsWeight: number;
  responseTimeWeight: number;
  updatedAt: string;
};

const CRITERIA = [
  {
    key: "ratingWeight" as const,
    label: "Nota do Motorista",
    description: "Peso da avaliação média do motorista. Motoristas com nota mais alta sobem no ranking.",
    icon: Star,
    iconClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    example: "Nota 4.8 > Nota 3.2",
  },
  {
    key: "tripsWeight" as const,
    label: "Quantidade de Transportes",
    description: "Peso baseado em disponibilidade. Motoristas com menos transportes no mês têm prioridade.",
    icon: PackageCheck,
    iconClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
    example: "2 viagens < 8 viagens (mais aderente)",
  },
  {
    key: "responseTimeWeight" as const,
    label: "Rapidez na Resposta",
    description: "Peso de quem aceitou primeiro. Motoristas que responderam mais cedo têm vantagem.",
    icon: Clock,
    iconClass: "text-green-500",
    bgClass: "bg-green-500/10",
    example: "Aceitou às 08:00 > Aceitou às 14:00",
  },
];

function WeightLabel({ value }: { value: number }) {
  if (value === 0) return <Badge variant="secondary" className="text-xs">Ignorado</Badge>;
  if (value <= 3) return <Badge variant="outline" className="text-xs border-slate-300">Baixo</Badge>;
  if (value <= 6) return <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">Médio</Badge>;
  if (value <= 8) return <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">Alto</Badge>;
  return <Badge className="text-xs bg-green-600">Máximo</Badge>;
}

export default function RankingConfigPage() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<RankingConfig>({
    queryKey: ["/api/driver-ranking-config"],
  });

  const [weights, setWeights] = useState({
    ratingWeight: 5,
    tripsWeight: 5,
    responseTimeWeight: 5,
  });

  useEffect(() => {
    if (config) {
      setWeights({
        ratingWeight: config.ratingWeight,
        tripsWeight: config.tripsWeight,
        responseTimeWeight: config.responseTimeWeight,
      });
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/driver-ranking-config", weights),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-ranking-config"] });
      toast({ title: "Configuração salva com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const total = weights.ratingWeight + weights.tripsWeight + weights.responseTimeWeight;

  const getPercent = (w: number) => total === 0 ? 0 : Math.round((w / total) * 100);

  const handleReset = () => {
    setWeights({ ratingWeight: 5, tripsWeight: 5, responseTimeWeight: 5 });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Configuração de Ranking de Motoristas"
        description="Defina os pesos de cada critério para ordenar motoristas aceitos em propostas"
        icon={<Trophy className="h-5 w-5 text-amber-500" />}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                O sistema calcula uma pontuação ponderada para cada motorista aceito em uma proposta, com base nos três critérios abaixo. Ajuste os pesos (0 a 10) para refletir a prioridade do seu negócio. Um peso 0 ignora completamente aquele critério.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          {CRITERIA.map((c) => {
            const Icon = c.icon;
            const value = weights[c.key];
            const pct = getPercent(value);
            return (
              <Card key={c.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${c.bgClass}`}>
                        <Icon className={`h-4.5 w-4.5 ${c.iconClass}`} />
                      </span>
                      <div>
                        <CardTitle className="text-base">{c.label}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{c.example}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <WeightLabel value={value} />
                      <div className="text-right">
                        <span className="text-2xl font-bold tabular-nums">{value}</span>
                        <span className="text-xs text-muted-foreground ml-1">/ 10</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Slider
                    min={0}
                    max={10}
                    step={1}
                    value={[value]}
                    onValueChange={([v]) => setWeights(w => ({ ...w, [c.key]: v }))}
                    className="w-full"
                    data-testid={`slider-${c.key}`}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                    <span className="text-xs font-semibold text-muted-foreground shrink-0 ml-4">
                      {pct}% do total
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Distribuição dos Pesos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex rounded-full overflow-hidden h-4 gap-0.5">
              {CRITERIA.map((c) => {
                const pct = getPercent(weights[c.key]);
                return pct > 0 ? (
                  <div
                    key={c.key}
                    className={`transition-all duration-300 ${
                      c.key === "ratingWeight" ? "bg-amber-400" :
                      c.key === "tripsWeight" ? "bg-blue-400" : "bg-green-400"
                    }`}
                    style={{ width: `${pct}%` }}
                    title={`${c.label}: ${pct}%`}
                  />
                ) : null;
              })}
              {total === 0 && <div className="w-full bg-muted rounded-full" />}
            </div>
            <div className="flex gap-4 flex-wrap">
              {CRITERIA.map((c) => {
                const Icon = c.icon;
                const pct = getPercent(weights[c.key]);
                return (
                  <div key={c.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className={`h-3 w-3 ${c.iconClass}`} />
                    <span>{c.label.split(" ")[0]}</span>
                    <span className="font-semibold text-foreground">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-4">
          <Button variant="outline" onClick={handleReset} className="gap-2" data-testid="button-reset-weights">
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-weights"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Configuração
          </Button>
        </div>
      </div>
    </div>
  );
}
