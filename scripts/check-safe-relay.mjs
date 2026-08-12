const baseUrl = 'http://127.0.0.1:6900'

const request = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return response.json()
}

try {
  const health = await request('/health')
  const profiles = await request('/profiles')
  console.log(JSON.stringify({ relay: baseUrl, health, profiles }, null, 2))
} catch (error) {
  console.error(
    `Safe Relay is not ready: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
}
