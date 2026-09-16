import { esc, fmt, nowStamp, r2, trunc } from "./format";
import { METADANE, RAKS_WERSJA } from "./metadane";
import { encodeCp1250 } from "./cp1250";
import { kontrOf, ourNipOf } from "./invoiceHelpers";
import { selectedForExport, type BatchEvaluation } from "./validation";
import type { RateInfo, RateKey } from "./rates";
import type { Contractor, ImportMode, ImportSettings, ParsedInvoice, ParsedInvoiceOk } from "../types";

const CRLF = "\r\n";

function pickDate(inv: ParsedInvoiceOk, which: ImportSettings["dataks"]): string {
  return which === "ksef" ? inv.ksefData || inv.p1 : which === "sprz" ? inv.p6 || inv.p1 : inv.p1;
}

export interface BuildRaksResult {
  xml: string;
  count: number;
  ourNip: string;
  period: string;
}

/**
 * Buduje zbiorczy plik XML do importu w RAKS (Dziennik → Zakupy/Sprzedaż → Import)
 * z faktur zaznaczonych i niezablokowanych walidacją (patrz selectedForExport).
 */
export function buildRaks(
  invoices: ParsedInvoice[],
  contractors: Record<string, Contractor>,
  mode: ImportMode,
  settings: ImportSettings,
  rates: Record<RateKey, RateInfo>,
  evaluation: BatchEvaluation,
): BuildRaksResult {
  const dekrety = Boolean(settings.dRozr && settings.dKoszt && settings.dVat);
  const sel = selectedForExport(invoices, evaluation);
  const isSprz = mode === "sprzedaz";

  const usedNips = [...new Set(sel.map((i) => kontrOf(i, mode).nip.replace(/\D/g, "")))];
  const kontaktId: Record<string, number> = {};
  usedNips.forEach((n, i) => (kontaktId[n] = i + 1));

  let idDekret = 0;
  let idVat = 0;
  let idVatPoz = 0;
  let idRozr = 0;

  let out = `<?xml version="1.0" encoding="${settings.encoding === "cp1250" ? "Windows-1250" : "UTF-8"}"?>` + CRLF;
  out += `<RAKS><EKSPORT DATA_MODYFIKACJI="${nowStamp()}" WERSJA="${RAKS_WERSJA}">`;
  if (settings.meta) out += METADANE;
  out += `<DOKUMENTY>` + CRLF;

  sel.forEach((inv, idx) => {
    const nip = kontrOf(inv, mode).nip.replace(/\D/g, "");
    const c: Contractor = contractors[nip] ?? {
      nip,
      nazwa: "",
      ulica: "",
      nrDomu: "",
      nrLok: "",
      kod: "",
      miasto: "",
      kraj: "",
      kodKraju: "",
    };
    const isKor = inv.rodzaj === "KOR";
    const typDok = isKor ? settings.typkor : settings.typdok;
    const dataKs = pickDate(inv, settings.dataks);
    const dataOtrz = pickDate(inv, settings.dataotrz);
    const opis = settings.opis === "poz" ? inv.opisPoz : settings.opis === "nr" ? inv.p2 : "";
    const netto = r2(inv.rates.reduce((a, r) => a + r.netto, 0));
    const vat = r2(inv.rates.reduce((a, r) => a + r.vat, 0));
    const brutto = inv.brutto || r2(netto + vat);
    const rozrId = settings.rozr ? ++idRozr : "";

    out +=
      `<DOKUMENT NUMER_KOLEJNY="${idx + 1}" ID_WEW="" ID_DOK_KS="" TYP_DOK="${esc(typDok)}" NAZWA_DOK="${esc(settings.nazwadok)}" SYMBOL_DZIENNIKA="${esc(settings.dziennik)}" DATA_KS="${dataKs}" NUMER_DOK="${esc(trunc(inv.p2, 255))}" DATA_DOK="${inv.p1}" ` +
      `KONTR_NAZWA_SKROCONA="${esc(trunc(c.nazwa, 50))}" KONTR_NAZWA_PELNA="${esc(trunc(c.nazwa, 200))}" KONTR_NIP="${esc(nip)}" KONTR_KODPOCZ="${esc(c.kod)}" KONTR_KODKRAJU="" KONTR_KRAJ="${esc(trunc(c.kraj, 20))}" KONTR_MIEJSCOWOSC="${esc(trunc(c.miasto, 40))}" KONTR_ADRES="${esc(trunc(c.ulica, 60))}" KONTR_NRDOMU="${esc(c.nrDomu)}" KONTR_NRMIESZK="${esc(c.nrLok)}" ` +
      `SOURCE_M_DATE="" SUGGESTED_CODE_NR="" DATA_OP_GOSP="${inv.p6 || inv.p1}" NR_GRUPY_OPERACJI="" KONTR_ID="" NUMER_DOKUMENTU_SAD="" DATA_DOKUMENTU_SAD="" DATA_UZYSKANIA_PRZYCHODU="" ` +
      `KSEF_NR_FAKTURY="${esc(inv.ksefNr)}" KSEF_DATA_FAKTURY="${inv.ksefData}" KSEF_NR_FAKTURY_KORYGOWANEJ="${esc(inv.korNr)}" KSEF_OZNACZENIE_FAKTURY="">` +
      CRLF;

    // DEKRETY
    out += `<DEKRETY>`;
    if (dekrety) {
      out += CRLF + `<DEKRET ID="${++idDekret}" KONTO_WN="" KONTO_MA="${esc(settings.dRozr)}" KWOTA_PLN="${fmt(brutto)}" KWOTA_WAL="0" KOD_WAL="PLN" OPIS_OPERACJI="${esc(trunc(opis, 370))}" STRONA_ROZR="" ID_ROZR="" TYP_WEW="" ID_ROZRACHUNKU="${rozrId}" ZNACZNIKI=""/>`;
      out += CRLF + `<DEKRET ID="${++idDekret}" KONTO_WN="${esc(settings.dKoszt)}" KONTO_MA="" KWOTA_PLN="${fmt(netto)}" KWOTA_WAL="0" KOD_WAL="PLN" OPIS_OPERACJI="${esc(trunc(opis, 370))}" STRONA_ROZR="" ID_ROZR="" TYP_WEW="" ID_ROZRACHUNKU="" ZNACZNIKI=""/>`;
      if (Math.abs(vat) > 0.004) {
        out += CRLF + `<DEKRET ID="${++idDekret}" KONTO_WN="${esc(settings.dVat)}" KONTO_MA="" KWOTA_PLN="${fmt(vat)}" KWOTA_WAL="0" KOD_WAL="PLN" OPIS_OPERACJI="${esc(trunc(opis, 370))}" STRONA_ROZR="" ID_ROZR="" TYP_WEW="" ID_ROZRACHUNKU="" ZNACZNIKI=""/>`;
      }
      out += CRLF;
    }
    out += `</DEKRETY>` + CRLF;

    // ROZRACHUNKI
    out += `<ROZRACHUNKI>`;
    if (settings.rozr) {
      out +=
        CRLF +
        `<ROZRACHUNEK ID="${rozrId}" ID_WEW="" ID_KONTAKTU="${kontaktId[nip]}" KONTR_NAZWA="${esc(trunc(c.nazwa, 50))}" TYP_ROZR="${isSprz ? "N" : "Z"}" DATA_OPER="${inv.p1}" DATA_PLAT="${inv.termin || inv.p1}" KWOTA_PLN="${fmt(brutto)}" KWOTA_WAL="0" KOD_WAL="PLN" OPIS="${esc(trunc(opis, 255))}" SYGNATURA="" ZAPLATA="0" MECHANIZM_PODZIELONEJ_PLATNOSCI="${inv.mpp ? "True" : "False"}"/>` +
        CRLF;
    }
    out += `</ROZRACHUNKI>` + CRLF;

    // REJESTR VAT
    const evalInfo = evaluation.perInvoice.get(inv.id);
    if (settings.novat && evalInfo?.skipVat) {
      out += `</DOKUMENT>` + CRLF;
      return;
    }
    out += `<REJESTRY_VAT>` + CRLF;
    out +=
      `<REJESTR_VAT ID="${++idVat}" TYP_REJ="${isSprz ? "S" : "Z"}" NAZWA_REJ="${esc(settings.rejestr)}" DATA_SPRZEDAZY="${inv.p6 || inv.p1}" DATA_OTRZYMANIA="${dataOtrz}" DATA_VAT="${dataKs}" TYP_ZAKUPU="${isSprz ? "" : esc(settings.typzakupu)}" TYP_SPRZEDAZY="${isSprz ? esc(settings.typzakupu) : ""}" POWOD_NIEPODLEGANIA="" NAME_OF_SERVICE="" WAITING="False" TYP_DOWODU="" SPRZEDAZ_BRUTTO_MARZA="" ZAKUP_BRUTTO_MARZA="" TERMIN_PLATNOSCI="${inv.termin || ""}" DATA_ZAPLATY="">` +
      CRLF;
    out += `<POZYCJE>` + CRLF;
    for (const r of inv.rates) {
      const R = rates[r.key];
      out += `<POZYCJA ID="${++idVatPoz}" KWOTA_NETTO="${fmt(r.netto)}" KWOTA_VAT="${fmt(r.vat)}" KWOTA_BRUTTO="${fmt(r.netto + r.vat)}" ID_STAWKI="${esc(R.id)}" WARTOSC_STAWKI="${esc(R.wartosc)}"/>` + CRLF;
    }
    out += `</POZYCJE>` + CRLF + `</REJESTR_VAT>` + CRLF + `</REJESTRY_VAT>` + CRLF + `</DOKUMENT>` + CRLF;
  });

  out += `</DOKUMENTY>` + CRLF;
  out += `<GENERATORY_ID><GENERATOR_ID ID_KONTAKTU="" ID_DEKRETU="${idDekret || ""}" ID_VAT="${idVat}" ID_VAT_POZ="${idVatPoz}" ID_KSIEGA="" ID_RYCZALT="" ID_POWIAZANIA_BUDZET="" ID_OSS="" ID_OSS_POZ=""/></GENERATORY_ID>` + CRLF;

  if (settings.kont) {
    out += `<KONTAKTY>` + CRLF;
    for (const nip of usedNips) {
      const c = contractors[nip];
      if (!c) continue;
      out +=
        `<KONTAKT ID="${kontaktId[nip]}" NAZWA_SKROC="${esc(trunc(c.nazwa, 50))}" NAZWA_PELNA="${esc(trunc(c.nazwa, 200))}" NAZWA_GRUPY="" NR_MIESZKANIA="${esc(c.nrLok)}" WOJEWODZTWO="" NIP="${esc(nip)}" ULICA="${esc(trunc(c.ulica, 40))}" MIEJSCOWOSC="${esc(trunc(c.miasto, 60))}" NR_DOMU="${esc(c.nrDomu)}" KOD_POCZTOWY="${esc(c.kod)}" KRAJ="${esc(trunc(c.kraj, 40))}" KOD_KRAJU="${esc(c.kodKraju)}" TYP_KONTAKTU="0" DOSTAWCA="${isSprz ? "False" : "True"}" ODBIORCA="${isSprz ? "True" : "False"}" AKWIZYTOR="False" KOD_KRESKOWY=""/>` +
        CRLF;
    }
    out += `</KONTAKTY>` + CRLF;
  }

  out += `</EKSPORT>` + CRLF + `</RAKS>` + CRLF;

  const first = sel[0];
  return {
    xml: out,
    count: sel.length,
    ourNip: first ? ourNipOf(first, mode) : "",
    period: first ? (pickDate(first, settings.dataks) || "").slice(0, 7) : "",
  };
}

export function encodeOutput(xml: string, encoding: ImportSettings["encoding"]): { data: Uint8Array | string; lost: number } {
  if (encoding === "cp1250") {
    const r = encodeCp1250(xml);
    return { data: r.bytes, lost: r.lost };
  }
  return { data: xml, lost: 0 };
}

export function outputFileName(mode: ImportMode, ourNip: string, period: string): string {
  const base = mode === "sprzedaz" ? "sprzedaz" : "zakupy";
  return `${base}_${ourNip || "raks"}_${(period || "").replace("-", "_") || "ksef"}.xml`;
}
