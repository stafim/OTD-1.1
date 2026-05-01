import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

export default function VehicleFormPage() {
  const { chassi: paramChassi } = useParams<{ chassi: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const decodedChassi = paramChassi ? decodeURIComponent(paramChassi) : "";
  const isEditing = paramChassi && paramChassi !== "novo";

  const { data: vehicle, isLoading: vehicleLoading } = useQuery<Vehicle>({
    queryKey: ["/api/vehicles", decodedChassi],
    enabled: !!isEditing,
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
    if (vehicle) {
      form.reset({
        chassi: vehicle.chassi || "",
        clientId: vehicle.clientId || "",
        yardId: vehicle.yardId || "",
        manufacturerId: vehicle.manufacturerId || "",
        color: vehicle.color || "",
        status: vehicle.status,
        notes: vehicle.notes || "",
      });
    }
  }, [vehicle, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/vehicles/${encodeURIComponent(decodedChassi)}`, data);
      }
      return apiRequest("POST", "/api/vehicles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: isEditing ? "Veículo atualizado com sucesso" : "Veículo cadastrado com sucesso" });
      navigate("/estoque");
    },
    onError: () => {
      toast({ title: "Erro ao salvar veículo", variant: "destructive" });
    },
  });

  if (isEditing && vehicleLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={isEditing ? "Editar Veículo" : "Novo Veículo"}
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Estoque", href: "/estoque" },
          { label: isEditing ? "Editar" : "Novo" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dados do Veículo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <FormItem className="md:col-span-2 lg:col-span-3">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-vehicle-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/estoque")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-vehicle">
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
