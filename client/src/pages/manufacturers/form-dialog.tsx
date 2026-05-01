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
import type { Manufacturer } from "@shared/schema";
import { AddressAutocomplete } from "@/components/address-autocomplete";

function buildFullAddress(manufacturer: Manufacturer): string {
  const parts = [];
  if (manufacturer.address) {
    let addressPart = manufacturer.address;
    if (manufacturer.addressNumber) addressPart += `, ${manufacturer.addressNumber}`;
    parts.push(addressPart);
  }
  if (manufacturer.neighborhood) parts.push(manufacturer.neighborhood);
  if (manufacturer.city) {
    let cityPart = manufacturer.city;
    if (manufacturer.state) cityPart += ` - ${manufacturer.state}`;
    parts.push(cityPart);
  }
  if (manufacturer.cep) parts.push(manufacturer.cep);
  return parts.join(", ");
}

const formSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
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
  isActive: z.string().default("true"),
});

type FormData = z.infer<typeof formSchema>;

interface ManufacturerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manufacturerId?: string | null;
}

export function ManufacturerFormDialog({ open, onOpenChange, manufacturerId }: ManufacturerFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!manufacturerId;

  const { data: manufacturer, isLoading } = useQuery<Manufacturer>({
    queryKey: ["/api/manufacturers", manufacturerId],
    enabled: isEditing && open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
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
      isActive: "true",
    },
  });

  useEffect(() => {
    if (manufacturer && isEditing) {
      form.reset({
        name: manufacturer.name || "",
        fullAddress: buildFullAddress(manufacturer),
        cep: manufacturer.cep || "",
        address: manufacturer.address || "",
        addressNumber: manufacturer.addressNumber || "",
        complement: manufacturer.complement || "",
        neighborhood: manufacturer.neighborhood || "",
        city: manufacturer.city || "",
        state: manufacturer.state || "",
        latitude: manufacturer.latitude || "",
        longitude: manufacturer.longitude || "",
        phone: manufacturer.phone || "",
        email: manufacturer.email || "",
        contactName: manufacturer.contactName || "",
        isActive: manufacturer.isActive || "true",
      });
    } else if (!isEditing && open) {
      form.reset({
        name: "",
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
        isActive: "true",
      });
    }
  }, [manufacturer, form, isEditing, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/manufacturers/${manufacturerId}`, data);
      }
      return apiRequest("POST", "/api/manufacturers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manufacturers"] });
      toast({ title: isEditing ? "Montadora atualizada com sucesso" : "Montadora cadastrada com sucesso" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao salvar montadora", variant: "destructive" });
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
          <DialogTitle>{isEditing ? "Editar Montadora" : "Nova Montadora"}</DialogTitle>
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
                  <h3 className="font-medium text-sm text-muted-foreground">Dados da Montadora</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-manufacturer-name" />
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
                            <Input {...field} data-testid="input-manufacturer-phone" />
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
                            <Input type="email" {...field} data-testid="input-manufacturer-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome do Contato</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-manufacturer-contact" />
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
                              testId="input-manufacturer-address"
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
                            <Input {...field} placeholder="Apto, Sala, Bloco..." data-testid="input-manufacturer-complement" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Ativo</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === "true"}
                              onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                              data-testid="switch-manufacturer-active"
                            />
                          </FormControl>
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
                  <Button type="submit" disabled={mutation.isPending} data-testid="button-save-manufacturer">
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
