import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Client } from "@shared/schema";
import { AddressAutocomplete } from "@/components/address-autocomplete";

function buildFullAddress(client: Client): string {
  const parts = [];
  if (client.address) {
    let addressPart = client.address;
    if (client.addressNumber) addressPart += `, ${client.addressNumber}`;
    parts.push(addressPart);
  }
  if (client.neighborhood) parts.push(client.neighborhood);
  if (client.city) {
    let cityPart = client.city;
    if (client.state) cityPart += ` - ${client.state}`;
    parts.push(cityPart);
  }
  if (client.cep) parts.push(client.cep);
  return parts.join(", ");
}

const formSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  fullAddress: z.string().optional(),
  cep: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  contactName: z.string().optional(),
  dailyCost: z.string().optional(),
  yardGraceDays: z.coerce.number().int().min(0).optional(),
  isActive: z.string().default("true"),
});

type FormData = z.infer<typeof formSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string | null;
  onEditFullPage?: (clientId: string) => void;
}

export function ClientFormDialog({ open, onOpenChange, clientId, onEditFullPage }: ClientFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!clientId;

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    enabled: isEditing && open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      fullAddress: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      latitude: "",
      longitude: "",
      phone: "",
      email: "",
      contactName: "",
      dailyCost: "20.00",
      yardGraceDays: 0,
      isActive: "true",
    },
  });

  useEffect(() => {
    if (client && isEditing) {
      form.reset({
        name: client.name || "",
        cnpj: client.cnpj || "",
        fullAddress: buildFullAddress(client),
        cep: client.cep || "",
        address: client.address || "",
        addressNumber: client.addressNumber || "",
        complement: client.complement || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        latitude: client.latitude || "",
        longitude: client.longitude || "",
        phone: client.phone || "",
        email: client.email || "",
        contactName: client.contactName || "",
        dailyCost: client.dailyCost || "20.00",
        yardGraceDays: client.yardGraceDays ?? 0,
        isActive: client.isActive || "true",
      });
    } else if (!isEditing && open) {
      form.reset({
        name: "",
        cnpj: "",
        fullAddress: "",
        cep: "",
        address: "",
        addressNumber: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        latitude: "",
        longitude: "",
        phone: "",
        email: "",
        contactName: "",
        dailyCost: "20.00",
        yardGraceDays: 0,
        isActive: "true",
      });
    }
  }, [client, form, isEditing, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/clients/${clientId}`, data);
      }
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: isEditing ? "Cliente atualizado com sucesso" : "Cliente cadastrado com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao salvar cliente", variant: "destructive" });
    },
  });

  const handleAddressSelect = (addressData: {
    address: string;
    addressNumber: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    formattedAddress: string;
    latitude?: number;
    longitude?: number;
  }) => {
    form.setValue("fullAddress", addressData.formattedAddress);
    form.setValue("address", addressData.address);
    form.setValue("addressNumber", addressData.addressNumber);
    form.setValue("neighborhood", addressData.neighborhood);
    form.setValue("city", addressData.city);
    form.setValue("state", addressData.state);
    form.setValue("cep", addressData.cep);
    if (addressData.latitude) {
      form.setValue("latitude", String(addressData.latitude));
    }
    if (addressData.longitude) {
      form.setValue("longitude", String(addressData.longitude));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] p-0"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-address-suggestion]')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{isEditing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
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
                  <h3 className="font-medium text-sm text-muted-foreground">Dados do Cliente</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00.000.000/0000-00" data-testid="input-client-cnpj" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-client-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Contato</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-contact" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dailyCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custo de Diária (R$)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" data-testid="input-client-daily-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="yardGraceDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dias de Carência no Pátio</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="1" min="0" placeholder="0" data-testid="input-client-yard-grace-days" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">Endereço</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullAddress"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <AddressAutocomplete
                              value={field.value || ""}
                              onChange={handleAddressSelect}
                              onInputChange={field.onChange}
                              placeholder="Digite o endereço para buscar..."
                              testId="input-client-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="complement"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Apto, Sala, Bloco..." data-testid="input-client-complement" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Ativo</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === "true"}
                              onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                              data-testid="switch-client-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {isEditing && onEditFullPage && (
                  <div className="text-sm text-muted-foreground">
                    Para gerenciar locais de entrega,{" "}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto p-0 text-primary underline"
                      onClick={() => {
                        onOpenChange(false);
                        onEditFullPage(clientId!);
                      }}
                    >
                      abra a página completa de edição
                    </Button>
                    .
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={mutation.isPending} data-testid="button-save-client">
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
