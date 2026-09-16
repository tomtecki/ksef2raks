import type { RateKey } from "./lib/rates";

export type ImportMode = "zakup" | "sprzedaz";

export interface Party {
  nip: string;
  nazwa: string;
  kodKraju: string;
  l1: string;
  l2: string;
}

export interface RateAmount {
  key: RateKey;
  netto: number;
  vat: number;
}

export interface ParsedInvoiceBase {
  id: number;
  file: string;
  warnings: string[];
  errors: string[];
}

export interface ParsedInvoiceError extends ParsedInvoiceBase {
  ok: false;
}

export interface ParsedInvoiceOk extends ParsedInvoiceBase {
  ok: true;
  wariant: string | null;
  ksefNr: string;
  ksefData: string;
  sprz: Party;
  nab: Party;
  rodzaj: string;
  waluta: string;
  p1: string;
  p2: string;
  p6: string;
  brutto: number;
  termin: string;
  mpp: boolean;
  opisPoz: string;
  korNr: string;
  korFa: string;
  rates: RateAmount[];
  sel: boolean;
}

export type ParsedInvoice = ParsedInvoiceOk | ParsedInvoiceError;

export interface Contractor {
  nip: string;
  nazwa: string;
  ulica: string;
  nrDomu: string;
  nrLok: string;
  kod: string;
  miasto: string;
  kraj: string;
  kodKraju: string;
}

export interface ImportSettings {
  dziennik: string;
  typdok: string;
  nazwadok: string;
  rejestr: string;
  typzakupu: string;
  dataks: "wyst" | "ksef" | "sprz";
  dataotrz: "ksef" | "wyst";
  opis: "poz" | "nr" | "";
  encoding: "cp1250" | "utf8";
  rozr: boolean;
  novat: boolean;
  meta: boolean;
  kont: boolean;
  typkor: string;
  dRozr: string;
  dKoszt: string;
  dVat: string;
}
