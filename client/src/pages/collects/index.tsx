import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CollectRouteMap } from "@/components/collect-route-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Trash2, Loader2, Truck, MapPin, Calendar, User, Building, ExternalLink, FileText, ChevronsUpDown, Check, CheckCircle, Factory, Warehouse, ArrowDown, Package, ArrowLeftRight, RefreshCw } from "lucide-react";
import jsPDF from "jspdf";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { Collect, Manufacturer, Yard, Driver, Vehicle } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { cn } from "@/lib/utils";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CollectWithRelations extends Collect {
  manufacturer?: { name: string } | null;
  originYard?: { name: string } | null;
  yard?: { name: string } | null;
  driver?: { name: string; profilePhoto?: string | null } | null;
}

const statusOptions = [
  { value: "all", label: "Todos os Status" },
  { value: "em_transito", label: "Em Trânsito" },
  { value: "autorizado_portaria", label: "Autorizado Portaria" },
  { value: "finalizada", label: "Finalizada" },
];

function getCollectStatusLabel(status: string) {
  switch (status) {
    case "em_transito": return "Em Trânsito";
    case "autorizado_portaria": return "Autorizado Portaria";
    case "finalizada": return "Finalizada";
    default: return status;
  }
}


const newCollectFormSchema = z.object({
  vehicleChassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres"),
  manufacturerId: z.string().min(1, "Montadora é obrigatória"),
  yardId: z.string().min(1, "Pátio de destino é obrigatório"),
  driverId: z.string().optional(),
  collectDate: z.string().optional(),
  notes: z.string().optional(),
});

const newTransferFormSchema = z.object({
  vehicleChassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres"),
  originYardId: z.string().min(1, "Pátio de origem é obrigatório"),
  yardId: z.string().min(1, "Pátio de destino é obrigatório"),
  driverId: z.string().optional(),
  collectDate: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => d.originYardId !== d.yardId, {
  message: "Pátio de origem e destino devem ser diferentes",
  path: ["yardId"],
});

type NewCollectFormData = z.infer<typeof newCollectFormSchema>;
type NewTransferFormData = z.infer<typeof newTransferFormSchema>;

export default function CollectsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("em_transito");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingCollect, setViewingCollect] = useState<CollectWithRelations | null>(null);
  const [finalizeId, setFinalizeId] = useState<string | null>(null);
  const [finalizePortariaId, setFinalizePortariaId] = useState<string | null>(null);
  const [showNewCollectDialog, setShowNewCollectDialog] = useState(false);
  const [showNewTransferDialog, setShowNewTransferDialog] = useState(false);
  const [openManufacturer, setOpenManufacturer] = useState(false);
  const [openYard, setOpenYard] = useState(false);
  const [openDriver, setOpenDriver] = useState(false);
  const [openTransferOriginYard, setOpenTransferOriginYard] = useState(false);
  const [openTransferDestYard, setOpenTransferDestYard] = useState(false);
  const [openTransferDriver, setOpenTransferDriver] = useState(false);
  const [openTransferVehicle, setOpenTransferVehicle] = useState(false);
  const { toast } = useToast();

  const { data: collects, isLoading, isFetching, refetch } = useQuery<CollectWithRelations[]>({
    queryKey: ["/api/collects"],
    staleTime: 0,
  });

  const { data: manufacturers } = useQuery<Manufacturer[]>({ queryKey: ["/api/manufacturers"] });
  const { data: yards } = useQuery<Yard[]>({ queryKey: ["/api/yards"] });
  const { data: drivers } = useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
  const { data: vehicles } = useQuery<Vehicle[]>({ queryKey: ["/api/vehicles"] });

  const activeDrivers = drivers?.filter((d) => d.isActive === "true" && d.isApto === "true");
  const activeManufacturers = manufacturers?.filter((m) => m.isActive === "true");
  const activeYards = yards?.filter((y) => y.isActive === "true");
  const stockVehicles = vehicles?.filter((v) => v.status === "em_estoque") ?? [];

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const newCollectForm = useForm<NewCollectFormData>({
    resolver: zodResolver(newCollectFormSchema),
    defaultValues: {
      vehicleChassi: "",
      manufacturerId: "",
      yardId: "",
      driverId: "",
      collectDate: formatDateTimeLocal(new Date()),
      notes: "",
    },
  });

  const createCollectMutation = useMutation({
    mutationFn: async (data: NewCollectFormData) => {
      return apiRequest("POST", "/api/collects", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Coleta registrada - Veículo adicionado ao estoque" });
      setShowNewCollectDialog(false);
      newCollectForm.reset({
        vehicleChassi: "",
        manufacturerId: "",
        yardId: "",
        driverId: "",
        collectDate: formatDateTimeLocal(new Date()),
        notes: "",
      });
    },
    onError: () => {
      toast({ title: "Erro ao salvar coleta", variant: "destructive" });
    },
  });

  const newTransferForm = useForm<NewTransferFormData>({
    resolver: zodResolver(newTransferFormSchema),
    defaultValues: {
      vehicleChassi: "",
      originYardId: "",
      yardId: "",
      driverId: "",
      collectDate: formatDateTimeLocal(new Date()),
      notes: "",
    },
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: NewTransferFormData) => {
      return apiRequest("POST", "/api/collects", { ...data, collectType: "transferencia" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Transferência registrada com sucesso" });
      setShowNewTransferDialog(false);
      newTransferForm.reset({
        vehicleChassi: "",
        originYardId: "",
        yardId: "",
        driverId: "",
        collectDate: formatDateTimeLocal(new Date()),
        notes: "",
      });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Erro ao registrar transferência", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/collects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      toast({ title: "Coleta excluída com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir coleta", variant: "destructive" });
    },
  });

  const authorizeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/portaria/authorize/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Entrada autorizada pela portaria" });
      setFinalizeId(null);
    },
    onError: () => {
      toast({ title: "Erro ao autorizar entrada", variant: "destructive" });
    },
  });

  const finalizePortariaMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/portaria/finalize/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Coleta finalizada com sucesso" });
      setFinalizePortariaId(null);
    },
    onError: () => {
      toast({ title: "Erro ao finalizar coleta", variant: "destructive" });
    },
  });

  const [generatingPDF, setGeneratingPDF] = useState(false);

  const generatePDF = async (collect: CollectWithRelations) => {
    setGeneratingPDF(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();   // 210
      const PH = doc.internal.pageSize.getHeight();  // 297
      const M = 14; // margin
      const CW = PW - M * 2; // content width
      let y = 0;

      // ─── Brand colours ───────────────────────────────────────────────
      const ORANGE: [number, number, number] = [232, 93, 4];
      const DARK:   [number, number, number] = [28, 28, 36];
      const MID:    [number, number, number] = [100, 103, 110];
      const LIGHT:  [number, number, number] = [245, 246, 248];
      const WHITE:  [number, number, number] = [255, 255, 255];
      const BORDER: [number, number, number] = [220, 221, 226];

      // ─── Helpers ─────────────────────────────────────────────────────
      const ensurePage = (needed: number) => {
        if (y + needed > PH - 16) {
          drawFooter();
          doc.addPage();
          drawPageTop();
        }
      };

      const fmtDt = (v: string | null | undefined) =>
        v ? format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";

      const drawFooter = () => {
        const footerY = PH - 8;
        doc.setDrawColor(...BORDER);
        doc.line(M, PH - 12, PW - M, PH - 12);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text("OTD Logistics — Sistema de Gestão de Entregas", M, footerY);
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          PW - M, footerY, { align: "right" }
        );
        doc.setTextColor(...DARK);
      };

      // ─── Section header ───────────────────────────────────────────────
      const sectionHeader = (title: string, iconLabel = "•") => {
        ensurePage(14);
        y += 4;
        doc.setFillColor(...LIGHT);
        doc.roundedRect(M, y, CW, 8.5, 1.5, 1.5, "F");
        doc.setDrawColor(...BORDER);
        doc.roundedRect(M, y, CW, 8.5, 1.5, 1.5, "S");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...ORANGE);
        doc.text(iconLabel, M + 3.5, y + 5.6);
        doc.setTextColor(...DARK);
        doc.text(title.toUpperCase(), M + 8, y + 5.6);
        y += 12;
      };

      // ─── Row: label + value ───────────────────────────────────────────
      const row = (label: string, value: string | null | undefined, col2 = false, x2 = M) => {
        if (!value) return;
        const xL = col2 ? x2 : M;
        const colW = col2 ? CW / 2 - 3 : CW;
        ensurePage(7);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text(label, xL, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        const lines = doc.splitTextToSize(value, colW - 2);
        doc.text(lines, xL, y + 4);
        if (!col2) y += 4 + lines.length * 4 + 2;
      };

      // Two-column row helper
      const row2 = (l1: string, v1: string | null | undefined, l2: string, v2: string | null | undefined) => {
        if (!v1 && !v2) return;
        ensurePage(10);
        const half = CW / 2;
        // Left col
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        if (v1) { doc.text(l1, M, y); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK); doc.text(String(v1), M, y + 4); }
        // Right col
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        if (v2) { doc.text(l2, M + half + 2, y); doc.setFont("helvetica", "bold"); doc.setTextColor(...DARK); doc.text(String(v2), M + half + 2, y + 4); }
        y += 10;
      };

      const divider = () => {
        doc.setDrawColor(...BORDER);
        doc.line(M, y, PW - M, y);
        y += 4;
      };

      const photoList = (photos: (string | null | undefined)[], labels: string[]) => {
        const present = labels.filter((_, i) => !!photos[i]);
        if (present.length === 0) return;
        ensurePage(8);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text("Fotos registradas:", M, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(present.join("  ·  "), M + 30, y);
        y += 6;
      };

      const drawPageTop = () => { y = 3; };

      // ═══════════════════════════════════════════════════════════════════
      // ─── PAGE 1 ────────────────────────────────────────────────────────
      // ═══════════════════════════════════════════════════════════════════

      // Orange header bar
      doc.setFillColor(...ORANGE);
      doc.rect(0, 0, PW, 22, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      doc.text("OTD LOGISTICS", M, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Sistema de Gestão de Entregas de Veículos", M, 15.5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE COLETA", PW - M, 10, { align: "right" });
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(format(new Date(), "dd/MM/yyyy", { locale: ptBR }), PW - M, 15.5, { align: "right" });

      y = 26;

      // Chassi hero card
      doc.setFillColor(...LIGHT);
      doc.roundedRect(M, y, CW, 18, 2, 2, "F");
      doc.setDrawColor(...BORDER);
      doc.roundedRect(M, y, CW, 18, 2, 2, "S");

      // Orange left accent
      doc.setFillColor(...ORANGE);
      doc.roundedRect(M, y, 4, 18, 1, 1, "F");

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(collect.vehicleChassi, M + 8, y + 7.5);

      // Type badge
      const isTransfer = collect.collectType === "transferencia";
      const badgeText = isTransfer ? "TRANSFERÊNCIA" : "COLETA";
      const badgeColor: [number, number, number] = isTransfer ? [124, 58, 237] : [245, 158, 11];
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      const badgeW = doc.getTextWidth(badgeText) + 6;
      doc.setFillColor(...badgeColor);
      doc.roundedRect(M + 8, y + 9.5, badgeW, 5.5, 1, 1, "F");
      doc.setTextColor(...WHITE);
      doc.text(badgeText, M + 11, y + 13.5);

      // Status badge
      const statusText = getCollectStatusLabel(collect.status).toUpperCase();
      const statusColors: Record<string, [number, number, number]> = {
        em_transito: [245, 158, 11],
        autorizado_portaria: [59, 130, 246],
        finalizada: [34, 197, 94],
      };
      const sColor = statusColors[collect.status] ?? [150, 150, 150];
      const sW = doc.getTextWidth(statusText) + 6;
      doc.setFillColor(...sColor);
      doc.roundedRect(M + 8 + badgeW + 3, y + 9.5, sW, 5.5, 1, 1, "F");
      doc.text(statusText, M + 8 + badgeW + 6, y + 13.5);
      doc.setTextColor(...DARK);

      y += 23;

      // ─── Dados Gerais ─────────────────────────────────────────────────
      sectionHeader("Dados Gerais", "①");
      row2("Data da Coleta", fmtDt(collect.collectDate?.toString()), "Criada em", fmtDt(collect.createdAt?.toString()));
      row2("Tipo", isTransfer ? "Transferência entre Pátios" : "Coleta na Montadora", "Status", getCollectStatusLabel(collect.status));
      divider();

      // ─── Origem e Destino ─────────────────────────────────────────────
      sectionHeader("Origem e Destino", "②");
      if (isTransfer) {
        row2("Pátio de Origem", collect.originYard?.name ?? "—", "Pátio de Destino", collect.yard?.name ?? "—");
      } else {
        row2("Montadora (Origem)", collect.manufacturer?.name ?? "—", "Pátio de Destino", collect.yard?.name ?? "—");
      }
      row("Motorista Responsável", collect.driver?.name ?? "—");
      divider();

      // ─── Coordenadas GPS ──────────────────────────────────────────────
      if (collect.startLatitude || collect.endLatitude) {
        sectionHeader("Coordenadas GPS da Rota", "③");
        if (collect.startLatitude && collect.startLongitude) {
          row2(
            "Coordenadas de Início",
            `${parseFloat(collect.startLatitude).toFixed(5)}, ${parseFloat(collect.startLongitude).toFixed(5)}`,
            "Google Maps",
            `maps.google.com/?q=${collect.startLatitude},${collect.startLongitude}`
          );
        }
        if (collect.endLatitude && collect.endLongitude) {
          row2(
            "Coordenadas de Fim",
            `${parseFloat(collect.endLatitude).toFixed(5)}, ${parseFloat(collect.endLongitude).toFixed(5)}`,
            "Google Maps",
            `maps.google.com/?q=${collect.endLatitude},${collect.endLongitude}`
          );
        }
        divider();
      }

      // ─── Check-in ─────────────────────────────────────────────────────
      const hasCheckin = collect.checkinDateTime || (collect.checkinLocation as any)?.coordinates ||
        collect.checkinSelfiePhoto || collect.checkinFrontalPhoto || collect.checkinNotes;
      if (hasCheckin) {
        sectionHeader("Check-in — Saída da Montadora", "④");
        row2(
          "Data / Hora",
          fmtDt(collect.checkinDateTime?.toString()),
          "Localização GPS",
          (collect.checkinLocation as any)?.coordinates
            ? `${((collect.checkinLocation as any).coordinates[1]).toFixed(5)}, ${((collect.checkinLocation as any).coordinates[0]).toFixed(5)}`
            : null
        );
        if (collect.checkinNotes) row("Observações do Check-in", collect.checkinNotes);
        photoList(
          [collect.checkinSelfiePhoto, collect.checkinFrontalPhoto, collect.checkinLateral1Photo,
           collect.checkinLateral2Photo, collect.checkinTraseiraPhoto, collect.checkinOdometerPhoto,
           collect.checkinFuelLevelPhoto],
          ["Selfie", "Frontal", "Lateral 1", "Lateral 2", "Traseira", "Odômetro", "Combustível"]
        );
        if (collect.checkinDamagePhotos && collect.checkinDamagePhotos.length > 0) {
          ensurePage(6);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MID);
          doc.text("Fotos de avarias:", M, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(220, 60, 60);
          doc.text(`${collect.checkinDamagePhotos.length} foto(s) registrada(s)`, M + 30, y);
          doc.setTextColor(...DARK);
          y += 6;
        }
        divider();
      }

      // ─── Portaria ─────────────────────────────────────────────────────
      const hasCheckout = collect.checkoutDateTime || collect.checkoutFrontalPhoto;
      if (hasCheckout) {
        sectionHeader("Autorização de Entrada — Portaria", "⑤");
        row2(
          "Data / Hora",
          fmtDt(collect.checkoutDateTime?.toString()),
          "Localização GPS",
          (collect.checkoutLocation as any)?.coordinates
            ? `${((collect.checkoutLocation as any).coordinates[1]).toFixed(5)}, ${((collect.checkoutLocation as any).coordinates[0]).toFixed(5)}`
            : null
        );
        if (collect.checkoutNotes) row("Observações da Portaria", collect.checkoutNotes);
        photoList(
          [collect.checkoutSelfiePhoto, collect.checkoutFrontalPhoto, collect.checkoutLateral1Photo,
           collect.checkoutLateral2Photo, collect.checkoutTraseiraPhoto, collect.checkoutOdometerPhoto,
           collect.checkoutFuelLevelPhoto],
          ["Selfie", "Frontal", "Lateral 1", "Lateral 2", "Traseira", "Odômetro", "Combustível"]
        );
        if (collect.checkoutDamagePhotos && collect.checkoutDamagePhotos.length > 0) {
          ensurePage(6);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MID);
          doc.text("Fotos de avarias:", M, y);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(220, 60, 60);
          doc.text(`${collect.checkoutDamagePhotos.length} foto(s) registrada(s)`, M + 30, y);
          doc.setTextColor(...DARK);
          y += 6;
        }
        divider();
      }

      // ─── Observações ──────────────────────────────────────────────────
      if (collect.notes) {
        sectionHeader("Observações", "⑥");
        ensurePage(12);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        const lines = doc.splitTextToSize(collect.notes, CW - 2);
        doc.text(lines, M, y);
        y += lines.length * 4.5 + 4;
      }

      // ─── Footer ───────────────────────────────────────────────────────
      drawFooter();

      doc.save(`coleta-${collect.vehicleChassi}-${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF gerado com sucesso" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const filteredData = collects
    ?.filter((c) => {
      const matchesSearch =
        c.vehicleChassi.toLowerCase().includes(search.toLowerCase()) ||
        c.manufacturer?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesType = typeFilter === "all" || (c.collectType ?? "coleta") === typeFilter;
      let matchesDateFrom = true;
      let matchesDateTo = true;
      if (dateFrom && c.createdAt) {
        matchesDateFrom = new Date(c.createdAt) >= new Date(dateFrom + "T00:00:00");
      }
      if (dateTo && c.createdAt) {
        matchesDateTo = new Date(c.createdAt) <= new Date(dateTo + "T23:59:59");
      }
      return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo;
    })
    .sort((a, b) => {
      // Finalizadas primeiro
      const statusOrder: Record<string, number> = { "em_transito": 2, "autorizado_portaria": 1, "finalizada": 0 };
      const aOrder = statusOrder[a.status] ?? -1;
      const bOrder = statusOrder[b.status] ?? -1;
      if (aOrder !== bOrder) return bOrder - aOrder;
      return 0;
    });

  const columns = [
    {
      key: "status",
      label: "Status",
      render: (c: CollectWithRelations) =>
        c.status === "autorizado_portaria" ? (
          <button
            onClick={(e) => { e.stopPropagation(); setFinalizePortariaId(c.id); }}
            className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
            title="Clique para finalizar a coleta"
            data-testid={`badge-status-click-${c.id}`}
          >
            <StatusBadge status={c.status} />
          </button>
        ) : (
          <StatusBadge status={c.status} />
        ),
    },
    {
      key: "collectType",
      label: "Tipo",
      render: (c: CollectWithRelations) => c.collectType === "transferencia" ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
          <ArrowLeftRight className="h-3 w-3" />
          Transferência
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <Package className="h-3 w-3" />
          Coleta
        </span>
      ),
    },
    { key: "vehicleChassi", label: "Chassi" },
    {
      key: "manufacturer",
      label: "Origem",
      render: (c: CollectWithRelations) => c.collectType === "transferencia"
        ? (c.originYard?.name || "-")
        : (c.manufacturer?.name || "-"),
    },
    {
      key: "yard",
      label: "Destino (Pátio)",
      render: (c: CollectWithRelations) => c.yard?.name || "-",
    },
    {
      key: "driver",
      label: "Motorista",
      render: (c: CollectWithRelations) => c.driver?.name || "-",
    },
    {
      key: "collectDate",
      label: "Data Coleta",
      render: (c: CollectWithRelations) =>
        c.collectDate ? format(new Date(c.collectDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
    },
    {
      key: "createdAt",
      label: "Criada em",
      render: (c: CollectWithRelations) =>
        c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-",
    },
    {
      key: "actions",
      label: "",
      className: "w-40",
      render: (c: CollectWithRelations) => (
        <div className="flex items-center gap-1">
          {c.status === "em_transito" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFinalizeId(c.id);
                  }}
                  data-testid={`button-authorize-${c.id}`}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Autorizar Portaria</TooltipContent>
            </Tooltip>
          ) : c.status === "autorizado_portaria" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="default"
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={(e) => { e.stopPropagation(); setFinalizePortariaId(c.id); }}
                  data-testid={`button-finalize-portaria-${c.id}`}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Finalizar Coleta (Aguardando Portaria)</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  disabled
                  data-testid={`button-finalized-${c.id}`}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Coleta Finalizada</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  generatePDF(c);
                }}
                data-testid={`button-pdf-${c.id}`}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Gerar PDF</TooltipContent>
          </Tooltip>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(c.id);
            }}
            data-testid={`button-delete-${c.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Coletas"
        breadcrumbs={[
          { label: "Operação", href: "/" },
          { label: "Coletas" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative max-w-sm flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por chassi ou montadora..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-collects"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44" data-testid="select-type-filter">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="coleta">Coleta</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
                title="Data inicial (criação)"
                data-testid="input-date-from"
              />
              <span className="text-muted-foreground text-sm shrink-0">até</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
                title="Data final (criação)"
                data-testid="input-date-to"
              />
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  title="Limpar filtro de data"
                  data-testid="button-clear-dates"
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-collects"
              title="Atualizar lista de coletas"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowNewTransferDialog(true)}
              data-testid="button-add-transfer"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Nova Transferência
            </Button>
            <Button onClick={() => setShowNewCollectDialog(true)} data-testid="button-add-collect">
              <Plus className="mr-2 h-4 w-4" />
              Nova Coleta
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredData ?? []}
          isLoading={isLoading}
          keyField="id"
          onRowClick={(c) => setViewingCollect(c)}
          emptyMessage="Nenhuma coleta encontrada"
        />
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta coleta? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNewCollectDialog} onOpenChange={setShowNewCollectDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                  <Truck className="h-5 w-5" />
                </div>
                Nova Coleta
              </DialogTitle>
              <DialogDescription className="text-muted-foreground ml-[56px]">
                Registre uma nova coleta de veículo na montadora
              </DialogDescription>
            </DialogHeader>
          </div>

          <Form {...newCollectForm}>
            <form onSubmit={newCollectForm.handleSubmit((data) => createCollectMutation.mutate(data))} className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                    <Search className="h-3.5 w-3.5 text-emerald-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Identificação do Veículo</h3>
                </div>
                <FormField
                  control={newCollectForm.control}
                  name="vehicleChassi"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="Digite o chassi (17 caracteres)"
                            maxLength={17}
                            className="uppercase pl-10 h-11 text-base font-mono"
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-chassi"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Rota da Coleta</h3>
                </div>

                <div className="relative flex flex-col gap-0">
                  <div className="absolute left-[19px] top-[44px] bottom-[44px] w-[2px] bg-gradient-to-b from-emerald-500 via-emerald-300 to-blue-500 z-0 rounded-full" />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Origem — Montadora</span>
                    </div>
                    <div className="ml-7">
                      <FormField
                        control={newCollectForm.control}
                        name="manufacturerId"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <Popover open={openManufacturer} onOpenChange={setOpenManufacturer}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between h-11",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    data-testid="select-manufacturer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Factory className="h-4 w-4 shrink-0 text-emerald-600" />
                                      {field.value
                                        ? activeManufacturers?.find((m) => m.id === field.value)?.name
                                        : "Selecione a montadora"}
                                    </div>
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
                    </div>
                  </div>

                  <div className="flex justify-center my-1.5 relative z-10">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-b from-emerald-100 to-blue-100 dark:from-emerald-900/30 dark:to-blue-900/30 border shadow-sm">
                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Destino — Pátio</span>
                    </div>
                    <div className="ml-7">
                      <FormField
                        control={newCollectForm.control}
                        name="yardId"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <Popover open={openYard} onOpenChange={setOpenYard}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between h-11",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    data-testid="select-yard"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Warehouse className="h-4 w-4 shrink-0 text-blue-600" />
                                      {field.value
                                        ? activeYards?.find((y) => y.id === field.value)?.name
                                        : "Selecione o pátio"}
                                    </div>
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
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                    <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Programação</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={newCollectForm.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          Motorista
                        </FormLabel>
                        <Popover open={openDriver} onOpenChange={setOpenDriver}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between h-11",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="select-driver"
                              >
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 shrink-0 text-amber-600" />
                                  {field.value
                                    ? activeDrivers?.find((d) => d.id === field.value)?.name
                                    : "Opcional"}
                                </div>
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
                    control={newCollectForm.control}
                    name="collectDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          Data da Coleta
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
                            <Input
                              {...field}
                              type="datetime-local"
                              className="pl-10 h-11"
                              data-testid="input-collect-date"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                    <FileText className="h-3.5 w-3.5 text-violet-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Observações</h3>
                </div>
                <FormField
                  control={newCollectForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <textarea
                          {...field}
                          placeholder="Informações adicionais sobre a coleta..."
                          className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[70px]"
                          data-testid="input-collect-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            </form>
          </Form>

          <div className="flex items-center gap-3 px-6 py-4 border-t bg-muted/30 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewCollectDialog(false)}
              className="flex-1"
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createCollectMutation.isPending}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md"
              data-testid="button-submit"
              onClick={newCollectForm.handleSubmit((data) => createCollectMutation.mutate(data))}
            >
              {createCollectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Truck className="mr-2 h-4 w-4" />
              )}
              Registrar Coleta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Transferência ── */}
      <Dialog open={showNewTransferDialog} onOpenChange={setShowNewTransferDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="bg-gradient-to-r from-purple-500/10 via-violet-500/5 to-transparent px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                Nova Transferência
              </DialogTitle>
              <DialogDescription className="text-muted-foreground ml-[56px]">
                Registre uma transferência de veículo entre pátios OTD
              </DialogDescription>
            </DialogHeader>
          </div>

          <Form {...newTransferForm}>
            <form
              onSubmit={newTransferForm.handleSubmit((data) => createTransferMutation.mutate(data))}
              className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5"
            >
              {/* Chassi */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
                    <Search className="h-3.5 w-3.5 text-purple-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Identificação do Veículo</h3>
                </div>
                <FormField
                  control={newTransferForm.control}
                  name="vehicleChassi"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <Popover open={openTransferVehicle} onOpenChange={setOpenTransferVehicle}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn("w-full justify-between h-11 font-mono", !field.value && "text-muted-foreground font-sans")}
                              data-testid="select-transfer-vehicle"
                            >
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 shrink-0 text-purple-600" />
                                {field.value
                                  ? field.value
                                  : stockVehicles.length === 0
                                    ? "Nenhum veículo em estoque"
                                    : "Selecione o chassi do veículo"}
                              </div>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar por chassi..." />
                            <CommandList>
                              <CommandEmpty>Nenhum veículo em estoque encontrado.</CommandEmpty>
                              <CommandGroup heading={`${stockVehicles.length} veículo(s) em estoque`}>
                                {stockVehicles.map((v) => {
                                  const yardName = yards?.find((y) => y.id === v.yardId)?.name;
                                  return (
                                    <CommandItem
                                      key={v.chassi}
                                      value={v.chassi}
                                      onSelect={() => {
                                        field.onChange(v.chassi);
                                        if (v.yardId) newTransferForm.setValue("originYardId", v.yardId);
                                        setOpenTransferVehicle(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4 shrink-0", field.value === v.chassi ? "opacity-100" : "opacity-0")} />
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-mono font-medium text-sm">{v.chassi}</span>
                                        {yardName && (
                                          <span className="text-xs text-muted-foreground truncate">{yardName}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Rota */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
                    <MapPin className="h-3.5 w-3.5 text-purple-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Rota da Transferência</h3>
                </div>

                <div className="relative flex flex-col gap-0">
                  <div className="absolute left-[19px] top-[44px] bottom-[44px] w-[2px] bg-gradient-to-b from-purple-500 via-purple-300 to-violet-500 z-0 rounded-full" />

                  {/* Origem — Pátio OTD */}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-purple-500 ring-4 ring-purple-500/20" />
                      <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Origem — Pátio OTD</span>
                    </div>
                    <div className="ml-7">
                      <FormField
                        control={newTransferForm.control}
                        name="originYardId"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <Popover open={openTransferOriginYard} onOpenChange={setOpenTransferOriginYard}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between h-11", !field.value && "text-muted-foreground")}
                                    data-testid="select-transfer-origin-yard"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Warehouse className="h-4 w-4 shrink-0 text-purple-600" />
                                      {field.value ? activeYards?.find((y) => y.id === field.value)?.name : "Selecione o pátio de origem"}
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar pátio de origem..." />
                                  <CommandList>
                                    <CommandEmpty>Nenhum pátio encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {activeYards?.map((yard) => (
                                        <CommandItem
                                          key={yard.id}
                                          value={yard.name}
                                          onSelect={() => { field.onChange(yard.id); setOpenTransferOriginYard(false); }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", field.value === yard.id ? "opacity-100" : "opacity-0")} />
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
                    </div>
                  </div>

                  <div className="flex justify-center my-1.5 relative z-10">
                    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-b from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 border shadow-sm">
                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Destino — Pátio OTD */}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex items-center justify-center h-[10px] w-[10px] rounded-full bg-violet-500 ring-4 ring-violet-500/20" />
                      <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Destino — Pátio OTD</span>
                    </div>
                    <div className="ml-7">
                      <FormField
                        control={newTransferForm.control}
                        name="yardId"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <Popover open={openTransferDestYard} onOpenChange={setOpenTransferDestYard}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn("w-full justify-between h-11", !field.value && "text-muted-foreground")}
                                    data-testid="select-transfer-dest-yard"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Warehouse className="h-4 w-4 shrink-0 text-violet-600" />
                                      {field.value ? activeYards?.find((y) => y.id === field.value)?.name : "Selecione o pátio de destino"}
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar pátio de destino..." />
                                  <CommandList>
                                    <CommandEmpty>Nenhum pátio encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {activeYards?.map((yard) => (
                                        <CommandItem
                                          key={yard.id}
                                          value={yard.name}
                                          onSelect={() => { field.onChange(yard.id); setOpenTransferDestYard(false); }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", field.value === yard.id ? "opacity-100" : "opacity-0")} />
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
                    </div>
                  </div>
                </div>
              </div>

              {/* Programação */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                    <Calendar className="h-3.5 w-3.5 text-amber-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Programação</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={newTransferForm.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <User className="h-3 w-3" /> Motorista
                        </FormLabel>
                        <Popover open={openTransferDriver} onOpenChange={setOpenTransferDriver}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn("w-full justify-between h-11", !field.value && "text-muted-foreground")}
                                data-testid="select-transfer-driver"
                              >
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 shrink-0 text-amber-600" />
                                  {field.value ? activeDrivers?.find((d) => d.id === field.value)?.name : "Opcional"}
                                </div>
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
                                      onSelect={() => { field.onChange(driver.id); setOpenTransferDriver(false); }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === driver.id ? "opacity-100" : "opacity-0")} />
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
                    control={newTransferForm.control}
                    name="collectDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" /> Data da Transferência
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500 pointer-events-none" />
                            <Input
                              {...field}
                              type="datetime-local"
                              className="pl-10 h-11"
                              data-testid="input-transfer-date"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                    <FileText className="h-3.5 w-3.5 text-violet-600" />
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">Observações</h3>
                </div>
                <FormField
                  control={newTransferForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <textarea
                          {...field}
                          placeholder="Informações adicionais sobre a transferência..."
                          className="flex w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[70px]"
                          data-testid="input-transfer-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>

          <div className="flex items-center gap-3 px-6 py-4 border-t bg-muted/30 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewTransferDialog(false)}
              className="flex-1"
              data-testid="button-transfer-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createTransferMutation.isPending}
              className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white shadow-md"
              data-testid="button-transfer-submit"
              onClick={newTransferForm.handleSubmit((data) => createTransferMutation.mutate(data))}
            >
              {createTransferMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeftRight className="mr-2 h-4 w-4" />
              )}
              Registrar Transferência
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!finalizeId} onOpenChange={() => setFinalizeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Autorizar Entrada pela Portaria</AlertDialogTitle>
            <AlertDialogDescription>
              Confirma a autorização de entrada deste veículo pelo portaria? O status será alterado para "Autorizado Portaria". A finalização da coleta será realizada pelo motorista no aplicativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finalizeId && authorizeMutation.mutate(finalizeId)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Autorizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!finalizePortariaId} onOpenChange={() => setFinalizePortariaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Finalizar Coleta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja finalizar esta coleta? O status será alterado para <strong>Finalizada</strong> e a coleta será encerrada com o usuário atual do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizePortariaMutation.isPending}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finalizePortariaId && finalizePortariaMutation.mutate(finalizePortariaId)}
              disabled={finalizePortariaMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {finalizePortariaMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Sim, Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {viewingCollect && (
        <CollectDetailDialog
          collect={viewingCollect}
          onClose={() => setViewingCollect(null)}
        />
      )}
    </div>
  );
}


interface CollectDetailDialogProps {
  collect: CollectWithRelations;
  onClose: () => void;
}

function CollectDetailDialog({ collect, onClose }: CollectDetailDialogProps) {
  const InfoItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="flex-shrink-0 p-4 pb-3 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">{collect.vehicleChassi}</DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={collect.status} />
                  {collect.collectType === "transferencia" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                      <ArrowLeftRight className="h-3 w-3" />
                      Transferência
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <Package className="h-3 w-3" />
                      Coleta
                    </span>
                  )}
                  {collect.collectDate && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(collect.collectDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={Building} label="Origem" value={collect.manufacturer?.name || "-"} />
                <InfoItem icon={MapPin} label="Destino" value={collect.yard?.name || "-"} />
                <div className="flex items-start gap-2">
                  {collect.driver?.profilePhoto ? (
                    <img
                      src={collect.driver.profilePhoto}
                      alt={collect.driver.name}
                      className="h-7 w-7 shrink-0 rounded-full object-cover border border-muted"
                      data-testid="img-collect-driver-photo"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border border-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Motorista</p>
                    <p className="text-sm font-medium truncate">{collect.driver?.name || "-"}</p>
                  </div>
                </div>
                <InfoItem icon={Calendar} label="Criada em" value={collect.createdAt ? format(new Date(collect.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"} />
                <InfoItem
                  icon={Calendar}
                  label="Início da Coleta"
                  value={collect.collectDate ? format(new Date(collect.collectDate), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                />
                <InfoItem
                  icon={Calendar}
                  label="Fim da Coleta"
                  value={collect.checkoutDateTime ? format(new Date(collect.checkoutDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Em andamento"}
                />
              </div>

              <CollectRouteMap
                startLatitude={collect.startLatitude}
                startLongitude={collect.startLongitude}
                endLatitude={collect.endLatitude}
                endLongitude={collect.endLongitude}
                originLabel={collect.manufacturer?.name || "Início"}
                destinationLabel={collect.yard?.name || "Destino"}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-white font-bold text-[8px]">A</span>
                    Início
                  </p>
                  {collect.startLatitude && collect.startLongitude ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono text-muted-foreground" data-testid="text-collect-start-coordinates">
                        {parseFloat(collect.startLatitude).toFixed(5)}, {parseFloat(collect.startLongitude).toFixed(5)}
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${collect.startLatitude},${collect.startLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        data-testid="link-collect-start-maps"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver no Maps
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Não registrado</p>
                  )}
                </div>

                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white font-bold text-[8px]">B</span>
                    Fim
                  </p>
                  {collect.endLatitude && collect.endLongitude ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono text-muted-foreground" data-testid="text-collect-end-coordinates">
                        {parseFloat(collect.endLatitude).toFixed(5)}, {parseFloat(collect.endLongitude).toFixed(5)}
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${collect.endLatitude},${collect.endLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        data-testid="link-collect-end-maps"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver no Maps
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Aguardando finalização</p>
                  )}
                </div>
              </div>

              {collect.notes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações Gerais</p>
                  <p className="text-sm">{collect.notes}</p>
                </div>
              )}

            </div>
          </ScrollArea>

          <div className="flex-shrink-0 p-4 pt-3 border-t">
            <Button variant="outline" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
