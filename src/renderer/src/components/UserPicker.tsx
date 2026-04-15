import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import type { JiraUser } from '../types/jira'

interface Props {
  users: JiraUser[]
  value: JiraUser | null
  onChange: (user: JiraUser | null) => void
  placeholder?: string
}

export function UserPicker({ users, value, onChange, placeholder = 'Hledat osobu...' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = users.filter((u) =>
    u.displayName.toLowerCase().includes(query.toLowerCase()) ||
    u.emailAddress?.toLowerCase().includes(query.toLowerCase())
  )

  // Zavřít při kliknutí mimo
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (user: JiraUser | null) => {
    onChange(user)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="input w-full flex items-center gap-2 cursor-pointer min-h-[38px]"
      >
        {value ? (
          <>
            <img src={value.avatarUrls['48x48']} alt="" className="w-5 h-5 rounded-full shrink-0" />
            <span className="flex-1 text-sm text-gray-200 truncate">{value.displayName}</span>
            <button onClick={handleClear} className="text-gray-500 hover:text-gray-300 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <span className="text-gray-600 text-sm">{placeholder}</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
            <Search className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat jméno nebo email..."
              className="flex-1 bg-transparent text-sm text-gray-200 outline-none placeholder-gray-600"
            />
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {/* Nepřiřazeno */}
            <button
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${!value ? 'bg-blue-500/10 text-blue-300' : 'text-gray-400'}`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0">
                <span className="text-gray-500 text-xs">?</span>
              </div>
              <span>Nepřiřazeno</span>
            </button>

            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-gray-600 text-center">Žádná shoda</p>
            )}

            {filtered.map((user) => (
              <button
                key={user.accountId}
                onClick={() => handleSelect(user)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${value?.accountId === user.accountId ? 'bg-blue-500/10 text-blue-300' : 'text-gray-200'}`}
              >
                <img src={user.avatarUrls['48x48']} alt="" className="w-6 h-6 rounded-full shrink-0" />
                <div className="min-w-0 text-left">
                  <p className="truncate">{user.displayName}</p>
                  {user.emailAddress && (
                    <p className="text-xs text-gray-500 truncate">{user.emailAddress}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
