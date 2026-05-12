// SPDX-License-Identifier: AGPL-3.0-or-later
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely. clsx handles conditionals;
 * twMerge resolves last-wins conflicts (e.g. "p-2 p-4" -> "p-4").
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
