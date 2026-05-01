import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  User,
  MapPin,
  ExternalLink,
  Download,
  PenLine,
  CheckCircle2,
  Clock,
  X,
  Camera,
  Send,
  Plus,
  RefreshCw,
  History,
  UserCheck,
  UserX,
  Link2Off,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAccessToken } from "@/hooks/use-auth";
import type { Driver, Contract, DriverStatusLog } from "@shared/schema";

interface DriverDocsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string | null;
}

type PhotoField =
  | "profilePhoto"
  | "cnhFrontPhoto"
  | "cnhBackPhoto"
  | "rgPhoto"
  | "addressProofPhoto";

async function uploadPhoto(file: File): Promise<string> {
  const token = getAccessToken();
  let objectPath: string | null = null;

  try {
    const res = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });
    if (res.ok) {
      const { uploadURL, objectPath: path } = await res.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      objectPath = path;
    }
  } catch {
    // fall through to local upload
  }

  if (!objectPath) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const localRes = await fetch("/api/uploads/local", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        data: base64,
        filename: file.name,
        contentType: file.type,
      }),
    });
    if (!localRes.ok) throw new Error("Falha no upload");
    const { objectPath: path } = await localRes.json();
    objectPath = path;
  }

  return objectPath!;
}

const contractStatusConfig: Record<
  string,
  { label: string; colorClass: string; icon: typeof CheckCircle }
> = {
  assinado: {
    label: "Assinado",
    colorClass:
      "text-green-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-green-400",
    icon: CheckCircle,
  },
  pendente: {
    label: "Enviado",
    colorClass:
      "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
    icon: Clock,
  },
  parcialmente_assinado: {
    label: "Parcialmente Assinado",
    colorClass:
      "text-blue-700 border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400",
    icon: AlertCircle,
  },
  recusado: {
    label: "Recusado",
    colorClass:
      "text-red-700 border-red-300 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
    icon: XCircle,
  },
};

function PhotoUploadArea({
  src,
  label,
  rounded,
  icon: Icon,
  onUpload,
  onRemove,
  isUploading,
  testId,
  onExpand,
}: {
  src?: string | null;
  label: string;
  rounded?: boolean;
  icon: typeof CreditCard;
  onUpload: (file: File) => void;
  onRemove: () => void;
  isUploading: boolean;
  testId: string;
  onExpand?: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shapeClass = rounded
    ? "rounded-full"
    : "rounded-lg";
  const sizeClass = rounded ? "h-24 w-24" : "h-24 w-36";

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {src ? (
        <div className="relative inline-block group">
          <img
            src={src}
            alt={label}
            className={`${sizeClass} ${shapeClass} object-cover border ${onExpand ? "cursor-zoom-in" : ""}`}
            onClick={() => onExpand?.(src)}
            data-testid={testId}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-6 w-6 absolute -top-2 -right-2"
              onClick={onRemove}
              data-testid={`button-remove-${testId}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {rounded && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
            >
              <Camera className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={`flex ${sizeClass} ${shapeClass} cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 text-muted-foreground transition-colors`}
          data-testid={`upload-area-${testId}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Icon className="h-6 w-6" />
              <span className="text-xs">Clique para enviar</span>
            </>
          )}
        </label>
      )}
      <input
        ref={rounded ? undefined : inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function DriverDocsDialog({
  open,
  onOpenChange,
  driverId,
}: DriverDocsDialogProps) {
  const { toast } = useToast();
  const [uploadingField, setUploadingField] = useState<PhotoField | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [sendingContractId, setSendingContractId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [pendingActiveState, setPendingActiveState] = useState<boolean | null>(null);
  const [reasonText, setReasonText] = useState("");

  const { data: driver, isLoading: driverLoading } = useQuery<Driver>({
    queryKey: ["/api/drivers", driverId],
    enabled: !!driverId && open,
  });

  const { data: allContracts, isLoading: contractsLoading } = useQuery<
    Contract[]
  >({
    queryKey: ["/api/contracts"],
    enabled: !!driverId && open,
  });

  // N:N: a contract is linked to this driver if its driverIds array includes driverId
  // (falls back to legacy single driverId for backwards compat).
  const isLinkedToThisDriver = (c: any) => {
    if (Array.isArray(c.driverIds) && c.driverIds.length > 0) {
      return c.driverIds.includes(driverId);
    }
    return c.driverId === driverId;
  };
  const driverContracts = (allContracts || []).filter(isLinkedToThisDriver);

  // Unlinkable = contracts NOT yet linked to this driver (regardless of others).
  const unlinkableContracts = (allContracts || []).filter((c) => !isLinkedToThisDriver(c));

  const getExistingDriverIds = (contractId: string): string[] => {
    const c: any = (allContracts || []).find((x) => x.id === contractId);
    if (!c) return [];
    if (Array.isArray(c.driverIds) && c.driverIds.length > 0) return c.driverIds;
    return c.driverId ? [c.driverId] : [];
  };

  const linkContractMutation = useMutation({
    mutationFn: (contractId: string) => {
      if (!driverId) throw new Error("Motorista não identificado");
      const existing = getExistingDriverIds(contractId);
      const next = existing.includes(driverId) ? existing : [...existing, driverId];
      return apiRequest("PATCH", `/api/contracts/${contractId}`, { driverIds: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setSelectedContractId("");
      toast({ title: "Contrato vinculado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao vincular contrato", variant: "destructive" }),
  });

  const [unlinkingContractId, setUnlinkingContractId] = useState<string | null>(null);
  const unlinkContractMutation = useMutation({
    mutationFn: (contractId: string) => {
      const existing = getExistingDriverIds(contractId);
      const next = existing.filter((id) => id !== driverId);
      return apiRequest("PATCH", `/api/contracts/${contractId}`, { driverIds: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setUnlinkingContractId(null);
      toast({ title: "Contrato desvinculado com sucesso!" });
    },
    onError: () => {
      setUnlinkingContractId(null);
      toast({ title: "Erro ao desvincular contrato", variant: "destructive" });
    },
  });

  const sendContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      if (!driver?.email) throw new Error("Motorista sem e-mail cadastrado");
      return apiRequest("POST", `/api/autentique/send-contract/${contractId}`, {
        driverId,
        signers: [{ name: driver.name, email: driver.email, action: "SIGN" }],
        message: `Olá ${driver.name}, segue o contrato para assinatura digital.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setSendingContractId(null);
      toast({ title: "Contrato enviado ao Autentique com sucesso!" });
    },
    onError: (err: any) => {
      setSendingContractId(null);
      toast({ title: err?.message || "Erro ao enviar contrato", variant: "destructive" });
    },
  });

  const syncContractMutation = useMutation({
    mutationFn: (docId: string) =>
      apiRequest("POST", `/api/autentique/sync/${docId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Erro ao sincronizar status", variant: "destructive" });
    },
  });

  const patchMutation = useMutation({
    mutationFn: (data: Partial<Driver>) =>
      apiRequest("PATCH", `/api/drivers/${driverId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
    },
    onError: () => {
      toast({ title: "Erro ao salvar alteração", variant: "destructive" });
    },
  });

  const { data: statusLogs = [] } = useQuery<DriverStatusLog[]>({
    queryKey: ["/api/drivers", driverId, "status-logs"],
    enabled: !!driverId && open,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ isActive, reason }: { isActive: boolean; reason: string }) =>
      apiRequest("POST", `/api/drivers/${driverId}/status-logs`, {
        action: isActive ? "ativado" : "desativado",
        reason,
        isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "status-logs"] });
      setReasonDialogOpen(false);
      setReasonText("");
      setPendingActiveState(null);
      toast({ title: "Status atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    },
  });

  const toggleAptoMutation = useMutation({
    mutationFn: (newIsApto: boolean) =>
      apiRequest("PATCH", `/api/drivers/${driverId}/apto`, { isApto: newIsApto }),
    onSuccess: (_, newIsApto) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "profile"] });
      toast({
        title: newIsApto
          ? "Motorista marcado como Apto para Serviço"
          : "Motorista marcado como Inapto",
      });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar aptidão", variant: "destructive" });
    },
  });

  const handleUpload = async (file: File, field: PhotoField) => {
    setUploadingField(field);
    try {
      const path = await uploadPhoto(file);
      patchMutation.mutate({ [field]: path } as Partial<Driver>);
      toast({ title: "Foto enviada com sucesso" });
    } catch {
      toast({ title: "Erro ao enviar foto", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemove = (field: PhotoField) => {
    patchMutation.mutate({ [field]: "" } as Partial<Driver>);
  };

  const handleToggleActive = (checked: boolean) => {
    setPendingActiveState(checked);
    setReasonText("");
    setReasonDialogOpen(true);
  };

  const handleConfirmToggle = () => {
    if (pendingActiveState === null || !reasonText.trim()) return;
    toggleStatusMutation.mutate({ isActive: pendingActiveState, reason: reasonText.trim() });
  };

  const isLoading = driverLoading || contractsLoading;

  const d = driver as any;
  const missingDocs: string[] = [];
  if (d) {
    if (!d.cnhFrontPhoto) missingDocs.push("CNH Frente");
    if (!d.cnhBackPhoto) missingDocs.push("CNH Verso");
    if (!d.rgPhoto) missingDocs.push("RG");
    if (!d.addressProofPhoto) missingDocs.push("Comprovante de Residência");
    const hasActiveContract = driverContracts.some((c) => c.status === "ativo");
    if (!hasActiveContract) missingDocs.push("Contrato ativo");
  }
  const isApto = d?.isApto === "true";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Documentação e Status
            {driver && (
              <span className="font-normal text-muted-foreground text-sm">
                — {driver.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !driver ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Motorista não encontrado.
          </p>
        ) : (
          <div className="space-y-6 mt-1">
            {/* ── Status do Motorista ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status do Motorista</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {/* Apto para Serviço */}
                <div className="flex flex-row items-start justify-between rounded-lg border p-4">
                  <div className="space-y-1 flex-1">
                    <p className="text-base font-medium">Apto para Serviço</p>
                    <p className="text-xs text-muted-foreground">
                      Habilita o motorista a receber transportes
                    </p>
                    {!isApto && missingDocs.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {missingDocs.map((item) => (
                          <span
                            key={item}
                            className="flex items-center gap-1 text-xs text-destructive"
                          >
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {item} pendente
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 mt-0.5 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {isApto ? (
                        <div className="flex items-center gap-1.5 text-green-600" data-testid="status-apto-sim">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-sm font-semibold">Apto</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-destructive" data-testid="status-apto-nao">
                          <XCircle className="h-5 w-5" />
                          <span className="text-sm font-semibold">Inapto</span>
                        </div>
                      )}
                      <Switch
                        checked={isApto}
                        onCheckedChange={(checked) => toggleAptoMutation.mutate(checked)}
                        disabled={toggleAptoMutation.isPending}
                        data-testid="switch-driver-apto"
                      />
                    </div>
                  </div>
                </div>

                {/* Ativo */}
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <p className="text-base font-medium">Ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Motorista com cadastro ativo no sistema
                    </p>
                  </div>
                  <Switch
                    checked={driver.isActive === "true"}
                    onCheckedChange={handleToggleActive}
                    disabled={toggleStatusMutation.isPending}
                    data-testid="switch-driver-active-docs"
                  />
                </div>

                {/* Histórico de status */}
                {statusLogs.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Histórico de alterações</p>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {statusLogs.map((log) => {
                        const isAtivado = log.action === "ativado";
                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
                            data-testid={`status-log-${log.id}`}
                          >
                            {isAtivado ? (
                              <UserCheck className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                            ) : (
                              <UserX className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={
                                    isAtivado
                                      ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 text-xs"
                                      : "text-rose-700 border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400 text-xs"
                                  }
                                >
                                  {isAtivado ? "Ativado" : "Desativado"}
                                </Badge>
                                {log.performedByName && (
                                  <span className="text-xs text-muted-foreground">por {log.performedByName}</span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {log.createdAt
                                    ? new Date(log.createdAt).toLocaleString("pt-BR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                </span>
                              </div>
                              <p className="text-xs text-foreground mt-1 break-words">{log.reason}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Foto de Perfil e Documentos ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Foto de Perfil e Documentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Foto de identificação do motorista
                  </p>
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Foto de Perfil
                    </p>
                    {driver.profilePhoto ? (
                      <div className="relative inline-block group">
                        <img
                          src={driver.profilePhoto}
                          alt="Foto de Perfil"
                          className="h-24 w-24 rounded-full object-cover border-2 border-muted cursor-zoom-in"
                          onClick={() => setLightboxSrc(driver.profilePhoto!)}
                          data-testid="img-profile-photo-docs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            document
                              .getElementById("profile-upload-docs")
                              ?.click()
                          }
                          className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
                        >
                          <Camera className="h-5 w-5 text-white" />
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-6 w-6 absolute -top-1 -right-1"
                          onClick={() => handleRemove("profilePhoto")}
                          data-testid="button-remove-profile-photo-docs"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label
                        className="flex h-24 w-24 cursor-pointer rounded-full flex-col items-center justify-center gap-1 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 text-muted-foreground transition-colors"
                        data-testid="upload-area-profile-photo"
                      >
                        {uploadingField === "profilePhoto" ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <>
                            <User className="h-6 w-6" />
                            <span className="text-xs">Clique para enviar</span>
                          </>
                        )}
                        <input
                          id="profile-upload-docs"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!!uploadingField}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(file, "profilePhoto");
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    <input
                      id="profile-upload-docs"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!!uploadingField}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, "profilePhoto");
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Documentos (CNH, RG, Comprovante)
                  </p>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {/* CNH Frente */}
                    <DocUploadCell
                      label="CNH — Frente"
                      src={driver.cnhFrontPhoto}
                      icon={CreditCard}
                      isUploading={uploadingField === "cnhFrontPhoto"}
                      disabled={!!uploadingField}
                      onUpload={(f) => handleUpload(f, "cnhFrontPhoto")}
                      onRemove={() => handleRemove("cnhFrontPhoto")}
                      testId="cnh-front"
                      onExpand={setLightboxSrc}
                    />
                    {/* CNH Verso */}
                    <DocUploadCell
                      label="CNH — Verso"
                      src={driver.cnhBackPhoto}
                      icon={CreditCard}
                      isUploading={uploadingField === "cnhBackPhoto"}
                      disabled={!!uploadingField}
                      onUpload={(f) => handleUpload(f, "cnhBackPhoto")}
                      onRemove={() => handleRemove("cnhBackPhoto")}
                      testId="cnh-back"
                      onExpand={setLightboxSrc}
                    />
                    {/* RG */}
                    <DocUploadCell
                      label="RG"
                      src={(driver as any).rgPhoto}
                      icon={User}
                      isUploading={uploadingField === "rgPhoto"}
                      disabled={!!uploadingField}
                      onUpload={(f) => handleUpload(f, "rgPhoto")}
                      onRemove={() => handleRemove("rgPhoto")}
                      testId="rg"
                      onExpand={setLightboxSrc}
                    />
                    {/* Comprovante de Residência */}
                    <DocUploadCell
                      label="Comprovante de Residência"
                      src={(driver as any).addressProofPhoto}
                      icon={MapPin}
                      isUploading={uploadingField === "addressProofPhoto"}
                      disabled={!!uploadingField}
                      onUpload={(f) => handleUpload(f, "addressProofPhoto")}
                      onRemove={() => handleRemove("addressProofPhoto")}
                      testId="address-proof"
                      onExpand={setLightboxSrc}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Contratos Vinculados ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Contratos Vinculados
                </h3>
              </div>

              {/* Vincular novo contrato */}
              <div className="flex gap-2 mb-3">
                <Select
                  value={selectedContractId || "__none__"}
                  onValueChange={(v) => setSelectedContractId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="flex-1" data-testid="select-contract-to-link">
                    <SelectValue placeholder="Selecione um contrato para vincular..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione um contrato...</SelectItem>
                    {(allContracts || []).length === 0 ? (
                      <SelectItem value="__empty__" disabled>Nenhum contrato cadastrado</SelectItem>
                    ) : unlinkableContracts.length === 0 ? (
                      <SelectItem value="__none-available__" disabled>
                        Todos os contratos já estão vinculados a este motorista
                      </SelectItem>
                    ) : null}
                    {unlinkableContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber} — {c.title}
                      </SelectItem>
                    ))}
                    {driverContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id} disabled>
                        {c.contractNumber} — {c.title} (já vinculado)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedContractId || linkContractMutation.isPending}
                  onClick={() => selectedContractId && linkContractMutation.mutate(selectedContractId)}
                  data-testid="button-link-contract-docs"
                >
                  {linkContractMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Plus className="h-4 w-4 mr-1" />}
                  Vincular
                </Button>
              </div>

              {driverContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 rounded-lg border border-dashed">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhum contrato digital vinculado</p>
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {driverContracts.map((c) => {
                    // N:N: read autentique fields from THIS driver's link, not from the
                    // contract top-level (which is just a mirror of the last send and
                    // may belong to a different driver).
                    const cAny = c as any;
                    const linkedDrivers: any[] = cAny.drivers || [];
                    const myLink = linkedDrivers.find((d) => d?.id === driverId) || null;
                    const fallbackToLegacy = !myLink && cAny.driverId === driverId;

                    const autentiqueStatus = (myLink?.autentiqueStatus
                      ?? (fallbackToLegacy ? cAny.autentiqueStatus : null)) as string | null;
                    const autentiqueDocId = (myLink?.autentiqueDocId
                      ?? (fallbackToLegacy ? cAny.autentiqueDocId : null)) as string | null;
                    const autentiqueSignedUrl = myLink?.autentiqueSignedUrl
                      ?? (fallbackToLegacy ? cAny.autentiqueSignedUrl : null);
                    const autentiqueOriginalUrl = myLink?.autentiqueOriginalUrl
                      ?? (fallbackToLegacy ? cAny.autentiqueOriginalUrl : null);
                    const autentiqueSentAt = myLink?.autentiqueSentAt
                      ?? (fallbackToLegacy ? cAny.autentiqueSentAt : null);
                    const driverSignedAt = myLink?.driverSignedAt
                      ?? (fallbackToLegacy ? cAny.driverSignedAt : null);

                    const cfg = autentiqueStatus
                      ? contractStatusConfig[autentiqueStatus]
                      : null;
                    const StatusIcon = cfg?.icon ?? PenLine;
                    const isSending = sendingContractId === c.id && sendContractMutation.isPending;
                    const alreadySent = !!autentiqueDocId;
                    const isSyncing = syncContractMutation.isPending && syncContractMutation.variables === autentiqueDocId;

                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-4 px-4 py-3.5"
                        data-testid={`docs-contract-row-${c.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {c.contractNumber} — {c.title}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {autentiqueSentAt && (
                              <p className="text-xs text-muted-foreground">
                                Enviado em{" "}
                                {new Date(autentiqueSentAt).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                            {driverSignedAt && (
                              <p className="text-xs text-green-600 font-medium">
                                Assinado em{" "}
                                {new Date(driverSignedAt).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {cfg ? (
                            <Badge
                              variant="outline"
                              className={`text-xs gap-1 ${cfg.colorClass}`}
                              data-testid={`badge-contract-status-${c.id}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-muted-foreground"
                              data-testid={`badge-contract-pending-${c.id}`}
                            >
                              <PenLine className="h-3 w-3 mr-1" />
                              Não enviado
                            </Badge>
                          )}

                          {/* Sincronizar status do Autentique */}
                          {autentiqueDocId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => syncContractMutation.mutate(autentiqueDocId)}
                              disabled={syncContractMutation.isPending}
                              title="Sincronizar status com o Autentique"
                              data-testid={`button-sync-contract-${c.id}`}
                            >
                              {isSyncing
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}

                          {/* Enviar / Reenviar ao Autentique */}
                          {autentiqueStatus !== "assinado" && (
                            <Button
                              size="sm"
                              variant={alreadySent ? "outline" : "default"}
                              className={alreadySent
                                ? "h-8 px-2.5 text-xs gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                : "h-8 px-2.5 text-xs gap-1.5"}
                              onClick={() => {
                                setSendingContractId(c.id);
                                sendContractMutation.mutate(c.id);
                              }}
                              disabled={sendContractMutation.isPending || !driver?.email}
                              title={!driver?.email ? "Motorista sem e-mail cadastrado" : alreadySent ? "Reenviar ao Autentique" : "Enviar ao Autentique para assinatura"}
                              data-testid={`button-send-contract-${c.id}`}
                            >
                              {isSending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : alreadySent
                                  ? <RefreshCw className="h-3.5 w-3.5" />
                                  : <Send className="h-3.5 w-3.5" />}
                              {alreadySent ? "Reenviar" : "Enviar"}
                            </Button>
                          )}

                          {/* Desvincular contrato deste motorista */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(`Desvincular o contrato "${c.contractNumber}" deste motorista?`)) {
                                setUnlinkingContractId(c.id);
                                unlinkContractMutation.mutate(c.id);
                              }
                            }}
                            disabled={unlinkContractMutation.isPending && unlinkingContractId === c.id}
                            title="Desvincular contrato deste motorista"
                            data-testid={`button-unlink-contract-${c.id}`}
                          >
                            {unlinkContractMutation.isPending && unlinkingContractId === c.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Link2Off className="h-3.5 w-3.5" />}
                          </Button>

                          {autentiqueOriginalUrl && (
                            <a
                              href={autentiqueOriginalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Ver PDF original"
                                data-testid={`button-view-original-${c.id}`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          {autentiqueSignedUrl &&
                            autentiqueStatus === "assinado" && (
                              <a
                                href={autentiqueSignedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                                  data-testid={`button-download-signed-${c.id}`}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Baixar
                                </Button>
                              </a>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* Dialog de motivo de ativação/desativação */}
      <Dialog open={reasonDialogOpen} onOpenChange={(v) => { if (!v) { setReasonDialogOpen(false); setPendingActiveState(null); setReasonText(""); } }}>
        <DialogContent className="max-w-md" data-testid="dialog-status-reason">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingActiveState ? (
                <UserCheck className="h-5 w-5 text-emerald-500" />
              ) : (
                <UserX className="h-5 w-5 text-rose-500" />
              )}
              {pendingActiveState ? "Ativar motorista" : "Desativar motorista"}
            </DialogTitle>
            <DialogDescription>
              Informe o motivo para registrar no histórico de alterações do cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Descreva o motivo..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="textarea-status-reason"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setReasonDialogOpen(false); setPendingActiveState(null); setReasonText(""); }}
              disabled={toggleStatusMutation.isPending}
              data-testid="button-cancel-status-reason"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmToggle}
              disabled={!reasonText.trim() || toggleStatusMutation.isPending}
              className={pendingActiveState ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
              data-testid="button-confirm-status-reason"
            >
              {toggleStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pendingActiveState ? (
                "Ativar"
              ) : (
                "Desativar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox overlay */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
            onClick={() => setLightboxSrc(null)}
            data-testid="button-close-lightbox"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxSrc}
            alt="Visualização ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="img-lightbox"
          />
        </div>
      )}
    </Dialog>
  );
}

function DocUploadCell({
  label,
  src,
  icon: Icon,
  isUploading,
  disabled,
  onUpload,
  onRemove,
  testId,
  onExpand,
}: {
  label: string;
  src?: string | null;
  icon: typeof CreditCard;
  isUploading: boolean;
  disabled: boolean;
  onUpload: (f: File) => void;
  onRemove: () => void;
  testId: string;
  onExpand?: (src: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {src ? (
        <div className="relative inline-block group">
          <img
            src={src}
            alt={label}
            className="h-24 w-36 rounded-lg object-cover border cursor-zoom-in hover:opacity-90 transition-opacity"
            onClick={() => onExpand?.(src)}
            data-testid={`img-doc-${testId}`}
          />
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-6 w-6 absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onRemove}
            data-testid={`button-remove-${testId}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label
          className="flex h-24 w-36 cursor-pointer rounded-lg flex-col items-center justify-center gap-1 border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 text-muted-foreground transition-colors"
          data-testid={`upload-area-${testId}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Icon className="h-6 w-6" />
              <span className="text-xs">Clique para enviar</span>
            </>
          )}
        </label>
      )}
    </div>
  );
}
