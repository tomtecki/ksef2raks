import type { RateInfo, RateKey } from "../lib/rates";

interface Props {
  rates: Record<RateKey, RateInfo>;
  onChangeId: (key: RateKey, id: string) => void;
}

export default function RatesTable({ rates, onChangeId }: Props) {
  return (
    <table className="rates" style={{ width: "auto", marginTop: 8 }}>
      <thead>
        <tr>
          <th>Stawka (z FA)</th>
          <th>ID_STAWKI</th>
          <th>WARTOSC_STAWKI</th>
        </tr>
      </thead>
      <tbody>
        {(Object.entries(rates) as [RateKey, RateInfo][]).map(([key, r]) => (
          <tr key={key}>
            <td>{r.label}</td>
            <td>
              <input
                type="text"
                className="short"
                style={{ width: 70 }}
                value={r.id}
                onChange={(e) => onChangeId(key, e.target.value.trim())}
              />
            </td>
            <td>{r.wartosc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
