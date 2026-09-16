import type { ImportMode, ImportSettings } from "../types";
import RatesTable from "./RatesTable";
import type { RateInfo, RateKey } from "../lib/rates";

interface Props {
  mode: ImportMode;
  onModeChange: (m: ImportMode) => void;
  settings: ImportSettings;
  onSettingsChange: (patch: Partial<ImportSettings>) => void;
  ourNip: string;
  profileMsg: string;
  onSaveProfile: () => void;
  rates: Record<RateKey, RateInfo>;
  onRateIdChange: (key: RateKey, id: string) => void;
}

function set<K extends keyof ImportSettings>(onSettingsChange: Props["onSettingsChange"], key: K) {
  return (value: ImportSettings[K]) => onSettingsChange({ [key]: value } as Partial<ImportSettings>);
}

export default function SettingsForm({
  mode,
  onModeChange,
  settings,
  onSettingsChange,
  ourNip,
  profileMsg,
  onSaveProfile,
  rates,
  onRateIdChange,
}: Props) {
  const typZakupuLabel = mode === "sprzedaz" ? "TYP_SPRZEDAZY" : "TYP_ZAKUPU";
  const nipLabel = mode === "sprzedaz" ? "NIP sprzedawcy" : "NIP nabywcy";

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <label>
          Rodzaj dokumentów
          <select value={mode} onChange={(e) => onModeChange(e.target.value as ImportMode)}>
            <option value="zakup">Zakupy (faktury kosztowe)</option>
            <option value="sprzedaz">Sprzedaż (faktury przychodowe)</option>
          </select>
        </label>
        <label>
          Firma ({nipLabel} z faktur)
          <input type="text" className="mono" readOnly value={ourNip} placeholder="— wczytaj faktury —" />
        </label>
        <button type="button" className="secondary" disabled={!ourNip} onClick={onSaveProfile}>
          Zapisz ustawienia dla tej firmy
        </button>
        <span className="summary">{profileMsg}</span>
      </div>

      <div className="row">
        <label>
          Symbol dziennika (Słowniki → Dzienniki tej firmy)
          <input
            type="text"
            className="short"
            value={settings.dziennik}
            onChange={(e) => set(onSettingsChange, "dziennik")(e.target.value)}
          />
        </label>
        <label>
          TYP_DOK
          <input
            type="text"
            className="short"
            value={settings.typdok}
            onChange={(e) => set(onSettingsChange, "typdok")(e.target.value)}
          />
        </label>
        <label>
          Nazwa typu dokumentu
          <input type="text" value={settings.nazwadok} onChange={(e) => set(onSettingsChange, "nazwadok")(e.target.value)} />
        </label>
        <label>
          Nazwa rejestru VAT
          <input type="text" value={settings.rejestr} onChange={(e) => set(onSettingsChange, "rejestr")(e.target.value)} />
        </label>
        <label>
          {typZakupuLabel}
          <input
            type="text"
            className="short"
            value={settings.typzakupu}
            onChange={(e) => set(onSettingsChange, "typzakupu")(e.target.value)}
          />
        </label>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label>
          Data księgowania (DATA_KS / DATA_VAT)
          <select value={settings.dataks} onChange={(e) => set(onSettingsChange, "dataks")(e.target.value as ImportSettings["dataks"])}>
            <option value="wyst">data wystawienia (P_1)</option>
            <option value="ksef">data nadania nr KSeF</option>
            <option value="sprz">data sprzedaży (P_6)</option>
          </select>
        </label>
        <label>
          Data otrzymania (DATA_OTRZYMANIA)
          <select
            value={settings.dataotrz}
            onChange={(e) => set(onSettingsChange, "dataotrz")(e.target.value as ImportSettings["dataotrz"])}
          >
            <option value="ksef">data nadania nr KSeF</option>
            <option value="wyst">data wystawienia (P_1)</option>
          </select>
        </label>
        <label>
          Opis dokumentu / rozrachunku
          <select value={settings.opis} onChange={(e) => set(onSettingsChange, "opis")(e.target.value as ImportSettings["opis"])}>
            <option value="poz">nazwa pierwszej pozycji faktury</option>
            <option value="nr">numer faktury</option>
            <option value="">pusty</option>
          </select>
        </label>
        <label>
          Kodowanie pliku
          <select
            value={settings.encoding}
            onChange={(e) => set(onSettingsChange, "encoding")(e.target.value as ImportSettings["encoding"])}
          >
            <option value="cp1250">Windows-1250 (jak eksport RAKS)</option>
            <option value="utf8">UTF-8</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label className="check">
          <input type="checkbox" checked={settings.rozr} onChange={(e) => set(onSettingsChange, "rozr")(e.target.checked)} />
          generuj rozrachunek (zobowiązanie)
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.novat} onChange={(e) => set(onSettingsChange, "novat")(e.target.checked)} />
          faktury tylko zw./np. – bez wpisu do rejestru VAT (jak w eksporcie RAKS)
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.meta} onChange={(e) => set(onSettingsChange, "meta")(e.target.checked)} />
          dołącz sekcję METADANE
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.kont} onChange={(e) => set(onSettingsChange, "kont")(e.target.checked)} />
          dołącz sekcję KONTAKTY (kartoteka kontrahentów)
        </label>
        <label>
          TYP_DOK dla korekt (KOR) – puste = pomiń korekty
          <input
            type="text"
            className="short"
            value={settings.typkor}
            onChange={(e) => set(onSettingsChange, "typkor")(e.target.value)}
          />
        </label>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary>Dekrety (opcjonalnie – domyślnie dekretacja ręczna w RAKS)</summary>
        <div className="row" style={{ marginTop: 8 }}>
          <label>
            Konto rozrachunkowe (MA, brutto)
            <input type="text" value={settings.dRozr} onChange={(e) => set(onSettingsChange, "dRozr")(e.target.value)} />
          </label>
          <label>
            Konto kosztowe (WN, netto)
            <input
              type="text"
              placeholder="np. 401"
              value={settings.dKoszt}
              onChange={(e) => set(onSettingsChange, "dKoszt")(e.target.value)}
            />
          </label>
          <label>
            Konto VAT naliczony (WN)
            <input
              type="text"
              placeholder="np. 221"
              value={settings.dVat}
              onChange={(e) => set(onSettingsChange, "dVat")(e.target.value)}
            />
          </label>
        </div>
        <p className="hint">
          Dekrety są generowane tylko, gdy wszystkie trzy konta są wypełnione. „@D” to symbol zastępowany przy imporcie
          analityką konta dostawcy (np. 202-1-D); dla nowych kontrahentów RAKS zakłada kartotekę i nadaje konto, jeśli w
          Parametrach firmy włączono „Nadawanie kont podczas importu (nowe kontakty)”.
          <br />
          <b>Do zweryfikowania na docelowym RAKS:</b> reakcja na dokument z pustą sekcją DEKRETY (czy przyjmie jako
          niezaksięgowany) oraz zachowanie przy KONTAKT/ID nieistniejącym jeszcze w bazie (oczekiwane: dopasowanie po NIP /
          założenie kartoteki).
        </p>
      </details>

      <details style={{ marginTop: 14 }} open>
        <summary>Mapowanie stawek VAT na ID_STAWKI w RAKS</summary>
        <RatesTable rates={rates} onChangeId={onRateIdChange} />
        <p className="hint">
          Z eksportów RAKS znane są identyfikatory 23%=12, 8%=13, 5%=15. Faktury wyłącznie zw./np. są domyślnie importowane
          bez wpisu do rejestru VAT (tak jak w eksporcie z RAKS), więc nie potrzebują ID. Pozostałe identyfikatory (0%,
          stawka mieszana ze zw. …) trzeba odczytać z eksportu dokumentu z taką stawką lub z dokumentacji RAKS. Faktura ze
          stawką bez ID_STAWKI zostanie oznaczona błędem i wykluczona z eksportu.
        </p>
      </details>
    </>
  );
}
