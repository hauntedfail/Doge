import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { forbiddenTrackedPaths, manifestAlignmentFailures } from './harness-guards.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

const fail = (message) => failures.push(message)
const readText = (relativePath) => readFile(path.join(root, relativePath), 'utf8')
const readJson = async (relativePath) => JSON.parse(await readText(relativePath))

const requiredFiles = [
  '.node-version',
  '.npmrc',
  'AGENTS.md',
  'Backlog.md',
  'apps/g2/AGENTS.md',
  'apps/gateway/AGENTS.md',
  'docs/INDEX.md',
  'docs/agent-harness.md',
  'docs/gateway-protocol.md',
  '.github/workflows/ci.yml',
]

for (const relativePath of requiredFiles) {
  try {
    await readFile(path.join(root, relativePath))
  } catch {
    fail(`Missing harness file: ${relativePath}`)
  }
}

const [
  rootPackage,
  g2Package,
  gatewayPackage,
  contractsPackage,
  developmentManifest,
  productionManifest,
] = await Promise.all([
  readJson('package.json'),
  readJson('apps/g2/package.json'),
  readJson('apps/gateway/package.json'),
  readJson('packages/contracts/package.json'),
  readJson('apps/g2/app.json'),
  readJson('apps/g2/app.production.json'),
])

const pinnedNode = (await readText('.node-version')).trim()
if (!/^24\.\d+\.\d+$/u.test(pinnedNode)) {
  fail(`.node-version must pin an exact Node 24 release; received ${JSON.stringify(pinnedNode)}`)
}
if (rootPackage.packageManager !== 'npm@11.12.1') {
  fail('package.json must pin packageManager to npm@11.12.1')
}
const npmConfig = (await readText('.npmrc')).trim()
if (npmConfig !== 'cache=.cache/npm') {
  fail('.npmrc must isolate npm cache data under the ignored .cache/npm directory')
}

for (const [name, packageJson] of [
  ['root', rootPackage],
  ['apps/g2', g2Package],
  ['apps/gateway', gatewayPackage],
  ['packages/contracts', contractsPackage],
]) {
  if (packageJson.license !== 'AGPL-3.0-only') {
    fail(`${name} package must use AGPL-3.0-only`)
  }
}

for (const scriptName of [
  'ci',
  'format:check',
  'verify',
  'verify:artifact',
  'verify:release',
  'verify:repo',
]) {
  if (typeof rootPackage.scripts?.[scriptName] !== 'string') {
    fail(`package.json is missing the ${scriptName} script`)
  }
}

const alignedManifestFields = [
  'package_id',
  'edition',
  'name',
  'version',
  'min_app_version',
  'min_sdk_version',
  'entrypoint',
  'supported_languages',
]
failures.push(
  ...manifestAlignmentFailures(developmentManifest, productionManifest, alignedManifestFields),
)

const networkWhitelist = (manifest) =>
  manifest.permissions?.find((permission) => permission.name === 'network')?.whitelist
if (
  JSON.stringify(networkWhitelist(developmentManifest)) !==
  JSON.stringify(['http://127.0.0.1:8787'])
) {
  fail('Development manifest must allow only the loopback mock Gateway')
}
if (JSON.stringify(networkWhitelist(productionManifest)) !== JSON.stringify(['https://'])) {
  fail('Production manifest must allow user-selected HTTPS Gateways without a fixed origin')
}

const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
if (tracked.status !== 0) {
  fail(`Unable to inspect tracked files: ${tracked.stderr.trim()}`)
} else {
  const forbiddenTracked = forbiddenTrackedPaths(tracked.stdout.split('\0').filter(Boolean))
  if (forbiddenTracked.length > 0) {
    fail(`Generated or sensitive paths are tracked: ${forbiddenTracked.join(', ')}`)
  }
}

if (failures.length > 0) {
  console.error('Repository harness checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('Repository harness checks passed.')
}
