import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, Users, MapPin, Shield, Zap } from "lucide-react";
import otdLogoPath from "@assets/logo_OTD_1772310881404.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={otdLogoPath} alt="OTD Logistics" className="h-10 object-contain" />
          </div>
          <Button asChild data-testid="button-login">
            <a href="/login">Entrar</a>
          </Button>
        </div>
      </header>

      <main>
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Gestão Inteligente de
              <br />
              <span className="text-primary">Entregas de Veículos</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Sistema completo para gerenciar coletas, transportes e entregas de veículos novos.
              Controle total do seu estoque e equipe de motoristas.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild data-testid="button-start">
                <a href="/login">Começar Agora</a>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Funcionalidades Principais
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Gestão de Transportes</CardTitle>
                  <CardDescription>
                    Crie e acompanhe transportes com numeração automática (OTD00001)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Controle completo desde a origem até a entrega final, com status em tempo real.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Controle de Coletas</CardTitle>
                  <CardDescription>
                    Gerencie coletas nas montadoras e movimentação entre pátios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Registre origem, destino e motorista responsável por cada coleta.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Gestão de Motoristas</CardTitle>
                  <CardDescription>
                    Cadastro completo com dados pessoais e documentação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    CNH, modalidade de contratação, endereço e histórico de entregas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Localização de Motoristas</CardTitle>
                  <CardDescription>
                    Notifique motoristas disponíveis e receba aceites
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Sistema de notificação para encontrar motoristas por rota e disponibilidade.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Controle de Estoque</CardTitle>
                  <CardDescription>
                    Acompanhe veículos por status e localização
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Pré-estoque, em estoque, despachado, entregue ou retirado.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Fácil de Usar</CardTitle>
                  <CardDescription>
                    Interface moderna e intuitiva
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Design responsivo para uso em desktop e dispositivos móveis.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>OTD Entregas - Sistema de Gestão de Entregas de Veículos</p>
        </div>
      </footer>
    </div>
  );
}
