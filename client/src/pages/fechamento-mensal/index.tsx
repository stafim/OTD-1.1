import { useState, CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  Loader2,
  Printer,
  RefreshCw,
  CheckCircle2,
  Clock,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

interface VehicleItem {
  chassi: string;
  yardName: string;
  entryDate: string | null;
  totalDaysInPatio: number;
  daysInPeriod: number;
  graceDaysApplied: number;
  billableDays: number;
  subtotal: number;
}

interface ClientGroup {
  clientId: string | null;
  clientName: string;
  dailyCost: number;
  graceDays: number;
  vehicles: VehicleItem[];
  totalDays: number;
  totalCost: number;
  hasInvoice: boolean;
  invoice: any | null;
}

interface PreviewData {
  month: number;
  year: number;
  clientGroups: ClientGroup[];
  totalVehicles: number;
}

interface InvoiceWithItems {
  id: string;
  clientId: string | null;
  clientName: string;
  referenceMonth: number;
  referenceYear: number;
  totalValue: string;
  status: string;
  paymentDate: string | null;
  dailyCostSnapshot: string | null;
  graceDaysSnapshot: number | null;
  notes: string | null;
  generatedAt: string;
  items: {
    chassi: string;
    yardName: string | null;
    entryDate: string | null;
    totalDaysInPatio: number;
    daysInPeriod: number;
    graceDaysApplied: number;
    billableDays: number;
    dailyCost: string;
    subtotal: string;
  }[];
}

function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "-";
  }
}

function monthName(m: number): string {
  return MONTHS.find(x => x.value === m)?.label || String(m);
}

function fmtCur(value: number | string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch { return "-"; }
}

function fmtMonth(m: number): string {
  return MONTHS.find(x => x.value === m)?.label || String(m);
}

function buildInvoiceHTML(invoice: InvoiceWithItems): string {
  const items = invoice.items || [];
  const totalVehicles = items.length;
  const totalBillableDays = items.reduce((sum, i) => sum + (i.billableDays || 0), 0);
  const totalGraceDays = items.reduce((sum, i) => sum + (i.graceDaysApplied || 0), 0);
  const totalDaysInPeriod = items.reduce((sum, i) => sum + (i.daysInPeriod || 0), 0);
  const dailyCost = parseFloat(String(invoice.dailyCostSnapshot || 0));
  const statusLabel = invoice.status === "paid" ? "PAGO" : "PENDENTE";
  const statusColor = invoice.status === "paid" ? "#15803d" : "#b45309";
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const rowsHTML = items.map((item, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
    const graceCell = item.graceDaysApplied > 0
      ? `<td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};text-align:center;color:#b45309">-${item.graceDaysApplied}</td>`
      : `<td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};text-align:center;color:#9ca3af">-</td>`;
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};color:#9ca3af;width:24px">${i + 1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;background:${bg};font-family:monospace">${item.chassi}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg}">${item.yardName || "-"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg}">${fmtDate(item.entryDate)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};text-align:center">${item.daysInPeriod}</td>
      ${graceCell}
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};text-align:center;font-weight:bold">${item.billableDays}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};text-align:right;color:#6b7280">${fmtCur(dailyCost)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:${bg};text-align:right;font-weight:bold">${fmtCur(parseFloat(String(item.subtotal || 0)))}</td>
    </tr>`;
  }).join("");

  const obsHTML = items.some(i => i.graceDaysApplied > 0)
    ? `<div style="margin-top:16px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#78350f">
        <strong>Obs.:</strong> A carência de ${invoice.graceDaysSnapshot ?? 0} dia(s) é aplicada de forma cumulativa ao longo dos meses. Veículos que já consumiram sua carência em meses anteriores não recebem desconto adicional.
      </div>`
    : "";

  const paymentInfo = invoice.paymentDate ? ` (em ${fmtDate(invoice.paymentDate)})` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fatura - ${invoice.clientName} - ${fmtMonth(invoice.referenceMonth)}/${invoice.referenceYear}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; line-height: 1.5; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>
<div style="padding:32px 40px;max-width:900px;margin:0 auto">

  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px">
    <div>
      <div style="font-size:22px;font-weight:bold;color:#1e3a5f;letter-spacing:-0.5px">OTD Logistics</div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px">Gestão de Transporte e Pátio</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:20px;font-weight:bold;color:#1e3a5f">ESPELHO DE FATURA</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px">Referência: ${fmtMonth(invoice.referenceMonth).toUpperCase()} / ${invoice.referenceYear}</div>
      <div style="font-size:11px;color:#6b7280">Emissão: ${fmtDate(invoice.generatedAt)}</div>
      <div style="font-size:11px;margin-top:4px;font-weight:bold;color:${statusColor}">STATUS: ${statusLabel}${paymentInfo}</div>
    </div>
  </div>

  <div style="margin-bottom:20px">
    <div style="font-size:10px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Dados do Cliente</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Razão Social / Cliente</div>
        <div style="font-size:15px;font-weight:600;color:#111">${invoice.clientName}</div>
      </div>
      <div>
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Período de Referência</div>
        <div style="font-size:13px;font-weight:600;color:#111">${fmtMonth(invoice.referenceMonth)} / ${invoice.referenceYear}</div>
      </div>
    </div>
  </div>

  <div style="margin-bottom:20px">
    <div style="font-size:10px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Parâmetros de Cobrança</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Veículos em Pátio</div>
        <div style="font-size:18px;font-weight:bold;color:#1e3a5f;margin-top:2px">${totalVehicles}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:1px">unidades no período</div>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Diária Contratada</div>
        <div style="font-size:18px;font-weight:bold;color:#1e3a5f;margin-top:2px">${fmtCur(dailyCost)}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:1px">por veículo/dia</div>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Carência Aplicada</div>
        <div style="font-size:18px;font-weight:bold;color:#1e3a5f;margin-top:2px">${invoice.graceDaysSnapshot ?? 0}d</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:1px">${totalGraceDays} dias deduzidos</div>
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em">Dias Cobráveis</div>
        <div style="font-size:18px;font-weight:bold;color:#1e3a5f;margin-top:2px">${totalBillableDays}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:1px">de ${totalDaysInPeriod} dias no período</div>
      </div>
    </div>
  </div>

  <div style="margin-bottom:20px">
    <div style="font-size:10px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px">Detalhamento por Chassi</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">#</th>
          <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Chassi</th>
          <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Pátio</th>
          <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Dt. Entrada</th>
          <th style="text-align:center;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Dias no Período</th>
          <th style="text-align:center;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Carência Deduzida</th>
          <th style="text-align:center;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Dias Cobrados</th>
          <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Diária</th>
          <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:bold;color:#fff;background:#1e3a5f;text-transform:uppercase;letter-spacing:0.05em">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
      <tfoot>
        <tr style="background:#1e3a5f">
          <td colspan="4" style="padding:12px 10px;color:#fff;font-weight:normal;font-size:11px;text-align:left;opacity:0.8">
            ${totalVehicles} veículo${totalVehicles !== 1 ? "s" : ""} &bull; ${totalDaysInPeriod} dias no período &bull; ${totalGraceDays} de carência &bull; ${totalBillableDays} cobráveis
          </td>
          <td style="padding:12px 10px;color:#fff;font-weight:bold;font-size:13px;text-align:center">${totalDaysInPeriod}</td>
          <td style="padding:12px 10px;color:#fff;font-weight:bold;font-size:13px;text-align:center">${totalGraceDays > 0 ? `-${totalGraceDays}` : "-"}</td>
          <td style="padding:12px 10px;color:#fff;font-weight:bold;font-size:13px;text-align:center">${totalBillableDays}</td>
          <td style="padding:12px 10px;color:#fff;font-weight:bold;font-size:13px;text-align:right"></td>
          <td style="padding:12px 10px;color:#fff;font-weight:bold;font-size:15px;text-align:right">${fmtCur(parseFloat(String(invoice.totalValue || 0)))}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${obsHTML}

  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center">
    <div>Documento emitido pelo sistema OTD Logistics — ${today}</div>
    <div style="margin-top:4px">Este documento é um espelho de fatura para fins de conferência. Não substitui nota fiscal.</div>
  </div>
</div>
</body>
</html>`;
}

function printInvoice(invoice: InvoiceWithItems): void {
  const html = buildInvoiceHTML(invoice);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { document.body.removeChild(iframe); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const cleanup = () => { try { document.body.removeChild(iframe); } catch { /* already removed */ } };
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(cleanup, 1000);
    }
  };
}

function PrintableInvoice({ invoice }: { invoice: InvoiceWithItems }) {
  const items = invoice.items || [];
  const totalVehicles = items.length;
  const totalBillableDays = items.reduce((sum, i) => sum + (i.billableDays || 0), 0);
  const totalGraceDays = items.reduce((sum, i) => sum + (i.graceDaysApplied || 0), 0);
  const totalDaysInPeriod = items.reduce((sum, i) => sum + (i.daysInPeriod || 0), 0);
  const dailyCost = parseFloat(String(invoice.dailyCostSnapshot || 0));

  const s = {
    page: { fontFamily: "Arial, sans-serif", fontSize: "13px", color: "#111", lineHeight: "1.5", padding: "32px 40px", maxWidth: "900px", margin: "0 auto" } as CSSProperties,
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1e3a5f", paddingBottom: "16px", marginBottom: "24px" } as CSSProperties,
    logo: { fontSize: "22px", fontWeight: "bold", color: "#1e3a5f", letterSpacing: "-0.5px" } as CSSProperties,
    subtitle: { fontSize: "12px", color: "#6b7280", marginTop: "2px" } as CSSProperties,
    invoiceBox: { textAlign: "right" as const },
    invoiceTitle: { fontSize: "20px", fontWeight: "bold", color: "#1e3a5f" } as CSSProperties,
    invoiceDate: { fontSize: "11px", color: "#6b7280", marginTop: "2px" } as CSSProperties,
    section: { marginBottom: "20px" } as CSSProperties,
    sectionTitle: { fontSize: "10px", fontWeight: "bold", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px" } as CSSProperties,
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } as CSSProperties,
    grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "20px" } as CSSProperties,
    kpiBox: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "10px 14px" } as CSSProperties,
    kpiLabel: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em" } as CSSProperties,
    kpiValue: { fontSize: "18px", fontWeight: "bold", color: "#1e3a5f", marginTop: "2px" } as CSSProperties,
    kpiSub: { fontSize: "10px", color: "#9ca3af", marginTop: "1px" } as CSSProperties,
    fieldLabel: { fontSize: "10px", color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em" } as CSSProperties,
    fieldValue: { fontSize: "13px", fontWeight: "600", color: "#111" } as CSSProperties,
    table: { width: "100%", borderCollapse: "collapse" as const, marginBottom: "0" } as CSSProperties,
    th: { textAlign: "left" as const, padding: "8px 10px", fontSize: "10px", fontWeight: "bold", color: "#fff", background: "#1e3a5f", textTransform: "uppercase" as const, letterSpacing: "0.05em" } as CSSProperties,
    thCenter: { textAlign: "center" as const, padding: "8px 10px", fontSize: "10px", fontWeight: "bold", color: "#fff", background: "#1e3a5f", textTransform: "uppercase" as const, letterSpacing: "0.05em" } as CSSProperties,
    thRight: { textAlign: "right" as const, padding: "8px 10px", fontSize: "10px", fontWeight: "bold", color: "#fff", background: "#1e3a5f", textTransform: "uppercase" as const, letterSpacing: "0.05em" } as CSSProperties,
    tdEven: { padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "12px", background: "#fff" } as CSSProperties,
    tdOdd: { padding: "7px 10px", borderBottom: "1px solid #f3f4f6", fontSize: "12px", background: "#f9fafb" } as CSSProperties,
    tdCenter: { textAlign: "center" as const },
    tdRight: { textAlign: "right" as const },
    tdMono: { fontFamily: "monospace", fontSize: "11px" } as CSSProperties,
    totalRow: { background: "#1e3a5f" } as CSSProperties,
    totalTd: { padding: "12px 10px", color: "#fff", fontWeight: "bold", fontSize: "13px", textAlign: "right" as const } as CSSProperties,
    footer: { marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #e5e7eb", fontSize: "10px", color: "#9ca3af", textAlign: "center" as const } as CSSProperties,
    obs: { marginTop: "16px", padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "11px", color: "#78350f" } as CSSProperties,
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.logo}>OTD Logistics</div>
          <div style={s.subtitle}>Gestão de Transporte e Pátio</div>
        </div>
        <div style={s.invoiceBox}>
          <div style={s.invoiceTitle}>ESPELHO DE FATURA</div>
          <div style={{ ...s.invoiceDate }}>Referência: {monthName(invoice.referenceMonth).toUpperCase()} / {invoice.referenceYear}</div>
          <div style={{ ...s.invoiceDate }}>Emissão: {formatDate(invoice.generatedAt)}</div>
          <div style={{ ...s.invoiceDate, marginTop: "4px", fontWeight: "bold", color: invoice.status === "paid" ? "#15803d" : "#b45309" }}>
            STATUS: {invoice.status === "paid" ? "PAGO" : "PENDENTE"}
            {invoice.paymentDate && ` (em ${formatDate(invoice.paymentDate)})`}
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Dados do Cliente</div>
        <div style={s.grid2}>
          <div>
            <div style={s.fieldLabel}>Razão Social / Cliente</div>
            <div style={{ ...s.fieldValue, fontSize: "15px" }}>{invoice.clientName}</div>
          </div>
          <div>
            <div style={s.fieldLabel}>Período de Referência</div>
            <div style={s.fieldValue}>{monthName(invoice.referenceMonth)} / {invoice.referenceYear}</div>
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Parâmetros de Cobrança</div>
        <div style={s.grid4}>
          <div style={s.kpiBox}>
            <div style={s.kpiLabel}>Veículos em Pátio</div>
            <div style={s.kpiValue}>{totalVehicles}</div>
            <div style={s.kpiSub}>unidades no período</div>
          </div>
          <div style={s.kpiBox}>
            <div style={s.kpiLabel}>Diária Contratada</div>
            <div style={s.kpiValue}>{formatCurrency(dailyCost)}</div>
            <div style={s.kpiSub}>por veículo/dia</div>
          </div>
          <div style={s.kpiBox}>
            <div style={s.kpiLabel}>Carência Aplicada</div>
            <div style={s.kpiValue}>{invoice.graceDaysSnapshot ?? 0}d</div>
            <div style={s.kpiSub}>{totalGraceDays} dias deduzidos</div>
          </div>
          <div style={s.kpiBox}>
            <div style={s.kpiLabel}>Dias Cobráveis</div>
            <div style={s.kpiValue}>{totalBillableDays}</div>
            <div style={s.kpiSub}>de {totalDaysInPeriod} dias no período</div>
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sectionTitle}>Detalhamento por Chassi</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>Chassi</th>
              <th style={s.th}>Pátio</th>
              <th style={s.th}>Dt. Entrada</th>
              <th style={s.thCenter}>Dias no Período</th>
              <th style={s.thCenter}>Carência Deduzida</th>
              <th style={s.thCenter}>Dias Cobrados</th>
              <th style={s.thRight}>Diária</th>
              <th style={s.thRight}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const td = i % 2 === 0 ? s.tdEven : s.tdOdd;
              return (
                <tr key={item.chassi}>
                  <td style={{ ...td, color: "#9ca3af", width: "24px" }}>{i + 1}</td>
                  <td style={{ ...td, ...s.tdMono }}>{item.chassi}</td>
                  <td style={td}>{item.yardName || "-"}</td>
                  <td style={td}>{formatDate(item.entryDate)}</td>
                  <td style={{ ...td, ...s.tdCenter }}>{item.daysInPeriod}</td>
                  <td style={{ ...td, ...s.tdCenter, color: item.graceDaysApplied > 0 ? "#b45309" : "#9ca3af" }}>
                    {item.graceDaysApplied > 0 ? `-${item.graceDaysApplied}` : "-"}
                  </td>
                  <td style={{ ...td, ...s.tdCenter, fontWeight: "bold" }}>{item.billableDays}</td>
                  <td style={{ ...td, ...s.tdRight, color: "#6b7280" }}>{formatCurrency(dailyCost)}</td>
                  <td style={{ ...td, ...s.tdRight, fontWeight: "bold" }}>{formatCurrency(parseFloat(String(item.subtotal || 0)))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={s.totalRow}>
              <td colSpan={4} style={{ ...s.totalTd, textAlign: "left", fontWeight: "normal", fontSize: "11px", opacity: 0.8 }}>
                {totalVehicles} veículo{totalVehicles !== 1 ? "s" : ""} • {totalDaysInPeriod} dias no período • {totalGraceDays} de carência • {totalBillableDays} cobráveis
              </td>
              <td style={{ ...s.totalTd, ...s.tdCenter }}>{totalDaysInPeriod}</td>
              <td style={{ ...s.totalTd, ...s.tdCenter }}>{totalGraceDays > 0 ? `-${totalGraceDays}` : "-"}</td>
              <td style={{ ...s.totalTd, ...s.tdCenter }}>{totalBillableDays}</td>
              <td style={{ ...s.totalTd }}></td>
              <td style={{ ...s.totalTd, fontSize: "15px" }}>{formatCurrency(parseFloat(String(invoice.totalValue || 0)))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {items.some(i => i.graceDaysApplied > 0) && (
        <div style={s.obs}>
          <strong>Obs.:</strong> A carência de {invoice.graceDaysSnapshot ?? 0} dia(s) é aplicada de forma cumulativa ao longo dos meses.
          Veículos que já consumiram sua carência em meses anteriores não recebem desconto adicional.
        </div>
      )}

      <div style={s.footer}>
        <div>Documento emitido pelo sistema OTD Logistics — {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
        <div style={{ marginTop: "4px" }}>Este documento é um espelho de fatura para fins de conferência. Não substitui nota fiscal.</div>
      </div>
    </div>
  );
}

function ClientPreviewCard({ group, month, year, onGenerated }: {
  group: ClientGroup;
  month: number;
  year: number;
  onGenerated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<InvoiceWithItems | null>(null);
  const { toast } = useToast();

  const handlePrint = () => {
    if (!generatedInvoice) return;
    printInvoice(generatedInvoice);
  };

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/yard-closing/generate", {
      clientId: group.clientId,
      month,
      year,
    }),
    onSuccess: (data: InvoiceWithItems) => {
      toast({ title: "Fatura gerada com sucesso!" });
      setGeneratedInvoice(data);
      setShowPrint(true);
      onGenerated();
    },
    onError: () => {
      toast({ title: "Erro ao gerar fatura", variant: "destructive" });
    },
  });

  return (
    <>
      {generatedInvoice && (
        <Dialog open={showPrint} onOpenChange={setShowPrint}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Fatura gerada — {generatedInvoice.clientName} — {monthName(generatedInvoice.referenceMonth)}/{generatedInvoice.referenceYear}
              </DialogTitle>
            </DialogHeader>
            <PrintableInvoice invoice={generatedInvoice} />
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPrint(false)}>Fechar</Button>
              <Button onClick={handlePrint} data-testid="button-print-invoice">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir / Salvar PDF
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Card className="mb-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{group.clientName}</CardTitle>
                    {group.dailyCost === 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 text-xs font-normal">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Sem diária configurada
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {group.vehicles.length} veículo{group.vehicles.length !== 1 ? "s" : ""}
                    {group.dailyCost > 0
                      ? ` • Diária: ${formatCurrency(group.dailyCost)}`
                      : " • Configure a diária no cadastro do cliente"}
                    {group.graceDays > 0 && ` • Carência: ${group.graceDays}d`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{formatCurrency(group.totalCost)}</p>
                  <p className="text-xs text-muted-foreground">{group.totalDays} dias cobráveis</p>
                </div>
                {group.hasInvoice ? (
                  <Badge variant="secondary" className="text-green-600 border-green-300 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Faturado
                  </Badge>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={e => e.stopPropagation()}
                        disabled={generateMutation.isPending}
                        data-testid={`button-generate-invoice-${group.clientId || "no-client"}`}
                      >
                        {generateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileBarChart className="h-4 w-4" />
                        )}
                        <span className="ml-1">Gerar Fatura</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Gerar Fatura</AlertDialogTitle>
                        <AlertDialogDescription>
                          Confirma a geração da fatura de{" "}
                          <strong>{monthName(month)}/{year}</strong> para{" "}
                          <strong>{group.clientName}</strong>?
                          <br />
                          Os valores serão congelados neste momento.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => generateMutation.mutate()}>
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chassi</TableHead>
                  <TableHead>Pátio</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="text-center">Dias no período</TableHead>
                  <TableHead className="text-center">Carência</TableHead>
                  <TableHead className="text-center">Dias cobrados</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.vehicles.map(v => (
                  <TableRow key={v.chassi}>
                    <TableCell className="font-mono text-sm">{v.chassi}</TableCell>
                    <TableCell>{v.yardName}</TableCell>
                    <TableCell className="text-sm">{formatDate(v.entryDate)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{v.daysInPeriod}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {v.graceDaysApplied > 0 ? (
                        <Badge variant="secondary" className="text-amber-600">{v.graceDaysApplied}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={v.billableDays > 0 ? "default" : "secondary"}>{v.billableDays}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(v.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
    </>
  );
}

function InvoiceCard({ invoice, onStatusChange, onDelete }: {
  invoice: InvoiceWithItems;
  onStatusChange: () => void;
  onDelete: () => void;
}) {
  const [showPrint, setShowPrint] = useState(false);
  const { toast } = useToast();

  const { data: fullInvoice } = useQuery<InvoiceWithItems>({
    queryKey: [`/api/yard-closing/invoices/${invoice.id}`],
    enabled: showPrint,
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      apiRequest("PATCH", `/api/yard-closing/invoices/${invoice.id}/status`, { status: newStatus }),
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      onStatusChange();
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/yard-closing/invoices/${invoice.id}`),
    onSuccess: () => {
      toast({ title: "Fatura excluída" });
      onDelete();
    },
    onError: () => toast({ title: "Erro ao excluir fatura", variant: "destructive" }),
  });

  const handlePrint = () => {
    printInvoice(fullInvoice || invoice);
  };

  const displayInvoice = fullInvoice || invoice;
  const isPaid = invoice.status === "paid";

  return (
    <>
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Espelho de Fatura — {invoice.clientName} — {monthName(invoice.referenceMonth)}/{invoice.referenceYear}
            </DialogTitle>
          </DialogHeader>
          <PrintableInvoice invoice={displayInvoice} />
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPrint(false)}>Fechar</Button>
            <Button onClick={handlePrint} data-testid={`button-print-${invoice.id}`}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="mb-3">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">{invoice.clientName}</p>
                <p className="text-xs text-muted-foreground">
                  {monthName(invoice.referenceMonth)}/{invoice.referenceYear}
                  {" • "}Gerado em {formatDate(invoice.generatedAt)}
                  {invoice.dailyCostSnapshot && ` • Diária: ${formatCurrency(invoice.dailyCostSnapshot)}`}
                  {(invoice.graceDaysSnapshot ?? 0) > 0 && ` • Carência: ${invoice.graceDaysSnapshot}d`}
                </p>
                {isPaid && invoice.paymentDate && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Pago em {formatDate(invoice.paymentDate)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-primary">{formatCurrency(invoice.totalValue)}</p>
              <Badge
                variant={isPaid ? "default" : "secondary"}
                className={isPaid ? "bg-green-500 hover:bg-green-600" : "text-amber-600 border-amber-300 bg-amber-50"}
                data-testid={`badge-status-${invoice.id}`}
              >
                {isPaid ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" />PAGO</>
                ) : (
                  <><Clock className="h-3 w-3 mr-1" />PENDENTE</>
                )}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate(isPaid ? "pending" : "paid")}
                disabled={statusMutation.isPending}
                data-testid={`button-toggle-status-${invoice.id}`}
              >
                {statusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPaid ? (
                  "Estornar"
                ) : (
                  "Baixar Pgto."
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPrint(true)}
                data-testid={`button-print-invoice-${invoice.id}`}
              >
                <Printer className="h-4 w-4 mr-1" />
                NF/Relatório
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid={`button-delete-invoice-${invoice.id}`}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Fatura</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza? A fatura de <strong>{invoice.clientName}</strong> de{" "}
                      <strong>{monthName(invoice.referenceMonth)}/{invoice.referenceYear}</strong> será excluída
                      permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function FechamentoMensalPage() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [histMonth, setHistMonth] = useState<number | null>(null);
  const [histYear, setHistYear] = useState<number | null>(null);
  const { toast } = useToast();

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  const previewQueryKey = `/api/yard-closing/preview?month=${selectedMonth}&year=${selectedYear}`;

  const previewQuery = useQuery<PreviewData>({
    queryKey: [previewQueryKey],
  });

  const historyQueryKey = histMonth && histYear
    ? `/api/yard-closing/invoices?month=${histMonth}&year=${histYear}`
    : "/api/yard-closing/invoices";

  const historyQuery = useQuery<InvoiceWithItems[]>({
    queryKey: [historyQueryKey],
  });

  const handleGenerated = () => {
    queryClient.invalidateQueries({ queryKey: [previewQueryKey] });
    queryClient.invalidateQueries({ queryKey: [historyQueryKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/yard-closing/invoices"] });
  };

  const handleStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: [historyQueryKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/yard-closing/invoices"] });
  };

  const handleDelete = () => {
    queryClient.invalidateQueries({ queryKey: [historyQueryKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/yard-closing/invoices"] });
    queryClient.invalidateQueries({ queryKey: [previewQueryKey] });
  };

  const grandTotal = previewQuery.data?.clientGroups?.reduce((s, g) => s + g.totalCost, 0) ?? 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Fechamento Mensal de Pátio"
        breadcrumbs={[
          { label: "Financeiro", href: "/" },
          { label: "Fechamento Mensal" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="preview" data-testid="tab-preview">Prévia do Mês</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Faturas Geradas</TabsTrigger>
          </TabsList>

          {/* ========= PRÉVIA ========= */}
          <TabsContent value="preview">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Select
                value={String(selectedMonth)}
                onValueChange={v => setSelectedMonth(Number(v))}
              >
                <SelectTrigger className="w-40" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(selectedYear)}
                onValueChange={v => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-28" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => previewQuery.refetch()}
                disabled={previewQuery.isLoading}
                data-testid="button-refresh-preview"
              >
                <RefreshCw className={`h-4 w-4 ${previewQuery.isLoading ? "animate-spin" : ""}`} />
              </Button>

              {previewQuery.data?.clientGroups && (
                <div className="ml-auto flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {previewQuery.data.clientGroups.length} cliente(s) •{" "}
                    {previewQuery.data.clientGroups.reduce((s, g) => s + g.vehicles.length, 0)} veículo(s)
                  </span>
                  <span className="font-bold text-primary text-lg">{formatCurrency(grandTotal)}</span>
                </div>
              )}
            </div>

            {/* Warning banner when clients have no daily cost configured */}
            {previewQuery.data?.clientGroups && previewQuery.data.clientGroups.some(g => g.dailyCost === 0) && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Diária de pátio não configurada</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    {previewQuery.data.clientGroups.filter(g => g.dailyCost === 0).length} cliente(s) não têm a diária de pátio definida e estão com valor R$0,00.
                    Acesse <strong>Cadastros → Clientes</strong>, edite cada cliente e preencha o campo <strong>"Custo Diário de Pátio"</strong> para que o faturamento seja calculado corretamente.
                  </p>
                </div>
              </div>
            )}

            {previewQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : previewQuery.data?.clientGroups?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum veículo em estoque encontrado para{" "}
                  {monthName(selectedMonth)}/{selectedYear}.
                </CardContent>
              </Card>
            ) : (
              previewQuery.data?.clientGroups?.map(group => (
                <ClientPreviewCard
                  key={group.clientId || "no-client"}
                  group={group}
                  month={selectedMonth}
                  year={selectedYear}
                  onGenerated={handleGenerated}
                />
              ))
            )}
          </TabsContent>

          {/* ========= HISTÓRICO ========= */}
          <TabsContent value="history">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Select
                value={histMonth ? String(histMonth) : "all"}
                onValueChange={v => setHistMonth(v === "all" ? null : Number(v))}
              >
                <SelectTrigger className="w-40" data-testid="select-hist-month">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={histYear ? String(histYear) : "all"}
                onValueChange={v => setHistYear(v === "all" ? null : Number(v))}
              >
                <SelectTrigger className="w-28" data-testid="select-hist-year">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => historyQuery.refetch()}
                data-testid="button-refresh-history"
              >
                <RefreshCw className={`h-4 w-4 ${historyQuery.isLoading ? "animate-spin" : ""}`} />
              </Button>

              {Array.isArray(historyQuery.data) && (
                <div className="ml-auto text-sm text-muted-foreground">
                  {historyQuery.data.length} fatura(s)
                </div>
              )}
            </div>

            {historyQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : historyQuery.data?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma fatura gerada para o período selecionado.
                </CardContent>
              </Card>
            ) : (
              historyQuery.data?.map(inv => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
