export function fmtTime(seconds: number): string {
    if (!seconds) return "0m"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
}
