import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { artifactBoundaryFailures } from './harness-guards.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = path.join(root, 'apps/g2/dist')
const packagePath = path.join(root, 'apps/g2/doge.ehpk')

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const absolutePath = path.join(directory, entry.name)
      return entry.isDirectory() ? filesUnder(absolutePath) : [absolutePath]
    }),
  )
  return nested.flat()
}

const failures = []
const artifactFiles = await filesUnder(distRoot)
if (!artifactFiles.some((file) => path.relative(distRoot, file) === 'index.html')) {
  failures.push('G2 dist is missing index.html')
}

const packageBytes = await readFile(packagePath)
if (packageBytes.length < 128 || packageBytes.subarray(0, 4).toString('ascii') !== 'EHPK') {
  failures.push('doge.ehpk is missing or does not have the expected EHPK header')
}

const buffers = await Promise.all(artifactFiles.map((file) => readFile(file)))
buffers.push(packageBytes)

let accessKey = null
try {
  accessKey = (await readFile(path.join(root, 'var/doge-access-key'), 'utf8')).trim() || null
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

failures.push(...artifactBoundaryFailures(buffers, accessKey))

if (failures.length > 0) {
  console.error('Production artifact checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Production artifact checks passed (${packageBytes.length} bytes).`)
}
