import { parseAddress } from "./address";
import { kontrOf } from "./invoiceHelpers";
import type { Contractor, ImportMode, ParsedInvoice } from "../types";

/**
 * Buduje mapę kontrahentów z faktur. `existing` pozwala zachować już
 * wprowadzone przez użytkownika poprawki adresu przy dokładaniu kolejnych
 * plików lub zmianie trybu — tylko brakujące NIP-y są uzupełniane
 * heurystyką z adresu FA(3), istniejące wpisy nie są nadpisywane.
 */
export function buildContractors(
  invoices: ParsedInvoice[],
  mode: ImportMode,
  existing: Record<string, Contractor> = {},
): Record<string, Contractor> {
  const contractors: Record<string, Contractor> = { ...existing };
  for (const inv of invoices) {
    if (!inv.ok) continue;
    const k = kontrOf(inv, mode);
    if (!k.nip) continue;
    const nip = k.nip.replace(/\D/g, "");
    if (!contractors[nip]) {
      const a = parseAddress(k.l1, k.l2, k.kodKraju);
      contractors[nip] = { nip, nazwa: k.nazwa, ...a };
    }
  }
  return contractors;
}
