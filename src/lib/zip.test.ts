import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractXmlFromZip } from "./zip";

function makeZipFile(entries: Record<string, string>, name = "faktury.zip"): File {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])),
  );
  return new File([zipped], name, { type: "application/zip" });
}

describe("extractXmlFromZip", () => {
  it("wyciąga wszystkie pliki .xml z archiwum, z zachowaniem oryginalnych nazw", async () => {
    const zip = makeZipFile({
      "5451773043-20260724-61F8FDC00000-13.xml": "<Faktura>a</Faktura>",
      "5461206251-20260731-5FD9DD800000-58.xml": "<Faktura>b</Faktura>",
    });
    const entries = await extractXmlFromZip(zip);
    expect(entries).toHaveLength(2);
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(["5451773043-20260724-61F8FDC00000-13.xml", "5461206251-20260731-5FD9DD800000-58.xml"]);
    expect(entries.find((e) => e.name.startsWith("5451773043"))?.text).toBe("<Faktura>a</Faktura>");
  });

  it("pomija pliki inne niż .xml w archiwum (np. plik odczytu/README)", async () => {
    const zip = makeZipFile({
      "5451773043-20260724-61F8FDC00000-13.xml": "<Faktura>a</Faktura>",
      "odczyt.txt": "to nie jest faktura",
    });
    const entries = await extractXmlFromZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("5451773043-20260724-61F8FDC00000-13.xml");
  });

  it("zwraca samą nazwę pliku, gdy XML-e są zagnieżdżone w folderze wewnątrz ZIP", async () => {
    const zip = makeZipFile({
      "eksport_ksef/5451773043-20260724-61F8FDC00000-13.xml": "<Faktura>a</Faktura>",
    });
    const entries = await extractXmlFromZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("5451773043-20260724-61F8FDC00000-13.xml");
  });

  it("zwraca pustą listę dla archiwum bez plików .xml", async () => {
    const zip = makeZipFile({ "odczyt.txt": "brak faktur" });
    const entries = await extractXmlFromZip(zip);
    expect(entries).toEqual([]);
  });
});
