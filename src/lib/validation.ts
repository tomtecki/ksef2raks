import { isNoVatInvoice, kontrOf, ourNipOf } from "./invoiceHelpers";
import type { RateInfo, RateKey } from "./rates";
import type { ImportMode, ParsedInvoice, ParsedInvoiceOk } from "../types";

export interface InvoiceTag {
  type: "ok" | "warn" | "err";
  text: string;
}

export interface InvoiceEvaluation {
  id: number;
  /** faktura wyklucza się z eksportu do RAKS (niezależnie od stanu checkboxa) */
  blocked: boolean;
  /** faktura pomija sekcję REJESTRY_VAT (wyłącznie zw./np., opcja "bez rejestru VAT") */
  skipVat: boolean;
  tags: InvoiceTag[];
}

export interface BatchEvaluation {
  dupKsefSet: Set<string>;
  wrongSideIds: Set<number>;
  ourNips: string[];
  mainNip: string;
  /** partia zawiera jednocześnie faktury zakupowe i sprzedażowe dla "naszej firmy" */
  mixedSides: boolean;
  perInvoice: Map<number, InvoiceEvaluation>;
}

export interface EvaluationSettings {
  novat: boolean;
  typkor: string;
}

/**
 * Wykrywa NIP "naszej firmy" i sprawdza, czy w tej samej partii występuje on
 * zarówno jako sprzedawca, jak i nabywca — co oznacza wymieszanie faktur
 * zakupowych i sprzedażowych niezależnie od wybranego trybu.
 *
 * "Nasza firma" to NIP najczęściej wskazywany przez ourNipOf() pod bieżący
 * tryb (czyli strona, którą użytkownik już zadeklarował jako swoją, wybierając
 * Zakupy/Sprzedaż) — a nie zwykłe liczenie wystąpień NIP po obu stronach
 * faktury. To drugie podejście błędnie wskazywało kontrahenta jako "naszą
 * firmę", gdy liczba jego wystąpień zrównała się z liczbą wystąpień
 * faktycznej naszej firmy (typowe przy jednym stałym odbiorcy/dostawcy) —
 * błąd znaleziony przy testach na rzeczywistych plikach z KSeF.
 */
function detectWrongSide(invoices: ParsedInvoiceOk[], mode: ImportMode): Set<number> {
  const wrongSide = new Set<number>();
  const cnt: Record<string, number> = {};
  for (const i of invoices) {
    const nip = ourNipOf(i, mode);
    if (nip) cnt[nip] = (cnt[nip] || 0) + 1;
  }
  let firm = "";
  let best = 0;
  for (const n in cnt) {
    if (cnt[n] > best) {
      best = cnt[n];
      firm = n;
    }
  }
  if (!firm) return wrongSide;
  for (const i of invoices) {
    const asSprzed = i.sprz.nip === firm;
    const asNab = i.nab.nip === firm;
    if (!asSprzed && !asNab) continue;
    const impliedMode: ImportMode = asSprzed ? "sprzedaz" : "zakup";
    if (impliedMode !== mode) wrongSide.add(i.id);
  }
  return wrongSide;
}

export function evaluateBatch(
  invoices: ParsedInvoice[],
  mode: ImportMode,
  rates: Record<RateKey, RateInfo>,
  settings: EvaluationSettings,
): BatchEvaluation {
  const okInvoices = invoices.filter((i): i is ParsedInvoiceOk => i.ok);

  const seen: Record<string, boolean> = {};
  const dupKsefSet = new Set<string>();
  for (const i of okInvoices) {
    if (!i.ksefNr) continue;
    if (seen[i.ksefNr]) dupKsefSet.add(i.ksefNr);
    seen[i.ksefNr] = true;
  }

  const ourNips = [...new Set(okInvoices.map((i) => ourNipOf(i, mode)))];
  const mainNip = ourNips.length ? ourNips[0] : "";

  const wrongSideIds = detectWrongSide(okInvoices, mode);
  const mixedSides = wrongSideIds.size > 0;

  const perInvoice = new Map<number, InvoiceEvaluation>();
  for (const inv of invoices) {
    if (!inv.ok) {
      perInvoice.set(inv.id, { id: inv.id, blocked: true, skipVat: false, tags: [{ type: "err", text: inv.errors.join("; ") }] });
      continue;
    }
    const tags: InvoiceTag[] = [];
    const skipVat = settings.novat && isNoVatInvoice(inv);
    const isDup = dupKsefSet.has(inv.ksefNr);
    const isWrongSide = wrongSideIds.has(inv.id);
    const missingRateId = !skipVat && inv.rates.some((r) => !rates[r.key].id);
    const isKorWithoutType = inv.rodzaj === "KOR" && !settings.typkor;
    const isOtherType = inv.rodzaj !== "VAT" && inv.rodzaj !== "KOR";

    const blocked = inv.errors.length > 0 || isDup || isWrongSide || missingRateId || isKorWithoutType || isOtherType;

    if (inv.errors.length) tags.push({ type: "err", text: inv.errors.join("; ") });
    if (isDup) tags.push({ type: "err", text: "duplikat nr KSeF w tej partii" });
    if (isWrongSide) tags.push({ type: "err", text: mode === "sprzedaz" ? "to faktura zakupowa" : "to faktura sprzedażowa" });
    if (inv.rodzaj !== "VAT") {
      tags.push({
        type: "warn",
        text: inv.rodzaj + (inv.rodzaj === "KOR" && !settings.typkor ? " – pominięta (brak TYP_DOK dla korekt)" : ""),
      });
    }
    if (inv.wariant && inv.wariant !== "3") tags.push({ type: "warn", text: `FA(${inv.wariant})` });
    if (skipVat) tags.push({ type: "ok", text: "bez rejestru VAT" });
    else {
      for (const r of inv.rates) {
        if (!rates[r.key].id) tags.push({ type: "err", text: `brak ID_STAWKI dla ${rates[r.key].label}` });
      }
    }
    if (ourNipOf(inv, mode) !== mainNip) tags.push({ type: "warn", text: "inna firma" });
    for (const w of inv.warnings) tags.push({ type: "warn", text: w });
    if (!tags.length) tags.push({ type: "ok", text: "OK" });

    perInvoice.set(inv.id, { id: inv.id, blocked, skipVat, tags });
  }

  return { dupKsefSet, wrongSideIds, ourNips, mainNip, mixedSides, perInvoice };
}

/** faktury faktycznie trafiające do eksportu: zaznaczone, poprawne i nie zablokowane */
export function selectedForExport(invoices: ParsedInvoice[], evaluation: BatchEvaluation): ParsedInvoiceOk[] {
  return invoices.filter((i): i is ParsedInvoiceOk => i.ok && i.sel && !evaluation.perInvoice.get(i.id)?.blocked);
}

export { kontrOf, ourNipOf, isNoVatInvoice };
