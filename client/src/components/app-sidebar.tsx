import { Link, useLocation } from "wouter";
import otdLogoPath from "@assets/logo_OTD_1772310881404.png";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Truck,
  Package,
  MapPin,
  Users,
  Factory,
  Building2,
  Warehouse,
  LayoutDashboard,
  LogOut,
  UserCog,
  Code,
  Link2,
  Radio,
  DoorOpen,
  Route,
  Receipt,
  ClipboardCheck,
  FileBarChart,
  AlertTriangle,
  Trophy,
  DollarSign,
  ShieldAlert,
  CarFront,
  Sparkles,
  FileText,
  Activity,
  BrainCircuit,
  TrendingUp,
  PenLine,
  HardDrive,
  ClipboardList,
  Wifi,
  Shield,
  Bell,
  BarChart3,
  Contact,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

type UserRole = "admin" | "operador" | "visualizador" | "motorista" | "portaria";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const dadosItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Consulta Inteligente",
    url: "/analise",
    icon: BrainCircuit,
  },
];

const operationItems: MenuItem[] = [
  {
    title: "Coletas",
    url: "/coletas",
    icon: Package,
  },
  {
    title: "Transportes",
    url: "/transportes",
    icon: Truck,
  },
  {
    title: "Proposta de Transporte",
    url: "/proposta-transporte",
    icon: ClipboardList,
  },
  {
    title: "Aprovação de Tarifa",
    url: "/aprovacao-tarifa",
    icon: ClipboardCheck,
  },
  {
    title: "Portaria",
    url: "/portaria",
    icon: DoorOpen,
  },
  {
    title: "Solicitações Cliente",
    url: "/solicitacoes-cliente",
    icon: ClipboardList,
  },
];

const motoristaItems: MenuItem[] = [
  {
    title: "Perfil do Motorista",
    url: "/perfil-motorista",
    icon: Contact,
  },
  {
    title: "Status dos Motoristas",
    url: "/status-motoristas",
    icon: Wifi,
  },
  {
    title: "Performance Motorista",
    url: "/performance-motoristas",
    icon: TrendingUp,
  },
  {
    title: "Ranking de Motoristas",
    url: "/ranking-motoristas",
    icon: Trophy,
  },
  {
    title: "Avaliação",
    url: "/avaliacao",
    icon: ClipboardCheck,
  },
  {
    title: "Critérios de Avaliação",
    url: "/criterios-avaliacao",
    icon: FileBarChart,
  },
  {
    title: "Mensagens",
    url: "/broadcast",
    icon: Radio,
  },
  {
    title: "Informe de Exclusão LGPD",
    url: "/informe-exclusao",
    icon: ShieldAlert,
  },
];

const relatoriosItems: MenuItem[] = [
  {
    title: "Jornada do Veículo",
    url: "/jornada-veiculo",
    icon: Activity,
  },
  {
    title: "Relatório de Avarias",
    url: "/relatorio-avarias",
    icon: ShieldAlert,
  },
  {
    title: "Propostas de Transporte",
    url: "/relatorio-propostas",
    icon: ClipboardList,
  },
  {
    title: "Propostas Justificadas",
    url: "/relatorio-propostas-justificadas",
    icon: AlertTriangle,
  },
];

const financeiroItems: MenuItem[] = [
  {
    title: "Prestação de Contas",
    url: "/prestacao-de-contas",
    icon: Receipt,
  },
  {
    title: "Dashboard Financeiro",
    url: "/dashboard-financeiro",
    icon: DollarSign,
  },
  {
    title: "Relatório de Pátio",
    url: "/relatorio-patio",
    icon: FileBarChart,
  },
  {
    title: "Fechamento Mensal",
    url: "/fechamento-mensal",
    icon: Receipt,
  },
];

const cadastroItems: MenuItem[] = [
  {
    title: "Motoristas",
    url: "/motoristas",
    icon: Users,
  },
  {
    title: "Rastreadores",
    url: "/rastreadores",
    icon: Radio,
  },
  {
    title: "Montadoras",
    url: "/montadoras",
    icon: Factory,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Building2,
  },
  {
    title: "Pátios",
    url: "/patios",
    icon: Warehouse,
  },
  {
    title: "Estoque",
    url: "/estoque",
    icon: Package,
  },
  {
    title: "Modelos",
    url: "/modelos",
    icon: CarFront,
  },
  {
    title: "Tarifas de Viagem",
    url: "/tarifas-viagem",
    icon: DollarSign,
  },
  {
    title: "Gestão de Rotas",
    url: "/gestao-rotas",
    icon: Route,
  },
  {
    title: "Gestor de Contratos",
    url: "/contratos",
    icon: FileBarChart,
  },
  {
    title: "Contratos de Frete",
    url: "/contratos-frete",
    icon: FileText,
  },
  {
    title: "Assinatura Digital",
    url: "/assinatura-digital",
    icon: PenLine,
  },
  {
    title: "Cotação de Frete",
    url: "/cotacao-frete-pro",
    icon: Sparkles,
  },
];

const observabilidadeItems: MenuItem[] = [
  {
    title: "Engajamento",
    url: "/observabilidade/engajamento",
    icon: BarChart3,
  },
];

const configItems: MenuItem[] = [
  {
    title: "Usuários",
    url: "/usuarios",
    icon: UserCog,
  },
  {
    title: "Integrações",
    url: "/integracoes",
    icon: Link2,
  },
  {
    title: "Lista de Endpoints",
    url: "/lista-endpoints",
    icon: Code,
  },
  {
    title: "Log de API",
    url: "/logs-api",
    icon: Activity,
  },
  {
    title: "Backup",
    url: "/backup",
    icon: HardDrive,
  },
  {
    title: "Permissões",
    url: "/permissoes",
    icon: Shield,
  },
  {
    title: "Mensagens",
    url: "/push-mensagens",
    icon: Bell,
  },
  {
    title: "Ranking Motoristas",
    url: "/ranking-config",
    icon: Trophy,
  },
  {
    title: "Controle de Versão",
    url: "/controle-versao",
    icon: GitBranch,
  },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  operador: "Operador",
  visualizador: "Visualizador",
  motorista: "Motorista",
  portaria: "Portaria",
};

// Map sidebar URL → feature key (from menuFeatures in schema)
export const urlToFeatureKey: Record<string, string> = {
  "/": "dashboard",
  "/analise": "consulta-inteligente",
  "/coletas": "coletas",
  "/transportes": "transportes",
  "/proposta-transporte": "proposta-transporte",
  "/aprovacao-tarifa": "aprovacao-tarifa",
  "/portaria": "portaria",
  "/solicitacoes-cliente": "solicitacoes-cliente",
  "/perfil-motorista": "perfil-motorista",
  "/status-motoristas": "status-motoristas",
  "/performance-motoristas": "performance-motoristas",
  "/ranking-motoristas": "ranking-motoristas",
  "/avaliacao": "avaliacao",
  "/criterios-avaliacao": "criterios-avaliacao",
  "/broadcast": "broadcast",
  "/informe-exclusao": "informe-exclusao",
  "/jornada-veiculo": "jornada-veiculo",
  "/relatorio-avarias": "relatorio-avarias",
  "/relatorio-propostas": "relatorio-propostas",
  "/relatorio-propostas-justificadas": "relatorio-propostas-justificadas",
  "/observabilidade/engajamento": "observabilidade-engajamento",
  "/push-mensagens": "push-mensagens",
  "/ranking-config": "ranking-config",
  "/controle-versao": "controle-versao",
  "/prestacao-de-contas": "prestacao-de-contas",
  "/dashboard-financeiro": "dashboard-financeiro",
  "/relatorio-patio": "relatorio-patio",
  "/fechamento-mensal": "fechamento-mensal",
  "/motoristas": "cadastro-motoristas",
  "/rastreadores": "rastreadores",
  "/montadoras": "montadoras",
  "/clientes": "clientes",
  "/patios": "patios",
  "/estoque": "estoque",
  "/modelos": "modelos",
  "/tarifas-viagem": "tarifas-viagem",
  "/gestao-rotas": "gestao-rotas",
  "/contratos": "contratos",
  "/contratos-frete": "contratos-frete",
  "/assinatura-digital": "assinatura-digital",
  "/cotacao-frete-pro": "cotacao-frete",
  "/usuarios": "usuarios",
  "/integracoes": "integracoes",
  "/lista-endpoints": "lista-endpoints",
  "/logs-api": "logs-api",
  "/backup": "backup",
  "/permissoes": "permissoes",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();

  const userRole: UserRole = (user?.role as UserRole) || "visualizador";
  const isAdmin = userRole === "admin";

  // Fetch permissions for non-admin custom roles (operador, etc.)
  const { data: rolePermissions } = useQuery<{ feature: string; canView: string }[]>({
    queryKey: ["/api/user-types", userRole, "permissions"],
    enabled: !isAdmin && !!user,
  });

  // Build a map: featureKey → canView (true = visible)
  const permMap = (rolePermissions || []).reduce<Record<string, boolean>>((acc, p) => {
    acc[p.feature] = p.canView !== "false";
    return acc;
  }, {});
  const hasAnyPermissionConfig = (rolePermissions?.length ?? 0) > 0;

  // Returns true if the user can see a given sidebar URL
  const canSee = (url: string): boolean => {
    if (isAdmin) return true;
    const featureKey = urlToFeatureKey[url];
    if (!featureKey) return true; // unknown URLs are always visible
    if (!hasAnyPermissionConfig) return true; // no config = show all
    // If not in permMap, default to visible; if in permMap, respect canView
    return featureKey in permMap ? permMap[featureKey] : true;
  };

  const { data: pendingEvaluations } = useQuery<any[]>({
    queryKey: ["/api/driver-evaluations/pending-transports"],
    refetchInterval: 30000,
  });

  const { data: systemVersionsData } = useQuery<{ id: string; type: string; version: string; deployDate: string }[]>({
    queryKey: ["/api/system-versions"],
    enabled: !!user,
  });
  const latestWebVersion = (systemVersionsData || [])
    .filter((v) => v.type === "web")
    .sort((a, b) => new Date(b.deployDate).getTime() - new Date(a.deployDate).getTime())[0]?.version;

  const { data: pendingRateApprovals } = useQuery<any[]>({
    queryKey: ["/api/transport-rate-approvals"],
    refetchInterval: 30000,
  });

  const getLastViewedDamage = () => localStorage.getItem("lastViewedDamageReport") ?? "";
  const { data: newDamageData } = useQuery<{ count: number }>({
    queryKey: ["/api/damage-reports/new-count"],
    queryFn: async () => {
      const since = getLastViewedDamage();
      const url = since
        ? `/api/damage-reports/new-count?since=${encodeURIComponent(since)}`
        : "/api/damage-reports/new-count";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30 * 60 * 1000,
  });

  const pendingCount = pendingEvaluations?.length || 0;
  const pendingRateApprovalsCount = pendingRateApprovals?.length || 0;
  const newDamageCount = newDamageData?.count || 0;

  const getInitials = () => {
    if (!user) return "U";
    const first = user.firstName?.[0] || "";
    const last = user.lastName?.[0] || "";
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center">
          <img
            src={otdLogoPath}
            alt="OTD Logistics"
            className="h-12 object-contain"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {dadosItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Dados</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dadosItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {operationItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {operationItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {relatoriosItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Relatórios</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {relatoriosItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "")}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.url === "/relatorio-avarias" && newDamageCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-4 flex items-center justify-center" data-testid="badge-new-damage-reports">
                            {newDamageCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {motoristaItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Motorista</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {motoristaItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "")}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="flex-1">{item.title}</span>
                        {item.url === "/avaliacao" && pendingCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-4 flex items-center justify-center">
                            {pendingCount}
                          </Badge>
                        )}
                        {item.url === "/aprovacao-tarifa" && pendingRateApprovalsCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-4 flex items-center justify-center">
                            {pendingRateApprovalsCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {financeiroItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {financeiroItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {cadastroItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {cadastroItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {observabilidadeItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Observabilidade</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {observabilidadeItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace(/\//g, "-").replace(/^-/, "")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {configItems.filter(i => canSee(i.url)).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Configurações</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configItems.filter(i => canSee(i.url)).map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "")}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">
              {user?.firstName || user?.email || "Usuário"}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {roleLabels[userRole] || userRole}
              </Badge>
              {latestWebVersion && (
                <span
                  className="text-[10px] text-muted-foreground truncate"
                  data-testid="text-system-version"
                >
                  v{latestWebVersion}
                </span>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-logout"
            className="group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
