# Konvence a architektura API volání

Tento dokument popisuje způsob implementace API volání v projektu EPobytovky FE pomocí **TanStack React Query**.

> **Jira Worker** používá stejnou konvenci, ale místo Axios jde každé volání přes `window.api.jiraRequest()` → IPC → main process. Viz sekci [Jira Worker](#jira-worker) níže.

---

## Přehled technologií

| Technologie   | Balíček                                 | Účel                                 |
| ------------- | --------------------------------------- | ------------------------------------ |
| HTTP klient   | `axios`                                 | Vytváření HTTP požadavků             |
| Server state  | `@tanstack/react-query`                 | Cache, invalidace, synchronizace dat |
| Notifikace    | `notistack` (`useResponseNotification`) | Zobrazení výsledku operace uživateli |
| Překlad zpráv | `react-intl`                            | Lokalizace úspěšných hlášení         |

---

## Struktura adresářů

```
src/renderer/src/api/
├── client.ts                     # request() + agileRequest() helpers
├── queryKeys.ts                  # Centrální registr cache klíčů
├── boards/
│   ├── get-boards.ts             # useBoardsQuery
│   └── get-board-sprints.ts      # useBoardSprintsQuery
├── comments/
│   ├── add-comment.ts            # useAddCommentMutation
│   └── add-comment-adf.ts        # useAddCommentAdfMutation
├── epics/
│   └── get-epics.ts              # useEpicsQuery
├── graph/
│   ├── get-graph-layout.ts       # useGraphLayoutQuery
│   └── save-graph-layout.ts      # useSaveGraphLayoutMutation
├── issue-links/
│   ├── create-issue-link.ts      # useCreateIssueLinkMutation
│   └── delete-issue-link.ts      # useDeleteIssueLinkMutation
├── issues/
│   ├── create-issue.ts           # useCreateIssueMutation
│   ├── get-epic-issues.ts        # useEpicIssuesQuery
│   ├── get-issue.ts              # useIssueQuery
│   ├── get-issue-time.ts         # useIssueTimeQuery
│   ├── search-issues.ts          # useSearchIssuesQuery
│   └── update-issue.ts           # useUpdateIssueMutation
├── labels/
│   └── get-labels.ts             # useLabelsQuery
├── projects/
│   ├── get-issue-types.ts        # useIssueTypesQuery
│   ├── get-project-statuses.ts   # useProjectStatusesQuery
│   └── get-projects.ts           # useProjectsQuery
├── sprints/
│   ├── move-to-backlog.ts        # useMoveToBacklogMutation
│   ├── move-to-sprint.ts         # useMoveToSprintMutation
│   └── rank-issue.ts             # useRankIssueMutation
├── statuses/
│   ├── create-statuses.ts        # useCreateStatusesMutation
│   ├── delete-status.ts          # useDeleteStatusMutation
│   ├── get-all-statuses.ts       # useAllStatusesQuery
│   ├── get-statuses-for-project.ts # useStatusesForProjectQuery
│   └── update-statuses.ts        # useUpdateStatusesMutation
├── transitions/
│   ├── do-transition.ts          # useDoTransitionMutation
│   └── get-transitions.ts        # useTransitionsQuery
├── users/
│   ├── assign-issue.ts           # useAssignIssueMutation
│   ├── get-assignable-users.ts   # useAssignableUsersQuery
│   ├── get-myself.ts             # useMyselfQuery
│   └── search-users.ts           # useSearchUsersQuery
└── worklogs/
    ├── get-issue-worklogs.ts     # useIssueWorklogsQuery
    └── log-work.ts               # useLogWorkMutation
```

Každý soubor v doménovém adresáři odpovídá **jedné API operaci**.

---

## Naming konvence souborů

Soubory jsou pojmenovány pomocí prefixu odpovídajícího HTTP metodě nebo semantické akci:

| Prefix souboru | Odpovídá akci                    | Příklady                                           |
| -------------- | -------------------------------- | -------------------------------------------------- |
| `get-`         | GET – načtení dat                | `get-detail.ts`, `get-list.ts`, `get-documents.ts` |
| `create-`      | POST – vytvoření záznamu         | `create-client.ts`, `create-document.ts`           |
| `update-`      | PUT/PATCH – aktualizace          | `update-name.ts`, `update-address.ts`              |
| `delete-`      | DELETE – smazání                 | `delete-document.ts`, `delete-contact.ts`          |
| `upload-`      | POST multipart – nahrání souboru | `upload-photo.ts`                                  |
| `download-`    | GET blob – stažení souboru       | `download-printed-document.ts`                     |
| `duplicate-`   | POST – duplikace záznamu         | `duplicate-printed-document.ts`                    |
| `lock-`        | POST – uzamčení záznamu          | `lock-printed-document.ts`                         |
| `print-`       | POST blob – tisk/export PDF      | `print-address-labels.ts`                          |
| `reorder-`     | POST/PUT – přeřazení pořadí      | `reorder-contact-person.ts`                        |

---

## Anatomy souboru – vzorová implementace

Každý soubor obsahuje dvě exportované entity:

### 1. Raw request funkce

Čistá asynchronní funkce přijímající `token` a parametry. Volá Axios klienta z `@repo/app-config/api/client`. Neobsahuje žádnou React logiku – je testovatelná izolovaně.

```ts
// Naming: <akce><Doména><Sub>Request
export const getClientDetailRequest = async (token: string | undefined, id: string): Promise<ClientBasicInfoDto> => {
    const { data } = await api({ token }).get<ClientBasicInfoDto>(`Clients/${id}`)
    return data
}
```

### 2. React Query hook

Hook obalující raw funkci do `useQuery` nebo `useMutation`. Interně používá `useAuth()` pro získání tokenu.

**Query hook (GET):**

```ts
// Naming: use<Doména><Sub>Query
export const useClientDetailQuery = (
    id: string,
    options?: Pick<UseQueryOptions<...>, "refetchInterval" | "refetchIntervalInBackground" | "enabled">
) => {
    const { accessToken } = useAuth()

    return useQuery<ClientBasicInfoDto, AxiosError<ApiError>>({
        ...options,
        queryFn: () => getClientDetailRequest(accessToken, id),
        queryKey: queryKeys.clients.detail(id),
        enabled: accessToken !== undefined && (options?.enabled ?? true),
    })
}
```

**Mutation hook (POST/PUT/DELETE):**

```ts
// Naming: use<Akce><Doména><Sub>Mutation
export const useUpdateClientNameMutation = (id: string) => {
    const queryClient = useQueryClient()
    const { accessToken } = useAuth()
    const { handleSuccessResponse, handleErrorResponse } = useResponseNotification()
    const intl = useIntl()

    return useMutation<ClientBasicInfoDto, AxiosError<ApiError>, UpdateClientNameRequest>({
        mutationFn: (body) => updateClientNameRequest(accessToken, id, body),
        onSuccess: async (data) => {
            await queryClient.setQueryData(queryKeys.clients.detail(id), data)
            await queryClient.invalidateQueries({ queryKey: queryKeys.clients.list() })
            handleSuccessResponse(intl.formatMessage({ id: "messages.saved" }))
        },
        onError: (error) => handleErrorResponse(error),
    })
}
```

---

## Správa query klíčů (`queryKeys.ts`)

Centrální soubor `src/api/queryKeys.ts` definuje **hierarchickou strukturu klíčů** pro React Query cache.

```ts
const queryKeys = {
    clients: {
        list: (query?) => ["clients", "list", query].filter(Boolean),
        detail: (id) => ["client", "detail", id],
        documents: (id, query?) => ["client", "documents", id, query].filter(Boolean),
        // ...
    },
    users: { ... },
    facilities: { ... },
    // ...
}
```

**Pravidla:**

- Klíče s volitelnými parametry filtrují `undefined` pomocí `.filter(Boolean)` – umožňuje hromadnou invalidaci `queryKeys.clients.list()` bez parametrů
- Klíče bez parametrů (`list()`, `detail(id)`) jsou stabilní a slouží jako základ pro `invalidateQueries`

---

## Naming konvence hooků

| Typ                 | Vzor                               | Příklad                                       |
| ------------------- | ---------------------------------- | --------------------------------------------- |
| Query               | `use<Doména><Sub>Query`            | `useClientDetailQuery`, `useClientsListQuery` |
| Mutation (create)   | `useCreate<Doména>Mutation`        | `useCreateClientMutation`                     |
| Mutation (update)   | `useUpdate<Doména><Sub>Mutation`   | `useUpdateClientNameMutation`                 |
| Mutation (delete)   | `useDelete<Doména><Sub>Mutation`   | `useDeleteClientDocumentMutation`             |
| Mutation (upload)   | `useUpload<Doména><Sub>Mutation`   | `useUploadClientPhotoMutation`                |
| Mutation (download) | `useDownload<Doména><Sub>Mutation` | `useDownloadClientPrintedDocumentMutation`    |
| Mutation (print)    | `usePrint<Doména><Sub>Mutation`    | `usePrintClientsAddressLabelsMutation`        |
| Mutation (lock)     | `useLock<Doména><Sub>Mutation`     | `useLockClientPrintedDocumentMutation`        |

---

## Invalidace a aktualizace cache

Po mutacích se používají dva přístupy:

1. **Invalidace** (`invalidateQueries`) – spustí nové načtení dat ze serveru, vhodné pro seznam:

    ```ts
    await queryClient.invalidateQueries({ queryKey: queryKeys.clients.list() })
    ```

2. **Přímá aktualizace** (`setQueryData`) – okamžitě aktualizuje cache bez síťového volání, vhodné pro detail po úspěšném PUT:
    ```ts
    await queryClient.setQueryData(queryKeys.clients.detail(id), data)
    ```

---

## Zpracování chyb a notifikace

Hook `useResponseNotification` z `@/hooks/useResponseNotification` poskytuje:

- `handleErrorResponse(error)` – zobrazí chybovou notifikaci (snackbar) s textem z `ApiError.message`/`title`
- `handleSuccessResponse(message)` – zobrazí úspěšnou notifikaci, zpráva je lokalizována přes `useIntl()`

Chybové notifikace jsou standardně přítomny ve **všech mutacích**. Úspěšné notifikace jsou přítomny u operací, které mají UX smysl (uložení, smazání, vytvoření), ale chybí u tichých operací (upload fotky, stažení souboru).

---

## Přidání nového API volání – checklist

1. Vytvořit soubor v příslušném doménovém adresáři s názvem `<akce>-<doména>[-<sub>.ts`
2. Exportovat raw request funkci `<akce><Doména>Request`
3. Exportovat React Query hook `use<Akce><Doména>Mutation` nebo `use<Doména>Query`
4. Přidat klíč do `queryKeys.ts` pokud jde o nový typ dat
5. V mutaci zajistit `invalidateQueries` nebo `setQueryData` pro příslušné klíče
6. V mutaci zapojit `useResponseNotification` pro zpracování chyb
7. Všechny enum schemata vygeneravovat pomocí typescript enum do souboru [enums.ts](../apps/web/src/api/enums.ts)

---

# Jira Worker

Tento projekt implementuje stejnou konvenci (doménové soubory, `*Request` + hook), ale **bez Axios** a **bez autentizačního tokenu v rendereru**. Každé volání jde přes IPC do main procesu.

## Transport

```
komponenta
  → hook (use*Query / use*Mutation)
  → *Request()              (src/renderer/src/api/<doména>/<akce>.ts)
  → request() / agileRequest()  (src/renderer/src/api/client.ts)
  → window.api.jiraRequest()    (contextBridge IPC)
  → fetch(Jira Cloud REST API)  (main process — credentials zde)
```

`agileRequest()` prefixuje cestu `__agile__` jako signál pro main process, aby použil `/rest/agile/1.0` místo `/rest/api/3`.

## Vzorová implementace souboru (Jira Worker)

Bez Axios a bez tokenu — transport je `request()` / `agileRequest()` z `client.ts`:

```ts
// src/renderer/src/api/issues/get-issue.ts
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { request } from '../client'
import { queryKeys } from '../queryKeys'
import type { JiraIssue } from '../../types/jira'

export async function getIssueRequest(key: string): Promise<JiraIssue> {
    return request('GET', `/issue/${key}?fields=summary,status,...`)
}

export function useIssueQuery(
    key: string,
    options?: Pick<UseQueryOptions<JiraIssue>, 'enabled' | 'refetchInterval'>
) {
    return useQuery<JiraIssue>({
        ...options,
        queryKey: queryKeys.issues.detail(key),
        queryFn: () => getIssueRequest(key),
        enabled: !!key && (options?.enabled ?? true),
    })
}
```

Mutace — invalidace bez `setQueryData` (Jira vrací jen `204`/chybu, ne aktualizovaný objekt):

```ts
// src/renderer/src/api/issues/update-issue.ts
export function useUpdateIssueMutation(key: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (body: Record<string, unknown>) =>
            request('PUT', `/issue/${key}`, { fields: body }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(key) })
        },
    })
}
```



## Přidání nového API volání – checklist (Jira Worker)

1. Vytvořit soubor `src/renderer/src/api/<doména>/<akce>-<sub>.ts`
2. Exportovat raw request funkci `<akce><Doména>Request` volající `request()` nebo `agileRequest()`
3. Exportovat hook `use<Doména><Sub>Query` nebo `use<Akce><Doména>Mutation`
4. Přidat klíč do `src/renderer/src/api/queryKeys.ts`
5. V mutaci invalidovat relevantní klíče přes `queryClient.invalidateQueries()`
6. **Agile endpointy** (`/board`, `/sprint`, `/issue/rank`, `/backlog`) vždy přes `agileRequest()`, ne `request()`
