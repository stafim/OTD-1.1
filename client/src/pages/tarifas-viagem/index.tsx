import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TravelRate } from "@shared/schema";

type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
};
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, MapPin, Users, X, UserPlus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TravelRateFormDialog } from "./form-dialog";

const RATE_TYPE_LABELS: Record<string, string> = {
  por_km: "Por Km",
  fixo: "Fixo",
  por_veiculo: "Por Veículo",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  operador: "Operador",
  gerente: "Gerente",
  financeiro: "Financeiro",
};

function formatCurrency(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value));
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

interface ApproverRow {
  id: string;
  travelRateId: string;
  userId: string;
  createdAt: string | null;
  userName: string;
  userEmail: string;
  userUsername: string;
  userRole: string;
}

export default function TarifasViagemPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approversRateId, setApproversRateId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const { toast } = useToast();

  const { data: rates, isLoading } = useQuery<TravelRate[]>({
    queryKey: ["/api/travel-rates"],
  });

  const { data: allApprovers } = useQuery<ApproverRow[]>({
    queryKey: ["/api/travel-rate-approvers"],
  });

  const { data: systemUsers } = useQuery<AuthUser[]>({
    queryKey: ["/api/users"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/travel-rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-rates"] });
      toast({ title: "Tarifa excluída com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir tarifa", variant: "destructive" });
    },
  });

  const addApproverMutation = useMutation({
    mutationFn: ({ rateId, userId }: { rateId: string; userId: string }) =>
      apiRequest("POST", `/api/travel-rates/${rateId}/approvers`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-rate-approvers"] });
      toast({ title: "Aprovador adicionado com sucesso" });
      setSelectedUserId("");
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao adicionar aprovador", variant: "destructive" });
    },
  });

  const removeApproverMutation = useMutation({
    mutationFn: ({ rateId, userId }: { rateId: string; userId: string }) =>
      apiRequest("DELETE", `/api/travel-rates/${rateId}/approvers/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-rate-approvers"] });
      toast({ title: "Aprovador removido" });
    },
    onError: () => {
      toast({ title: "Erro ao remover aprovador", variant: "destructive" });
    },
  });

  const filtered = rates?.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.notes?.toLowerCase().includes(search.toLowerCase())
  );

  const approversByRate = (rateId: string) =>
    allApprovers?.filter((a) => a.travelRateId === rateId) ?? [];

  const activeRate = rates?.find((r) => r.id === approversRateId);
  const currentApprovers = approversRateId ? approversByRate(approversRateId) : [];
  const alreadyApproverIds = new Set(currentApprovers.map((a) => a.userId));
  const fullName = (u: AuthUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username;
  const availableUsers = systemUsers?.filter(
    (u) => u.role !== "cliente" && u.role !== "motorista" && !alreadyApproverIds.has(u.id)
  ) ?? [];

  const handleNew = () => { setEditingId(null); setDialogOpen(true); };
  const handleEdit = (r: TravelRate) => { setEditingId(r.id); setDialogOpen(true); };
  const handleManageApprovers = (r: TravelRate) => {
    setApproversRateId(r.id);
    setSelectedUserId("");
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Tarifas de Viagem" description="Gerencie as tarifas de transporte por rota" />

      <div className="p-6 space-y-4 flex-1">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou observações..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-rates"
            />
          </div>
          <Button onClick={handleNew} data-testid="button-new-rate">
            <Plus className="mr-2 h-4 w-4" />
            Nova Tarifa
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Carregando tarifas...
          </div>
        ) : !filtered?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <MapPin className="h-10 w-10 opacity-30" />
              <p className="text-sm">{search ? "Nenhuma tarifa encontrada para esta busca" : "Nenhuma tarifa cadastrada"}</p>
              {!search && (
                <Button variant="outline" size="sm" onClick={handleNew} data-testid="button-new-rate-empty">
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar primeira tarifa
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aprovadores</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((rate) => {
                    const approvers = approversByRate(rate.id);
                    return (
                      <TableRow key={rate.id} data-testid={`row-rate-${rate.id}`}>
                        <TableCell className="font-medium">{rate.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {RATE_TYPE_LABELS[rate.rateType] ?? rate.rateType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(rate.rateValue)}
                          {rate.rateType === "por_km" && <span className="text-xs text-muted-foreground font-normal">/km</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rate.isActive === "true" ? "default" : "secondary"}>
                            {rate.isActive === "true" ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {approvers.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">Nenhum</span>
                            ) : (
                              <div className="flex -space-x-1">
                                {approvers.slice(0, 3).map((a) => (
                                  <Avatar key={a.userId} className="h-6 w-6 border-2 border-background text-xs" title={a.userName}>
                                    <AvatarFallback className="text-[10px]">{getInitials(a.userName)}</AvatarFallback>
                                  </Avatar>
                                ))}
                                {approvers.length > 3 && (
                                  <span className="ml-2 text-xs text-muted-foreground">+{approvers.length - 3}</span>
                                )}
                              </div>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 ml-1"
                              onClick={() => handleManageApprovers(rate)}
                              title="Gerenciar aprovadores"
                              data-testid={`button-approvers-${rate.id}`}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(rate)}
                              data-testid={`button-edit-rate-${rate.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(rate.id)}
                              data-testid={`button-delete-rate-${rate.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <TravelRateFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingId={editingId}
      />

      {/* Dialog de Aprovadores */}
      <Dialog open={!!approversRateId} onOpenChange={(o) => !o && setApproversRateId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Aprovadores — {activeRate?.name}
            </DialogTitle>
            <DialogDescription>
              Usuários responsáveis por aprovar transportes com esta tarifa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista de aprovadores atuais */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Aprovadores cadastrados ({currentApprovers.length})
              </p>
              {currentApprovers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">Nenhum aprovador cadastrado para esta tarifa.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {currentApprovers.map((a) => (
                    <div
                      key={a.userId}
                      className="flex items-center justify-between p-2 rounded-md border bg-muted/30"
                      data-testid={`approver-row-${a.userId}`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{getInitials(a.userName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{a.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            @{a.userUsername} · {ROLE_LABELS[a.userRole] ?? a.userRole}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeApproverMutation.mutate({ rateId: approversRateId!, userId: a.userId })}
                        disabled={removeApproverMutation.isPending}
                        data-testid={`button-remove-approver-${a.userId}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Adicionar novo aprovador */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Adicionar aprovador
              </p>
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Todos os usuários ativos já são aprovadores desta tarifa.</p>
              ) : (
                <div className="flex gap-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1" data-testid="select-new-approver">
                      <SelectValue placeholder="Selecione um usuário..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id} data-testid={`option-approver-${u.id}`}>
                          {fullName(u)} ({ROLE_LABELS[u.role] ?? u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (selectedUserId && approversRateId) {
                        addApproverMutation.mutate({ rateId: approversRateId, userId: selectedUserId });
                      }
                    }}
                    disabled={!selectedUserId || addApproverMutation.isPending}
                    data-testid="button-add-approver"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tarifa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarifa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
