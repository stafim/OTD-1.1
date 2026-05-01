import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Vehicle, Client, Yard, Manufacturer } from "@shared/schema";

const formSchema = z.object({
  chassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres"),
  clientId: z.string().optional(),
  yardId: z.string().optional(),
  manufacturerId: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(["pre_estoque", "em_estoque", "despachado", "entregue", "retirado"]),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleChassi?: string | null;
}

export function VehicleFormDialog({ open, onOpenChange, vehicleChassi }: VehicleFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!vehicleChassi;

  const { data: vehicle, isLoading } = useQuery<Vehicle>({
    queryKey: ["/api/vehicles", vehicleChassi],
    enabled: isEditing && open,
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: yards } = useQuery<Yard[]>({
    queryKey: ["/api/yards"],
  });

  const { data: manufacturers } = useQuery<Manufacturer[]>({
    queryKey: ["/api/manufacturers"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chassi: "",
      clientId: "",
      yardId: "",
      manufacturerId: "",
      color: "",
      status: "pre_estoque",
      notes: "",
    },
  });

  useEffect(() => {
    if (vehicle && isEditing) {
      form.reset({
        chassi: vehicle.chassi || "",
        clientId: vehicle.clientId || "",
        yardId: vehicle.yardId || "",
        manufacturerId: vehicle.manufacturerId || "",
        color: vehicle.color || "",
        status: vehicle.status,
        notes: vehicle.notes || "",
      });
    } else if (!isEditing && open) {
      form.reset({
        chassi: "",
        clientId: "",
        yardId: "",
        manufacturerId: "",
        color: "",
        status: "pre_estoque",
        notes: "",
      });
    }
  }, [vehicle, form, isEditing, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/vehicles/${encodeURIComponent(vehicleChassi)}`, data);
      }
      return apiRequest("POST", "/api/vehicles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: isEditing ? "Veículo atualizado com sucesso" : "Veículo cadastrado com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao salvar veículo", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{isEditing ? "Editar Veículo" : "Novo Veículo"}</DialogTitle>
        </DialogHeader>
        
        {isEditing && isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-8rem)] px-6 pb-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Dados do Veículo</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="chassi"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Chassi *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              disabled={!!isEditing}
                              data-testid="input-vehicle-chassi"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-status">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pre_estoque">Pré-estoque</SelectItem>
                              <SelectItem value="em_estoque">Em estoque</SelectItem>
                              <SelectItem value="despachado">Despachado</SelectItem>
                              <SelectItem value="entregue">Entregue</SelectItem>
                              <SelectItem value="retirado">Retirado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="manufacturerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montadora</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-manufacturer">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {manufacturers?.filter(m => m.isActive === "true").map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cor</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-vehicle-color" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-client">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="yardId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pátio Atual</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vehicle-yard">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {yards?.map((y) => (
                                <SelectItem key={y.id} value={y.id}>
                                  {y.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea {...field} data-testid="input-vehicle-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={mutation.isPending} data-testid="button-save-vehicle">
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </Form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
