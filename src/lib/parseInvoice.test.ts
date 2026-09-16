import { describe, expect, it } from "vitest";
import { parseInvoice } from "./parseInvoice";
import { defaultRates } from "./rates";
import { buildFaktura, ksefFileName } from "./__fixtures__/sampleInvoices";
import type { ParsedInvoiceOk } from "../types";

const rates = defaultRates();

describe("parseInvoice", () => {
  it("parsuje fakturę wielostawkową (23/8/5) i odczytuje numer KSeF z nazwy pliku", () => {
    const xml = buildFaktura({
      sprzedawcaNip: "5451773043",
      sprzedawcaNazwa: "Dostawca Sp. z o.o.",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Odbiorca S.A.",
      p1: "2026-07-24",
      p2: "FV 1/07/2026",
      rates: {
        "1": { netto: 100, vat: 23 },
        "2": { netto: 100, vat: 8 },
        "3": { netto: 100, vat: 5 },
      },
      pierwszaPozycja: "Usługa transportowa",
    });
    const fileName = ksefFileName("5451773043", "2026-07-24");
    const inv = parseInvoice(1, fileName, xml, rates);
    expect(inv.ok).toBe(true);
    const okInv = inv as ParsedInvoiceOk;
    expect(okInv.errors).toEqual([]);
    expect(okInv.ksefNr).toBe(fileName.replace(".xml", ""));
    expect(okInv.ksefData).toBe("2026-07-24");
    expect(okInv.rates).toHaveLength(3);
    expect(okInv.brutto).toBeCloseTo(336, 2);
    const sum = okInv.rates.reduce((a, r) => a + r.netto + r.vat, 0);
    expect(sum).toBeCloseTo(okInv.brutto, 2);
    expect(okInv.opisPoz).toBe("Usługa transportowa");
  });

  it("oznacza ostrzeżeniem plik, którego nazwa nie pasuje do formatu KSeF", () => {
    const xml = buildFaktura({
      sprzedawcaNip: "5451773043",
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Odbiorca",
      p1: "2026-07-24",
      p2: "FV 1",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const inv = parseInvoice(1, "faktura_zle_nazwana.xml", xml, rates) as ParsedInvoiceOk;
    expect(inv.ok).toBe(true);
    expect(inv.ksefNr).toBe("");
    expect(inv.warnings).toContain("Nie odczytano numeru KSeF z nazwy pliku");
  });

  it("zgłasza błąd braku numeru faktury (P_2) i blokuje eksport", () => {
    const xml = buildFaktura({
      sprzedawcaNip: "5451773043",
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Odbiorca",
      p1: "2026-07-24",
      p2: "",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const inv = parseInvoice(1, ksefFileName("5451773043", "2026-07-24"), xml, rates) as ParsedInvoiceOk;
    expect(inv.ok).toBe(true);
    expect(inv.errors).toContain("Brak numeru faktury P_2");
  });

  it("liczy stawki z wierszy FaWiersz, gdy brak sum nagłówkowych P_13/P_14", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?><Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/"><Naglowek><WariantFormularza>3</WariantFormularza></Naglowek><Podmiot1><DaneIdentyfikacyjne><NIP>5451773043</NIP><Nazwa>Dostawca</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>PL</KodKraju><AdresL1>Testowa 1</AdresL1><AdresL2>00-001 Warszawa</AdresL2></Adres></Podmiot1><Podmiot2><DaneIdentyfikacyjne><NIP>5461390421</NIP><Nazwa>Odbiorca</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>PL</KodKraju></Adres></Podmiot2><Fa><KodWaluty>PLN</KodWaluty><P_1>2026-07-24</P_1><P_2>FV 1</P_2><P_6>2026-07-24</P_6><P_15>123</P_15><RodzajFaktury>VAT</RodzajFaktury><FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>Towar</P_7><P_11>100</P_11><P_11Vat>23</P_11Vat><P_12>23</P_12></FaWiersz></Fa></Faktura>`;
    const inv = parseInvoice(1, ksefFileName("5451773043", "2026-07-24"), xml, rates) as ParsedInvoiceOk;
    expect(inv.ok).toBe(true);
    expect(inv.rates).toEqual([{ key: "23", netto: 100, vat: 23 }]);
    expect(inv.warnings).toContain("Brak sum nagłówkowych P_13/P_14 – stawki policzone z wierszy");
  });

  it("odrzuca plik, który nie jest fakturą KSeF", () => {
    const inv = parseInvoice(1, "cos.xml", "<root><a>1</a></root>", rates);
    expect(inv.ok).toBe(false);
    if (!inv.ok) expect(inv.errors[0]).toMatch(/nie jest plik faktury KSeF/);
  });

  it("odrzuca plik, który nie jest poprawnym XML", () => {
    const inv = parseInvoice(1, "cos.xml", "<not valid", rates);
    expect(inv.ok).toBe(false);
  });
});
