import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Truck, ChevronsUpDown, Check, ArrowLeft, Package, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Manufacturer, Yard, Driver } from "@shared/schema";

const formSchema = z.object({
  collectType: z.enum(["coleta", "transferencia"]).default("coleta"),
  vehicleChassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres"),
  manufacturerId: z.string().min(1, "Montadora é obrigatória"),
  yardId: z.string().min(1, "Pátio de destino é obrigatório"),
  driverId: z.string().min(1, "Motorista é obrigatório"),
  collectDate: z.string().optional(),
  notes: z.string().optional(),
  startLatitude: z.string().optional(),
  startLongitude: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CollectFormPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: manufacturers } = useQuery<Manufacturer[]>({ queryKey: ["/api/manufacturers"] });
  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      collectType: "coleta",
      vehicleChassi: "",
      manufacturerId: "",
      yardId: "",
      driverId: "",
      collectDate: formatDateTimeLocal(new Date()),
      notes: "",
      startLatitude: "",
      startLongitude: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/collects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Coleta registrada - Veículo adicionado ao estoque" });
      navigate("/coletas");
    },
    onError: () => {
      toast({ title: "Erro ao salvar coleta", variant: "destructive" });
    },
  });

  const activeDrivers = drivers?.filter((d) => d.isActive === "true" && d.isApto === "true");
  const activeManufacturers = manufacturers?.filter((m) => m.isActive === "true");
  const activeYards = yards?.filter((y) => y.isActive === "true");

  const [openManufacturer, setOpenManufacturer] = useState(false);
  const [openYard, setOpenYard] = useState(false);
  const [openDriver, setOpenDriver] = useState(false);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Nova Coleta"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Coletas", href: "/coletas" },
          { label: "Nova" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/coletas")} 
            className="mb-4"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Registrar Nova Coleta</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="collectType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Coleta *</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => field.onChange("coleta")}
                              data-testid="button-type-coleta"
                              className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                                field.value === "coleta"
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
                              )}
                            >
                              <Package className="h-4 w-4" />
                              Coleta
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange("transferencia")}
                              data-testid="button-type-transferencia"
                              className={cn(
                                "flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
                                field.value === "transferencia"
                                  ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400"
                                  : "border-border bg-background text-muted-foreground hover:border-purple-300"
                              )}
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                              Transferência
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vehicleChassi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chassi do Veículo *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Digite o chassi (17 caracteres)"
                            maxLength={17}
                            className="uppercase"
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-chassi"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="manufacturerId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Origem (Montadora) *</FormLabel>
                        <Popover open={openManufacturer} onOpenChange={setOpenManufacturer}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="select-manufacturer"
                              >
                                {field.value
                                  ? activeManufacturers?.find((m) => m.id === field.value)?.name
                                  : "Selecione a montadora"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar montadora..." />
                              <CommandList>
                                <CommandEmpty>Nenhuma montadora encontrada.</CommandEmpty>
                                <CommandGroup>
                                  {activeManufacturers?.map((manufacturer) => (
                                    <CommandItem
                                      key={manufacturer.id}
                                      value={manufacturer.name}
                                      onSelect={() => {
                                        field.onChange(manufacturer.id);
                                        setOpenManufacturer(false);
                                        if (manufacturer.latitude && manufacturer.longitude) {
                                          form.setValue("startLatitude", manufacturer.latitude);
                                          form.setValue("startLongitude", manufacturer.longitude);
                                        }
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === manufacturer.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {manufacturer.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="yardId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Destino (Pátio) *</FormLabel>
                        <Popover open={openYard} onOpenChange={setOpenYard}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="select-yard"
                              >
                                {field.value
                                  ? activeYards?.find((y) => y.id === field.value)?.name
                                  : "Selecione o pátio"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar pátio..." />
                              <CommandList>
                                <CommandEmpty>Nenhum pátio encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {activeYards?.map((yard) => (
                                    <CommandItem
                                      key={yard.id}
                                      value={yard.name}
                                      onSelect={() => {
                                        field.onChange(yard.id);
                                        setOpenYard(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === yard.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {yard.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Motorista *</FormLabel>
                        <Popover open={openDriver} onOpenChange={setOpenDriver}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="select-driver"
                              >
                                {field.value
                                  ? activeDrivers?.find((d) => d.id === field.value)?.name
                                  : "Selecione o motorista"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar motorista..." />
                              <CommandList>
                                <CommandEmpty>Nenhum motorista encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {activeDrivers?.map((driver) => (
                                    <CommandItem
                                      key={driver.id}
                                      value={driver.name}
                                      onSelect={() => {
                                        field.onChange(driver.id);
                                        setOpenDriver(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === driver.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {driver.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collectDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data da Coleta</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="datetime-local"
                            data-testid="input-collect-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Observações adicionais..."
                            rows={3}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/coletas")}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      className="flex-1"
                      data-testid="button-submit"
                    >
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Registrar Coleta
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
