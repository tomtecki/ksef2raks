import type { Contractor } from "../types";

interface Props {
  contractors: Record<string, Contractor>;
  onChange: (nip: string, field: keyof Contractor, value: string) => void;
}

const FIELDS: { key: keyof Contractor; label: string; width: string }[] = [
  { key: "nazwa", label: "Nazwa", width: "100%" },
  { key: "ulica", label: "Ulica", width: "100%" },
  { key: "nrDomu", label: "Nr domu", width: "60px" },
  { key: "nrLok", label: "Nr lok.", width: "60px" },
  { key: "kod", label: "Kod", width: "80px" },
  { key: "miasto", label: "Miejscowość", width: "100%" },
  { key: "kraj", label: "Kraj", width: "90px" },
];

export default function ContractorsTable({ contractors, onChange }: Props) {
  const list = Object.values(contractors);
  if (!list.length) return <p className="empty">Brak.</p>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>NIP</th>
            {FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.nip}>
              <td className="mono">{c.nip}</td>
              {FIELDS.map((f) => (
                <td key={f.key}>
                  <input
                    type="text"
                    style={{ width: f.width }}
                    value={c[f.key]}
                    onChange={(e) => onChange(c.nip, f.key, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
