# agents.md — průvodce kódem pro AI agenty

Tento soubor popisuje strukturu, konvence a pravidla projektu **Jira Worker** tak, aby AI asistenti mohli efektivně přispívat do codebase bez zbytečných dotazů.

---

## Přehled projektu

Desktopová Electron aplikace (Windows primary target) sloužící jako čistý klient pro Jira Cloud. Renderer je React 18 + TypeScript + Tailwind CSS, main process obsluhuje veškerou komunikaci s Jira REST API.

---

## Příkazy

```bash
yarn dev          # spustí dev server s hot-reload (electron-vite)
yarn build        # sestaví produkční bundle do out/
yarn dist:win     # build + NSIS instalátor pro Windows (výstup: dist/)
```

Žádné testy nejsou nakonfigurovány. Žádný linter není nastaven (pouze TypeScript kontrola).

---

## Architektura — tři procesy Electronu

```
┌─────────────────────────────────────────────────────────┐
│  main process  (src/main/index.ts)                      │
│  • electron-store: ukládá settings + prefs              │
│  • fetch() volání na Jira API (credentials zde)         │
│  • nativní notifikace (Notification API)                │
│  • media interceptor (Basic auth pro <img> z Jiry)      │
│  • IPC handlery: settings:get/set, prefs:get/set,       │
│    jira:request, notify, window-minimize/maximize/close │
└────────────────────────┬────────────────────────────────┘
                         │ IPC (ipcMain / ipcRenderer)
┌────────────────────────┴────────────────────────────────┐
│  preload  (src/preload/index.ts)                        │
│  • contextBridge → window.api                           │
│  • exponuje: getSettings, setSettings, getPrefs,        │
│    setPrefs, jiraRequest, notify, window-*              │
└────────────────────────┬────────────────────────────────┘
                         │ window.api.*
┌────────────────────────┴────────────────────────────────┐
│  renderer  (src/renderer/src/)                          │
│  • React 18, plně TypeScript                            │
│  • NIKDY nevolá fetch() přímo — vždy přes window.api   │
└─────────────────────────────────────────────────────────┘
```

**Klíčové pravidlo:** Jira credentials (baseUrl, email, apiToken) jsou dostupné pouze v main procesu. Renderer je nikdy nedostává — veškeré API volání deleguje přes IPC `jira:request`.

---

## Datový tok pro Jira API

```
komponenta
  → jiraApi.*(...)                 (src/lib/jira-api.ts)
  → window.api.jiraRequest(...)    (preload contextBridge)
  → ipcMain.handle('jira:request') (main/index.ts)
  → fetch(Jira Cloud REST API)
```

`jira-api.ts` používá dvě interní funkce:
- `request(method, path, body)` → Jira REST API v3 (`/rest/api/3{path}`)
- `agileRequest(path)` → Jira Agile API v1.0 (`/rest/agile/1.0{path}`) — cesta se prefixuje `__agile__` jako signál pro main process

---

## Struktura souborů

```
src/
├── main/index.ts               # Celý main process v jednom souboru
├── preload/
│   ├── index.ts                # contextBridge definice
│   └── index.d.ts              # Typy pro window.api (TypeScript)
└── renderer/src/
    ├── App.tsx                 # Root komponenta, správa globálního stavu
    ├── main.tsx                # ReactDOM.createRoot entry point
    ├── components/
    │   ├── BoardView.tsx       # Kanban (dynamické sloupce ze statusů, drag & drop)
    │   ├── ListView.tsx        # Tabulkový přehled
    │   ├── TaskDetail.tsx      # Detail panel (vpravo, slide-in)
    │   ├── CreateIssueModal.tsx # Modál pro nový task
    │   ├── Sidebar.tsx         # Levý panel: projekty, filtry, vyhledávání, notifikace
    │   ├── SettingsView.tsx    # Nastavení přístupu (Jira) + App předvolby
    │   ├── IssueCard.tsx       # Karta pro Board view
    │   ├── RecentAssignments.tsx # Panel notifikací v sidebaru
    │   ├── TitleBar.tsx        # Frameless window titlebar s ovládacími prvky
    │   └── UserPicker.tsx      # Dropdown pro výběr assignee
    ├── hooks/
    │   ├── useIssues.ts        # JQL fetch s debounce (400ms pro search)
    │   └── useNotifications.ts # Polling přiřazení, localStorage pro seen IDs
    ├── lib/
    │   ├── jira-api.ts         # Obálka nad Jira API — všechny API metody zde
    │   └── adf-to-text.ts      # ADF → plain text + ADF → HTML konvertor
    ├── types/jira.ts           # Sdílené TypeScript typy + DEFAULT_PREFS konstanta
    └── styles/globals.css      # Tailwind + vlastní CSS komponenty (@layer components)
```

---

## Kde přidávat kód

| Úkol | Kde |
|---|---|
| Nová Jira API metoda | `src/renderer/src/lib/jira-api.ts` — přidat do `jiraApi` objektu |
| Nový IPC kanál | `src/main/index.ts` + `src/preload/index.ts` + `src/preload/index.d.ts` |
| Nová UI komponenta | `src/renderer/src/components/` |
| Nový React hook | `src/renderer/src/hooks/` |
| Nový Jira typ | `src/renderer/src/types/jira.ts` |
| Globální CSS třída | `src/renderer/src/styles/globals.css` v `@layer components` |

---

## Konvence kódu

### TypeScript
- Všechny soubory jsou `.ts` nebo `.tsx`, žádný plain JS v `src/`
- Typy importovat jako `import type { ... }` kdekoli je to možné
- `interface` pro objektové typy Jiry, `type` pro aliasy a unions
- Explicitní typy návratových hodnot u hooků a exportovaných funkcí

### React komponenty
- Pojmenované exporty (ne default) pro všechny komponenty kromě `App.tsx`
- Props vždy typovány přes lokální `interface Props { ... }`
- Fragmenty (`<>...</>`) místo zbytečných `<div>` wrapperů

### Styling
- **Tailwind třídy** pro vše kromě komplexních vzorů
- Sdílené CSS vzory patří do `globals.css` jako `@layer components` (např. `.btn-primary`, `.input`, `.badge-*`, `.issue-card`)
- Barevná paleta: tmavé pozadí `#0f1117`, sidebar `#080b10`, karty `bg-gray-800/60`
- Žádné inline `style={}` kromě dynamicky generovaných hodnot (SVG data URL apod.)

### Pojmenování
- Komponenty: `PascalCase`
- Hooks: `camelCase` s prefixem `use`
- Soubory komponent: `PascalCase.tsx`, hooks: `camelCase.ts`
- IPC kanály: `resource:action` (např. `jira:request`, `settings:get`)

---

## Správa stavu

- **Globální stav** žije v `App.tsx` — settings, prefs, selectedProject, selectedIssue, view
- **Lokální stav** zůstává v komponentě nebo hooku kde vznikl
- **Žádný state manager** (Redux, Zustand apod.) — použít React useState + prop drilling nebo callback props
- **Perzistence** pouze přes `electron-store` (main process) nebo `localStorage` (jen pro `useNotifications` — seznam viděných ID)

---

## Klíčové datové typy (`src/types/jira.ts`)

```typescript
JiraSettings   // baseUrl, email, apiToken, defaultProject?
AppPrefs       // doneMaxAgeDays, defaultFilter, defaultView, maxResults,
               // pollIntervalMinutes, notifWindowHours
JiraIssue      // kompletní issue objekt
JiraProject    // id, key, name, avatarUrls
JiraUser       // accountId, displayName, emailAddress, avatarUrls
JiraSprint     // id, name, state
ViewMode       // 'board' | 'list' | 'settings'
```

`DEFAULT_PREFS` konstanta je exportována z `types/jira.ts` a používá se jako výchozí hodnota při načítání.

---

## ADF (Atlassian Document Format)

Jira vrací popisy issues ve formátu ADF (JSON strom). Konverze:
- `adfToText(node)` → plain text (pro preview, notifikace)
- `adfToHtml(node)` → HTML string (pro detail tasku, renderuje se přes `dangerouslySetInnerHTML`)
- `setAdfJiraBaseUrl(url)` → musí být voláno při inicializaci, aby se správně sestavovaly URL obrázků/příloh

---

## Bezpečnostní omezení

- `sandbox: false` je nutné pro contextBridge — neměnit
- Obrázky z Jiry jsou autorizovány přes `session.defaultSession.webRequest.onBeforeSendHeaders` v main procesu (media interceptor) — nezasahovat do tohoto mechanismu
- API token se ukládá jako plaintext v `electron-store` — nepřesouvat credentials do renderer procesu

---

## Časté pasti

- **Agile API** má jiný base path než REST API v3. Vždy použít `agileRequest()` pro `/board` a `/sprint` endpointy, nikoli `request()`.
- **Sprint filtr** v `useIssues.ts`: hodnota `'active'` → `sprint in openSprints()`, `'all'` → bez filtru, `'none'` → `sprint is EMPTY`, číslo → `sprint = {id}`.
- **Přidání nového IPC kanálu** vyžaduje změny na třech místech: `main/index.ts`, `preload/index.ts`, `preload/index.d.ts`.
- **`useIssues`** má 400ms debounce pouze pro textové vyhledávání — ostatní změny (projekt, filtr) triggerují fetch okamžitě.
- **Drag & drop v BoardView** mění stav issue lokálně ihned (optimistic update) a volá Jira transition API asynchronně. Při chybě se stav nevrací zpět — zvažit při úpravách.
