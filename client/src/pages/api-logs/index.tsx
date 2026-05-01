import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2,
  Activity,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  AlertTriangle,
  Zap,
  BarChart3,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApiLog {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  userId: string | null;
  username: string | null;
  userRole: string | null;
  ipAddress: string | null;
  requestBody: string | null;
  responsePreview: string | null;
  createdAt: string;
}

interface EndpointStat {
  method: string;
  path: string;
  count: number;
  avgDuration: number;
  lastCall: string;
  errorCount: number;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  POST: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function getStatusColor(code: number | null) {
  if (!code) return "bg-gray-100 text-gray-600";
  if (code < 300) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (code < 400) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (code < 500) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function ApiLogsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("history");
  const [methodFilter, setMethodFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ method: string; path: string } | null>(null);
  const PAGE_SIZE = 50;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (methodFilter) params.set("method", methodFilter);
    if (pathFilter) params.set("path", pathFilter);
    if (usernameFilter) params.set("username", usernameFilter);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    return params.toString();
  };

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: ApiLog[]; total: number }>({
    queryKey: ["/api/api-logs", methodFilter, pathFilter, usernameFilter, page],
    queryFn: async () => {
      const r = await fetch(`/api/api-logs?${buildQueryString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      if (!r.ok) return { logs: [], total: 0 };
      return r.json();
    },
  });

  const endpointLogsQs = () => {
    if (!selectedEndpoint) return "";
    const params = new URLSearchParams();
    params.set("method", selectedEndpoint.method);
    params.set("path", selectedEndpoint.path);
    params.set("limit", "100");
    return params.toString();
  };

  const { data: endpointLogsData, isLoading: endpointLogsLoading } = useQuery<{ logs: ApiLog[]; total: number }>({
    queryKey: ["/api/api-logs", "endpoint-detail", selectedEndpoint?.method, selectedEndpoint?.path],
    queryFn: () => fetch(`/api/api-logs?${endpointLogsQs()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
    }).then(r => r.json()),
    enabled: !!selectedEndpoint,
  });

  const { data: endpoints, isLoading: endpointsLoading } = useQuery<EndpointStat[]>({
    queryKey: ["/api/api-logs/endpoints"],
    queryFn: async () => {
      const r = await fetch("/api/api-logs/endpoints", {
        headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/api-logs"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-logs"] });
      toast({ title: "Logs limpos com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao limpar logs", variant: "destructive" });
    },
  });

  const totalPages = logsData ? Math.ceil(logsData.total / PAGE_SIZE) : 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <PageHeader
        title="Log de Requisições API"
        breadcrumbs={[
          { label: "Configurações", href: "/" },
          { label: "Log de API" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Logs</p>
                <p className="text-2xl font-bold" data-testid="text-total-logs">{logsData?.total ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Endpoints Ativos</p>
                <p className="text-2xl font-bold" data-testid="text-active-endpoints">{endpoints?.length ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold" data-testid="text-avg-duration">
                  {endpoints && endpoints.length > 0
                    ? `${Math.round(endpoints.reduce((s, e) => s + e.avgDuration * e.count, 0) / endpoints.reduce((s, e) => s + e.count, 0))}ms`
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Erros</p>
                <p className="text-2xl font-bold" data-testid="text-total-errors">
                  {endpoints ? endpoints.reduce((s, e) => s + e.errorCount, 0) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="history" data-testid="tab-history">Histórico Completo</TabsTrigger>
            <TabsTrigger value="endpoints" data-testid="tab-endpoints">Por Endpoint</TabsTrigger>
          </TabsList>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            data-testid="button-clear-logs"
          >
            {clearMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Limpar Logs
          </Button>
        </div>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v === "all" ? "" : v); setPage(0); }}>
                  <SelectTrigger className="w-[140px]" data-testid="select-method-filter">
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por caminho..."
                    value={pathFilter}
                    onChange={(e) => { setPathFilter(e.target.value); setPage(0); }}
                    className="pl-9 w-[250px]"
                    data-testid="input-path-filter"
                  />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por usuário..."
                    value={usernameFilter}
                    onChange={(e) => { setUsernameFilter(e.target.value); setPage(0); }}
                    className="pl-9 w-[200px]"
                    data-testid="input-username-filter"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !logsData?.logs?.length ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mb-3 opacity-30" />
                  <p>Nenhum log encontrado</p>
                </div>
              ) : (
                <>
                  <div className="overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[80px]">Método</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead className="w-[80px]">Status</TableHead>
                          <TableHead className="w-[80px]">Tempo</TableHead>
                          <TableHead className="w-[120px]">Usuário</TableHead>
                          <TableHead className="w-[160px]">Data/Hora</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsData.logs.map((log) => (
                          <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" data-testid={`row-log-${log.id}`}>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${METHOD_COLORS[log.method] || "bg-gray-100 text-gray-600"}`}>
                                {log.method}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-sm truncate max-w-[300px]" title={log.path}>
                              {log.path}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${getStatusColor(log.statusCode)}`}>
                                {log.statusCode ?? "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {log.durationMs != null ? `${log.durationMs}ms` : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[120px]">
                              {log.username || <span className="text-muted-foreground">anônimo</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.createdAt ? formatDate(log.createdAt) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)} data-testid={`button-view-log-${log.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between p-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, logsData.total)} de {logsData.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0} data-testid="button-first-page">
                        Primeira
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0} data-testid="button-prev-page">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        Página {page + 1} de {totalPages}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} data-testid="button-next-page">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} data-testid="button-last-page">
                        Última
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {endpointsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !endpoints?.length ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
                  <p>Nenhum endpoint registrado ainda</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[80px]">Método</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead className="w-[100px] text-center">Chamadas</TableHead>
                      <TableHead className="w-[100px] text-center">Tempo Médio</TableHead>
                      <TableHead className="w-[80px] text-center">Erros</TableHead>
                      <TableHead className="w-[140px]">Última Chamada</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.map((ep, idx) => (
                      <TableRow key={`${ep.method}-${ep.path}-${idx}`} data-testid={`row-endpoint-${idx}`}>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${METHOD_COLORS[ep.method] || "bg-gray-100 text-gray-600"}`}>
                            {ep.method}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm truncate max-w-[300px]" title={ep.path}>
                          {ep.path}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{ep.count}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <span className="flex items-center justify-center gap-1">
                            <Zap className="h-3 w-3 text-muted-foreground" />
                            {ep.avgDuration}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {ep.errorCount > 0 ? (
                            <Badge variant="destructive">{ep.errorCount}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">0</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ep.lastCall ? formatRelativeTime(ep.lastCall) : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedEndpoint({ method: ep.method, path: ep.path })}
                            data-testid={`button-view-endpoint-${idx}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${METHOD_COLORS[selectedLog?.method || ""] || ""}`}>
                {selectedLog?.method}
              </span>
              <span className="font-mono text-sm">{selectedLog?.path}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${getStatusColor(selectedLog.statusCode)}`}>
                    {selectedLog.statusCode}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Duração</p>
                  <p className="text-sm">{selectedLog.durationMs}ms</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Usuário</p>
                  <p className="text-sm">{selectedLog.username || "anônimo"} {selectedLog.userRole && <Badge variant="outline" className="ml-1 text-xs">{selectedLog.userRole}</Badge>}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">IP</p>
                  <p className="text-sm font-mono">{selectedLog.ipAddress || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Data/Hora</p>
                  <p className="text-sm">{selectedLog.createdAt ? formatDate(selectedLog.createdAt) : "—"}</p>
                </div>
              </div>
              {selectedLog.requestBody && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Request Body</p>
                  <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(selectedLog.requestBody), null, 2); } catch { return selectedLog.requestBody; }
                    })()}
                  </pre>
                </div>
              )}
              {selectedLog.responsePreview && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Response</p>
                  <pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(selectedLog.responsePreview), null, 2); } catch { return selectedLog.responsePreview; }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEndpoint} onOpenChange={() => setSelectedEndpoint(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${METHOD_COLORS[selectedEndpoint?.method || ""] || ""}`}>
                {selectedEndpoint?.method}
              </span>
              <span className="font-mono text-sm">{selectedEndpoint?.path}</span>
              <span className="text-sm text-muted-foreground ml-2">— Histórico</span>
            </DialogTitle>
          </DialogHeader>
          {endpointLogsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !endpointLogsData?.logs?.length ? (
            <p className="text-center text-muted-foreground p-8">Nenhum registro encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[80px]">Tempo</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpointLogsData.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${getStatusColor(log.statusCode)}`}>
                        {log.statusCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{log.durationMs}ms</TableCell>
                    <TableCell className="text-sm">{log.username || "anônimo"}</TableCell>
                    <TableCell className="text-sm font-mono">{log.ipAddress || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedEndpoint(null); setSelectedLog(log); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
