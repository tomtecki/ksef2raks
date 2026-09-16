/**
 * Odczyt elementów XML po nazwie lokalnej, z ignorowaniem przestrzeni nazw.
 * FA(3) używa namespace http://crd.gov.pl/wzor/2025/06/25/13775/, ale nie
 * polegamy na konkretnym URI — czytamy wyłącznie localName, żeby przeżyć
 * zmiany wersji schematu.
 */
export function q(node: Element | null, path: string): Element | null {
  let cur: Element | null = node;
  for (const part of path.split("/")) {
    if (!cur) return null;
    let found: Element | null = null;
    for (const ch of Array.from(cur.children)) {
      if (ch.localName === part) {
        found = ch;
        break;
      }
    }
    cur = found;
  }
  return cur;
}

export function qt(node: Element | null, path: string): string | null {
  const e = q(node, path);
  return e ? (e.textContent ?? "").trim() : null;
}

/** wszystkie dzieci o nazwie ostatniego segmentu ścieżki */
export function qa(node: Element | null, path: string): Element[] {
  const parts = path.split("/");
  const last = parts.pop() as string;
  const parent = parts.length ? q(node, parts.join("/")) : node;
  if (!parent) return [];
  return Array.from(parent.children).filter((c) => c.localName === last);
}

export function parseXmlDocument(xmlText: string): Document {
  return new DOMParser().parseFromString(xmlText, "application/xml");
}

export function hasParserError(doc: Document): boolean {
  return doc.getElementsByTagName("parsererror").length > 0;
}
