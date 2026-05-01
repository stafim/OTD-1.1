import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  PenLine,
  Send,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  MailCheck,
  Users,
} from "lucide-react";

interface AutentiqueDocument {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  signatures_count: number;
  signed_count: number;
  rejected_count: number;
  computedStatus: "pendente" | "parcialmente_assinado" | "assinado" | "recusado";
  signatures: {
    public_id: string;
    name: string | null;
    email: string;
    link?: { short_link: string };
    signed?: { created_at: string } | null;
    viewed?: { created_at: string } | null;
    rejected?: { created_at: string; reason?: string } | null;
  }[];
  files: {
    original?: string;
    signed?: string;
  };
}

interface ContractDriverInfo {
  id: string;
  name: string;
  email?: string | null;
  contractDriverId?: string;
  driverSignedAt?: string | null;
  autentiqueDocId?: string | null;
  autentiqueStatus?: string | null;
  autentiqueSignedUrl?: string | null;
  autentiqueOriginalUrl?: string | null;
  autentiqueSentAt?: string | null;
}

interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  driverId?: string | null;
  driver?: ContractDriverInfo | null;
  driverIds?: string[];
  drivers?: ContractDriverInfo[];
  autentiqueDocId?: string;
  autentiqueStatus?: string;
  autentiqueSignedUrl?: string;
}

interface SignerInput {
  name: string;
  email: string;
  action: string;
}

interface DriverOption {
  id: string;
  name: string;
  email?: string | null;
  cpf?: string;
}

interface DriverSigner {
  driverId: string;
  action: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pendente: { label: "Pendente", className: "bg-amber-500/20 text-amber-700 dark:text-amber-400" },
    parcialmente_assinado: { label: "Parcial", className: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
    assinado: { label: "Assinado", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
    recusado: { label: "Recusado", className: "bg-red-500/20 text-red-700 dark:text-red-400" },
  };
  const s = map[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={s.className}>{s.label}</Badge>;
}

function SendDialog({
  open,
  onClose,
  contractId,
  contractLabel,
  type,
  initialDriverId,
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  contractLabel: string;
  type: "contract" | "freight";
  initialDriverId?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [driverSigners, setDriverSigners] = useState<DriverSigner[]>([
    { driverId: initialDriverId || "", action: "SIGN" },
  ]);
  const [message, setMessage] = useState("Por favor, assine este documento.");

  const { data: driversData } = useQuery<DriverOption[]>({
    queryKey: ["/api/drivers"],
  });
  const drivers: DriverOption[] = driversData || [];

  useEffect(() => {
    if (open) {
      setDriverSigners([{ driverId: initialDriverId || "", action: "SIGN" }]);
      setMessage("Por favor, assine este documento.");
    }
  }, [open]);

  const addSigner = () =>
    setDriverSigners([...driverSigners, { driverId: "", action: "SIGN" }]);
  const removeSigner = (i: number) =>
    setDriverSigners(driverSigners.filter((_, idx) => idx !== i));
  const updateDriverSigner = (i: number, field: keyof DriverSigner, val: string) =>
    setDriverSigners(driverSigners.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));

  const resolvedSigners: SignerInput[] = driverSigners
    .map((ds) => {
      const driver = drivers.find((d) => d.id === ds.driverId);
      if (!driver) return null;
      return { name: driver.name, email: driver.email || "", action: ds.action };
    })
    .filter(Boolean) as SignerInput[];

  const valid =
    driverSigners.length > 0 &&
    driverSigners.every((ds) => {
      const driver = drivers.find((d) => d.id === ds.driverId);
      return driver && driver.email;
    });

  // Primary driver = first signer with SIGN action, used to fill contract variables
  const primaryDriverId =
    driverSigners.find((ds) => ds.action === "SIGN" && ds.driverId)?.driverId ||
    driverSigners[0]?.driverId ||
    undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint =
        type === "contract"
          ? `/api/autentique/send-contract/${contractId}`
          : `/api/autentique/send-freight-contract/${contractId}`;
      return apiRequest("POST", endpoint, {
        signers: resolvedSigners,
        message,
        driverId: primaryDriverId,
      });
    },
    onSuccess: () => {
      toast({ title: "Documento enviado!", description: "O e-mail de assinatura foi enviado ao(s) motorista(s)." });
      queryClient.invalidateQueries({ queryKey: ["/api/autentique/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/freight-contracts"] });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const selectedDriverIds = driverSigners.map((s) => s.driverId).filter(Boolean);
  const availableDrivers = (i: number) =>
    drivers.filter(
      (d) => !selectedDriverIds.includes(d.id) || driverSigners[i].driverId === d.id
    );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Enviar para Assinatura
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{contractLabel}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
            <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              Selecione motorista(s) cadastrado(s) na plataforma como signatário(s) do contrato.
            </span>
          </div>

          <div>
            <Label className="mb-2 block">Signatários</Label>
            {driverSigners.map((ds, i) => {
              const selectedDriver = drivers.find((d) => d.id === ds.driverId);
              return (
                <div key={i} className="border rounded-lg p-3 mb-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Signatário {i + 1}</span>
                    {driverSigners.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSigner(i)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Select
                    value={ds.driverId}
                    onValueChange={(v) => updateDriverSigner(i, "driverId", v)}
                  >
                    <SelectTrigger data-testid={`select-signer-driver-${i}`}>
                      <SelectValue placeholder="Selecionar motorista..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDrivers(i).length === 0 ? (
                        <SelectItem value="__none__" disabled>Nenhum motorista disponível</SelectItem>
                      ) : (
                        availableDrivers(i).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                            {d.email ? ` · ${d.email}` : " · (sem e-mail)"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedDriver && !selectedDriver.email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Este motorista não possui e-mail cadastrado. Adicione um e-mail no cadastro do motorista antes de enviar.
                    </p>
                  )}
                  {selectedDriver && selectedDriver.email && (
                    <p className="text-xs text-muted-foreground">E-mail: {selectedDriver.email}</p>
                  )}
                  <Select value={ds.action} onValueChange={(v) => updateDriverSigner(i, "action", v)}>
                    <SelectTrigger data-testid={`select-signer-action-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIGN">Assinar</SelectItem>
                      <SelectItem value="APPROVE">Aprovar</SelectItem>
                      <SelectItem value="WITNESS">Testemunha</SelectItem>
                      <SelectItem value="PARTY">Parte</SelectItem>
                      <SelectItem value="INTERVENER">Interveniente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addSigner}
              disabled={drivers.length === 0 || selectedDriverIds.filter(Boolean).length >= drivers.length}
              data-testid="button-add-signer"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar motorista
            </Button>
            {drivers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Nenhum motorista cadastrado na plataforma.
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Mensagem (opcional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              data-testid="textarea-message"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            data-testid="button-send-document"
          >
            {mutation.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ContractPickerDialog({
  open,
  onClose,
  contracts,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  contracts: Contract[];
  onSelect: (c: Contract) => void;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const filtered = contracts.filter((c) => {
    const q = search.toLowerCase();
    const linkedDrivers = c.drivers && c.drivers.length > 0 ? c.drivers : c.driver ? [c.driver] : [];
    const driverMatch = linkedDrivers.some((d) => (d?.name || "").toLowerCase().includes(q));
    return (
      c.contractNumber.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      driverMatch
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Selecionar Contrato para Envio
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Buscar por número, título ou motorista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-contract-picker-search"
            autoFocus
          />
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato encontrado</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted transition-colors flex items-start justify-between gap-2"
                  onClick={() => { onSelect(c); onClose(); }}
                  data-testid={`picker-contract-${c.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.contractNumber} — {c.title}</p>
                    {(() => {
                      const linked = c.drivers && c.drivers.length > 0 ? c.drivers : c.driver ? [c.driver] : [];
                      if (linked.length === 0) return null;
                      return (
                        <p className="text-xs text-primary flex items-center gap-1 mt-0.5 flex-wrap">
                          <Users className="h-3 w-3 shrink-0" />
                          {linked.length === 1 ? (
                            <>
                              {linked[0]!.name}
                              {linked[0]!.email && <span className="text-muted-foreground">· {linked[0]!.email}</span>}
                            </>
                          ) : (
                            <span>{linked.length} motoristas: {linked.map((d) => d!.name).join(", ")}</span>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                  {c.autentiqueDocId && (
                    <Badge className="shrink-0 text-xs bg-green-500/20 text-green-700 dark:text-green-400">
                      Enviado
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AssinaturaDigitalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<{ id: string; label: string; type: "contract" | "freight"; initialDriverId?: string } | null>(null);
  const [contractPickerOpen, setContractPickerOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  const { data: docsData } = useQuery<{ total: number; data: AutentiqueDocument[] }>({
    queryKey: ["/api/autentique/documents"],
  });

  const { data: contractsData } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: allDriversData } = useQuery<DriverOption[]>({
    queryKey: ["/api/drivers"],
  });

  const resendMutation = useMutation({
    mutationFn: async (docId: string) => apiRequest("POST", `/api/autentique/resend/${docId}`),
    onSuccess: () => toast({ title: "E-mails reenviados com sucesso" }),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const docs = docsData?.data || [];
  const contracts = contractsData || [];

  const pendingContracts = contracts.filter((c) => {
    const linked = c.drivers && c.drivers.length > 0 ? c.drivers : [];
    const anySent = linked.some((d) => d.autentiqueDocId) || !!c.autentiqueDocId;
    return !anySent;
  });

  // Build flat per-driver rows of contracts that were sent through the system.
  // One row per (contract, driver) where the driver actually has a sent document.
  const docById = new Map(docs.map((d) => [d.id, d]));
  type SentRow = {
    key: string;
    contractId: string;
    contractNumber: string;
    contractTitle: string;
    driverId: string;
    driverName: string;
    driverEmail?: string | null;
    sentAt?: string | null;
    signedAt?: string | null;
    signedPdfUrl?: string | null;
    docId?: string | null;
    status?: string | null;
  };
  const sentRows: SentRow[] = [];
  for (const c of contracts) {
    const linked = c.drivers && c.drivers.length > 0 ? c.drivers : [];
    const driverDocIds = new Set<string>();
    for (const d of linked) {
      if (!d.autentiqueDocId) continue;
      driverDocIds.add(d.autentiqueDocId);
      const doc = docById.get(d.autentiqueDocId);
      // Cross-reference per-signer signedAt by matching email
      let signedAt: string | null | undefined = d.driverSignedAt;
      if (doc && d.email) {
        const sig = doc.signatures.find(
          (s) => (s.email || "").toLowerCase() === d.email!.toLowerCase()
        );
        if (sig?.signed?.created_at) signedAt = sig.signed.created_at;
      }
      sentRows.push({
        key: `${c.id}-${d.id}`,
        contractId: c.id,
        contractNumber: c.contractNumber,
        contractTitle: c.title,
        driverId: d.id,
        driverName: d.name,
        driverEmail: d.email,
        sentAt: d.autentiqueSentAt,
        signedAt,
        signedPdfUrl: d.autentiqueSignedUrl || doc?.files?.signed || null,
        docId: d.autentiqueDocId,
        status: d.autentiqueStatus,
      });
    }
    // Legacy fallback: contract-level autentiqueDocId not represented in any
    // driver row (e.g., legacy data not migrated to junction). Show a row
    // using the legacy primary driver so sent contracts are never hidden.
    if (
      c.autentiqueDocId &&
      !driverDocIds.has(c.autentiqueDocId) &&
      c.driver
    ) {
      const doc = docById.get(c.autentiqueDocId);
      let signedAt: string | null | undefined = null;
      if (doc && c.driver.email) {
        const sig = doc.signatures.find(
          (s) => (s.email || "").toLowerCase() === c.driver!.email!.toLowerCase()
        );
        if (sig?.signed?.created_at) signedAt = sig.signed.created_at;
      }
      sentRows.push({
        key: `${c.id}-legacy-${c.driver.id}`,
        contractId: c.id,
        contractNumber: c.contractNumber,
        contractTitle: c.title,
        driverId: c.driver.id,
        driverName: c.driver.name,
        driverEmail: c.driver.email,
        sentAt: doc?.created_at || null,
        signedAt,
        signedPdfUrl: c.autentiqueSignedUrl || doc?.files?.signed || null,
        docId: c.autentiqueDocId,
        status: c.autentiqueStatus,
      });
    }
  }
  // Sort: most recent sentAt first
  sentRows.sort((a, b) => {
    const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return tb - ta;
  });

  // Summary stats (computed BEFORE filter so totals reflect the full base)
  const totalDriversInBase = (allDriversData || []).length;
  const totalSent = sentRows.length;
  const signedRows = sentRows.filter((r) => !!r.signedAt || r.status === "assinado");
  const totalSigned = signedRows.length;
  const totalUnsigned = totalSent - totalSigned;
  const signedPercent = totalSent > 0 ? Math.round((totalSigned / totalSent) * 100) : 0;
  const unsignedPercent = totalSent > 0 ? 100 - signedPercent : 0;
  // Unique drivers who signed at least one document (deduplicated by driverId)
  const uniqueDriversSignedSet = new Set(signedRows.map((r) => r.driverId));
  const uniqueDriversSigned = uniqueDriversSignedSet.size;
  // Percentage of signed drivers relative to total drivers in base
  const baseSignedPercent = totalDriversInBase > 0
    ? Math.round((uniqueDriversSigned / totalDriversInBase) * 100)
    : 0;

  // Apply filter by driver name (case-insensitive)
  const normalizedSearch = driverSearch.trim().toLowerCase();
  const filteredRows = normalizedSearch
    ? sentRows.filter((r) => r.driverName.toLowerCase().includes(normalizedSearch))
    : sentRows;

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openSendDialog = (id: string, label: string, type: "contract" | "freight", initialDriverId?: string) => {
    setSendTarget({ id, label, type, initialDriverId });
    setSendDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <PenLine className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Assinatura Digital</h1>
          <p className="text-muted-foreground text-sm">Integração com Autentique — envie e monitore contratos para assinatura eletrônica</p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4" data-testid="card-summary-drivers-base">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <Users className="h-3.5 w-3.5" />
            Motoristas na base
          </div>
          <p className="text-2xl font-bold" data-testid="text-summary-drivers-base">{totalDriversInBase}</p>
        </div>

        <div className="rounded-lg border bg-card p-4" data-testid="card-summary-drivers-signed">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            Motoristas que assinaram
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-summary-drivers-signed">
              {uniqueDriversSigned}
            </p>
            <span className="text-sm font-semibold text-green-600 dark:text-green-400" data-testid="text-summary-base-signed-pct">
              ({baseSignedPercent}%)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">de {totalDriversInBase} cadastrado(s)</p>
        </div>

        <div className="rounded-lg border bg-card p-4" data-testid="card-summary-signed-pct">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            Assinados
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-summary-signed-pct">
            {signedPercent}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalSigned} de {totalSent} envio(s)</p>
        </div>

        <div className="rounded-lg border bg-card p-4" data-testid="card-summary-unsigned-pct">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Não assinados
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-summary-unsigned-pct">
            {unsignedPercent}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalUnsigned} de {totalSent} envio(s)</p>
        </div>
      </div>

      {/* DRIVER CONTRACTS */}
      <div>
          {/* Action bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Buscar motorista por nome..."
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                data-testid="input-search-driver"
              />
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {normalizedSearch
                  ? `${filteredRows.length} de ${sentRows.length} envio(s)`
                  : `${sentRows.length} envio(s) registrado(s)`}
                {pendingContracts.length > 0 && ` · ${pendingContracts.length} contrato(s) ainda não enviado(s)`}
              </p>
              <Button
                onClick={() => setContractPickerOpen(true)}
                data-testid="button-new-send-contract"
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar Contrato
              </Button>
            </div>
          </div>

          {sentRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/20">
              <Send className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-sm">Nenhum contrato foi enviado pelo sistema ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use o botão "Enviar Contrato" para enviar um contrato a um motorista
              </p>
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden border">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr] gap-3 px-4 py-2.5 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div>Motorista</div>
                <div>Enviado em</div>
                <div>Assinado em</div>
                <div className="text-center">PDF Assinado</div>
                <div className="text-center">Reenviar</div>
              </div>

              {filteredRows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground" data-testid="text-no-search-results">
                  Nenhum motorista encontrado para "{driverSearch}"
                </div>
              ) : null}
              <div className="divide-y">
                {filteredRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                    data-testid={`row-sent-${row.key}`}
                  >
                    {/* Driver + contract info */}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate" data-testid={`text-driver-name-${row.key}`}>
                        {row.driverName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.contractNumber} — {row.contractTitle}
                      </p>
                      {row.driverEmail && (
                        <p className="text-xs text-muted-foreground truncate">{row.driverEmail}</p>
                      )}
                      {row.status && (
                        <div className="mt-1 md:hidden">
                          <StatusBadge status={row.status} />
                        </div>
                      )}
                    </div>

                    {/* Sent at */}
                    <div className="text-sm">
                      <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase mr-2">
                        Enviado:
                      </span>
                      <span data-testid={`text-sent-at-${row.key}`}>{formatDateTime(row.sentAt)}</span>
                    </div>

                    {/* Signed at */}
                    <div className="text-sm">
                      <span className="md:hidden text-xs font-semibold text-muted-foreground uppercase mr-2">
                        Assinado:
                      </span>
                      {row.signedAt ? (
                        <span className="text-green-600 dark:text-green-400 flex items-center gap-1" data-testid={`text-signed-at-${row.key}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 inline shrink-0" />
                          {formatDateTime(row.signedAt)}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1" data-testid={`text-signed-at-${row.key}`}>
                          <Clock className="h-3.5 w-3.5 inline shrink-0" />
                          Aguardando
                        </span>
                      )}
                    </div>

                    {/* Signed PDF download */}
                    <div className="flex md:justify-center">
                      {row.signedPdfUrl ? (
                        <a href={row.signedPdfUrl} target="_blank" rel="noopener noreferrer">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 border-green-600/30 hover:border-green-600"
                            data-testid={`button-download-signed-${row.key}`}
                          >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Baixar PDF
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Resend */}
                    <div className="flex md:justify-center">
                      {(() => {
                        const alreadySigned = !!row.signedAt || row.status === "assinado";
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => row.docId && resendMutation.mutate(row.docId)}
                            disabled={!row.docId || resendMutation.isPending || alreadySigned}
                            title={alreadySigned ? "Já assinado" : "Reenviar e-mail de assinatura"}
                            data-testid={`button-resend-${row.key}`}
                          >
                            <MailCheck className="h-3.5 w-3.5 mr-1.5" />
                            Reenviar
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      <ContractPickerDialog
        open={contractPickerOpen}
        onClose={() => setContractPickerOpen(false)}
        contracts={contracts}
        onSelect={(c) => {
          openSendDialog(c.id, `${c.contractNumber} — ${c.title}`, "contract", (c.drivers && c.drivers[0]?.id) || c.driver?.id);
        }}
      />

      {sendTarget && (
        <SendDialog
          open={sendDialogOpen}
          onClose={() => { setSendDialogOpen(false); setSendTarget(null); }}
          contractId={sendTarget.id}
          contractLabel={sendTarget.label}
          type={sendTarget.type}
          initialDriverId={sendTarget.initialDriverId}
        />
      )}
    </div>
  );
}
