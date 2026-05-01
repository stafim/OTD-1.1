import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, MapPin, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ClientFormDialog } from "./form-dialog";

interface CredentialsDialogProps {
  client: Client | null;
  onClose: () => void;
}

function CredentialsDialog({ client, onClose }: CredentialsDialogProps) {
  const { toast } = useToast();
  const [username, setUsername] = useState(client?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const setMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/clients/${client!.id}/set-credentials`, { username, password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Credenciais salvas", description: `Acesso ao portal configurado para ${client?.name}` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar credenciais", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clients/${client!.id}/set-credentials`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Credenciais removidas", description: `Acesso ao portal foi revogado para ${client?.name}` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover credenciais", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = setMutation.isPending || removeMutation.isPending;
  const hasCredentials = !!client?.username;

  return (
    <Dialog open={!!client} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Credenciais do Portal
          </DialogTitle>
          <DialogDescription>
            Configure o acesso do cliente <strong>{client?.name}</strong> ao Portal do Cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cred-username">Usuário</Label>
            <Input
              id="cred-username"
              data-testid="input-credential-username"
              placeholder="Nome de usuário do cliente"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cred-password">Senha {hasCredentials && <span className="text-muted-foreground text-xs">(deixe em branco para manter a atual)</span>}</Label>
            <div className="relative">
              <Input
                id="cred-password"
                data-testid="input-credential-password"
                type={showPassword ? "text" : "password"}
                placeholder={hasCredentials ? "Nova senha (opcional)" : "Senha de acesso"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(p => !p)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {hasCredentials && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Usuário atual: <strong className="text-foreground">{client?.username}</strong>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-row-reverse sm:flex-row-reverse">
          {hasCredentials && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => removeMutation.mutate()}
              disabled={isLoading}
              data-testid="button-remove-credentials"
            >
              {removeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revogar Acesso"}
            </Button>
          )}
          <Button
            onClick={() => setMutation.mutate()}
            disabled={isLoading || !username.trim() || (!password && !hasCredentials)}
            data-testid="button-save-credentials"
          >
            {setMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Salvar Credenciais
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [credentialsClient, setCredentialsClient] = useState<Client | null>(null);
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Cliente excluído com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir cliente", variant: "destructive" });
    },
  });

  const filteredData = clients?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj?.includes(search)
  );

  const handleNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleEdit = (c: Client) => {
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleEditFullPage = (clientId: string) => {
    navigate(`/clientes/${clientId}`);
  };

  const columns = [
    { key: "name", label: "Nome" },
    { key: "cnpj", label: "CNPJ" },
    { key: "phone", label: "Telefone" },
    { key: "email", label: "Email" },
    { key: "contactName", label: "Contato" },
    {
      key: "isActive",
      label: "Status",
      render: (c: Client) => (
        <Badge variant={c.isActive === "true" ? "default" : "secondary"}>
          {c.isActive === "true" ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "portalAccess",
      label: "Portal",
      render: (c: Client) => (
        <Badge variant={c.username ? "default" : "outline"} className="text-xs">
          {c.username ? `@${c.username}` : "Sem acesso"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-36",
      render: (c: Client) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/clientes/${c.id}?tab=locais`);
            }}
            title="Gerenciar locais de entrega"
            data-testid={`button-locations-${c.id}`}
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setCredentialsClient(c);
            }}
            title="Credenciais do Portal"
            data-testid={`button-credentials-${c.id}`}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(c);
            }}
            data-testid={`button-edit-${c.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(c.id);
            }}
            data-testid={`button-delete-${c.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Clientes"
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Clientes" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-clients"
            />
          </div>
          <Button onClick={handleNew} data-testid="button-add-client">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredData ?? []}
          isLoading={isLoading}
          keyField="id"
          onRowClick={handleEdit}
          emptyMessage="Nenhum cliente cadastrado"
        />
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={editingId}
        onEditFullPage={handleEditFullPage}
      />

      <CredentialsDialog
        client={credentialsClient}
        onClose={() => setCredentialsClient(null)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
