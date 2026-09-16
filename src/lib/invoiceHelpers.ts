import { NOVAT_KEYS } from "./rates";
import type { ImportMode, ParsedInvoiceOk, Party } from "../types";

/**
 * W trybie zakupu kontrahent to sprzedawca (Podmiot1), a "nasza firma" to
 * nabywca (Podmiot2). W trybie sprzedaży odwrotnie.
 */
export function kontrOf(inv: ParsedInvoiceOk, mode: ImportMode): Party {
  return mode === "sprzedaz" ? inv.nab : inv.sprz;
}

export function ourNipOf(inv: ParsedInvoiceOk, mode: ImportMode): string {
  return (mode === "sprzedaz" ? inv.sprz.nip : inv.nab.nip) || "";
}

export function isNoVatInvoice(inv: ParsedInvoiceOk): boolean {
  return inv.rates.length > 0 && inv.rates.every((r) => NOVAT_KEYS.has(r.key));
}
