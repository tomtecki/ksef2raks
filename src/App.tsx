import { useEffect, useMemo, useRef, useState } from "react";
import FileDrop from "./components/FileDrop";
import InvoiceTable from "./components/InvoiceTable";
import ContractorsTable from "./components/ContractorsTable";
import SettingsForm from "./components/SettingsForm";
import { parseInvoice } from "./lib/parseInvoice";
import { buildContractors } from "./lib/contractors";
import { evaluateBatch, selectedForExport } from "./lib/validation";
import { ourNipOf } from "./lib/invoiceHelpers";
import { buildRaks, encodeOutput, outputFileName } from "./lib/buildRaks";
import { fmt } from "./lib/format";
import { defaultRates, type RateInfo, type RateKey } from "./lib/rates";
import { DEFAULT_SETTINGS, MODE_DEFAULTS, loadProfile, saveProfile } from "./lib/profiles";
import type { Contractor, ImportMode, ImportSettings, ParsedInvoice } from "./types";

const APP_VERSION = "2.0";
const APP_DATE = "2026-09-16";

function download(name: string, data: Uint8Array | string) {
  const blob = new Blob([data as BlobPart], { type: "application/xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export default function App() {
  const [mode, setMode] = useState<ImportMode>("zakup");
  const [invoices, setInvoices] = useState<ParsedInvoice[]>([]);
  const [contractors, setContractors] = useState<Record<string, Contractor>>({});
  const [settings, setSettings] = useState<ImportSettings>({ ...DEFAULT_SETTINGS, ...MODE_DEFAULTS.zakup });
  const [rates, setRates] = useState<Record<RateKey, RateInfo>>(defaultRates());
  const [profileMsg, setProfileMsg] = useState("");
  const [genMsg, setGenMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const idCounter = useRef(0);
  const ratesRef = useRef(rates);
  ratesRef.current = rates;

  const evaluation = useMemo(() => evaluateBatch(invoices, mode, rates, settings), [invoices, mode, rates, settings]);

  const ourNip = useMemo(() => {
    const nips = [...new Set(invoices.filter((i) => i.ok).map((i) => (i.ok ? ourNipOf(i, mode) : "")).filter(Boolean))];
    return nips.length === 1 ? nips[0] : "";
  }, [invoices, mode]);

  // wczytanie profilu ustawień dla NIP-u wykrytego w partii (localStorage, bez treści faktur)
  useEffect(() => {
    if (!ourNip) {
      setProfileMsg("");
      return;
    }
    const saved = loadProfile(mode, ourNip);
    if (saved) {
      setSettings((s) => ({ ...s, ...saved }));
      setProfileMsg(`Wczytano zapisane ustawienia tej firmy (dziennik: ${saved.dziennik}, rejestr: ${saved.rejestr}).`);
    } else {
      setProfileMsg("Brak zapisanych ustawień dla tej firmy – sprawdź symbol dziennika i nazwę rejestru, potem zapisz.");
    }
  }, [ourNip, mode]);

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList).filter((f) => /\.xml$/i.test(f.name));
    const parsed: ParsedInvoice[] = [];
    for (const f of files) {
      const text = await f.text();
      idCounter.current += 1;
      parsed.push(parseInvoice(idCounter.current, f.name, text, ratesRef.current));
    }
    setInvoices((prev) => {
      const next = [...prev, ...parsed];
      setContractors((prevContractors) => buildContractors(next, mode, prevContractors));
      return next;
    });
    setGenMsg(null);
  }

  function handleModeChange(newMode: ImportMode) {
    setMode(newMode);
    setSettings((s) => ({ ...s, ...MODE_DEFAULTS[newMode] }));
    setContractors((prevContractors) => buildContractors(invoices, newMode, prevContractors));
    setGenMsg(null);
  }

  function handleToggleInvoice(id: number, checked: boolean) {
    setInvoices((prev) => prev.map((i) => (i.id === id && i.ok ? { ...i, sel: checked } : i)));
  }

  function handleContractorChange(nip: string, field: keyof Contractor, value: string) {
    setContractors((prev) => ({ ...prev, [nip]: { ...prev[nip], [field]: value } }));
  }

  function handleRateIdChange(key: RateKey, id: string) {
    setRates((prev) => ({ ...prev, [key]: { ...prev[key], id } }));
  }

  function handleSaveProfile() {
    if (!ourNip) return;
    const ok = saveProfile(mode, ourNip, settings);
    setProfileMsg(ok ? `Zapisano ustawienia dla NIP ${ourNip}.` : "Nie udało się zapisać (przeglądarka blokuje pamięć lokalną).");
  }

  function handleClear() {
    setInvoices([]);
    setContractors({});
    setGenMsg(null);
  }

  const selected = selectedForExport(invoices, evaluation);
  const summaryText = invoices.length
    ? selected.length
      ? `${selected.length} z ${invoices.length} faktur zaznaczonych, brutto razem ${fmt(selected.reduce((a, i) => a + i.brutto, 0))} PLN`
      : "nic nie zaznaczono"
    : "";

  function handleGenerate() {
    if (!settings.dziennik.trim() || !settings.rejestr.trim()) {
      setGenMsg({
        type: "err",
        text: 'Uzupełnij symbol dziennika i nazwę rejestru VAT zgodnie ze słownikami tej firmy w RAKS. Zły symbol powoduje odrzucenie wszystkich dokumentów („Brak dziennika (symbolu dokumentu)").',
      });
      return;
    }
    const { xml, count, ourNip: nip, period } = buildRaks(invoices, contractors, mode, settings, rates, evaluation);
    const { data, lost } = encodeOutput(xml, settings.encoding);
    const name = outputFileName(mode, nip, period);
    download(name, data);
    const note = lost ? `\nUwaga: ${lost} znaków spoza Windows-1250 zastąpiono znakiem "?".` : "";
    setGenMsg({ type: "ok", text: `Wygenerowano ${name}: ${count} dokumentów. Zaimportuj w RAKS: Dziennik → Zakupy → Import.${note}` });
  }

  return (
    <>
      <header>
        <h1>KSeF → RAKS</h1>
        <span className="sub">
          Faktury z KSeF (FA(3)/FA(2) XML) → zbiorczy plik XML do importu w RAKS (Dziennik → Zakupy/Sprzedaż → Import)
        </span>
        <span className="ver">
          wersja {APP_VERSION} · aktualizacja {APP_DATE}
        </span>
      </header>
      <main>
        <div className="privacy-banner">
          🔒 Wszystko dzieje się lokalnie w Twojej przeglądarce. Żaden plik faktury ani jego treść nie są nigdzie wysyłane –
          konwersja odbywa się w 100% po stronie klienta, nawet bez połączenia z siecią po załadowaniu strony. Jedyne, co
          zapisujemy trwale, to ustawienia importu w localStorage (bez treści faktur).
        </div>

        <section>
          <h2>1. Pliki z KSeF</h2>
          <FileDrop onFiles={handleFiles} />
          <p className="hint">
            Numer KSeF nie jest zapisany wewnątrz pliku FA(3) – jest odczytywany z nazwy pliku (np.{" "}
            <span className="mono">5461206251-20260731-5FD9DD800000-58.xml</span>). Nie zmieniaj nazw plików pobranych z
            KSeF.
          </p>
        </section>

        <section>
          <h2>2. Faktury</h2>
          <InvoiceTable invoices={invoices} mode={mode} evaluation={evaluation} rates={rates} onToggle={handleToggleInvoice} />
        </section>

        <section>
          <h2>3. Kontrahenci (dane do kartoteki – można poprawić przed generowaniem)</h2>
          <ContractorsTable contractors={contractors} onChange={handleContractorChange} />
          <p className="hint">
            Adres w FA(3) to dwie linie tekstu bez podziału na ulicę / numer / kod / miasto – podział jest heurystyczny,
            dlatego warto rzucić okiem.
          </p>
        </section>

        <section>
          <h2>4. Ustawienia importu</h2>
          <SettingsForm
            mode={mode}
            onModeChange={handleModeChange}
            settings={settings}
            onSettingsChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            ourNip={ourNip}
            profileMsg={profileMsg}
            onSaveProfile={handleSaveProfile}
            rates={rates}
            onRateIdChange={handleRateIdChange}
          />
        </section>

        <section>
          <h2>5. Plik do RAKS</h2>
          <div className="actions">
            <button type="button" disabled={!selected.length} onClick={handleGenerate}>
              Generuj plik do RAKS
            </button>
            <button type="button" className="secondary" onClick={handleClear}>
              Wyczyść
            </button>
            <span className="summary">{summaryText}</span>
          </div>
          {genMsg && <div className={`msg ${genMsg.type}`}>{genMsg.text}</div>}
        </section>
      </main>
    </>
  );
}
