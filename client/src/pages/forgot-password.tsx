import { useState } from "react";
import { useLocation } from "wouter";
import otdLogoPath from "@assets/logo_OTD_1772310881404.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, KeyRound, Lock, CheckCircle2, Eye, EyeOff, ArrowLeft } from "lucide-react";

type Step = "email" | "code" | "password" | "success";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Código enviado", description: data.message });
      setStep("code");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("password");
    } catch (err: any) {
      toast({ title: "Código inválido", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("success");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const stepConfig = {
    email: { icon: Mail, title: "Recuperar Senha", desc: "Informe o e-mail da sua conta para receber o código de verificação" },
    code: { icon: KeyRound, title: "Verificar Código", desc: `Insira o código de 6 dígitos enviado para ${email}` },
    password: { icon: Lock, title: "Nova Senha", desc: "Crie uma nova senha segura para sua conta" },
    success: { icon: CheckCircle2, title: "Senha Redefinida!", desc: "Sua senha foi alterada com sucesso" },
  };

  const { icon: StepIcon, title, desc } = stepConfig[step];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={otdLogoPath} alt="OTD Logistics" className="h-16 object-contain" />
          </div>
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-orange-100">
              <StepIcon className="h-6 w-6 text-orange-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>

          {step !== "success" && (
            <div className="flex justify-center gap-2 mt-4">
              {(["email", "code", "password"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    step === s ? "bg-orange-500" :
                    (["email","code","password"].indexOf(step) > i) ? "bg-orange-300" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-email-reset"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-send-code">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Enviar Código"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-back-login"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificação</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-code"
                />
                <p className="text-xs text-muted-foreground text-center">O código expira em 15 minutos</p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || code.length < 6} data-testid="button-verify-code">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</> : "Verificar Código"}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("email")}
                  data-testid="button-back-email"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={handleSendCode}
                  disabled={isLoading}
                  data-testid="button-resend-code"
                >
                  Reenviar código
                </Button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    data-testid="input-new-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    data-testid="input-confirm-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || newPassword !== confirmPassword || newPassword.length < 6}
                data-testid="button-reset-password"
              >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Redefinir Senha"}
              </Button>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <p className="text-muted-foreground">Você já pode fazer login com sua nova senha.</p>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                Ir para o Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
