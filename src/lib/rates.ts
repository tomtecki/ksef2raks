export interface RateInfo {
  label: string;
  wartosc: string;
  /** ID_STAWKI w RAKS; puste = nieznane, wymaga uzupełnienia przez użytkownika */
  id: string;
}

export type RateKey =
  | "23" | "8" | "5" | "4" | "oo" | "0" | "0wdt" | "0exp"
  | "zw" | "np" | "np100" | "marza" | "oss";

/**
 * Stawki potwierdzone eksportami z RAKS: 23%=12, 8%=13, 5%=15. To wartości ze
 * słownika stawek VAT konkretnej instalacji RAKS (Słowniki → Stawki VAT), a
 * nie stała globalna — inna baza RAKS może mieć inne ID, dlatego mapowanie
 * zostaje edytowalne w UI zamiast być na sztywno zaszyte.
 *
 * Pozostałe ID nie są znane — użytkownik uzupełnia je w UI (tabela mapowania),
 * a faktura z nieuzupełnioną stawką jest blokowana do czasu uzupełnienia
 * (poza fakturami wyłącznie zw./np., patrz NOVAT_KEYS). Blokada jest celowa:
 * wg dokumentacji KT-Soft „KT Konwerter Księgowy" (moduł eksportu RAKS
 * Dekrety, doc.ktsoft.pl/ktkonwksieg/export_raks-dekrety.htm) RAKS przy
 * imporcie nierozpoznanej stawki VAT nie zgłasza błędu — po prostu pomija
 * zapis — więc walidacja po naszej stronie jest jedynym zabezpieczeniem.
 */
export function defaultRates(): Record<RateKey, RateInfo> {
  return {
    "23": { label: "23%", wartosc: "23", id: "12" },
    "8": { label: "8%", wartosc: "8", id: "13" },
    "5": { label: "5%", wartosc: "5", id: "15" },
    "4": { label: "4% (ryczałt)", wartosc: "4", id: "" },
    oo: { label: "odwrotne obciążenie", wartosc: "0", id: "" },
    "0": { label: "0% krajowe", wartosc: "0", id: "" },
    "0wdt": { label: "0% WDT", wartosc: "0", id: "" },
    "0exp": { label: "0% eksport", wartosc: "0", id: "" },
    zw: { label: "zw.", wartosc: "0", id: "" },
    np: { label: "np.", wartosc: "0", id: "" },
    np100: { label: "np. (art. 100)", wartosc: "0", id: "" },
    marza: { label: "marża", wartosc: "0", id: "" },
    oss: { label: "OSS", wartosc: "0", id: "" },
  };
}

/** nagłówkowe sumy FA(3): [pole netto, pole VAT albo null, klucz stawki] */
export const HEADER_RATES: [string, string | null, RateKey][] = [
  ["P_13_1", "P_14_1", "23"],
  ["P_13_2", "P_14_2", "8"],
  ["P_13_3", "P_14_3", "5"],
  ["P_13_4", "P_14_4", "4"],
  ["P_13_5", "P_14_5", "oo"],
  ["P_13_6_1", null, "0"],
  ["P_13_6_2", null, "0wdt"],
  ["P_13_6_3", null, "0exp"],
  ["P_13_7", null, "zw"],
  ["P_13_8", null, "np"],
  ["P_13_9", null, "np100"],
  ["P_13_10", null, "marza"],
  ["P_13_11", null, "oss"],
];

/** stawki, dla których faktura może pominąć rejestr VAT (jak w eksporcie RAKS) */
export const NOVAT_KEYS = new Set<RateKey>(["zw", "np", "np100"]);

/** P_12 z wiersza -> klucz stawki (fallback, gdy brak sum nagłówkowych P_13/P_14) */
export function rateKeyFromP12(v: string | null | undefined): RateKey | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "23" || s === "22") return "23";
  if (s === "8" || s === "7") return "8";
  if (s === "5") return "5";
  if (s === "4") return "4";
  if (s === "0" || s === "0 kr") return "0";
  if (s === "0 wdt") return "0wdt";
  if (s === "0 ex") return "0exp";
  if (s === "zw") return "zw";
  if (s === "np" || s === "np i") return "np";
  if (s === "np ii") return "np100";
  if (s === "oo") return "oo";
  return null;
}
