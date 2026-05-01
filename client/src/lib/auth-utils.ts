export function isUnauthorizedError(error: Error): boolean {
  return /^401: /.test(error.message);
}

export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Sessão expirada",
      description: "Faça login novamente para continuar.",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = "/login";
  }, 500);
}
