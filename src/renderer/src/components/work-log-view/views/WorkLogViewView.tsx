import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react"
import { DayPopup } from "../components/DayPopup"
import { CalendarGrid } from "../components/CalendarGrid"
import { MONTHS_CZ, buildCalendarGrid, toDateStr } from "../utils"
import type { WorkLogViewProps } from "../hooks/useWorkLogView"

function WorkLogViewView({ prefs, selectedProject, controllerProps, dataProps }: WorkLogViewProps) {
    const {
        currentMonth,
        myself,
        selectedUser,
        userSearch,
        userResults,
        userDropdownOpen,
        selectedDay,
        updatedSince,
        prevMonth,
        nextMonth,
        setSelectedDay,
        setUserDropdownOpen,
        handleUserSearch,
        selectUser,
    } = controllerProps
    const { worklogMap, loading, error, handleLogged } = dataProps

    const today = new Date()
    const todayStr = toDateStr(today)
    const dailySec = prefs.dailyWorkHours * 3600
    const weeks = buildCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth())

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h1 className="text-base font-semibold text-gray-100 min-w-[160px] text-center">
                        {MONTHS_CZ[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h1>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    {loading && <Loader2 className="w-4 h-4 text-gray-500 animate-spin ml-1" />}
                    {error && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {error}
                        </span>
                    )}
                </div>

                {/* User picker */}
                <div className="relative">
                    <button
                        onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700/60 hover:bg-gray-800 transition-colors text-sm"
                    >
                        {selectedUser ? (
                            <>
                                <img
                                    src={selectedUser.avatarUrls["48x48"]}
                                    className="w-5 h-5 rounded-full"
                                    alt=""
                                />
                                <span className="text-gray-200 max-w-[160px] truncate">
                                    {selectedUser.displayName}
                                </span>
                            </>
                        ) : (
                            <span className="text-gray-400">Vybrat uživatele</span>
                        )}
                        <ChevronLeft className="w-3 h-3 text-gray-500 -rotate-90" />
                    </button>

                    {userDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 z-40 w-72 bg-[#151820] border border-gray-700/60 rounded-xl shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-gray-800/60">
                                <input
                                    autoFocus
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => handleUserSearch(e.target.value)}
                                    placeholder="Hledat uživatele…"
                                    className="input w-full text-sm py-1.5"
                                />
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                                {myself && !userSearch && (
                                    <button
                                        onClick={() => selectUser(myself)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/60 text-left"
                                    >
                                        <img
                                            src={myself.avatarUrls["48x48"]}
                                            className="w-6 h-6 rounded-full"
                                            alt=""
                                        />
                                        <div>
                                            <p className="text-sm text-gray-200">{myself.displayName}</p>
                                            <p className="text-xs text-gray-500">Já</p>
                                        </div>
                                    </button>
                                )}
                                {userResults.map((u) => (
                                    <button
                                        key={u.accountId}
                                        onClick={() => selectUser(u)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/60 text-left"
                                    >
                                        <img src={u.avatarUrls["48x48"]} className="w-6 h-6 rounded-full" alt="" />
                                        <div>
                                            <p className="text-sm text-gray-200">{u.displayName}</p>
                                            <p className="text-xs text-gray-500 truncate">{u.emailAddress}</p>
                                        </div>
                                    </button>
                                ))}
                                {userSearch && userResults.length === 0 && (
                                    <p className="text-xs text-gray-500 px-3 py-3 text-center">
                                        Žádní uživatelé nenalezeni
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Calendar */}
            <CalendarGrid
                weeks={weeks}
                worklogMap={worklogMap}
                todayStr={todayStr}
                dailySec={dailySec}
                onSelectDay={setSelectedDay}
            />

            {/* Day popup */}
            {selectedDay && selectedUser && (
                <DayPopup
                    day={selectedDay}
                    cells={worklogMap[toDateStr(selectedDay)] ?? []}
                    selectedUser={selectedUser}
                    selectedProject={selectedProject}
                    prefs={prefs}
                    updatedSince={updatedSince}
                    onClose={() => setSelectedDay(null)}
                    onLogged={(cell) => handleLogged(selectedDay, cell)}
                />
            )}

            {/* Close user dropdown on outside click */}
            {userDropdownOpen && (
                <div className="fixed inset-0 z-30" onClick={() => setUserDropdownOpen(false)} />
            )}
        </div>
    )
}

export default WorkLogViewView
