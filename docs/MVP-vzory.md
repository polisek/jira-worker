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
