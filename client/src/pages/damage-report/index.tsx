import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeImageUrl } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Truck,
  Package,
  Camera,
  Printer,
  Image,
  ChevronLeft,
  ChevronRight,
  Eye,
  User,
  Phone,
  MapPin,
  Navigation,
  Route,
  Clock,
  Calendar,
  Ruler,
  Fuel,
  BadgeInfo,
  FileDown,
} from "lucide-react";
import type { Collect, Transport, Manufacturer, Yard, Driver, Client, DeliveryLocation } from "@shared/schema";

interface CollectWithRelations extends Collect {
  manufacturer?: Manufacturer;
  yard?: Yard;
  driver?: Driver;
}

interface TransportWithRelations extends Transport {
  client?: Client;
  originYard?: Yard;
  deliveryLocation?: DeliveryLocation;
  driver?: Driver;
}

function getDamagePhotos(record: CollectWithRelations | TransportWithRelations): string[] {
  const photos: string[] = [];
  if (record.checkinDamagePhotos && Array.isArray(record.checkinDamagePhotos)) {
    photos.push(...record.checkinDamagePhotos.filter((p) => p && p.trim() !== ""));
  }
  if (record.checkoutDamagePhotos && Array.isArray(record.checkoutDamagePhotos)) {
    photos.push(...record.checkoutDamagePhotos.filter((p) => p && p.trim() !== ""));
  }
  return photos;
}

function getCheckinPhotos(record: CollectWithRelations | TransportWithRelations): string[] {
  if (record.checkinDamagePhotos && Array.isArray(record.checkinDamagePhotos)) {
    return record.checkinDamagePhotos.filter((p) => p && p.trim() !== "");
  }
  return [];
}

function getCheckoutPhotos(record: CollectWithRelations | TransportWithRelations): string[] {
  if (record.checkoutDamagePhotos && Array.isArray(record.checkoutDamagePhotos)) {
    return record.checkoutDamagePhotos.filter((p) => p && p.trim() !== "");
  }
  return [];
}

async function generateSinglePdf(
  rec: CollectWithRelations | TransportWithRelations,
  isCollect: boolean
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210, pageH = 297, margin = 15, contentW = 180;
  const orange: [number, number, number] = [234, 88, 12];
  const red: [number, number, number] = [220, 38, 38];
  const darkGray: [number, number, number] = [30, 30, 30];
  const medGray: [number, number, number] = [100, 100, 100];
  const white: [number, number, number] = [255, 255, 255];
  const blue: [number, number, number] = [37, 99, 235];

  let y = 0;
  let pageNum = 1;

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    try { return format(new Date(d as string), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return "—"; }
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 18) {
      doc.addPage(); pageNum++; drawFooter(); y = 15;
    }
  };

  const drawFooter = () => {
    doc.setFontSize(7); doc.setTextColor(...medGray); doc.setFont("helvetica", "normal");
    doc.text("OTD Logistics — Relatório de Avarias — Documento Confidencial", margin, pageH - 8);
    doc.text(`Pág. ${pageNum}`, pageW - margin, pageH - 8, { align: "right" });
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
  };

  const loadImg = async (url: string): Promise<string | null> => {
    if (!url || url.trim() === "") return null;
    try {
      const img = new window.Image(); img.crossOrigin = "anonymous";
      await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); img.src = normalizeImageUrl(url); });
      if (!img.complete || img.naturalWidth === 0) return null;
      const cvs = document.createElement("canvas");
      const maxSize = 800;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxSize || h > maxSize) { const r = Math.min(maxSize / w, maxSize / h); w = Math.round(w * r); h = Math.round(h * r); }
      cvs.width = w; cvs.height = h;
      const ctx = cvs.getContext("2d"); if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      return cvs.toDataURL("image/jpeg", 0.72);
    } catch { return null; }
  };

  const drawSect = (title: string, color: [number, number, number] = orange) => {
    checkPageBreak(12);
    doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...color);
    doc.text(title.toUpperCase(), margin, y);
    doc.setDrawColor(...color); doc.setLineWidth(0.35);
    doc.line(margin, y + 1.5, margin + contentW, y + 1.5); y += 8;
  };

  const drawField = (label: string, value: string, x: number, w: number) => {
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...medGray);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...darkGray);
    const maxC = Math.floor(w / 1.9);
    const v = (value || "—").length > maxC ? (value || "—").slice(0, maxC - 1) + "…" : (value || "—");
    doc.text(v, x, y + 5);
  };

  const renderPhotoGrid = async (photos: Array<{ url: string; label: string }>, isDamage = false) => {
    const valid = photos.filter(p => p.url && p.url.trim() !== "");
    if (valid.length === 0) return;
    const photoW = 40, photoH = 30, labelH = 5, gap = 3;
    const perRow = Math.floor(contentW / (photoW + gap));
    let col = 0;
    for (const { url, label } of valid) {
      if (col === 0) checkPageBreak(photoH + labelH + gap + 4);
      const px = margin + col * (photoW + gap);
      const dataUrl = await loadImg(url);
      if (isDamage) {
        doc.setFillColor(255, 240, 240); doc.rect(px - 1, y - 1, photoW + 2, photoH + labelH + 3, "F");
        doc.setDrawColor(...red); doc.setLineWidth(0.5); doc.rect(px - 1, y - 1, photoW + 2, photoH + labelH + 3);
      }
      if (dataUrl) {
        doc.addImage(dataUrl, "JPEG", px, y, photoW, photoH);
        if (!isDamage) { doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.rect(px, y, photoW, photoH); }
      } else {
        doc.setFillColor(238, 238, 238); doc.rect(px, y, photoW, photoH, "F");
        doc.setFontSize(6.5); doc.setTextColor(...medGray);
        doc.text("indisponível", px + photoW / 2, y + photoH / 2, { align: "center" });
      }
      doc.setFontSize(6); doc.setFont("helvetica", isDamage ? "bold" : "normal");
      doc.setTextColor(isDamage ? red[0] : medGray[0], isDamage ? red[1] : medGray[1], isDamage ? red[2] : medGray[2]);
      doc.text(label, px + photoW / 2, y + photoH + 4, { align: "center" });
      col++; if (col >= perRow) { col = 0; y += photoH + labelH + gap; }
    }
    if (col > 0) y += photoH + labelH + gap; y += 2;
  };

  const renderCheckSect = async (
    title: string, dateTime: string | null | undefined,
    lat: string | null | undefined, lng: string | null | undefined,
    notes: string | null | undefined,
    frontal: string | null | undefined, lat1: string | null | undefined,
    lat2: string | null | undefined, tras: string | null | undefined,
    odo: string | null | undefined, fuel: string | null | undefined,
    selfie: string | null | undefined, dmgPhotos: string[]
  ) => {
    drawSect(title, blue);
    checkPageBreak(18);
    const hw = contentW / 3;
    drawField("Data/Hora", dateTime || "—", margin, hw);
    drawField("Coordenadas GPS", lat && lng ? `${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}` : "—", margin + hw, hw);
    drawField("Observações", notes || "—", margin + hw * 2, hw);
    y += 13;
    await renderPhotoGrid([
      { url: frontal || "", label: "Frontal" }, { url: lat1 || "", label: "Lateral Esq." },
      { url: lat2 || "", label: "Lateral Dir." }, { url: tras || "", label: "Traseira" },
      { url: odo || "", label: "Hodômetro" }, { url: fuel || "", label: "Combustível" },
      { url: selfie || "", label: "Selfie" },
    ], false);
    if (dmgPhotos.length > 0) {
      checkPageBreak(10);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...red);
      doc.text(`⚠  AVARIAS REGISTRADAS (${dmgPhotos.length} foto${dmgPhotos.length !== 1 ? "s" : ""})`, margin, y);
      y += 6;
      await renderPhotoGrid(dmgPhotos.map((url, i) => ({ url, label: `Avaria ${i + 1}` })), true);
    }
  };

  // ── HEADER ──────────────────────────────────────────────
  doc.setFillColor(...orange);
  doc.rect(0, 0, pageW, 48, "F");
  try {
    const logoImg = new window.Image(); logoImg.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); logoImg.onerror = () => resolve(); logoImg.src = "/logo-otd.png"; });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const cvs = document.createElement("canvas"); cvs.width = logoImg.naturalWidth; cvs.height = logoImg.naturalHeight;
      const ctx = cvs.getContext("2d"); if (ctx) {
        ctx.drawImage(logoImg, 0, 0);
        const ar = logoImg.naturalWidth / logoImg.naturalHeight;
        const lh = 28, lw = lh * ar;
        doc.addImage(cvs.toDataURL("image/png"), "PNG", margin, 9, lw, lh);
      }
    }
  } catch {}

  const recType = isCollect ? "COLETA" : "TRANSPORTE";
  const identifier = isCollect
    ? (rec as CollectWithRelations).vehicleChassi || "—"
    : (rec as TransportWithRelations).requestNumber || "—";
  const totalDmg = getDamagePhotos(rec).length;

  doc.setFontSize(14); doc.setTextColor(...white); doc.setFont("helvetica", "bold");
  doc.text(`AVARIA — ${recType} #${identifier}`, pageW - margin, 18, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("OTD Logistics — Gestão de Entregas de Veículos", pageW - margin, 26, { align: "right" });
  doc.setFontSize(7.5);
  doc.text(`⚠  ${totalDmg} foto${totalDmg !== 1 ? "s" : ""} de avaria registrada${totalDmg !== 1 ? "s" : ""}`, pageW - margin, 33, { align: "right" });
  doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - margin, 40, { align: "right" });

  y = 58;

  // ── VEÍCULO & OPERAÇÃO ──────────────────────────────────
  drawSect("Informações do Veículo e Operação");
  checkPageBreak(28);
  if (isCollect) {
    const c = rec as CollectWithRelations;
    const fw4 = contentW / 4;
    drawField("Chassi", c.vehicleChassi || "—", margin, fw4);
    drawField("Status", c.status || "—", margin + fw4, fw4);
    drawField("Data da Coleta", fmtDate(c.collectDate), margin + fw4 * 2, fw4);
    y += 13;
  } else {
    const t = rec as TransportWithRelations;
    const fw4 = contentW / 4;
    drawField("Chassi", t.vehicleChassi || "—", margin, fw4);
    drawField("Nº Requisição", t.requestNumber || "—", margin + fw4, fw4);
    drawField("Status", t.status || "—", margin + fw4 * 2, fw4);
    drawField("Previsão Entrega", t.deliveryDate || "—", margin + fw4 * 3, fw4);
    y += 13;
  }

  // ── MOTORISTA ─────────────────────────────────────────
  const driver = (rec as any).driver;
  if (driver) {
    y += 4; drawSect("Motorista", blue);
    checkPageBreak(18);
    const fw4 = contentW / 4;
    drawField("Nome", driver?.name || "—", margin, fw4);
    drawField("Telefone", driver?.phone || "—", margin + fw4, fw4);
    drawField("CPF", driver?.cpf || "—", margin + fw4 * 2, fw4);
    drawField("CNH / Tipo", `${driver?.cnhType || "—"} ${driver?.driverType ? "| " + driver.driverType : ""}`, margin + fw4 * 3, fw4);
    y += 13;
  }

  // ── ROTA ─────────────────────────────────────────────
  y += 4; drawSect("Rota", blue);
  checkPageBreak(24);
  if (isCollect) {
    const c = rec as CollectWithRelations;
    const fw2 = contentW / 2;
    drawField("Origem (Montadora)", c.manufacturer?.name || "—", margin, fw2);
    drawField("Destino (Pátio)", c.yard?.name || "—", margin + fw2, fw2);
    y += 13;
  } else {
    const t = rec as TransportWithRelations;
    const originYard = (t as any).originYard;
    const deliveryLocation = (t as any).deliveryLocation;
    const client = (t as any).client;
    const fw4 = contentW / 4;
    drawField("Pátio de Origem", originYard ? `${originYard.name}${originYard.city ? " — " + originYard.city + "/" + originYard.state : ""}` : "—", margin, fw4);
    drawField("Destino", deliveryLocation ? `${deliveryLocation.name} — ${deliveryLocation.city}/${deliveryLocation.state}` : (client?.name || "—"), margin + fw4, fw4);
    drawField("Distância", t.routeDistanceKm ? `${parseFloat(String(t.routeDistanceKm)).toFixed(0)} km` : "—", margin + fw4 * 2, fw4);
    const dur = (t as any).routeDurationMinutes;
    drawField("Duração Est.", dur ? `${Math.floor(dur / 60)}h ${String(dur % 60).padStart(2, "0")}min` : "—", margin + fw4 * 3, fw4);
    y += 13;
    const fw3 = contentW / 3;
    drawField("Pedágios Est.", (t as any).estimatedTolls ? `R$ ${parseFloat((t as any).estimatedTolls).toFixed(2)}` : "—", margin, fw3);
    drawField("Saída Prevista", fmtDate((t as any).scheduledDeparture), margin + fw3, fw3);
    drawField("Início de Viagem", fmtDate(t.transitStartedAt), margin + fw3 * 2, fw3);
    y += 13;
  }

  y += 6;

  // ── CHECK-IN ──────────────────────────────────────────
  await renderCheckSect(
    "Check-in",
    rec.checkinDateTime ? fmtDate(rec.checkinDateTime) : undefined,
    rec.checkinLocation ? String(rec.checkinLocation.coordinates[1]) : undefined,
    rec.checkinLocation ? String(rec.checkinLocation.coordinates[0]) : undefined,
    rec.checkinNotes, rec.checkinFrontalPhoto, rec.checkinLateral1Photo,
    rec.checkinLateral2Photo, rec.checkinTraseiraPhoto,
    rec.checkinOdometerPhoto, rec.checkinFuelLevelPhoto, rec.checkinSelfiePhoto,
    getCheckinPhotos(rec)
  );

  y += 4;

  // ── CHECK-OUT ─────────────────────────────────────────
  await renderCheckSect(
    "Check-out",
    rec.checkoutDateTime ? fmtDate(rec.checkoutDateTime) : undefined,
    rec.checkoutLocation ? String(rec.checkoutLocation.coordinates[1]) : undefined,
    rec.checkoutLocation ? String(rec.checkoutLocation.coordinates[0]) : undefined,
    rec.checkoutNotes, rec.checkoutFrontalPhoto, rec.checkoutLateral1Photo,
    rec.checkoutLateral2Photo, rec.checkoutTraseiraPhoto,
    rec.checkoutOdometerPhoto, rec.checkoutFuelLevelPhoto, rec.checkoutSelfiePhoto,
    getCheckoutPhotos(rec)
  );

  drawFooter();

  const safeId = isCollect
    ? (rec as CollectWithRelations).vehicleChassi || rec.id
    : (rec as TransportWithRelations).requestNumber || rec.id;
  doc.save(`avaria-${isCollect ? "coleta" : "transporte"}-${safeId}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

export default function DamageReportPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "collects" | "transports">("transports");
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    localStorage.setItem("lastViewedDamageReport", new Date().toISOString());
    queryClient.invalidateQueries({ queryKey: ["/api/damage-reports/new-count"] });
  }, []);

  const { data: collects, isLoading: collectsLoading } = useQuery<CollectWithRelations[]>({
    queryKey: ["/api/collects"],
  });

  const { data: transports, isLoading: transportsLoading } = useQuery<TransportWithRelations[]>({
    queryKey: ["/api/transports"],
  });

  const isLoading = collectsLoading || transportsLoading;

  const collectsWithDamage = (collects || []).filter((c) => getDamagePhotos(c).length > 0);
  const transportsWithDamage = (transports || []).filter((t) => getDamagePhotos(t).length > 0);

  const totalDamageRecords = collectsWithDamage.length + transportsWithDamage.length;
  const totalDamagePhotos = [
    ...collectsWithDamage.map((c) => getDamagePhotos(c).length),
    ...transportsWithDamage.map((t) => getDamagePhotos(t).length),
  ].reduce((a, b) => a + b, 0);

  const openLightbox = (photos: string[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxPhoto(photos[index]);
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    const newIndex = direction === "prev"
      ? (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length
      : (lightboxIndex + 1) % lightboxPhotos.length;
    setLightboxIndex(newIndex);
    setLightboxPhoto(lightboxPhotos[newIndex]);
  };

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const generatePdf = async () => {
    setPdfGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = 210;
      const pageH = 297;
      const margin = 15;
      const contentW = pageW - margin * 2;
      const orange: [number, number, number] = [234, 88, 12];
      const red: [number, number, number] = [220, 38, 38];
      const darkGray: [number, number, number] = [30, 30, 30];
      const medGray: [number, number, number] = [100, 100, 100];
      const lightGray: [number, number, number] = [245, 245, 245];
      const white: [number, number, number] = [255, 255, 255];
      const blue: [number, number, number] = [37, 99, 235];

      let y = 0;
      let pageNum = 1;

      const checkPageBreak = (needed: number) => {
        if (y + needed > pageH - 18) {
          doc.addPage();
          pageNum++;
          drawFooter();
          y = 15;
        }
      };

      const drawFooter = () => {
        doc.setFontSize(7);
        doc.setTextColor(...medGray);
        doc.setFont("helvetica", "normal");
        doc.text("OTD Logistics — Relatório de Avarias — Documento Confidencial", margin, pageH - 8);
        doc.text(`Pág. ${pageNum}`, pageW - margin, pageH - 8, { align: "right" });
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      };

      const loadImage = async (url: string): Promise<string | null> => {
        if (!url || url.trim() === "") return null;
        try {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = normalizeImageUrl(url);
          });
          if (!img.complete || img.naturalWidth === 0) return null;
          const canvas = document.createElement("canvas");
          const maxSize = 800;
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/jpeg", 0.72);
        } catch {
          return null;
        }
      };

      const drawSectionTitle = (title: string, color: [number, number, number] = orange) => {
        checkPageBreak(12);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...color);
        doc.text(title.toUpperCase(), margin, y);
        doc.setDrawColor(...color);
        doc.setLineWidth(0.35);
        doc.line(margin, y + 1.5, margin + contentW, y + 1.5);
        y += 8;
      };

      const drawField = (label: string, value: string, x: number, w: number, multiline = false) => {
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...medGray);
        doc.text(label.toUpperCase(), x, y);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...darkGray);
        if (multiline) {
          const lines = doc.splitTextToSize(value || "—", w - 2);
          doc.text(lines.slice(0, 2), x, y + 5);
          return lines.length > 1 ? 14 : 11;
        } else {
          const maxC = Math.floor(w / 1.9);
          const v = (value || "—").length > maxC ? (value || "—").slice(0, maxC - 1) + "…" : (value || "—");
          doc.text(v, x, y + 5);
          return 11;
        }
      };

      // ── FIRST PAGE HEADER ──────────────────────────────────
      doc.setFillColor(...orange);
      doc.rect(0, 0, pageW, 48, "F");

      let logoDataUrl: string | null = null;
      try {
        const logoImg = new window.Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve();
          logoImg.src = "/logo-otd.png";
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = logoImg.naturalWidth;
          canvas.height = logoImg.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(logoImg, 0, 0);
            logoDataUrl = canvas.toDataURL("image/png");
            const ar = logoImg.naturalWidth / logoImg.naturalHeight;
            const lh = 28;
            const lw = lh * ar;
            doc.addImage(logoDataUrl, "PNG", margin, 9, lw, lh);
          }
        }
      } catch {}

      doc.setFontSize(15);
      doc.setTextColor(...white);
      doc.setFont("helvetica", "bold");
      doc.text("RELATÓRIO DE AVARIAS", pageW - margin, 19, { align: "right" });
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text("OTD Logistics — Gestão de Entregas de Veículos", pageW - margin, 27, { align: "right" });
      doc.setFontSize(7.5);
      doc.text("CNPJ: 12.345.678/0001-99  |  (41) 3030-2315  |  contato@otdlogistics.com.br", pageW - margin, 34, { align: "right" });
      doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - margin, 41, { align: "right" });

      y = 58;

      // ── SUMMARY ─────────────────────────────────────────────
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, 22, 2, 2);

      const sumItems = [
        { label: "Total de Registros", value: String(totalDamageRecords) },
        { label: "Fotos de Avaria", value: String(totalDamagePhotos) },
        { label: "Coletas c/ Avaria", value: String(collectsWithDamage.length) },
        { label: "Transportes c/ Avaria", value: String(transportsWithDamage.length) },
      ];
      const sc = contentW / 4;
      sumItems.forEach((item, i) => {
        const sx = margin + sc * i + sc / 2;
        if (i > 0) {
          doc.setDrawColor(210, 210, 210);
          doc.setLineWidth(0.2);
          doc.line(margin + sc * i, y + 3, margin + sc * i, y + 19);
        }
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...red);
        doc.text(item.value, sx, y + 12, { align: "center" });
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...medGray);
        doc.text(item.label, sx, y + 18, { align: "center" });
      });

      y += 30;

      // ── PER-RECORD SECTIONS ──────────────────────────────────
      const renderPhotoGrid = async (
        photos: Array<{ url: string; label: string }>,
        isDamage = false
      ) => {
        const validPhotos = photos.filter(p => p.url && p.url.trim() !== "");
        if (validPhotos.length === 0) return;

        const photoW = 40;
        const photoH = 30;
        const labelH = 5;
        const gap = 3;
        const perRow = Math.floor(contentW / (photoW + gap));

        let col = 0;
        for (const { url, label } of validPhotos) {
          if (col === 0) checkPageBreak(photoH + labelH + gap + 4);
          const px = margin + col * (photoW + gap);
          const dataUrl = await loadImage(url);

          if (isDamage) {
            doc.setFillColor(255, 240, 240);
            doc.rect(px - 1, y - 1, photoW + 2, photoH + labelH + 3, "F");
            doc.setDrawColor(...red);
            doc.setLineWidth(0.5);
            doc.rect(px - 1, y - 1, photoW + 2, photoH + labelH + 3);
          }

          if (dataUrl) {
            doc.addImage(dataUrl, "JPEG", px, y, photoW, photoH);
            if (!isDamage) {
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.2);
              doc.rect(px, y, photoW, photoH);
            }
          } else {
            doc.setFillColor(238, 238, 238);
            doc.rect(px, y, photoW, photoH, "F");
            doc.setFontSize(6.5);
            doc.setTextColor(...medGray);
            doc.text("indisponível", px + photoW / 2, y + photoH / 2, { align: "center" });
          }

          doc.setFontSize(6);
          doc.setFont("helvetica", isDamage ? "bold" : "normal");
          doc.setTextColor(isDamage ? red[0] : medGray[0], isDamage ? red[1] : medGray[1], isDamage ? red[2] : medGray[2]);
          doc.text(label, px + photoW / 2, y + photoH + 4, { align: "center" });

          col++;
          if (col >= perRow) {
            col = 0;
            y += photoH + labelH + gap;
          }
        }
        if (col > 0) y += photoH + labelH + gap;
        y += 2;
      };

      const renderCheckSection = async (
        sectionTitle: string,
        dateTime: string | null | undefined,
        lat: string | null | undefined,
        lng: string | null | undefined,
        notes: string | null | undefined,
        frontal: string | null | undefined,
        lateral1: string | null | undefined,
        lateral2: string | null | undefined,
        traseira: string | null | undefined,
        odometer: string | null | undefined,
        fuel: string | null | undefined,
        selfie: string | null | undefined,
        damagePhotos: string[]
      ) => {
        drawSectionTitle(sectionTitle, blue);

        // Date + coords + notes row
        checkPageBreak(18);
        const hw = contentW / 3;
        drawField("Data/Hora", dateTime || "—", margin, hw);
        const coordStr = lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : "—";
        drawField("Coordenadas GPS", coordStr, margin + hw, hw);
        drawField("Observações", notes || "—", margin + hw * 2, hw);
        y += 13;

        // Standard photos
        const standardPhotos = [
          { url: frontal || "", label: "Frontal" },
          { url: lateral1 || "", label: "Lateral Esq." },
          { url: lateral2 || "", label: "Lateral Dir." },
          { url: traseira || "", label: "Traseira" },
          { url: odometer || "", label: "Hodômetro" },
          { url: fuel || "", label: "Combustível" },
          { url: selfie || "", label: "Selfie" },
        ];
        await renderPhotoGrid(standardPhotos, false);

        // Damage photos
        if (damagePhotos.length > 0) {
          checkPageBreak(10);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...red);
          doc.text(`⚠  AVARIAS REGISTRADAS (${damagePhotos.length} foto${damagePhotos.length !== 1 ? "s" : ""})`, margin, y);
          y += 6;
          const dmgPhotos = damagePhotos.map((url, i) => ({ url, label: `Avaria ${i + 1}` }));
          await renderPhotoGrid(dmgPhotos, true);
        }
      };

      for (let ri = 0; ri < collectsWithDamage.length + transportsWithDamage.length; ri++) {
        const isCollect = ri < collectsWithDamage.length;
        const rec = isCollect
          ? collectsWithDamage[ri]
          : transportsWithDamage[ri - collectsWithDamage.length];

        // Start each record on fresh area with enough space
        checkPageBreak(60);

        // ── Record Header ─────────────────────────────────────
        doc.setFillColor(248, 248, 248);
        doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW, 14, 2, 2);

        const badgeColor: [number, number, number] = isCollect ? [37, 99, 235] : [107, 114, 128];
        doc.setFillColor(...badgeColor);
        doc.roundedRect(margin + 2, y + 2.5, 34, 9, 1.5, 1.5, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...white);
        doc.text(isCollect ? "COLETA" : "TRANSPORTE", margin + 19, y + 8.5, { align: "center" });

        const identifier = isCollect
          ? (rec as CollectWithRelations).vehicleChassi || "-"
          : (rec as TransportWithRelations).requestNumber || "-";

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...darkGray);
        doc.text(`#${identifier}`, margin + 40, y + 9);

        const totalDmg = getDamagePhotos(rec).length;
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...red);
        doc.text(`⚠  ${totalDmg} foto${totalDmg !== 1 ? "s" : ""} de avaria`, pageW - margin - 2, y + 9, { align: "right" });

        y += 18;

        // ── Vehicle & Operation Info ──────────────────────────
        drawSectionTitle("Informações do Veículo e Operação");

        checkPageBreak(24);
        if (isCollect) {
          const c = rec as CollectWithRelations;
          const fw4 = contentW / 4;
          drawField("Chassi", c.vehicleChassi || "—", margin, fw4);
          drawField("Motorista", c.driver?.name || "—", margin + fw4, fw4);
          drawField("Origem (Montadora)", c.manufacturer?.name || "—", margin + fw4 * 2, fw4);
          drawField("Destino (Pátio)", c.yard?.name || "—", margin + fw4 * 3, fw4);
          y += 13;
          const fw3 = contentW / 3;
          drawField("Data da Coleta", formatDate(c.collectDate), margin, fw3);
          drawField("Status", c.status || "—", margin + fw3, fw3);
          y += 13;
        } else {
          const t = rec as TransportWithRelations;
          const driver = (t as any).driver;
          const client = (t as any).client;
          const originYard = (t as any).originYard;
          const deliveryLocation = (t as any).deliveryLocation;
          const fw4 = contentW / 4;
          drawField("Chassi", t.vehicleChassi || "—", margin, fw4);
          drawField("Nº Requisição", t.requestNumber || "—", margin + fw4, fw4);
          drawField("Status", t.status || "—", margin + fw4 * 2, fw4);
          drawField("Data Entrega", t.deliveryDate || "—", margin + fw4 * 3, fw4);
          y += 13;
          drawField("Motorista", driver?.name || "—", margin, fw4);
          drawField("Cliente", client?.name || "—", margin + fw4, fw4);
          drawField("Pátio de Origem", originYard?.name || "—", margin + fw4 * 2, fw4);
          drawField("Destino", deliveryLocation ? `${deliveryLocation.name} — ${deliveryLocation.city}/${deliveryLocation.state}` : "—", margin + fw4 * 3, fw4);
          y += 13;
        }

        y += 4;

        // ── CHECK-IN ──────────────────────────────────────────
        await renderCheckSection(
          "Check-in",
          rec.checkinDateTime ? formatDate(rec.checkinDateTime) : undefined,
          rec.checkinLocation ? String(rec.checkinLocation.coordinates[1]) : undefined,
          rec.checkinLocation ? String(rec.checkinLocation.coordinates[0]) : undefined,
          rec.checkinNotes,
          rec.checkinFrontalPhoto,
          rec.checkinLateral1Photo,
          rec.checkinLateral2Photo,
          rec.checkinTraseiraPhoto,
          rec.checkinOdometerPhoto,
          rec.checkinFuelLevelPhoto,
          rec.checkinSelfiePhoto,
          getCheckinPhotos(rec)
        );

        y += 4;

        // ── CHECK-OUT ─────────────────────────────────────────
        await renderCheckSection(
          "Check-out",
          rec.checkoutDateTime ? formatDate(rec.checkoutDateTime) : undefined,
          rec.checkoutLocation ? String(rec.checkoutLocation.coordinates[1]) : undefined,
          rec.checkoutLocation ? String(rec.checkoutLocation.coordinates[0]) : undefined,
          rec.checkoutNotes,
          rec.checkoutFrontalPhoto,
          rec.checkoutLateral1Photo,
          rec.checkoutLateral2Photo,
          rec.checkoutTraseiraPhoto,
          rec.checkoutOdometerPhoto,
          rec.checkoutFuelLevelPhoto,
          rec.checkoutSelfiePhoto,
          getCheckoutPhotos(rec)
        );

        y += 6;

        // Page break between records
        const isLast = ri === collectsWithDamage.length + transportsWithDamage.length - 1;
        if (!isLast) {
          doc.addPage();
          pageNum++;
          drawFooter();
          y = 15;

          // Mini header on continuation pages
          doc.setFillColor(...orange);
          doc.rect(0, 0, pageW, 10, "F");
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...white);
          doc.text("OTD LOGISTICS — RELATÓRIO DE AVARIAS", margin, 7);
          doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageW - margin, 7, { align: "right" });
          y = 18;
        }
      }

      drawFooter();
      doc.save(`relatorio-avarias-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
    } finally {
      setPdfGenerating(false);
    }
  };

  const showCollects = activeTab === "all" || activeTab === "collects";
  const showTransports = activeTab === "all" || activeTab === "transports";
  const visibleCollects = showCollects ? collectsWithDamage : [];
  const visibleTransports = showTransports ? transportsWithDamage : [];
  const hasResults = visibleCollects.length > 0 || visibleTransports.length > 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Relatório de Avarias"
        breadcrumbs={[
          { label: "Relatórios", href: "/" },
          { label: "Relatório de Avarias" },
        ]}
        actions={
          <Button
            onClick={generatePdf}
            disabled={pdfGenerating || isLoading || totalDamageRecords === 0}
            data-testid="button-generate-pdf"
          >
            {pdfGenerating ? (
              <>
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block" />
                Gerando...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">

        {/* ── KPI cards ── */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-records">{totalDamageRecords}</p>
                  <p className="text-sm text-muted-foreground">Registros com Avaria</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                  <Camera className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-photos">{totalDamagePhotos}</p>
                  <p className="text-sm text-muted-foreground">Fotos de Avaria</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                  <Truck className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" data-testid="text-collects-count">{collectsWithDamage.length}</span>
                    <span className="text-xs text-muted-foreground">coletas</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-lg font-bold" data-testid="text-transports-count">{transportsWithDamage.length}</span>
                    <span className="text-xs text-muted-foreground">transportes</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Distribuição</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "collects" | "transports")}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              Todos
              {totalDamageRecords > 0 && (
                <Badge variant="secondary" className="ml-1.5">{totalDamageRecords}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="collects" data-testid="tab-collects">
              <Package className="h-4 w-4 mr-1.5" />
              Coletas
              {collectsWithDamage.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">{collectsWithDamage.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="transports" data-testid="tab-transports">
              <Truck className="h-4 w-4 mr-1.5" />
              Transportes
              {transportsWithDamage.length > 0 && (
                <Badge variant="secondary" className="ml-1.5">{transportsWithDamage.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Table ── */}
        {isLoading ? (
          <Card>
            <CardContent className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </CardContent>
          </Card>
        ) : !hasResults ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Nenhuma avaria registrada</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Identificação</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Chassi</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Motorista</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Origem / Destino</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Data</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Check-in</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Check-out</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Total</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCollects.map((collect) => {
                      const allPhotos = getDamagePhotos(collect);
                      const checkinPhotos = getCheckinPhotos(collect);
                      const checkoutPhotos = getCheckoutPhotos(collect);
                      const isExpanded = expandedRow === `collect-${collect.id}`;
                      return (
                        <CollectRow
                          key={collect.id}
                          collect={collect}
                          allPhotos={allPhotos}
                          checkinPhotos={checkinPhotos}
                          checkoutPhotos={checkoutPhotos}
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedRow(isExpanded ? null : `collect-${collect.id}`)}
                          onPhotoClick={(photos, index) => openLightbox(photos, index)}
                          formatDate={formatDate}
                        />
                      );
                    })}
                    {visibleTransports.map((transport) => {
                      const allPhotos = getDamagePhotos(transport);
                      const checkinPhotos = getCheckinPhotos(transport);
                      const checkoutPhotos = getCheckoutPhotos(transport);
                      const isExpanded = expandedRow === `transport-${transport.id}`;
                      return (
                        <TransportRow
                          key={transport.id}
                          transport={transport}
                          allPhotos={allPhotos}
                          checkinPhotos={checkinPhotos}
                          checkoutPhotos={checkoutPhotos}
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedRow(isExpanded ? null : `transport-${transport.id}`)}
                          onPhotoClick={(photos, index) => openLightbox(photos, index)}
                          formatDate={formatDate}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!lightboxPhoto} onOpenChange={() => setLightboxPhoto(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
          {lightboxPhoto && (
            <div className="relative">
              <img
                src={normalizeImageUrl(lightboxPhoto)}
                alt="Foto de avaria"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
              {lightboxPhotos.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => { e.stopPropagation(); navigateLightbox("prev"); }}
                    data-testid="button-lightbox-prev"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => { e.stopPropagation(); navigateLightbox("next"); }}
                    data-testid="button-lightbox-next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-white text-sm">
                    {lightboxIndex + 1} / {lightboxPhotos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollectRow({
  collect,
  allPhotos,
  checkinPhotos,
  checkoutPhotos,
  isExpanded,
  onToggle,
  onPhotoClick,
  formatDate,
}: {
  collect: CollectWithRelations;
  allPhotos: string[];
  checkinPhotos: string[];
  checkoutPhotos: string[];
  isExpanded: boolean;
  onToggle: () => void;
  onPhotoClick: (photos: string[], index: number) => void;
  formatDate: (d: string | Date | null | undefined) => string;
}) {
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setExporting(true);
    try { await generateSinglePdf(collect, true); } finally { setExporting(false); }
  };

  return (
    <>
      <tr
        className="border-b last:border-b-0 hover-elevate cursor-pointer"
        onClick={onToggle}
        data-testid={`row-damage-collect-${collect.id}`}
      >
        <td className="p-3">
          <Badge variant="secondary" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            Coleta
          </Badge>
        </td>
        <td className="p-3">
          <span className="font-mono text-xs font-semibold">{collect.vehicleChassi}</span>
        </td>
        <td className="p-3 hidden md:table-cell">
          <span className="font-mono text-xs">{collect.vehicleChassi}</span>
        </td>
        <td className="p-3 hidden lg:table-cell">
          <span className="text-sm">{collect.driver?.name || "-"}</span>
        </td>
        <td className="p-3 hidden lg:table-cell">
          <div className="text-xs">
            <span className="text-muted-foreground">{collect.manufacturer?.name || "-"}</span>
            <span className="mx-1 text-muted-foreground">&rarr;</span>
            <span>{collect.yard?.name || "-"}</span>
          </div>
        </td>
        <td className="p-3 hidden sm:table-cell">
          <span className="text-xs">{formatDate(collect.collectDate)}</span>
        </td>
        <td className="p-3 text-center">
          {checkinPhotos.length > 0 ? (
            <Badge variant="destructive" className="text-xs">{checkinPhotos.length}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </td>
        <td className="p-3 text-center">
          {checkoutPhotos.length > 0 ? (
            <Badge variant="destructive" className="text-xs">{checkoutPhotos.length}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </td>
        <td className="p-3 text-center">
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {allPhotos.length}
          </Badge>
        </td>
        <td className="p-3 text-center">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggle(); }} data-testid={`button-expand-collect-${collect.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b last:border-b-0">
          <td colSpan={10} className="p-4 bg-muted/20">
            <div className="space-y-4">

              {/* Expanded header with export button */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Coleta — {collect.vehicleChassi}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  data-testid={`button-export-pdf-collect-${collect.id}`}
                  className="h-7 text-xs gap-1.5"
                >
                  {exporting ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full inline-block" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  {exporting ? "Gerando..." : "Exportar PDF"}
                </Button>
              </div>

              {/* Info Grid */}
              <div className="grid gap-3 sm:grid-cols-3">

                {/* Motorista */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Motorista
                  </p>
                  <p className="text-sm font-semibold">{collect.driver?.name || "—"}</p>
                  {collect.driver?.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />{collect.driver.phone}
                    </p>
                  )}
                  {(collect.driver as any)?.cpf && (
                    <p className="text-xs text-muted-foreground">
                      CPF: {(collect.driver as any).cpf}
                    </p>
                  )}
                  {(collect.driver as any)?.cnhType && (
                    <p className="text-xs text-muted-foreground">
                      CNH: {(collect.driver as any).cnhType}
                    </p>
                  )}
                </div>

                {/* Rota */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Route className="h-3 w-3" /> Rota da Coleta
                  </p>
                  <div className="flex items-start gap-2 text-xs">
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div className="w-px h-4 bg-border" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Origem</p>
                        <p className="font-medium">{collect.manufacturer?.name || "—"}</p>
                        {(collect.manufacturer as any)?.city && (
                          <p className="text-muted-foreground">{(collect.manufacturer as any).city}/{(collect.manufacturer as any).state}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Destino</p>
                        <p className="font-medium">{collect.yard?.name || "—"}</p>
                        {(collect.yard as any)?.city && (
                          <p className="text-muted-foreground">{(collect.yard as any).city}/{(collect.yard as any).state}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Datas e Localização */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Datas & GPS
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data da coleta</span>
                      <span className="font-medium">{formatDate(collect.collectDate)}</span>
                    </div>
                    {collect.checkinDateTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Check-in</span>
                        <span className="font-medium">{formatDate(collect.checkinDateTime)}</span>
                      </div>
                    )}
                    {collect.checkoutDateTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Check-out</span>
                        <span className="font-medium">{formatDate(collect.checkoutDateTime)}</span>
                      </div>
                    )}
                    {(collect as any).checkinLocation?.coordinates && (
                      <div className="pt-1 border-t">
                        <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
                          <Navigation className="h-3 w-3 text-blue-500" /> Local do Check-in
                        </p>
                        <a
                          href={`https://maps.google.com/?q=${(collect as any).checkinLocation.coordinates[1]},${(collect as any).checkinLocation.coordinates[0]}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-blue-600 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {parseFloat((collect as any).checkinLocation.coordinates[1]).toFixed(5)}, {parseFloat((collect as any).checkinLocation.coordinates[0]).toFixed(5)}
                        </a>
                      </div>
                    )}
                    {(collect as any).checkoutLocation?.coordinates && (
                      <div className="pt-1 border-t">
                        <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
                          <Navigation className="h-3 w-3 text-red-500" /> Local do Check-out
                        </p>
                        <a
                          href={`https://maps.google.com/?q=${(collect as any).checkoutLocation.coordinates[1]},${(collect as any).checkoutLocation.coordinates[0]}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-blue-600 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {parseFloat((collect as any).checkoutLocation.coordinates[1]).toFixed(5)}, {parseFloat((collect as any).checkoutLocation.coordinates[0]).toFixed(5)}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fotos de Avaria */}
              {checkinPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avarias no Check-in ({checkinPhotos.length})
                  </p>
                  <PhotoThumbnails photos={checkinPhotos} allPhotos={allPhotos} onPhotoClick={onPhotoClick} />
                </div>
              )}
              {checkoutPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avarias no Check-out ({checkoutPhotos.length})
                  </p>
                  <PhotoThumbnails photos={checkoutPhotos} allPhotos={allPhotos} onPhotoClick={onPhotoClick} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TransportRow({
  transport,
  allPhotos,
  checkinPhotos,
  checkoutPhotos,
  isExpanded,
  onToggle,
  onPhotoClick,
  formatDate,
}: {
  transport: TransportWithRelations;
  allPhotos: string[];
  checkinPhotos: string[];
  checkoutPhotos: string[];
  isExpanded: boolean;
  onToggle: () => void;
  onPhotoClick: (photos: string[], index: number) => void;
  formatDate: (d: string | Date | null | undefined) => string;
}) {
  const driver = (transport as any).driver;
  const client = (transport as any).client;
  const deliveryLocation = (transport as any).deliveryLocation;
  const originYard = (transport as any).originYard;
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setExporting(true);
    try { await generateSinglePdf(transport, false); } finally { setExporting(false); }
  };

  return (
    <>
      <tr
        className="border-b last:border-b-0 hover-elevate cursor-pointer"
        onClick={onToggle}
        data-testid={`row-damage-transport-${transport.id}`}
      >
        <td className="p-3">
          <Badge variant="secondary" className="text-xs">
            <Truck className="h-3 w-3 mr-1" />
            Transporte
          </Badge>
        </td>
        <td className="p-3">
          <span className="font-mono text-xs font-semibold">{transport.requestNumber}</span>
        </td>
        <td className="p-3 hidden md:table-cell">
          <span className="font-mono text-xs">{transport.vehicleChassi}</span>
        </td>
        <td className="p-3 hidden lg:table-cell">
          <span className="text-sm">{driver?.name || "-"}</span>
        </td>
        <td className="p-3 hidden lg:table-cell">
          <div className="text-xs">
            <span className="text-muted-foreground">{originYard?.name || "-"}</span>
            <span className="mx-1 text-muted-foreground">&rarr;</span>
            <span>{deliveryLocation ? `${deliveryLocation.city}/${deliveryLocation.state}` : client?.name || "-"}</span>
          </div>
        </td>
        <td className="p-3 hidden sm:table-cell">
          <span className="text-xs">{formatDate(transport.checkinDateTime || transport.createdAt)}</span>
        </td>
        <td className="p-3 text-center">
          {checkinPhotos.length > 0 ? (
            <Badge variant="destructive" className="text-xs">{checkinPhotos.length}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </td>
        <td className="p-3 text-center">
          {checkoutPhotos.length > 0 ? (
            <Badge variant="destructive" className="text-xs">{checkoutPhotos.length}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </td>
        <td className="p-3 text-center">
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {allPhotos.length}
          </Badge>
        </td>
        <td className="p-3 text-center">
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onToggle(); }} data-testid={`button-expand-transport-${transport.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b last:border-b-0">
          <td colSpan={10} className="p-4 bg-muted/20">
            <div className="space-y-4">

              {/* Expanded header with export button */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" />
                  Transporte — {transport.requestNumber}
                  {transport.vehicleChassi && (
                    <span className="font-normal text-muted-foreground/70">| Chassi: {transport.vehicleChassi}</span>
                  )}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  data-testid={`button-export-pdf-transport-${transport.id}`}
                  className="h-7 text-xs gap-1.5"
                >
                  {exporting ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full inline-block" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  {exporting ? "Gerando..." : "Exportar PDF"}
                </Button>
              </div>

              {/* Info Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                {/* Motorista */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> Motorista
                  </p>
                  <p className="text-sm font-semibold">{driver?.name || "—"}</p>
                  {driver?.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />{driver.phone}
                    </p>
                  )}
                  {driver?.cpf && (
                    <p className="text-xs text-muted-foreground">CPF: {driver.cpf}</p>
                  )}
                  {driver?.cnhType && (
                    <p className="text-xs text-muted-foreground">CNH: {driver.cnhType}</p>
                  )}
                  {driver?.driverType && (
                    <Badge variant="outline" className="text-[10px] mt-1">{driver.driverType}</Badge>
                  )}
                </div>

                {/* Rota */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Route className="h-3 w-3" /> Rota do Transporte
                  </p>
                  <div className="flex items-start gap-2 text-xs">
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div className="w-px h-4 bg-border" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Pátio de Origem</p>
                        <p className="font-medium">{originYard?.name || "—"}</p>
                        {originYard?.city && (
                          <p className="text-muted-foreground">{originYard.city}/{originYard.state}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Destino</p>
                        <p className="font-medium">{deliveryLocation?.name || client?.name || "—"}</p>
                        {deliveryLocation?.city && (
                          <p className="text-muted-foreground">{deliveryLocation.city}/{deliveryLocation.state}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1 border-t text-xs">
                    {transport.routeDistanceKm && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Ruler className="h-3 w-3" />
                        {parseFloat(String(transport.routeDistanceKm)).toFixed(0)} km
                      </span>
                    )}
                    {(transport as any).routeDurationMinutes && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {Math.floor((transport as any).routeDurationMinutes / 60)}h{((transport as any).routeDurationMinutes % 60).toString().padStart(2, "0")}min
                      </span>
                    )}
                    {(transport as any).estimatedTolls && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Fuel className="h-3 w-3" />
                        Pedágios: R$ {parseFloat((transport as any).estimatedTolls).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Datas da Operação */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Datas da Operação
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {(transport as any).scheduledDeparture && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Saída prevista</span>
                        <span className="font-medium text-right">{formatDate((transport as any).scheduledDeparture)}</span>
                      </div>
                    )}
                    {transport.transitStartedAt && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Início de viagem</span>
                        <span className="font-medium text-right">{formatDate(transport.transitStartedAt)}</span>
                      </div>
                    )}
                    {transport.checkinDateTime && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Check-in</span>
                        <span className="font-medium text-right">{formatDate(transport.checkinDateTime)}</span>
                      </div>
                    )}
                    {transport.checkoutDateTime && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Check-out</span>
                        <span className="font-medium text-right">{formatDate(transport.checkoutDateTime)}</span>
                      </div>
                    )}
                    {transport.deliveryDate && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Previsão entrega</span>
                        <span className="font-medium text-right">{transport.deliveryDate}</span>
                      </div>
                    )}
                    {client?.name && (
                      <div className="pt-1 border-t flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Cliente</span>
                        <span className="font-medium text-right truncate">{client.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Localização das Avarias */}
                <div className="rounded-lg border bg-card p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Localização das Avarias
                  </p>
                  <div className="space-y-2.5 text-xs">
                    {(transport as any).checkinLocation?.coordinates ? (
                      <div>
                        <p className="text-muted-foreground flex items-center gap-1 mb-1">
                          <Navigation className="h-3 w-3 text-blue-500" /> Check-in GPS
                        </p>
                        <a
                          href={`https://maps.google.com/?q=${(transport as any).checkinLocation.coordinates[1]},${(transport as any).checkinLocation.coordinates[0]}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-blue-600 hover:underline block"
                          onClick={e => e.stopPropagation()}
                        >
                          {parseFloat((transport as any).checkinLocation.coordinates[1]).toFixed(5)},&nbsp;
                          {parseFloat((transport as any).checkinLocation.coordinates[0]).toFixed(5)}
                        </a>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-[11px]">Sem GPS no check-in</p>
                    )}
                    {(transport as any).checkoutLocation?.coordinates ? (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground flex items-center gap-1 mb-1">
                          <Navigation className="h-3 w-3 text-red-500" /> Check-out GPS
                        </p>
                        <a
                          href={`https://maps.google.com/?q=${(transport as any).checkoutLocation.coordinates[1]},${(transport as any).checkoutLocation.coordinates[0]}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-blue-600 hover:underline block"
                          onClick={e => e.stopPropagation()}
                        >
                          {parseFloat((transport as any).checkoutLocation.coordinates[1]).toFixed(5)},&nbsp;
                          {parseFloat((transport as any).checkoutLocation.coordinates[0]).toFixed(5)}
                        </a>
                      </div>
                    ) : (
                      <div className="pt-2 border-t">
                        <p className="text-muted-foreground text-[11px]">Sem GPS no check-out</p>
                      </div>
                    )}
                    {transport.checkinNotes && (
                      <div className="pt-1 border-t">
                        <p className="text-muted-foreground mb-0.5">Obs. Check-in:</p>
                        <p className="text-foreground leading-snug">{transport.checkinNotes}</p>
                      </div>
                    )}
                    {transport.checkoutNotes && (
                      <div className="pt-1 border-t">
                        <p className="text-muted-foreground mb-0.5">Obs. Check-out:</p>
                        <p className="text-foreground leading-snug">{transport.checkoutNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fotos de Avaria */}
              {checkinPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avarias no Check-in ({checkinPhotos.length})
                  </p>
                  <PhotoThumbnails photos={checkinPhotos} allPhotos={allPhotos} onPhotoClick={onPhotoClick} />
                </div>
              )}
              {checkoutPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Avarias no Check-out ({checkoutPhotos.length})
                  </p>
                  <PhotoThumbnails photos={checkoutPhotos} allPhotos={allPhotos} onPhotoClick={onPhotoClick} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PhotoThumbnails({
  photos,
  allPhotos,
  onPhotoClick,
}: {
  photos: string[];
  allPhotos: string[];
  onPhotoClick: (photos: string[], index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photo, index) => {
        const globalIndex = allPhotos.indexOf(photo);
        return (
          <button
            key={index}
            type="button"
            className="relative h-16 w-16 rounded-md overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-destructive/50 transition-all group"
            onClick={(e) => {
              e.stopPropagation();
              onPhotoClick(allPhotos, globalIndex >= 0 ? globalIndex : 0);
            }}
            data-testid={`button-damage-photo-${index}`}
          >
            <img
              src={normalizeImageUrl(photo)}
              alt={`Avaria ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Image className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
