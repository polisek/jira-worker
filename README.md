# Jira Worker

Desktopový klient pro Jira Cloud postavený na Electronu. Nabízí přehledné zobrazení issues, správu tasků a nativní notifikace — bez nutnosti otevírat prohlížeč.

## Funkce

- **Board view** — Kanban tabule s dynamickými sloupci podle skutečných statusů v Jiře; drag & drop pro přesun tasku do jiného stavu
- **List view** — tabulkový přehled issues s řazením a stránkováním
- **Detail tasku** — zobrazení popisu (ADF → HTML), komentáře, přiřazení uživatele, změna stavu tranzicemi
- **Vytváření issues** — modální okno pro nový task včetně výběru projektu, typu a přiřazení
- **Sidebar** — výběr projektu, filtrování (vše / jen moje / nepřiřazené), fulltextové vyhledávání
- **Notifikace** — polling nově přiřazených tasků s nativními systémovými notifikacemi
- **Nastavení** — konfigurace přístupu k Jiře a předvoleb aplikace
- **Vlastní titulbar** — bezrámové okno s vlastními tlačítky pro minimalizaci, maximalizaci a zavření

## Technologie

| Vrstva | Technologie |
|---|---|
| Runtime | Electron 28 |
| Bundler | electron-vite + Vite 5 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 3 |
| Persistence | electron-store (JSON) |
| Ikony | lucide-react |

## Požadavky

- Node.js ≥ 18
- Yarn (nebo npm)
- Účet Jira Cloud s vygenerovaným API tokenem

## Instalace a spuštění

```bash
# Instalace závislostí
yarn

# Spuštění v development módu (s hot-reload)
yarn dev

# Build produkčního bundlu
yarn build

# Sestavení instalátoru (.exe / NSIS pro Windows)
yarn dist:win
```

## Konfigurace přístupu k Jiře

Při prvním spuštění aplikace zobrazí obrazovku nastavení. Vyplňte:

| Pole | Popis | Příklad |
|---|---|---|
| **Jira URL** | Adresa vaší Jira instance | `https://firma.atlassian.net` |
| **E-mail** | Přihlašovací e-mail k Jira účtu | `jan@firma.cz` |
| **API token** | Token vygenerovaný na [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) | `ATATxxxxxxxx` |

Nastavení se ukládá lokálně pomocí `electron-store` do:

```
# macOS
~/Library/Application Support/jira-worker/config.json

# Windows
%APPDATA%\jira-worker\config.json
```

> **Bezpečnost:** API token je uložen v plaintextu v lokálním konfiguračním souboru. Soubor je přístupný pouze přihlášenému uživateli OS.

## Předvolby aplikace

V záložce **Nastavení → Předvolby** lze konfigurovat:

| Nastavení | Výchozí | Popis |
|---|---|---|
| Výchozí pohled | Board | Board nebo List |
| Výchozí filtr | Moje tasky | Vše / Moje / Nepřiřazené |
| Max. počet tasků | 100 | Limit výsledků JQL dotazu |
| Interval pollingu | 2 min | Jak často se synchronizují data |
| Okno notifikací | 24 h | Za jak dlouho se hlásí nové přiřazení |
| Stáří dokončených | 14 dní | Done tasky starší než X dní se skryjí |

## Architektura

```
src/
├── main/
│   └── index.ts          # Electron main process — IPC handlery, Jira API proxy,
│                         # electron-store, nativní notifikace, media interceptor
├── preload/
│   ├── index.ts          # Exponuje window.api do renderer procesu (contextBridge)
│   └── index.d.ts        # TypeScript typy pro window.api
└── renderer/src/
    ├── App.tsx            # Kořenová komponenta — routing pohledů, načítání nastavení
    ├── components/
    │   ├── BoardView.tsx       # Kanban tabule s drag & drop
    │   ├── ListView.tsx        # Tabulkový přehled issues
    │   ├── TaskDetail.tsx      # Detail tasku (panel vpravo)
    │   ├── CreateIssueModal.tsx # Formulář pro nový task
    │   ├── Sidebar.tsx         # Navigace, projekty, filtry, vyhledávání
    │   ├── SettingsView.tsx    # Nastavení přístupu a předvoleb
    │   ├── IssueCard.tsx       # Karta issue pro Board view
    │   ├── RecentAssignments.tsx # Panel notifikací
    │   ├── TitleBar.tsx        # Vlastní titulbar okna
    │   └── UserPicker.tsx      # Výběr uživatele pro přiřazení
    ├── hooks/
    │   ├── useIssues.ts        # Načítání issues přes JQL s debounce
    │   └── useNotifications.ts # Polling notifikací, správa přečtených
    ├── lib/
    │   ├── jira-api.ts         # Obálka nad Jira REST API v3 + Agile API v1.0
    │   └── adf-to-text.ts      # Převod Atlassian Document Format → HTML/text
    └── types/
        └── jira.ts             # TypeScript typy pro Jira entity
```

### IPC komunikace

Renderer proces nekomunikuje s Jirou přímo. Všechny API požadavky jdou přes IPC do main procesu, kde se přidají přihlašovací údaje:

```
renderer → window.api.jiraRequest() → IPC: jira:request → main → fetch(Jira Cloud)
```

Tím jsou credentials bezpečně izolovány od renderer kontextu.

## Sestavení distribučního balíčku

```bash
# Windows instalátor (NSIS)
yarn dist:win

# Obecný build pro aktuální platformu
yarn dist
```

Výstup se nachází v adresáři `dist/`.
