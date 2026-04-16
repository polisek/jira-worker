/**
 * Release skript — načte GH_TOKEN z .env a spustí electron-builder --publish=always
 * Použití: npm run release
 */
const { execSync } = require('child_process')
const { resolve } = require('path')

// Načteme .env
require('dotenv').config({ path: resolve(__dirname, '../.env') })

const token = process.env.GH_TOKEN
if (!token || token === 'sem_vloz_svuj_github_token') {
  console.error('\n❌ GH_TOKEN není nastaven v .env!\n')
  console.error('   1. Jdi na: https://github.com/settings/tokens')
  console.error('   2. Generate new token (classic) → zaškrtni "repo"')
  console.error('   3. Vlož token do .env jako: GH_TOKEN=ghp_...\n')
  process.exit(1)
}

console.log('✓ Token načten')
console.log('→ Spouštím electron-builder --publish=always...\n')

execSync('electron-builder --win --publish=always', {
  stdio: 'inherit',
  env: { ...process.env, GH_TOKEN: token }
})
