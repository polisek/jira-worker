import { useState } from "react"
import { AlertCircle, ClipboardCheck } from "lucide-react"

interface Props {
    message: string
    className?: string
}

export function ErrorMessage({ message, className = "mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg" }: Props) {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(message)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div
            className={`flex items-center gap-2 cursor-pointer select-text ${className}`}
            onClick={copy}
            title="Klikni pro zkopírování"
        >
            {copied ? (
                <ClipboardCheck className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <p className={`text-sm flex-1 ${copied ? "text-green-400" : "text-red-400"}`}>
                {copied ? "Zkopírováno!" : message}
            </p>
        </div>
    )
}
