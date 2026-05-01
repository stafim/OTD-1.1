import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Sparkles,
  Loader2,
  Settings,
  Fuel,
  Wrench,
  Info,
  Image,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Minus,
  Zap,
  Weight,
  Gauge,
} from "lucide-react";
import type { TruckModel } from "@shared/schema";

const TRUCK_BRANDS = [
  "DAF",
  "FORD",
  "INTERNATIONAL",
  "IVECO",
  "MAN",
  "MERCEDES-BENZ",
  "SCANIA",
  "VOLKSWAGEN",
  "VOLVO",
];

const TRUCK_MODELS: Record<string, string[]> = {
  "DAF": ["CF 370","CF 420","CF 460","XF 480","XF 510","XF 530","XF 570"],
  "FORD": ["CARGO 2429","CARGO 2632","CARGO 3132","F-MAX 500","F-MAX 530"],
  "INTERNATIONAL": ["LT 9800","LT 9800 6X4","LT 12000","LT 12000 8X4"],
  "IVECO": ["S-WAY 400","S-WAY 480","S-WAY 500","S-WAY 570","STRALIS 440","STRALIS 480","TRAKKER 450","TRAKKER 480"],
  "MAN": ["TGS 26.400","TGS 26.420","TGS 26.440","TGS 33.400","TGS 33.420","TGX 28.440","TGX 28.460","TGX 28.480","TGX 29.480","TGX 33.440","TGX 33.460","TGX 33.480"],
  "MERCEDES-BENZ": ["ACTROS 2036","ACTROS 2040","ACTROS 2044","ACTROS 2048","ACTROS 2648","ACTROS 2651","ACTROS 2655","ATEGO 1317","ATEGO 1419","ATEGO 1719","AXOR 2036","AXOR 2040","AXOR 2044","AXOR 2644"],
  "SCANIA": ["G 360","G 400","G 440","G 460","P 310","P 360","P 400","P 440","R 380","R 410","R 450","R 500","R 540","R 580","R 650","S 450","S 500","S 540","S 580","S 650"],
  "VOLKSWAGEN": ["CONSTELLATION 17.330","CONSTELLATION 19.360","CONSTELLATION 24.280","CONSTELLATION 25.390","CONSTELLATION 26.420","CONSTELLATION 29.520","CONSTELLATION 31.390","CONSTELLATION 33.390","METEOR 29.520","METEOR 29.590"],
  "VOLVO": ["FH 420","FH 460","FH 500","FH 540","FH 600","FH 16 700","FM 330","FM 370","FM 380","FM 420","FM 460","FMX 370","FMX 420","FMX 460","FMX 500","FMX 540"],
};

const axleOptions = [
  { value: "2_eixos", label: "2 Eixos" },
  { value: "3_eixos", label: "3 Eixos" },
  { value: "4_eixos", label: "4 Eixos" },
  { value: "5_eixos", label: "5 Eixos" },
  { value: "6_eixos", label: "6 Eixos" },
  { value: "7_eixos", label: "7 Eixos" },
  { value: "8_eixos", label: "8 Eixos" },
  { value: "9_eixos", label: "9 Eixos" },
];

const axleLabelMap: Record<string, string> = {};
axleOptions.forEach(o => { axleLabelMap[o.value] = o.label; });

interface AITruckInfo {
  technicalDetails: {
    engine: string;
    power: string;
    torque: string;
    transmission: string;
    axleConfig: string;
    gvw: string;
    payload: string;
    fuelType: string;
    emissionStandard: string;
    wheelbase: string;
    cabType: string;
    year: string;
  };
  generalInfo: {
    overview: string;
    applications: string[];
    differentials: string[];
    targetMarket: string;
    competitorModels: string[];
  };
  consumption: {
    averageHighway: string;
    averageUrban: string;
    averageMixed: string;
    adBlueConsumption: string;
    fuelTankCapacity: string;
    autonomy: string;
    tips: string[];
  };
  chronicProblems: Array<{
    problem: string;
    description: string;
    severity: string;
    affectedComponents: string;
    estimatedCost: string;
  }>;
  images: Array<{
    angle: string;
    description: string;
  }>;
}

const brandColors: Record<string, string> = {
  "VOLVO": "bg-blue-600",
  "SCANIA": "bg-orange-600",
  "MAN": "bg-red-600",
  "MERCEDES-BENZ": "bg-gray-700",
  "DAF": "bg-yellow-600",
  "IVECO": "bg-red-500",
  "VOLKSWAGEN": "bg-blue-500",
  "FORD": "bg-blue-700",
  "INTERNATIONAL": "bg-red-700",
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  if (s === "grave") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Grave</Badge>;
  if (s === "moderado") return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><Minus className="h-3 w-3" />Moderado</Badge>;
  return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Leve</Badge>;
}

export default function TruckModelsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingModel, setEditingModel] = useState<TruckModel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formBrand, setFormBrand] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formAxle, setFormAxle] = useState("");
  const [formConsumption, setFormConsumption] = useState("");
  const [formVehicleValue, setFormVehicleValue] = useState("");

  const [aiModel, setAiModel] = useState<TruckModel | null>(null);
  const [aiData, setAiData] = useState<AITruckInfo | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);

  const { data: models, isLoading } = useQuery<TruckModel[]>({
    queryKey: ["/api/truck-models"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/truck-models", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truck-models"] });
      closeDialog();
      toast({ title: "Modelo cadastrado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao cadastrar modelo", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/truck-models/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truck-models"] });
      closeDialog();
      toast({ title: "Modelo atualizado com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar modelo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/truck-models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truck-models"] });
      setDeletingId(null);
      toast({ title: "Modelo removido com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao remover modelo", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setShowDialog(false);
    setEditingModel(null);
    setFormBrand("");
    setFormModel("");
    setFormAxle("");
    setFormConsumption("");
    setFormVehicleValue("");
  };

  const openAddDialog = () => {
    setEditingModel(null);
    setFormBrand("");
    setFormModel("");
    setFormAxle("");
    setFormConsumption("");
    setFormVehicleValue("");
    setShowDialog(true);
  };

  const openEditDialog = (model: TruckModel) => {
    setEditingModel(model);
    setFormBrand(model.brand);
    setFormModel(model.model);
    setFormAxle(model.axleConfig);
    setFormConsumption(model.averageConsumption);
    setFormVehicleValue(model.vehicleValue || "");
    setShowDialog(true);
  };

  const openAIDialog = async (e: React.MouseEvent, model: TruckModel) => {
    e.stopPropagation();
    setAiModel(model);
    setAiData(null);
    setShowAIDialog(true);
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/truck-models/ai-info", {
        brand: model.brand,
        model: model.model,
        axleConfig: axleLabelMap[model.axleConfig] || model.axleConfig,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro");
      setAiData(data);
    } catch (err: any) {
      toast({
        title: "Erro ao consultar IA",
        description: err.message || "Verifique a chave de API nas configurações.",
        variant: "destructive",
      });
      setShowAIDialog(false);
    } finally {
      setAiLoading(false);
    }
  };

  const handleBrandChange = (brand: string) => {
    setFormBrand(brand);
    setFormModel("");
  };

  const handleSubmit = () => {
    if (!formBrand.trim()) { toast({ title: "Marca é obrigatória", variant: "destructive" }); return; }
    if (!formModel.trim()) { toast({ title: "Modelo é obrigatório", variant: "destructive" }); return; }
    if (!formAxle) { toast({ title: "Configuração de eixo é obrigatória", variant: "destructive" }); return; }
    const consumption = parseFloat(formConsumption);
    if (isNaN(consumption) || consumption <= 0) { toast({ title: "Consumo médio deve ser maior que 0", variant: "destructive" }); return; }
    const vehicleVal = formVehicleValue ? parseFloat(formVehicleValue) : null;
    const data: any = {
      brand: formBrand.trim().toUpperCase(),
      model: formModel.trim().toUpperCase(),
      axleConfig: formAxle,
      averageConsumption: consumption.toFixed(2),
      vehicleValue: vehicleVal !== null ? vehicleVal.toFixed(2) : null,
    };
    if (editingModel) {
      updateMutation.mutate({ id: editingModel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const activeModels = (models?.filter(m => m.isActive !== "false") || [])
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));

  const filteredModels = activeModels.filter(m =>
    m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (axleLabelMap[m.axleConfig] || m.axleConfig).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: "brand", label: "Marca" },
    { key: "model", label: "Modelo" },
    {
      key: "axleConfig",
      label: "Eixos",
      render: (m: TruckModel) => axleLabelMap[m.axleConfig] || m.axleConfig,
    },
    {
      key: "averageConsumption",
      label: "Consumo médio",
      render: (m: TruckModel) => `${parseFloat(m.averageConsumption).toFixed(1)} km/l`,
    },
    {
      key: "vehicleValue",
      label: "Valor do veículo",
      render: (m: TruckModel) =>
        m.vehicleValue
          ? parseFloat(m.vehicleValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
    },
    {
      key: "actions",
      label: "",
      className: "w-32",
      render: (m: TruckModel) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
            onClick={(e) => openAIDialog(e, m)}
            title="Consultar IA"
            data-testid={`button-ai-model-${m.id}`}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); openEditDialog(m); }}
            data-testid={`button-edit-model-${m.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); setDeletingId(m.id); }}
            data-testid={`button-delete-model-${m.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const availableModels = formBrand ? (TRUCK_MODELS[formBrand] || []) : [];
  const extraModels: string[] = [];
  if (formModel && !availableModels.includes(formModel)) extraModels.push(formModel);
  const modelOptions = [...availableModels, ...extraModels];

  const extraBrands: string[] = [];
  if (formBrand && !TRUCK_BRANDS.includes(formBrand)) extraBrands.push(formBrand);
  const brandOptions = [...TRUCK_BRANDS, ...extraBrands];

  const brandColor = aiModel ? (brandColors[aiModel.brand] || "bg-gray-600") : "bg-gray-600";

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Modelos de Caminhão"
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Modelos" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por marca, modelo ou eixo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-models"
            />
          </div>
          <Button onClick={openAddDialog} data-testid="button-add-model">
            <Plus className="mr-2 h-4 w-4" />
            Novo Modelo
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredModels}
          isLoading={isLoading}
          keyField="id"
          onRowClick={openEditDialog}
          emptyMessage="Nenhum modelo cadastrado"
        />
      </div>

      {/* ===== AI INFO DIALOG ===== */}
      <Dialog open={showAIDialog} onOpenChange={(open) => { if (!open) { setShowAIDialog(false); setAiData(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Header com cor da marca */}
          <div className={`${brandColor} text-white px-6 py-4 rounded-t-lg`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {aiModel?.brand} {aiModel?.model}
                </h2>
                <p className="text-sm text-white/80">
                  Análise técnica gerada por Inteligência Artificial
                </p>
              </div>
            </div>
          </div>

          {aiLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 px-6">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-yellow-400 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Consultando IA...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analisando dados técnicos do {aiModel?.brand} {aiModel?.model}
                </p>
              </div>
            </div>
          ) : aiData ? (
            <div className="flex-1 overflow-auto">
              <Tabs defaultValue="technical" className="flex flex-col h-full">
                <div className="px-6 pt-4 border-b">
                  <TabsList className="grid w-full grid-cols-5 h-auto gap-1">
                    <TabsTrigger value="technical" className="flex-col gap-1 py-2 text-xs">
                      <Settings className="h-4 w-4" />
                      Técnico
                    </TabsTrigger>
                    <TabsTrigger value="images" className="flex-col gap-1 py-2 text-xs">
                      <Image className="h-4 w-4" />
                      Imagens
                    </TabsTrigger>
                    <TabsTrigger value="general" className="flex-col gap-1 py-2 text-xs">
                      <Info className="h-4 w-4" />
                      Geral
                    </TabsTrigger>
                    <TabsTrigger value="consumption" className="flex-col gap-1 py-2 text-xs">
                      <Fuel className="h-4 w-4" />
                      Consumo
                    </TabsTrigger>
                    <TabsTrigger value="problems" className="flex-col gap-1 py-2 text-xs">
                      <AlertTriangle className="h-4 w-4" />
                      Problemas
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  {/* TAB 1: DETALHES TÉCNICOS */}
                  <TabsContent value="technical" className="mt-0 space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Settings className="h-4 w-4 text-purple-500" />
                      Detalhes Técnicos
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: <Zap className="h-4 w-4 text-blue-500" />, label: "Motor", value: aiData.technicalDetails.engine },
                        { icon: <Gauge className="h-4 w-4 text-green-500" />, label: "Potência", value: aiData.technicalDetails.power },
                        { icon: <Wrench className="h-4 w-4 text-orange-500" />, label: "Torque", value: aiData.technicalDetails.torque },
                        { icon: <Settings className="h-4 w-4 text-gray-500" />, label: "Câmbio", value: aiData.technicalDetails.transmission },
                        { icon: <Weight className="h-4 w-4 text-red-500" />, label: "PBT", value: aiData.technicalDetails.gvw },
                        { icon: <Weight className="h-4 w-4 text-yellow-500" />, label: "Cap. de carga", value: aiData.technicalDetails.payload },
                        { icon: <Fuel className="h-4 w-4 text-blue-400" />, label: "Combustível", value: aiData.technicalDetails.fuelType },
                        { icon: <Info className="h-4 w-4 text-purple-400" />, label: "Emissão", value: aiData.technicalDetails.emissionStandard },
                        { icon: <Info className="h-4 w-4 text-teal-500" />, label: "Entre-eixos", value: aiData.technicalDetails.wheelbase },
                        { icon: <Info className="h-4 w-4 text-indigo-500" />, label: "Cabine", value: aiData.technicalDetails.cabType },
                        { icon: <Info className="h-4 w-4 text-pink-500" />, label: "Eixos", value: aiData.technicalDetails.axleConfig },
                        { icon: <Info className="h-4 w-4 text-emerald-500" />, label: "Período", value: aiData.technicalDetails.year },
                      ].map((item) => (
                        <div key={item.label} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                          <div className="mt-0.5 shrink-0">{item.icon}</div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-medium leading-tight">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* TAB 2: IMAGENS */}
                  <TabsContent value="images" className="mt-0 space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Image className="h-4 w-4 text-purple-500" />
                      Imagens do Veículo
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {aiData.images.map((img, idx) => (
                        <div key={idx} className="rounded-lg border overflow-hidden">
                          <div className={`${brandColor} flex items-center justify-center h-48 relative`}>
                            <div className="text-center text-white">
                              <div className="text-5xl mb-2">🚛</div>
                              <p className="font-bold text-lg">{aiModel?.brand} {aiModel?.model}</p>
                              <p className="text-sm text-white/80">{img.angle}</p>
                            </div>
                            <div className="absolute bottom-2 right-2">
                              <Badge className="bg-white/20 text-white border-white/30 text-xs">
                                {img.angle}
                              </Badge>
                            </div>
                          </div>
                          <div className="p-3 bg-muted/20">
                            <p className="text-sm text-muted-foreground">{img.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 mx-auto mb-2 text-purple-400" />
                      Imagens reais podem ser integradas via configuração da chave de API de imagens.
                    </div>
                  </TabsContent>

                  {/* TAB 3: INFORMAÇÕES GERAIS */}
                  <TabsContent value="general" className="mt-0 space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Info className="h-4 w-4 text-purple-500" />
                      Informações Gerais
                    </h3>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {aiData.generalInfo.overview}
                        </p>
                      </CardContent>
                    </Card>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-sm">Aplicações</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <ul className="space-y-1">
                            {aiData.generalInfo.applications.map((app, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                {app}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-sm">Diferenciais</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <ul className="space-y-1">
                            {aiData.generalInfo.differentials.map((d, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                                {d}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">Mercado-alvo</p>
                        <p className="text-sm font-medium">{aiData.generalInfo.targetMarket}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground mb-1">Concorrentes</p>
                        <div className="flex flex-wrap gap-1">
                          {aiData.generalInfo.competitorModels.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* TAB 4: CONSUMO */}
                  <TabsContent value="consumption" className="mt-0 space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-purple-500" />
                      Indicativos de Consumo
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Rodovia", value: aiData.consumption.averageHighway, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
                        { label: "Urbano", value: aiData.consumption.averageUrban, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
                        { label: "Misto", value: aiData.consumption.averageMixed, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
                      ].map((item) => (
                        <div key={item.label} className={`rounded-lg border p-4 text-center ${item.bg}`}>
                          <Fuel className={`h-6 w-6 mx-auto mb-1 ${item.color}`} />
                          <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">ARLA 32</p>
                        <p className="text-sm font-medium mt-1">{aiData.consumption.adBlueConsumption}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Tanque</p>
                        <p className="text-sm font-medium mt-1">{aiData.consumption.fuelTankCapacity}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Autonomia</p>
                        <p className="text-sm font-medium mt-1">{aiData.consumption.autonomy}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Dicas para economizar combustível
                      </p>
                      <ul className="space-y-2">
                        {aiData.consumption.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm rounded-lg bg-muted/30 p-2">
                            <span className="shrink-0 font-bold text-green-600">{i + 1}.</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TabsContent>

                  {/* TAB 5: PROBLEMAS CRÔNICOS */}
                  <TabsContent value="problems" className="mt-0 space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-purple-500" />
                      Problemas Crônicos Relatados
                    </h3>
                    <div className="space-y-3">
                      {aiData.chronicProblems.map((prob, i) => (
                        <Card key={i} className="border-l-4"
                          style={{ borderLeftColor: prob.severity?.toLowerCase() === 'grave' ? '#ef4444' : prob.severity?.toLowerCase() === 'moderado' ? '#f97316' : '#22c55e' }}
                        >
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-semibold text-sm">{prob.problem}</p>
                              <SeverityBadge severity={prob.severity} />
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{prob.description}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded bg-muted/40 p-2">
                                <span className="text-muted-foreground">Componentes:</span>
                                <p className="font-medium mt-0.5">{prob.affectedComponents}</p>
                              </div>
                              <div className="rounded bg-muted/40 p-2">
                                <span className="text-muted-foreground">Custo estimado:</span>
                                <p className="font-medium mt-0.5">{prob.estimatedCost}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 text-xs text-yellow-700 dark:text-yellow-400">
                      <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                      As informações acima são geradas por IA com base em dados históricos e relatos da indústria. Consulte sempre um técnico especializado.
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : null}

          <div className="border-t px-6 py-3 flex justify-end bg-background rounded-b-lg">
            <Button variant="outline" onClick={() => { setShowAIDialog(false); setAiData(null); }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT/CREATE DIALOG ===== */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? "Editar Modelo" : "Novo Modelo de Caminhão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select value={formBrand} onValueChange={handleBrandChange}>
                <SelectTrigger data-testid="select-model-brand">
                  <SelectValue placeholder="Selecione a marca" />
                </SelectTrigger>
                <SelectContent>
                  {brandOptions.map(brand => (
                    <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={formModel} onValueChange={setFormModel} disabled={!formBrand}>
                <SelectTrigger data-testid="select-model-name">
                  <SelectValue placeholder={formBrand ? "Selecione o modelo" : "Selecione primeiro a marca"} />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Configuração de Eixo</Label>
              <Select value={formAxle} onValueChange={setFormAxle}>
                <SelectTrigger data-testid="select-model-axle">
                  <SelectValue placeholder="Selecione o tipo de eixo" />
                </SelectTrigger>
                <SelectContent>
                  {axleOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Consumo Médio (km/l)</Label>
              <Input
                type="number"
                min="0.1"
                max="50"
                step="0.1"
                value={formConsumption}
                onChange={(e) => setFormConsumption(e.target.value)}
                placeholder="Ex: 2.5"
                data-testid="input-model-consumption"
              />
              <p className="text-xs text-muted-foreground">Quantos quilômetros o caminhão roda com 1 litro de diesel</p>
            </div>
            <div className="space-y-2">
              <Label>Valor do Veículo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={formVehicleValue}
                onChange={(e) => setFormVehicleValue(e.target.value)}
                placeholder="Ex: 350000"
                data-testid="input-model-vehicle-value"
              />
              <p className="text-xs text-muted-foreground">Valor médio do veículo deste modelo (opcional)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-model"
            >
              {editingModel ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRM ===== */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este modelo de caminhão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              data-testid="button-confirm-delete-model"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
