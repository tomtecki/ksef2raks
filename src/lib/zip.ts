import { unzipSync, type Unzipped } from "fflate";

export interface ZipXmlEntry {
  /** nazwa bazowa pliku (bez ścieżki w archiwum) – potrzebna do odczytania numeru KSeF z nazwy */
  name: string;
  text: string;
}

/**
 * Rozpakowuje archiwum ZIP w pamięci przeglądarki (fflate, bez zapisu na dysk
 * i bez wysyłania czegokolwiek na serwer) i zwraca zawartość plików .xml.
 * KSeF eksportuje paczki z fakturami właśnie jako ZIP po kilka/kilkanaście
 * plików naraz, więc nie trzeba ich ręcznie rozpakowywać przed wczytaniem.
 */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Nie udało się odczytać pliku"));
    reader.readAsArrayBuffer(file);
  });
}

export async function extractXmlFromZip(file: File): Promise<ZipXmlEntry[]> {
  const buf = new Uint8Array(await readAsArrayBuffer(file));
  let unzipped: Unzipped;
  try {
    unzipped = unzipSync(buf, { filter: (f) => /\.xml$/i.test(f.name) });
  } catch (e) {
    throw new Error(`nie udało się odczytać archiwum ZIP (${(e as Error).message})`);
  }
  const decoder = new TextDecoder("utf-8");
  return Object.entries(unzipped)
    .filter(([name]) => /\.xml$/i.test(name))
    .map(([name, data]) => ({
      name: name.split("/").pop() || name,
      text: decoder.decode(data),
    }));
}
