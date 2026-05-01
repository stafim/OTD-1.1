import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertTravelRateSchema, type InsertTravelRate, type TravelRate } from "@shared/schema";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const RATE_TYPE_LABELS: Record<string, string> = {
  por_km: "Por Km rodado",
  fixo: "Valor fixo",
  por_veiculo: "Por veículo",
};

interface Props {
  open: boolean;
  onClose: () => void;
  editingId: string | null;
}

export function TravelRateFormDialog({ open, onClose, editingId }: Props) {
  const { toast } = useToast();
  const isEditing = !!editingId;

  const { data: existing } = useQuery<TravelRate>({
    queryKey: ["/api/travel-rates", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const res = await fetch(`/api/travel-rates/${editingId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      return res.json();
    },
  });

  const form = useForm<InsertTravelRate>({
    resolver: zodResolver(insertTravelRateSchema),
    defaultValues: {
      name: "",
      rateType: "fixo",
      rateValue: "",
      notes: "",
      isActive: "true",
      requiresApproval: "false",
    },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name ?? "",
        rateType: existing.rateType ?? "fixo",
        rateValue: existing.rateValue ?? "",
        notes: existing.notes ?? "",
        isActive: existing.isActive ?? "true",
        requiresApproval: existing.requiresApproval ?? "false",
      });
    } else if (!editingId) {
      form.reset({
        name: "",
        rateType: "fixo",
        rateValue: "",
        notes: "",
        isActive: "true",
        requiresApproval: "false",
      });
    }
  }, [existing, editingId]);

  const mutation = useMutation({
    mutationFn: async (data: InsertTravelRate) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/travel-rates/${editingId}`, data);
      }
      return apiRequest("POST", "/api/travel-rates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/travel-rates"] });
      toast({ title: isEditing ? "Tarifa atualizada!" : "Tarifa criada!" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar tarifa", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertTravelRate) => mutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Tarifa de Viagem" : "Nova Tarifa de Viagem"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Tarifa *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Tarifa Padrão Carro" {...field} data-testid="input-rate-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="rateType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Cobrança *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-rate-type">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(RATE_TYPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="rateValue" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$) *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0,00" {...field} data-testid="input-rate-value" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea placeholder="Observações adicionais..." rows={3} {...field} value={field.value ?? ""} data-testid="textarea-notes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "true"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-is-active">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="requiresApproval" render={({ field }) => (
                <FormItem>
                  <FormLabel>Requer Aprovação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? "false"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-requires-approval">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="false">Não (Tarifa Padrão)</SelectItem>
                      <SelectItem value="true">Sim (Tarifa Especial)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-rate">
                {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
