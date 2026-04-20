export interface WorklogCell {
    issueKey: string
    issueSummary: string
    timeSpentSeconds: number
}

export type WorklogMap = Record<string, WorklogCell[]>

export const DAYS_CZ = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]
export const MONTHS_CZ = [
    "Leden",
    "Únor",
    "Březen",
    "Duben",
    "Květen",
    "Červen",
    "Červenec",
    "Srpen",
    "Září",
    "Říjen",
    "Listopad",
    "Prosinec",
]

export function toDateStr(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

export function toDayStarted(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}T09:00:00.000+0000`
}

export function parseTimeInput(raw: string): number | null {
    const s = raw.trim().toLowerCase()
    const hm = s.match(/^(\d+(?:\.\d+)?)h\s*(?:(\d+)m?)?$/)
    if (hm) return Math.round(parseFloat(hm[1]) * 3600 + parseInt(hm[2] ?? "0") * 60)
    const m = s.match(/^(\d+)m$/)
    if (m) return parseInt(m[1]) * 60
    const colon = s.match(/^(\d+):(\d+)$/)
    if (colon) return parseInt(colon[1]) * 3600 + parseInt(colon[2]) * 60
    const num = parseFloat(s)
    if (!isNaN(num) && num > 0) return Math.round(num * 3600)
    return null
}

export function formatSeconds(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

export function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
}

export function buildCalendarGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1)
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = [
        ...Array(startDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    const weeks: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
}

export function getCellColor(day: Date, totalSec: number, dailySec: number): string {
    if (isWeekend(day) || totalSec === 0) return ""
    const ratio = totalSec / dailySec
    if (ratio >= 0.8) return "bg-green-500/15 border-green-500/30"
    if (ratio >= 0.5) return "bg-yellow-500/15 border-yellow-500/30"
    return "bg-red-500/15 border-red-500/30"
}

export function getBadgeColor(day: Date, totalSec: number, dailySec: number): string {
    if (isWeekend(day) || totalSec === 0) return "bg-gray-700 text-gray-400"
    const ratio = totalSec / dailySec
    if (ratio >= 0.8) return "bg-green-500/25 text-green-400"
    if (ratio >= 0.5) return "bg-yellow-500/25 text-yellow-400"
    return "bg-red-500/25 text-red-400"
}
