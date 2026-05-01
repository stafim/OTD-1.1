import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, DollarSign, Users, Clock } from "lucide-react";

export default function FinesControlPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Controle de Multas"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Controle de Multas" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Multas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">multas registradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">R$ 0,00</p>
              <p className="text-xs text-muted-foreground mt-1">em multas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Motoristas</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">com multas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-muted-foreground mt-1">aguardando pagamento</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium mb-2">Controle de Multas</h3>
            <p className="max-w-md mx-auto">
              Em breve você poderá registrar e acompanhar multas de trânsito dos motoristas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
