import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AVATAR_COLORS = [
  { bg: "#dcfce7", fg: "#166534", dark: "#86efac" },
  { bg: "#e5eef9", fg: "#2c5d93", dark: "#93c5fd" },
  { bg: "#f8ecdd", fg: "#94560f", dark: "#fbbf7a" },
  { bg: "#f0e7f7", fg: "#6a3a8e", dark: "#d8b4fe" },
  { bg: "#fde4e4", fg: "#9b2c2c", dark: "#fca5a5" },
  { bg: "#d9f2f1", fg: "#1d6b68", dark: "#5eead4" },
  { bg: "#fdf3c7", fg: "#7a5a00", dark: "#fcd34d" },
  { bg: "#e6e8fb", fg: "#3b3f9e", dark: "#a5b4fc" },
] as const;

export function avatarColor(index: number) {
  return AVATAR_COLORS[((index % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
}

export function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function parseNames(input: string): string[] {
  return input
    .split(/[,\n;&]|\s+and\s+|\s+dan\s+/i)
    .map((s) => s.trim().replace(/\s+/g, " ").slice(0, 30))
    .filter(Boolean);
}

export const rm = (minor: number) =>
  `RM ${(minor / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const CODE_LENGTH = 8;
export const isCode = (id: string) => id.length === CODE_LENGTH;

export function codeFromInput(input: string) {
  const code = input.split("/bill/").pop()!.split(/[?#]/)[0];
  return code.replace(/[^a-z0-9]/gi, "");
}

export function newId(length = 8) {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
