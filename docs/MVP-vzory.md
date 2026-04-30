# MVP vzory — Jira Worker project-specific patterns

Tento soubor dokumentuje project-specific vzory a konvence, které doplňují obecné MVP konvence v [`docs/MVP-komponenty.md`](./MVP-komponenty.md).

---

## Section components — sekce jako samostatné komponenty

Komplexní detail panel (TaskDetail) se nerozkládá do jednoho monolitického View, ale skládá se ze samostatných **section komponent**. Každá sekce:

- Vlastní svůj `DetailCard` wrapper
- Volá příslušné API mutace sama (ne přes props z rodiče)
- Dostává minimum props — typicky jen `issue` + callbacky pro akce mimo sekci (např. `onRefetch`, `onLogWork`)

### Výhody

- View je čistě kompoziční — jen řadí sekce za sebou
- Sekci lze přesunout, skrýt nebo rozšířit bez zásahu do View ani do hooku
- Každá sekce je izolovaně pochopitelná a testovatelná

### Ukázka — View jako sklad sekcí

```tsx
// views/TaskDetailView.tsx
<TransitionsSection issue={issue} transitions={transitions} onManageStatuses={...} />
<IssueInfoSection issue={issue} assignableUsers={assignableUsers} onNavigateTo={...} />
<TimeSection issue={issue} onLogWork={...} onRefetch={refetch} />
<DescriptionSection issue={issue} />
<CommentsSection issue={issue} />
```

Referenční soubor: [`src/renderer/src/components/task-detail/views/TaskDetailView.tsx`](../src/renderer/src/components/task-detail/views/TaskDetailView.tsx)

### Kam sekce patří

Sekce jsou ploché komponenty (ne vlastní MVP) v adresáři `components/` dané feature:

```
task-detail/
  components/
    DetailCard.tsx          ← sdílená shell komponenta
    TransitionsSection.tsx
    IssueInfoSection.tsx
    TimeSection.tsx
    DescriptionSection.tsx
    CommentsSection.tsx
```

---

## DetailCard — shell komponenta pro sekce

`DetailCard` je sdílená obalová komponenta pro všechny sekce detail panelu. Podporuje:

- `title` — nadpis sekce (bez title se header vůbec nevykreslí)
- `action` — widget v pravé části headeru (tlačítko, dropdown)
- `footer` — obsah pod tělem sekce (akční tlačítka, labels)
- `children` — obsah sekce

```tsx
// components/DetailCard.tsx
interface Props {
    title?: string      // pokud chybí, header se nevykreslí
    action?: ReactNode  // zobrazí se v headeru vpravo
    footer?: ReactNode  // zobrazí se pod children (border-top)
    children: ReactNode
    className?: string
}
```

### Příklady použití

**Sekce s headingem, akcí a footerem:**

```tsx
<DetailCard
    title="Komentáře (3)"
    footer={
        <>
            <span className="text-xs text-gray-600">Ctrl+Enter pro odeslání</span>
            <button className="btn-primary ...">Odeslat</button>
        </>
    }
>
    {/* seznam komentářů + editor */}
</DetailCard>
```

**Sekce bez headingu (metadata, tabulka):**

```tsx
<DetailCard>
    {/* IssueInfoSection — grid s assignee, reporter, priority... */}
</DetailCard>
```

**Sekce s akčním tlačítkem v headeru:**

```tsx
<DetailCard
    title="Čas"
    action={
        <button onClick={onLogWork} className="btn-sm">
            <Plus className="w-3 h-3" />
            Zaznamenat práci
        </button>
    }
    footer={<OriginalEstimateField issue={issue} onEdited={onRefetch} />}
>
    <TimeTracking issue={issue} compact />
</DetailCard>
```

Referenční soubor: [`src/renderer/src/components/task-detail/components/DetailCard.tsx`](../src/renderer/src/components/task-detail/components/DetailCard.tsx)

### CSS třídy

Definovány v `globals.css` pod `@layer components`:

| Třída | Popis |
|---|---|
| `.detail-section-card` | Obal sekce — rounded, border, background |
| `.detail-section-card-header` | Flex row s border-bottom |
| `.detail-section-card-content` | Padding pro obsah |
| `.detail-section-card-footer` | Flex row s border-top (justify-between) |

---

## Transition buttons — barevné podle cílového stavu

Tlačítka pro přechod mezi stavy (`TransitionsSection`) jsou obarvena podle `statusCategory.key` cílového stavu:

| `statusCategory.key` | CSS třída | Barva |
|---|---|---|
| `done` | `.transition-btn-done` | zelená |
| `indeterminate` | `.transition-btn-progress` | modrá |
| ostatní | `.transition-btn-todo` | šedá |

```tsx
function transitionBtnClass(categoryKey: string): string {
    if (categoryKey === 'done') return 'transition-btn transition-btn-done'
    if (categoryKey === 'indeterminate') return 'transition-btn transition-btn-progress'
    return 'transition-btn transition-btn-todo'
}
```

Referenční soubor: [`src/renderer/src/components/task-detail/components/TransitionsSection.tsx`](../src/renderer/src/components/task-detail/components/TransitionsSection.tsx)

---

## Double-click editing — readonly pole s inline editací

Readonly pole, která jdou editovat dvojklikem, používají vzor:

1. Výchozí stav: zobrazí hodnotu jako text
2. Na `onDoubleClick`: nastaví `editing = true`
3. V edit stavu: zobrazí input/picker + Uložit/Zrušit (nebo Ctrl+Enter pro textarea)
4. Po uložení: invaliduje query přes `onSuccess`

CSS třída `.meta-field-editable` (v `globals.css`) přidává hover highlight indikující editovatelnost.

```tsx
<div
    onDoubleClick={() => !editing && setEditing(true)}
    className={`py-0.5 rounded transition-colors meta-field-editable`}
    title="Dvojklik pro úpravu"
>
    {editing ? <input ... /> : <span>{value}</span>}
</div>
```

Pokud sekce má header, lze přidat i ikonu `Pencil` jako `action` prop DetailCard — funguje stejně jako double-click:

```tsx
<DetailCard
    title="Popis"
    action={
        !editing ? (
            <button onClick={() => setEditing(true)} className="btn-icon">
                <Pencil className="w-3.5 h-3.5" />
            </button>
        ) : null
    }
>
```

Referenční soubory: [`DescriptionSection.tsx`](../src/renderer/src/components/task-detail/components/DescriptionSection.tsx), [`IssueInfoSection.tsx`](../src/renderer/src/components/task-detail/components/IssueInfoSection.tsx)

---

## Tiptap inline node extensions — styling přes `globals.css`

Tiptap extension přidávající inline node (např. mention) definuje CSS třídu přes `HTMLAttributes` a styluje se v `@layer components` v `globals.css`.

```ts
// hooks/useMyEditor.ts
Mention.configure({
    HTMLAttributes: { class: "mention" },  // třída vložena do DOM
    renderText: ({ node }) => `@${node.attrs.label}`,
})
```

```css
/* globals.css — @layer components */
.mention {
    @apply inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-blue-400 font-medium text-sm;
    background: rgba(59, 130, 246, 0.12);
    border: 1px solid rgba(59, 130, 246, 0.25);
    white-space: nowrap;
    cursor: default;
}
```

Stejný vzor platí pro jakýkoli budoucí inline node (emoji picker, issue link chip atd.) — vždy definovat třídu v extension, styl v `globals.css`.

Referenční soubor: [`src/renderer/src/styles/globals.css`](../src/renderer/src/styles/globals.css)

---

## Resizable panel — drag handle s mousedown

Panel s nastavitelnou výškou (např. backlog panel v RoadmapView) používá `mousedown` na drag handle + globální `mousemove`/`mouseup` listenery na `window`. Tracking start pozice jde přes `useRef` — zamezuje zbytečnému re-renderu při pohybu myši.

```ts
// useFeature.controller.ts
const dragStartY = useRef<number | null>(null)
const dragStartHeight = useRef<number>(DEFAULT_HEIGHT)

const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartHeight.current = panelHeight

    const onMouseMove = (ev: MouseEvent) => {
        if (dragStartY.current === null) return
        const delta = dragStartY.current - ev.clientY
        const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartHeight.current + delta))
        setPanelHeight(next)
    }
    const onMouseUp = () => {
        dragStartY.current = null
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
}, [panelHeight])
```

```tsx
// View — drag handle
<div
    onMouseDown={onResizeMouseDown}
    style={{ height: 6, cursor: 'row-resize' }}
>
    <div style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--c-border)' }} />
</div>
```

Referenční soubor: [`src/renderer/src/components/roadmap-view/hooks/useRoadmapView.controller.ts`](../src/renderer/src/components/roadmap-view/hooks/useRoadmapView.controller.ts)

---

## Optimistic drag & drop s rollbackem

Drag-and-drop, který přesouvá položky mezi sloupci (sprint ↔ backlog, uživatel ↔ uživatel), udržuje lokální kopie serverových dat ve dvou stavových polích. Update probíhá ihned (optimisticky), rollback nastane při chybě API.

**Vzor:**

1. `localItems` se inicializují z `dataProps.items` přes `useEffect` — synchronizují se při každém refetchi
2. `handleDrop` provede mutaci lokálního stavu **před** voláním API
3. `catch` blok obnoví lokální stav z `dataProps` (serverová data)

```ts
const [localSprintIssues, setLocalSprintIssues] = useState<JiraIssue[]>([])
const [localBacklogIssues, setLocalBacklogIssues] = useState<JiraIssue[]>([])

useEffect(() => { setLocalSprintIssues(dataProps.sprintIssues) }, [dataProps.sprintIssues])
useEffect(() => { setLocalBacklogIssues(dataProps.backlogIssues) }, [dataProps.backlogIssues])

const handleDrop = useCallback(async (targetUserId, targetSprintId) => {
    // 1. Optimistic update — mutuj lokální stav
    setLocalSprintIssues(prev => prev.map(applyOptimistic))
    // ...přesuň issue mezi poli dle cíle...

    try {
        // 2. API volání
        await moveToSprint.mutateAsync(...)
        if (assigneeChanged) await updateIssue.mutateAsync(...)
    } catch {
        // 3. Rollback
        setLocalSprintIssues(dataProps.sprintIssues)
        setLocalBacklogIssues(dataProps.backlogIssues)
    }
}, [...])
```

Referenční soubor: [`src/renderer/src/components/roadmap-view/hooks/useRoadmapView.controller.ts`](../src/renderer/src/components/roadmap-view/hooks/useRoadmapView.controller.ts)

---

## Paleta barev uživatelů — exportovaná konstanta

Když je potřeba přiřadit každému uživateli vizuálně odlišnou barvu (karty, headers, badges), definuj paletu jako exportované pole objektů `{ bg, text, dot }` v komponentě, která ji jako první potřebuje. Ostatní komponenty ji importují a indexují přes `colorIndex`.

```ts
// components/RoadmapIssueCard.tsx
export const ROADMAP_USER_COLORS: Array<{ bg: string; text: string; dot: string }> = [
    { bg: "#E6F1FB", text: "#185FA5", dot: "#378ADD" },
    { bg: "#FAEEDA", text: "#854F0B", dot: "#EF9F27" },
    // ...
]
```

```tsx
// hook — sestaví RoadmapUser[] s colorIndex
const selectedUsers = useMemo<RoadmapUser[]>(
    () => selectedUserIds.map((id, index) => {
        const user = allProjectUsers.find(u => u.accountId === id)
        if (!user) return null
        return { user, colorIndex: index }
    }).filter(Boolean),
    [selectedUserIds, allProjectUsers]
)

// child komponenta — použije colorIndex
const color = ROADMAP_USER_COLORS[colorIndex % ROADMAP_USER_COLORS.length]
```

`RoadmapUser` typ (s `colorIndex`) je definován v `src/renderer/src/types/jira.ts`.

Referenční soubory: [`src/renderer/src/components/roadmap-view/components/RoadmapIssueCard.tsx`](../src/renderer/src/components/roadmap-view/components/RoadmapIssueCard.tsx), [`src/renderer/src/types/jira.ts`](../src/renderer/src/types/jira.ts)
