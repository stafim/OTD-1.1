import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Eye, BarChart2, FolderOpen, FileX, Smartphone, Monitor } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Driver, Contract } from "@shared/schema";
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
import { DriverDetailDialog } from "./detail-dialog";
import { DriverDocsDialog } from "./docs-dialog";

const modalityLabels: Record<string, string> = {
  pj: "PJ",
  clt: "CLT",
  agregado: "Agregado",
};

type FilterMode = "all" | "sem_contrato";

export default function DriversPage() {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingDriverId, setViewingDriverId] = useState<string | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsDriverId, setDocsDriverId] = useState<string | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: drivers, isLoading } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      toast({ title: "Motorista excluído com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir motorista", variant: "destructive" });
    },
  });

  // Set of driver IDs that have at least one signed contract.
  // N:N: each contract returns `drivers` enriched with per-driver autentiqueStatus.
  const driversWithSignedContract = new Set<string>();
  for (const c of contracts || []) {
    const driversArr: any[] = (c as any).drivers || ((c as any).driver ? [(c as any).driver] : []);
    for (const d of driversArr) {
      if (d?.autentiqueStatus === "assinado") {
        driversWithSignedContract.add(d.id);
      }
    }
  }

  const semContratoCount = (drivers || []).filter(
    (d) => !driversWithSignedContract.has(d.id)
  ).length;

  const filteredDrivers = (drivers || []).filter((driver) => {
    const matchesSearch =
      driver.name.toLowerCase().includes(search.toLowerCase()) ||
      driver.cpf.includes(search) ||
      driver.phone.includes(search);

    const matchesFilter =
      filterMode === "all" ||
      (filterMode === "sem_contrato" && !driversWithSignedContract.has(driver.id));

    return matchesSearch && matchesFilter;
  });

  const handleNewDriver = () => {
    navigate("/motoristas/novo");
  };

  const handleEditDriver = (driverId: string) => {
    setDetailOpen(false);
    navigate(`/motoristas/${driverId}`);
  };

  const handleViewDriver = (driver: Driver) => {
    setViewingDriverId(driver.id);
    setDetailOpen(true);
  };

  const columns = [
    { key: "name", label: "Nome" },
    { key: "cpf", label: "CPF" },
    {
      key: "phone",
      label: "Telefone",
      render: (driver: Driver) => {
        const raw = (driver.phone || "").trim();
        const digits = raw.replace(/\D/g, "");
        // If the original input started with "+", treat as already-international E.164.
        // Otherwise (typical BR-local format like "(11) 91234-5678"), assume BR and prefix 55 when missing.
        const isInternational = raw.startsWith("+");
        let waNumber = digits;
        if (!isInternational) {
          // BR mobile: 10 (landline) or 11 (mobile) digits without DDI
          if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
            waNumber = `55${digits}`;
          }
        }
        // Validate length for E.164: WhatsApp needs at least 10 digits, max 15
        const isValid = waNumber.length >= 10 && waNumber.length <= 15;
        const waUrl = `https://wa.me/${waNumber}`;
        return (
          <div className="flex items-center gap-2">
            <span data-testid={`text-phone-${driver.id}`}>{driver.phone}</span>
            {isValid && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Abrir conversa no WhatsApp"
                aria-label={`Abrir conversa no WhatsApp com ${driver.name}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                data-testid={`link-whatsapp-${driver.id}`}
              >
                <SiWhatsapp className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: "modality",
      label: "Modalidade",
      render: (driver: Driver) => (
        <Badge variant="secondary" className="font-normal">
          {modalityLabels[driver.modality] || driver.modality}
        </Badge>
      ),
    },
    { key: "cnhType", label: "CNH" },
    {
      key: "isApto",
      label: "Apto",
      render: (driver: Driver) => (
        <Badge variant={driver.isApto === "true" ? "default" : "outline"}>
          {driver.isApto === "true" ? "Sim" : "Não"}
        </Badge>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (driver: Driver) => (
        <Badge variant={driver.isActive === "true" ? "default" : "secondary"}>
          {driver.isActive === "true" ? "Ativo" : "Inativo"}
        </Badge>
      ),
    },
    {
      key: "registrationSource",
      label: "Origem",
      render: (driver: Driver) => {
        const isApp = (driver as any).registrationSource === "app";
        return (
          <Badge
            variant="outline"
            className={isApp
              ? "border-blue-400 text-blue-600 dark:text-blue-400 gap-1"
              : "border-slate-400 text-slate-600 dark:text-slate-400 gap-1"}
          >
            {isApp ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
            {isApp ? "App" : "Sistema"}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      className: "w-40",
      render: (driver: Driver) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/motoristas/${driver.id}/perfil`);
            }}
            title="Ver perfil"
            data-testid={`button-profile-${driver.id}`}
          >
            <BarChart2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleViewDriver(driver);
            }}
            title="Ver ficha"
            data-testid={`button-view-${driver.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDocsDriverId(driver.id);
              setDocsOpen(true);
            }}
            title="Documentação e Contratos"
            data-testid={`button-docs-${driver.id}`}
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEditDriver(driver.id);
            }}
            title="Editar"
            data-testid={`button-edit-${driver.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(driver.id);
            }}
            title="Excluir"
            data-testid={`button-delete-${driver.id}`}
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
        title="Motoristas"
        breadcrumbs={[
          { label: "Cadastros", href: "/" },
          { label: "Motoristas" },
        ]}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-drivers"
              />
            </div>
            <Button onClick={handleNewDriver} data-testid="button-add-driver">
              <Plus className="mr-2 h-4 w-4" />
              Novo Motorista
            </Button>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={filterMode === "all" ? "default" : "outline"}
              onClick={() => setFilterMode("all")}
              className="h-8 rounded-full px-4 text-xs"
              data-testid="filter-all"
            >
              Todos
              {drivers && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs leading-none">
                  {drivers.length}
                </span>
              )}
            </Button>
            <Button
              size="sm"
              variant={filterMode === "sem_contrato" ? "default" : "outline"}
              onClick={() => setFilterMode(filterMode === "sem_contrato" ? "all" : "sem_contrato")}
              className={`h-8 rounded-full px-4 text-xs gap-1.5 ${
                filterMode === "sem_contrato"
                  ? ""
                  : "border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
              }`}
              data-testid="filter-sem-contrato"
            >
              <FileX className="h-3.5 w-3.5" />
              Sem contrato
              {drivers && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs leading-none ${
                  filterMode === "sem_contrato" ? "bg-white/20" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                }`}>
                  {semContratoCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredDrivers}
          isLoading={isLoading}
          keyField="id"
          onRowClick={handleViewDriver}
          emptyMessage={
            filterMode === "sem_contrato"
              ? "Todos os motoristas possuem contrato assinado"
              : "Nenhum motorista cadastrado"
          }
        />
      </div>

      <DriverDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        driverId={viewingDriverId}
        onEdit={handleEditDriver}
      />

      <DriverDocsDialog
        open={docsOpen}
        onOpenChange={setDocsOpen}
        driverId={docsDriverId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
