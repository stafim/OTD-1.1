import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Bell,
  Save,
  Loader2,
  Truck,
  RotateCcw,
  Info,
} from "lucide-react";

const DEFAULT_TITLE = "Nova Proposta de Transporte ({numero})";
const DEFAULT_BODY = "Origem: {origem} → Destino: {destino}\nData: {data}\nDistância: {distancia}\nValor: {valor}";

const VARIABLES = [
  { key: "{numero}", label: "Número", example: "PRP00001", description: "Número da proposta" },
  { key: "{origem}", label: "Origem", example: "São José dos Pinhais/PR", description: "Cidade/estado de origem" },
  { key: "{destino}", label: "Destino", example: "Osasco/SP", description: "Cidade/estado de destino" },
  { key: "{data}", label: "Data", example: "13/04/2026 10:00", description: "Data de início" },
  { key: "{distancia}", label: "Distância", example: "399 km", description: "Distância em km" },
  { key: "{valor}", label: "Valor", example: "R$ 599,27", description: "Valor estimado" },
];

function interpolate(tpl: string): string {
  return VARIABLES.reduce((s, v) => s.replaceAll(v.key, v.example), tpl);
}

interface PushTemplates {
  novaPropostaTitle: string | null;
  novaPropostaBody: string | null;
}

export default function PushMessagesPage() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const { isLoading } = useQuery<PushTemplates>({
    queryKey: ["/api/settings/push-templates"],
    staleTime: Infinity,
    select: (data) => {
      if (!loaded) {
        setTitle(data.novaPropostaTitle ?? DEFAULT_TITLE);
        setBody(data.novaPropostaBody ?? DEFAULT_BODY);
        setLoaded(true);
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/settings/push-templates", {
        novaPropostaTitle: title,
        novaPropostaBody: body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/push-templates"] });
      toast({ title: "Mensagem salva com sucesso!" });
    },
    onError: (err: any) =>
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  function insertVariable(key: string, target: "title" | "body") {
    if (target === "title" && titleRef.current) {
      const el = titleRef.current;
      const start = el.selectionStart ?? title.length;
      const end = el.selectionEnd ?? title.length;
      const next = title.slice(0, start) + key + title.slice(end);
      setTitle(next);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + key.length, start + key.length); }, 0);
    } else if (target === "body" && bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const next = body.slice(0, start) + key + body.slice(end);
      setBody(next);
      setTimeout(() => { el.focus(); el.setSelectionRange(start + key.length, start + key.length); }, 0);
    }
  }

  const previewTitle = interpolate(title || DEFAULT_TITLE);
  const previewBody = interpolate(body || DEFAULT_BODY);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Mensagens Push"
        description="Configure os templates de notificação enviados automaticamente aos motoristas"
        icon={Bell}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Info banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-sm text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              As mensagens abaixo são enviadas automaticamente via push notification para todos os motoristas ativos com dispositivo registrado. Use as variáveis disponíveis para personalizar o conteúdo com dados reais da proposta.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Editor */}
            <div className="lg:col-span-3 space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Truck className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Nova Proposta de Transporte</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Enviada ao criar uma proposta ou ao clicar em "Reenviar Notificação"
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="push-title" className="text-sm font-medium">Título</Label>
                        <Input
                          id="push-title"
                          ref={titleRef}
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          placeholder={DEFAULT_TITLE}
                          data-testid="input-push-title"
                        />
                        <p className="text-xs text-muted-foreground">Clique em uma variável abaixo para inserir no campo selecionado</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="push-body" className="text-sm font-medium">Corpo da mensagem</Label>
                        <Textarea
                          id="push-body"
                          ref={bodyRef}
                          value={body}
                          onChange={e => setBody(e.target.value)}
                          placeholder={DEFAULT_BODY}
                          rows={5}
                          className="font-mono text-sm resize-none"
                          data-testid="input-push-body"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variáveis disponíveis</p>
                        <div className="flex flex-wrap gap-1.5">
                          {VARIABLES.map(v => (
                            <div key={v.key} className="flex gap-px">
                              <button
                                type="button"
                                onClick={() => insertVariable(v.key, "title")}
                                className="px-2 py-1 rounded-l text-xs bg-muted hover:bg-primary/10 hover:text-primary border border-border border-r-0 transition-colors font-mono"
                                title={`Inserir ${v.key} no título`}
                                data-testid={`btn-var-title-${v.label}`}
                              >
                                {v.key}
                              </button>
                              <button
                                type="button"
                                onClick={() => insertVariable(v.key, "body")}
                                className="px-1.5 py-1 rounded-r text-xs bg-muted hover:bg-primary/10 hover:text-primary border border-border transition-colors"
                                title={`Inserir ${v.key} no corpo`}
                                data-testid={`btn-var-body-${v.label}`}
                              >
                                ↵
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                          {VARIABLES.map(v => (
                            <p key={v.key} className="text-[11px] text-muted-foreground">
                              <span className="font-mono text-foreground/70">{v.key}</span> — {v.description}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-8 gap-1.5"
                          onClick={() => { setTitle(DEFAULT_TITLE); setBody(DEFAULT_BODY); }}
                          data-testid="button-reset-template"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurar padrão
                        </Button>
                        <Button
                          onClick={() => saveMutation.mutate()}
                          disabled={saveMutation.isPending}
                          className="gap-1.5"
                          data-testid="button-save-template"
                        >
                          {saveMutation.isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Save className="h-4 w-4" />}
                          Salvar
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Prévia da notificação</p>
              <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
                {/* Phone mockup header */}
                <div className="bg-muted/60 px-4 py-2 flex items-center gap-2 border-b border-border/50">
                  <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">OTD Entregas</span>
                  <span className="ml-auto text-xs text-muted-foreground">agora</span>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  <p className="text-sm font-semibold leading-snug break-words" data-testid="preview-title">
                    {previewTitle || <span className="text-muted-foreground italic">Título vazio</span>}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line break-words" data-testid="preview-body">
                    {previewBody || <span className="italic">Corpo vazio</span>}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Prévia com valores de exemplo
              </p>

              {/* Variable reference */}
              <Card className="mt-4">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Referência de variáveis</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <div className="space-y-2">
                    {VARIABLES.map(v => (
                      <div key={v.key} className="flex items-start gap-2">
                        <Badge variant="secondary" className="font-mono text-xs shrink-0 mt-px">{v.key}</Badge>
                        <div>
                          <p className="text-xs font-medium">{v.description}</p>
                          <p className="text-xs text-muted-foreground">ex: {v.example}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
