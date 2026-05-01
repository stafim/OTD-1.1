import { PageHeader } from "@/components/page-header";
import { Radio } from "lucide-react";

export default function RastreadoresPage() {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Rastreadores"
        breadcrumbs={[
          { label: "Cadastros", href: "/motoristas" },
          { label: "Rastreadores" },
        ]}
      />
      <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground">
        <div className="text-center space-y-3">
          <Radio className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-lg font-medium">Rastreadores</p>
          <p className="text-sm">Esta funcionalidade está sendo configurada.</p>
        </div>
      </div>
    </div>
  );
}
