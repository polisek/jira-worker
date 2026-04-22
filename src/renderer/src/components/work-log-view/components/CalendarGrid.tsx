import { DAYS_CZ, formatSeconds, isWeekend, toDateStr, getCellColor, getBadgeColor, type WorklogMap } from "../utils"

interface CalendarGridProps {
    weeks: (Date | null)[][]
    worklogMap: WorklogMap
    todayStr: string
    dailySec: number
    onSelectDay: (day: Date) => void
}

export function CalendarGrid({ weeks, worklogMap, todayStr, dailySec, onSelectDay }: CalendarGridProps) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden px-3 pb-3 pt-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px mb-px shrink-0">
                {DAYS_CZ.map((d, i) => (
                    <div
                        key={d}
                        className={`text-center text-xs font-medium py-1.5 ${i >= 5 ? "text-gray-600" : "text-gray-500"}`}
                    >
                        {d}
                    </div>
                ))}
            </div>

            {/* Weeks grid */}
            <div className="flex-1 grid gap-px" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
                {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-px">
                        {week.map((day, di) => {
                            if (!day) {
                                return <div key={di} className="bg-gray-900/20 rounded" />
                            }
                            const dateStr = toDateStr(day)
                            const cells = worklogMap[dateStr] ?? []
                            const totalSec = cells.reduce((s, c) => s + c.timeSpentSeconds, 0)
                            const isToday = dateStr === todayStr
                            const weekend = isWeekend(day)
                            const cellColor = getCellColor(day, totalSec, dailySec)
                            const badgeColor = getBadgeColor(day, totalSec, dailySec)

                            return (
                                <div
                                    key={di}
                                    onClick={() => onSelectDay(day)}
                                    className={`
                                        rounded border flex flex-col p-1.5 overflow-hidden cursor-pointer
                                        transition-colors hover:border-gray-600/60
                                        ${cellColor || (weekend ? "border-gray-800/30 bg-gray-900/10" : "border-gray-800/50 bg-gray-900/30")}
                                    `}
                                >
                                    {/* Date number */}
                                    <div className="flex items-center justify-between mb-1 shrink-0">
                                        <span
                                            className={`
                                                text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                                                ${isToday ? "bg-blue-500 text-white" : weekend ? "text-gray-600" : "text-gray-400"}
                                            `}
                                        >
                                            {day.getDate()}
                                        </span>
                                        {totalSec > 0 && (
                                            <span
                                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColor}`}
                                            >
                                                {formatSeconds(totalSec)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Issue pills */}
                                    <div className="flex flex-col gap-0.5 overflow-hidden">
                                        {cells.map((c) => (
                                            <div
                                                key={c.issueKey}
                                                className="flex items-center gap-1 min-w-0"
                                                title={`${c.issueKey} — ${c.issueSummary} (${formatSeconds(c.timeSpentSeconds)})`}
                                            >
                                                <span className="text-[10px] font-mono text-blue-400 shrink-0">
                                                    {c.issueKey}
                                                </span>
                                                <span className="text-[10px] text-gray-500 truncate">
                                                    {c.issueSummary}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}
