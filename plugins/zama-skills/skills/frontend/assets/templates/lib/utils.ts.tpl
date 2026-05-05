import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortAddr(addr: string | undefined | null): string {
  if (!addr) return "—";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHandle(h: string | null | undefined): string {
  if (!h) return "—";
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}
