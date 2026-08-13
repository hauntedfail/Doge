import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeDirectory = path.join(root, 'var')
const keyPath = path.join(runtimeDirectory, 'doge-access-key')
const keyPattern = /^[A-Za-z0-9_-]{43}$/u

await mkdir(runtimeDirectory, { recursive: true, mode: 0o700 })
await chmod(runtimeDirectory, 0o700)

let key
try {
  key = (await readFile(keyPath, 'utf8')).trim()
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  key = randomBytes(32).toString('base64url')
  await writeFile(keyPath, `${key}\n`, { flag: 'wx', mode: 0o600 })
}

if (!keyPattern.test(key)) throw new Error('Doge access key is invalid; rotate it before use')
await chmod(keyPath, 0o600)

const clipboard = spawnSync('pbcopy', [], { input: key, stdio: ['pipe', 'ignore', 'inherit'] })
if (clipboard.status !== 0) throw new Error('Unable to copy the Doge access key')

console.log('Doge access key copied to the clipboard. It was not printed.')
