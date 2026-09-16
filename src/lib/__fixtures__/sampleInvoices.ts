export interface RateLine {
  netto: number;
  vat: number;
}

export interface FakturaOptions {
  wariant?: string;
  sprzedawcaNip: string;
  sprzedawcaNazwa: string;
  sprzedawcaAdresL1?: string;
  sprzedawcaAdresL2?: string;
  nabywcaNip: string;
  nabywcaNazwa: string;
  nabywcaAdresL1?: string;
  nabywcaAdresL2?: string;
  p1: string;
  p2: string;
  p6?: string;
  rodzaj?: string;
  waluta?: string;
  mpp?: boolean;
  termin?: string;
  pierwszaPozycja?: string;
  /** slot HEADER_RATES: 1=23%, 2=8%, 3=5%, 4=4%(ryczałt), 5=odwrotne obciążenie (mają P_14_x) */
  rates?: Partial<Record<"1" | "2" | "3" | "4" | "5", RateLine>>;
  /** slot HEADER_RATES bez VAT (jedna kwota netto): 6_1,6_2,6_3=0%, 7=zw., 8=np., 9=np.100, 10=marża, 11=OSS */
  netOnlyRates?: Partial<Record<"6_1" | "6_2" | "6_3" | "7" | "8" | "9" | "10" | "11", number>>;
  /** kiedy zamiast sum nagłówkowych P_13/P_14 chcemy przetestować fallback z wierszy */
  wierszeOnly?: { p11: number; p12: string }[];
  korygowanaKsef?: string;
}

const NS = "http://crd.gov.pl/wzor/2025/06/25/13775/";

/** buduje minimalny, ale realistyczny plik FA(3) do testów jednostkowych (dane syntetyczne) */
export function buildFaktura(o: FakturaOptions): string {
  const wariant = o.wariant ?? "3";
  const p6 = o.p6 ?? o.p1;
  const rodzaj = o.rodzaj ?? "VAT";
  const waluta = o.waluta ?? "PLN";

  let ratesXml = "";
  let bruttoSum = 0;
  if (o.rates) {
    for (const [slot, line] of Object.entries(o.rates)) {
      if (!line) continue;
      ratesXml += `<P_13_${slot}>${line.netto}</P_13_${slot}><P_14_${slot}>${line.vat}</P_14_${slot}>`;
      bruttoSum += line.netto + line.vat;
    }
  }
  if (o.netOnlyRates) {
    for (const [slot, netto] of Object.entries(o.netOnlyRates)) {
      if (netto == null) continue;
      ratesXml += `<P_13_${slot}>${netto}</P_13_${slot}>`;
      bruttoSum += netto;
    }
  }

  let wierszeXml = "";
  if (o.wierszeOnly) {
    o.wierszeOnly.forEach((w, idx) => {
      wierszeXml += `<FaWiersz><NrWierszaFa>${idx + 1}</NrWierszaFa><P_7>${o.pierwszaPozycja ?? "Usługa " + (idx + 1)}</P_7><P_8A>szt</P_8A><P_8B>1</P_8B><P_9A>${w.p11}</P_9A><P_11>${w.p11}</P_11><P_12>${w.p12}</P_12></FaWiersz>`;
    });
  } else if (o.pierwszaPozycja) {
    wierszeXml = `<FaWiersz><NrWierszaFa>1</NrWierszaFa><P_7>${o.pierwszaPozycja}</P_7><P_8A>szt</P_8A><P_8B>1</P_8B><P_9A>1</P_9A><P_11>1</P_11><P_12>23</P_12></FaWiersz>`;
  }

  const korXml = o.korygowanaKsef
    ? `<DaneFaKorygowanej><NrKSeFFaKorygowanej>${o.korygowanaKsef}</NrKSeFFaKorygowanej></DaneFaKorygowanej>`
    : "";

  const terminXml = o.termin ? `<Platnosc><TerminPlatnosci><Termin>${o.termin}</Termin></TerminPlatnosci></Platnosc>` : "";

  return `<?xml version="1.0" encoding="utf-8"?><Faktura xmlns="${NS}"><Naglowek><KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza><WariantFormularza>${wariant}</WariantFormularza><DataWytworzeniaFa>${o.p1}T12:00:00</DataWytworzeniaFa></Naglowek><Podmiot1><DaneIdentyfikacyjne><NIP>${o.sprzedawcaNip}</NIP><Nazwa>${o.sprzedawcaNazwa}</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>PL</KodKraju><AdresL1>${o.sprzedawcaAdresL1 ?? "Testowa 1"}</AdresL1><AdresL2>${o.sprzedawcaAdresL2 ?? "00-001 Warszawa"}</AdresL2></Adres></Podmiot1><Podmiot2><DaneIdentyfikacyjne><NIP>${o.nabywcaNip}</NIP><Nazwa>${o.nabywcaNazwa}</Nazwa></DaneIdentyfikacyjne><Adres><KodKraju>PL</KodKraju><AdresL1>${o.nabywcaAdresL1 ?? "Kupiecka 2"}</AdresL1><AdresL2>${o.nabywcaAdresL2 ?? "00-002 Warszawa"}</AdresL2></Adres></Podmiot2><Fa><KodWaluty>${waluta}</KodWaluty><P_1>${o.p1}</P_1><P_2>${o.p2}</P_2><P_6>${p6}</P_6>${ratesXml}<P_15>${bruttoSum.toFixed(2)}</P_15><Adnotacje><P_18A>${o.mpp ? "1" : "2"}</P_18A></Adnotacje><RodzajFaktury>${rodzaj}</RodzajFaktury>${korXml}${wierszeXml}${terminXml}</Fa></Faktura>`;
}

/** nazwa pliku w formacie wymaganym przez KSeF: NIP-RRRRMMDD-XXXXXXXXXXXX-YY.xml */
export function ksefFileName(nip: string, dataNadania: string, hex12 = "78CD7F40000F", suffix = "4A"): string {
  const compact = dataNadania.replace(/-/g, "");
  return `${nip}-${compact}-${hex12}-${suffix}.xml`;
}
