/**
 * Narzędzie deweloperskie: uruchamia parser i generator RAKS na realnych
 * plikach KSeF z lokalnego, niewersjonowanego folderu (domyślnie "Pliki do
 * testów") i wypisuje wynik. Nie jest częścią aplikacji ani testów
 * jednostkowych – służy tylko do ręcznej weryfikacji na prawdziwych danych,
 * które nie trafiają do repozytorium (patrz .gitignore).
 *
 * Użycie: npm run verify-samples -- ["ścieżka/do/folderu"] [zakup|sprzedaz]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const dom = new JSDOM();
// @ts-expect-error – polyfill DOMParser dla środowiska Node (biblioteka domenowa zakłada przeglądarkę)
globalThis.DOMParser = dom.window.DOMParser;

const { parseInvoice } = await import("../src/lib/parseInvoice");
const { defaultRates } = await import("../src/lib/rates");
const { buildContractors } = await import("../src/lib/contractors");
const { evaluateBatch, selectedForExport } = await import("../src/lib/validation");
const { buildRaks, encodeOutput } = await import("../src/lib/buildRaks");
const { DEFAULT_SETTINGS, MODE_DEFAULTS } = await import("../src/lib/profiles");
const { encodeCp1250 } = await import("../src/lib/cp1250");
import type { ImportMode, ImportSettings, ParsedInvoice } from "../src/types";

const dir = process.argv[2] || "Pliki do testów";
const mode: ImportMode = (process.argv[3] as ImportMode) || "zakup";

const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml"));
if (!files.length) {
  console.error(`Brak plików .xml w "${dir}"`);
  process.exit(1);
}

const rates = defaultRates();
const invoices: ParsedInvoice[] = files.map((name, idx) => {
  const text = readFileSync(join(dir, name), "utf8");
  return parseInvoice(idx + 1, name, text, rates);
});

console.log(`Wczytano ${invoices.length} plików z "${dir}", tryb: ${mode}\n`);

let errCount = 0;
let warnCount = 0;
for (const inv of invoices) {
  if (!inv.ok) {
    errCount++;
    console.log(`[BŁĄD]  ${inv.file}: ${inv.errors.join("; ")}`);
    continue;
  }
  if (inv.errors.length) errCount++;
  if (inv.warnings.length) warnCount++;
  const tagParts = [
    inv.errors.length ? `BŁĘDY: ${inv.errors.join("; ")}` : "",
    inv.warnings.length ? `ostrzeżenia: ${inv.warnings.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  console.log(
    `${inv.errors.length ? "[BŁĄD] " : inv.warnings.length ? "[WARN] " : "[OK]   "}${inv.file}  p2=${inv.p2}  brutto=${inv.brutto}  ksef=${inv.ksefNr || "(brak)"}  stawki=${inv.rates.map((r) => r.key).join(",")}${tagParts ? "  " + tagParts : ""}`,
  );
}

const contractors = buildContractors(invoices, mode);
const settings: ImportSettings = { ...DEFAULT_SETTINGS, ...MODE_DEFAULTS[mode] };
const evaluation = evaluateBatch(invoices, mode, rates, settings);
const sel = selectedForExport(invoices, evaluation);

console.log(`\nPodsumowanie: ${invoices.length} plików, ${errCount} z błędami parsowania, ${warnCount} z ostrzeżeniami.`);
console.log(`Zaznaczonych do eksportu (nie zablokowanych): ${sel.length} / ${invoices.length}`);
console.log(`Wykryte NIP-y "naszej firmy": ${evaluation.ourNips.join(", ") || "(brak)"}`);
if (evaluation.mixedSides) console.log("UWAGA: wykryto mieszaną partię (zakupy + sprzedaż).");

for (const inv of invoices) {
  if (!inv.ok) continue;
  const ev = evaluation.perInvoice.get(inv.id);
  if (ev?.blocked) {
    console.log(`  zablokowana: ${inv.file} -> ${ev.tags.filter((t) => t.type === "err").map((t) => t.text).join("; ")}`);
  }
}

if (sel.length) {
  const { xml, count } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
  const { lost } = encodeOutput(xml, "cp1250");
  console.log(`\nWygenerowano plik RAKS: ${count} dokumentów, długość XML: ${xml.length} znaków.`);
  console.log(`Znaki spoza CP1250 zastąpione "?": ${lost}`);
  console.log(`CRLF obecne: ${xml.includes("\r\n")}`);
  const roundTrip = encodeCp1250(xml);
  console.log(`Zakodowano ${roundTrip.bytes.length} bajtów w CP1250.`);
}
