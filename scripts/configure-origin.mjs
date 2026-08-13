import { readFile, writeFile } from 'node:fs/promises'

const raw = process.argv[2]
if (!raw) throw new Error('Usage: npm run configure:origin -- https://g2-x.example.com')
const origin = new URL(raw)
if (
  origin.protocol !== 'https:' ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
) {
  throw new Error(
    'Origin must be a bare HTTPS origin without credentials, path, query, or fragment',
  )
}

const manifestPath = new URL('../apps/g2/app.json', import.meta.url)
const productionPath = new URL('../apps/g2/app.production.json', import.meta.url)
const envPath = new URL('../apps/g2/.env.production.local', import.meta.url)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
manifest.permissions = [
  {
    name: 'network',
    desc: 'Load read-only X timelines from the private Doge gateway.',
    whitelist: [origin.origin],
  },
]

await writeFile(productionPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
await writeFile(envPath, `VITE_API_BASE_URL=${origin.origin}\n`, { mode: 0o600 })
console.log(`Configured production origin: ${origin.origin}`)
