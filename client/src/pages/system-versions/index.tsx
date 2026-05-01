import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Globe,
  Smartphone,
  Loader2,
  Search,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SystemVersionRow {
  id: string;
  type: "web" | "app";
  version: string;
  description: string | null;
  deployDate: string;
  createdAt: string;
}

const formSchema = z.object({
  type: z.enum(["web", "app"], { required_error: "Selecione o tipo" }),
  version: z.string().min(1, "Informe a versão"),
  description: z.string().optional(),
  deployDate: z.string().min(1, "Informe a data de deploy"),
});

type FormValues = z.infer<typeof formSchema>;

const typeConfig: Record<"web" | "app", { label: string; icon: typeof Globe; className: string }> = {
  web: {
    label: "Sistema Web",
    icon: Globe,
    className: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100",
  },
  app: {
    label: "App",
    icon: Smartphone,
    className: "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-100",
  },
};

export default function SystemVersionsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "web" | "app">("all");
  const [editing, setEditing] = useState<SystemVersionRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: versions, isLoading } = useQuery<SystemVersionRow[]>({
    queryKey: ["/api/system-versions"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "web",
      version: "",
      description: "",
      deployDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      type: "web",
      version: "",
      description: "",
      deployDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowForm(true);
  };

  const openEdit = (row: SystemVersionRow) => {
    setEditing(row);
    form.reset({
      type: row.type,
      version: row.version,
      description: row.description ?? "",
      deployDate: format(new Date(row.deployDate), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        description: values.description || null,
        deployDate: new Date(values.deployDate).toISOString(),
      };
      if (editing) {
        return apiRequest("PATCH", `/api/system-versions/${editing.id}`, payload);
      }
      return apiRequest("POST", "/api/system-versions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-versions"] });
      toast({
        title: editing ? "Versão atualizada" : "Versão cadastrada",
      });
      setShowForm(false);
      setEditing(null);
    },
    onError: (err: any) => {
      toast({
        title: err?.message || "Erro ao salvar versão",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/system-versions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-versions"] });
      toast({ title: "Versão removida" });
      setDeletingId(null);
    },
    onError: () => {
      toast({ title: "Erro ao remover versão", variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!versions) return [];
    return versions.filter((v) => {
      if (filterType !== "all" && v.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !v.version.toLowerCase().includes(q) &&
          !(v.description ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [versions, search, filterType]);

  const stats = useMemo(() => {
    const total = versions?.length ?? 0;
    const web = versions?.filter((v) => v.type === "web").length ?? 0;
    const app = versions?.filter((v) => v.type === "app").length ?? 0;
    const lastWeb = versions?.find((v) => v.type === "web");
    const lastApp = versions?.find((v) => v.type === "app");
    return { total, web, app, lastWeb, lastApp };
  }, [versions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controle de Versão"
        actions={
          <Button onClick={openCreate} data-testid="button-new-version">
            <Plus className="h-4 w-4 mr-2" />
            Nova versão
          </Button>
        }
      />
      <p className="text-sm text-muted-foreground">
        Histórico de versões e deploys dos sistemas (Web e App).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Sistema Web
                </p>
                <p className="text-2xl font-bold mt-1" data-testid="stat-web-version">
                  {stats.lastWeb?.version ?? "—"}
                </p>
                {stats.lastWeb && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deploy em{" "}
                    {format(new Date(stats.lastWeb.deployDate), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}
              </div>
              <Badge variant="secondary" data-testid="stat-web-count">
                {stats.web} {stats.web === 1 ? "versão" : "versões"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" /> App
                </p>
                <p className="text-2xl font-bold mt-1" data-testid="stat-app-version">
                  {stats.lastApp?.version ?? "—"}
                </p>
                {stats.lastApp && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deploy em{" "}
                    {format(new Date(stats.lastApp.deployDate), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}
              </div>
              <Badge variant="secondary" data-testid="stat-app-count">
                {stats.app} {stats.app === 1 ? "versão" : "versões"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-base">Histórico de versões</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mostrando: <span className="font-medium" data-testid="text-total-versions">{filtered.length}</span> de {stats.total}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="web">Sistema Web</SelectItem>
                <SelectItem value="app">App</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar versão ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-versions"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma versão cadastrada.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data de Deploy</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => {
                    const cfg = typeConfig[v.type];
                    const TypeIcon = cfg.icon;
                    return (
                      <TableRow key={v.id} data-testid={`row-version-${v.id}`}>
                        <TableCell>
                          <Badge variant="outline" className={`${cfg.className} gap-1`} data-testid={`badge-type-${v.id}`}>
                            <TypeIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-semibold" data-testid={`text-version-${v.id}`}>
                          v{v.version}
                        </TableCell>
                        <TableCell className="text-sm max-w-md">
                          {v.description ? (
                            <span className="line-clamp-2" title={v.description}>
                              {v.description}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap" data-testid={`text-deploy-date-${v.id}`}>
                          {format(new Date(v.deployDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(v)}
                              data-testid={`button-edit-version-${v.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingId(v.id)}
                              data-testid={`button-delete-version-${v.id}`}
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
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent data-testid="dialog-version-form">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              {editing ? "Editar versão" : "Nova versão"}
            </DialogTitle>
            <DialogDescription>
              Registre uma nova versão de deploy do sistema. Informe o tipo, número da versão,
              descrição e a data em que foi colocada em produção.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-version-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="web">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" /> Sistema Web
                          </div>
                        </SelectItem>
                        <SelectItem value="app">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4" /> App
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Versão *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 1.2.3" data-testid="input-version" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deployDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Deploy *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        data-testid="input-deploy-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva as principais mudanças desta versão..."
                        rows={4}
                        data-testid="input-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  data-testid="button-cancel-version"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  data-testid="button-save-version"
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editing ? "Salvar alterações" : "Cadastrar versão"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir versão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o registro do histórico de versões. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
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
