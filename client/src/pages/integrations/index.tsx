import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Check,
  MapPin,
  AlertCircle,
  PenLine,
  Eye,
  EyeOff,
  Trash2,
  Save,
  Lock,
  LockOpen,
  Bell,
  BellOff,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface IntegrationStatus {
  googleMapsApiKey: boolean;
  autentiqueConfigured: boolean;
}

interface AutentiqueConfig {
  configured: boolean;
  source: "database" | "environment" | null;
}

interface GoogleMapsConfig {
  configured: boolean;
  source: "database" | "environment" | null;
  maskedKey: string | null;
}

interface PdfPasswordConfig {
  configured: boolean;
  password: string | null;
}

interface FirebaseConfig {
  configured: boolean;
  serviceAccountConfigured: boolean;
  serviceAccountEmail: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  serverKey: string | null;
  serverKeyConfigured: boolean;
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [pdfPasswordInput, setPdfPasswordInput] = useState("");
  const [showPdfPassword, setShowPdfPassword] = useState(false);
  const [fbVapidPublic, setFbVapidPublic] = useState("");
  const [fbVapidPrivate, setFbVapidPrivate] = useState("");
  const [fbServerKey, setFbServerKey] = useState("");
  const [fbServiceAccountJson, setFbServiceAccountJson] = useState("");
  const [showFbPrivate, setShowFbPrivate] = useState(false);
  const [showFbServer, setShowFbServer] = useState(false);
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [gmKeyInput, setGmKeyInput] = useState("");
  const [showGmKey, setShowGmKey] = useState(false);

  const { data: status, isLoading } = useQuery<IntegrationStatus>({
    queryKey: ["/api/integrations/status"],
  });

  const { data: autentiqueConfig, isLoading: autentiqueLoading } =
    useQuery<AutentiqueConfig>({
      queryKey: ["/api/integrations/autentique/config"],
    });

  const { data: gmConfig, isLoading: gmLoading } = useQuery<GoogleMapsConfig>({
    queryKey: ["/api/integrations/google-maps/config"],
  });

  const saveGmKeyMutation = useMutation({
    mutationFn: (apiKey: string) =>
      apiRequest("POST", "/api/integrations/google-maps/key", { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-maps/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      setGmKeyInput("");
      toast({ title: "Chave do Google Maps salva com sucesso" });
    },
    onError: (err: any) =>
      toast({ title: err?.message ?? "Erro ao salvar chave", variant: "destructive" }),
  });

  const removeGmKeyMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/integrations/google-maps/key"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google-maps/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      toast({ title: "Chave do Google Maps removida" });
    },
    onError: () => toast({ title: "Erro ao remover chave", variant: "destructive" }),
  });

  const { data: pdfPasswordConfig, isLoading: pdfPasswordLoading } =
    useQuery<PdfPasswordConfig>({
      queryKey: ["/api/settings/pdf-password"],
    });

  const savePdfPasswordMutation = useMutation({
    mutationFn: (password: string) =>
      apiRequest("POST", "/api/settings/pdf-password", { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pdf-password"] });
      setPdfPasswordInput("");
      toast({ title: "Senha do PDF salva com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar senha do PDF", variant: "destructive" });
    },
  });

  const removePdfPasswordMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/settings/pdf-password"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/pdf-password"] });
      toast({ title: "Senha removida. PDFs serão gerados sem proteção." });
    },
    onError: () => {
      toast({ title: "Erro ao remover senha", variant: "destructive" });
    },
  });

  const { data: openaiConfig, isLoading: openaiLoading } = useQuery<{ configured: boolean; source: "database" | "environment" | null }>({
    queryKey: ["/api/settings/openai-key"],
  });

  const saveOpenaiKeyMutation = useMutation({
    mutationFn: (apiKey: string) => apiRequest("POST", "/api/settings/openai-key", { apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/openai-key"] });
      setOpenaiKeyInput("");
      toast({ title: "Chave da OpenAI salva com sucesso" });
    },
    onError: () => toast({ title: "Erro ao salvar chave da OpenAI", variant: "destructive" }),
  });

  const removeOpenaiKeyMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/settings/openai-key"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/openai-key"] });
      toast({ title: "Chave da OpenAI removida com sucesso" });
    },
    onError: () => toast({ title: "Erro ao remover chave", variant: "destructive" }),
  });

  const { data: firebaseConfig, isLoading: firebaseLoading } = useQuery<FirebaseConfig>({
    queryKey: ["/api/settings/firebase"],
  });

  const saveFirebaseMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/settings/firebase", {
        vapidPublicKey: fbVapidPublic.trim() || undefined,
        vapidPrivateKey: fbVapidPrivate.trim() || undefined,
        serverKey: fbServerKey.trim() || undefined,
        serviceAccountJson: fbServiceAccountJson.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/settings/firebase"] });
      setFbVapidPublic("");
      setFbVapidPrivate("");
      setFbServerKey("");
      setFbServiceAccountJson("");
      toast({ title: "Configurações do Firebase salvas com sucesso" });
    },
    onError: (err: any) => toast({ title: err?.message ?? "Erro ao salvar configurações do Firebase", variant: "destructive" }),
  });

  const removeFirebaseMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/settings/firebase"),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/settings/firebase"] });
      toast({ title: "Configurações do Firebase removidas" });
    },
    onError: () => toast({ title: "Erro ao remover configurações", variant: "destructive" }),
  });

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest("POST", "/api/integrations/autentique/token", { token }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/autentique/config"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      setTokenInput("");
      toast({ title: "Token do Autentique salvo com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar token", variant: "destructive" });
    },
  });

  const removeTokenMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/integrations/autentique/token"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/integrations/autentique/config"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/status"] });
      toast({ title: "Token removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao remover token", variant: "destructive" });
    },
  });

  const handleSaveToken = () => {
    if (!tokenInput.trim()) return;
    saveTokenMutation.mutate(tokenInput.trim());
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const autentiqueConfigured = status?.autentiqueConfigured ?? false;

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="Integrações"
        breadcrumbs={[
          { label: "Configurações", href: "/" },
          { label: "Integrações" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-2xl space-y-6">
          {/* ── Google Maps ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                    <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Google Maps</CardTitle>
                    <CardDescription>
                      API para mapas e geolocalização
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={status?.googleMapsApiKey ? "default" : "secondary"}
                >
                  {status?.googleMapsApiKey ? "Configurado" : "Não configurado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {gmLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando configuração...
                </div>
              ) : gmConfig?.configured ? (
                <>
                  <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-950/30 p-4">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        Chave da API configurada
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Origem: {gmConfig.source === "database" ? "salva no sistema" : "variável de ambiente"}
                        {gmConfig.maskedKey ? ` · ${gmConfig.maskedKey}` : ""}
                      </p>
                    </div>
                  </div>
                  {gmConfig.source === "database" && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeGmKeyMutation.mutate()}
                        disabled={removeGmKeyMutation.isPending}
                        data-testid="button-remove-gm-key"
                      >
                        {removeGmKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Remover chave
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        Chave da API não configurada
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Insira a chave abaixo para ativar a integração. Obtenha em{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Google Cloud Console
                        </a>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="gm-key-input">
                  {gmConfig?.configured ? "Atualizar chave" : "Chave da API do Google Maps"}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="gm-key-input"
                      type={showGmKey ? "text" : "password"}
                      value={gmKeyInput}
                      onChange={(e) => setGmKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      data-testid="input-google-maps-key"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowGmKey((v) => !v)}
                      data-testid="button-toggle-gm-key-visibility"
                    >
                      {showGmKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={() => {
                      if (!gmKeyInput.trim()) return;
                      saveGmKeyMutation.mutate(gmKeyInput.trim());
                    }}
                    disabled={!gmKeyInput.trim() || saveGmKeyMutation.isPending}
                    data-testid="button-save-google-maps-key"
                  >
                    {saveGmKeyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A chave é armazenada com segurança e usada pelo servidor para chamadas ao Google Maps.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ── Firebase Push Notifications ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    {firebaseConfig?.configured
                      ? <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      : <BellOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
                  </div>
                  <div>
                    <CardTitle className="text-lg">Firebase Push Notifications</CardTitle>
                    <CardDescription>
                      Envio de notificações push para o aplicativo dos motoristas via FCM
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={firebaseConfig?.configured ? "default" : "secondary"}>
                  {firebaseConfig?.configured ? "Configurado" : "Não configurado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {firebaseLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando configuração...
                </div>
              ) : firebaseConfig?.configured ? (
                <>
                  <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-950/30 p-4">
                    <Bell className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        Firebase configurado
                      </p>
                      {firebaseConfig.serviceAccountConfigured ? (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                          ✓ Firebase Admin SDK — {firebaseConfig.serviceAccountEmail ?? "Service Account configurada"}
                        </p>
                      ) : firebaseConfig.serverKeyConfigured ? (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                          ✓ FCM Server Key configurada — apps nativos Android/iOS habilitados
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          ⚠ Nenhuma credencial de app nativo configurada — adicione a Service Account JSON
                        </p>
                      )}
                      {firebaseConfig.vapidPublicKey && (
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          VAPID: {firebaseConfig.vapidPublicKey?.slice(0, 20)}...
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => removeFirebaseMutation.mutate()}
                      disabled={removeFirebaseMutation.isPending}
                      data-testid="button-remove-firebase"
                    >
                      {removeFirebaseMutation.isPending
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Trash2 className="h-4 w-4 mr-2" />}
                      Remover configuração
                    </Button>
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-xs text-muted-foreground font-medium">Atualizar chaves</Label>
                    <FirebaseKeyFields
                      vapidPublic={fbVapidPublic}
                      vapidPrivate={fbVapidPrivate}
                      serverKey={fbServerKey}
                      serviceAccountJson={fbServiceAccountJson}
                      showPrivate={showFbPrivate}
                      showServer={showFbServer}
                      onVapidPublic={setFbVapidPublic}
                      onVapidPrivate={setFbVapidPrivate}
                      onServerKey={setFbServerKey}
                      onServiceAccountJson={setFbServiceAccountJson}
                      onTogglePrivate={() => setShowFbPrivate((v) => !v)}
                      onToggleServer={() => setShowFbServer((v) => !v)}
                      onSave={() => saveFirebaseMutation.mutate()}
                      isSaving={saveFirebaseMutation.isPending}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-muted bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <BellOff className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Push notifications não configuradas</p>
                        <p className="text-xs text-muted-foreground">
                          Para apps nativos <strong>Android/iOS</strong>: adicione a <strong>FCM Server Key</strong> (Firebase Console → Configurações do Projeto → Cloud Messaging → Chave do Servidor).
                        </p>
                        <p className="text-xs text-muted-foreground">
                          As chaves <strong>VAPID</strong> são opcionais e usadas apenas para notificações em navegadores/PWA.
                        </p>
                      </div>
                    </div>
                  </div>
                  <FirebaseKeyFields
                    vapidPublic={fbVapidPublic}
                    vapidPrivate={fbVapidPrivate}
                    serverKey={fbServerKey}
                    serviceAccountJson={fbServiceAccountJson}
                    showPrivate={showFbPrivate}
                    showServer={showFbServer}
                    onVapidPublic={setFbVapidPublic}
                    onVapidPrivate={setFbVapidPrivate}
                    onServerKey={setFbServerKey}
                    onServiceAccountJson={setFbServiceAccountJson}
                    onTogglePrivate={() => setShowFbPrivate((v) => !v)}
                    onToggleServer={() => setShowFbServer((v) => !v)}
                    onSave={() => saveFirebaseMutation.mutate()}
                    isSaving={saveFirebaseMutation.isPending}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── PDF Password ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                    {pdfPasswordConfig?.configured
                      ? <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      : <LockOpen className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
                  </div>
                  <div>
                    <CardTitle className="text-lg">Proteção de PDF</CardTitle>
                    <CardDescription>
                      Senha para proteger os PDFs gerados (Jornada do Veículo)
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={pdfPasswordConfig?.configured ? "default" : "secondary"}>
                  {pdfPasswordConfig?.configured ? "Configurado" : "Sem senha"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pdfPasswordLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando configuração...
                </div>
              ) : pdfPasswordConfig?.configured ? (
                <>
                  <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-950/30 p-4">
                    <Lock className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        Senha configurada
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Todos os PDFs da Jornada do Veículo serão gerados com proteção por senha.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => removePdfPasswordMutation.mutate()}
                      disabled={removePdfPasswordMutation.isPending}
                      data-testid="button-remove-pdf-password"
                    >
                      {removePdfPasswordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Remover senha
                    </Button>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <Label className="text-xs text-muted-foreground font-medium">Alterar senha</Label>
                    <TokenInputRow
                      value={pdfPasswordInput}
                      onChange={setPdfPasswordInput}
                      show={showPdfPassword}
                      onToggleShow={() => setShowPdfPassword((v) => !v)}
                      onSave={() => pdfPasswordInput.trim() && savePdfPasswordMutation.mutate(pdfPasswordInput.trim())}
                      isSaving={savePdfPasswordMutation.isPending}
                      placeholder="Nova senha..."
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-muted bg-muted/30 p-4">
                    <div className="flex items-start gap-3">
                      <LockOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Sem proteção por senha</p>
                        <p className="text-xs text-muted-foreground">
                          Os PDFs da Jornada do Veículo são gerados sem senha. Configure uma senha para restringir o acesso ao conteúdo dos documentos.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Senha do PDF</Label>
                    <TokenInputRow
                      value={pdfPasswordInput}
                      onChange={setPdfPasswordInput}
                      show={showPdfPassword}
                      onToggleShow={() => setShowPdfPassword((v) => !v)}
                      onSave={() => pdfPasswordInput.trim() && savePdfPasswordMutation.mutate(pdfPasswordInput.trim())}
                      isSaving={savePdfPasswordMutation.isPending}
                      placeholder="Digite a senha desejada..."
                    />
                    <p className="text-xs text-muted-foreground">
                      A senha é armazenada de forma segura e aplicada automaticamente ao gerar PDFs.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Autentique ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900">
                    <PenLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Autentique</CardTitle>
                    <CardDescription>
                      Assinatura digital de contratos
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={autentiqueConfigured ? "default" : "secondary"}>
                  {autentiqueConfigured ? "Configurado" : "Não configurado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {autentiqueLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando configuração...
                </div>
              ) : autentiqueConfigured ? (
                <>
                  <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-950/30 p-4">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        Token da API configurado
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {autentiqueConfig?.source === "environment"
                          ? "Configurado via variável de ambiente"
                          : "Configurado via banco de dados"}
                      </p>
                    </div>
                  </div>

                  {autentiqueConfig?.source === "database" && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => removeTokenMutation.mutate()}
                        disabled={removeTokenMutation.isPending}
                        data-testid="button-remove-autentique-token"
                      >
                        {removeTokenMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Remover token
                      </Button>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-3 font-medium">
                      Substituir token atual
                    </p>
                    <TokenInputRow
                      value={tokenInput}
                      onChange={setTokenInput}
                      show={showToken}
                      onToggleShow={() => setShowToken((v) => !v)}
                      onSave={handleSaveToken}
                      isSaving={saveTokenMutation.isPending}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                          Token não configurado
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Configure o token da API do Autentique para habilitar
                          a assinatura digital de contratos. Obtenha seu token
                          em{" "}
                          <a
                            href="https://app.autentique.com.br/dashboard/tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline font-medium"
                          >
                            app.autentique.com.br
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Token da API do Autentique
                    </Label>
                    <TokenInputRow
                      value={tokenInput}
                      onChange={setTokenInput}
                      show={showToken}
                      onToggleShow={() => setShowToken((v) => !v)}
                      onSave={handleSaveToken}
                      isSaving={saveTokenMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      O token é armazenado de forma segura no banco de dados do
                      sistema.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── OpenAI / IA ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">OpenAI — Inteligência Artificial</CardTitle>
                    <CardDescription>
                      API para análise técnica de modelos de veículos
                    </CardDescription>
                  </div>
                </div>
                {openaiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant={openaiConfig?.configured ? "default" : "secondary"}>
                    {openaiConfig?.configured
                      ? openaiConfig.source === "environment" ? "Configurado (sistema)" : "Configurado"
                      : "Não configurado"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {openaiConfig?.configured ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-950/30 p-4">
                    <Check className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">
                        Chave da API configurada
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {openaiConfig.source === "environment"
                          ? "Chave gerenciada pelo ambiente Replit (créditos Replit)"
                          : "Chave cadastrada manualmente no banco de dados"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 text-xs text-purple-700 dark:text-purple-300">
                    <Sparkles className="h-3.5 w-3.5 inline mr-1" />
                    A IA está ativa. Use o botão <strong>✨</strong> em Modelos de Caminhão para consultar informações técnicas.
                  </div>
                  {openaiConfig.source === "database" && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOpenaiKeyMutation.mutate()}
                        disabled={removeOpenaiKeyMutation.isPending}
                        className="text-destructive hover:text-destructive"
                        data-testid="button-remove-openai-key"
                      >
                        {removeOpenaiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Remover chave
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/30 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                          Chave da API não configurada
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                          Para usar a análise de IA nos modelos de veículos, informe sua chave da OpenAI abaixo.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openai-key-input">Chave da API OpenAI</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="openai-key-input"
                          type={showOpenaiKey ? "text" : "password"}
                          placeholder="sk-..."
                          value={openaiKeyInput}
                          onChange={(e) => setOpenaiKeyInput(e.target.value)}
                          className="pr-10"
                          data-testid="input-openai-api-key"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenaiKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={() => { if (openaiKeyInput.trim()) saveOpenaiKeyMutation.mutate(openaiKeyInput.trim()); }}
                        disabled={!openaiKeyInput.trim() || saveOpenaiKeyMutation.isPending}
                        data-testid="button-save-openai-key"
                      >
                        {saveOpenaiKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Obtenha sua chave em{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        platform.openai.com/api-keys
                      </a>
                      . A chave é armazenada de forma segura no banco de dados.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FirebaseKeyFields({
  vapidPublic, vapidPrivate, serverKey, serviceAccountJson,
  showPrivate, showServer,
  onVapidPublic, onVapidPrivate, onServerKey, onServiceAccountJson,
  onTogglePrivate, onToggleServer,
  onSave, isSaving,
}: {
  vapidPublic: string; vapidPrivate: string; serverKey: string; serviceAccountJson: string;
  showPrivate: boolean; showServer: boolean;
  onVapidPublic: (v: string) => void; onVapidPrivate: (v: string) => void;
  onServerKey: (v: string) => void; onServiceAccountJson: (v: string) => void;
  onTogglePrivate: () => void; onToggleServer: () => void;
  onSave: () => void; isSaving: boolean;
}) {
  const hasAny = serviceAccountJson.trim() || serverKey.trim() || (vapidPublic.trim() && vapidPrivate.trim());
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          Service Account JSON <span className="text-xs text-muted-foreground font-normal">(recomendado — Firebase Admin SDK)</span>
        </Label>
        <Textarea
          value={serviceAccountJson}
          onChange={(e) => onServiceAccountJson(e.target.value)}
          placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "..."\n}'}
          className="font-mono text-xs min-h-[100px] resize-none"
          data-testid="textarea-firebase-service-account"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Firebase Console → Configurações do Projeto → Contas de Serviço → Gerar nova chave privada
        </p>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-3">Ou use a FCM Legacy Server Key (alternativa):</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          FCM Server Key <span className="text-xs text-muted-foreground font-normal">(alternativa para apps Android/iOS)</span>
        </Label>
        <div className="relative">
          <Input
            type={showServer ? "text" : "password"}
            value={serverKey}
            onChange={(e) => onServerKey(e.target.value)}
            placeholder="AAAA... (Firebase Legacy Server Key)"
            className="font-mono text-xs pr-10"
            data-testid="input-firebase-server-key"
          />
          <button
            type="button"
            onClick={onToggleServer}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showServer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-3">Chaves VAPID — somente para notificações via navegador/PWA:</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          VAPID Public Key
        </Label>
        <Input
          value={vapidPublic}
          onChange={(e) => onVapidPublic(e.target.value)}
          placeholder="BGHVPd..."
          className="font-mono text-xs"
          data-testid="input-firebase-vapid-public"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          VAPID Private Key
        </Label>
        <div className="relative">
          <Input
            type={showPrivate ? "text" : "password"}
            value={vapidPrivate}
            onChange={(e) => onVapidPrivate(e.target.value)}
            placeholder="BAk1Nc..."
            className="font-mono text-xs pr-10"
            data-testid="input-firebase-vapid-private"
          />
          <button
            type="button"
            onClick={onTogglePrivate}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        onClick={onSave}
        disabled={!hasAny || isSaving}
        className="w-full"
        data-testid="button-save-firebase"
      >
        {isSaving
          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          : <Save className="h-4 w-4 mr-2" />}
        Salvar configurações
      </Button>
    </div>
  );
}

function TokenInputRow({
  value,
  onChange,
  show,
  onToggleShow,
  onSave,
  isSaving,
  placeholder = "Cole o token aqui...",
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  onSave: () => void;
  isSaving: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          data-testid="input-autentique-token"
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSave();
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
          data-testid="button-toggle-token-visibility"
        >
          {show ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
      <Button
        onClick={onSave}
        disabled={!value.trim() || isSaving}
        data-testid="button-save-autentique-token"
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Salvar
      </Button>
    </div>
  );
}
