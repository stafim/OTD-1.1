import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  Scale,
  AlertTriangle,
  GripVertical,
  ShieldAlert,
  ShieldCheck,
  Shield,
} from "lucide-react";
import type { EvaluationCriteria } from "@shared/schema";

export default function EvaluationPage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<EvaluationCriteria | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newPenaltyLeve, setNewPenaltyLeve] = useState("10");
  const [newPenaltyMedio, setNewPenaltyMedio] = useState("50");
  const [newPenaltyGrave, setNewPenaltyGrave] = useState("100");
  const [editedWeights, setEditedWeights] = useState<Record<string, string>>({});
  const [editedPenalties, setEditedPenalties] = useState<Record<string, { leve: string; medio: string; grave: string }>>({});
  const [isEditingWeights, setIsEditingWeights] = useState(false);

  const { data: criteria, isLoading } = useQuery<EvaluationCriteria[]>({
    queryKey: ["/api/evaluation-criteria"],
  });

  const activeCriteria = criteria?.filter(c => c.isActive === "true") || [];
  const totalWeight = activeCriteria.reduce((sum, c) => {
    const w = isEditingWeights ? parseFloat(editedWeights[c.id] || c.weight) : parseFloat(c.weight);
    return sum + (isNaN(w) ? 0 : w);
  }, 0);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; weight: string; penaltyLeve: string; penaltyMedio: string; penaltyGrave: string; order: number }) => {
      await apiRequest("POST", "/api/evaluation-criteria", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-criteria"] });
      setShowAddDialog(false);
      setNewName("");
      setNewWeight("");
      setNewPenaltyLeve("10");
      setNewPenaltyMedio("50");
      setNewPenaltyGrave("100");
      toast({ title: "Critério adicionado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar critério", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/evaluation-criteria/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-criteria"] });
      setEditingCriteria(null);
      toast({ title: "Critério atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar critério", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/evaluation-criteria/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-criteria"] });
      setDeletingId(null);
      toast({ title: "Critério removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao remover critério", variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (criteriaUpdates: { id: string; weight: string; order: number; penaltyLeve: string; penaltyMedio: string; penaltyGrave: string }[]) => {
      await apiRequest("PUT", "/api/evaluation-criteria/bulk-update", { criteria: criteriaUpdates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evaluation-criteria"] });
      setIsEditingWeights(false);
      setEditedWeights({});
      setEditedPenalties({});
      toast({ title: "Configurações atualizadas com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar configurações", variant: "destructive" });
    },
  });

  const handleAddCriteria = () => {
    const weight = parseFloat(newWeight);
    if (!newName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (isNaN(weight) || weight <= 0 || weight > 100) {
      toast({ title: "Peso deve ser entre 0.01 e 100", variant: "destructive" });
      return;
    }
    const pLeve = parseFloat(newPenaltyLeve);
    const pMedio = parseFloat(newPenaltyMedio);
    const pGrave = parseFloat(newPenaltyGrave);
    if (isNaN(pLeve) || pLeve < 0 || pLeve > 100 || isNaN(pMedio) || pMedio < 0 || pMedio > 100 || isNaN(pGrave) || pGrave < 0 || pGrave > 100) {
      toast({ title: "Penalidades devem ser entre 0 e 100%", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      weight: weight.toFixed(2),
      penaltyLeve: pLeve.toFixed(2),
      penaltyMedio: pMedio.toFixed(2),
      penaltyGrave: pGrave.toFixed(2),
      order: activeCriteria.length,
    });
  };

  const handleEditCriteria = () => {
    if (!editingCriteria) return;
    const weight = parseFloat(newWeight);
    if (!newName.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (isNaN(weight) || weight <= 0 || weight > 100) {
      toast({ title: "Peso deve ser entre 0.01 e 100", variant: "destructive" });
      return;
    }
    const pLeve = parseFloat(newPenaltyLeve);
    const pMedio = parseFloat(newPenaltyMedio);
    const pGrave = parseFloat(newPenaltyGrave);
    if (isNaN(pLeve) || pLeve < 0 || pLeve > 100 || isNaN(pMedio) || pMedio < 0 || pMedio > 100 || isNaN(pGrave) || pGrave < 0 || pGrave > 100) {
      toast({ title: "Penalidades devem ser entre 0 e 100%", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingCriteria.id,
      data: {
        name: newName.trim(),
        weight: weight.toFixed(2),
        penaltyLeve: pLeve.toFixed(2),
        penaltyMedio: pMedio.toFixed(2),
        penaltyGrave: pGrave.toFixed(2),
      },
    });
  };

  const handleStartEditWeights = () => {
    const weights: Record<string, string> = {};
    const penalties: Record<string, { leve: string; medio: string; grave: string }> = {};
    activeCriteria.forEach(c => {
      weights[c.id] = c.weight;
      penalties[c.id] = {
        leve: c.penaltyLeve || "10",
        medio: c.penaltyMedio || "50",
        grave: c.penaltyGrave || "100",
      };
    });
    setEditedWeights(weights);
    setEditedPenalties(penalties);
    setIsEditingWeights(true);
  };

  const handleSaveWeights = () => {
    const editTotal = activeCriteria.reduce((sum, c) => {
      return sum + parseFloat(editedWeights[c.id] || c.weight);
    }, 0);

    if (Math.abs(editTotal - 100) > 0.01) {
      toast({
        title: "Os pesos devem totalizar 100",
        description: `Total atual: ${editTotal.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    const updates = activeCriteria.map((c, i) => ({
      id: c.id,
      weight: parseFloat(editedWeights[c.id] || c.weight).toFixed(2),
      order: i,
      penaltyLeve: parseFloat(editedPenalties[c.id]?.leve || c.penaltyLeve || "10").toFixed(2),
      penaltyMedio: parseFloat(editedPenalties[c.id]?.medio || c.penaltyMedio || "50").toFixed(2),
      penaltyGrave: parseFloat(editedPenalties[c.id]?.grave || c.penaltyGrave || "100").toFixed(2),
    }));

    bulkUpdateMutation.mutate(updates);
  };

  const openEditDialog = (c: EvaluationCriteria) => {
    setEditingCriteria(c);
    setNewName(c.name);
    setNewWeight(c.weight);
    setNewPenaltyLeve(c.penaltyLeve || "10");
    setNewPenaltyMedio(c.penaltyMedio || "50");
    setNewPenaltyGrave(c.penaltyGrave || "100");
  };

  const getWeightColor = () => {
    if (Math.abs(totalWeight - 100) <= 0.01) return "text-green-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Critérios de Avaliação" />
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Critérios de Avaliação"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Avaliação" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Total dos Pesos</p>
              <p className={`text-2xl font-bold ${getWeightColor()}`}>
                {totalWeight.toFixed(2)} / 100
              </p>
            </div>
            {Math.abs(totalWeight - 100) > 0.01 && (
              <Badge variant="destructive" className="ml-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {totalWeight < 100 ? `Faltam ${(100 - totalWeight).toFixed(2)}` : `Excede ${(totalWeight - 100).toFixed(2)}`}
              </Badge>
            )}
            {Math.abs(totalWeight - 100) <= 0.01 && activeCriteria.length > 0 && (
              <Badge variant="default" className="ml-2 bg-green-600">Configurado</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditingWeights ? (
              <>
                <Button variant="outline" onClick={() => { setIsEditingWeights(false); setEditedWeights({}); setEditedPenalties({}); }} data-testid="button-cancel-weights">
                  Cancelar
                </Button>
                <Button onClick={handleSaveWeights} disabled={bulkUpdateMutation.isPending} data-testid="button-save-weights">
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
              </>
            ) : (
              <>
                {activeCriteria.length > 0 && (
                  <Button variant="outline" onClick={handleStartEditWeights} data-testid="button-edit-weights">
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar Configurações
                  </Button>
                )}
                <Button onClick={() => { setShowAddDialog(true); setNewName(""); setNewWeight(""); setNewPenaltyLeve("10"); setNewPenaltyMedio("50"); setNewPenaltyGrave("100"); }} data-testid="button-add-criteria">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Critério
                </Button>
              </>
            )}
          </div>
        </div>

        {activeCriteria.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Scale className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Nenhum critério cadastrado</h3>
              <p className="max-w-md mx-auto mb-4">
                Adicione critérios de avaliação para os motoristas. Cada critério possui um peso e penalidades configuráveis por nível de severidade.
              </p>
              <Button onClick={() => { setShowAddDialog(true); setNewName(""); setNewWeight(""); setNewPenaltyLeve("10"); setNewPenaltyMedio("50"); setNewPenaltyGrave("100"); }} data-testid="button-add-criteria-empty">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Primeiro Critério
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeCriteria.map((c, index) => (
              <Card key={c.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                      <span className="text-sm font-mono w-6 text-center">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-criteria-name-${c.id}`}>{c.name}</p>
                      {!isEditingWeights && (
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-yellow-600 flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Leve: -{parseFloat(c.penaltyLeve || "10").toFixed(0)}%
                          </span>
                          <span className="text-xs text-orange-600 flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Médio: -{parseFloat(c.penaltyMedio || "50").toFixed(0)}%
                          </span>
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Grave: -{parseFloat(c.penaltyGrave || "100").toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isEditingWeights ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-12 text-right">Peso:</Label>
                            <Input
                              type="number"
                              min="0.01"
                              max="100"
                              step="0.01"
                              value={editedWeights[c.id] || ""}
                              onChange={(e) => setEditedWeights(prev => ({ ...prev, [c.id]: e.target.value }))}
                              className="w-20 text-right h-8 text-sm"
                              data-testid={`input-weight-${c.id}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-12 text-right text-yellow-600">Leve:</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={editedPenalties[c.id]?.leve || ""}
                              onChange={(e) => setEditedPenalties(prev => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], leve: e.target.value }
                              }))}
                              className="w-20 text-right h-8 text-sm"
                              data-testid={`input-penalty-leve-${c.id}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-12 text-right text-orange-600">Médio:</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={editedPenalties[c.id]?.medio || ""}
                              onChange={(e) => setEditedPenalties(prev => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], medio: e.target.value }
                              }))}
                              className="w-20 text-right h-8 text-sm"
                              data-testid={`input-penalty-medio-${c.id}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-12 text-right text-red-600">Grave:</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={editedPenalties[c.id]?.grave || ""}
                              onChange={(e) => setEditedPenalties(prev => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], grave: e.target.value }
                              }))}
                              className="w-20 text-right h-8 text-sm"
                              data-testid={`input-penalty-grave-${c.id}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="secondary" data-testid={`badge-weight-${c.id}`}>
                          Peso: {parseFloat(c.weight).toFixed(0)}
                        </Badge>
                      )}
                      {!isEditingWeights && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(c)}
                            data-testid={`button-edit-criteria-${c.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingId(c.id)}
                            data-testid={`button-delete-criteria-${c.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Como funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Cada critério começa com 100 pontos e é avaliado por severidade: <strong>Sem Ocorrência</strong>, <strong>Leve</strong>, <strong>Médio</strong> ou <strong>Grave</strong>.</li>
              <li>Cada nível de severidade aplica uma penalidade configurável em % sobre os 100 pontos do critério.</li>
              <li>Exemplo: se "Leve" = 10%, o critério perde 10 pontos e fica com 90 pontos.</li>
              <li>O peso determina a importância relativa de cada critério na nota final ponderada.</li>
              <li>A soma dos pesos de todos os critérios deve ser exatamente 100.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Critério de Avaliação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Critério</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Pontualidade"
                data-testid="input-criteria-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (pontos)</Label>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Ex: 20"
                data-testid="input-criteria-weight"
              />
              <p className="text-xs text-muted-foreground">
                Peso atual utilizado: {totalWeight.toFixed(2)} / 100
              </p>
            </div>
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Penalidades por Severidade (% de perda)</Label>
              <p className="text-xs text-muted-foreground mb-3">Quanto % dos 100 pontos será perdido em cada nível</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-yellow-600 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Leve
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={newPenaltyLeve}
                      onChange={(e) => setNewPenaltyLeve(e.target.value)}
                      className="text-center"
                      data-testid="input-penalty-leve"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-orange-600 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Médio
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={newPenaltyMedio}
                      onChange={(e) => setNewPenaltyMedio(e.target.value)}
                      className="text-center"
                      data-testid="input-penalty-medio"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-600 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Grave
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={newPenaltyGrave}
                      onChange={(e) => setNewPenaltyGrave(e.target.value)}
                      className="text-center"
                      data-testid="input-penalty-grave"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddCriteria} disabled={createMutation.isPending} data-testid="button-save-criteria">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCriteria} onOpenChange={(open) => { if (!open) setEditingCriteria(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Critério</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Critério</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                data-testid="input-edit-criteria-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (pontos)</Label>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                data-testid="input-edit-criteria-weight"
              />
            </div>
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Penalidades por Severidade (% de perda)</Label>
              <p className="text-xs text-muted-foreground mb-3">Quanto % dos 100 pontos será perdido em cada nível</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-yellow-600 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Leve
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={newPenaltyLeve}
                      onChange={(e) => setNewPenaltyLeve(e.target.value)}
                      className="text-center"
                      data-testid="input-edit-penalty-leve"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-orange-600 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Médio
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={newPenaltyMedio}
                      onChange={(e) => setNewPenaltyMedio(e.target.value)}
                      className="text-center"
                      data-testid="input-edit-penalty-medio"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-red-600 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" /> Grave
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={newPenaltyGrave}
                      onChange={(e) => setNewPenaltyGrave(e.target.value)}
                      className="text-center"
                      data-testid="input-edit-penalty-grave"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCriteria(null)}>Cancelar</Button>
            <Button onClick={handleEditCriteria} disabled={updateMutation.isPending} data-testid="button-update-criteria">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Critério</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este critério? Se já houver avaliações usando-o, ele será apenas desativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete-criteria"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
