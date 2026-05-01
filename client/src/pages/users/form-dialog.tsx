import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import type { SystemUser } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type UserType = {
  id: string;
  name: string;
  description: string | null;
  isSystem: string;
};

const formSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().optional(),
  role: z.string().min(1, "Perfil é obrigatório"),
  isActive: z.string().default("true"),
});

type FormData = z.infer<typeof formSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
}

export function UserFormDialog({ open, onOpenChange, userId }: UserFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!userId;

  const { data: user, isLoading } = useQuery<SystemUser>({
    queryKey: ["/api/system-users", userId],
    enabled: isEditing && open,
  });

  const { data: userTypes = [], isLoading: loadingTypes } = useQuery<UserType[]>({
    queryKey: ["/api/user-types"],
    enabled: open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(
      isEditing
        ? formSchema.extend({ password: z.string().optional() })
        : formSchema.extend({ password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres") })
    ),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      role: "operador",
      isActive: "true",
    },
  });

  useEffect(() => {
    if (user && isEditing) {
      form.reset({
        name: user.name,
        email: user.email,
        username: user.username,
        password: "",
        role: user.role,
        isActive: user.isActive || "true",
      });
    } else if (!isEditing && open) {
      form.reset({
        name: "",
        email: "",
        username: "",
        password: "",
        role: "operador",
        isActive: "true",
      });
    }
  }, [user, form, isEditing, open]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = { ...data };
      if (isEditing && !payload.password) {
        delete payload.password;
      }
      if (isEditing) {
        return apiRequest("PATCH", `/api/system-users/${userId}`, payload);
      }
      return apiRequest("POST", "/api/system-users", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-users"] });
      toast({ title: isEditing ? "Usuário atualizado!" : "Usuário cadastrado!" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/system-users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-users"] });
      toast({ title: "Usuário excluído!" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Erro ao excluir usuário", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{isEditing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
        </DialogHeader>

        {isEditing && isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-8rem)] px-6 pb-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do usuário" {...field} data-testid="input-user-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} data-testid="input-user-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 grid-cols-2">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuário *</FormLabel>
                        <FormControl>
                          <Input placeholder="Login" {...field} data-testid="input-user-username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isEditing ? "Nova Senha" : "Senha *"}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={isEditing ? "Deixe em branco para manter" : "Senha"}
                            {...field}
                            data-testid="input-user-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perfil *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-role" disabled={loadingTypes}>
                            <SelectValue placeholder={loadingTypes ? "Carregando perfis..." : "Selecione o perfil"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {userTypes.map(ut => (
                            <SelectItem key={ut.id} value={ut.id}>
                              {ut.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Usuário Ativo</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Pode acessar o sistema
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === "true"}
                          onCheckedChange={(checked) => field.onChange(checked ? "true" : "false")}
                          data-testid="switch-user-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between gap-4 pt-4 border-t">
                  {isEditing ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm" data-testid="button-delete-user">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O usuário será permanentemente removido do sistema.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      data-testid="button-cancel"
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={mutation.isPending} data-testid="button-save-user">
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isEditing ? "Salvar" : "Cadastrar"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
