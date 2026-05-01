import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FileBarChart,
  Warehouse,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Loader2,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VehicleBilling {
  chassi: string;
  clientId: string | null;
  clientName: string;
  yardId: string | null;
  yardName: string;
  entryDate: string | null;
  daysInStock: number;
  billableDays: number;
  graceDays: number;
  dailyCost: number;
  totalCost: number;
}

interface ClientGroup {
  clientId: string | null;
  clientName: string;
  dailyCost: number;
  vehicles: VehicleBilling[];
  totalDays: number;
  totalCost: number;
}

interface YardBillingReport {
  clientGroups: ClientGroup[];
  summary: {
    totalVehicles: number;
    totalDays: number;
    grandTotal: number;
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function ClientGroupCard({ group }: { group: ClientGroup }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">{group.clientName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {group.vehicles.length} veículo{group.vehicles.length !== 1 ? "s" : ""} em estoque
                    {group.dailyCost > 0 && ` • Diária: ${formatCurrency(group.dailyCost)}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(group.totalCost)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.totalDays} dia{group.totalDays !== 1 ? "s" : ""} total
                </p>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chassi</TableHead>
                  <TableHead>Pátio</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="text-center">Dias</TableHead>
                  <TableHead className="text-right">Diária</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.vehicles.map((vehicle) => (
                  <TableRow key={vehicle.chassi} data-testid={`row-vehicle-${vehicle.chassi}`}>
                    <TableCell className="font-mono text-sm">
                      {vehicle.chassi}
                    </TableCell>
                    <TableCell>{vehicle.yardName}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(vehicle.entryDate)}
                    </TableCell>
                    <TableCell className="text-center">
                      {vehicle.graceDays > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge variant="secondary">{vehicle.billableDays} cobr.</Badge>
                          <span className="text-xs text-muted-foreground">{vehicle.daysInStock} total</span>
                        </div>
                      ) : (
                        <Badge variant="secondary">{vehicle.daysInStock}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(vehicle.dailyCost)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(vehicle.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function YardReportPage() {
  const { data, isLoading } = useQuery<YardBillingReport>({
    queryKey: ["/api/reports/yard-billing"],
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Relatório de Pátio"
        breadcrumbs={[
          { label: "Financeiro", href: "/" },
          { label: "Relatório de Pátio" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Veículos em Estoque
                </CardTitle>
                <Warehouse className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <p className="text-3xl font-bold" data-testid="text-total-vehicles">
                    {data?.summary.totalVehicles || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    veículos armazenados
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de Dias
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <p className="text-3xl font-bold" data-testid="text-total-days">
                    {data?.summary.totalDays || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    dias acumulados
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total a Cobrar
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <p className="text-3xl font-bold text-green-600" data-testid="text-grand-total">
                    {formatCurrency(data?.summary.grandTotal || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    valor total
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando relatório...</p>
            </CardContent>
          </Card>
        ) : data?.clientGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileBarChart className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Nenhum veículo em estoque</h3>
              <p className="max-w-md mx-auto">
                Não há veículos com status "Em Estoque" para calcular cobrança.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-4">Detalhamento por Cliente</h2>
            {data?.clientGroups.map((group) => (
              <ClientGroupCard
                key={group.clientId || "no-client"}
                group={group}
              />
            ))}

            <Card className="mt-6 bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">Total Geral</p>
                      <p className="text-sm text-muted-foreground">
                        {data?.summary.totalVehicles} veículos •{" "}
                        {data?.summary.totalDays} dias
                      </p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-primary" data-testid="text-summary-total">
                    {formatCurrency(data?.summary.grandTotal || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
