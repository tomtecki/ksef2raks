import { hasParserError, parseXmlDocument, q, qa, qt } from "./xmlUtils";
import { num, r2, fmt, ksefDateFromNr } from "./format";
import { HEADER_RATES, rateKeyFromP12, type RateInfo, type RateKey } from "./rates";
import type { Party, ParsedInvoice, RateAmount } from "../types";

/** NIP-RRRRMMDD-XXXXXXXXXXXX-YY.xml, np. 5461390421-20260709-78CD7F40000F-4A.xml */
const KSEF_FILENAME_RE = /^(\d{10}-\d{8}-[0-9A-Fa-f]{12}-[0-9A-Fa-f]{2})/;

function err(id: number, file: string, message: string): ParsedInvoice {
  return { id, file, ok: false, errors: [message], warnings: [] };
}

/**
 * Parsuje pojedynczy plik faktury KSeF FA(3)/FA(2).
 * `rates` to bieżąca tabela mapowania stawek na ID_STAWKI (używana tylko
 * do wyliczenia stawki z wiersza P_12 w trybie fallback — sama walidacja
 * obecności ID_STAWKI odbywa się później, przy budowaniu pliku RAKS).
 */
export function parseInvoice(id: number, fileName: string, xmlText: string, rates: Record<RateKey, RateInfo>): ParsedInvoice {
  const warnings: string[] = [];
  const errors: string[] = [];

  const doc = parseXmlDocument(xmlText);
  if (hasParserError(doc)) return err(id, fileName, "Plik nie jest poprawnym XML");

  const root = doc.documentElement;
  if (root.localName !== "Faktura") return err(id, fileName, "To nie jest plik faktury KSeF (brak elementu Faktura)");

  const wariant = qt(root, "Naglowek/WariantFormularza");
  const fa = q(root, "Fa");
  if (!fa) return err(id, fileName, "Brak sekcji Fa");

  let ksefNr = "";
  const fm = KSEF_FILENAME_RE.exec(fileName);
  if (fm) ksefNr = fm[1].toUpperCase();
  else warnings.push("Nie odczytano numeru KSeF z nazwy pliku");
  const ksefData = ksefDateFromNr(ksefNr);

  const sprz: Party = {
    nip: qt(root, "Podmiot1/DaneIdentyfikacyjne/NIP") || "",
    nazwa: qt(root, "Podmiot1/DaneIdentyfikacyjne/Nazwa") || "",
    kodKraju: qt(root, "Podmiot1/Adres/KodKraju") || "PL",
    l1: qt(root, "Podmiot1/Adres/AdresL1") || "",
    l2: qt(root, "Podmiot1/Adres/AdresL2") || "",
  };
  if (!sprz.nip) warnings.push("Sprzedawca bez NIP");

  const nab: Party = {
    nip: qt(root, "Podmiot2/DaneIdentyfikacyjne/NIP") || "",
    nazwa: qt(root, "Podmiot2/DaneIdentyfikacyjne/Nazwa") || "",
    kodKraju: qt(root, "Podmiot2/Adres/KodKraju") || "PL",
    l1: qt(root, "Podmiot2/Adres/AdresL1") || "",
    l2: qt(root, "Podmiot2/Adres/AdresL2") || "",
  };

  const rodzaj = qt(fa, "RodzajFaktury") || "VAT";
  const waluta = qt(fa, "KodWaluty") || "PLN";
  if (waluta !== "PLN") warnings.push(`Waluta ${waluta} – kwoty wpisywane jako PLN bez przeliczenia`);

  const p1 = qt(fa, "P_1") || "";
  const p2 = qt(fa, "P_2") || "";
  let p6 = qt(fa, "P_6") || qt(fa, "OkresFa/P_6_Do") || "";
  const wiersze = qa(fa, "FaWiersz");
  if (!p6) {
    const ds = wiersze.map((w) => qt(w, "P_6A")).filter((v): v is string => Boolean(v)).sort();
    if (ds.length) p6 = ds[ds.length - 1];
  }
  if (!p6) p6 = p1;

  const brutto = num(qt(fa, "P_15"));
  const termin = qt(fa, "Platnosc/TerminPlatnosci/Termin") || "";
  const mpp = (qt(fa, "Adnotacje/P_18A") || "") === "1";
  const opisPoz = wiersze.length ? qt(wiersze[0], "P_7") || "" : "";
  const korNr = qt(fa, "DaneFaKorygowanej/NrKSeFFaKorygowanej") || "";
  const korFa = qt(fa, "DaneFaKorygowanej/NrFaKorygowanej") || "";

  // stawki: najpierw sumy nagłówkowe P_13_x / P_14_x
  let rateAmounts: RateAmount[] = [];
  let anyHeader = false;
  for (const [pn, pv, key] of HEADER_RATES) {
    const n = qt(fa, pn);
    if (n == null) continue;
    anyHeader = true;
    const netto = num(n);
    const vat = pv ? num(qt(fa, pv)) : 0;
    if (Math.abs(netto) > 0.004 || Math.abs(vat) > 0.004) rateAmounts.push({ key, netto, vat });
  }
  if (!anyHeader) {
    // fallback: agregacja z wierszy FaWiersz
    const acc: Partial<Record<RateKey, RateAmount>> = {};
    for (const w of wiersze) {
      const p12 = qt(w, "P_12");
      const k = rateKeyFromP12(p12);
      if (!k) {
        warnings.push(`Nieznana stawka w wierszu: ${p12}`);
        continue;
      }
      const netto = num(qt(w, "P_11"));
      const p11Vat = qt(w, "P_11Vat");
      const vat = p11Vat != null ? num(p11Vat) : r2((netto * num(rates[k].wartosc)) / 100);
      const entry = acc[k] || { key: k, netto: 0, vat: 0 };
      entry.netto = r2(entry.netto + netto);
      entry.vat = r2(entry.vat + vat);
      acc[k] = entry;
    }
    rateAmounts = Object.values(acc) as RateAmount[];
    if (rateAmounts.length) warnings.push("Brak sum nagłówkowych P_13/P_14 – stawki policzone z wierszy");
  }

  const sumBrutto = r2(rateAmounts.reduce((a, r) => a + r.netto + r.vat, 0));
  if (Math.abs(sumBrutto - brutto) > 0.011) {
    warnings.push(`Suma netto+VAT (${fmt(sumBrutto)}) ≠ P_15 (${fmt(brutto)})`);
  }
  if (!rateAmounts.length) errors.push("Brak kwot / stawek");
  if (!p1) errors.push("Brak daty wystawienia P_1");
  if (!p2) errors.push("Brak numeru faktury P_2");

  return {
    id,
    file: fileName,
    ok: true,
    wariant,
    ksefNr,
    ksefData,
    sprz,
    nab,
    rodzaj,
    waluta,
    p1,
    p2,
    p6,
    brutto,
    termin,
    mpp,
    opisPoz,
    korNr,
    korFa,
    rates: rateAmounts,
    warnings,
    errors,
    sel: true,
  };
}
