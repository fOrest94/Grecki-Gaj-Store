# Grecki Gaj

Lokalny sklep z polskim interfejsem, API Fastify i bazą PostgreSQL. Produkty,
użytkownicy, adresy, koszyki, zamówienia, płatności, przesyłki, zwroty, treści
i historia retencji są przechowywane w bazie danych.

## Szybki start

Wymagane: Node.js >= 22.13, Docker Desktop i wolne porty 3000, 4000 oraz 5433.

```powershell
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

- sklep: http://localhost:3000
- API: http://localhost:4000
- kontrola API: http://localhost:4000/health

`npm run dev` uruchamia jednocześnie frontend i API. Kontener bazy zachowuje
dane w wolumenie Dockera także po `npm run db:down`.

## pgAdmin

Utwórz połączenie przez `Register > Server`:

| Pole | Wartość |
| --- | --- |
| Name | Grecki Gaj Local |
| Host name/address | localhost |
| Port | 5433 |
| Maintenance database | grecki_gaj |
| Username | grecki_gaj |
| Password | grecki_gaj_dev_2026 |

Tabele znajdziesz w `Databases > grecki_gaj > Schemas > public > Tables`.
Te same dane są w lokalnym pliku `.env`; plik nie jest wersjonowany przez Git.

## Konta testowe

- administrator: `admin@greckigaj.local` / `Admin123!`
- klient: `anna@greckigaj.local` / `Klient123!`

Rejestracja nowego konta zwraca w interfejsie lokalny link potwierdzający e-mail.
Sesja jest zapisywana w bazie, a przeglądarka otrzymuje ciasteczko `httpOnly`.

## Panel administratora

Panel jest dostępny w stopce sklepu po zalogowaniu kontem administratora.
Pozwala zarządzać pełnymi danymi i cenami produktów, publikować artykuły ze
zdjęciem, zmieniać opis gaju i numer telefonu, przeglądać wszystkie zamówienia
oraz zmieniać ich statusy. Osobna zakładka obsługuje wszystkie zwroty i
reklamacje wraz z decyzją, opisem rozstrzygnięcia i statusem realizacji.

Obraz artykułu można podać jako adres URL albo wybrać z dysku. W wersji lokalnej
wybrany plik jest zapisywany w rekordzie artykułu jako dane obrazu; przed
wdrożeniem produkcyjnym należy przenieść media do magazynu obiektowego.

## Migracje

Schemat jest zdefiniowany w `db/schema.ts`, a wersjonowane pliki SQL trafiają do
`drizzle/`.

```powershell
# po zmianie db/schema.ts
npm run db:generate
npm run db:migrate

# ponowne dodanie brakujących danych przykładowych
npm run db:seed

# ręczny test retencji
npm run db:retention
```

Migracji używaj do zmian struktury. Dane biznesowe usuwaj przez API lub osobną,
świadomie przygotowaną migrację danych. `db:seed` jest idempotentny i można go
uruchamiać wielokrotnie.

## Model danych

Najważniejsze tabele to `users`, `addresses`, `sessions`, `products`,
`product_images`, `tags`, `carts`, `cart_items`, `orders`, `order_items`,
`order_status_history`, `payments`, `shipments`, `return_requests`, `articles`,
`grove_updates`, `accounting_documents`, `retention_runs` i `audit_log`.

Po trzech latach zadanie retencyjne anonimizuje dane osobowe zamówień i
zakończonych zgłoszeń. Dokumenty księgowe mają własne pole `retain_until`, dzięki
czemu mogą pozostać przez wymagane pięć lat. Wynik każdego przebiegu trafia do
`retention_runs`.

## Granice integracji lokalnej

Koszyk, zamówienia, konta i CRUD produktów korzystają z prawdziwej bazy.
Paczkomaty są obecnie danymi pokazowymi. Przed sprzedażą trzeba podłączyć
produkcyjne InPost Geowidget i ShipX, wysyłkę e-maili, właściwy rachunek bankowy,
magazyn plików dla zdjęć oraz zweryfikować dokumenty prawne i dane sprzedawcy.

## Kontrola jakości

```powershell
npm run typecheck
npm run lint
npm test
```

## Tanie wdrozenie MVP

Najprostszy wariant publiczny to Railway Hobby: osobna usluga API, usluga
PostgreSQL z szablonu Railway oraz usluga frontendu. Plan Hobby ma minimum
5 USD miesiecznie i obejmuje 5 USD uzycia; darmowy trial nie jest planem do
trwalego przechowywania danych.

Ustaw w usludze API:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
FRONTEND_ORIGIN=https://adres-frontendu
SESSION_COOKIE=gg_session
SEED_ADMIN_EMAIL=admin@twojadomena.pl
SEED_ADMIN_PASSWORD=dlugie-losowe-haslo
```

Komenda startowa API:

```text
npm run db:migrate
npm run db:seed
npm run start:api
```

Frontend zbuduj po ustawieniu `NEXT_PUBLIC_API_URL` na publiczny adres API i
uruchom przez `npm run build` oraz `npm run start`. Po pierwszym wdrozeniu
utworz konto administratora przez jednorazowy, bezpieczny seed zamiast uzywac
danych demonstracyjnych z lokalnego srodowiska.

### Jedna usluga (frontend + API razem)

Jesli wdrazasz frontend i API jako jeden proces na jednym porcie, ustaw
komende startowa uslugi na:

```text
npm run start:production
```

Ten skrypt uruchamia migracje bazy danych, buduje frontend Next.js
(`npm run build`) i dopiero potem startuje serwer Fastify (`npm run start:api`).
Dzieki temu build zawsze powstaje przed startem API i unikamy bledu 404 na
stronie glownej wynikajacego z braku zbudowanych plikow frontendu.
