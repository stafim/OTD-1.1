import { useState, useCallback, useRef } from "react";
import { jsPDF } from "jspdf";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { normalizeImageUrl } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  RotateCcw, 
  FileText, 
  Truck, 
  User, 
  MapPin, 
  Search, 
  XCircle,
  Camera,
  DollarSign,
  Fuel,
  Utensils,
  Wrench,
  Car,
  Building,
  ImageOff,
  Plus,
  Upload,
  Loader2,
  Trash2,
  Hotel,
  Ticket,
  ThumbsUp,
  ThumbsDown,
  Check,
  X
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { 
  ExpenseSettlement, 
  ExpenseSettlementItem, 
  Transport, 
  Driver, 
  Client, 
  DeliveryLocation, 
  Yard 
} from "@shared/schema";

interface AssociatedRoute {
  id: string;
  name: string;
  fuelCost: string | null;
  tollCost: string | null;
  driverDailyCost: string | null;
  foodCost: string | null;
  othersCost: string | null;
  totalCost: string | null;
}

interface TravelRateInfo {
  name: string;
  rateType: string;
  rateValue: string;
}

interface ExpenseSettlementWithRelations extends ExpenseSettlement {
  transport?: Transport & {
    client?: Client;
    deliveryLocation?: DeliveryLocation;
    originYard?: Yard;
  };
  driver?: Driver;
  items?: ExpenseSettlementItem[];
  associatedRoute?: AssociatedRoute | null;
  driverCost?: string | null;
  travelRateInfo?: TravelRateInfo | null;
}

const expenseTypeLabels: Record<string, { label: string; icon: any }> = {
  combustivel: { label: "Combustível", icon: Fuel },
  pedagio: { label: "Pedágio", icon: Receipt },
  hospedagem: { label: "Hotel", icon: Hotel },
  alimentacao: { label: "Alimentação", icon: Utensils },
  passagem: { label: "Passagem", icon: Ticket },
  outros: { label: "Outros", icon: Receipt },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock },
  enviado: { label: "Aguardando Análise", variant: "default", icon: Eye },
  devolvido: { label: "Devolvido", variant: "destructive", icon: RotateCcw },
  aprovado: { label: "Aprovado", variant: "outline", icon: CheckCircle },
  assinado: { label: "Assinado", variant: "outline", icon: FileText },
};

export default function FinanceiroPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSettlement, setSelectedSettlement] = useState<ExpenseSettlementWithRelations | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [localAdvanceAmount, setLocalAdvanceAmount] = useState<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  interface ExpenseItemDraft {
    id: string;
    type: string;
    currency: string;
    amount: string;
    photoUrl: string;
    description: string;
  }
  
  const currencyConfig: Record<string, { label: string; country: string; symbol: string }> = {
    BRL: { label: "Real Brasileiro", country: "Brasil", symbol: "R$" },
    ARS: { label: "Peso Argentino", country: "Argentina", symbol: "$" },
    CLP: { label: "Peso Chileno", country: "Chile", symbol: "$" },
    PEN: { label: "Sol Peruano", country: "Peru", symbol: "S/" },
    UYU: { label: "Peso Uruguayo", country: "Uruguay", symbol: "$U" },
  };

  const countryConfig: Record<string, { label: string; flag: string }> = {
    BR: { label: "Brasil", flag: "🇧🇷" },
    AR: { label: "Argentina", flag: "🇦🇷" },
    CL: { label: "Chile", flag: "🇨🇱" },
    PE: { label: "Peru", flag: "🇵🇪" },
    UY: { label: "Uruguai", flag: "🇺🇾" },
  };

  const currencyToCountry: Record<string, string> = {
    BRL: "BR", ARS: "AR", CLP: "CL", PEN: "PE", UYU: "UY",
  };
  
  const [newSettlement, setNewSettlement] = useState<{
    transportId: string;
    driverId: string;
    driverNotes: string;
    items: ExpenseItemDraft[];
  }>({ transportId: "", driverId: "", driverNotes: "", items: [] });
  const [newItem, setNewItem] = useState({ type: "", currency: "BRL", amount: "", photoUrl: "", description: "" });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);
  const [approvingItemId, setApprovingItemId] = useState<string | null>(null);
  const [approvingAmount, setApprovingAmount] = useState("");
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null); // holds settlement id being generated

  const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const generateSettlementPDF = async (settlement: ExpenseSettlementWithRelations) => {
    setGeneratingPDF(settlement.id);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M = 14;
      const CW = PW - M * 2;
      let y = 0;

      const ORANGE: [number, number, number] = [232, 93, 4];
      const DARK:   [number, number, number] = [28, 28, 36];
      const MID:    [number, number, number] = [100, 103, 110];
      const LIGHT:  [number, number, number] = [245, 246, 248];
      const WHITE:  [number, number, number] = [255, 255, 255];
      const BORDER: [number, number, number] = [220, 221, 226];
      const GREEN:  [number, number, number] = [22, 163, 74];
      const RED:    [number, number, number] = [220, 38, 38];
      const YELLOW: [number, number, number] = [202, 138, 4];

      const ensurePage = (needed: number) => {
        if (y + needed > PH - 18) {
          drawFooter();
          doc.addPage();
          y = drawPageTop();
        }
      };

      const drawFooter = () => {
        doc.setDrawColor(...BORDER);
        doc.line(M, PH - 12, PW - M, PH - 12);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text("OTD Logistics — Sistema de Gestão de Entregas de Veículos", M, PH - 7);
        doc.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          PW - M, PH - 7, { align: "right" }
        );
        doc.setTextColor(...DARK);
      };

      const drawPageTop = (): number => {
        doc.setFillColor(...DARK);
        doc.rect(0, 0, PW, 22, "F");
        doc.setFillColor(...ORANGE);
        doc.rect(0, 22, PW, 3, "F");
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...WHITE);
        doc.text("PRESTAÇÃO DE CONTAS", M, 14);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...ORANGE);
        doc.text(`OTD Logistics`, PW - M, 10, { align: "right" });
        doc.setTextColor(200, 200, 200);
        doc.text(settlement.transport?.requestNumber || "", PW - M, 16, { align: "right" });
        doc.setTextColor(...DARK);
        return 32;
      };

      y = drawPageTop();

      const sectionHeader = (title: string, icon = "▸") => {
        ensurePage(14);
        y += 3;
        doc.setFillColor(...LIGHT);
        doc.roundedRect(M, y, CW, 8.5, 1.5, 1.5, "F");
        doc.setDrawColor(...BORDER);
        doc.roundedRect(M, y, CW, 8.5, 1.5, 1.5, "S");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...ORANGE);
        doc.text(icon, M + 3, y + 5.6);
        doc.setTextColor(...DARK);
        doc.text(title.toUpperCase(), M + 9, y + 5.6);
        y += 12;
      };

      const infoRow = (label: string, value: string | null | undefined, colX?: number, colW?: number) => {
        if (!value && value !== "0") return;
        const x = colX ?? M;
        const w = colW ?? CW;
        ensurePage(8);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text(label, x, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        const lines = doc.splitTextToSize(value, w - 2);
        doc.text(lines, x, y + 4);
        if (colX === undefined) y += 4 + lines.length * 4 + 2;
      };

      const twoCol = (label1: string, val1: string | null | undefined, label2: string, val2: string | null | undefined) => {
        ensurePage(10);
        const half = CW / 2 - 3;
        infoRow(label1, val1, M, half);
        infoRow(label2, val2, M + CW / 2 + 3, half);
        y += 10;
      };

      const fmtCur = (val: string | null | undefined, cur = "BRL") => {
        if (!val) return "R$ 0,00";
        const n = parseFloat(val);
        return n.toLocaleString("pt-BR", { style: "currency", currency: cur });
      };

      const fmtDt = (v: string | null | undefined) =>
        v ? format(new Date(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";

      // ── STATUS BANNER ────────────────────────────────────────────────
      const statusColors: Record<string, [number, number, number]> = {
        aprovado: GREEN,
        devolvido: RED,
        enviado: YELLOW,
        pendente: MID,
      };
      const statusLabels: Record<string, string> = {
        aprovado: "APROVADO",
        devolvido: "DEVOLVIDO",
        enviado: "AGUARDANDO ANÁLISE",
        pendente: "PENDENTE",
      };
      const sc = statusColors[settlement.status || "pendente"] || MID;
      doc.setFillColor(...sc);
      doc.roundedRect(M, y, CW, 9, 1.5, 1.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      doc.text(`STATUS: ${statusLabels[settlement.status || "pendente"] || settlement.status?.toUpperCase()}`, PW / 2, y + 6, { align: "center" });
      if (settlement.approvedAt) {
        const dateStr = `Aprovado em ${fmtDt(settlement.approvedAt?.toString())}`;
        doc.setFontSize(7.5);
        doc.text(dateStr, PW - M - 2, y + 6, { align: "right" });
      }
      doc.setTextColor(...DARK);
      y += 13;

      // ── INFORMAÇÕES DO TRANSPORTE ──────────────────────────────────
      sectionHeader("Informações do Transporte", "🚗");
      twoCol("Número OTD", settlement.transport?.requestNumber, "Chassi", settlement.transport?.vehicleChassi);
      twoCol("Origem", settlement.transport?.originYard?.name, "Destino", settlement.transport?.deliveryLocation
        ? `${settlement.transport.deliveryLocation.name} — ${settlement.transport.deliveryLocation.city}/${settlement.transport.deliveryLocation.state}`
        : null);
      twoCol("Cliente", settlement.transport?.client?.name, "Distância", settlement.routeDistance ? `${settlement.routeDistance} km` : null);
      if (settlement.transport?.checkinDateTime) {
        twoCol("Data de Saída", fmtDt(settlement.transport.checkinDateTime?.toString()), "Data de Entrega", fmtDt(settlement.transport.checkoutDateTime?.toString()));
      }
      y += 2;

      // ── INFORMAÇÕES DO MOTORISTA ──────────────────────────────────
      sectionHeader("Informações do Motorista", "👤");
      twoCol("Nome", settlement.driver?.name, "CPF", settlement.driver?.cpf);
      twoCol("Telefone", settlement.driver?.phone, "Modalidade", settlement.driver?.modality?.toUpperCase());
      y += 2;

      // ── RESUMO FINANCEIRO ─────────────────────────────────────────
      sectionHeader("Resumo Financeiro", "💰");
      const items = settlement.items || [];
      const approvedItems = items.filter(i => (i as any).itemStatus === "aprovado");
      const rejectedItems = items.filter(i => (i as any).itemStatus === "reprovado");
      const totalSubmitted = items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
      const totalComprovado = approvedItems.reduce((s, i) => s + parseFloat((i as any).approvedAmount || "0"), 0);
      const advanceAmount = parseFloat(settlement.advanceAmount || "0");
      // Fórmula: Adiantamento - Total Comprovado
      // Positivo → motorista deve devolver  |  Negativo → motorista deve receber
      const balance = advanceAmount - totalComprovado;

      const tableHeaders = ["Categoria", "Enviados", "Aprovados", "Valor Enviado", "Valor Comprovado"];
      const colW2 = [50, 20, 20, 45, 45];
      const colX2 = [M, M+50, M+70, M+90, M+135];
      ensurePage(30);
      doc.setFillColor(...DARK);
      doc.rect(M, y, CW, 7, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      tableHeaders.forEach((h, i) => doc.text(h, colX2[i] + 1, y + 5));
      doc.setTextColor(...DARK);
      y += 7;

      const typeLabels: Record<string, string> = {
        combustivel: "Combustível", pedagio: "Pedágio", hospedagem: "Hotel",
        alimentacao: "Alimentação", passagem: "Passagem", outros: "Outros",
      };
      const types = ["combustivel", "pedagio", "hospedagem", "alimentacao", "passagem", "outros"];
      let rowIndex = 0;
      for (const type of types) {
        const typeItems = items.filter(i => i.type === type);
        if (typeItems.length === 0) continue;
        const typeApproved = typeItems.filter(i => (i as any).itemStatus === "aprovado");
        const typeSubmittedVal = typeItems.reduce((s, i) => s + parseFloat(i.amount || "0"), 0);
        const typeApprovedVal = typeApproved.reduce((s, i) => s + parseFloat((i as any).approvedAmount || "0"), 0);
        doc.setFillColor(...(rowIndex % 2 === 0 ? [248, 248, 250] : WHITE as [number,number,number]));
        doc.rect(M, y, CW, 6.5, "F");
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        doc.text(typeLabels[type], colX2[0] + 1, y + 4.5);
        doc.text(String(typeItems.length), colX2[1] + 1, y + 4.5);
        doc.text(String(typeApproved.length), colX2[2] + 1, y + 4.5);
        doc.text(fmtCur(typeSubmittedVal.toString()), colX2[3] + 1, y + 4.5);
        doc.setTextColor(...GREEN);
        doc.text(fmtCur(typeApprovedVal.toString()), colX2[4] + 1, y + 4.5);
        doc.setTextColor(...DARK);
        doc.setDrawColor(...BORDER);
        doc.line(M, y + 6.5, M + CW, y + 6.5);
        y += 6.5;
        rowIndex++;
      }
      doc.setFillColor(...DARK);
      doc.rect(M, y, CW, 8, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WHITE);
      doc.text("TOTAL", colX2[0] + 1, y + 5.5);
      doc.text(String(items.length), colX2[1] + 1, y + 5.5);
      doc.text(String(approvedItems.length), colX2[2] + 1, y + 5.5);
      doc.setTextColor(255, 200, 150);
      doc.text(fmtCur(totalSubmitted.toString()), colX2[3] + 1, y + 5.5);
      doc.setTextColor(100, 255, 150);
      doc.text(fmtCur(totalComprovado.toString()), colX2[4] + 1, y + 5.5);
      doc.setTextColor(...DARK);
      y += 12;

      ensurePage(20);
      doc.setFillColor(240, 248, 240);
      doc.roundedRect(M, y, CW / 2 - 3, 14, 1.5, 1.5, "F");
      doc.setDrawColor(...GREEN);
      doc.roundedRect(M, y, CW / 2 - 3, 14, 1.5, 1.5, "S");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MID);
      doc.text("Adiantamento ao Motorista", M + 3, y + 5);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(fmtCur(advanceAmount.toString()), M + 3, y + 11);

      const bx = M + CW / 2 + 3;
      // balance = advanceAmount - totalComprovado
      // Positivo → motorista deve devolver | Negativo → motorista deve receber
      doc.setFillColor(...(balance > 0 ? [255, 242, 242] : balance < 0 ? [240, 248, 240] : [245, 245, 245]));
      doc.roundedRect(bx, y, CW / 2 - 3, 14, 1.5, 1.5, "F");
      doc.setDrawColor(...(balance > 0 ? RED : balance < 0 ? GREEN : MID));
      doc.roundedRect(bx, y, CW / 2 - 3, 14, 1.5, 1.5, "S");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MID);
      doc.text(balance > 0 ? "Motorista deve devolver" : balance < 0 ? "Motorista deve receber" : "Saldo zerado", bx + 3, y + 5);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(balance > 0 ? RED : balance < 0 ? GREEN : MID));
      doc.text(fmtCur(Math.abs(balance).toString()), bx + 3, y + 11);
      doc.setTextColor(...DARK);
      y += 18;

      if (settlement.driverNotes) {
        ensurePage(14);
        sectionHeader("Observações do Motorista", "📝");
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DARK);
        const noteLines = doc.splitTextToSize(settlement.driverNotes, CW - 4);
        doc.text(noteLines, M + 2, y);
        y += noteLines.length * 5 + 4;
      }

      // ── COMPROVANTES DE DESPESAS ──────────────────────────────────
      sectionHeader("Comprovantes de Despesas", "🧾");

      const itemStatusLabel: Record<string, string> = {
        aprovado: "APROVADO",
        reprovado: "REPROVADO",
        pendente: "PENDENTE",
      };
      const itemStatusColor: Record<string, [number, number, number]> = {
        aprovado: GREEN,
        reprovado: RED,
        pendente: YELLOW,
      };

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const ist = (item as any).itemStatus || "pendente";
        const approvedAmt = (item as any).approvedAmount;
        const stColor = itemStatusColor[ist] || MID;

        ensurePage(32);
        // Item header bar
        doc.setFillColor(...LIGHT);
        doc.roundedRect(M, y, CW, 7, 1, 1, "F");
        doc.setDrawColor(...BORDER);
        doc.roundedRect(M, y, CW, 7, 1, 1, "S");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(`#${idx + 1} · ${typeLabels[item.type] || item.type}`, M + 3, y + 5);
        if (item.description) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MID);
          doc.setFontSize(7.5);
          const descLines = doc.splitTextToSize(item.description, CW / 2);
          doc.text(descLines, M + CW / 2, y + 4.5);
        }
        // Status badge
        doc.setFillColor(...stColor);
        doc.roundedRect(PW - M - 30, y + 1, 30, 5, 1, 1, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...WHITE);
        doc.text(itemStatusLabel[ist] || ist.toUpperCase(), PW - M - 15, y + 4.5, { align: "center" });
        doc.setTextColor(...DARK);
        y += 9;

        // Values row
        ensurePage(10);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text("Moeda:", M + 2, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(item.currency || "BRL", M + 15, y + 3);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        doc.text("Valor Enviado:", M + CW / 3, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...DARK);
        doc.text(fmtCur(item.amount, item.currency || "BRL"), M + CW / 3 + 24, y + 3);

        if (ist === "aprovado" && approvedAmt) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MID);
          doc.text("Valor Aprovado:", M + CW * 2 / 3, y + 3);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...GREEN);
          doc.text(fmtCur(approvedAmt), M + CW * 2 / 3 + 26, y + 3);
          doc.setTextColor(...DARK);
        }
        y += 6;

        // Photo
        if (item.photoUrl) {
          const imgUrl = normalizeImageUrl(item.photoUrl);
          const imgData = await fetchImageAsBase64(imgUrl);
          if (imgData) {
            try {
              // Get natural dimensions to preserve aspect ratio
              const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.onerror = () => resolve({ w: 4, h: 3 });
                img.src = imgData;
              });
              const maxW = CW - 4;
              const maxH = 90;
              const ratio = dims.w / dims.h;
              let iW = maxW;
              let iH = iW / ratio;
              if (iH > maxH) { iH = maxH; iW = iH * ratio; }
              const ix = M + 2 + (maxW - iW) / 2;
              ensurePage(iH + 6);
              const imgFormat = imgData.startsWith("data:image/png") ? "PNG" : "JPEG";
              doc.addImage(imgData, imgFormat, ix, y, iW, iH, undefined, "MEDIUM");
              doc.setDrawColor(...BORDER);
              doc.rect(ix, y, iW, iH, "S");
              y += iH + 3;
            } catch {
              doc.setFontSize(8);
              doc.setTextColor(...MID);
              doc.text("[Não foi possível incorporar a foto]", M + 2, y + 5);
              y += 8;
              doc.setTextColor(...DARK);
            }
          } else {
            ensurePage(10);
            doc.setFontSize(8);
            doc.setTextColor(...MID);
            doc.text("[Foto não disponível para incorporação]", M + 2, y + 4);
            y += 8;
            doc.setTextColor(...DARK);
          }
        }
        y += 3;
      }

      // ── APROVAÇÃO ─────────────────────────────────────────────────
      const reviewedByUserName = (settlement as any).reviewedByUserName;
      if (reviewedByUserName || settlement.approvedAt) {
        ensurePage(24);
        sectionHeader("Informações de Aprovação", "✅");

        doc.setFillColor(...([232, 248, 238] as [number, number, number]));
        doc.roundedRect(M, y, CW, 18, 2, 2, "F");
        doc.setDrawColor(...GREEN);
        doc.roundedRect(M, y, CW, 18, 2, 2, "S");

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...GREEN);
        doc.text("APROVADO", M + 4, y + 5.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MID);
        if (reviewedByUserName) {
          doc.text(`Aprovado por:`, M + 4, y + 11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...DARK);
          doc.text(reviewedByUserName, M + 28, y + 11);
        }
        if (settlement.approvedAt) {
          const approvedDate = new Date(settlement.approvedAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MID);
          doc.text(`Data de aprovação:`, M + CW / 2, y + 11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...DARK);
          doc.text(approvedDate, M + CW / 2 + 33, y + 11);
        }

        y += 22;
      }

      // ── ASSINATURA ───────────────────────────────────────────────
      ensurePage(40);
      y += 4;
      doc.setDrawColor(...BORDER);
      doc.line(M, y, PW - M, y);
      y += 6;

      const halfW = CW / 2 - 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MID);
      const analyserLabel = reviewedByUserName ? reviewedByUserName : "Responsável pela Análise";
      doc.text(analyserLabel, M + halfW / 2, y, { align: "center" });
      doc.line(M + 5, y + 18, M + halfW - 5, y + 18);
      doc.setTextColor(...DARK);

      const sigX = M + CW / 2 + 5;
      doc.setTextColor(...MID);
      doc.text(`${settlement.driver?.name || "Motorista"}`, sigX + halfW / 2, y, { align: "center" });
      doc.line(sigX, y + 18, sigX + halfW - 5, y + 18);
      doc.setFontSize(7.5);
      doc.text(`CPF: ${settlement.driver?.cpf || ""}`, sigX + halfW / 2, y + 22, { align: "center" });
      doc.setTextColor(...DARK);

      drawFooter();

      const otd = settlement.transport?.requestNumber || settlement.id.substring(0, 8);
      doc.save(`prestacao-contas-${otd}.pdf`);

      toast({ title: "PDF gerado com sucesso!" });
    } catch (err) {
      console.error("PDF error:", err);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setGeneratingPDF(null);
    }
  };

  const { data: settlements, isLoading } = useQuery<ExpenseSettlementWithRelations[]>({
    queryKey: ["/api/expense-settlements"],
  });

  const { data: transports } = useQuery<Transport[]>({
    queryKey: ["/api/transports"],
  });

  const { data: drivers } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { transportId: string; driverId: string; driverNotes?: string; items: ExpenseItemDraft[] }) => {
      // Create settlement first
      const settlement = await apiRequest("POST", "/api/expense-settlements", {
        transportId: data.transportId,
        driverId: data.driverId,
        driverNotes: data.driverNotes,
        status: "enviado",
      });
      const settlementData = await settlement.json();
      
      // Create all items
      for (const item of data.items) {
        await apiRequest("POST", `/api/expense-settlements/${settlementData.id}/items`, {
          type: item.type,
          currency: item.currency || "BRL",
          amount: item.amount,
          photoUrl: item.photoUrl,
          description: item.description,
        });
      }
      
      return settlementData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      toast({ title: "Prestação de contas criada com sucesso!" });
      setShowNewDialog(false);
      setNewSettlement({ transportId: "", driverId: "", driverNotes: "", items: [] });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Erro ao criar prestação de contas", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (settlementId: string) => {
      return apiRequest("POST", `/api/expense-settlements/${settlementId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      toast({ title: "Prestação de contas aprovada com sucesso!" });
      setShowDetails(false);
    },
    onError: () => {
      toast({ title: "Erro ao aprovar prestação de contas", variant: "destructive" });
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({ settlementId, reason }: { settlementId: string; reason: string }) => {
      return apiRequest("POST", `/api/expense-settlements/${settlementId}/return`, { returnReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      toast({ title: "Prestação de contas devolvida para o motorista" });
      setShowReturnDialog(false);
      setShowDetails(false);
      setReturnReason("");
    },
    onError: () => {
      toast({ title: "Erro ao devolver prestação de contas", variant: "destructive" });
    },
  });

  const updateAdvanceMutation = useMutation({
    mutationFn: async ({ settlementId, advanceAmount }: { settlementId: string; advanceAmount: string }) => {
      return apiRequest("PATCH", `/api/expense-settlements/${settlementId}`, { advanceAmount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar adiantamento", variant: "destructive" });
    },
  });

  const debouncedUpdateAdvance = useCallback((settlementId: string, value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateAdvanceMutation.mutate({ settlementId, advanceAmount: value });
    }, 500);
  }, [updateAdvanceMutation]);

  const addItemMutation = useMutation({
    mutationFn: async (data: { settlementId: string; type: string; currency: string; amount: string; photoUrl: string; description: string }) => {
      return apiRequest("POST", `/api/expense-settlements/${data.settlementId}/items`, {
        type: data.type,
        currency: data.currency,
        amount: data.amount,
        photoUrl: data.photoUrl,
        description: data.description,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      if (selectedSettlement) {
        try {
          const response = await apiRequest("GET", `/api/expense-settlements/${selectedSettlement.id}`);
          const updatedSettlement = await response.json();
          setSelectedSettlement(updatedSettlement);
        } catch {}
      }
      toast({ title: "Despesa adicionada com sucesso!" });
      setShowAddItemDialog(false);
      setNewItem({ type: "", currency: "BRL", amount: "", photoUrl: "", description: "" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar despesa", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/expense-settlement-items/${itemId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      if (selectedSettlement) {
        try {
          const response = await apiRequest("GET", `/api/expense-settlements/${selectedSettlement.id}`);
          const updatedSettlement = await response.json();
          setSelectedSettlement(updatedSettlement);
        } catch {}
      }
      toast({ title: "Despesa removida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover despesa", variant: "destructive" });
    },
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, itemStatus, approvedAmount }: { itemId: string; itemStatus: string; approvedAmount?: string }) => {
      return apiRequest("PATCH", `/api/expense-settlement-items/${itemId}`, { itemStatus, approvedAmount: approvedAmount ?? null });
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-settlements"] });
      if (selectedSettlement) {
        try {
          const response = await apiRequest("GET", `/api/expense-settlements/${selectedSettlement.id}`);
          const updatedSettlement = await response.json();
          setSelectedSettlement(updatedSettlement);
        } catch {}
      }
      if (variables.itemStatus === "aprovado") {
        toast({ title: "Comprovante aprovado!" });
      } else {
        toast({ title: "Comprovante reprovado." });
      }
      setApprovingItemId(null);
      setApprovingAmount("");
    },
    onError: () => {
      toast({ title: "Erro ao atualizar comprovante", variant: "destructive" });
    },
  });

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      // Try Object Storage first
      const response = await apiRequest("POST", "/api/uploads/request-url", {
        contentType: file.type,
        name: file.name,
        isPublic: false,
      });

      const { uploadURL, objectPath } = await response.json();

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      return objectPath;
    } catch {
      // Fallback to local upload
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const localResponse = await apiRequest("POST", "/api/uploads/local", {
          filename: file.name,
          contentType: file.type,
          data: base64,
        });

        const { objectPath } = await localResponse.json();
        return objectPath;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({ title: err.message || "Erro ao fazer upload da foto", variant: "destructive" });
        return null;
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const objectPath = await uploadPhoto(file);
    if (objectPath) {
      setNewItem(prev => ({ ...prev, photoUrl: objectPath }));
    }
    setIsUploadingPhoto(false);
  };

  const handleNewSettlementItemPhoto = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingItemIndex(index);
    const objectPath = await uploadPhoto(file);
    if (objectPath) {
      setNewSettlement(prev => ({
        ...prev,
        items: prev.items.map((item, i) => 
          i === index ? { ...item, photoUrl: objectPath } : item
        ),
      }));
    }
    setUploadingItemIndex(null);
  };

  const addNewSettlementItem = () => {
    setNewSettlement(prev => ({
      ...prev,
      items: [...prev.items, { id: crypto.randomUUID(), type: "", currency: "BRL", amount: "", photoUrl: "", description: "" }],
    }));
  };

  const removeNewSettlementItem = (index: number) => {
    setNewSettlement(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateNewSettlementItem = (index: number, field: string, value: string) => {
    setNewSettlement(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleAddItem = () => {
    if (!selectedSettlement) return;
    if (!newItem.type || !newItem.photoUrl) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    addItemMutation.mutate({
      settlementId: selectedSettlement.id,
      type: newItem.type,
      currency: newItem.currency,
      amount: newItem.amount || "0",
      photoUrl: newItem.photoUrl,
      description: newItem.description,
    });
  };

  const pendingSettlements = settlements?.filter(s => s.status !== "aprovado" && s.status !== "assinado") || [];
  const allSettlements = settlements || [];

  const filteredSettlements = (activeTab === "pending" ? pendingSettlements : allSettlements).filter(s => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      s.transport?.requestNumber?.toLowerCase().includes(searchLower) ||
      s.driver?.name?.toLowerCase().includes(searchLower) ||
      s.transport?.vehicleChassi?.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (value: string | null, currency: string = "BRL") => {
    if (!value) return currencyConfig[currency]?.symbol + " 0,00" || "R$ 0,00";
    const num = parseFloat(value);
    const locales: Record<string, string> = {
      BRL: "pt-BR",
      ARS: "es-AR",
      CLP: "es-CL",
      PEN: "es-PE",
      UYU: "es-UY",
    };
    return num.toLocaleString(locales[currency] || "pt-BR", { style: "currency", currency: currency });
  };

  const openDetails = (settlement: ExpenseSettlementWithRelations) => {
    setSelectedSettlement(settlement);
    setLocalAdvanceAmount("");
    setShowDetails(true);
  };

  const openReturnDialog = () => {
    setShowReturnDialog(true);
  };

  const handleReturn = () => {
    if (!selectedSettlement || !returnReason.trim()) {
      toast({ title: "Por favor, informe o motivo da devolução", variant: "destructive" });
      return;
    }
    returnMutation.mutate({ settlementId: selectedSettlement.id, reason: returnReason });
  };

  const handleApprove = () => {
    if (!selectedSettlement) return;
    approveMutation.mutate(selectedSettlement.id);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Financeiro - Prestação de Contas" />
        <div className="grid gap-4 mt-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader title="Financeiro - Prestação de Contas" />

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por OTD, motorista ou chassi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-settlements"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {pendingSettlements.length} aguardando
            </Badge>
            <Button onClick={() => setShowNewDialog(true)} data-testid="button-new-settlement">
              <Plus className="h-4 w-4 mr-2" />
              Nova Prestação
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "all")}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Aguardando Análise ({pendingSettlements.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Receipt className="h-4 w-4" />
              Todas ({allSettlements.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <DataTable
              columns={[
                {
                  key: "status",
                  label: "Status",
                  render: (settlement) => {
                    const status = statusConfig[settlement.status || "pendente"];
                    const StatusIcon = status.icon;
                    return (
                      <Badge variant={status.variant} className="gap-1 whitespace-nowrap">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    );
                  },
                },
                {
                  key: "requestNumber",
                  label: "OTD",
                  render: (settlement) => (
                    <span className="font-mono font-bold text-primary">
                      {settlement.transport?.requestNumber || "—"}
                    </span>
                  ),
                },
                {
                  key: "driver",
                  label: "Motorista",
                  render: (settlement) => (
                    <span className="flex items-center gap-1.5 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {settlement.driver?.name || "—"}
                    </span>
                  ),
                },
                {
                  key: "vehicleChassi",
                  label: "Chassi",
                  render: (settlement) => (
                    <span className="font-mono text-sm">
                      {settlement.transport?.vehicleChassi || "—"}
                    </span>
                  ),
                },
                {
                  key: "destination",
                  label: "Destino",
                  render: (settlement) => (
                    <span className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {settlement.transport?.deliveryLocation?.city
                        ? `${settlement.transport.deliveryLocation.city}/${settlement.transport.deliveryLocation.state}`
                        : "—"}
                    </span>
                  ),
                },
                {
                  key: "totalExpenses",
                  label: "Total",
                  render: (settlement) => (
                    <span className="font-semibold text-green-600 text-sm">
                      {formatCurrency(settlement.totalExpenses)}
                    </span>
                  ),
                },
                {
                  key: "items",
                  label: "Comprovantes",
                  render: (settlement) => (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Camera className="h-3.5 w-3.5 shrink-0" />
                      {settlement.items?.length || 0}
                    </span>
                  ),
                },
                {
                  key: "submittedAt",
                  label: "Enviado em",
                  render: (settlement) => (
                    <span className="text-xs text-muted-foreground">
                      {settlement.submittedAt
                        ? format(new Date(settlement.submittedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  className: "text-right",
                  render: (settlement) => (
                    <div className="flex items-center justify-end gap-1">
                      {settlement.status === "aprovado" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                          disabled={generatingPDF === settlement.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            generateSettlementPDF(settlement);
                          }}
                          data-testid={`button-pdf-settlement-${settlement.id}`}
                        >
                          {generatingPDF === settlement.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                          PDF
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); openDetails(settlement); }}
                        data-testid={`button-view-settlement-${settlement.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filteredSettlements}
              isLoading={isLoading}
              keyField="id"
              onRowClick={openDetails}
              emptyMessage={
                activeTab === "pending"
                  ? "Não há prestações aguardando análise no momento"
                  : "Nenhuma prestação de contas registrada"
              }
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Prestação de Contas - {selectedSettlement?.transport?.requestNumber}
            </DialogTitle>
            <DialogDescription>
              Analise os comprovantes enviados pelo motorista
            </DialogDescription>
          </DialogHeader>
          
          {selectedSettlement && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Informações do Transporte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Número OTD:</span>
                      <span className="font-mono font-bold">{selectedSettlement.transport?.requestNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chassi:</span>
                      <span className="font-mono">{selectedSettlement.transport?.vehicleChassi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origem:</span>
                      <span>{selectedSettlement.transport?.originYard?.name || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Destino:</span>
                      <span>
                        {selectedSettlement.transport?.deliveryLocation?.name} - 
                        {selectedSettlement.transport?.deliveryLocation?.city}/
                        {selectedSettlement.transport?.deliveryLocation?.state}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span>{selectedSettlement.transport?.client?.name || "-"}</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Motorista
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nome:</span>
                      <span className="font-medium">{selectedSettlement.driver?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPF:</span>
                      <span>{selectedSettlement.driver?.cpf}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span>{selectedSettlement.driver?.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modalidade:</span>
                      <Badge variant="outline">
                        {selectedSettlement.driver?.modality?.toUpperCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Resumo Financeiro
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                        Despesas Previstas
                        {selectedSettlement.associatedRoute && (
                          <span className="ml-1 font-normal text-blue-500 dark:text-blue-400 truncate">
                            — {selectedSettlement.associatedRoute.name}
                          </span>
                        )}
                      </p>
                      {selectedSettlement.associatedRoute ? (
                        selectedSettlement.associatedRoute.totalCost ? (
                          // Route uses a single total cost
                          <div className="flex justify-between text-xs font-bold border-t border-blue-200 dark:border-blue-700 mt-1 pt-1">
                            <span>Total:</span>
                            <span className="text-blue-700 dark:text-blue-300">
                              {formatCurrency(selectedSettlement.associatedRoute.totalCost)}
                            </span>
                          </div>
                        ) : (
                          // Route uses detailed costs
                          <>
                            {selectedSettlement.associatedRoute.fuelCost && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Combustível:</span>
                                <span className="font-medium">{formatCurrency(selectedSettlement.associatedRoute.fuelCost)}</span>
                              </div>
                            )}
                            {selectedSettlement.associatedRoute.tollCost && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Pedágios:</span>
                                <span className="font-medium">{formatCurrency(selectedSettlement.associatedRoute.tollCost)}</span>
                              </div>
                            )}
                            {selectedSettlement.associatedRoute.driverDailyCost && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Hotel / Diária:</span>
                                <span className="font-medium">{formatCurrency(selectedSettlement.associatedRoute.driverDailyCost)}</span>
                              </div>
                            )}
                            {selectedSettlement.associatedRoute.foodCost && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Alimentação:</span>
                                <span className="font-medium">{formatCurrency(selectedSettlement.associatedRoute.foodCost)}</span>
                              </div>
                            )}
                            {selectedSettlement.associatedRoute.othersCost && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Outros:</span>
                                <span className="font-medium">{formatCurrency(selectedSettlement.associatedRoute.othersCost)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs font-bold border-t border-blue-200 dark:border-blue-700 mt-1 pt-1">
                              <span>Total:</span>
                              <span className="text-blue-700 dark:text-blue-300">
                                {formatCurrency((
                                  parseFloat(selectedSettlement.associatedRoute.fuelCost || "0") +
                                  parseFloat(selectedSettlement.associatedRoute.tollCost || "0") +
                                  parseFloat(selectedSettlement.associatedRoute.driverDailyCost || "0") +
                                  parseFloat(selectedSettlement.associatedRoute.foodCost || "0") +
                                  parseFloat(selectedSettlement.associatedRoute.othersCost || "0")
                                ).toString())}
                              </span>
                            </div>
                          </>
                        )
                      ) : (
                        // Fallback: use transport estimated values
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Pedágios:</span>
                            <span className="font-medium">{formatCurrency(selectedSettlement.estimatedTolls)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Combustível:</span>
                            <span className="font-medium">{formatCurrency(selectedSettlement.estimatedFuel)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold border-t border-blue-200 dark:border-blue-700 mt-1 pt-1">
                            <span>Total:</span>
                            <span className="text-blue-700 dark:text-blue-300">
                              {formatCurrency((parseFloat(selectedSettlement.estimatedTolls || "0") + parseFloat(selectedSettlement.estimatedFuel || "0")).toString())}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Despesas Realizadas</p>
                      {(() => {
                        const getEffective = (i: any) =>
                          i.itemStatus === "aprovado"
                            ? parseFloat(i.approvedAmount || "0")
                            : i.itemStatus === "reprovado"
                            ? 0
                            : parseFloat(i.amount || "0");
                        const allItems = selectedSettlement.items || [];
                        const toll  = allItems.filter(i => i.type === "pedagio").reduce((s, i) => s + getEffective(i), 0);
                        const fuel  = allItems.filter(i => i.type === "combustivel").reduce((s, i) => s + getEffective(i), 0);
                        const hotel = allItems.filter(i => i.type === "hospedagem").reduce((s, i) => s + getEffective(i), 0);
                        const food  = allItems.filter(i => i.type === "alimentacao").reduce((s, i) => s + getEffective(i), 0);
                        const others= allItems.filter(i => !["pedagio","combustivel","hospedagem","alimentacao","passagem"].includes(i.type || "")).reduce((s, i) => s + getEffective(i), 0);
                        const total = toll + fuel + hotel + food + others;
                        return (
                          <>
                            {toll  > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pedágios:</span><span className="font-medium">{formatCurrency(toll.toString())}</span></div>}
                            {fuel  > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Combustível:</span><span className="font-medium">{formatCurrency(fuel.toString())}</span></div>}
                            {hotel > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Hotel:</span><span className="font-medium">{formatCurrency(hotel.toString())}</span></div>}
                            {food  > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Alimentação:</span><span className="font-medium">{formatCurrency(food.toString())}</span></div>}
                            {others> 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Outras:</span><span className="font-medium">{formatCurrency(others.toString())}</span></div>}
                            {total === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma despesa registrada</p>}
                            <div className="flex justify-between text-xs font-bold border-t border-green-200 dark:border-green-700 mt-1 pt-1">
                              <span>Total:</span>
                              <span className="text-green-700 dark:text-green-300">{formatCurrency(total.toString())}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Custo com Motorista */}
                  {selectedSettlement.driverCost != null && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Custo com Motorista
                        {selectedSettlement.travelRateInfo && (
                          <span className="font-normal text-amber-600 dark:text-amber-400 ml-1">
                            — {selectedSettlement.travelRateInfo.name}
                          </span>
                        )}
                      </p>
                      {selectedSettlement.travelRateInfo && (
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            {selectedSettlement.travelRateInfo.rateType === "por_km"
                              ? `${selectedSettlement.transport?.routeDistanceKm ?? "?"} km × R$ ${parseFloat(selectedSettlement.travelRateInfo.rateValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/km`
                              : selectedSettlement.travelRateInfo.rateType === "por_veiculo"
                              ? "Valor fixo por veículo"
                              : "Valor fixo"}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-amber-200 dark:border-amber-700 mt-1 pt-1">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Total:</span>
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-300" data-testid="text-driver-cost">
                          {formatCurrency(selectedSettlement.driverCost)}
                        </span>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const approvedItems = selectedSettlement.items?.filter(i => (i as any).itemStatus === "aprovado") || [];
                    const totalComprovado = approvedItems.reduce((sum, i) => sum + parseFloat((i as any).approvedAmount || "0"), 0);
                    const totalItens = selectedSettlement.items?.length || 0;
                    const totalAprovados = approvedItems.length;
                    const totalReprovados = selectedSettlement.items?.filter(i => (i as any).itemStatus === "reprovado").length || 0;
                    const totalPendentes = totalItens - totalAprovados - totalReprovados;
                    
                    return totalItens > 0 ? (
                      <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-700">
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">Total Comprovado (itens aprovados)</p>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">
                            {totalAprovados}/{totalItens} aprovados
                            {totalReprovados > 0 && <span className="text-destructive ml-1">· {totalReprovados} reprovados</span>}
                            {totalPendentes > 0 && <span className="text-orange-500 ml-1">· {totalPendentes} pendentes</span>}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                            {formatCurrency(totalComprovado.toString())}
                          </span>
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>Distância: <strong>{selectedSettlement.routeDistance || "-"}</strong></span>
                    {selectedSettlement.driverNotes && (
                      <span className="truncate max-w-[200px]" title={selectedSettlement.driverNotes}>
                        Obs: {selectedSettlement.driverNotes}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Comparativo: Previsto x Real
                    {selectedSettlement.associatedRoute && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        — Rota: {selectedSettlement.associatedRoute.name}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const route = selectedSettlement.associatedRoute;
                    const items = selectedSettlement.items || [];

                    // ---- PREVISTO: from associated route ----
                    const plannedFuel     = parseFloat(route?.fuelCost || "0");
                    const plannedTolls    = parseFloat(route?.tollCost || "0");
                    const plannedHotel    = parseFloat(route?.driverDailyCost || "0");
                    const plannedFood     = parseFloat(route?.foodCost || "0");
                    const plannedOthers   = parseFloat(route?.othersCost || "0");
                    // If route uses a single totalCost, use it as the only planned figure
                    const routeTotalCost  = route?.totalCost ? parseFloat(route.totalCost) : null;
                    const plannedTotal = routeTotalCost !== null
                      ? routeTotalCost
                      : plannedFuel + plannedTolls + plannedHotel + plannedFood + plannedOthers;

                    // Fall back to transport estimates when no route is linked
                    const fallbackTolls = parseFloat(selectedSettlement.estimatedTolls || "0");
                    const fallbackFuel  = parseFloat(selectedSettlement.estimatedFuel  || "0");
                    const fallbackTotal = fallbackTolls + fallbackFuel;

                    // ---- REAL: from driver-submitted items ----
                    // Use approvedAmount when item is approved; use amount for pending; exclude reprovado
                    const getEffectiveAmt = (i: any) =>
                      i.itemStatus === "aprovado"
                        ? parseFloat(i.approvedAmount || "0")
                        : i.itemStatus === "reprovado"
                        ? 0
                        : parseFloat(i.amount || "0");

                    const realFuel    = items.filter(i => i.type === "combustivel").reduce((s, i) => s + getEffectiveAmt(i), 0);
                    const realTolls   = items.filter(i => i.type === "pedagio").reduce((s, i) => s + getEffectiveAmt(i), 0);
                    const realHotel   = items.filter(i => i.type === "hospedagem").reduce((s, i) => s + getEffectiveAmt(i), 0);
                    const realFood    = items.filter(i => i.type === "alimentacao").reduce((s, i) => s + getEffectiveAmt(i), 0);
                    const realOthers  = items.filter(i => i.type === "outros").reduce((s, i) => s + getEffectiveAmt(i), 0);
                    const realTotal   = realFuel + realTolls + realHotel + realFood + realOthers;

                    const diffTotal = realTotal - (route ? plannedTotal : fallbackTotal);
                    const baseTotal = route ? plannedTotal : fallbackTotal;
                    const pctTotal  = baseTotal > 0 ? ((diffTotal / baseTotal) * 100) : (realTotal > 0 ? 100 : 0);

                    const isDiscrepant = (pct: number) => Math.abs(pct) > 20;
                    const getColor = (diff: number, pct: number) => {
                      if (Math.abs(pct) <= 10) return "text-green-600";
                      if (diff > 0) return Math.abs(pct) > 20 ? "text-red-600" : "text-orange-500";
                      return "text-green-600";
                    };
                    const getBgColor = (diff: number, pct: number) => {
                      if (Math.abs(pct) <= 10) return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
                      if (diff > 0) return Math.abs(pct) > 20 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
                      return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
                    };

                    type CompRow = { label: string; icon: any; planned: number; real: number };

                    // When route uses a single totalCost, show only one total row
                    const rows: CompRow[] = route
                      ? routeTotalCost !== null
                        ? [{ label: "Total Previsto (Rota)", icon: DollarSign, planned: routeTotalCost, real: realTotal }]
                        : [
                            { label: "Combustível",   icon: Fuel,    planned: plannedFuel,   real: realFuel   },
                            { label: "Pedágios",      icon: Receipt, planned: plannedTolls,  real: realTolls  },
                            { label: "Hotel / Diária",icon: Hotel,   planned: plannedHotel,  real: realHotel  },
                            { label: "Alimentação",   icon: Utensils,planned: plannedFood,   real: realFood   },
                            { label: "Outros",        icon: Receipt, planned: plannedOthers, real: realOthers },
                          ].filter(r => r.planned > 0 || r.real > 0)
                      : [
                          { label: "Pedágios",    icon: Receipt, planned: fallbackTolls, real: realTolls },
                          { label: "Combustível", icon: Fuel,    planned: fallbackFuel,  real: realFuel  },
                          ...(realHotel + realFood + realOthers > 0
                            ? [{ label: "Outras Despesas", icon: Receipt, planned: 0, real: realHotel + realFood + realOthers }]
                            : []),
                        ];

                    return (
                      <div className="space-y-4">
                        {!route && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                            Nenhuma rota cadastrada associada a este transporte. Exibindo estimativas do transporte.
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 font-medium">Categoria</th>
                                <th className="text-right py-2 font-medium">Previsto</th>
                                <th className="text-right py-2 font-medium">Real</th>
                                <th className="text-right py-2 font-medium">Diferença</th>
                                <th className="text-right py-2 font-medium">%</th>
                                <th className="text-center py-2 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const diff = row.real - row.planned;
                                const pct  = row.planned > 0 ? ((diff / row.planned) * 100) : (row.real > 0 ? 100 : 0);
                                const IconComp = row.icon;
                                return (
                                  <tr key={row.label} className="border-b">
                                    <td className="py-3">
                                      <div className="flex items-center gap-2">
                                        <IconComp className="h-4 w-4 text-muted-foreground" />
                                        {row.label}
                                      </div>
                                    </td>
                                    <td className="text-right py-3">
                                      {row.planned > 0 ? formatCurrency(row.planned.toString()) : <span className="text-muted-foreground">-</span>}
                                    </td>
                                    <td className="text-right py-3 font-medium">{formatCurrency(row.real.toString())}</td>
                                    <td className={`text-right py-3 font-medium ${row.planned > 0 ? getColor(diff, pct) : "text-orange-500"}`}>
                                      {diff >= 0 ? "+" : ""}{formatCurrency(diff.toString())}
                                    </td>
                                    <td className={`text-right py-3 font-medium ${row.planned > 0 ? getColor(diff, pct) : "text-orange-500"}`}>
                                      {row.planned > 0 ? `${diff >= 0 ? "+" : ""}${pct.toFixed(1)}%` : "-"}
                                    </td>
                                    <td className="text-center py-3">
                                      {row.planned === 0 ? (
                                        <Badge variant="secondary" className="gap-1">Extra</Badge>
                                      ) : isDiscrepant(pct) ? (
                                        <Badge variant="destructive" className="gap-1">
                                          <AlertTriangle className="h-3 w-3" />Discrepante
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                                          <CheckCircle className="h-3 w-3" />OK
                                        </Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className={`border-t-2 ${getBgColor(diffTotal, pctTotal)}`}>
                                <td className="py-3 font-bold">TOTAL</td>
                                <td className="text-right py-3 font-bold">{formatCurrency(baseTotal.toString())}</td>
                                <td className="text-right py-3 font-bold">{formatCurrency(realTotal.toString())}</td>
                                <td className={`text-right py-3 font-bold ${getColor(diffTotal, pctTotal)}`}>
                                  {diffTotal >= 0 ? "+" : ""}{formatCurrency(diffTotal.toString())}
                                </td>
                                <td className={`text-right py-3 font-bold ${getColor(diffTotal, pctTotal)}`}>
                                  {baseTotal > 0 ? `${diffTotal >= 0 ? "+" : ""}${pctTotal.toFixed(1)}%` : "-"}
                                </td>
                                <td className="text-center py-3">
                                  {isDiscrepant(pctTotal) ? (
                                    <Badge variant="destructive" className="gap-1">
                                      <AlertTriangle className="h-3 w-3" />Atenção
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                                      <CheckCircle className="h-3 w-3" />Dentro do Esperado
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        
                        {isDiscrepant(pctTotal) && (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-red-800 dark:text-red-200">Valores Discrepantes Detectados</p>
                                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                                  O total das despesas reais está {pctTotal > 0 ? "acima" : "abaixo"} do previsto em {Math.abs(pctTotal).toFixed(1)}%.
                                  Considere revisar os comprovantes antes de aprovar.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {!isDiscrepant(pctTotal) && Math.abs(pctTotal) <= 10 && baseTotal > 0 && (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-green-800 dark:text-green-200">Valores Dentro do Esperado</p>
                                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                                  As despesas reais estão dentro da margem de 10% do previsto pela rota.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Adiantamento e Saldo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const approvedItemsForBalance = selectedSettlement.items?.filter(i => (i as any).itemStatus === "aprovado") || [];
                    const totalComprovadoForBalance = approvedItemsForBalance.reduce((sum, i) => sum + parseFloat((i as any).approvedAmount || "0"), 0);
                    // Prioridade: valor local editado > valor salvo na PC > valor da proposta de transporte
                    const proposalAdvance = (selectedSettlement as any).proposalAdvanceAmount;
                    const proposalMethod = (selectedSettlement as any).proposalAdvanceMethod;
                    const savedAdvance = selectedSettlement.advanceAmount || proposalAdvance || "0";
                    const currentAdvance = localAdvanceAmount !== "" ? localAdvanceAmount : savedAdvance;
                    const advanceAmount = parseFloat(currentAdvance);
                    // Fórmula: Adiantamento - Total Comprovado
                    // Positivo → motorista deve devolver à empresa
                    // Negativo → empresa deve pagar ao motorista
                    const balance = advanceAmount - totalComprovadoForBalance;

                    const methodLabels: Record<string, string> = {
                      dinheiro: "Dinheiro",
                      cartao: "Cartão",
                      credito_conta: "Crédito em conta",
                    };
                    
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="advance-amount" className="text-sm font-medium">
                              Valor Adiantado (R$)
                            </Label>
                            <Input
                              id="advance-amount"
                              type="number"
                              step="0.01"
                              min="0"
                              value={localAdvanceAmount !== "" ? localAdvanceAmount : (selectedSettlement.advanceAmount || proposalAdvance || "")}
                              onChange={(e) => {
                                const value = e.target.value;
                                setLocalAdvanceAmount(value);
                                debouncedUpdateAdvance(selectedSettlement.id, value);
                              }}
                              placeholder="0,00"
                              className="mt-1"
                              data-testid="input-advance-amount"
                            />
                            {proposalAdvance && !selectedSettlement.advanceAmount && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Preenchido automaticamente da proposta de transporte
                              </p>
                            )}
                            {proposalMethod && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                Forma: {methodLabels[proposalMethod] || proposalMethod}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Total Comprovado</Label>
                            <div className="mt-1 p-2 bg-muted rounded-md text-lg font-semibold text-purple-700 dark:text-purple-300">
                              R$ {totalComprovadoForBalance.toFixed(2).replace(".", ",")}
                            </div>
                          </div>
                        </div>
                        
                        <div className={`p-4 rounded-lg border-2 ${
                          balance > 0 
                            ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700" 
                            : balance < 0 
                              ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                              : "bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700"
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">
                                {balance > 0 ? "Motorista deve devolver à empresa" : balance < 0 ? "Motorista deve receber da empresa" : "Saldo zerado"}
                              </p>
                              <p className={`text-2xl font-bold ${
                                balance > 0 
                                  ? "text-orange-600 dark:text-orange-400" 
                                  : balance < 0 
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-gray-600 dark:text-gray-400"
                              }`}>
                                R$ {Math.abs(balance).toFixed(2).replace(".", ",")}
                              </p>
                            </div>
                            <div className={`p-3 rounded-full ${
                              balance > 0 
                                ? "bg-orange-100 dark:bg-orange-800" 
                                : balance < 0 
                                  ? "bg-green-100 dark:bg-green-800"
                                  : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                              {balance > 0 ? (
                                <RotateCcw className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                              ) : balance < 0 ? (
                                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                              ) : (
                                <CheckCircle className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Adiantamento (R$ {advanceAmount.toFixed(2).replace(".", ",")}) − Total Comprovado (R$ {totalComprovadoForBalance.toFixed(2).replace(".", ",")})
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Comprovantes ({selectedSettlement.items?.length || 0})
                    </CardTitle>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddItemDialog(true)}
                      data-testid="button-add-expense-item"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Despesa
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedSettlement.items?.length ? (
                    <div className="text-center py-8">
                      <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">Nenhum comprovante adicionado</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setShowAddItemDialog(true)}
                        data-testid="button-add-first-expense"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar primeira despesa
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedSettlement.items.map((item) => {
                        const typeConfig = expenseTypeLabels[item.type] || expenseTypeLabels.outros;
                        const TypeIcon = typeConfig.icon;
                        const hasIssue = (item as any).photoStatus !== "ok";
                        const itemStatus = (item as any).itemStatus || "pendente";
                        const approvedAmount = (item as any).approvedAmount;
                        const isApproving = approvingItemId === item.id;
                        
                        const borderClass = itemStatus === "aprovado"
                          ? "border-green-500"
                          : itemStatus === "reprovado"
                          ? "border-destructive"
                          : hasIssue
                          ? "border-orange-400"
                          : "";
                        
                        return (
                          <Card 
                            key={item.id} 
                            className={`overflow-hidden ${borderClass}`}
                          >
                            <div 
                              className="aspect-video bg-muted relative cursor-pointer group"
                              onClick={() => setLightboxPhoto(normalizeImageUrl(item.photoUrl))}
                            >
                              <img
                                src={normalizeImageUrl(item.photoUrl)}
                                alt={typeConfig.label}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  e.currentTarget.nextElementSibling?.classList.remove("hidden");
                                }}
                              />
                              <div className="hidden absolute inset-0 flex items-center justify-center">
                                <ImageOff className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="h-6 w-6 text-white" />
                              </div>
                              <div className="absolute top-2 right-2 flex gap-1">
                                {itemStatus === "aprovado" && (
                                  <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0.5">
                                    <Check className="h-3 w-3 mr-0.5" /> Aprovado
                                  </Badge>
                                )}
                                {itemStatus === "reprovado" && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                                    <X className="h-3 w-3 mr-0.5" /> Reprovado
                                  </Badge>
                                )}
                                {hasIssue && itemStatus === "pendente" && (
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] px-1.5 py-0.5">
                                    {(item as any).photoStatus}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1">
                                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-xs font-medium">{typeConfig.label}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteItemMutation.mutate(item.id);
                                  }}
                                  data-testid={`button-delete-item-${item.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              {(() => {
                                const countryCode = (item as any).country
                                  || currencyToCountry[item.currency || "BRL"]
                                  || "BR";
                                const countryInfo = countryConfig[countryCode] || { label: countryCode, flag: "🌍" };
                                return (
                                  <div className="flex items-center gap-1.5 mb-1.5" data-testid={`text-country-${item.id}`}>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 font-normal">
                                      <span className="text-sm leading-none">{countryInfo.flag}</span>
                                      <span>{countryInfo.label}</span>
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      {item.currency || "BRL"}
                                    </span>
                                  </div>
                                );
                              })()}

                              {item.description && (
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                  {item.description}
                                </p>
                              )}

                              {itemStatus === "aprovado" && approvedAmount && (
                                <p className="font-bold text-green-600 text-sm mb-1">
                                  {formatCurrency(approvedAmount, "BRL")}
                                  <span className="text-xs text-muted-foreground font-normal ml-1">comprovado</span>
                                </p>
                              )}

                              {isApproving ? (
                                <div className="space-y-1.5 mt-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Valor (R$)"
                                    value={approvingAmount}
                                    onChange={(e) => setApprovingAmount(e.target.value)}
                                    className="h-7 text-xs"
                                    autoFocus
                                    data-testid={`input-approve-amount-${item.id}`}
                                  />
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      className="h-7 flex-1 text-xs bg-green-600 hover:bg-green-700"
                                      disabled={!approvingAmount || updateItemStatusMutation.isPending}
                                      onClick={() => updateItemStatusMutation.mutate({
                                        itemId: item.id,
                                        itemStatus: "aprovado",
                                        approvedAmount: approvingAmount,
                                      })}
                                      data-testid={`button-confirm-approve-${item.id}`}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Confirmar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => { setApprovingItemId(null); setApprovingAmount(""); }}
                                      data-testid={`button-cancel-approve-${item.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-1 mt-1">
                                  <Button
                                    size="sm"
                                    variant={itemStatus === "aprovado" ? "default" : "outline"}
                                    className={`h-7 flex-1 text-xs ${itemStatus === "aprovado" ? "bg-green-600 hover:bg-green-700 text-white" : "hover:bg-green-50 hover:border-green-500 hover:text-green-700"}`}
                                    disabled={updateItemStatusMutation.isPending}
                                    onClick={() => {
                                      setApprovingItemId(item.id);
                                      setApprovingAmount(approvedAmount || "");
                                    }}
                                    data-testid={`button-approve-item-${item.id}`}
                                  >
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                    {itemStatus === "aprovado" ? "Aprovado" : "Aprovar"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={itemStatus === "reprovado" ? "destructive" : "outline"}
                                    className={`h-7 flex-1 text-xs ${itemStatus !== "reprovado" ? "hover:bg-red-50 hover:border-red-400 hover:text-red-700" : ""}`}
                                    disabled={updateItemStatusMutation.isPending}
                                    onClick={() => updateItemStatusMutation.mutate({
                                      itemId: item.id,
                                      itemStatus: itemStatus === "reprovado" ? "pendente" : "reprovado",
                                    })}
                                    data-testid={`button-reject-item-${item.id}`}
                                  >
                                    <ThumbsDown className="h-3 w-3 mr-1" />
                                    {itemStatus === "reprovado" ? "Reprovado" : "Reprovar"}
                                  </Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedSettlement.status === "devolvido" && selectedSettlement.returnReason && (
                <Card className="border-destructive">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Motivo da Devolução
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{selectedSettlement.returnReason}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            {selectedSettlement && selectedSettlement.status !== "aprovado" && selectedSettlement.status !== "assinado" && (
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                data-testid="button-approve-settlement"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprovar Prestação
              </Button>
            )}
            {selectedSettlement?.status === "aprovado" && (
              <Button
                variant="outline"
                data-testid="button-generate-document"
                disabled={generatingPDF === selectedSettlement?.id}
                onClick={() => selectedSettlement && generateSettlementPDF(selectedSettlement)}
              >
                {generatingPDF === selectedSettlement?.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Gerar PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Devolver Prestação de Contas
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da devolução para o motorista
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="return-reason">Motivo da Devolução</Label>
              <Textarea
                id="return-reason"
                placeholder="Ex: Foto do comprovante de pedágio está ilegível. Por favor, envie uma foto mais nítida."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                data-testid="textarea-return-reason"
              />
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                O motorista receberá uma notificação no aplicativo informando que precisa corrigir e reenviar a prestação de contas.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReturn}
              disabled={returnMutation.isPending || !returnReason.trim()}
              data-testid="button-confirm-return"
            >
              {returnMutation.isPending ? "Enviando..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {lightboxPhoto && (
            <img
              src={lightboxPhoto}
              alt="Comprovante"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Prestação de Contas</DialogTitle>
            <DialogDescription>
              Crie uma prestação de contas com as despesas e comprovantes do transporte.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-transport">Transporte (OTD) *</Label>
                <Select 
                  value={newSettlement.transportId} 
                  onValueChange={(value) => {
                    const transport = transports?.find(t => t.id === value);
                    setNewSettlement({ 
                      ...newSettlement, 
                      transportId: value,
                      driverId: transport?.driverId || ""
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-transport">
                    <SelectValue placeholder="Selecione um transporte" />
                  </SelectTrigger>
                  <SelectContent>
                    {transports?.filter(t => 
                      (t.status === "entregue" || t.status === "em_transito") && 
                      !settlements?.some(s => s.transportId === t.id)
                    ).map((transport) => (
                      <SelectItem key={transport.id} value={transport.id}>
                        {transport.requestNumber} - {transport.vehicleChassi}
                        {transport.status === "em_transito" && (
                          <span className="ml-1 text-xs text-amber-600">(Em trânsito)</span>
                        )}
                      </SelectItem>
                    ))}
                    {transports?.filter(t => 
                      (t.status === "entregue" || t.status === "em_transito") && 
                      !settlements?.some(s => s.transportId === t.id)
                    ).length === 0 && (
                      <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                        Nenhum transporte em trânsito ou entregue disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-driver">Motorista *</Label>
                <Select 
                  value={newSettlement.driverId} 
                  onValueChange={(value) => setNewSettlement({ ...newSettlement, driverId: value })}
                >
                  <SelectTrigger data-testid="select-driver">
                    <SelectValue placeholder="Selecione um motorista" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers?.filter(d => d.isActive === "true").map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Despesas ({newSettlement.items.length})
                </h3>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={addNewSettlementItem}
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Despesa
                </Button>
              </div>

              {newSettlement.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma despesa adicionada</p>
                  <p className="text-xs">Clique em "Adicionar Despesa" para incluir comprovantes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {newSettlement.items.map((item, index) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-24 shrink-0">
                          {item.photoUrl ? (
                            <div className="relative w-full h-full">
                              <img 
                                src={normalizeImageUrl(item.photoUrl)} 
                                alt="Comprovante" 
                                className="w-full h-full object-cover rounded-lg border"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-5 w-5"
                                onClick={() => updateNewSettlementItem(index, "photoUrl", "")}
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <label className="cursor-pointer block w-full h-full border-2 border-dashed rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleNewSettlementItemPhoto(e, index)}
                                disabled={uploadingItemIndex === index}
                                data-testid={`input-photo-${index}`}
                              />
                              {uploadingItemIndex === index ? (
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              ) : (
                                <div className="text-center">
                                  <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Foto</span>
                                </div>
                              )}
                            </label>
                          )}
                        </div>

                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">País/Moeda *</Label>
                            <Select 
                              value={item.currency || "BRL"} 
                              onValueChange={(value) => updateNewSettlementItem(index, "currency", value)}
                            >
                              <SelectTrigger className="h-9" data-testid={`select-currency-${index}`}>
                                <SelectValue placeholder="Moeda" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(currencyConfig).map(([code, config]) => (
                                  <SelectItem key={code} value={code}>
                                    <span>{config.country}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Tipo *</Label>
                            <Select 
                              value={item.type} 
                              onValueChange={(value) => updateNewSettlementItem(index, "type", value)}
                            >
                              <SelectTrigger className="h-9" data-testid={`select-type-${index}`}>
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(expenseTypeLabels).map(([key, config]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      <config.icon className="h-3 w-3" />
                                      {config.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>


                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Observação</Label>
                            <Input
                              placeholder="Descrição da despesa..."
                              value={item.description}
                              onChange={(e) => updateNewSettlementItem(index, "description", e.target.value)}
                              className="h-9"
                              data-testid={`input-description-${index}`}
                            />
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeNewSettlementItem(index)}
                          data-testid={`button-remove-item-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-notes">Observações Gerais (opcional)</Label>
              <Textarea
                id="new-notes"
                placeholder="Adicione observações sobre a prestação de contas..."
                value={newSettlement.driverNotes}
                onChange={(e) => setNewSettlement({ ...newSettlement, driverNotes: e.target.value })}
                rows={2}
                data-testid="textarea-notes"
              />
            </div>

            {newSettlement.items.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium">Total das Despesas:</span>
                <span className="text-lg font-bold text-green-600">
                  {newSettlement.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewDialog(false);
              setNewSettlement({ transportId: "", driverId: "", driverNotes: "", items: [] });
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newSettlement)}
              disabled={
                createMutation.isPending || 
                !newSettlement.transportId || 
                !newSettlement.driverId || 
                newSettlement.items.length === 0 ||
                newSettlement.items.some(item => !item.type || !item.photoUrl)
              }
              data-testid="button-create-settlement"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Prestação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Despesa
            </DialogTitle>
            <DialogDescription>
              Adicione uma despesa com foto do comprovante
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Foto do Comprovante *</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {newItem.photoUrl ? (
                  <div className="relative">
                    <img 
                      src={normalizeImageUrl(newItem.photoUrl)} 
                      alt="Comprovante" 
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setNewItem(prev => ({ ...prev, photoUrl: "" }))}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto}
                      data-testid="input-expense-photo"
                    />
                    {isUploadingPhoto ? (
                      <div className="py-4">
                        <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">Enviando foto...</p>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">
                          Clique para enviar foto do comprovante
                        </p>
                      </div>
                    )}
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>País / Moeda *</Label>
              <Select 
                value={newItem.currency} 
                onValueChange={(value) => setNewItem(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger data-testid="select-expense-currency">
                  <SelectValue placeholder="Selecione o país/moeda" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(currencyConfig).map(([code, config]) => (
                    <SelectItem key={code} value={code}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.country}</span>
                        <span className="text-muted-foreground">({config.symbol})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Despesa *</Label>
              <Select 
                value={newItem.type} 
                onValueChange={(value) => setNewItem(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger data-testid="select-expense-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(expenseTypeLabels).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                placeholder="Descrição ou observação sobre esta despesa..."
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                data-testid="textarea-expense-description"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddItemDialog(false);
                setNewItem({ type: "", currency: "BRL", amount: "", photoUrl: "", description: "" });
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleAddItem}
              disabled={addItemMutation.isPending || !newItem.type || !newItem.photoUrl}
              data-testid="button-save-expense"
            >
              {addItemMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Despesa"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
