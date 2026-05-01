import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FileText,
  Eye,
  Bold,
  Italic,
  UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Tags,
  X,
  Check,
  Users,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertContractSchema, type Contract, type Driver } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";

type ContractWithDriver = Contract & {
  driver: Driver | null;
  drivers?: Driver[];
  driverIds?: string[];
};

function DriversMultiSelect({
  drivers,
  value,
  onChange,
  testId,
}: {
  drivers: Driver[];
  value: string[];
  onChange: (ids: string[]) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDrivers = drivers.filter((d) => value.includes(d.id));
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="w-full justify-between font-normal"
            data-testid={testId}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              {value.length === 0
                ? "Selecione um ou mais motoristas"
                : `${value.length} motorista${value.length > 1 ? "s" : ""} selecionado${value.length > 1 ? "s" : ""}`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar motorista..." />
            <CommandList>
              <CommandEmpty>Nenhum motorista encontrado.</CommandEmpty>
              <CommandGroup>
                {drivers.length > 0 && (
                  <CommandItem
                    onSelect={() => onChange(value.length === drivers.length ? [] : drivers.map((d) => d.id))}
                    data-testid="multiselect-driver-all"
                  >
                    <Check className={`mr-2 h-4 w-4 ${value.length === drivers.length ? "opacity-100" : "opacity-0"}`} />
                    {value.length === drivers.length ? "Desmarcar todos" : "Selecionar todos"}
                  </CommandItem>
                )}
                {drivers.map((d) => {
                  const checked = value.includes(d.id);
                  return (
                    <CommandItem
                      key={d.id}
                      onSelect={() => toggle(d.id)}
                      data-testid={`multiselect-driver-${d.id}`}
                    >
                      <Check className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex-1">{d.name}</span>
                      {d.email && <span className="text-xs text-muted-foreground">{d.email}</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedDrivers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedDrivers.map((d) => (
            <Badge
              key={d.id}
              variant="secondary"
              className="gap-1 pr-1"
              data-testid={`badge-selected-driver-${d.id}`}
            >
              {d.name}
              <button
                type="button"
                onClick={() => toggle(d.id)}
                className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remover ${d.name}`}
                data-testid={`button-remove-driver-${d.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

const contractTypeLabels: Record<string, string> = {
  pj: "PJ",
  clt: "CLT",
  agregado: "Agregado",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  suspenso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  expirado: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBold().run()}
        data-testid="button-bold"
        className="toggle-elevate"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        data-testid="button-italic"
        className="toggle-elevate"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("underline") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        data-testid="button-underline"
        className="toggle-elevate"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        type="button"
        size="icon"
        variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        data-testid="button-h1"
        className="toggle-elevate"
      >
        <span className="text-xs font-bold">H1</span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        data-testid="button-h2"
        className="toggle-elevate"
      >
        <span className="text-xs font-bold">H2</span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        data-testid="button-h3"
        className="toggle-elevate"
      >
        <span className="text-xs font-bold">H3</span>
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        type="button"
        size="icon"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        data-testid="button-bullet-list"
        className="toggle-elevate"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive("orderedList") ? "default" : "ghost"}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        data-testid="button-ordered-list"
        className="toggle-elevate"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        type="button"
        size="icon"
        variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        data-testid="button-align-left"
        className="toggle-elevate"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        data-testid="button-align-center"
        className="toggle-elevate"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        data-testid="button-align-right"
        className="toggle-elevate"
      >
        <AlignRight className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        data-testid="button-undo"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        data-testid="button-redo"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

const CONTRACT_VARIABLES = [
  {
    group: "Motorista",
    items: [
      { label: "Nome completo", value: "{{motorista.nome}}" },
      { label: "CPF", value: "{{motorista.cpf}}" },
      { label: "RG", value: "{{motorista.rg}}" },
      { label: "CNPJ", value: "{{motorista.cnpj}}" },
      { label: "Razão Social", value: "{{motorista.razaoSocial}}" },
      { label: "E-mail", value: "{{motorista.email}}" },
      { label: "Telefone", value: "{{motorista.telefone}}" },
      { label: "Data de nascimento", value: "{{motorista.dataNascimento}}" },
      { label: "CEP", value: "{{motorista.cep}}" },
      { label: "Endereço", value: "{{motorista.endereco}}" },
      { label: "Número", value: "{{motorista.numero}}" },
      { label: "Complemento", value: "{{motorista.complemento}}" },
      { label: "Bairro", value: "{{motorista.bairro}}" },
      { label: "Cidade", value: "{{motorista.cidade}}" },
      { label: "Estado", value: "{{motorista.estado}}" },
      { label: "Tipo de CNH", value: "{{motorista.cnh}}" },
      { label: "Tipo (PJ/CLT/Agregado)", value: "{{motorista.tipo}}" },
      { label: "Modalidade", value: "{{motorista.modalidade}}" },
    ],
  },
  {
    group: "Contrato",
    items: [
      { label: "Número do contrato", value: "{{contrato.numero}}" },
      { label: "Título", value: "{{contrato.titulo}}" },
      { label: "Tipo", value: "{{contrato.tipo}}" },
    ],
  },
  {
    group: "Data",
    items: [
      { label: "Data de hoje", value: "{{data.hoje}}" },
      { label: "Mês atual", value: "{{data.mes}}" },
      { label: "Ano atual", value: "{{data.ano}}" },
    ],
  },
];

function VariablesPanel({ editor }: { editor: any }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ Motorista: true });
  const { toast } = useToast();

  const insertVariable = (value: string) => {
    if (editor) {
      editor.chain().focus().insertContent(value).run();
    } else {
      navigator.clipboard.writeText(value);
      toast({ title: "Variável copiada!", description: value });
    }
  };

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <Card className="h-fit">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Tags className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Variáveis Disponíveis</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Clique para inserir no contrato. Serão substituídas pelos dados reais do motorista ao enviar.
        </p>
        <div className="space-y-2">
          {CONTRACT_VARIABLES.map((group) => (
            <div key={group.group}>
              <button
                type="button"
                className="flex items-center gap-1 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground py-1"
                onClick={() => toggleGroup(group.group)}
                data-testid={`button-toggle-group-${group.group}`}
              >
                {openGroups[group.group] ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {group.group}
              </button>
              {openGroups[group.group] && (
                <div className="space-y-1 ml-1">
                  {group.items.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => insertVariable(item.value)}
                      className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted group"
                      data-testid={`button-var-${item.value}`}
                    >
                      <span className="text-foreground">{item.label}</span>
                      <code className="text-[10px] text-primary bg-primary/10 px-1 rounded font-mono opacity-80 group-hover:opacity-100">
                        {item.value}
                      </code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type ViewMode = "list" | "editor" | "view";

export default function ContractsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingContract, setEditingContract] = useState<ContractWithDriver | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractWithDriver | null>(null);
  const { toast } = useToast();

  const { data: contractsList, isLoading } = useQuery<ContractWithDriver[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: driversList } = useQuery<Driver[]>({
    queryKey: ["/api/drivers"],
  });

  const formSchema = z.object({
    contractNumber: z.string().min(1, "Número do contrato é obrigatório"),
    title: z.string().min(1, "Título é obrigatório"),
    driverIds: z.array(z.string()).default([]),
    contractType: z.enum(["pj", "clt", "agregado"]),
    status: z.enum(["ativo", "suspenso", "expirado", "cancelado"]).optional(),
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contractNumber: "",
      title: "",
      driverIds: [],
      contractType: "pj",
      status: "ativo",
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Digite o conteúdo do contrato aqui..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "p-4 min-h-[400px] focus:outline-none",
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        driverIds: data.driverIds || [],
        content: editor?.getHTML() || "",
      };
      await apiRequest("POST", "/api/contracts", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contrato criado com sucesso" });
      handleBackToList();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao criar contrato", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormValues }) => {
      const payload = {
        ...data,
        driverIds: data.driverIds || [],
        content: editor?.getHTML() || "",
      };
      await apiRequest("PATCH", `/api/contracts/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contrato atualizado com sucesso" });
      handleBackToList();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Erro ao atualizar contrato", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Contrato excluído com sucesso" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir contrato", variant: "destructive" });
    },
  });

  const handleBackToList = () => {
    setViewMode("list");
    setEditingContract(null);
    setViewingContract(null);
    form.reset({
      contractNumber: "",
      title: "",
      driverIds: [],
      contractType: "pj",
      status: "ativo",
    });
    editor?.commands.setContent("");
  };

  const handleNewContract = () => {
    setEditingContract(null);
    form.reset({
      contractNumber: "",
      title: "",
      driverIds: [],
      contractType: "pj",
      status: "ativo",
    });
    editor?.commands.setContent("");
    setViewMode("editor");
  };

  const handleEdit = (contract: ContractWithDriver) => {
    setEditingContract(contract);
    form.reset({
      contractNumber: contract.contractNumber,
      title: contract.title || "",
      driverIds:
        contract.driverIds && contract.driverIds.length > 0
          ? contract.driverIds
          : contract.driverId
            ? [contract.driverId]
            : [],
      contractType: contract.contractType as "pj" | "clt" | "agregado",
      status: contract.status as "ativo" | "suspenso" | "expirado" | "cancelado",
    });
    editor?.commands.setContent(contract.content || "");
    setViewMode("editor");
  };

  const handleView = (contract: ContractWithDriver) => {
    setViewingContract(contract);
    setViewMode("view");
  };

  const onSubmit = (data: FormValues) => {
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredContracts = contractsList?.filter((c) => {
    const q = search.toLowerCase();
    const driversMatch = (c.drivers || (c.driver ? [c.driver] : [])).some((d) =>
      d?.name?.toLowerCase().includes(q),
    );
    const matchesSearch =
      c.contractNumber.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      driversMatch;
    const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: contractsList?.length || 0,
    ativos: contractsList?.filter((c) => c.status === "ativo").length || 0,
    suspensos: contractsList?.filter((c) => c.status === "suspenso").length || 0,
    expirados: contractsList?.filter((c) => c.status === "expirado").length || 0,
  };

  if (viewMode === "view" && viewingContract) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleBackToList} data-testid="button-back-from-view">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" data-testid="text-view-title">{viewingContract.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{viewingContract.contractNumber}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[viewingContract.status] || ""}`}>
                {statusLabels[viewingContract.status] || viewingContract.status}
              </span>
              {viewingContract.driver && (
                <span className="text-sm text-muted-foreground">
                  Motorista: {viewingContract.driver.name}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => handleEdit(viewingContract)} data-testid="button-edit-from-view">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 overflow-y-auto max-h-[70vh]">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: viewingContract.content || "<p>Contrato sem conteúdo.</p>" }}
              data-testid="text-contract-content"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewMode === "editor") {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleBackToList} data-testid="button-back-from-editor">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-xl font-bold">
            {editingContract ? "Editar Contrato" : "Novo Contrato"}
          </h1>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 items-start">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 min-w-0">
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="contractNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número do Contrato *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: CTR-001" {...field} data-testid="input-contract-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Título do Contrato *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Contrato de Prestação de Serviço" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="driverIds"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Motoristas vinculados</FormLabel>
                          <FormControl>
                            <DriversMultiSelect
                              drivers={driversList || []}
                              value={field.value || []}
                              onChange={field.onChange}
                              testId="select-drivers"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Um contrato pode ser vinculado a um ou mais motoristas. Cada motorista receberá o documento de assinatura individualmente.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contractType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-contract-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pj">PJ</SelectItem>
                              <SelectItem value="clt">CLT</SelectItem>
                              <SelectItem value="agregado">Agregado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <EditorToolbar editor={editor} />
                  <div className="overflow-y-auto max-h-[60vh]">
                    <EditorContent editor={editor} />
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleBackToList} data-testid="button-cancel-editor">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-contract"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : editingContract ? "Salvar Alterações" : "Criar Contrato"}
                </Button>
              </div>
            </form>
          </Form>

          <div className="w-full xl:w-72 shrink-0">
            <VariablesPanel editor={editor} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Gestor de Contratos" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold" data-testid="text-total-contracts">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-green-500/10">
                <FileText className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold" data-testid="text-active-contracts">{stats.ativos}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <FileText className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl font-bold" data-testid="text-suspended-contracts">{stats.suspensos}</p>
                <p className="text-xs text-muted-foreground">Suspensos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xl font-bold" data-testid="text-expired-contracts">{stats.expirados}</p>
                <p className="text-xs text-muted-foreground">Expirados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, título ou motorista..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-contracts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="suspenso">Suspensos</SelectItem>
            <SelectItem value="expirado">Expirados</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleNewContract} data-testid="button-new-contract">
          <Plus className="h-4 w-4 mr-2" />
          Novo Contrato
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredContracts && filteredContracts.length > 0 ? (
        <div className="space-y-2">
          {filteredContracts.map((contract) => (
            <Card key={contract.id} className="hover-elevate cursor-pointer" data-testid={`card-contract-${contract.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0" onClick={() => handleView(contract)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate" data-testid={`text-contract-title-${contract.id}`}>
                        {contract.title || "Sem título"}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[contract.status] || ""}`}>
                        {statusLabels[contract.status] || contract.status}
                      </span>
                      <Badge variant="outline">
                        {contractTypeLabels[contract.contractType] || contract.contractType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span data-testid={`text-contract-number-${contract.id}`}>{contract.contractNumber}</span>
                      {(() => {
                        const linked = contract.drivers && contract.drivers.length > 0
                          ? contract.drivers
                          : contract.driver ? [contract.driver] : [];
                        if (linked.length === 0) return null;
                        return (
                          <span className="flex items-center gap-1" data-testid={`text-contract-drivers-${contract.id}`}>
                            <Users className="h-3 w-3" />
                            <span>{linked.length} {linked.length === 1 ? "motorista" : "motoristas"}</span>
                          </span>
                        );
                      })()}
                      {contract.createdAt && (
                        <span>Criado em: {format(new Date(contract.createdAt), "dd/MM/yyyy")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleView(contract); }}
                      data-testid={`button-view-contract-${contract.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleEdit(contract); }}
                      data-testid={`button-edit-contract-${contract.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(contract.id); }}
                      data-testid={`button-delete-contract-${contract.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum contrato encontrado</p>
            <Button className="mt-4" onClick={handleNewContract} data-testid="button-new-contract-empty">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Contrato
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
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
