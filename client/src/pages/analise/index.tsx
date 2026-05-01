import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "../../../replit_integrations/audio/useVoiceRecorder";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Sparkles,
  Download,
  TableIcon,
  BarChart2,
  Loader2,
  Code2,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  BrainCircuit,
} from "lucide-react";

interface QueryResult {
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  chartType: "bar" | "line" | "pie" | "table" | "kpi";
}

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

const EXAMPLE_QUERIES = [
  "Quantos veículos estão em cada status?",
  "Quais são os 5 motoristas com mais transportes entregues?",
  "Total de transportes por mês nos últimos 6 meses",
  "Quantas coletas foram feitas por pátio de destino?",
  "Qual a média de avaliação dos motoristas?",
  "Distribuição de motoristas por modalidade (PJ, CLT, Agregado)",
];

export default function AnalisePage() {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const [showSql, setShowSql] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { state: recordingState, startRecording, stopRecording } = useVoiceRecorder();

  const transcribeMutation = useMutation({
    mutationFn: async (blob: Blob): Promise<string> => {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
      }
      const base64 = btoa(binary);
      const res = await apiRequest("POST", "/api/transcribe", { audio: base64 });
      const data = await res.json();
      return data.text as string;
    },
    onSuccess: (text) => {
      setQuestion(text);
      if (text.trim()) {
        queryMutation.mutate(text.trim());
      }
    },
    onError: () => {
      toast({
        title: "Erro ao transcrever",
        description: "Não foi possível converter o áudio em texto. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const queryMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/ai-query", { question: q });
      return res.json() as Promise<QueryResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setViewMode(data.chartType === "table" ? "table" : "chart");
    },
    onError: (err: any) => {
      toast({
        title: "Erro na consulta",
        description: err.message || "Não foi possível processar a pergunta.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const q = question.trim();
    if (!q) return;
    queryMutation.mutate(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  const handleExample = (example: string) => {
    setQuestion(example);
    queryMutation.mutate(example);
  };

  const handleMicClick = async () => {
    if (recordingState === "recording") {
      const blob = await stopRecording();
      if (blob.size > 0) {
        transcribeMutation.mutate(blob);
      }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Microfone indisponível",
        description: "Seu navegador não permite acesso ao microfone neste contexto. Abra a aplicação em uma nova aba (HTTPS) e tente novamente.",
        variant: "destructive",
      });
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast({
        title: "Conexão não segura",
        description: "O microfone só funciona em HTTPS. Acesse a aplicação em uma URL segura.",
        variant: "destructive",
      });
      return;
    }
    try {
      await startRecording();
    } catch (err: any) {
      const name = err?.name || "";
      let description = "Permita o acesso ao microfone no navegador para usar essa função.";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        description = "Permissão negada. Habilite o microfone nas configurações do navegador para este site.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        description = "Nenhum microfone foi encontrado. Conecte um e tente novamente.";
      } else if (name === "NotReadableError") {
        description = "Outro aplicativo está usando o microfone. Feche-o e tente novamente.";
      } else if (err?.message) {
        description = err.message;
      }
      toast({ title: "Microfone indisponível", description, variant: "destructive" });
    }
  };

  const downloadCSV = () => {
    if (!result) return;
    const header = result.columns.join(",");
    const rows = result.rows.map((row) =>
      result.columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analise_otd.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderKPI = () => {
    if (!result || result.rows.length === 0) return null;
    const firstRow = result.rows[0];
    return (
      <div className="flex flex-wrap gap-4 mt-6">
        {result.columns.map((col) => (
          <div
            key={col}
            className="flex-1 min-w-[160px] bg-primary/5 border border-primary/20 rounded-xl p-6 text-center"
            data-testid={`kpi-${col}`}
          >
            <div className="text-3xl font-bold text-primary">
              {String(firstRow[col] ?? "—")}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{col}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    if (!result || result.rows.length === 0) return null;
    const cols = result.columns;
    const labelKey = cols[0];
    const valueKeys = cols.slice(1);

    const data = result.rows.map((row) => {
      const obj: Record<string, unknown> = { [labelKey]: row[labelKey] };
      for (const k of valueKeys) {
        const v = row[k];
        obj[k] = v !== null && v !== undefined ? Number(v) || 0 : 0;
      }
      return obj;
    });

    if (result.chartType === "kpi") return renderKPI();

    if (result.chartType === "pie" && valueKeys.length >= 1) {
      const pieData = data.map((row, i) => ({
        name: String(row[labelKey]),
        value: Number(row[valueKeys[0]]) || 0,
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }));
      return (
        <ResponsiveContainer width="100%" height={380}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={140}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(1)}%)`
              }
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (result.chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={labelKey}
              tick={{ fontSize: 12 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 12 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {valueKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderTable = () => {
    if (!result) return null;
    return (
      <div className="overflow-auto rounded-lg border border-border max-h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap bg-muted/50 text-xs font-semibold uppercase tracking-wide">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={result.columns.length} className="text-center text-muted-foreground py-8">
                  Nenhum resultado encontrado
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, i) => (
                <TableRow key={i} data-testid={`table-row-${i}`}>
                  {result.columns.map((col) => (
                    <TableCell key={col} className="text-sm whitespace-nowrap">
                      {row[col] === null || row[col] === undefined ? (
                        <span className="text-muted-foreground italic">—</span>
                      ) : (
                        String(row[col])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  const isLoading = queryMutation.isPending || transcribeMutation.isPending;
  const hasChart = result && result.chartType !== "table";
  const isRecording = recordingState === "recording";

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <BrainCircuit className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Consulta Inteligente</h1>
          <p className="text-xs text-muted-foreground">
            Faça perguntas em português ou por voz e obtenha análises dos dados
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              data-testid="input-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? "Ouvindo... fale sua pergunta"
                  : transcribeMutation.isPending
                  ? "Transcrevendo áudio..."
                  : "Ex: Quantos veículos estão em estoque por pátio?"
              }
              className="pr-28 resize-none min-h-[80px] text-sm"
              rows={3}
              disabled={isRecording || transcribeMutation.isPending}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant={isRecording ? "destructive" : "outline"}
                className={`h-8 w-8 shrink-0 ${isRecording ? "animate-pulse" : ""}`}
                onClick={handleMicClick}
                disabled={transcribeMutation.isPending || queryMutation.isPending}
                data-testid="button-voice-input"
                title={isRecording ? "Parar gravação" : "Gravar pergunta por voz"}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Button
                data-testid="button-submit-query"
                size="sm"
                onClick={handleSubmit}
                disabled={isLoading || !question.trim() || isRecording}
              >
                {queryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-1.5">Analisar</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isRecording ? (
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <span className="inline-block h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  Gravando… clique em
                  <MicOff className="inline h-3 w-3" />
                  para parar
                </span>
              ) : transcribeMutation.isPending ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin" />
                  Convertendo voz em texto…
                </span>
              ) : (
                "Ctrl+Enter para enviar · Clique no microfone para falar"
              )}
            </p>
          </div>

          {!result && !isLoading && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Sugestões:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((ex) => (
                  <button
                    key={ex}
                    data-testid={`button-example-${ex.slice(0, 20)}`}
                    onClick={() => handleExample(ex)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/30 hover:bg-muted transition-colors text-left"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="max-w-3xl mx-auto flex items-center gap-3 text-muted-foreground py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">
              {transcribeMutation.isPending
                ? "Convertendo voz em texto..."
                : "A IA está analisando sua pergunta..."}
            </span>
          </div>
        )}

        {result && !isLoading && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" data-testid="badge-row-count">
                  {result.rows.length} {result.rows.length === 1 ? "resultado" : "resultados"}
                </Badge>
                <Badge variant="outline" data-testid="badge-chart-type">
                  {result.chartType}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {hasChart && (
                  <>
                    <Button
                      size="sm"
                      variant={viewMode === "table" ? "default" : "outline"}
                      onClick={() => setViewMode("table")}
                      data-testid="button-view-table"
                    >
                      <TableIcon className="h-4 w-4 mr-1" />
                      Tabela
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === "chart" ? "default" : "outline"}
                      onClick={() => setViewMode("chart")}
                      data-testid="button-view-chart"
                    >
                      <BarChart2 className="h-4 w-4 mr-1" />
                      Gráfico
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadCSV}
                  data-testid="button-download-csv"
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
              </div>
            </div>

            {result.chartType === "kpi"
              ? renderKPI()
              : viewMode === "chart" && hasChart
              ? renderChart()
              : renderTable()}

            <div className="border border-border rounded-lg overflow-hidden">
              <button
                className="flex items-center gap-2 w-full px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => setShowSql(!showSql)}
                data-testid="button-toggle-sql"
              >
                <Code2 className="h-3.5 w-3.5" />
                SQL gerado
                {showSql ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                )}
              </button>
              {showSql && (
                <pre
                  className="p-4 text-xs bg-muted/10 overflow-auto whitespace-pre-wrap font-mono text-foreground"
                  data-testid="text-generated-sql"
                >
                  {result.sql}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
