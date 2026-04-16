import { useState, useEffect } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

export function UpdateBanner() {
  const [state, setState] = useState<'idle' | 'available' | 'downloaded'>('idle')
  const [version, setVersion] = useState('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.api.onUpdateAvailable((v) => {
      setVersion(v)
      setState('available')
    })
    window.api.onUpdateDownloaded(() => {
      setState('downloaded')
    })
  }, [])

  if (state === 'idle' || dismissed) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue-600/20 border-b border-blue-500/30 text-sm shrink-0">
      {state === 'available' ? (
        <>
          <Download className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-blue-200 flex-1">
            Stahuje se aktualizace <span className="font-semibold">v{version}</span> na pozadí…
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-green-200 flex-1">
            Aktualizace připravena k instalaci.
          </span>
          <button
            onClick={() => window.api.installUpdate()}
            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded-md font-medium transition-colors"
          >
            Restartovat a nainstalovat
          </button>
        </>
      )}
      <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-gray-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
