import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Database,
  Download,
  Trash2,
  RotateCcw,
  HardDrive,
  Clock,
  FileJson,
  Shield,
  Loader2,
  Plus,
  TableIcon,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Archive,
  Layers,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days} dia(s) atrás`;
}

export default function BackupPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null);

  const [backupType, setBackupType] = useState<"full" | "selective">("full");
  const [backupDescription, setBackupDescription] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [keepCount, setKeepCount] = useState("5");

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/backup/summary"],
  });

  const { data: backups, isLoading: backupsLoading } = useQuery<any[]>({
    queryKey: ["/api/backup/list"],
  });

  const { data: tableStats, isLoading: tablesLoading } = useQuery<any[]>({
    queryKey: ["/api/backup/tables"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/backup/create", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Backup criado com sucesso",
        description: `${data.totalRecords} registros em ${data.tables.length} tabelas`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/summary"] });
      setShowCreateDialog(false);
      setBackupDescription("");
      setSelectedTables([]);
      setBackupType("full");
    },
    onError: () => {
      toast({ title: "Erro ao criar backup", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/backup/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Backup removido" });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/summary"] });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: "Erro ao remover backup", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await apiRequest("POST", `/api/backup/restore/${id}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Restauração concluída com sucesso" : "Restauração com avisos",
        description: data.output?.slice(0, 200) || "Banco restaurado via pg_dump/psql",
      });
      setShowRestoreDialog(false);
      setRestoreBackupId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/backup/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/tables"] });
    },
    onError: () => {
      toast({ title: "Erro ao restaurar backup", variant: "destructive" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async (keep: number) => {
      const res = await apiRequest("POST", "/api/backup/cleanup", { keepCount: keep });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `${data.removed} backup(s) antigo(s) removido(s)` });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/summary"] });
      setShowCleanupDialog(false);
    },
    onError: () => {
      toast({ title: "Erro ao limpar backups", variant: "destructive" });
    },
  });

  const handleDownload = async (id: string) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/backup/download/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.split("filename=")[1] ?? "backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao baixar backup", variant: "destructive" });
    }
  };

  const handleCreateBackup = () => {
    createMutation.mutate({
      type: backupType,
      tables: backupType === "selective" ? selectedTables : undefined,
      description: backupDescription || undefined,
    });
  };

  const toggleTable = (table: string) => {
    setSelectedTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]
    );
  };

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Backup & Restauração"
        breadcrumbs={[
          { label: "Configurações", href: "/" },
          { label: "Backup" },
        ]}
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-db-size">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tamanho do Banco</p>
                <p className="text-lg font-semibold" data-testid="text-db-size">
                  {summaryLoading ? "..." : summary?.databaseSize ?? "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-uploads-size">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <FileJson className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Imagens / Arquivos</p>
                <p className="text-lg font-semibold" data-testid="text-uploads-size">
                  {summaryLoading ? "..." : summary?.uploadsSize ?? "0 B"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summaryLoading ? "" : `${summary?.uploadsCount ?? 0} arquivo(s)`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-records">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Registros</p>
                <p className="text-lg font-semibold" data-testid="text-total-records">
                  {summaryLoading ? "..." : summary?.totalRecords?.toLocaleString("pt-BR") ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-last-backup">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Último Backup</p>
                <p className="text-lg font-semibold" data-testid="text-last-backup">
                  {summaryLoading
                    ? "..."
                    : summary?.lastBackup
                      ? formatRelativeTime(summary.lastBackup.createdAt)
                      : "Nenhum"}
                </p>
                {!summaryLoading && summary?.lastBackup && (
                  <p className="text-xs">
                    {summary.lastBackup.includesFiles
                      ? <span className="text-green-600 font-medium">✓ inclui imagens</span>
                      : <span className="text-orange-500 font-medium">⚠ sem imagens</span>
                    }
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-backup">
            <Plus className="h-4 w-4 mr-2" />
            Novo Backup
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCleanupDialog(true)}
            data-testid="button-cleanup"
          >
            <Archive className="h-4 w-4 mr-2" />
            Limpar Antigos
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/backup/summary"] });
              queryClient.invalidateQueries({ queryKey: ["/api/backup/list"] });
              queryClient.invalidateQueries({ queryKey: ["/api/backup/tables"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Shield className="h-4 w-4 mr-1" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="tables" data-testid="tab-tables">
              <TableIcon className="h-4 w-4 mr-1" />
              Tabelas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Backups Realizados</CardTitle>
                <CardDescription>Histórico completo de backups com opções de download e restauração</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {backupsLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !backups?.length ? (
                  <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                    <Database className="h-12 w-12 mb-3 opacity-30" />
                    <p>Nenhum backup realizado ainda</p>
                    <p className="text-sm mt-1">Clique em "Novo Backup" para criar o primeiro</p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[100px]">Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="w-[90px]">Conteúdo</TableHead>
                          <TableHead className="w-[100px]">Registros</TableHead>
                          <TableHead className="w-[80px]">Tamanho</TableHead>
                          <TableHead className="w-[120px]">Criado por</TableHead>
                          <TableHead className="w-[160px]">Data</TableHead>
                          <TableHead className="w-[160px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backups.map((backup: any) => (
                          <TableRow key={backup.id} data-testid={`row-backup-${backup.id}`}>
                            <TableCell>
                              <Badge
                                variant={backup.type === "full" ? "default" : "secondary"}
                              >
                                {backup.type === "full" ? "Completo" : "Seletivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {backup.description || (
                                <span className="text-muted-foreground italic">Sem descrição</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-green-600 font-medium">✓ BD ({backup.tables?.length ?? 0} tabelas)</span>
                                {backup.includesFiles
                                  ? <span className="text-xs text-green-600 font-medium">✓ Imagens ({backup.fileCount ?? 0})</span>
                                  : <span className="text-xs text-orange-500">⚠ Sem imagens</span>
                                }
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {backup.totalRecords?.toLocaleString("pt-BR") ?? 0}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatBytes(backup.sizeBytes)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {backup.createdBy}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(backup.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Baixar"
                                  onClick={() => handleDownload(backup.id)}
                                  data-testid={`button-download-${backup.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Restaurar"
                                  onClick={() => {
                                    setRestoreBackupId(backup.id);
                                    setShowRestoreDialog(true);
                                  }}
                                  data-testid={`button-restore-${backup.id}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Remover"
                                  onClick={() => setDeleteConfirmId(backup.id)}
                                  data-testid={`button-delete-${backup.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tables" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tabelas do Banco de Dados</CardTitle>
                <CardDescription>Visão detalhada de cada tabela com contagem de registros e tamanho</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {tablesLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Tabela</TableHead>
                          <TableHead className="w-[120px] text-right">Registros</TableHead>
                          <TableHead className="w-[120px] text-right">Tamanho</TableHead>
                          <TableHead className="w-[100px] text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableStats?.map((stat: any) => (
                          <TableRow key={stat.table} data-testid={`row-table-${stat.table}`}>
                            <TableCell className="font-mono text-sm">{stat.table}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {stat.count.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {stat.sizeEstimate}
                            </TableCell>
                            <TableCell className="text-center">
                              {stat.count > 0 ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 inline-block" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground inline-block" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Criar Novo Backup
            </DialogTitle>
            <DialogDescription>
              Exporte os dados do banco via pg_dump (formato SQL nativo PostgreSQL)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Backup</Label>
              <Select value={backupType} onValueChange={(v) => setBackupType(v as any)}>
                <SelectTrigger data-testid="select-backup-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Completo (todas as tabelas)</SelectItem>
                  <SelectItem value="selective">Seletivo (escolher tabelas)</SelectItem>
                </SelectContent>
              </Select>
              {backupType === "full" && (
                <p className="text-xs text-green-700 dark:text-green-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Inclui banco de dados + imagens e documentos dos motoristas ({summary?.uploadsCount ?? 0} arquivos · {summary?.uploadsSize ?? "..."})
                </p>
              )}
              {backupType === "selective" && (
                <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Backup seletivo não inclui as imagens dos motoristas
                </p>
              )}
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Backup antes da atualização..."
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                data-testid="input-backup-description"
              />
            </div>

            {backupType === "selective" && (
              <div>
                <Label className="mb-2 block">Selecionar Tabelas</Label>
                <div className="border rounded-lg max-h-[250px] overflow-y-auto p-3 space-y-2">
                  {tableStats?.map((stat: any) => (
                    <label
                      key={stat.table}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                    >
                      <Checkbox
                        checked={selectedTables.includes(stat.table)}
                        onCheckedChange={() => toggleTable(stat.table)}
                        data-testid={`checkbox-table-${stat.table}`}
                      />
                      <span className="font-mono text-sm flex-1">{stat.table}</span>
                      <Badge variant="outline" className="text-xs">
                        {stat.count}
                      </Badge>
                    </label>
                  ))}
                </div>
                {selectedTables.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedTables.length} tabela(s) selecionada(s)
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateBackup}
              disabled={
                createMutation.isPending ||
                (backupType === "selective" && selectedTables.length === 0)
              }
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Criar Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O arquivo de backup será permanentemente removido do servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestoreDialog} onOpenChange={(v) => { if (!v) { setShowRestoreDialog(false); setRestoreBackupId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirmar Restauração
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>ATENÇÃO:</strong> Esta ação irá substituir os dados atuais do banco
                com os dados do backup selecionado.
              </p>
              <p>
                É altamente recomendado criar um backup dos dados atuais antes de prosseguir.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreBackupId && restoreMutation.mutate({ id: restoreBackupId })}
              className="bg-orange-600 hover:bg-orange-700 text-white"
              data-testid="button-confirm-restore"
            >
              {restoreMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Restaurar Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Limpar Backups Antigos
            </DialogTitle>
            <DialogDescription>
              Remove automaticamente os backups mais antigos, mantendo apenas os mais recentes.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Manter os últimos</Label>
            <Select value={keepCount} onValueChange={setKeepCount}>
              <SelectTrigger data-testid="select-keep-count">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 backups</SelectItem>
                <SelectItem value="5">5 backups</SelectItem>
                <SelectItem value="10">10 backups</SelectItem>
                <SelectItem value="20">20 backups</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCleanupDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => cleanupMutation.mutate(parseInt(keepCount))}
              disabled={cleanupMutation.isPending}
              data-testid="button-confirm-cleanup"
            >
              {cleanupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Limpar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
