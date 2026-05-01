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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, X, CreditCard, FileText, IdCard, MapPin, FileCheck2, CheckCircle2, XCircle, AlertCircle, Plus, PenLine, Lock, Eye, EyeOff, UserCircle, User, Phone, Mail, Calendar, Briefcase, Save, UserPlus, Pencil, Shield, ShieldAlert, Camera, Hash, FileKey2, ToggleLeft, Smartphone, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Driver, Contract } from "@shared/schema";
import { fetchAddressFromCep } from "@/lib/cep";
import { getAccessToken } from "@/hooks/use-auth";

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

const cnhTypes = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cpf[10]);
}

const driverFormSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  cpf: z.string().min(11, "CPF inválido").max(14).refine(isValidCPF, { message: "CPF inválido" }),
  rg: z.string().optional().or(z.literal("")),
  cnpj: z.string().optional().or(z.literal("")),
  companyName: z.string().optional().or(z.literal("")),
  phone: z.string().min(10, "Telefone é obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  cep: z.string().min(8, "CEP é obrigatório"),
  address: z.string().optional().or(z.literal("")),
  addressNumber: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro é obrigatório"),
  city: z.string().min(2, "Município é obrigatório"),
  state: z.enum(brazilianStates, { required_error: "UF é obrigatória" }),
  driverType: z.enum(["coleta", "transporte"]).optional().or(z.literal("")),
  modality: z.enum(["pj", "clt", "agregado"]).optional().or(z.literal("")),
  cnhType: z.enum(cnhTypes, { required_error: "Tipo de CNH é obrigatório" }),
  profilePhoto: z.string().optional(),
  cnhFrontPhoto: z.string().optional(),
  cnhBackPhoto: z.string().optional(),
  rgPhoto: z.string().optional(),
  addressProofPhoto: z.string().optional(),
  isActive: z.string().default("true"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, { message: "As senhas não coincidem", path: ["confirmPassword"] });

type DriverFormData = z.infer<typeof driverFormSchema>;

const contractStatusLabel: Record<string, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

const contractStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ativo: "default",
  expirado: "secondary",
  suspenso: "outline",
  cancelado: "destructive",
};

const paymentTypeLabel: Record<string, string> = {
  por_km: "Por KM",
  fixo_mensal: "Fixo Mensal",
  por_entrega: "Por Entrega",
  comissao: "Comissão",
};

export default function DriverFormPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = id && id !== "novo";
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);
  const [deletionChannel, setDeletionChannel] = useState<string>("");
  const [deletionNotes, setDeletionNotes] = useState<string>("");

  const { data: driver, isLoading: driverLoading } = useQuery<Driver>({
    queryKey: ["/api/drivers", id],
    enabled: !!isEditing,
  });

  const { data: allContracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    enabled: !!isEditing,
  });

  const isLinkedToThisDriver = (c: any): boolean => {
    if (Array.isArray(c.driverIds) && c.driverIds.length > 0) return c.driverIds.includes(id);
    return c.driverId === id;
  };
  const getDriverIdsOf = (c: any): string[] => {
    if (Array.isArray(c.driverIds) && c.driverIds.length > 0) return c.driverIds;
    return c.driverId ? [c.driverId] : [];
  };
  const driverContracts = allContracts?.filter(isLinkedToThisDriver) ?? [];

  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string>("");

  const linkContractMutation = useMutation({
    mutationFn: (contractId: string) => {
      const c = (allContracts || []).find((x) => x.id === contractId);
      const existing = c ? getDriverIdsOf(c) : [];
      const next = existing.includes(id!) ? existing : [...existing, id!];
      return apiRequest("PATCH", `/api/contracts/${contractId}`, { driverIds: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", id] });
      setSelectedContractId("");
      toast({ title: "Contrato vinculado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao vincular contrato", variant: "destructive" }),
  });

  const unlinkContractMutation = useMutation({
    mutationFn: (contractId: string) => {
      const c = (allContracts || []).find((x) => x.id === contractId);
      const existing = c ? getDriverIdsOf(c) : [];
      const next = existing.filter((d) => d !== id);
      return apiRequest("PATCH", `/api/contracts/${contractId}`, { driverIds: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", id] });
      toast({ title: "Contrato desvinculado!" });
    },
    onError: () => toast({ title: "Erro ao desvincular contrato", variant: "destructive" }),
  });

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: "",
      cpf: "",
      rg: "",
      cnpj: "",
      companyName: "",
      phone: "",
      email: "",
      birthDate: "",
      cep: "",
      address: "",
      addressNumber: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: undefined,
      driverType: undefined,
      modality: undefined,
      cnhType: undefined,
      profilePhoto: "",
      cnhFrontPhoto: "",
      cnhBackPhoto: "",
      rgPhoto: "",
      addressProofPhoto: "",
      isActive: "true",
      password: "",
      confirmPassword: "",
    },
  });

  const { data: userAccount } = useQuery<{ exists: boolean; email: string | null; username?: string; isActive?: string }>({
    queryKey: ["/api/drivers", id, "user-account"],
    enabled: !!isEditing,
  });

  const requestDeletionMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/driver-deletion-requests", {
        driverId: id,
        channel: deletionChannel,
        notes: deletionNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driver-deletion-requests"] });
      toast({
        title: "Solicitação registrada",
        description: "A solicitação de exclusão (LGPD) foi registrada no informe.",
      });
      setShowDeletionDialog(false);
      setDeletionChannel("");
      setDeletionNotes("");
    },
    onError: (err: any) => {
      toast({
        title: err?.message || "Erro ao registrar solicitação",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/drivers/${id}/update-password`, { password: newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", id, "user-account"] });
      setNewPassword("");
      setConfirmNewPassword("");
      toast({ title: "Senha atualizada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Erro ao atualizar senha", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (driver) {
      form.reset({
        name: driver.name || "",
        cpf: driver.cpf || "",
        rg: driver.rg || "",
        cnpj: driver.cnpj || "",
        companyName: driver.companyName || "",
        phone: driver.phone || "",
        email: driver.email || "",
        birthDate: driver.birthDate || "",
        cep: driver.cep || "",
        address: driver.address || "",
        addressNumber: driver.addressNumber || "",
        complement: driver.complement || "",
        neighborhood: driver.neighborhood || "",
        city: driver.city || "",
        state: (driver.state as typeof brazilianStates[number]) || undefined,
        driverType: driver.driverType || undefined,
        modality: driver.modality || undefined,
        cnhType: driver.cnhType as typeof cnhTypes[number],
        profilePhoto: driver.profilePhoto || "",
        cnhFrontPhoto: driver.cnhFrontPhoto || "",
        cnhBackPhoto: driver.cnhBackPhoto || "",
        rgPhoto: (driver as any).rgPhoto || "",
        addressProofPhoto: (driver as any).addressProofPhoto || "",
        isActive: driver.isActive || "true",
      });
      setDeviceToken((driver as any).deviceToken ?? "");
    }
  }, [driver, form]);

  const uploadPhoto = async (file: File): Promise<string> => {
    const token = getAccessToken();
    // Try Replit Object Storage first
    try {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (response.ok) {
        const { uploadURL, objectPath } = await response.json();
        await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        return objectPath;
      }
    } catch {
      // fall through to local upload
    }
    // Fallback: local upload via base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const localResponse = await fetch("/api/uploads/local", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ data: base64, filename: file.name, contentType: file.type }),
    });
    if (!localResponse.ok) throw new Error("Falha ao fazer upload da foto");
    const { objectPath } = await localResponse.json();
    return objectPath;
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: "profilePhoto" | "cnhFrontPhoto" | "cnhBackPhoto" | "rgPhoto" | "addressProofPhoto"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(fieldName);
    try {
      const path = await uploadPhoto(file);
      form.setValue(fieldName, path);
      toast({ title: "Foto enviada com sucesso" });
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setIsUploading(null);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: DriverFormData) => {
      const { confirmPassword, ...payload } = data;
      if (isEditing) {
        const { password, ...editPayload } = payload;
        return apiRequest("PATCH", `/api/drivers/${id}`, { ...editPayload, deviceToken: deviceToken || null });
      }
      return apiRequest("POST", "/api/drivers", { ...payload, deviceToken: deviceToken || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: isEditing ? "Motorista atualizado com sucesso" : "Motorista cadastrado com sucesso" });
      navigate("/motoristas");
    },
    onError: () => {
      toast({ title: "Erro ao salvar motorista", variant: "destructive" });
    },
  });

  const onSubmit = (data: DriverFormData) => {
    mutation.mutate(data);
  };

  const handleCepBlur = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const addressData = await fetchAddressFromCep(cleanCep);
      if (addressData) {
        form.setValue("address", addressData.address);
        form.setValue("neighborhood", addressData.neighborhood);
        form.setValue("city", addressData.city);
        form.setValue("state", addressData.state as typeof brazilianStates[number]);
        toast({ title: "Endereço preenchido automaticamente" });
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    } finally {
      setIsFetchingCep(false);
    }
  };

  if (isEditing && driverLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const ProfilePhotoField = () => (
    <FormField
      control={form.control}
      name="profilePhoto"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Foto de Perfil</FormLabel>
          <FormControl>
            <div className="space-y-2">
              {field.value ? (
                <div className="relative inline-block">
                  <img
                    src={field.value}
                    alt="Foto de Perfil"
                    className="h-28 w-28 rounded-full object-cover border-2 border-border shadow"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -right-2 -top-2 h-6 w-6"
                    onClick={() => form.setValue("profilePhoto", "")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e, "profilePhoto")}
                    disabled={isUploading !== null}
                    data-testid="upload-profilePhoto"
                  />
                  {isUploading === "profilePhoto" ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <UserCircle className="h-8 w-8" />
                      <span className="text-xs text-center leading-tight">Clique para enviar</span>
                    </div>
                  )}
                </label>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const PhotoUploadField = ({
    label,
    fieldName,
    icon: Icon,
    accept = "image/*",
  }: {
    label: string;
    fieldName: "cnhFrontPhoto" | "cnhBackPhoto" | "rgPhoto" | "addressProofPhoto";
    icon: React.ElementType;
    accept?: string;
  }) => (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="space-y-2">
              {field.value ? (
                <div className="relative inline-block">
                  <img
                    src={field.value}
                    alt={label}
                    className="h-28 w-44 rounded-md object-cover border"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -right-2 -top-2 h-6 w-6"
                    onClick={() => form.setValue(fieldName, "")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex h-28 w-44 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
                  <input
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e, fieldName)}
                    disabled={isUploading !== null}
                    data-testid={`upload-${fieldName}`}
                  />
                  {isUploading === fieldName ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Icon className="h-7 w-7" />
                      <span className="text-xs">Clique para enviar</span>
                    </div>
                  )}
                </label>
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={isEditing ? "Editar Motorista" : "Novo Motorista"}
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Motoristas", href: "/motoristas" },
          { label: isEditing ? "Editar" : "Novo" },
        ]}
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <div className={`rounded-xl border-0 shadow-lg overflow-hidden mb-6 ${isEditing ? "bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent" : "bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-transparent"}`}>
          <div className="flex items-center gap-4 px-6 py-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-md ${isEditing ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white" : "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"}`}>
              {isEditing ? <Pencil className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{isEditing ? "Editar Motorista" : "Novo Motorista"}</h2>
              <p className="text-sm text-muted-foreground">{isEditing ? "Atualize os dados do motorista cadastrado" : "Preencha os dados para cadastrar um novo motorista"}</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="dados-gerais" className="w-full">
              <TabsList className="mb-4" data-testid="tabs-driver-form">
                <TabsTrigger value="dados-gerais" data-testid="tab-dados-gerais">Dados Gerais</TabsTrigger>
                <TabsTrigger value="documentacao" data-testid="tab-documentacao">Documentação</TabsTrigger>
              </TabsList>

              {/* ── ABA: DADOS GERAIS ── */}
              <TabsContent value="dados-gerais" className="space-y-6">
                <Card className="rounded-xl border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                        <User className="h-4 w-4 text-blue-600" />
                      </span>
                      Dados Pessoais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Nome Completo *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-driver-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />CPF *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000-00" data-testid="input-driver-cpf" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />RG</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="00.000.000-0" data-testid="input-driver-rg" />
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
                          <FormLabel className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />CNPJ</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="00.000.000/0000-00" data-testid="input-driver-cnpj" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />Razão Social</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="Razão Social da empresa" data-testid="input-driver-company-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />Data de Nascimento *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-driver-birthdate" />
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
                          <FormLabel className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-driver-email" />
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
                          <FormLabel className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />Telefone *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(00) 00000-0000" data-testid="input-driver-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* ── ACESSO AO SISTEMA ── */}
                <Card className="rounded-xl border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                        <Lock className="h-4 w-4 text-violet-600" />
                      </span>
                      Acesso ao Sistema
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {isEditing
                        ? "Gerencie o acesso do motorista ao aplicativo. O e-mail cadastrado acima é usado como login."
                        : "Defina uma senha para que o motorista possa acessar o aplicativo. O e-mail cadastrado acima será o login."}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <>
                        {/* Status da conta */}
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {userAccount?.exists
                                ? `Conta ativa — login: ${userAccount.email}`
                                : userAccount?.email
                                  ? "Sem conta de acesso criada"
                                  : "Cadastre um e-mail para habilitar o acesso"}
                            </p>
                            {userAccount?.exists && userAccount.username && (
                              <p className="text-xs text-muted-foreground">Usuário: {userAccount.username}</p>
                            )}
                          </div>
                          {userAccount?.exists ? (
                            <Badge className="shrink-0 bg-green-500/10 text-green-700 dark:text-green-400">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary" className="shrink-0">Sem acesso</Badge>
                          )}
                        </div>

                        {/* Alterar / criar senha */}
                        {(userAccount?.email || (driver as any)?.email) && (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">
                              {userAccount?.exists ? "Alterar Senha" : "Criar Senha de Acesso"}
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <label className="text-sm font-medium">Nova Senha</label>
                                <div className="relative">
                                  <Input
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Mínimo 6 caracteres"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    data-testid="input-new-password"
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                  >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-sm font-medium">Confirmar Senha</label>
                                <div className="relative">
                                  <Input
                                    type={showNewPassword ? "text" : "password"}
                                    placeholder="Repita a senha"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    data-testid="input-confirm-new-password"
                                  />
                                </div>
                                {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
                                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                !newPassword ||
                                newPassword.length < 6 ||
                                newPassword !== confirmNewPassword ||
                                updatePasswordMutation.isPending
                              }
                              onClick={() => updatePasswordMutation.mutate()}
                              data-testid="button-update-password"
                            >
                              {updatePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {userAccount?.exists ? "Atualizar Senha" : "Criar Acesso"}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      /* Criação: campos de senha no próprio formulário */
                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Senha de Acesso</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Mínimo 6 caracteres"
                                    data-testid="input-driver-password"
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowPassword(!showPassword)}
                                  >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirmar Senha</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Repita a senha"
                                    data-testid="input-driver-confirm-password"
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <p className="text-xs text-muted-foreground md:col-span-2">
                          Deixe em branco se não quiser criar acesso agora. O e-mail acima será usado como login.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                        <MapPin className="h-4 w-4 text-green-600" />
                      </span>
                      Endereço
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />CEP *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                placeholder="00000-000"
                                data-testid="input-driver-cep"
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleCepBlur(e.target.value);
                                }}
                              />
                              {isFetchingCep && (
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
                            <Input {...field} data-testid="input-driver-address" />
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
                          <FormLabel>Número *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-driver-number" />
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
                            <Input {...field} data-testid="input-driver-complement" />
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
                          <FormLabel>Bairro *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-driver-neighborhood" />
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
                          <FormLabel>Município *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-driver-city" />
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
                          <FormLabel>UF *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-driver-state">
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
                  </CardContent>
                </Card>

                <Card className="rounded-xl border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                        <Briefcase className="h-4 w-4 text-amber-600" />
                      </span>
                      Dados Profissionais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="driverType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" />Tipo de Motorista</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-driver-type">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="coleta">Coleta</SelectItem>
                              <SelectItem value="transporte">Transporte</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="modality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><IdCard className="h-3.5 w-3.5 text-muted-foreground" />Modalidade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-driver-modality">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="clt">CLT</SelectItem>
                              <SelectItem value="pj">PJ</SelectItem>
                              <SelectItem value="agregado">Agregado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cnhType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />Tipo de CNH *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-driver-cnh-type">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {cnhTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── ABA: DOCUMENTAÇÃO ── */}
              <TabsContent value="documentacao" className="space-y-6">
                {/* Status do Motorista */}
                <Card className="rounded-xl border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                        <ToggleLeft className="h-4 w-4 text-cyan-600" />
                      </span>
                      Status do Motorista
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    {/* Apto para Serviço — calculado automaticamente */}
                    {isEditing && driver && (() => {
                      const d = driver as any;
                      const isApto = d.isApto === "true";
                      const missingDocs: string[] = [];
                      if (!d.cnhFrontPhoto) missingDocs.push("CNH Frente");
                      if (!d.cnhBackPhoto) missingDocs.push("CNH Verso");
                      if (!d.rgPhoto) missingDocs.push("RG");
                      if (!d.addressProofPhoto) missingDocs.push("Comprovante de Residência");
                      const hasActiveContract = driverContracts.some((c) => c.status === "ativo");
                      if (!hasActiveContract) missingDocs.push("Contrato ativo");
                      return (
                        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-1">
                            <p className="text-base font-medium">Apto para Serviço</p>
                            <p className="text-xs text-muted-foreground">Calculado automaticamente pelo sistema</p>
                            {!isApto && missingDocs.length > 0 && (
                              <div className="mt-2 flex flex-col gap-1">
                                {missingDocs.map((item) => (
                                  <span key={item} className="flex items-center gap-1 text-xs text-destructive">
                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                    {item} pendente
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            {isApto ? (
                              <div className="flex items-center gap-1.5 text-green-600" data-testid="status-apto-sim">
                                <CheckCircle2 className="h-6 w-6" />
                                <span className="text-sm font-semibold">Sim</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-destructive" data-testid="status-apto-nao">
                                <XCircle className="h-6 w-6" />
                                <span className="text-sm font-semibold">Não</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {!isEditing && (
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4 opacity-60">
                        <div className="space-y-0.5">
                          <p className="text-base font-medium">Apto para Serviço</p>
                          <p className="text-xs text-muted-foreground">Será calculado após salvar o cadastro</p>
                        </div>
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Ativo</FormLabel>
                            <p className="text-xs text-muted-foreground">Motorista com cadastro ativo no sistema</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === "true"}
                              onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                              data-testid="switch-driver-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Documentos */}
                <Card className="rounded-xl border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-base">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
                        <Camera className="h-4 w-4 text-rose-600" />
                      </span>
                      Foto de Perfil e Documentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">Foto de identificação do motorista</p>
                      <ProfilePhotoField />
                    </div>
                    <div className="border-t pt-5">
                      <p className="text-sm text-muted-foreground mb-3">Documentos (CNH, RG, Comprovante)</p>
                      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        <PhotoUploadField label="CNH — Frente" fieldName="cnhFrontPhoto" icon={CreditCard} />
                        <PhotoUploadField label="CNH — Verso" fieldName="cnhBackPhoto" icon={CreditCard} />
                        <PhotoUploadField label="RG" fieldName="rgPhoto" icon={IdCard} />
                        <PhotoUploadField label="Comprovante de Residência" fieldName="addressProofPhoto" icon={MapPin} accept="image/*,.pdf" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contratos */}
                {isEditing && (
                  <Card className="rounded-xl border bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-base">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                          <FileText className="h-4 w-4 text-indigo-600" />
                        </span>
                        Contratos Vinculados
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Combo de vínculo */}
                      <div className="flex gap-2">
                        <Select
                          value={selectedContractId}
                          onValueChange={setSelectedContractId}
                          data-testid="select-link-contract"
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecionar contrato do Gestor de Contratos..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(allContracts ?? []).map((c) => {
                              const linked = isLinkedToThisDriver(c);
                              return (
                                <SelectItem key={c.id} value={c.id} disabled={linked}>
                                  {c.contractNumber} — {c.title}
                                  {linked ? " (já vinculado)" : ""}
                                </SelectItem>
                              );
                            })}
                            {(allContracts ?? []).length === 0 && (
                              <SelectItem value="_empty" disabled>
                                Nenhum contrato disponível
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          disabled={!selectedContractId || linkContractMutation.isPending}
                          onClick={() => selectedContractId && linkContractMutation.mutate(selectedContractId)}
                          data-testid="button-link-contract"
                        >
                          {linkContractMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-1" />
                          )}
                          Vincular
                        </Button>
                      </div>

                      {/* Lista de contratos vinculados */}
                      {driverContracts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                          <FileCheck2 className="mb-3 h-10 w-10 opacity-40" />
                          <p className="text-sm">Nenhum contrato vinculado.</p>
                          <p className="text-xs mt-1">Selecione um contrato do Gestor de Contratos e clique em Vincular.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {driverContracts.map((contract) => (
                            <div
                              key={contract.id}
                              className="flex items-center justify-between rounded-lg border p-3"
                              data-testid={`row-contract-${contract.id}`}
                            >
                              <div className="space-y-0.5">
                                <p className="font-medium text-sm">{contract.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {contract.contractNumber} · <span className="capitalize">{contract.contractType}</span>
                                  {contract.paymentType && ` · ${paymentTypeLabel[contract.paymentType] ?? contract.paymentType}`}
                                </p>
                                {contract.startDate && (
                                  <p className="text-xs text-muted-foreground">
                                    Início: {new Date(contract.startDate).toLocaleDateString("pt-BR")}
                                    {contract.endDate && ` · Fim: ${new Date(contract.endDate).toLocaleDateString("pt-BR")}`}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Status de assinatura */}
                                {(contract as any).autentiqueStatus === "assinado" || (contract as any).driverSignedAt ? (
                                  <div
                                    className="flex items-center gap-1 text-xs text-green-600 font-medium"
                                    title={(contract as any).autentiqueStatus === "assinado" ? "Assinado digitalmente via Autentique" : "Assinado pelo motorista no app"}
                                    data-testid={`text-signed-at-${contract.id}`}
                                  >
                                    <PenLine className="h-3.5 w-3.5" />
                                    <span>
                                      Assinado{(contract as any).driverSignedAt
                                        ? ` ${new Date((contract as any).driverSignedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}`
                                        : ""}
                                    </span>
                                  </div>
                                ) : (contract as any).autentiqueStatus === "parcialmente_assinado" ? (
                                  <div
                                    className="flex items-center gap-1 text-xs text-blue-600 font-medium"
                                    title="Parcialmente assinado no Autentique"
                                    data-testid={`text-partial-autentique-${contract.id}`}
                                  >
                                    <PenLine className="h-3.5 w-3.5" />
                                    <span>Parcial</span>
                                  </div>
                                ) : (contract as any).autentiqueStatus === "pendente" ? (
                                  <div
                                    className="flex items-center gap-1 text-xs text-amber-600 font-medium"
                                    title="Enviado ao Autentique, aguardando assinatura"
                                    data-testid={`text-sent-autentique-${contract.id}`}
                                  >
                                    <PenLine className="h-3.5 w-3.5" />
                                    <span>Enviado</span>
                                  </div>
                                ) : (
                                  <div
                                    className="flex items-center gap-1 text-xs text-muted-foreground"
                                    title="Aguardando assinatura do motorista"
                                    data-testid={`text-pending-signature-${contract.id}`}
                                  >
                                    <PenLine className="h-3.5 w-3.5" />
                                    <span>Pendente</span>
                                  </div>
                                )}
                                <Badge variant={contractStatusVariant[contract.status] ?? "secondary"}>
                                  {contractStatusLabel[contract.status] ?? contract.status}
                                </Badge>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  title="Desvincular contrato"
                                  onClick={() => unlinkContractMutation.mutate(contract.id)}
                                  disabled={unlinkContractMutation.isPending}
                                  data-testid={`button-unlink-contract-${contract.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* ── Card de Token de Dispositivo (fora das abas, sempre visível) ── */}
            <Card className="rounded-xl border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                    <Smartphone className="h-4 w-4 text-purple-600" />
                  </span>
                  Token de Dispositivo
                  <Badge variant={deviceToken ? "default" : "secondary"} className="ml-auto text-xs font-normal">
                    {deviceToken ? "Configurado" : "Sem token"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Token FCM (Firebase Cloud Messaging) para envio de notificações push ao dispositivo do motorista. Apenas 1 token por motorista.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={deviceToken}
                    onChange={(e) => setDeviceToken(e.target.value)}
                    placeholder="Cole o token FCM do dispositivo aqui..."
                    className="font-mono text-xs"
                    data-testid="input-device-token"
                  />
                  {deviceToken && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title="Copiar token"
                      onClick={() => {
                        navigator.clipboard.writeText(deviceToken);
                        toast({ title: "Token copiado!" });
                      }}
                      data-testid="button-copy-device-token"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  {deviceToken && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Limpar token"
                      onClick={() => setDeviceToken("")}
                      data-testid="button-clear-device-token"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  O token é registrado automaticamente pelo aplicativo ao fazer login. Você também pode defini-lo manualmente aqui.
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4 flex-wrap">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowDeletionDialog(true)}
                  data-testid="button-request-deletion"
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Solicitou exclusão
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/motoristas")}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-driver"
                className={`${isEditing ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700" : "bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"} text-white shadow-md`}
              >
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditing ? <Save className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar Motorista"}
              </Button>
            </div>
          </form>
        </Form>

      </div>

      <Dialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
        <DialogContent data-testid="dialog-deletion-request">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Solicitação de Exclusão (LGPD)
            </DialogTitle>
            <DialogDescription>
              Registre a solicitação de exclusão do motorista <strong>{driver?.name}</strong>.
              Informe por qual canal o motorista solicitou a exclusão dos seus dados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="deletion-channel">Canal da solicitação *</Label>
              <Select value={deletionChannel} onValueChange={setDeletionChannel}>
                <SelectTrigger id="deletion-channel" data-testid="select-deletion-channel">
                  <SelectValue placeholder="Selecione o canal..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="app">Aplicativo</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deletion-notes">Observações (opcional)</Label>
              <Textarea
                id="deletion-notes"
                placeholder="Detalhes adicionais sobre a solicitação..."
                value={deletionNotes}
                onChange={(e) => setDeletionNotes(e.target.value)}
                rows={3}
                data-testid="input-deletion-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeletionDialog(false)}
              data-testid="button-cancel-deletion"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deletionChannel || requestDeletionMutation.isPending}
              onClick={() => requestDeletionMutation.mutate()}
              data-testid="button-confirm-deletion"
            >
              {requestDeletionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
