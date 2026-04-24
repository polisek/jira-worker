# React MVP komponenty – konvence a architektura

Tento dokument popisuje architekturu a konvence pro tvorbu React komponent v tomto projektu pomocí MVP (Model–View–Presenter) přístupu.

---

## Základní princip

Každá komplexní komponenta je rozdělena do tří vrstev:

| Vrstva | Role | Soubor |
|---|---|---|
| **Model** | Získávání dat, stav, API volání | hook soubory (`useXxx.data.ts`, `useXxx.form.ts` atd.) |
| **Presenter** | Orchestrace sub-hooků, business logika | hlavní hook (`useXxx.ts`) |
| **View** | Čistě prezentační React komponenta | `XxxView.tsx` |

Propojení vrstev zajišťuje utility funkce `wrap` z `@repo/lib/utils/globals`:

```tsx
const Component: FC<useComponentProps> = wrap(ComponentView, useComponent)
export default Component
```

`wrap` při renderování komponenty automaticky zavolá `useComponent(props)` a výsledek předá jako props do `ComponentView`.

---

## Adresářová struktura

```
components/feature-name/          ← nebo pages/feature-name/
  index.tsx                       ← vstupní bod, používá wrap()
  hooks/
    useFeatureName.ts             ← hlavní (orchestrující) hook
    useFeatureName.data.ts        ← načítání dat (react-query)
    useFeatureName.form.ts        ← definice formuláře (react-hook-form + yup)
    useFeatureName.actions.ts     ← API mutace (react-query mutations)
    useFeatureName.controller.ts  ← event handlery, business logika
    useFeatureName.options.ts     ← options pro select/autocomplete widgety
    useFeatureName.filter.ts      ← URL filter stav (query string)
    useFeatureName.menu.tsx       ← navigační menu, výběr sekce
  views/
    FeatureNameView.tsx           ← čistě prezentační komponenta
  components/                     ← dílčí MVP sub-komponenty nebo jednoduché presentery
    SubComponent/
      index.tsx
      hooks/
        ...
      views/
        ...
```

Povinná jsou vždy: `index.tsx`, `hooks/useFeatureName.ts`, `views/FeatureNameView.tsx`.  
Ostatní hook soubory se přidávají dle potřeby.

---

## Naming konvence

### Soubory hooků

| Účel | Přípona |
|---|---|
| Hlavní (orchestrující) hook | `useFeatureName.ts` |
| Načítání dat | `useFeatureName.data.ts` |
| Těžká doménová logika (výpočty, transformace) | `useFeatureName.graph-data.ts` / `useFeatureName.<domain>.ts` |
| Formulář | `useFeatureName.form.ts` |
| API akce (mutace) | `useFeatureName.actions.ts` |
| Kontroler (event handlery) | `useFeatureName.controller.ts` |
| Options pro výběrníky | `useFeatureName.options.ts` |
| URL filter | `useFeatureName.filter.ts` |
| Navigační menu | `useFeatureName.menu.ts(x)` |

### TypeScript typy

| Typ | Konvence | Příklad |
|---|---|---|
| Vstupní props hooku (externí inputs) | `useFeatureNameProps` | `useClientDetailProps` |
| Výstupní props view komponenty | `FeatureNameProps` | `ClientDetailProps` |
| Props datového sub-hooku | `FeatureNameDataProps` | `ClientDetailDataProps` |
| Props formulářového sub-hooku | `FeatureNameFormProps` | `ClientDetailDocumentsFormProps` |
| Props akčního sub-hooku | `FeatureNameActionsProps` | `ClientDetailDocumentsActionsProps` |
| Props kontroleru | `FeatureNameControllerProps` | `ClientDetailDocumentsControllerProps` |
| Props options | `FeatureNameOptionsProps` | `ClientDetailDocumentsOptionsProps` |
| Props filteru | `FeatureNameFilterProps` | `ClientDetailDocumentsFilterProps` |
| Props menu | `FeatureNameMenuProps` | `ClientDetailMenuProps` |
| Formulářová data (shape) | `FeatureNameForm` | `ClientDetailDocumentsForm` |
| Formulářové defaults | `FeatureNameFormDefaults` | `ClientDetailDocumentFormDefaults` |

> **Klíčové pravidlo**: Vstupní props hooku mají prefix `use` (malé `u`), výstupní props view komponenty nemají žádný prefix.

---

## Hlavní hook – struktura

Hlavní hook orchestruje všechny sub-hooky a sestavuje výsledný objekt props:

```ts
// hooks/useFeatureName.ts

import useFeatureNameData from "./useFeatureName.data"
import useFeatureNameForm from "./useFeatureName.form"
import useFeatureNameActions from "./useFeatureName.actions"
import useFeatureNameController from "./useFeatureName.controller"
import useFeatureNameOptions from "./useFeatureName.options"

// Vstupní props (co dostane komponenta zvenčí)
export type useFeatureNameProps = {
    id: string
    onClose?: () => void
}

// Výstupní props (co dostane View komponenta)
export type FeatureNameProps = Pick<useFeatureNameProps, "id" | "onClose"> & {
    dataProps: ReturnType<typeof useFeatureNameData>
    formProps: ReturnType<typeof useFeatureNameForm>
    actionsProps: ReturnType<typeof useFeatureNameActions>
    controllerProps: ReturnType<typeof useFeatureNameController>
    optionsProps: ReturnType<typeof useFeatureNameOptions>
}

const useFeatureName = ({ id, ...rest }: useFeatureNameProps): FeatureNameProps => {
    const dataProps = useFeatureNameData(id)
    const formProps = useFeatureNameForm()
    const actionsProps = useFeatureNameActions(id)
    const controllerProps = useFeatureNameController(dataProps, formProps, actionsProps)
    const optionsProps = useFeatureNameOptions()

    return {
        id,
        dataProps,
        formProps,
        actionsProps,
        controllerProps,
        optionsProps,
        ...rest,
    }
}

export default useFeatureName
```

### Závislosti mezi sub-hooky

Typické pořadí volání a závislostí:

```
filter  ──────────────────────────────────────────► controller
data    ─── (závisí na filteru) ──────────────────► controller
form    ──────────────────────────────────────────► controller
actions ──────────────────────────────────────────► controller
options (nezávislý)
menu    (nezávislý)
```

Konkrétní příklad:
```ts
const filterProps = useFeatureNameFilter()
const dataProps   = useFeatureNameData(id, filterProps)     // závisí na filteru
const formProps   = useFeatureNameForm()
const actionsProps = useFeatureNameActions(id)
const controllerProps = useFeatureNameController(dataProps, formProps, actionsProps)  // závisí na všech
const optionsProps = useFeatureNameOptions()
```

---

## Vstupní bod – index.tsx

```tsx
// index.tsx
import { wrap } from "@repo/lib/utils/globals"
import { FC } from "react"
import FeatureNameView from "./views/FeatureNameView"
import useFeatureName, { useFeatureNameProps } from "./hooks/useFeatureName"

const FeatureName: FC<useFeatureNameProps> = wrap(FeatureNameView, useFeatureName)
export default FeatureName
```

---

## View komponenta

View je čistě prezentační komponenta – **neobsahuje žádnou logiku ani React hooky** (kromě UI hooků jako `useMediaQuery` apod.):

```tsx
// views/FeatureNameView.tsx
import { FC } from "react"
import { FeatureNameProps } from "../hooks/useFeatureName"

const FeatureNameView: FC<FeatureNameProps> = ({ id, dataProps, formProps, controllerProps, actionsProps }) => {
    return (
        // ...JSX
    )
}

export default FeatureNameView
```

Props skupiny (`dataProps`, `formProps` atd.) se předávají do sub-komponent buď celé, nebo selektivně (`{...props}` nebo `dataProps={...}`).

---

## Data hook

Zodpovídá za načítání dat pomocí react-query:

```ts
// hooks/useFeatureName.data.ts
import { useFeatureQuery } from "@/api/feature/get-feature"

export type FeatureNameDataProps = {
    item?: FeatureDto
    isLoading: boolean
}

const useFeatureNameData = (id: string): FeatureNameDataProps => {
    const { data: item, isFetching: isLoading } = useFeatureQuery(id)
    return { item, isLoading }
}

export default useFeatureNameData
```

---

## Actions hook

Zodpovídá za API mutace (vytvoření, aktualizace, mazání):

```ts
// hooks/useFeatureName.actions.ts
import { useCreateFeatureMutation } from "@/api/feature/create-feature"

export type FeatureNameActionsProps = {
    createItem: (body: CreateFeatureRequest) => Promise<FeatureDto>
    isSaving: boolean
}

const useFeatureNameActions = (id: string): FeatureNameActionsProps => {
    const { mutateAsync: createItem, isPending: isSaving } = useCreateFeatureMutation(id)
    return { createItem, isSaving }
}

export default useFeatureNameActions
```

---

## Form hook

Definuje formulářový stav pomocí react-hook-form + yup:

```ts
// hooks/useFeatureName.form.ts
import { useForm, UseFormReturn } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"

export type FeatureNameFormProps = {
    form: UseFormReturn<FeatureNameForm["item"]>
}

export type FeatureNameForm = {
    item: {
        name: string
        value?: string | null
    }
}

export const FeatureNameFormDefaults: FeatureNameForm["item"] = {
    name: "",
    value: null,
}

const useFeatureNameForm = (): FeatureNameFormProps => {
    const schema = yup.object({
        name: yup.string().required(),
        value: yup.string().nullable(),
    })

    return {
        form: useForm<FeatureNameForm["item"]>({
            mode: "all",
            reValidateMode: "onChange",
            resolver: yupResolver(schema),
            defaultValues: FeatureNameFormDefaults,
        }),
    }
}

export default useFeatureNameForm
```

---

## Controller hook

Obsahuje event handlery a business logiku koordinující data, form a actions:

```ts
// hooks/useFeatureName.controller.ts
import { useCallback } from "react"
import { FeatureNameDataProps } from "./useFeatureName.data"
import { FeatureNameFormProps, FeatureNameForm } from "./useFeatureName.form"
import { FeatureNameActionsProps } from "./useFeatureName.actions"

export type FeatureNameControllerProps = {
    onSubmit: (data: FeatureNameForm["item"]) => Promise<void>
    handleEdit: (id: string) => void
}

const useFeatureNameController = (
    { item }: FeatureNameDataProps,
    { form: { reset } }: FeatureNameFormProps,
    { createItem }: FeatureNameActionsProps
): FeatureNameControllerProps => {

    const onSubmit = useCallback(async (data: FeatureNameForm["item"]) => {
        await createItem(data)
        reset(FeatureNameFormDefaults)
    }, [createItem, reset])

    const handleEdit = useCallback((id: string) => {
        // logika editace
    }, [])

    return { onSubmit, handleEdit }
}

export default useFeatureNameController
```

---

## Sub-komponenty s vlastním MVP

Složitější sub-komponenty v adresáři `components/` mají také vlastní MVP strukturu. Jejich vstupní props typicky `Pick`ují z rodičovského hooku:

```ts
// components/sub-feature/hooks/useSubFeature.ts
import { useParentProps, ParentProps } from "../../hooks/useParent"

export type useSubFeatureProps = Pick<useParentProps, "id"> &
    Pick<ParentProps, "dataProps"> & {    // přebírá data props z rodiče
        contentActionRef?: RefObject<HTMLDivElement>
    }
```

---

## Lazy loading sub-komponent ve View

View komponenty na úrovni stránek typicky lazy-loadují sub-komponenty:

```tsx
import { lazy } from "react"
import Loadable from "@repo/ui/components/controls/Loadable"

const SubComponent = Loadable(lazy(() => import("../components/sub-feature")))

// ...v JSX:
<SubComponent id={id} dataProps={dataProps} contentActionRef={contentActionRef} />
```

---

## Vícenásobné formuláře v jednom form hooku

Pokud sekce obsahuje více logicky oddělených formulářů (např. aktivní záznam, nový/editovaný záznam, seznam předchozích), definuj je všechny v jednom form hooku. Typ `FeatureNameFormProps` vrací více `UseFormReturn`, skupinový objekt `FeatureNameForm` definuje shape každého formuláře zvlášť.

```ts
export type FeatureNameFormProps = {
    main: UseFormReturn<FeatureNameForm["main"]>   // aktuální/aktivní záznam
    item: UseFormReturn<FeatureNameForm["item"]>   // nový nebo editovaný záznam
    list: UseFormReturn<FeatureNameForm["list"]>   // seznam předchozích záznamů
}

export type FeatureNameForm = {
    main: {
        record?: FeatureItemForm | null
    }
    item: FeatureItemForm
    list: {
        items: FeatureItemForm[]
    }
}
```

Referenční implementace: `apps/web/src/pages/clients/detail/components/insurance/hooks/useClientDetailInsurances.form.ts`

---

## FormDefaults – statická konstanta vs. factory funkce

Pokud defaults neobsahují dynamické hodnoty, exportuj je jako konstantu:

```ts
export const FeatureItemFormDefaults: FeatureItemForm = {
    name: "",
    value: null,
}
```

Pokud defaults obsahují dynamické hodnoty (aktuální datum přes `dayjs()` apod.), použij **factory funkci**:

```ts
export const FeatureItemFormDefaults = (): FeatureItemForm => ({
    validFrom: dayjs().set("month", dayjs().month() < 7 ? 0 : 6),
    type: EType.DEFAULT,
})
```

Factory funkci volej při inicializaci a resetu formuláře: `reset(FeatureItemFormDefaults())`.

Referenční implementace: `apps/web/src/pages/clients/detail/components/insurance/hooks/useClientDetailInsurances.form.ts`

---

## Specializovaný hook pro těžkou doménovou logiku

Pokud data hook obaluje komplexní logiku, která není přímé react-query volání (výpočet layoutu, sestavení grafu hran, transformace dat), extrahuj ji do **samostatného hooku s vlastním suffixem** místo přímého vložení do `.data.ts`.

```
hooks/
  useFeatureName.data.ts          ← orchestruje sub-hooky, vrací DataProps
  useFeatureName.graph-data.ts    ← výpočet nodů, hran, pozicování
```

`.data.ts` pak jen deleguje:

```ts
const graphData = useFeatureNameGraphData({ epicKey, projectKey })
const epicsQuery = useEpicsQuery(projectKey)

return {
    epics: epicsQuery.data?.issues ?? [],
    ...graphData,
}
```

**Pravidlo:** Pokud logika v `.data.ts` přesahuje react-query hooky a jednoduché mappingy, je kandidátem na vlastní suffix.

Referenční soubory: [`src/renderer/src/components/graph-view/hooks/useGraphView.data.ts`](../src/renderer/src/components/graph-view/hooks/useGraphView.data.ts), [`useGraphView.graph-data.ts`](../src/renderer/src/components/graph-view/hooks/useGraphView.graph-data.ts)

---

## Controller vlastní mutable state derivovaný z dat

Pokud komponenta pracuje s interním mutable state (např. ReactFlow `nodes`/`edges`, DnD pozice), který je inicializován z dat ale dále měněn uživatelskou interakcí, patří tento state do **controlleru**, ne do dat.

- `dataProps` přináší **init data** (z API / query)
- Controller přebírá **ownership** a spravuje lokální kopii přes `useState` / `useXxxState`
- Data hook zůstává read-only

```ts
// useFeatureName.controller.ts
const useFeatureNameController = (dataProps: FeatureNameDataProps, ...) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(dataProps.nodes)  // init z dat
    const [edges, setEdges, onEdgesChange] = useEdgesState(dataProps.edges)  // init z dat

    // lokální mutace state bez zpětného zápisu do dataProps
    useEffect(() => { setNodes(dataProps.nodes) }, [dataProps.nodes])
    ...
}
```

Referenční soubor: [`src/renderer/src/components/graph-view/hooks/useGraphView.controller.ts`](../src/renderer/src/components/graph-view/hooks/useGraphView.controller.ts)

---

## Komponenty s `forwardRef` — MVP bez `wrap()`

Standardní `wrap()` utility **nefunguje pro komponenty vystavující imperativní ref** (`forwardRef`). Pro takové komponenty se používá přímé volání hooku uvnitř `forwardRef` callbacku:

```tsx
// index.tsx — forwardRef varianta
export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>((props, ref) => {
    const viewProps = useRichTextEditorHook(props, ref)
    return <RichTextEditorView {...viewProps} />
})
```

Hook přijímá `(props, ref: React.ForwardedRef<Ref>)` a volá `useImperativeHandle` interně. View je čistě prezentační — o ref neví nic.

```ts
// hooks/useRichTextEditor.ts
export function useRichTextEditorHook(
    props: RichTextEditorProps,
    ref: React.ForwardedRef<RichTextEditorRef>
): RichTextEditorViewProps {
    // ...
    useImperativeHandle(ref, () => ({ getAdf, isEmpty, clear, focus }))
    return { editor, ... }
}
```

Referenční soubory: [`src/renderer/src/components/rich-text-editor/index.tsx`](../src/renderer/src/components/rich-text-editor/index.tsx), [`hooks/useRichTextEditor.ts`](../src/renderer/src/components/rich-text-editor/hooks/useRichTextEditor.ts)

---

## Statická konfigurace extension na module scope

Konfigurace pro externí knihovny (Tiptap extensions, aj.) která **neobsahuje React state ani hooky** patří na **module scope** — mimo tělo hooku.

**Špatně** — `useRef({}).current` je antipattern, React 18+ hlásí `Cannot access ref during render`:

```ts
// ❌ Špatně
const config = useRef({ items: ..., render: ... }).current
```

**Správně** — statická konstanta na module scope:

```ts
// ✅ Správně — module scope
const mentionSuggestion = {
    items: async ({ query }) => { ... },
    render: () => { ... },
}

export function useMyEditorHook(props, ref) {
    const editor = useEditor({
        extensions: [Mention.configure({ suggestion: mentionSuggestion })],
    })
}
```

Pravidlo: pokud konfigurace nepoužívá žádný hook ani closure přes komponentní state, vždy ji vynes mimo hook.

Referenční soubor: [`src/renderer/src/components/rich-text-editor/hooks/useRichTextEditor.ts`](../src/renderer/src/components/rich-text-editor/hooks/useRichTextEditor.ts)

---

## Project-specific vzory

Jira Worker-specific vzory (DetailCard, section components, transition buttons, double-click editing) jsou zdokumentovány v **[docs/MVP-vzory.md](./MVP-vzory.md)**.

---

## Shrnutí pravidel

1. **Každý soubor má jednu zodpovědnost** – data / form / actions / controller jsou vždy v oddělených souborech.
2. **View neobsahuje logiku** – jen JSX a UI hooky (responsive breakpointy, ref atd.).
3. **Typy jsou exportovány vždy** – `useFeatureNameProps`, `FeatureNameProps` i všechny sub-hook Props typy.
4. **`ReturnType<typeof useXxx>`** se používá pro typy sub-hook props v hlavním hooku – tím se automaticky udržuje synchronizace typů bez duplicity.
5. **Zbytek props se šíří přes `...rest`** – vstupní props, které nejsou zpracovány hookem, se přenášejí do výstupu přes spread.
6. **Controller dostává ostatní hooky jako parametry** – nikdy nevolá sub-hooky sám; závislosti jsou injektovány.

