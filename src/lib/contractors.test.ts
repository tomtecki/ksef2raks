import { describe, expect, it } from "vitest";
import { buildContractors } from "./contractors";
import { parseInvoice } from "./parseInvoice";
import { defaultRates } from "./rates";
import { buildFaktura, ksefFileName } from "./__fixtures__/sampleInvoices";

const rates = defaultRates();

describe("buildContractors", () => {
  it("zachowuje ręczną poprawkę adresu kontrahenta przy dokładaniu kolejnych plików", () => {
    const nip = "5451773043";
    const xml1 = buildFaktura({
      sprzedawcaNip: nip,
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-24",
      p2: "FV 1",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const inv1 = parseInvoice(1, ksefFileName(nip, "2026-07-24"), xml1, rates);
    const initial = buildContractors([inv1], "zakup");
    expect(initial[nip].ulica).not.toBe("Poprawiona ulica");

    // użytkownik ręcznie poprawia adres w tabeli kontrahentów
    const editedByUser = { ...initial, [nip]: { ...initial[nip], ulica: "Poprawiona ulica" } };

    // dokłada drugi plik od tego samego kontrahenta
    const xml2 = buildFaktura({
      sprzedawcaNip: nip,
      sprzedawcaNazwa: "Dostawca",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-25",
      p2: "FV 2",
      rates: { "1": { netto: 50, vat: 11.5 } },
    });
    const inv2 = parseInvoice(2, ksefFileName(nip, "2026-07-25"), xml2, rates);

    const merged = buildContractors([inv1, inv2], "zakup", editedByUser);
    expect(merged[nip].ulica).toBe("Poprawiona ulica");
  });

  it("dla nowego NIP-u nadal uzupełnia adres heurystycznie, nawet gdy inne wpisy są edytowane", () => {
    const nip1 = "5451773043";
    const nip2 = "5461206251";
    const xml1 = buildFaktura({
      sprzedawcaNip: nip1,
      sprzedawcaNazwa: "Dostawca 1",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-24",
      p2: "FV 1",
      rates: { "1": { netto: 100, vat: 23 } },
    });
    const inv1 = parseInvoice(1, ksefFileName(nip1, "2026-07-24"), xml1, rates);
    const existing = { [nip1]: { ...buildContractors([inv1], "zakup")[nip1], ulica: "Ręcznie" } };

    const xml2 = buildFaktura({
      sprzedawcaNip: nip2,
      sprzedawcaNazwa: "Dostawca 2",
      sprzedawcaAdresL1: "Nowa 5",
      sprzedawcaAdresL2: "01-234 Kraków",
      nabywcaNip: "5461390421",
      nabywcaNazwa: "Nasza Firma",
      p1: "2026-07-26",
      p2: "FV 3",
      rates: { "1": { netto: 10, vat: 2.3 } },
    });
    const inv2 = parseInvoice(2, ksefFileName(nip2, "2026-07-26"), xml2, rates);

    const merged = buildContractors([inv1, inv2], "zakup", existing);
    expect(merged[nip1].ulica).toBe("Ręcznie");
    expect(merged[nip2].miasto).toBe("Kraków");
  });
});
