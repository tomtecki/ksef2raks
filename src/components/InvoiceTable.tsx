import { fmt } from "../lib/format";
import { kontrOf, ourNipOf } from "../lib/invoiceHelpers";
import type { RateInfo, RateKey } from "../lib/rates";
import type { BatchEvaluation } from "../lib/validation";
import type { ImportMode, ParsedInvoice } from "../types";

interface Props {
  invoices: ParsedInvoice[];
  mode: ImportMode;
  evaluation: BatchEvaluation;
  rates: Record<RateKey, RateInfo>;
  onToggle: (id: number, checked: boolean) => void;
}

export default function InvoiceTable({ invoices, mode, evaluation, rates, onToggle }: Props) {
  if (!invoices.length) return <p className="empty">Brak wczytanych faktur.</p>;

  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Plik</th>
              <th>Nr faktury</th>
              <th>Kontrahent</th>
              <th>Data wyst.</th>
              <th>Data sprzed.</th>
              <th>Nr KSeF</th>
              <th>Data KSeF</th>
              <th className="num">Brutto</th>
              <th>Stawki</th>
              <th>NIP firmy</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const ev = evaluation.perInvoice.get(inv.id);
              const blocked = ev?.blocked ?? true;
              const cls = blocked ? "err" : ev && ev.tags.some((t) => t.type === "warn") ? "warn" : "";
              const k = inv.ok ? kontrOf(inv, mode) : null;
              return (
                <tr key={inv.id} className={cls}>
                  <td>
                    <input
                      type="checkbox"
                      checked={inv.ok && inv.sel && !blocked}
                      disabled={blocked}
                      onChange={(e) => onToggle(inv.id, e.target.checked)}
                    />
                  </td>
                  <td className="mono">{inv.file}</td>
                  <td>{inv.ok ? inv.p2 : ""}</td>
                  <td>
                    {k?.nazwa}
                    <br />
                    <span className="mono">{k?.nip}</span>
                  </td>
                  <td>{inv.ok ? inv.p1 : ""}</td>
                  <td>{inv.ok ? inv.p6 : ""}</td>
                  <td className="mono">{inv.ok ? inv.ksefNr : ""}</td>
                  <td>{inv.ok ? inv.ksefData : ""}</td>
                  <td className="num">{inv.ok ? fmt(inv.brutto) : ""}</td>
                  <td>{inv.ok ? inv.rates.map((r) => rates[r.key].label).join(", ") : ""}</td>
                  <td className="mono">{inv.ok ? ourNipOf(inv, mode) : ""}</td>
                  <td>
                    {ev?.tags.map((t, i) => (
                      <span key={i} className={`tag ${t.type}`}>
                        {t.text}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {evaluation.mixedSides && (
        <div className="msg err">
          Uwaga: w partii są jednocześnie faktury <b>zakupowe i sprzedażowe</b>. Wybrano tryb „
          {mode === "sprzedaz" ? "Sprzedaż" : "Zakupy"}" – faktury z drugiej strony trafią do złej strony rejestru. Rozdziel
          pliki na dwie partie albo zmień tryb.
        </div>
      )}
      {evaluation.ourNips.length > 1 && (
        <div className="msg warn">
          W partii są faktury {mode === "sprzedaz" ? "od" : "dla"} {evaluation.ourNips.length} różnych firm (
          {evaluation.ourNips.join(", ")}). Plik do RAKS powinien dotyczyć jednej firmy – odznacz faktury innych.
        </div>
      )}
    </>
  );
}
