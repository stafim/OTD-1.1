import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken, clearTokens, setTokens, getRefreshToken } from "@/hooks/use-auth";

// Singleton promise to prevent concurrent refresh races
let refreshPromise: Promise<string | null> | null = null;

function redirectToLogin() {
  clearTokens();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      redirectToLogin();
      return null;
    }

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        redirectToLogin();
        return null;
      }

      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      redirectToLogin();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getAuthHeaders(contentType?: string): HeadersInit {
  const headers: HeadersInit = {};
  const token = getAccessToken();
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers = getAuthHeaders(data ? "application/json" : undefined);
  
  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders = getAuthHeaders(data ? "application/json" : undefined);
      res = await fetch(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
      });
    } else {
      return res;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = getAuthHeaders();
    
    let res = await fetch(queryKey.join("/") as string, {
      headers,
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders = getAuthHeaders();
        res = await fetch(queryKey.join("/") as string, {
          headers: retryHeaders,
        });
      } else {
        if (unauthorizedBehavior === "returnNull") return null;
        return null;
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
