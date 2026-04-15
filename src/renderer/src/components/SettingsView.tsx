import { useState } from 'react'
import { Save, Eye, EyeOff, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
import { jiraApi } from '../lib/jira-api'
import type { JiraSettings } from '../types/jira'

interface Props {
  onSave: (s: JiraSettings) => void
  initial: JiraSettings | null
}

export function SettingsView({ onSave, initial }: Props) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [apiToken, setApiToken] = useState(initial?.apiToken ?? '')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleTest = async () => {
    if (!baseUrl || !email || !apiToken) return
    setTesting(true)
    setTestResult(null)
    // Save temporarily so API calls work
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

  const handleSave = () => {
    if (!baseUrl || !email || !apiToken) return
    onSave({ baseUrl, email, apiToken })
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-100 mb-1">Nastavení Jira</h1>
        <p className="text-sm text-gray-500">Propojte aplikaci s vaším Jira účtem</p>
      </div>

      <div className="settings-card">
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">Jira URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://vase-firma.atlassian.net"
              className="input w-full"
            />
            <p className="text-xs text-gray-600 mt-1">URL vašeho Jira Cloud workspace</p>
          </div>

          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas@email.cz"
              className="input w-full"
            />
          </div>

          <div>
            <label className="form-label">
              API Token
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                onClick={(e) => { e.preventDefault(); window.open('https://id.atlassian.com/manage-profile/security/api-tokens') }}
              >
                Vytvořit token <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Váš API token"
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">Token se ukládá pouze lokálně na vašem počítači</p>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.ok ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              {testResult.ok
                ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              }
              <p className={`text-sm ${testResult.ok ? 'text-green-300' : 'text-red-300'}`}>
                {testResult.message}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleTest}
              disabled={testing || !baseUrl || !email || !apiToken}
              className="btn-secondary flex-1"
            >
              {testing ? 'Testuji...' : 'Otestovat připojení'}
            </button>
            <button
              onClick={handleSave}
              disabled={!baseUrl || !email || !apiToken}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Uložit a pokračovat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
