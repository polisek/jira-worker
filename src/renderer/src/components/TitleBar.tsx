const isMac = navigator.userAgent.includes('Macintosh')

export function TitleBar() {
  if (isMac) {
    return (
      <div className="titlebar flex items-center justify-center px-4 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">J</span>
          </div>
          <span className="text-sm font-semibold text-gray-200">Jira Worker</span>
        </div>
      </div>
    )
  }

  return (
    <div className="titlebar flex items-center justify-between px-4 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">J</span>
        </div>
        <span className="text-sm font-semibold text-gray-200">Jira Worker</span>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={() => window.api.minimizeWindow()}
          className="titlebar-btn"
          title="Minimalizovat"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button
          onClick={() => window.api.maximizeWindow()}
          className="titlebar-btn"
          title="Maximalizovat"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>
        <button
          onClick={() => window.api.closeWindow()}
          className="titlebar-btn titlebar-btn-close"
          title="Zavřít"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
