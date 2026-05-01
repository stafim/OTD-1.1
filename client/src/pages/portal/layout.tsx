import { useLocation, Link } from "wouter";
import { useClientAuth } from "@/hooks/use-client-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Truck, Route, MapPin, LogOut, Building2, ChevronRight, ClipboardList } from "lucide-react";
import otdLogoPath from "@assets/logo_OTD_1772310881404.png";

const navItems = [
  { href: "/portal/estoque", label: "Estoque", icon: Package },
  { href: "/portal/coleta", label: "Coleta", icon: MapPin },
  { href: "/portal/transporte", label: "Transporte", icon: Truck },
  { href: "/portal/jornada", label: "Jornada do Veículo", icon: Route },
  { href: "/portal/pedir-chassi", label: "Pedir Chassi", icon: ClipboardList },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { client, isLoading, logout } = useClientAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    window.location.href = "/portal/login";
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <img src={otdLogoPath} alt="OTD Logistics" className="h-10 object-contain mb-2" />
          <div className="flex items-center gap-2 mt-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground">Portal do Cliente</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <a
                  data-testid={`nav-${href.split("/").pop()}`}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {active && <ChevronRight className="h-3 w-3 ml-auto" />}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
