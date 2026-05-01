import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  DollarSign,
  Fuel,
  Route,
  Truck,
  Shield,
  Receipt,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CotacaoFretePage() {
  const [valorBem, setValorBem] = useState("500000");
  const [distanciaKm, setDistanciaKm] = useState("500");
  const [freteOtd, setFreteOtd] = useState("1200");
  const [retornoMotorista, setRetornoMotorista] = useState("400");
  const [pedagio, setPedagio] = useState("189");
  const [consumoVeiculo, setConsumoVeiculo] = useState("2.5");
  const [precoDiesel, setPrecoDiesel] = useState("6.00");

  const calc = useMemo(() => {
    const vBem = parseFloat(valorBem) || 0;
    const dist = parseFloat(distanciaKm) || 0;
    const fOtd = parseFloat(freteOtd) || 0;
    const retorno = parseFloat(retornoMotorista) || 0;
    const ped = parseFloat(pedagio) || 0;
    const consumo = parseFloat(consumoVeiculo) || 1;
    const diesel = parseFloat(precoDiesel) || 6;

    const comissaoMotorista = 0.50 * dist;
    const custoDiesel = (dist / consumo) * diesel;
    const seguro = vBem * 0.0003;
    const valorBase = comissaoMotorista + custoDiesel + retorno + seguro + ped + fOtd;
    const TAX_RATE = 0.2125;
    const valorTotalCte = valorBase / (1 - TAX_RATE);
    const impostos = valorTotalCte - valorBase;
    const margem = valorTotalCte > 0 ? ((valorTotalCte - valorBase) / valorTotalCte) * 100 : 0;

    return {
      comissaoMotorista,
      custoDiesel,
      seguro,
      valorBase,
      valorTotalCte,
      impostos,
      margem,
      freteOtd: fOtd,
      retorno,
      pedagio: ped,
    };
  }, [valorBem, distanciaKm, freteOtd, retornoMotorista, pedagio, consumoVeiculo, precoDiesel]);

  const chartData = useMemo(() => {
    const items = [
      { name: "Frete OTD", value: calc.freteOtd, color: "#f97316" },
      { name: "Comissão Motorista", value: calc.comissaoMotorista, color: "#3b82f6" },
      { name: "Diesel", value: calc.custoDiesel, color: "#eab308" },
      { name: "Retorno Motorista", value: calc.retorno, color: "#8b5cf6" },
      { name: "Seguro", value: calc.seguro, color: "#06b6d4" },
      { name: "Pedágio", value: calc.pedagio, color: "#10b981" },
      { name: "Impostos (21,25%)", value: calc.impostos, color: "#ef4444" },
    ];
    return items.filter(i => i.value > 0);
  }, [calc]);

  const handleReset = () => {
    setValorBem("500000");
    setDistanciaKm("500");
    setFreteOtd("1200");
    setRetornoMotorista("400");
    setPedagio("189");
    setConsumoVeiculo("2.5");
    setPrecoDiesel("6.00");
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Cotação de Frete"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Cotação de Frete" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calculator className="h-5 w-5 text-primary" />
                    Dados da Cotação
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Resetar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-cyan-500" />
                      Valor do Bem (R$)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="1000"
                      value={valorBem}
                      onChange={(e) => setValorBem(e.target.value)}
                      placeholder="500000"
                      data-testid="input-valor-bem"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Route className="h-3.5 w-3.5 text-blue-500" />
                      Distância (km rota)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={distanciaKm}
                      onChange={(e) => setDistanciaKm(e.target.value)}
                      placeholder="500"
                      data-testid="input-distancia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-orange-500" />
                      Frete OTD (R$)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={freteOtd}
                      onChange={(e) => setFreteOtd(e.target.value)}
                      placeholder="1200"
                      data-testid="input-frete-otd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-purple-500" />
                      Retorno Motorista (R$)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={retornoMotorista}
                      onChange={(e) => setRetornoMotorista(e.target.value)}
                      placeholder="400"
                      data-testid="input-retorno"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-green-500" />
                      Pedágio (R$)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={pedagio}
                      onChange={(e) => setPedagio(e.target.value)}
                      placeholder="189"
                      data-testid="input-pedagio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Fuel className="h-3.5 w-3.5 text-yellow-500" />
                      Consumo do Veículo (km/l)
                    </Label>
                    <Input
                      type="number"
                      min="0.1"
                      max="50"
                      step="0.1"
                      value={consumoVeiculo}
                      onChange={(e) => setConsumoVeiculo(e.target.value)}
                      placeholder="2.5"
                      data-testid="input-consumo"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="flex items-center gap-1.5">
                      <Fuel className="h-3.5 w-3.5 text-amber-600" />
                      Preço do Diesel (R$/litro)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.10"
                      value={precoDiesel}
                      onChange={(e) => setPrecoDiesel(e.target.value)}
                      placeholder="6.00"
                      className="sm:max-w-xs"
                      data-testid="input-preco-diesel"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Detalhamento dos Custos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md divide-y">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-sm">Frete OTD</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-frete-otd">{formatCurrency(calc.freteOtd)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm">Comissão Motorista (R$ 0,50 x km)</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-comissao">{formatCurrency(calc.comissaoMotorista)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm">Diesel ({distanciaKm} km / {consumoVeiculo} km/l x R$ {precoDiesel})</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-diesel">{formatCurrency(calc.custoDiesel)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-sm">Retorno Motorista</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-retorno">{formatCurrency(calc.retorno)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500" />
                      <span className="text-sm">Seguro (Valor do Bem x 0,03%)</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-seguro">{formatCurrency(calc.seguro)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm">Pedágio</span>
                    </div>
                    <span className="text-sm font-medium" data-testid="text-pedagio">{formatCurrency(calc.pedagio)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50">
                    <span className="text-sm font-semibold">Valor Base (soma dos custos)</span>
                    <span className="text-sm font-bold" data-testid="text-valor-base">{formatCurrency(calc.valorBase)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm">Impostos PIS/Cofins/ISS (21,25%)</span>
                    </div>
                    <span className="text-sm font-medium text-red-600" data-testid="text-impostos">{formatCurrency(calc.impostos)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-primary/5">
                    <span className="text-sm font-bold">Valor Total CTe</span>
                    <span className="text-base font-bold text-primary" data-testid="text-valor-total">{formatCurrency(calc.valorTotalCte)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Valor Total do CTe</p>
                <p className="text-3xl font-bold text-primary" data-testid="text-cte-destaque">
                  {formatCurrency(calc.valorTotalCte)}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Margem: <strong className="text-foreground">{calc.margem.toFixed(2)}%</strong>
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resumo Rápido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Base</span>
                  <span className="font-medium">{formatCurrency(calc.valorBase)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Impostos</span>
                  <span className="font-medium text-red-600">{formatCurrency(calc.impostos)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margem</span>
                  <Badge variant={calc.margem >= 15 ? "default" : "destructive"} className="text-xs">
                    {calc.margem.toFixed(2)}%
                  </Badge>
                </div>
                <div className="border-t pt-3 flex justify-between text-sm">
                  <span className="font-semibold">Total CTe</span>
                  <span className="font-bold text-primary">{formatCurrency(calc.valorTotalCte)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição de Custos</CardTitle>
              </CardHeader>
              <CardContent>
                {calc.valorTotalCte > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="45%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconSize={10}
                        wrapperStyle={{ fontSize: "11px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Preencha os dados para ver o gráfico
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fórmulas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li><strong>Comissão:</strong> R$ 0,50 x km da rota</li>
                  <li><strong>Diesel:</strong> (km / consumo) x preço do litro</li>
                  <li><strong>Seguro:</strong> Valor do Bem x 0,03%</li>
                  <li><strong>Valor Base:</strong> soma de todos os custos</li>
                  <li><strong>CTe:</strong> Valor Base / 0,7835</li>
                  <li><strong>Impostos:</strong> CTe - Valor Base (21,25%)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
