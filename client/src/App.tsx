import { useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, urlToFeatureKey } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

import DriversPage from "@/pages/drivers/index";
import DriverFormPage from "@/pages/drivers/form";
import DriverProfilePage from "@/pages/drivers/profile";
import DriverPerformancePage from "@/pages/drivers/performance";
import DriverStatusPage from "@/pages/drivers/status";
import DriverDeletionRequestsPage from "@/pages/drivers/deletion-requests";
import SystemVersionsPage from "@/pages/system-versions/index";

import ManufacturersPage from "@/pages/manufacturers/index";
import ManufacturerFormPage from "@/pages/manufacturers/form";

import YardsPage from "@/pages/yards/index";
import YardFormPage from "@/pages/yards/form";

import ClientsPage from "@/pages/clients/index";
import ClientFormPage from "@/pages/clients/form";

import VehiclesPage from "@/pages/vehicles/index";
import VehicleFormPage from "@/pages/vehicles/form";

import TransportsPage from "@/pages/transports/index";
import TransportFormPage from "@/pages/transports/form";

import CollectsPage from "@/pages/collects/index";
import CollectFormPage from "@/pages/collects/form";

import DriverLocationPage from "@/pages/driver-location/index";
import UsersPage from "@/pages/users/index";
import UserFormPage from "@/pages/users/form";
import IntegrationsPage from "@/pages/integrations/index";
import ApiDocsPage from "@/pages/api-docs/index";
import PortariaPage from "@/pages/portaria/index";
import RoutingPage from "@/pages/routing/index";
import PrestacaoDeContasPage from "@/pages/prestacao-de-contas/index";
import DriverEvaluationsPage from "@/pages/driver-evaluations/index";
import EvaluationCriteriaPage from "@/pages/evaluation/index";
import ContractsPage from "@/pages/contracts/index";
import YardReportPage from "@/pages/yard-report/index";
import DriverRankingPage from "@/pages/driver-ranking/index";
import FinancialDashboardPage from "@/pages/financial-dashboard/index";
import RouteManagementPage from "@/pages/route-management/index";
import DamageReportPage from "@/pages/damage-report/index";
import TruckModelsPage from "@/pages/truck-models/index";
import TarifasViagemPage from "@/pages/tarifas-viagem/index";
import AprovacaoTarifaPage from "@/pages/aprovacao-tarifa/index";
import CotacaoFretePage from "@/pages/cotacao-frete/index";
import CotacaoFreteProPage from "@/pages/cotacao-frete-pro/index";
import ContratosFreteePage from "@/pages/contratos-frete/index";
import JornadaVeiculoPage from "@/pages/jornada-veiculo/index";
import RelatorioPropostasPage from "@/pages/relatorio-propostas/index";
import RelatorioPropostasJustificadasPage from "@/pages/relatorio-propostas-justificadas/index";
import RastreadoresPage from "@/pages/rastreadores/index";
import TransportProposalsPage from "@/pages/transport-proposals/index";
import TransportProposalDetailPage from "@/pages/transport-proposals/detail";
import AnalisePage from "@/pages/analise/index";
import AssinaturaDigitalPage from "@/pages/assinatura-digital/index";
import FechamentoMensalPage from "@/pages/fechamento-mensal/index";
import ApiLogsPage from "@/pages/api-logs/index";
import BackupPage from "@/pages/backup/index";
import PermissionsPage from "@/pages/permissions/index";
import BroadcastPage from "@/pages/broadcast/index";
import PushMessagesPage from "@/pages/push-messages/index";
import RankingConfigPage from "@/pages/ranking-config/index";
import EngajamentoPage from "@/pages/observabilidade/engajamento";
import DriverProfileMenuPage from "@/pages/driver-profile/index";

import ClientPortalLoginPage from "@/pages/portal/login";
import ClientPortalIndexPage from "@/pages/portal/index";
import PortalEstoquePage from "@/pages/portal/estoque";
import PortalColetaPage from "@/pages/portal/coleta";
import PortalTransportePage from "@/pages/portal/transporte";
import PortalJornadaPage from "@/pages/portal/jornada";
import PortalPedirChassPage from "@/pages/portal/pedir-chassi";
import SolicitacoesClientePage from "@/pages/solicitacoes-cliente/index";

function PortalRouter() {
  return (
    <Switch>
      <Route path="/portal/login" component={ClientPortalLoginPage} />
      <Route path="/portal/estoque" component={PortalEstoquePage} />
      <Route path="/portal/coleta" component={PortalColetaPage} />
      <Route path="/portal/transporte" component={PortalTransportePage} />
      <Route path="/portal/jornada" component={PortalJornadaPage} />
      <Route path="/portal/pedir-chassi" component={PortalPedirChassPage} />
      <Route path="/portal" component={ClientPortalIndexPage} />
    </Switch>
  );
}

function PermissionGuard() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const role = (user?.role as string) || "visualizador";
  const isBuiltIn = role === "admin" || role === "operador" || role === "visualizador";

  const { data: rolePerms } = useQuery<{ feature: string; canView: string }[]>({
    queryKey: ["/api/user-types", role, "permissions"],
    enabled: !!user && !isBuiltIn,
  });

  useEffect(() => {
    if (!user || isBuiltIn || !rolePerms || rolePerms.length === 0) return;
    const permMap: Record<string, boolean> = {};
    rolePerms.forEach(p => { permMap[p.feature] = p.canView !== "false"; });
    const matchPath = Object.keys(urlToFeatureKey)
      .filter(p => p === "/" ? location === "/" : location === p || location.startsWith(p + "/"))
      .sort((a, b) => b.length - a.length)[0];
    const featureKey = matchPath ? urlToFeatureKey[matchPath] : undefined;
    if (!featureKey) return;
    if (permMap[featureKey] !== false) return;
    const firstAllowed = Object.entries(urlToFeatureKey).find(([_, fk]) => permMap[fk] === true)?.[0];
    if (firstAllowed && firstAllowed !== location) {
      setLocation(firstAllowed);
    }
  }, [user, isBuiltIn, rolePerms, location, setLocation]);

  return null;
}

function AuthenticatedRouter() {
  return (
    <>
    <PermissionGuard />
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/motoristas" component={DriversPage} />
      <Route path="/informe-exclusao" component={DriverDeletionRequestsPage} />
      <Route path="/controle-versao" component={SystemVersionsPage} />
      <Route path="/performance-motoristas" component={DriverPerformancePage} />
      <Route path="/status-motoristas" component={DriverStatusPage} />
      <Route path="/motoristas/:id/perfil" component={DriverProfilePage} />
      <Route path="/motoristas/:id" component={DriverFormPage} />
      <Route path="/montadoras" component={ManufacturersPage} />
      <Route path="/montadoras/:id" component={ManufacturerFormPage} />
      <Route path="/patios" component={YardsPage} />
      <Route path="/patios/:id" component={YardFormPage} />
      <Route path="/clientes" component={ClientsPage} />
      <Route path="/clientes/:id" component={ClientFormPage} />
      <Route path="/estoque" component={VehiclesPage} />
      <Route path="/estoque/:chassi" component={VehicleFormPage} />
      <Route path="/transportes" component={TransportsPage} />
      <Route path="/transportes/:id" component={TransportFormPage} />
      <Route path="/coletas" component={CollectsPage} />
      <Route path="/coletas/novo" component={CollectFormPage} />
      <Route path="/proposta-transporte" component={TransportProposalsPage} />
      <Route path="/proposta-transporte/:id" component={TransportProposalDetailPage} />
      <Route path="/portaria" component={PortariaPage} />
      <Route path="/avaliacao" component={DriverEvaluationsPage} />
      <Route path="/criterios-avaliacao" component={EvaluationCriteriaPage} />
      <Route path="/rotograma" component={RoutingPage} />
      <Route path="/prestacao-de-contas" component={PrestacaoDeContasPage} />
      <Route path="/relatorio-patio" component={YardReportPage} />
      <Route path="/ranking-motoristas" component={DriverRankingPage} />
      <Route path="/dashboard-financeiro" component={FinancialDashboardPage} />
      <Route path="/gestao-rotas" component={RouteManagementPage} />
      <Route path="/relatorio-avarias" component={DamageReportPage} />
      <Route path="/modelos" component={TruckModelsPage} />
      <Route path="/tarifas-viagem" component={TarifasViagemPage} />
      <Route path="/aprovacao-tarifa" component={AprovacaoTarifaPage} />
      <Route path="/cotacao-frete" component={CotacaoFretePage} />
      <Route path="/cotacao-frete-pro" component={CotacaoFreteProPage} />
      <Route path="/contratos-frete" component={ContratosFreteePage} />
      <Route path="/jornada-veiculo" component={JornadaVeiculoPage} />
      <Route path="/relatorio-propostas" component={RelatorioPropostasPage} />
      <Route path="/relatorio-propostas-justificadas" component={RelatorioPropostasJustificadasPage} />
      <Route path="/rastreadores" component={RastreadoresPage} />
      <Route path="/analise" component={AnalisePage} />
      <Route path="/contratos" component={ContractsPage} />
      <Route path="/assinatura-digital" component={AssinaturaDigitalPage} />
      <Route path="/fechamento-mensal" component={FechamentoMensalPage} />
      <Route path="/usuarios" component={UsersPage} />
      <Route path="/usuarios/:id" component={UserFormPage} />
      <Route path="/integracoes" component={IntegrationsPage} />
      <Route path="/lista-endpoints" component={ApiDocsPage} />
      <Route path="/logs-api" component={ApiLogsPage} />
      <Route path="/backup" component={BackupPage} />
      <Route path="/permissoes" component={PermissionsPage} />
      <Route path="/broadcast" component={BroadcastPage} />
      <Route path="/push-mensagens" component={PushMessagesPage} />
      <Route path="/ranking-config" component={RankingConfigPage} />
      <Route path="/observabilidade/engajamento" component={EngajamentoPage} />
      <Route path="/perfil-motorista" component={DriverProfileMenuPage} />
      <Route path="/solicitacoes-cliente" component={SolicitacoesClientePage} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <AuthenticatedRouter />
        </main>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Portal do cliente: rotas /portal/* são totalmente independentes
  if (location.startsWith("/portal")) {
    return <PortalRouter />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
