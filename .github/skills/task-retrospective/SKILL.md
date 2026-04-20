---
name: task-retrospective
description: |
  Spouštěj tuto skill po dokončení implementace úkolu, když uživatel chce vědět co přidat do project conventions nebo co udělat příště lépe. Použij při frázích jako "co bych přidal do conventions", "co bychom příště udělali lépe", "retrospektiva", "co zlepšit", "doporučení po úkolu", "lessons learned".
---

# Task Retrospective – Návrhy vylepšení konvencí

## Cíl

Po dokončení implementace analyzovat co bylo implementováno a navrhnout:
1. **Vzory hodné zdokumentování** v project conventions (`docs/`)
2. **Co příště udělat lépe** (architektura, naming, typové smlouvy, atd.)
3. Volitelně navržené změny rovnou aplikovat do docs souborů

---

## Postup

### 1. Zjisti rozsah změn

```
git diff main...HEAD --name-only
```

Projdi seznam změněných souborů a identifikuj:
- Nové komponenty / hooky / utility
- Změněné existující soubory (pattern refactoring, sjednocení)
- Nové lokalizační klíče, API soubory, typy

### 2. Přečti relevantní konvenční docs

Podle typu změn načti příslušné docs:

| Typ změn | Konvenční dokument |
|---|---|
| Komponenty, hooky, MVP struktura | `docs/MVP-komponenty.md` |
| API volání, react-query hooky | `docs/api.md` |
| Přehledové stránky, filtry, tabulky | `docs/pages.md` |
| Lokalizace | `packages/app-config/src/locales/cs.json` |

### 3. Analyzuj implementaci

Pro každý nový/upravený soubor zvažuj:

**Vzory hodné konvencím:**
- Opakuje se tento pattern na více místech nebo bude opakován v budoucnu?
- Je to lepší řešení než dosavadní konvence?
- Chybí v konvencích referenční příklad pro daný pattern?

**Co příště udělat lépe:**
- Jsou typy přesné a bez zbytečných union typů (`string | string[]`) kde by stačil jeden?
- Existuje duplicita logiky, která mohla být extrahována do utility?
- Jsou naming konvence konzistentní (lokalizační klíče, soubory, typy)?
- Jsou nepoužívané/experimentální soubory odstraněny před merge?

### 4. Připrav návrhy ve dvou kategoriích

**Kategorie A – Přidat do konvencí (docs/):**
Pro každý návrh uveď:
- Do kterého souboru patří
- Co konkrétně dokumentovat (vzor, pravidlo, příklad kódu)
- Referenční soubor v kódu jako vzor

**Kategorie B – Příště udělat lépe:**
Pro každý návrh uveď:
- Co bylo suboptimální
- Jak to příště řešit lépe
- Příklad nebo doporučení

### 5. Zeptej se uživatele

Po prezentaci návrhů se zeptej:
- "Mám některý z těchto návrhů rovnou aplikovat do docs?"

Pokud ano, aplikuj změny do příslušných souborů v `docs/`.

---

## Šablona výstupu

```
## Návrhy po úkolu [EP-XXX]

### A – Přidat do konvencí

1. **[Název vzoru]** → `docs/MVP-komponenty.md`
   - Co: ...
   - Referenční soubor: `apps/web/src/...`

### B – Příště udělat lépe

1. **[Oblast]**
   - Problém: ...
   - Doporučení: ...

---
Mám některý z těchto návrhů rovnou zapsat do docs?
```

---

## Pravidla

- Soustřeď se na **vzory hodné opakování** – ne na jednorázová řešení
- Navrhuj změny do docs **jen pokud pattern není zdokumentován nebo je zdokumentován zastarale**
- Nepřepisuji existující dobré konvence jen proto, že implementace byla jiná
- Zachovej stručnost – max 5 návrhů v každé kategorii
- Kód v příkladech musí reflektovat **skutečný kód z větve**, ne generické vzory

## Příklady spuštění

- "Co bych měl přidat do project conventions z toho co jsme implementovali?"
- "Co bychom příště udělali lépe na EP-371?"
- "Udělej retrospektivu k tomuto úkolu."
- "Lessons learned z EP-371 – co do docs?"
