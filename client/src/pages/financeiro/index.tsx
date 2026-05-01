import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { normalizeImageUrl } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  RotateCcw, 
  FileText, 
  Truck, 
  User, 
  MapPin, 
  Search, 
  XCircle,
  Camera,
  DollarSign,
  Fuel,
  Utensils,
  Wrench,
  Car,
  Building,
  ImageOff,
  Ticket
} from "lucide-react";
import type { 
  ExpenseSettlement, 
  ExpenseSettlementItem, 
  Transport, 
  Driver, 
  Client, 
  DeliveryLocation, 
  Yard 
} from "@shared/schema";

interface ExpenseSettlementWithRelations extends ExpenseSettlement {
  transport?: Transport & {
    client?: Client;
    deliveryLocation?: DeliveryLocation;
    originYard?: Yard;
  };
  driver?: Driver;
  items?: ExpenseSettlementItem[];
}

const expenseTypeLabels: Record<string, { label: string; icon: any }> = {
  pedagio: { label: "Pedágio", icon: Receipt },
  combustivel: { label: "Combustível", icon: Fuel },
  alimentacao: { label: "Alimentação", icon: Utensils },
  hospedagem: { label: "Hospedagem", icon: Building },
  manutencao: { label: "Manutenção", icon: Wrench },
  multa: { label: "Multa", icon: AlertTriangle },
  estacionamento: { label: "Estacionamento", icon: Car },
  lavagem: { label: "Lavagem", icon: Car },
  passagem: { label: "Passagem", icon: Ticket },
  outros: { label: "Outros", icon: Receipt },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock },
  enviado: { label: "Aguardando Análise", variant: "default", icon: Eye },
  devolvido: { label: "Devolvido", variant: "destructive", icon: RotateCcw },
  aprovado: { label: "Aprovado", variant: "outline", icon: CheckCircle },
  assinado: { label: "Assinado", variant: "outline", icon: FileText },
};

export default function FinanceiroPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSettlement, setSelectedSettlement] = useState<ExpenseSettlementWithRelations | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  const { data: settlements, isLoading } = useQuery<ExpenseSettlementWithRelations[]>({
    queryKey: ["/api/expense-settlements"],
  });

  const approveMutation = useMutation({
    mutationFn: async (settlementId: string) => {
      return apiRequest("POST", `/api/expense-settlements/${settlementId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      toast({ title: "Prestação de contas aprovada com sucesso!" });
      setShowDetails(false);
    },
    onError: () => {
      toast({ title: "Erro ao aprovar prestação de contas", variant: "destructive" });
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({ settlementId, reason }: { settlementId: string; reason: string }) => {
      return apiRequest("POST", `/api/expense-settlements/${settlementId}/return`, { returnReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      toast({ title: "Prestação de contas devolvida para o motorista" });
      setShowReturnDialog(false);
      setShowDetails(false);
      setReturnReason("");
    },
    onError: () => {
      toast({ title: "Erro ao devolver prestação de contas", variant: "destructive" });
    },
  });

  const pendingSettlements = settlements?.filter(s => s.status === "enviado") || [];
  const allSettlements = settlements || [];

  const filteredSettlements = (activeTab === "pending" ? pendingSettlements : allSettlements).filter(s => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      s.transport?.requestNumber?.toLowerCase().includes(searchLower) ||
      s.driver?.name?.toLowerCase().includes(searchLower) ||
      s.transport?.vehicleChassi?.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: string | null) => {
    if (!value) return "R$ 0,00";
    const num = parseFloat(value);
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const openDetails = (settlement: ExpenseSettlementWithRelations) => {
    setSelectedSettlement(settlement);
    setShowDetails(true);
  };

  const openReturnDialog = () => {
    setShowReturnDialog(true);
  };

  const handleReturn = () => {
    if (!selectedSettlement || !returnReason.trim()) {
      toast({ title: "Por favor, informe o motivo da devolução", variant: "destructive" });
      return;
    }
    returnMutation.mutate({ settlementId: selectedSettlement.id, reason: returnReason });
  };

  const handleApprove = () => {
    if (!selectedSettlement) return;
    approveMutation.mutate(selectedSettlement.id);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Financeiro - Prestação de Contas" />
        <div className="grid gap-4 mt-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader title="Financeiro - Prestação de Contas" />

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por OTD, motorista ou chassi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-settlements"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {pendingSettlements.length} aguardando
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "all")}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Aguardando Análise ({pendingSettlements.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Receipt className="h-4 w-4" />
              Todas ({allSettlements.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredSettlements.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma prestação de contas encontrada</p>
                  <p className="text-sm">
                    {activeTab === "pending" 
                      ? "Não há prestações aguardando análise no momento"
                      : "Nenhuma prestação de contas registrada"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredSettlements.map(settlement => {
                  const status = statusConfig[settlement.status || "pendente"];
                  const StatusIcon = status.icon;
                  
                  return (
                    <Card 
                      key={settlement.id} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => openDetails(settlement)}
                      data-testid={`card-settlement-${settlement.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge variant={status.variant} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                              </Badge>
                              {settlement.transport?.requestNumber && (
                                <span className="font-mono font-bold text-primary">
                                  {settlement.transport.requestNumber}
                                </span>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{settlement.driver?.name || "Motorista não encontrado"}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">{settlement.transport?.vehicleChassi || "-"}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {settlement.transport?.deliveryLocation?.city || "-"}/
                                  {settlement.transport?.deliveryLocation?.state || "-"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <Camera className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{settlement.items?.length || 0} comprovantes</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-semibold text-green-600">
                                  {formatCurrency(settlement.totalExpenses)}
                                </span>
                              </div>
                              {settlement.submittedAt && (
                                <span className="text-xs text-muted-foreground">
                                  Enviado em {format(new Date(settlement.submittedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <Button variant="ghost" size="icon" data-testid="button-view-settlement">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Prestação de Contas - {selectedSettlement?.transport?.requestNumber}
            </DialogTitle>
            <DialogDescription>
              Analise os comprovantes enviados pelo motorista
            </DialogDescription>
          </DialogHeader>
          
          {selectedSettlement && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Informações do Transporte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Número OTD:</span>
                      <span className="font-mono font-bold">{selectedSettlement.transport?.requestNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chassi:</span>
                      <span className="font-mono">{selectedSettlement.transport?.vehicleChassi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origem:</span>
                      <span>{selectedSettlement.transport?.originYard?.name || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Destino:</span>
                      <span>
                        {selectedSettlement.transport?.deliveryLocation?.name} - 
                        {selectedSettlement.transport?.deliveryLocation?.city}/
                        {selectedSettlement.transport?.deliveryLocation?.state}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span>{selectedSettlement.transport?.client?.name || "-"}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Motorista
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="font-medium">{selectedSettlement.driver?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPF:</span>
                      <span>{selectedSettlement.driver?.cpf}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span>{selectedSettlement.driver?.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modalidade:</span>
                      <Badge variant="outline">
                        {selectedSettlement.driver?.modality?.toUpperCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Resumo Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Distância</p>
                      <p className="font-bold">{selectedSettlement.routeDistance || "-"}</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Pedágios (Est.)</p>
                      <p className="font-bold">{formatCurrency(selectedSettlement.estimatedTolls)}</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Combustível (Est.)</p>
                      <p className="font-bold">{formatCurrency(selectedSettlement.estimatedFuel)}</p>
                    </div>
                    <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Despesas</p>
                      <p className="font-bold text-green-600">{formatCurrency(selectedSettlement.totalExpenses)}</p>
                    </div>
                  </div>
                  
                  {selectedSettlement.driverNotes && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Observações do Motorista:</p>
                      <p className="text-sm">{selectedSettlement.driverNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Comprovantes Enviados ({selectedSettlement.items?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedSettlement.items?.length ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum comprovante enviado
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedSettlement.items.map((item) => {
                        const typeConfig = expenseTypeLabels[item.type] || expenseTypeLabels.outros;
                        const TypeIcon = typeConfig.icon;
                        const hasIssue = item.photoStatus !== "ok";
                        
                        return (
                          <Card 
                            key={item.id} 
                            className={`overflow-hidden ${hasIssue ? "border-destructive" : ""}`}
                          >
                            <div 
                              className="aspect-video bg-muted relative cursor-pointer group"
                              onClick={() => setLightboxPhoto(normalizeImageUrl(item.photoUrl))}
                            >
                              <img
                                src={normalizeImageUrl(item.photoUrl)}
                                alt={typeConfig.label}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  e.currentTarget.nextElementSibling?.classList.remove("hidden");
                                }}
                              />
                              <div className="hidden absolute inset-0 flex items-center justify-center">
                                <ImageOff className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="h-6 w-6 text-white" />
                              </div>
                              {hasIssue && (
                                <Badge 
                                  variant="destructive" 
                                  className="absolute top-2 right-2"
                                >
                                  {item.photoStatus}
                                </Badge>
                              )}
                            </div>
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">{typeConfig.label}</span>
                              </div>
                              <p className="font-bold text-green-600">
                                {formatCurrency(item.amount)}
                              </p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                              {item.photoRejectionReason && (
                                <p className="text-xs text-destructive mt-1">
                                  {item.photoRejectionReason}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedSettlement.status === "devolvido" && selectedSettlement.returnReason && (
                <Card className="border-destructive">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Motivo da Devolução
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedSettlement.returnReason}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            {selectedSettlement?.status === "enviado" && (
              <>
                <Button
                  variant="destructive"
                  onClick={openReturnDialog}
                  disabled={returnMutation.isPending}
                  data-testid="button-return-settlement"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Devolver para Motorista
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-settlement"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovar Prestação
                </Button>
              </>
            )}
            {selectedSettlement?.status === "aprovado" && (
              <Button
                variant="outline"
                data-testid="button-generate-document"
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Documento
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Devolver Prestação de Contas
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da devolução para o motorista
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="return-reason">Motivo da Devolução</Label>
              <Textarea
                id="return-reason"
                placeholder="Ex: Foto do comprovante de pedágio está ilegível. Por favor, envie uma foto mais nítida."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                data-testid="textarea-return-reason"
              />
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                O motorista receberá uma notificação no aplicativo informando que precisa corrigir e reenviar a prestação de contas.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReturn}
              disabled={returnMutation.isPending || !returnReason.trim()}
              data-testid="button-confirm-return"
            >
              {returnMutation.isPending ? "Enviando..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {lightboxPhoto && (
            <img
              src={lightboxPhoto}
              alt="Comprovante"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
