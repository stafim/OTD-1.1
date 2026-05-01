import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  // URLs já no formato correto
  if (url.startsWith("/objects/")) return url;
  // URLs antigas com prefixo /api/object-storage - remover prefixo
  if (url.startsWith("/api/object-storage/objects/")) {
    return url.replace("/api/object-storage", "");
  }
  return url;
}
