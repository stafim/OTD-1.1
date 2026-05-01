import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Yard } from "@shared/schema";
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
import { YardFormDialog } from "./form-dialog";

export default function YardsPage() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: yards, isLoading } = useQuery<Yard[]>({
    queryKey: ["/api/yards"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/yards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yards"] });
      toast({ title: "Pátio excluído com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir pátio", variant: "destructive" });
    },
  });

  const filteredData = yards?.filter(
    (y) =>
      y.name.toLowerCase().includes(search.toLowerCase()) ||
      y.city?.toLowerCase().includes(search.toLowerCase())
  );

  const handleNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleEdit = (y: Yard) => {
    setEditingId(y.id);
    setDialogOpen(true);
  };

  const columns = [
    { key: "name", label: "Nome" },
    { key: "address", label: "Endereço" },
    { key: "city", label: "Cidade" },
    { key: "state", label: "UF" },
    { key: "phone", label: "Telefone" },
    {
      key: "isActive",
      label: "Status",
      render: (y: Yard) => (
        <Badge variant={y.isActive === "true" ? "default" : "secondary"}>
          {y.isActive === "true" ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-24",
      render: (y: Yard) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(y);
            }}
            data-testid={`button-edit-${y.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(y.id);
            }}
            data-testid={`button-delete-${y.id}`}
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
        title="Pátios"
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Pátios" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-yards"
            />
          </div>
          <Button onClick={handleNew} data-testid="button-add-yard">
            <Plus className="mr-2 h-4 w-4" />
            Novo Pátio
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredData ?? []}
          isLoading={isLoading}
          keyField="id"
          onRowClick={handleEdit}
          emptyMessage="Nenhum pátio cadastrado"
        />
      </div>

      <YardFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        yardId={editingId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pátio? Esta ação não pode ser desfeita.
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
