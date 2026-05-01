import { useEffect } from "react";
import { useLocation } from "wouter";
import { useClientAuth } from "@/hooks/use-client-auth";
import { Loader2 } from "lucide-react";

export default function PortalIndexPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useClientAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setLocation("/portal/estoque");
      } else {
        setLocation("/portal/login");
      }
    }
  }, [isAuthenticated, isLoading, setLocation]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
