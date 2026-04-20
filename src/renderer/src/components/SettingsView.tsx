import { useState, useEffect } from "react"
import { Save, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"
import { jiraApi } from "../utils/jira-api"
import type { JiraSettings, AppPrefs } from "../types/jira"

interface Props {
    onSaveJira: (s: JiraSettings) => void
    onSavePrefs: (p: AppPrefs) => void
    initialJira: JiraSettings | null
    prefs: AppPrefs
}

// ── Pomocné komponenty ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="settings-card mb-4">
            <h2
                className="text-sm font-semibold mb-4 pb-2"
                style={{ color: "var(--c-text-2)", borderBottom: "1px solid var(--c-border)" }}
            >
                {title}
            </h2>
            <div className="flex flex-col gap-4">{children}</div>
        </div>
    )
}

function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="text-sm" style={{ color: "var(--c-text)" }}>
                    {label}
                </p>
                {hint && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--c-text-4)" }}>
                        {hint}
                    </p>
                )}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    )
}

function Select({
    value,
    onChange,
    options,
}: {
    value: string | number
    onChange: (v: string) => void
    options: { value: string | number; label: string }[]
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input text-sm py-1.5 pr-8 appearance-none cursor-pointer"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
            }}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    )
}

// ── Hlavní komponenta ─────────────────────────────────────────────

export function SettingsView({ onSaveJira, onSavePrefs, initialJira, prefs }: Props) {
    // Jira credentials
    const [baseUrl, setBaseUrl] = useState(initialJira?.baseUrl ?? "")
    const [email, setEmail] = useState(initialJira?.email ?? "")
    const [apiToken, setApiToken] = useState(initialJira?.apiToken ?? "")
    const [showToken, setShowToken] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
    const [jiraSaved, setJiraSaved] = useState(false)

    // App prefs (lokální kopie pro editaci)
    const [localPrefs, setLocalPrefs] = useState<AppPrefs>({ ...prefs })
    const [prefsSaved, setPrefsSaved] = useState(false)

    const setPref = <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => {
        setLocalPrefs((p) => ({ ...p, [key]: value }))
        setPrefsSaved(false)
    }

    useEffect(() => {
        const theme = localPrefs.theme ?? "dark"
        const root = document.documentElement
        if (theme === "light") {
            root.classList.add("light")
        } else if (theme === "dark") {
            root.classList.remove("light")
        } else {
            root.classList.toggle("light", !window.matchMedia("(prefers-color-scheme: dark)").matches)
        }
    }, [localPrefs.theme])

    const handleTestJira = async () => {
        if (!baseUrl || !email || !apiToken) return
        setTesting(true)
        setTestResult(null)
        await window.api.setSettings({ baseUrl, email, apiToken })
        try {
            const me = await jiraApi.getMyself()
            setTestResult({ ok: true, message: `Připojeno jako ${me.displayName} (${me.emailAddress})` })
        } catch (e: any) {
            setTestResult({ ok: false, message: e.message })
        } finally {
            setTesting(false)
        }
    }

    const handleSaveJira = () => {
        if (!baseUrl || !email || !apiToken) return
        onSaveJira({ baseUrl, email, apiToken })
        setJiraSaved(true)
        setTimeout(() => setJiraSaved(false), 2000)
    }

    const handleSavePrefs = async () => {
        await window.api.setPrefs(localPrefs)
        onSavePrefs(localPrefs)
        setPrefsSaved(true)
        setTimeout(() => setPrefsSaved(false), 2000)
    }

    return (
        <div className="w-full max-w-xl py-6 px-2">
            <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "var(--c-text)" }}>
                    Nastavení
                </h1>
                <p className="text-sm" style={{ color: "var(--c-text-3)" }}>
                    Přizpůsobte si chování aplikace
                </p>
            </div>

            {/* ── Vzhled ── */}
            <Section title="Vzhled">
                <OptionRow label="Barevný motiv" hint="Světlý, tmavý nebo systémový">
                    <div className="flex gap-1">
                        {[
                            { value: "light" as const, label: "Světlý" },
                            { value: "dark" as const, label: "Tmavý" },
                            { value: "auto" as const, label: "Auto" },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setPref("theme", value)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    (localPrefs.theme ?? "dark") === value ? "bg-blue-600 text-white" : "btn-secondary"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </OptionRow>
            </Section>

            {/* ── Úkoly ── */}
            <Section title="Úkoly">
                <OptionRow label="Zobrazit dokončené tasky" hint="Jak staré dokončené tasky se mají načítat">
                    <Select
                        value={localPrefs.doneMaxAgeDays}
                        onChange={(v) => setPref("doneMaxAgeDays", Number(v))}
                        options={[
                            { value: 0, label: "Nezobrazovat" },
                            { value: 3, label: "Posledních 3 dní" },
                            { value: 7, label: "Posledních 7 dní" },
                            { value: 14, label: "Posledních 14 dní" },
                            { value: 30, label: "Posledních 30 dní" },
                            { value: 90, label: "Posledních 90 dní" },
                            { value: -1, label: "Vše (bez omezení)" },
                        ]}
                    />
                </OptionRow>

                <OptionRow label="Výchozí filtr" hint="Jaký filtr se použije při startu">
                    <Select
                        value={localPrefs.defaultFilter}
                        onChange={(v) => setPref("defaultFilter", v as AppPrefs["defaultFilter"])}
                        options={[
                            { value: "mine", label: "Moje tasky" },
                            { value: "all", label: "Všechny tasky" },
                            { value: "unassigned", label: "Nepřiřazené" },
                        ]}
                    />
                </OptionRow>

                <OptionRow label="Výchozí zobrazení" hint="Board nebo seznam při otevření">
                    <Select
                        value={localPrefs.defaultView}
                        onChange={(v) => setPref("defaultView", v as AppPrefs["defaultView"])}
                        options={[
                            { value: "board", label: "Board (Kanban)" },
                            { value: "list", label: "Seznam" },
                        ]}
                    />
                </OptionRow>

                <OptionRow label="Maximum tasků" hint="Kolik tasků načítat najednou">
                    <Select
                        value={localPrefs.maxResults}
                        onChange={(v) => setPref("maxResults", Number(v))}
                        options={[
                            { value: 50, label: "50 tasků" },
                            { value: 100, label: "100 tasků" },
                            { value: 200, label: "200 tasků" },
                            { value: 500, label: "500 tasků" },
                        ]}
                    />
                </OptionRow>

                <OptionRow label="Denní pracovní hodiny" hint="Kolik hodin denně se počítá jako plný úvazek">
                    <Select
                        value={localPrefs.dailyWorkHours}
                        onChange={(v) => setPref("dailyWorkHours", Number(v))}
                        options={[
                            { value: 4, label: "4 hodiny" },
                            { value: 6, label: "6 hodin" },
                            { value: 7, label: "7 hodin" },
                            { value: 7.5, label: "7,5 hodiny" },
                            { value: 8, label: "8 hodin" },
                            { value: 9, label: "9 hodin" },
                            { value: 10, label: "10 hodin" },
                        ]}
                    />
                </OptionRow>
            </Section>

            {/* ── Notifikace ── */}
            <Section title="Notifikace">
                <OptionRow label="Interval kontroly" hint="Jak často kontrolovat nové přiřazené tasky">
                    <Select
                        value={localPrefs.pollIntervalMinutes}
                        onChange={(v) => setPref("pollIntervalMinutes", Number(v))}
                        options={[
                            { value: 1, label: "Každou minutu" },
                            { value: 2, label: "Každé 2 minuty" },
                            { value: 5, label: "Každých 5 minut" },
                            { value: 10, label: "Každých 10 minut" },
                            { value: 30, label: "Každých 30 minut" },
                        ]}
                    />
                </OptionRow>

                <OptionRow label="Sledované období" hint="Jak daleko zpět hledat nové přiřazení">
                    <Select
                        value={localPrefs.notifWindowHours}
                        onChange={(v) => setPref("notifWindowHours", Number(v))}
                        options={[
                            { value: 1, label: "Poslední hodina" },
                            { value: 4, label: "Poslední 4 hodiny" },
                            { value: 8, label: "Posledních 8 hodin" },
                            { value: 24, label: "Posledních 24 hodin" },
                            { value: 48, label: "Posledních 48 hodin" },
                        ]}
                    />
                </OptionRow>
            </Section>

            {/* Uložit prefs */}
            <div className="mb-6">
                <button onClick={handleSavePrefs} className="btn-primary w-full flex items-center justify-center gap-2">
                    {prefsSaved ? (
                        <>
                            <CheckCircle className="w-4 h-4" /> Uloženo!
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" /> Uložit nastavení
                        </>
                    )}
                </button>
            </div>

            {/* ── Jira účet ── */}
            <Section title="Jira účet">
                <div>
                    <label className="form-label">Jira URL</label>
                    <input
                        type="url"
                        value={baseUrl}
                        onChange={(e) => {
                            setBaseUrl(e.target.value)
                            setJiraSaved(false)
                        }}
                        placeholder="https://vase-firma.atlassian.net"
                        className="input w-full"
                    />
                </div>

                <div>
                    <label className="form-label">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value)
                            setJiraSaved(false)
                        }}
                        placeholder="vas@email.cz"
                        className="input w-full"
                    />
                </div>

                <div>
                    <label className="form-label">API Token</label>
                    <div className="relative">
                        <input
                            type={showToken ? "text" : "password"}
                            value={apiToken}
                            onChange={(e) => {
                                setApiToken(e.target.value)
                                setJiraSaved(false)
                            }}
                            placeholder="Váš API token"
                            className="input w-full pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: "var(--c-text-3)" }}
                        >
                            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--c-text-4)" }}>
                        Token se ukládá pouze lokálně
                    </p>
                </div>

                {testResult && (
                    <div
                        className={`flex items-center gap-2 p-3 rounded-lg ${testResult.ok ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}
                    >
                        {testResult.ok ? (
                            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <p
                            className={`text-sm flex-1 ${testResult.ok ? "text-green-300" : "text-red-300 cursor-pointer"}`}
                            onClick={!testResult.ok ? () => navigator.clipboard.writeText(testResult.message) : undefined}
                            title={!testResult.ok ? "Klikni pro zkopírování" : undefined}
                        >
                            {testResult.message}
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handleTestJira}
                        disabled={testing || !baseUrl || !email || !apiToken}
                        className="btn-secondary flex-1"
                    >
                        {testing ? "Testuji..." : "Otestovat"}
                    </button>
                    <button
                        onClick={handleSaveJira}
                        disabled={!baseUrl || !email || !apiToken}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {jiraSaved ? (
                            <>
                                <CheckCircle className="w-4 h-4" /> Uloženo!
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" /> Uložit
                            </>
                        )}
                    </button>
                </div>
            </Section>
        </div>
    )
}
