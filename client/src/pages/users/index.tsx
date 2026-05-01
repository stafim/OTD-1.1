import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { Loader2, UserCog, Pencil, Plus, Check, X } from "lucide-react";
import type { SystemUser } from "@shared/schema";
import { UserFormDialog } from "./form-dialog";

type UserType = {
  id: string;
  name: string;
};

export default function UsersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery<SystemUser[]>({
    queryKey: ["/api/system-users"],
  });

  const { data: userTypes = [] } = useQuery<UserType[]>({
    queryKey: ["/api/user-types"],
  });

  const handleNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleEdit = (user: SystemUser) => {
    setEditingId(user.id);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    const userType = userTypes.find(ut => ut.id === role);
    const label = userType?.name ?? role;
    switch (role) {
      case "admin":
        return <Badge className="bg-red-600">{label}</Badge>;
      case "operador":
        return <Badge className="bg-blue-600">{label}</Badge>;
      case "visualizador":
        return <Badge variant="secondary">{label}</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Usuários"
        breadcrumbs={[
          { label: "Configurações", href: "/" },
          { label: "Usuários" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Usuários do Sistema</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gerencie os usuários com acesso ao sistema OTD
                </p>
              </div>
            </div>
            <Button onClick={handleNew} data-testid="button-new-user">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Usuário
            </Button>
          </CardHeader>
          <CardContent>
            {!users || users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserCog className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Nenhum usuário cadastrado
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clique em "Cadastrar Usuário" para adicionar o primeiro usuário
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      data-testid={`row-user-${user.id}`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(user)}
                    >
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.username}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.isActive === "true" ? (
                          <Badge className="bg-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="h-3 w-3 mr-1" />
                            Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(user);
                          }}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        userId={editingId}
      />
    </div>
  );
}
