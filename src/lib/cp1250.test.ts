import { describe, expect, it } from "vitest";
import { encodeCp1250 } from "./cp1250";

describe("encodeCp1250", () => {
  it("koduje polskie znaki diakrytyczne na poprawne bajty CP1250", () => {
    const { bytes, lost } = encodeCp1250("Łąka źrebięcia świec");
    expect(lost).toBe(0);
    // "Ł" = 0xA3, "ą" = 0xB9 w Windows-1250
    expect(bytes[0]).toBe(0xa3);
    expect(bytes[1]).toBe(0xb9);
  });

  it("zamienia znaki spoza CP1250 na '?' i liczy je", () => {
    const { bytes, lost } = encodeCp1250("test 中 emoji 😀");
    expect(lost).toBeGreaterThan(0);
    const text = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    expect(text).toContain("?");
  });

  it("nie rusza znaków ASCII", () => {
    const { bytes, lost } = encodeCp1250("ABC 123 <tag/>");
    expect(lost).toBe(0);
    expect(Array.from(bytes)).toEqual(Array.from("ABC 123 <tag/>").map((c) => c.charCodeAt(0)));
  });
});
