import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { menuFeatures } from "@shared/schema";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Shield, Trash2, Eye, EyeOff, Lock, ChevronRight, Pencil, CheckSquare, Square } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type UserType = {
  id: string;
  name: string;
  description: string | null;
  isSystem: string;
  createdAt: string;
};

type Permission = {
  id: string;
  userTypeId: string;
  feature: string;
  canView: string;
};

const groups = Array.from(new Set(menuFeatures.map(f => f.group)));

const groupIcons: Record<string, string> = {
  "Dados": "📊",
  "Operação": "⚙️",
  "Motorista": "🚛",
  "Relatórios": "📋",
  "Financeiro": "💰",
  "Cadastros": "🗂️",
  "Configurações": "🔧",
};

export default function PermissionsPage() {
  const { toast } = useToast();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ id: "", name: "", description: "" });
  const [editForm, setEditForm] = useState({ id: "", name: "", description: "" });
  const [pendingPerms, setPendingPerms] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: userTypes = [], isLoading: loadingTypes } = useQuery<UserType[]>({
    queryKey: ["/api/user-types"],
  });

  const { data: permissions = [], isLoading: loadingPerms } = useQuery<Permission[]>({
    queryKey: ["/api/user-types", selectedTypeId, "permissions"],
    enabled: !!selectedTypeId,
  });

  const selectedType = userTypes.find(t => t.id === selectedTypeId);

  const permMap = (() => {
    if (pendingPerms !== null) return pendingPerms;
    const map: Record<string, boolean> = {};
    menuFeatures.forEach(f => { map[f.key] = true; });
    permissions.forEach(p => { map[p.feature] = p.canView === "true"; });
    return map;
  })();

  const handleSelectType = (id: string) => {
    setPendingPerms(null);
    setSelectedTypeId(id);
  };

  const handleToggle = (feature: string) => {
    const base: Record<string, boolean> = {};
    menuFeatures.forEach(f => { base[f.key] = true; });
    permissions.forEach(p => { base[p.feature] = p.canView === "true"; });
    const current = pendingPerms ?? base;
    setPendingPerms({ ...current, [feature]: !current[feature] });
  };

  const handleToggleGroup = (group: string) => {
    const groupFeatures = menuFeatures.filter(f => f.group === group);
    const base: Record<string, boolean> = {};
    menuFeatures.forEach(f => { base[f.key] = true; });
    permissions.forEach(p => { base[p.feature] = p.canView === "true"; });
    const current = pendingPerms ?? base;
    const allOn = groupFeatures.every(f => current[f.key]);
    const updated = { ...current };
    groupFeatures.forEach(f => { updated[f.key] = !allOn; });
    setPendingPerms(updated);
  };

  const handleSave = async () => {
    if (!selectedTypeId || !pendingPerms) return;
    setSaving(true);
    try {
      const perms = menuFeatures.map(f => ({
        feature: f.key,
        canView: pendingPerms[f.key] ? "true" : "false",
      }));
      await apiRequest("POST", `/api/user-types/${selectedTypeId}/permissions`, { permissions: perms });
      await queryClient.invalidateQueries({ queryKey: ["/api/user-types", selectedTypeId, "permissions"] });
      setPendingPerms(null);
      toast({ title: "Permissões salvas com sucesso" });
    } catch {
      toast({ title: "Erro ao salvar permissões", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: { id: string; name: string; description: string }) =>
      apiRequest("POST", "/api/user-types", data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-types"] });
      setShowNewDialog(false);
      setNewForm({ id: "", name: "", description: "" });
      toast({ title: "Tipo de usuário criado" });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao criar tipo", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiRequest("PUT", `/api/user-types/${editForm.id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-types"] });
      setShowEditDialog(false);
      toast({ title: "Tipo de usuário atualizado" });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/user-types/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/user-types"] });
      if (selectedTypeId === deleteId) { setSelectedTypeId(null); setPendingPerms(null); }
      setDeleteId(null);
      toast({ title: "Tipo removido" });
    },
    onError: (e: any) => toast({ title: e.message || "Erro ao remover", variant: "destructive" }),
  });

  const isDirty = pendingPerms !== null;

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Permissões"
        breadcrumbs={[{ label: "Configurações" }, { label: "Permissões" }]}
      />

      <div className="p-4 md:p-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">

          {/* Left: User Types List */}
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Tipos de Usuário
                </CardTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowNewDialog(true)} data-testid="button-new-user-type">
                  <Plus className="h-3.5 w-3.5" />
                  Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {loadingTypes ? (
                <div className="space-y-2 p-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-1 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
                  {userTypes.map(ut => (
                    <button
                      key={ut.id}
                      onClick={() => handleSelectType(ut.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between gap-2 group ${selectedTypeId === ut.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      data-testid={`button-type-${ut.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{ut.name}</span>
                          {ut.isSystem === "true" && (
                            <Lock className={`h-3 w-3 shrink-0 ${selectedTypeId === ut.id ? "text-primary-foreground/70" : "text-muted-foreground"}`} />
                          )}
                        </div>
                        {ut.description && (
                          <p className={`text-xs truncate mt-0.5 ${selectedTypeId === ut.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{ut.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ut.isSystem !== "true" && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); setEditForm({ id: ut.id, name: ut.name, description: ut.description || "" }); setShowEditDialog(true); }}
                              className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 transition-opacity ${selectedTypeId === ut.id ? "text-primary-foreground" : ""}`}
                              data-testid={`button-edit-type-${ut.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteId(ut.id); }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-destructive transition-opacity"
                              data-testid={`button-delete-type-${ut.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                        <ChevronRight className={`h-3.5 w-3.5 ${selectedTypeId === ut.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Permissions Matrix */}
          {!selectedTypeId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Shield className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">Selecione um tipo de usuário para gerenciar as permissões</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedType?.name}</CardTitle>
                      {selectedType?.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{selectedType.description}</p>
                      )}
                    </div>
                    {isDirty && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPendingPerms(null)} data-testid="button-discard-perms">
                          Descartar
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-perms">
                          {saving ? "Salvando..." : "Salvar Permissões"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>

              {loadingPerms ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {groups.map(group => {
                    const features = menuFeatures.filter(f => f.group === group);
                    const allOn = features.every(f => permMap[f.key]);
                    const someOn = features.some(f => permMap[f.key]);
                    return (
                      <Card key={group}>
                        <CardHeader className="pb-2 pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{groupIcons[group] || "📁"}</span>
                              <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                              <Badge variant="outline" className="text-xs h-5">
                                {features.filter(f => permMap[f.key]).length}/{features.length}
                              </Badge>
                            </div>
                            <button
                              onClick={() => handleToggleGroup(group)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              data-testid={`button-toggle-group-${group}`}
                            >
                              {allOn ? <CheckSquare className="h-4 w-4 text-primary" /> : someOn ? <CheckSquare className="h-4 w-4 text-primary/40" /> : <Square className="h-4 w-4" />}
                              {allOn ? "Desmarcar todos" : "Marcar todos"}
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                          <div className="divide-y">
                            {features.map(f => {
                              const canView = permMap[f.key];
                              return (
                                <div key={f.key} className="flex items-center justify-between py-2.5" data-testid={`row-feature-${f.key}`}>
                                  <div className="flex items-center gap-2.5">
                                    {canView
                                      ? <Eye className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                      : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                    }
                                    <span className={`text-sm ${canView ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                      {f.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-xs font-medium ${canView ? "text-green-600" : "text-muted-foreground"}`}>
                                      {canView ? "Pode ver" : "Não pode ver"}
                                    </span>
                                    <Switch
                                      checked={canView}
                                      onCheckedChange={() => handleToggle(f.key)}
                                      data-testid={`switch-feature-${f.key}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {isDirty && (
                    <div className="flex justify-end gap-2 pt-1 pb-4">
                      <Button variant="outline" onClick={() => setPendingPerms(null)}>Descartar alterações</Button>
                      <Button onClick={handleSave} disabled={saving} data-testid="button-save-perms-bottom">
                        {saving ? "Salvando..." : "Salvar Permissões"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* New User Type Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Tipo de Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nome do tipo *</Label>
              <Input
                id="new-name"
                placeholder="Ex: Supervisor, Financeiro..."
                value={newForm.name}
                onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                data-testid="input-new-type-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-id">Identificador (slug) *</Label>
              <Input
                id="new-id"
                placeholder="Ex: supervisor, financeiro..."
                value={newForm.id}
                onChange={e => setNewForm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                data-testid="input-new-type-id"
              />
              <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens. Não pode ser alterado depois.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-desc">Descrição</Label>
              <Textarea
                id="new-desc"
                placeholder="Descreva as responsabilidades deste tipo..."
                value={newForm.description}
                onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                data-testid="input-new-type-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate(newForm)}
              disabled={!newForm.name || !newForm.id || createMutation.isPending}
              data-testid="button-confirm-new-type"
            >
              {createMutation.isPending ? "Criando..." : "Criar Tipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Tipo de Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Identificador</Label>
              <Input value={editForm.id} disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                data-testid="input-edit-type-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Descrição</Label>
              <Textarea
                id="edit-desc"
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                data-testid="input-edit-type-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => editMutation.mutate({ name: editForm.name, description: editForm.description })}
              disabled={!editForm.name || editMutation.isPending}
              data-testid="button-confirm-edit-type"
            >
              {editMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tipo de usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as permissões associadas serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
