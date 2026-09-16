export interface ParsedAddress {
  ulica: string;
  nrDomu: string;
  nrLok: string;
  kod: string;
  miasto: string;
  kraj: string;
  kodKraju: string;
}

/**
 * Adres w FA(3) to jedna-dwie linie tekstu (AdresL1/AdresL2) bez podziału
 * na ulicę/numer/kod/miasto. Rozbicie jest heurystyczne i celowo edytowalne
 * w UI, bo bywa niedoskonałe (np. adresy wiejskie bez nazwy ulicy).
 */
export function parseAddress(l1: string | null | undefined, l2: string | null | undefined, kodKraju: string | null | undefined): ParsedAddress {
  let text = [l1, l2].filter(Boolean).join(", ").replace(/\s+/g, " ").trim();
  let kod = "";
  let miasto = "";
  let ulica = "";
  let nrDomu = "";
  let nrLok = "";

  const pm = /(\d{2}-\d{3})\s*([^,]*)/.exec(text);
  if (pm) {
    kod = pm[1];
    miasto = pm[2].trim();
    text = text.slice(0, pm.index) + " " + text.slice(pm.index + pm[0].length);
  }

  // usuń segmenty równe miastu (np. "Suchowola, Goniądzka 58")
  let segs = text.split(",").map((s) => s.trim()).filter(Boolean);
  if (miasto) segs = segs.filter((s) => s.toLowerCase() !== miasto.toLowerCase());
  let street = segs.join(" ").trim();
  street = street.replace(/^ul\.?\s+/i, "").replace(/^UL\.\s*/, "");

  const hm = /^(.*?)[\s,]+(\d+[a-zA-Z]?)(?:\s*(?:\/|m\.?|lok\.?)\s*(\d+[a-zA-Z]?))?\.?$/.exec(street);
  if (hm) {
    ulica = hm[1].trim();
    nrDomu = hm[2];
    nrLok = hm[3] || "";
  } else {
    ulica = street;
  }
  if (!miasto && !ulica && street) ulica = street;

  const kraj = (kodKraju || "PL").toUpperCase() === "PL" ? "Polska" : kodKraju || "";
  return { ulica, nrDomu, nrLok, kod, miasto, kraj, kodKraju: (kodKraju || "PL").toUpperCase() };
}
