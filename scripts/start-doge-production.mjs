import { spawn } from 'node:child_process'
import { Resolver } from 'node:dns/promises'
import { access, readFile, writeFile } from 'node:fs/promises'
import { request } from 'node:https'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tunnelId = '8e3e51ac-3a20-4df7-85ad-047b652818c3'
const credentialsPath = path.join(homedir(), '.cloudflared', `${tunnelId}.json`)
const gatewayEntry = path.join(root, 'apps', 'gateway', 'dist', 'server.js')
const staticDirectory = path.join(root, 'apps', 'g2', 'dist')
const catalogPath = path.join(root, 'var', 'requests.ndjson')
const keyPath = path.join(root, 'var', 'doge-access-key')
const tunnelConfigPath = path.join(root, 'var', 'doge-cloudflared.yml')
const relayOrigin = 'http://127.0.0.1:6900'
const gatewayOrigin = 'http://127.0.0.1:8787'
const publicOrigin = 'https://doge.h1ka.ru'
const keyPattern = /^[A-Za-z0-9_-]{43}$/u
const children = new Set()
let stopping = false

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitFor(url, init, description, attempts = 120) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(3_000) })
      if (response.ok) return response
      lastError = new Error(`${description} returned HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(500)
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`${description} did not become ready: ${detail}`)
}

async function requirePortAvailable() {
  try {
    await fetch(`${gatewayOrigin}/health`, { signal: AbortSignal.timeout(500) })
  } catch {
    return
  }
  throw new Error('Port 8787 is already in use; stop the existing preview before starting Doge')
}

async function resolvePublicAddress() {
  const resolver = new Resolver()
  resolver.setServers(['1.1.1.1', '1.0.0.1'])
  const addresses = await resolver.resolve4(new URL(publicOrigin).hostname)
  if (!addresses[0]) throw new Error('doge.h1ka.ru has no public IPv4 address')
  return addresses[0]
}

function requestViaAddress(pathname, address, accessKey) {
  return new Promise((resolve, reject) => {
    const clientRequest = request(
      `${publicOrigin}${pathname}`,
      {
        autoSelectFamily: false,
        family: 4,
        headers: accessKey ? { authorization: `Bearer ${accessKey}` } : undefined,
        lookup: (_hostname, _options, callback) => callback(null, address, 4),
      },
      (response) => {
        response.resume()
        response.once('end', () => resolve(response.statusCode))
      },
    )
    clientRequest.setTimeout(3_000, () => clientRequest.destroy(new Error('Request timed out')))
    clientRequest.once('error', reject)
    clientRequest.end()
  })
}

async function waitForPublic(pathname, expectedStatus, accessKey, description) {
  const address = await resolvePublicAddress()
  let lastStatus
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      lastStatus = await requestViaAddress(pathname, address, accessKey)
      if (lastStatus === expectedStatus) return
    } catch {
      // The named tunnel can take a few seconds to register at the edge.
    }
    await delay(500)
  }
  throw new Error(`${description} did not become ready (last HTTP status: ${lastStatus ?? 'none'})`)
}

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  return child
}

function monitor(child, label) {
  child.once('error', (error) => {
    if (stopping) return
    console.error(`${label} failed: ${error.message}`)
    void stop().finally(() => process.exit(1))
  })
  child.once('exit', (code, signal) => {
    if (stopping) return
    console.error(`${label} stopped unexpectedly (${signal ?? code ?? 'unknown'})`)
    void stop().finally(() => process.exit(1))
  })
}

async function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGINT')
}

async function main() {
  await Promise.all([
    access(gatewayEntry),
    access(staticDirectory),
    access(catalogPath),
    access(credentialsPath),
  ])
  const accessKey = (await readFile(keyPath, 'utf8')).trim()
  if (!keyPattern.test(accessKey)) {
    throw new Error('Run npm run production:key before starting Doge')
  }
  await waitFor(`${relayOrigin}/health`, undefined, 'Safe Relay', 2)
  await requirePortAvailable()

  await writeFile(
    tunnelConfigPath,
    [
      `tunnel: ${tunnelId}`,
      `credentials-file: ${credentialsPath}`,
      'ingress:',
      '  - hostname: doge.h1ka.ru',
      `    service: ${gatewayOrigin}`,
      '  - service: http_status:404',
      '',
    ].join('\n'),
    { mode: 0o600 },
  )

  const gateway = start(process.execPath, [gatewayEntry], {
    env: {
      ...process.env,
      X_SOURCE: 'relay',
      TWITTER_RELAY_BASE_URL: relayOrigin,
      X_RELAY_CATALOG_PATH: catalogPath,
      GATEWAY_BEARER_TOKEN: accessKey,
      ALLOW_BEARER_CORS: '1',
      STATIC_DIR: staticDirectory,
      HOST: '127.0.0.1',
      PORT: '8787',
    },
  })
  monitor(gateway, 'Doge gateway')
  gateway.stdout.on('data', (chunk) => process.stdout.write(chunk))
  gateway.stderr.on('data', (chunk) => process.stderr.write(chunk))
  await waitFor(`${gatewayOrigin}/health`, undefined, 'Doge gateway')
  await waitFor(
    `${gatewayOrigin}/api/v1/timeline?feed=home`,
    { headers: { authorization: `Bearer ${accessKey}` } },
    'Local authenticated timeline',
  )

  const tunnel = start('cloudflared', [
    'tunnel',
    '--config',
    tunnelConfigPath,
    '--no-autoupdate',
    '--loglevel',
    'warn',
    'run',
    tunnelId,
  ])
  monitor(tunnel, 'Doge tunnel')
  tunnel.stderr.on('data', (chunk) => process.stderr.write(chunk))
  await waitForPublic('/health', 200, undefined, 'Public Doge tunnel')
  await waitForPublic('/api/v1/timeline?feed=home', 401, undefined, 'Public tokenless rejection')
  await waitForPublic('/api/v1/timeline?feed=home', 200, accessKey, 'Public authenticated timeline')

  console.log(`Doge is ready at ${publicOrigin}`)
  console.log(
    'Keep this Mac, Safe Relay, and this process running while using Doge away from home.',
  )
  await new Promise(() => {})
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => void stop().finally(() => process.exit(0)))
}

main().catch(async (error) => {
  await stop()
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
