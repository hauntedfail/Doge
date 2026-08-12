import { spawn } from 'node:child_process'
import { access, chmod, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const profileDirectory = path.join(root, 'var', 'relay-profile')
const settingsPath = path.join(root, 'config', 'safe-relay.settings.json')
const executable = path.join(root, 'node_modules', '.bin', 'twitter-api-safe-relay')

await mkdir(profileDirectory, { recursive: true, mode: 0o700 })
await chmod(profileDirectory, 0o700)
await access(settingsPath)
await access(executable)

console.log('Starting the dedicated X browser profile.')
console.log(`Profile: ${profileDirectory}`)
console.log('Safe Relay: http://127.0.0.1:6900 (loopback only)')
console.log('Sign in to X in the browser window, then leave that window open.')

const child = spawn(executable, [settingsPath], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})

const forward = (signal) => {
  if (!child.killed) child.kill(signal)
}

process.once('SIGINT', () => forward('SIGINT'))
process.once('SIGTERM', () => forward('SIGTERM'))

child.once('error', (error) => {
  console.error(`Unable to start Safe Relay: ${error.message}`)
  process.exitCode = 1
})

child.once('exit', (code, signal) => {
  if (signal) console.log(`Safe Relay stopped by ${signal}`)
  process.exitCode = code ?? (signal ? 0 : 1)
})
