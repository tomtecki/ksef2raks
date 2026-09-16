export function num(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/** zaokrąglenie do 2 miejsc, odporne na błędy zmiennoprzecinkowe */
export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** format liczby jak w eksporcie RAKS: przecinek dziesiętny, bez zbędnych zer końcowych */
export function fmt(n: number): string {
  n = r2(n);
  let s = n.toFixed(2);
  s = s.replace(/\.?0+$/, "");
  return s.replace(".", ",");
}

export function trunc(s: string | null | undefined, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) : str;
}

export function nowStamp(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function ksefDateFromNr(nr: string | undefined): string {
  const m = /^\d{10}-(\d{4})(\d{2})(\d{2})-/.exec(nr || "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** ucieczka znaków specjalnych XML w atrybutach/tekście */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
