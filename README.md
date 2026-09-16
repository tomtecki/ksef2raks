# KSeF → RAKS

Konwerter faktur pobranych z polskiego systemu **KSeF** (XML w schemacie FA(3), obsługiwane też FA(2)) na
**zbiorczy plik XML importowany do programu księgowego RAKS SQL** (Dziennik → Zakupy/Sprzedaż → Import).

## Prywatność

Cała konwersja (parsowanie XML, generowanie pliku RAKS, walidacja) odbywa się **w 100% po stronie
przeglądarki użytkownika**. Żaden plik faktury ani jego treść nie jest nigdzie wysyłany – aplikacja nie ma
backendu ani bazy danych i nie przechowuje żadnych informacji o konwertowanych fakturach. Jedyne trwałe
przechowywanie to `localStorage` przeglądarki na profile ustawień importu per firma (symbol dziennika, nazwa
rejestru itd.) – bez treści faktur.

## Stack

- React 18 + TypeScript, zbudowane Vite jako statyczna aplikacja SPA (bez SSR/API – nie są potrzebne, bo cała
  logika działa w przeglądarce).
- Parsowanie XML: natywny `DOMParser`, porównywanie elementów po `localName` (niezależnie od przestrzeni nazw).
- Testy jednostkowe: Vitest (jsdom).
- Wdrożenie: obraz Docker wieloetapowy (build w Node, serwowanie statyki przez nginx) – jedyny sposób
  uruchomienia w produkcji, bez zależności od Node w runtime.

## Uruchomienie z Dockerem

```bash
docker compose up --build
```

Aplikacja będzie dostępna pod adresem [http://localhost:8080](http://localhost:8080).

Bez docker-compose:

```bash
docker build -t ksef2raks .
docker run --rm -p 8080:8080 ksef2raks
```

## Rozwój lokalny (bez Dockera)

Wymaga Node.js 22+.

```bash
npm install
npm run dev        # serwer deweloperski (Vite), domyślnie http://localhost:5173
npm run build       # build produkcyjny do dist/
npm run preview     # podgląd builda produkcyjnego
npm test             # testy jednostkowe (Vitest)
```

### Weryfikacja na rzeczywistych plikach KSeF

`npm run verify-samples -- "<folder z plikami .xml>" [zakup|sprzedaz]` uruchamia parser i generator RAKS na
plikach z podanego, lokalnego folderu i wypisuje wynik w konsoli (statusy, błędy, ostrzeżenia, wykryte
mieszane partie, podsumowanie wygenerowanego pliku). Nie jest częścią testów jednostkowych – to narzędzie do
ręcznej weryfikacji na prawdziwych fakturach, które **nie powinny trafiać do repozytorium** (patrz
`.gitignore` – folder z przykładowymi fakturami jest celowo wykluczony, bo zawiera wrażliwe dane: NIP-y, nazwy
firm, adresy, numery kont bankowych).

## Zakres tej wersji

- Wejście: pliki XML z KSeF wrzucane ręcznie (drag&drop lub wybór) – bez pobierania z API KSeF.
- Bez generowania oznaczeń GTU / procedur – RAKS nadaje je przy księgowaniu.
- Bez automatycznej dekretacji – dekretacja ręczna w RAKS po imporcie (opcjonalnie prosty dekret z 3 kont, gdy
  wszystkie są podane w ustawieniach).

### Rzeczy do zweryfikowania na docelowym RAKS

1. Reakcja RAKS na dokument z pustą sekcją `<DEKRETY>` (czy przyjmie jako niezaksięgowany).
2. Zachowanie przy `KONTAKT/ID` nieistniejącym jeszcze w bazie (oczekiwane: dopasowanie po NIP / założenie
   kartoteki).
3. `ID_STAWKI` dla stawek 0%, np. oraz przypadków mieszanych ze zw. – potwierdzone są obecnie tylko 23%=12,
   8%=13, 5%=15 (z rzeczywistych eksportów RAKS); pozostałe trzeba uzupełnić w tabeli mapowania stawek w UI.
