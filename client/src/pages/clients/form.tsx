import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Pencil, Eye, Search } from "lucide-react";
import type { Client, DeliveryLocation } from "@shared/schema";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { fetchAddressFromCep } from "@/lib/cep";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

const clientFormSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  cep: z.string().optional(),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  contactName: z.string().optional(),
  dailyCost: z.string().optional(),
  yardGraceDays: z.coerce.number().int().min(0).optional(),
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres").optional().or(z.literal("")),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  isActive: z.string().default("true"),
});

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function buildLocationFullAddress(loc: DeliveryLocation): string {
  const parts = [];
  if (loc.address) {
    let addressPart = loc.address;
    if (loc.addressNumber) addressPart += `, ${loc.addressNumber}`;
    parts.push(addressPart);
  }
  if (loc.neighborhood) parts.push(loc.neighborhood);
  if (loc.city) {
    let cityPart = loc.city;
    if (loc.state) cityPart += ` - ${loc.state}`;
    parts.push(cityPart);
  }
  if (loc.cep) parts.push(loc.cep);
  return parts.join(", ");
}

const locationFormSchema = z.object({
  name: z.string().min(2, "Nome do local é obrigatório"),
  cnpj: z.string().optional(),
  fullAddress: z.string().optional(),
  cep: z.string().optional().transform(val => val ? val.replace(/\D/g, "") : ""),
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  responsibleName: z.string().min(2, "Nome do responsável é obrigatório"),
  responsiblePhone: z.string().optional(),
  emails: z.array(z.string()).transform((arr) => arr.filter(e => e.trim() !== "")).pipe(
    z.array(z.string().email("Email inválido")).min(1, "Pelo menos um email é obrigatório")
  ),
  isActive: z.string().default("true"),
});

type ClientFormData = z.infer<typeof clientFormSchema>;
type LocationFormData = z.infer<typeof locationFormSchema>;

export default function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = id && id !== "novo";
  
  // Check URL for tab parameter
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") === "locais" ? "locais" : "dados";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [viewLocationDialogOpen, setViewLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: !!isEditing,
  });

  const { data: locations, isLoading: locationsLoading } = useQuery<DeliveryLocation[]>({
    queryKey: ["/api/clients", id, "locations"],
    enabled: !!isEditing,
  });

  const [isFetchingClientCep, setIsFetchingClientCep] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      phone: "",
      email: "",
      contactName: "",
      dailyCost: "20.00",
      yardGraceDays: 0,
      username: "",
      password: "",
      isActive: "true",
    },
  });

  const locationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
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
      responsibleName: "",
      responsiblePhone: "",
      emails: [""],
      isActive: "true",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || "",
        cnpj: client.cnpj || "",
        cep: client.cep || "",
        address: client.address || "",
        addressNumber: client.addressNumber || "",
        complement: client.complement || "",
        neighborhood: client.neighborhood || "",
        city: client.city || "",
        state: client.state || "",
        phone: client.phone || "",
        email: client.email || "",
        contactName: client.contactName || "",
        dailyCost: client.dailyCost || "20.00",
        yardGraceDays: client.yardGraceDays ?? 0,
        username: client.username || "",
        password: "",
        isActive: client.isActive || "true",
      });
    }
  }, [client, form]);

  const handleClientCepBlur = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsFetchingClientCep(true);
    try {
      const addressData = await fetchAddressFromCep(cleanCep);
      if (addressData) {
        form.setValue("address", addressData.address);
        form.setValue("neighborhood", addressData.neighborhood);
        form.setValue("city", addressData.city);
        form.setValue("state", addressData.state);
        toast({ title: "Endereço preenchido automaticamente" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setIsFetchingClientCep(false);
    }
  };

  const clientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/clients/${id}`, data);
      }
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: isEditing ? "Cliente atualizado com sucesso" : "Cliente cadastrado com sucesso" });
      navigate("/clientes");
    },
    onError: () => {
      toast({ title: "Erro ao salvar cliente", variant: "destructive" });
    },
  });

  const locationMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      return apiRequest("POST", `/api/clients/${id}/locations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "locations"] });
      toast({ title: "Local de entrega adicionado com sucesso" });
      setLocationDialogOpen(false);
      locationForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar local de entrega", variant: "destructive" });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      await apiRequest("DELETE", `/api/delivery-locations/${locationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "locations"] });
      toast({ title: "Local de entrega excluído com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir local de entrega", variant: "destructive" });
    },
  });

  const editLocationMutation = useMutation({
    mutationFn: async (data: LocationFormData & { id: string }) => {
      const { id: locationId, ...rest } = data;
      return apiRequest("PATCH", `/api/delivery-locations/${locationId}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "locations"] });
      toast({ title: "Local de entrega atualizado com sucesso" });
      setEditLocationDialogOpen(false);
      setSelectedLocation(null);
      locationForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar local de entrega", variant: "destructive" });
    },
  });

  const handleEditLocation = (loc: DeliveryLocation) => {
    setSelectedLocation(loc);
    locationForm.reset({
      name: loc.name || "",
      cnpj: loc.cnpj || "",
      fullAddress: buildLocationFullAddress(loc),
      cep: loc.cep || "",
      address: loc.address || "",
      addressNumber: loc.addressNumber || "",
      complement: loc.complement || "",
      neighborhood: loc.neighborhood || "",
      city: loc.city || "",
      state: loc.state || "",
      latitude: loc.latitude || "",
      longitude: loc.longitude || "",
      responsibleName: loc.responsibleName || "",
      responsiblePhone: loc.responsiblePhone || "",
      emails: loc.emails?.length ? loc.emails : [""],
      isActive: loc.isActive || "true",
    });
    setEditLocationDialogOpen(true);
  };

  const handleViewLocation = (loc: DeliveryLocation) => {
    setSelectedLocation(loc);
    setViewLocationDialogOpen(true);
  };

  const handleLocationAddressSelect = (addressData: {
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
    locationForm.setValue("fullAddress", addressData.formattedAddress);
    locationForm.setValue("address", addressData.address);
    locationForm.setValue("addressNumber", addressData.addressNumber);
    locationForm.setValue("neighborhood", addressData.neighborhood);
    locationForm.setValue("city", addressData.city);
    locationForm.setValue("state", addressData.state);
    locationForm.setValue("cep", addressData.cep);
    if (addressData.latitude) {
      locationForm.setValue("latitude", String(addressData.latitude));
    }
    if (addressData.longitude) {
      locationForm.setValue("longitude", String(addressData.longitude));
    }
  };

  const locationColumns = [
    { key: "name", label: "Nome do Local" },
    { key: "cnpj", label: "CNPJ" },
    { 
      key: "addressFull", 
      label: "Endereço",
      render: (loc: DeliveryLocation) => (
        <span>{loc.address}, {loc.addressNumber} - {loc.neighborhood}, {loc.city}/{loc.state}</span>
      ),
    },
    { key: "responsibleName", label: "Responsável" },
    {
      key: "emails",
      label: "Emails",
      render: (loc: DeliveryLocation) => (
        <span>{loc.emails?.join(", ") || "-"}</span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (loc: DeliveryLocation) => (
        <Badge variant={loc.isActive === "true" ? "default" : "secondary"}>
          {loc.isActive === "true" ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "w-28",
      render: (loc: DeliveryLocation) => (
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleViewLocation(loc);
            }}
            data-testid={`button-view-location-${loc.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleEditLocation(loc);
            }}
            data-testid={`button-edit-location-${loc.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              deleteLocationMutation.mutate(loc.id);
            }}
            data-testid={`button-delete-location-${loc.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isEditing && clientLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={isEditing ? "Editar Cliente" : "Novo Cliente"}
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Clientes", href: "/clientes" },
          { label: isEditing ? "Editar" : "Novo" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => clientMutation.mutate(data))} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="dados" data-testid="tab-client-data">Dados do Cliente</TabsTrigger>
                <TabsTrigger value="locais" disabled={!isEditing} data-testid="tab-locations">
                  Locais de Entrega {isEditing && locations?.length ? `(${locations.length})` : ""}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados">
                <Card>
                  <CardContent className="grid gap-4 md:grid-cols-2 pt-6">
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
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                {...field}
                                placeholder="00000-000"
                                data-testid="input-client-cep"
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleClientCepBlur(e.target.value);
                                }}
                              />
                              {isFetchingClientCep && (
                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Endereço</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="addressNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="complement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-complement" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-neighborhood" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Município</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-client-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-client-state">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {brazilianStates.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
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
                            <Input 
                              {...field} 
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              data-testid="input-client-daily-cost" 
                            />
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
                            <Input 
                              {...field} 
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              data-testid="input-client-yard-grace-days"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="usuario.cliente" data-testid="input-client-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isEditing ? "Nova Senha" : "Senha"}</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              {...field} 
                              placeholder={isEditing ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                              data-testid="input-client-password" 
                            />
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
                              data-testid="switch-client-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="locais">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                    <CardTitle>Locais de Entrega</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar local..."
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          className="pl-9 w-64"
                          data-testid="input-search-location"
                        />
                      </div>
                      <Button size="sm" type="button" onClick={() => setLocationDialogOpen(true)} data-testid="button-add-location">
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Local
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={locationColumns}
                      data={(locations ?? []).filter(loc => 
                        loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
                        loc.city?.toLowerCase().includes(locationSearch.toLowerCase()) ||
                        loc.neighborhood?.toLowerCase().includes(locationSearch.toLowerCase()) ||
                        loc.responsibleName?.toLowerCase().includes(locationSearch.toLowerCase()) ||
                        loc.cnpj?.includes(locationSearch)
                      )}
                      isLoading={locationsLoading}
                      keyField="id"
                      emptyMessage={locationSearch ? "Nenhum local encontrado" : "Nenhum local de entrega cadastrado"}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/clientes")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={clientMutation.isPending} data-testid="button-save-client">
                {clientMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>

        <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
          <DialogContent 
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Novo Local de Entrega</DialogTitle>
            </DialogHeader>
            <Form {...locationForm}>
              <form
                onSubmit={locationForm.handleSubmit(
                  (data) => locationMutation.mutate(data),
                  (errors) => {
                    const firstError = Object.values(errors)[0];
                    if (firstError?.message) {
                      toast({ 
                        title: "Erro de validação", 
                        description: String(firstError.message),
                        variant: "destructive" 
                      });
                    }
                  }
                )}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={locationForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Local *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Filial Centro" data-testid="input-location-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="00.000.000/0000-00" data-testid="input-location-cnpj" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={locationForm.control}
                  name="fullAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço *</FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          value={field.value || ""}
                          onChange={handleLocationAddressSelect}
                          onInputChange={field.onChange}
                          placeholder="Digite o endereço para buscar..."
                          testId="input-location-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={locationForm.control}
                  name="complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Apto, Sala, Bloco..." data-testid="input-location-complement" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={locationForm.control}
                    name="responsibleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável do Local *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-location-responsible-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="responsiblePhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone do Responsável</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(00) 00000-0000" data-testid="input-location-responsible-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel>Emails *</FormLabel>
                  {locationForm.watch("emails")?.map((_, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <FormField
                        control={locationForm.control}
                        name={`emails.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input {...field} type="email" placeholder="email@exemplo.com" data-testid={`input-location-email-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {index > 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const emails = locationForm.getValues("emails");
                            locationForm.setValue("emails", emails.filter((_, i) => i !== index));
                          }}
                          data-testid={`button-remove-email-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const emails = locationForm.getValues("emails") || [];
                      locationForm.setValue("emails", [...emails, ""]);
                    }}
                    data-testid="button-add-email"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Email
                  </Button>
                  {locationForm.formState.errors.emails && (
                    <p className="text-sm font-medium text-destructive">{locationForm.formState.errors.emails.message}</p>
                  )}
                </div>
                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => setLocationDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={locationMutation.isPending} data-testid="button-save-location">
                    {locationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Adicionar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={editLocationDialogOpen} onOpenChange={(open) => {
          setEditLocationDialogOpen(open);
          if (!open) {
            setSelectedLocation(null);
            locationForm.reset();
          }
        }}>
          <DialogContent 
            className="max-w-3xl max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Editar Local de Entrega</DialogTitle>
            </DialogHeader>
            <Form {...locationForm}>
              <form
                onSubmit={locationForm.handleSubmit(
                  (data) => {
                    if (selectedLocation) {
                      editLocationMutation.mutate({ ...data, id: selectedLocation.id });
                    }
                  },
                  (errors) => {
                    const firstError = Object.values(errors)[0];
                    if (firstError?.message) {
                      toast({ 
                        title: "Erro de validação", 
                        description: String(firstError.message),
                        variant: "destructive" 
                      });
                    }
                  }
                )}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={locationForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Local *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: Filial Centro" data-testid="input-edit-location-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="00.000.000/0000-00" data-testid="input-edit-location-cnpj" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={locationForm.control}
                  name="fullAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço *</FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          value={field.value || ""}
                          onChange={handleLocationAddressSelect}
                          onInputChange={field.onChange}
                          placeholder="Digite o endereço para buscar..."
                          testId="input-edit-location-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={locationForm.control}
                  name="complement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Apto, Sala, Bloco..." data-testid="input-edit-location-complement" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={locationForm.control}
                    name="responsibleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável do Local *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-location-responsible-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="responsiblePhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone do Responsável</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(00) 00000-0000" data-testid="input-edit-location-responsible-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel>Emails *</FormLabel>
                  {locationForm.watch("emails")?.map((_, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <FormField
                        control={locationForm.control}
                        name={`emails.${index}`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input {...field} type="email" placeholder="email@exemplo.com" data-testid={`input-edit-location-email-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {index > 0 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            const emails = locationForm.getValues("emails");
                            locationForm.setValue("emails", emails.filter((_, i) => i !== index));
                          }}
                          data-testid={`button-edit-remove-email-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const emails = locationForm.getValues("emails") || [];
                      locationForm.setValue("emails", [...emails, ""]);
                    }}
                    data-testid="button-edit-add-email"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Email
                  </Button>
                  {locationForm.formState.errors.emails && (
                    <p className="text-sm font-medium text-destructive">{locationForm.formState.errors.emails.message}</p>
                  )}
                </div>
                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => setEditLocationDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={editLocationMutation.isPending} data-testid="button-update-location">
                    {editLocationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={viewLocationDialogOpen} onOpenChange={(open) => {
          setViewLocationDialogOpen(open);
          if (!open) setSelectedLocation(null);
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do Local de Entrega</DialogTitle>
            </DialogHeader>
            {selectedLocation && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome do Local</p>
                    <p className="font-medium" data-testid="view-location-name">{selectedLocation.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CNPJ</p>
                    <p className="font-medium" data-testid="view-location-cnpj">{selectedLocation.cnpj || "-"}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">CEP</p>
                    <p className="font-medium" data-testid="view-location-cep">{selectedLocation.cep}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="font-medium" data-testid="view-location-address">{selectedLocation.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Número</p>
                    <p className="font-medium" data-testid="view-location-number">{selectedLocation.addressNumber}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Complemento</p>
                    <p className="font-medium" data-testid="view-location-complement">{selectedLocation.complement || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bairro</p>
                    <p className="font-medium" data-testid="view-location-neighborhood">{selectedLocation.neighborhood}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Município</p>
                    <p className="font-medium" data-testid="view-location-city">{selectedLocation.city}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">UF</p>
                    <p className="font-medium" data-testid="view-location-state">{selectedLocation.state}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Responsável</p>
                    <p className="font-medium" data-testid="view-location-responsible">{selectedLocation.responsibleName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium" data-testid="view-location-phone">{selectedLocation.responsiblePhone || "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Emails</p>
                  <p className="font-medium" data-testid="view-location-emails">{selectedLocation.emails?.join(", ") || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={selectedLocation.isActive === "true" ? "default" : "secondary"} data-testid="view-location-status">
                    {selectedLocation.isActive === "true" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setViewLocationDialogOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
