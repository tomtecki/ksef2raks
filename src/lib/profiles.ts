import type { ImportMode, ImportSettings } from "../types";

/**
 * Domyślne symbole dziennika i nazwy rejestru różnią się między firmami,
 * dlatego są zapisywane w profilu per NIP + tryb (zakup/sprzedaż mają
 * osobne profile) w localStorage. Żadna treść faktury nie jest tam
 * przechowywana — wyłącznie ustawienia importu.
 */
export const MODE_DEFAULTS: Record<ImportMode, Partial<ImportSettings>> = {
  zakup: { typdok: "4", nazwadok: "Faktura zakupu", dziennik: "ZK", rejestr: "Rejestr Zakupów", typzakupu: "0" },
  sprzedaz: { typdok: "1", nazwadok: "Faktura sprzedaży", dziennik: "SP", rejestr: "Rejestr Sprzedaży", typzakupu: "0" },
};

export const DEFAULT_SETTINGS: ImportSettings = {
  dziennik: "ZK",
  typdok: "4",
  nazwadok: "Faktura zakupu",
  rejestr: "Rejestr Zakupów",
  typzakupu: "0",
  dataks: "wyst",
  dataotrz: "ksef",
  opis: "poz",
  encoding: "cp1250",
  rozr: true,
  novat: true,
  meta: true,
  kont: true,
  typkor: "",
  dRozr: "@D",
  dKoszt: "",
  dVat: "",
};

function profileKey(mode: ImportMode, nip: string): string {
  return `ksef2raks:profile:${mode}:${nip}`;
}

export function loadProfile(mode: ImportMode, nip: string): Partial<ImportSettings> | null {
  if (!nip) return null;
  try {
    const raw = localStorage.getItem(profileKey(mode, nip));
    return raw ? (JSON.parse(raw) as Partial<ImportSettings>) : null;
  } catch {
    return null;
  }
}

export function saveProfile(mode: ImportMode, nip: string, settings: ImportSettings): boolean {
  try {
    localStorage.setItem(profileKey(mode, nip), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
