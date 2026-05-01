import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import {
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  Search,
  Flag,
  Warehouse,
  Navigation,
  Plus,
  Save,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import type { Transport, Checkpoint, TransportCheckpoint } from "@shared/schema";

interface TransportWithDetails extends Transport {
  vehicle?: { model: string; chassi: string };
  client?: { name: string };
  originYard?: { name: string; city: string; state: string };
  deliveryLocation?: { address: string; city: string; state: string };
  driver?: { name: string };
  checkpoints?: (TransportCheckpoint & { checkpoint: Checkpoint })[];
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TransportTimelineVertical({ transport }: { transport: TransportWithDetails }) {
  const checkpoints = transport.checkpoints || [];
  const sortedCheckpoints = [...checkpoints].sort((a, b) => a.orderIndex - b.orderIndex);
  
  const completedCount = sortedCheckpoints.filter(cp => cp.status === "concluido").length;
  const totalSteps = sortedCheckpoints.length + 2;
  
  let currentStep = 0;
  if (transport.checkinDateTime) currentStep = 1;
  currentStep += completedCount;
  if (transport.checkoutDateTime) currentStep = totalSteps;
  
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido": return "bg-green-500";
      case "alcancado": return "bg-blue-500";
      default: return "bg-gray-300 dark:bg-gray-600";
    }
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{transport.requestNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {transport.vehicle?.model || "Veículo"} - {transport.driver?.name || "Sem motorista"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={transport.status === "entregue" ? "default" : transport.status === "em_transito" ? "secondary" : "outline"}>
              {transport.status === "pendente" && "Pendente"}
              {transport.status === "aguardando_saida" && "Aguard. Saída"}
              {transport.status === "em_transito" && "Em Trânsito"}
              {transport.status === "entregue" && "Entregue"}
              {transport.status === "cancelado" && "Cancelado"}
            </Badge>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
              <p className="text-xs text-muted-foreground">concluído</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
          
          <div className="space-y-4">
            <div className="relative flex items-start gap-4 pl-0">
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${transport.checkinDateTime ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <Warehouse className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Saída do Pátio</p>
                    <p className="text-xs text-muted-foreground">
                      {transport.originYard?.name} - {transport.originYard?.city}/{transport.originYard?.state}
                    </p>
                  </div>
                  {transport.checkinDateTime && (
                    <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {formatDate(transport.checkinDateTime)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {sortedCheckpoints.map((cp, index) => (
              <div key={cp.id} className="relative flex items-start gap-4 pl-0">
                <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${getStatusColor(cp.status)}`}>
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        {cp.checkpoint?.name || `Checkpoint ${index + 1}`}
                        {cp.status === "alcancado" && (
                          <Badge variant="secondary" className="text-xs animate-pulse">
                            <Navigation className="h-3 w-3 mr-1" />
                            Aqui agora
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cp.checkpoint?.city}/{cp.checkpoint?.state}
                      </p>
                    </div>
                    {cp.reachedAt && (
                      <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(cp.reachedAt)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="relative flex items-start gap-4 pl-0">
              <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${transport.checkoutDateTime ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <Flag className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Entrega ao Cliente</p>
                    <p className="text-xs text-muted-foreground">
                      {transport.deliveryLocation?.city}/{transport.deliveryLocation?.state} - {transport.client?.name}
                    </p>
                  </div>
                  {transport.checkoutDateTime && (
                    <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {formatDate(transport.checkoutDateTime)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransportTimelineHorizontal({ transport }: { transport: TransportWithDetails }) {
  const checkpoints = transport.checkpoints || [];
  const sortedCheckpoints = [...checkpoints].sort((a, b) => a.orderIndex - b.orderIndex);
  
  const completedCount = sortedCheckpoints.filter(cp => cp.status === "concluido").length;
  const totalSteps = sortedCheckpoints.length + 2;
  
  let currentStep = 0;
  if (transport.checkinDateTime) currentStep = 1;
  currentStep += completedCount;
  if (transport.checkoutDateTime) currentStep = totalSteps;
  
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido": return "bg-green-500";
      case "alcancado": return "bg-blue-500 animate-pulse";
      default: return "bg-gray-300 dark:bg-gray-600";
    }
  };

  const getLineColor = (isCompleted: boolean) => {
    return isCompleted ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600";
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{transport.requestNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {transport.vehicle?.model || "Veículo"} - {transport.driver?.name || "Sem motorista"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={transport.status === "entregue" ? "default" : transport.status === "em_transito" ? "secondary" : "outline"}>
              {transport.status === "pendente" && "Pendente"}
              {transport.status === "aguardando_saida" && "Aguard. Saída"}
              {transport.status === "em_transito" && "Em Trânsito"}
              {transport.status === "entregue" && "Entregue"}
              {transport.status === "cancelado" && "Cancelado"}
            </Badge>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
              <p className="text-xs text-muted-foreground">concluído</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-max px-2">
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${transport.checkinDateTime ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"} shadow-lg`}>
                <Warehouse className="h-5 w-5 text-white" />
              </div>
              <div className="mt-2 text-center max-w-[80px]">
                <p className="text-xs font-medium truncate">Saída</p>
                <p className="text-[10px] text-muted-foreground truncate">{transport.originYard?.city}</p>
                {transport.checkinDateTime && (
                  <p className="text-[10px] text-green-600">{formatDate(transport.checkinDateTime)}</p>
                )}
              </div>
            </div>

            <div className={`h-1 w-12 ${getLineColor(!!transport.checkinDateTime)}`} />

            {(() => {
              const minSlots = 5;
              const checkpointSlots = Math.max(minSlots, sortedCheckpoints.length);
              const slots = [];
              
              for (let i = 0; i < checkpointSlots; i++) {
                const cp = sortedCheckpoints[i];
                
                if (cp) {
                  slots.push(
                    <div key={cp.id} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className={`relative flex items-center justify-center w-10 h-10 rounded-full ${getStatusColor(cp.status)} shadow-lg`}>
                          <MapPin className="h-5 w-5 text-white" />
                          {cp.status === "alcancado" && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                              <Navigation className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-center max-w-[80px]">
                          <p className="text-xs font-medium truncate">{cp.checkpoint?.city || `CP${i + 1}`}</p>
                          <p className="text-[10px] text-muted-foreground">{cp.checkpoint?.state}</p>
                          {cp.reachedAt && (
                            <p className="text-[10px] text-green-600">{formatDate(cp.reachedAt)}</p>
                          )}
                        </div>
                      </div>
                      <div className={`h-1 w-12 ${getLineColor(cp.status === "concluido")}`} />
                    </div>
                  );
                } else {
                  slots.push(
                    <div key={`empty-${i}`} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                          <Plus className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="mt-2 text-center max-w-[80px]">
                          <p className="text-xs text-muted-foreground">CP {i + 1}</p>
                          <p className="text-[10px] text-muted-foreground">-</p>
                        </div>
                      </div>
                      <div className="h-1 w-12 bg-gray-300 dark:bg-gray-600" />
                    </div>
                  );
                }
              }
              
              return slots;
            })()}

            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${transport.checkoutDateTime ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"} shadow-lg`}>
                <Flag className="h-5 w-5 text-white" />
              </div>
              <div className="mt-2 text-center max-w-[80px]">
                <p className="text-xs font-medium truncate">Entrega</p>
                <p className="text-[10px] text-muted-foreground truncate">{transport.deliveryLocation?.city}</p>
                {transport.checkoutDateTime && (
                  <p className="text-[10px] text-green-600">{formatDate(transport.checkoutDateTime)}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TimelineCheckpointsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">("horizontal");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedTransportId, setSelectedTransportId] = useState<string | null>(null);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: transports, isLoading } = useQuery<TransportWithDetails[]>({
    queryKey: ["/api/transports/with-checkpoints"],
  });

  const { data: allCheckpoints } = useQuery<Checkpoint[]>({
    queryKey: ["/api/checkpoints"],
  });

  const assignCheckpointsMutation = useMutation({
    mutationFn: async ({ transportId, checkpointIds }: { transportId: string; checkpointIds: string[] }) => {
      const response = await fetch(`/api/transports/${transportId}/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkpointIds }),
      });
      if (!response.ok) throw new Error("Failed to assign checkpoints");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transports/with-checkpoints"] });
      setShowAssignDialog(false);
      setSelectedTransportId(null);
      setSelectedCheckpoints([]);
      toast({
        title: "Checkpoints atribuídos",
        description: "Os checkpoints foram atribuídos ao transporte com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atribuir os checkpoints.",
        variant: "destructive",
      });
    },
  });

  const filteredTransports = transports?.filter((t) => {
    const matchesSearch =
      t.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.vehicle?.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  const handleOpenAssignDialog = (transportId: string) => {
    const transport = transports?.find(t => t.id === transportId);
    const existingIds = transport?.checkpoints?.map(cp => cp.checkpointId) || [];
    setSelectedTransportId(transportId);
    setSelectedCheckpoints(existingIds);
    setShowAssignDialog(true);
  };

  const handleCheckpointToggle = (checkpointId: string) => {
    setSelectedCheckpoints(prev => 
      prev.includes(checkpointId) 
        ? prev.filter(id => id !== checkpointId)
        : [...prev, checkpointId]
    );
  };

  const handleSaveCheckpoints = () => {
    if (selectedTransportId) {
      assignCheckpointsMutation.mutate({
        transportId: selectedTransportId,
        checkpointIds: selectedCheckpoints,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Timeline de Check Points" />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por OTD, veículo ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-timeline"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="aguardando_saida">Aguard. Saída</SelectItem>
              <SelectItem value="em_transito">Em Trânsito</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === "horizontal" ? "default" : "ghost"}
              onClick={() => setViewMode("horizontal")}
              data-testid="button-view-horizontal"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Horizontal
            </Button>
            <Button
              size="sm"
              variant={viewMode === "vertical" ? "default" : "ghost"}
              onClick={() => setViewMode("vertical")}
              data-testid="button-view-vertical"
            >
              <LayoutList className="h-4 w-4 mr-1" />
              Vertical
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-2 w-full mb-4" />
                  <div className="space-y-4">
                    {[1, 2, 3].map((j) => (
                      <Skeleton key={j} className="h-12 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTransports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Truck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {searchTerm || statusFilter !== "all"
                  ? "Nenhum transporte encontrado com os filtros aplicados"
                  : "Nenhum transporte cadastrado"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === "vertical" ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
            {filteredTransports.map((transport) => (
              <div key={transport.id} className="relative">
                {viewMode === "vertical" ? (
                  <TransportTimelineVertical transport={transport} />
                ) : (
                  <TransportTimelineHorizontal transport={transport} />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-4 right-4"
                  onClick={() => handleOpenAssignDialog(transport.id)}
                  data-testid={`button-assign-checkpoints-${transport.id}`}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Checkpoints
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Checkpoints ao Transporte</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {allCheckpoints?.map((cp) => (
              <div 
                key={cp.id} 
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => handleCheckpointToggle(cp.id)}
              >
                <Checkbox
                  checked={selectedCheckpoints.includes(cp.id)}
                  onCheckedChange={() => handleCheckpointToggle(cp.id)}
                  data-testid={`checkbox-checkpoint-${cp.id}`}
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">{cp.name}</p>
                  <p className="text-xs text-muted-foreground">{cp.city}/{cp.state}</p>
                </div>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveCheckpoints}
              disabled={assignCheckpointsMutation.isPending}
              data-testid="button-save-checkpoints"
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
