import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { DataTable } from "@/components/data-table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, Check, Loader2, User } from "lucide-react";
import type { Yard, DeliveryLocation, Driver, DriverNotification, Client } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface NotificationWithRelations extends DriverNotification {
  driver?: Driver;
}

export default function DriverLocationPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [selectedYardId, setSelectedYardId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [notificationsSent, setNotificationsSent] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: clients } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });

  const { data: deliveryLocations } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/clients", selectedClientId, "locations"],
    enabled: !!selectedClientId,
  });

  const { data: notifications, isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<NotificationWithRelations[]>({
    queryKey: ["/api/driver-notifications", selectedYardId, selectedLocationId, departureDate],
    enabled: notificationsSent && !!selectedYardId && !!selectedLocationId && !!departureDate,
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/driver-notifications/notify", {
        yardId: selectedYardId,
        deliveryLocationId: selectedLocationId,
        departureDate,
      });
    },
    onSuccess: () => {
      toast({ title: "Notificações enviadas para os motoristas" });
      setNotificationsSent(true);
      refetchNotifications();
    },
    onError: () => {
      toast({ title: "Erro ao enviar notificações", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/driver-notifications/${notificationId}/accept`);
    },
    onSuccess: () => {
      toast({ title: "Aceite registrado com sucesso" });
      refetchNotifications();
    },
    onError: () => {
      toast({ title: "Erro ao registrar aceite", variant: "destructive" });
    },
  });

  const canNotify = selectedYardId && selectedLocationId && departureDate;
  const acceptedDrivers = notifications?.filter((n) => n.status === "aceito") || [];
  const activeDrivers = drivers?.filter((d) => d.isActive === "true") || [];

  const handleSelectDriver = (driverId: string) => {
    setSelectedDriverId(driverId);
  };

  const handleCreateTransport = () => {
    if (selectedDriverId) {
      navigate(`/transportes/novo?driverId=${selectedDriverId}`);
    }
  };

  const notificationColumns = [
    {
      key: "driver",
      label: "Motorista",
      render: (n: NotificationWithRelations) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{n.driver?.name?.[0] || "M"}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{n.driver?.name}</p>
            <p className="text-xs text-muted-foreground">{n.driver?.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (n: NotificationWithRelations) => <StatusBadge status={n.status} />,
    },
    {
      key: "respondedAt",
      label: "Respondido em",
      render: (n: NotificationWithRelations) =>
        n.respondedAt ? format(new Date(n.respondedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
    },
    {
      key: "actions",
      label: "",
      className: "w-32",
      render: (n: NotificationWithRelations) => {
        if (n.status === "pendente") {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={() => acceptMutation.mutate(n.id)}
              disabled={acceptMutation.isPending}
              data-testid={`button-accept-${n.id}`}
            >
              <Check className="mr-1 h-4 w-4" />
              Simular Aceite
            </Button>
          );
        }
        if (n.status === "aceito") {
          return (
            <Button
              size="sm"
              variant={selectedDriverId === n.driverId ? "default" : "outline"}
              onClick={() => handleSelectDriver(n.driverId)}
              data-testid={`button-select-${n.id}`}
            >
              {selectedDriverId === n.driverId ? "Selecionado" : "Selecionar"}
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Proposta de Transporte"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Proposta de Transporte" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Critérios de Busca</CardTitle>
              <CardDescription>
                Selecione o pátio, local de entrega e data de saída para notificar os motoristas disponíveis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pátio de Origem</Label>
                <Select value={selectedYardId} onValueChange={setSelectedYardId}>
                  <SelectTrigger data-testid="select-notify-yard">
                    <SelectValue placeholder="Selecione o pátio" />
                  </SelectTrigger>
                  <SelectContent>
                    {yards?.filter((y) => y.isActive === "true").map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={selectedClientId}
                  onValueChange={(val) => {
                    setSelectedClientId(val);
                    setSelectedLocationId("");
                  }}
                >
                  <SelectTrigger data-testid="select-notify-client">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.filter((c) => c.isActive === "true").map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Local de Entrega</Label>
                <Select
                  value={selectedLocationId}
                  onValueChange={setSelectedLocationId}
                  disabled={!selectedClientId}
                >
                  <SelectTrigger data-testid="select-notify-location">
                    <SelectValue placeholder={selectedClientId ? "Selecione o local" : "Selecione um cliente primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryLocations?.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} - {loc.city}/{loc.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Saída</Label>
                <Input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  data-testid="input-notify-date"
                />
              </div>

              <Button
                className="w-full"
                onClick={() => notifyMutation.mutate()}
                disabled={!canNotify || notifyMutation.isPending}
                data-testid="button-notify-drivers"
              >
                {notifyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                Notificar Motoristas
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Motoristas Disponíveis</CardTitle>
              <CardDescription>
                {notificationsSent
                  ? `${activeDrivers.length} motoristas notificados, ${acceptedDrivers.length} aceitaram`
                  : "Envie as notificações para ver os motoristas disponíveis"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!notificationsSent ? (
                <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                  <User className="mb-2 h-10 w-10 opacity-50" />
                  <p>Preencha os critérios e clique em "Notificar Motoristas"</p>
                </div>
              ) : (
                <>
                  <DataTable
                    columns={notificationColumns}
                    data={notifications ?? []}
                    isLoading={notificationsLoading}
                    keyField="id"
                    emptyMessage="Nenhuma notificação enviada"
                  />
                  
                  {selectedDriverId && (
                    <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center gap-3">
                        <Badge>Motorista Selecionado</Badge>
                        <span className="font-medium">
                          {notifications?.find((n) => n.driverId === selectedDriverId)?.driver?.name}
                        </span>
                      </div>
                      <Button onClick={handleCreateTransport} data-testid="button-create-transport-with-driver">
                        Criar Transporte
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
