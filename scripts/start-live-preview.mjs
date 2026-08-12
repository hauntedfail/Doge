import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { Resolver } from 'node:dns/promises'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:https'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import qrImage from 'qr-image'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gatewayEntry = path.join(root, 'apps', 'gateway', 'dist', 'server.js')
const catalogPath = path.join(root, 'var', 'requests.ndjson')
const relayOrigin = 'http://127.0.0.1:6900'
const gatewayOrigin = 'http://127.0.0.1:8787'
const accessToken = randomBytes(32).toString('base64url')
const children = new Set()
let qrDirectory
let stopping = false

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitFor(url, init, description) {
  let lastError
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(3_000) })
      if (response.ok) return response
      lastError = new Error(`${description} returned HTTP ${response.status}`)
    } catch (error) {
      const code = error?.cause?.code
      lastError = new Error(
        `${error instanceof Error ? error.message : error}${code ? ` (${code})` : ''}`,
      )
    }
    await delay(500)
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`${description} did not become ready: ${detail}`)
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

async function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGINT')
  if (qrDirectory) await rm(qrDirectory, { recursive: true, force: true })
}

function tunnelOrigin(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Cloudflare Quick Tunnel timed out')), 30_000)
    let output = ''
    const consume = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-32_000)
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/u)
      if (!match) return
      clearTimeout(timeout)
      resolve(match[0])
    }
    child.stdout.on('data', consume)
    child.stderr.on('data', consume)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`cloudflared exited before creating a tunnel (${code ?? 'signal'})`))
    })
  })
}

async function resolvePublicAddress(hostname) {
  const resolver = new Resolver()
  resolver.setServers(['1.1.1.1', '1.0.0.1'])
  let lastError
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const addresses = await resolver.resolve4(hostname)
      if (addresses[0]) return addresses[0]
    } catch (error) {
      lastError = error
    }
    await delay(500)
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Quick Tunnel public DNS did not become ready: ${detail}`)
}

function requestViaAddress(url, address) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url)
    const clientRequest = request(
      requestUrl,
      {
        autoSelectFamily: false,
        family: 4,
        headers: { authorization: `Bearer ${accessToken}` },
        lookup: (_hostname, _options, callback) => callback(null, address, 4),
      },
      (response) => {
        const chunks = []
        let length = 0
        response.on('data', (chunk) => {
          length += chunk.length
          if (length > 5_000_000) {
            clientRequest.destroy(new Error('Authenticated live timeline exceeded 5 MB'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`Authenticated live timeline returned HTTP ${response.statusCode}`))
            return
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (error) {
            reject(error)
          }
        })
      },
    )
    clientRequest.setTimeout(3_000, () => clientRequest.destroy(new Error('Request timed out')))
    clientRequest.once('error', reject)
    clientRequest.end()
  })
}

async function waitForPublicTimeline(publicOrigin) {
  const address = await resolvePublicAddress(new URL(publicOrigin).hostname)
  let lastError
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      return await requestViaAddress(`${publicOrigin}/api/v1/timeline?feed=home`, address)
    } catch (error) {
      lastError = error
    }
    await delay(500)
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Authenticated live timeline did not become ready: ${detail}`)
}

async function main() {
  await access(gatewayEntry)
  await access(catalogPath)
  await waitFor(`${relayOrigin}/health`, undefined, 'Safe Relay')

  const gateway = start(process.execPath, [gatewayEntry], {
    env: {
      ...process.env,
      X_SOURCE: 'relay',
      TWITTER_RELAY_BASE_URL: relayOrigin,
      X_RELAY_CATALOG_PATH: catalogPath,
      GATEWAY_BEARER_TOKEN: accessToken,
      HOST: '127.0.0.1',
      PORT: '8787',
    },
  })
  gateway.stderr.on('data', (chunk) => process.stderr.write(chunk))
  await waitFor(`${gatewayOrigin}/health`, undefined, 'G2 gateway')
  await waitFor(
    `${gatewayOrigin}/api/v1/timeline?feed=home`,
    { headers: { authorization: `Bearer ${accessToken}` } },
    'Local authenticated live timeline',
  )

  const cloudflared = start('cloudflared', [
    'tunnel',
    '--config',
    '/dev/null',
    '--url',
    gatewayOrigin,
    '--no-autoupdate',
  ])
  const publicOrigin = await tunnelOrigin(cloudflared)
  console.log(`Quick Tunnel created at ${publicOrigin}; waiting for edge readiness…`)
  const page = await waitForPublicTimeline(publicOrigin)
  if (!Array.isArray(page?.posts)) throw new Error('Live timeline returned an invalid response')

  qrDirectory = await mkdtemp(path.join(tmpdir(), 'even-g2-x-reader-live-'))
  const qrPath = path.join(qrDirectory, 'live-preview.png')
  const previewUrl = `${publicOrigin}/#access_token=${accessToken}`
  await writeFile(qrPath, qrImage.imageSync(previewUrl, { type: 'png', margin: 4, size: 8 }), {
    mode: 0o600,
  })
  const opener = spawn('open', [qrPath], { stdio: 'ignore' })
  opener.unref()

  console.log(`Authenticated live X preview ready at ${publicOrigin}`)
  console.log(`Verified ${page.posts.length} Home posts; post content was not logged.`)
  console.log('The one-time QR is open. Do not share it; press Ctrl-C to revoke it.')
  await new Promise(() => {})
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void stop().finally(() => process.exit(0))
  })
}

main().catch(async (error) => {
  await stop()
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
