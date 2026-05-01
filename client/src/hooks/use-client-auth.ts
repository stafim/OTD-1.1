import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface ClientUser {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
}

const CLIENT_TOKEN_KEY = "clientPortalToken";

export function getClientToken(): string | null {
  return localStorage.getItem(CLIENT_TOKEN_KEY);
}

export function setClientToken(token: string): void {
  localStorage.setItem(CLIENT_TOKEN_KEY, token);
}

export function clearClientToken(): void {
  localStorage.removeItem(CLIENT_TOKEN_KEY);
}

async function fetchClientUser(): Promise<ClientUser | null> {
  const token = getClientToken();
  if (!token) return null;

  const response = await fetch("/api/auth/client-me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearClientToken();
    return null;
  }

  if (!response.ok) return null;
  return response.json();
}

export function useClientAuth() {
  const queryClient = useQueryClient();
  const { data: client, isLoading } = useQuery<ClientUser | null>({
    queryKey: ["/api/auth/client-me"],
    queryFn: fetchClientUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  function logout() {
    clearClientToken();
    queryClient.setQueryData(["/api/auth/client-me"], null);
    window.location.href = "/portal/login";
  }

  return {
    client,
    isLoading,
    isAuthenticated: !!client,
    logout,
  };
}

export function clientFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getClientToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}
