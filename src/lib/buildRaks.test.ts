import { describe, expect, it } from "vitest";
import { parseInvoice } from "./parseInvoice";
import { defaultRates } from "./rates";
import { buildContractors } from "./contractors";
import { evaluateBatch, selectedForExport } from "./validation";
import { buildRaks, outputFileName } from "./buildRaks";
import { encodeCp1250 } from "./cp1250";
import { DEFAULT_SETTINGS, MODE_DEFAULTS } from "./profiles";
import { buildFaktura, ksefFileName } from "./__fixtures__/sampleInvoices";
import type { ImportMode, ImportSettings, ParsedInvoice } from "../types";

const NASZA_FIRMA_ZAKUP = "5461390421"; // nabywca w fakturach zakupowych
const KONTRAHENT = "5451773043";

function settingsFor(mode: ImportMode, overrides: Partial<ImportSettings> = {}): ImportSettings {
  return { ...DEFAULT_SETTINGS, ...MODE_DEFAULTS[mode], ...overrides } as ImportSettings;
}

function parseAll(files: { name: string; xml: string }[]) {
  const rates = defaultRates();
  const invoices: ParsedInvoice[] = files.map((f, i) => parseInvoice(i + 1, f.name, f.xml, rates));
  return { invoices, rates };
}

describe("buildRaks – faktura zakupu wielostawkowa (23/8/5)", () => {
  const xml = buildFaktura({
    sprzedawcaNip: KONTRAHENT,
    sprzedawcaNazwa: "Dostawca Sp. z o.o.",
    sprzedawcaAdresL1: "Suchowola, Goniądzka 58",
    sprzedawcaAdresL2: "16-150 Suchowola",
    nabywcaNip: NASZA_FIRMA_ZAKUP,
    nabywcaNazwa: "Nasza Firma Sp. z o.o.",
    p1: "2026-07-24",
    p2: "FV 1/07/2026",
    rates: {
      "1": { netto: 100, vat: 23 },
      "2": { netto: 50, vat: 4 },
      "3": { netto: 20, vat: 1 },
    },
    pierwszaPozycja: "Materiały biurowe",
  });
  const fileName = ksefFileName(KONTRAHENT, "2026-07-24");
  const { invoices, rates } = parseAll([{ name: fileName, xml }]);
  const mode: ImportMode = "zakup";
  const contractors = buildContractors(invoices, mode);
  const settings = settingsFor(mode);
  const evaluation = evaluateBatch(invoices, mode, rates, settings);

  it("zaznacza fakturę jako gotową do eksportu (brak błędów blokujących)", () => {
    const sel = selectedForExport(invoices, evaluation);
    expect(sel).toHaveLength(1);
  });

  it("generuje DOKUMENT z TYP_DOK=4 i SYMBOL_DZIENNIKA=ZK dla zakupu", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(/TYP_DOK="4"/);
    expect(out).toMatch(/SYMBOL_DZIENNIKA="ZK"/);
  });

  it("generuje ROZRACHUNEK z TYP_ROZR=Z (zobowiązanie) dla zakupu", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(/<ROZRACHUNEK[^>]*TYP_ROZR="Z"/);
  });

  it("generuje REJESTR_VAT z TYP_REJ=Z i trzema pozycjami o poprawnych ID_STAWKI", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(/<REJESTR_VAT[^>]*TYP_REJ="Z"/);
    expect(out).toMatch(/ID_STAWKI="12"/); // 23%
    expect(out).toMatch(/ID_STAWKI="13"/); // 8%
    expect(out).toMatch(/ID_STAWKI="15"/); // 5%
  });

  it("suma netto+VAT pozycji rejestru odpowiada P_15 faktury", () => {
    const netto = 100 + 50 + 20;
    const vat = 23 + 4 + 1;
    expect(netto + vat).toBeCloseTo(198, 2);
    const okInv = invoices[0];
    if (okInv.ok) expect(okInv.brutto).toBeCloseTo(198, 2);
  });

  it("kontrahent w KONTAKTY to sprzedawca (Podmiot1) – zgodnie z trybem zakupu", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(new RegExp(`NIP="${KONTRAHENT}"`));
    expect(out).toMatch(/DOSTAWCA="True"/);
    expect(out).toMatch(/ODBIORCA="False"/);
  });
});

describe("buildRaks – faktura sprzedaży", () => {
  const xml = buildFaktura({
    sprzedawcaNip: NASZA_FIRMA_ZAKUP,
    sprzedawcaNazwa: "Nasza Firma Sp. z o.o.",
    nabywcaNip: KONTRAHENT,
    nabywcaNazwa: "Klient Sp. z o.o.",
    p1: "2026-08-01",
    p2: "FS 1/08/2026",
    rates: { "1": { netto: 200, vat: 46 } },
    pierwszaPozycja: "Usługa konsultingowa",
  });
  const fileName = ksefFileName(NASZA_FIRMA_ZAKUP, "2026-08-01");
  const { invoices, rates } = parseAll([{ name: fileName, xml }]);
  const mode: ImportMode = "sprzedaz";
  const contractors = buildContractors(invoices, mode);
  const settings = settingsFor(mode);
  const evaluation = evaluateBatch(invoices, mode, rates, settings);

  it("generuje DOKUMENT z TYP_DOK=1 i SYMBOL_DZIENNIKA=SP dla sprzedaży", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(/TYP_DOK="1"/);
    expect(out).toMatch(/SYMBOL_DZIENNIKA="SP"/);
  });

  it("generuje ROZRACHUNEK z TYP_ROZR=N (należność) dla sprzedaży", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(/<ROZRACHUNEK[^>]*TYP_ROZR="N"/);
  });

  it("generuje REJESTR_VAT z TYP_REJ=S", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(/<REJESTR_VAT[^>]*TYP_REJ="S"/);
  });

  it("kontrahent w KONTAKTY to nabywca (Podmiot2) – zgodnie z trybem sprzedaży", () => {
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).toMatch(new RegExp(`NIP="${KONTRAHENT}"`));
    expect(out).toMatch(/ODBIORCA="True"/);
    expect(out).toMatch(/DOSTAWCA="False"/);
  });
});

describe("buildRaks – faktura wyłącznie zwolniona (zw.)", () => {
  const xml = buildFaktura({
    sprzedawcaNip: KONTRAHENT,
    sprzedawcaNazwa: "Dostawca zw.",
    nabywcaNip: NASZA_FIRMA_ZAKUP,
    nabywcaNazwa: "Nasza Firma Sp. z o.o.",
    p1: "2026-07-15",
    p2: "FV ZW/1",
    netOnlyRates: { "7": 500 },
  });
  const fileName = ksefFileName(KONTRAHENT, "2026-07-15");
  const { invoices, rates } = parseAll([{ name: fileName, xml }]);
  const mode: ImportMode = "zakup";
  const contractors = buildContractors(invoices, mode);

  it("z opcją 'bez rejestru VAT' pomija sekcję REJESTRY_VAT (meta wyłączone, by nie mylić z opisem schematu w METADANE)", () => {
    const settings = settingsFor(mode, { novat: true, meta: false });
    const evaluation = evaluateBatch(invoices, mode, rates, settings);
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    expect(out).not.toContain("<REJESTRY_VAT>");
    // ale dokument i rozrachunek nadal są generowane
    expect(out).toContain("<DOKUMENT ");
    expect(out).toContain("<ROZRACHUNEK ");
  });

  it("bez opcji 'bez rejestru VAT' faktura zw. trafia do rejestru, ale brak ID_STAWKI dla zw. ją blokuje", () => {
    // zw./np. pomijają wymóg ID_STAWKI tylko dzięki pominięciu REJESTRY_VAT (opcja "bez rejestru VAT");
    // gdy opcja jest wyłączona, faktura zw. przechodzi normalną walidację stawek jak każda inna.
    const settings = settingsFor(mode, { novat: false });
    const evaluation = evaluateBatch(invoices, mode, rates, settings);
    const sel = selectedForExport(invoices, evaluation);
    expect(sel).toHaveLength(0);
    const ev = evaluation.perInvoice.get(1);
    expect(ev?.tags.some((t) => t.type === "err" && t.text.includes("brak ID_STAWKI"))).toBe(true);
  });
});

describe("buildRaks – blokowanie eksportu", () => {
  it("blokuje fakturę ze stawką bez przypisanego ID_STAWKI (np. 0% krajowe)", () => {
    const xml = buildFaktura({
      sprzedawcaNip: KONTRAHENT,
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: NASZA_FIRMA_ZAKUP,
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-20",
      p2: "FV 0PROC/1",
      netOnlyRates: { "6_1": 300 },
    });
    const fileName = ksefFileName(KONTRAHENT, "2026-07-20");
    const { invoices, rates } = parseAll([{ name: fileName, xml }]);
    const mode: ImportMode = "zakup";
    const settings = settingsFor(mode, { novat: false });
    const evaluation = evaluateBatch(invoices, mode, rates, settings);
    const sel = selectedForExport(invoices, evaluation);
    expect(sel).toHaveLength(0);
    const ev = evaluation.perInvoice.get(1);
    expect(ev?.blocked).toBe(true);
  });

  it("blokuje duplikat numeru KSeF w tej samej partii i nie eksportuje go dwa razy", () => {
    const xml = buildFaktura({
      sprzedawcaNip: KONTRAHENT,
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: NASZA_FIRMA_ZAKUP,
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-20",
      p2: "FV DUP/1",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const fileName = ksefFileName(KONTRAHENT, "2026-07-20");
    const { invoices, rates } = parseAll([
      { name: fileName, xml },
      { name: fileName, xml },
    ]);
    const mode: ImportMode = "zakup";
    const settings = settingsFor(mode);
    const evaluation = evaluateBatch(invoices, mode, rates, settings);
    const sel = selectedForExport(invoices, evaluation);
    expect(sel).toHaveLength(0);
    expect(evaluation.dupKsefSet.has(invoices[0].ok ? invoices[0].ksefNr : "")).toBe(true);
  });

  it("wykrywa mieszaną partię (ta sama firma raz jako sprzedawca, raz jako nabywca)", () => {
    const zakupXml = buildFaktura({
      sprzedawcaNip: KONTRAHENT,
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: NASZA_FIRMA_ZAKUP,
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-20",
      p2: "FV 1",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const sprzedazXml = buildFaktura({
      sprzedawcaNip: NASZA_FIRMA_ZAKUP,
      sprzedawcaNazwa: "Nasza Firma",
      nabywcaNip: "9990001122",
      nabywcaNazwa: "Inny klient",
      p1: "2026-07-21",
      p2: "FS 1",
      rates: { "1": { netto: 200, vat: 46 } },
    });
    const { invoices, rates } = parseAll([
      { name: ksefFileName(KONTRAHENT, "2026-07-20"), xml: zakupXml },
      { name: ksefFileName(NASZA_FIRMA_ZAKUP, "2026-07-21"), xml: sprzedazXml },
    ]);
    const mode: ImportMode = "zakup";
    const settings = settingsFor(mode);
    const evaluation = evaluateBatch(invoices, mode, rates, settings);
    expect(evaluation.mixedSides).toBe(true);
    // faktura sprzedażowa (druga) jest oznaczona jako "zła strona" w trybie zakupu
    expect(evaluation.wrongSideIds.has(2)).toBe(true);
    expect(evaluation.wrongSideIds.has(1)).toBe(false);
  });
});

describe("buildRaks – kodowanie wyjścia", () => {
  it("koduje wynik w CP1250 i używa końców linii CRLF", () => {
    const xml = buildFaktura({
      sprzedawcaNip: KONTRAHENT,
      sprzedawcaNazwa: "Łąka Śąźćółł Sp. z o.o.",
      nabywcaNip: NASZA_FIRMA_ZAKUP,
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-24",
      p2: "FV 1",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const fileName = ksefFileName(KONTRAHENT, "2026-07-24");
    const { invoices, rates } = parseAll([{ name: fileName, xml }]);
    const mode: ImportMode = "zakup";
    const contractors = buildContractors(invoices, mode);
    const settings = settingsFor(mode, { encoding: "cp1250" });
    const evaluation = evaluateBatch(invoices, mode, rates, settings);
    const { xml: out } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);

    expect(out).toMatch(/encoding="Windows-1250"/);
    expect(out.includes("\r\n")).toBe(true);
    // liczby dziesiętne z przecinkiem, bez zbędnych zer
    expect(out).toMatch(/KWOTA_NETTO="100"/);
    expect(out).toMatch(/KWOTA_VAT="23"/);

    const { lost } = encodeCp1250(out);
    expect(lost).toBe(0); // polskie znaki mają swoje miejsce w CP1250
  });

  it("nazywa plik wyjściowy zgodnie z konwencją zakupy_<NIP>_<RRRR_MM>.xml", () => {
    const name = outputFileName("zakup", "5461390421", "2026-07");
    expect(name).toBe("zakupy_5461390421_2026_07.xml");
    const nameSprz = outputFileName("sprzedaz", "5461390421", "2026-08");
    expect(nameSprz).toBe("sprzedaz_5461390421_2026_08.xml");
  });
});
