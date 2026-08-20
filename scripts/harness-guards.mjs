import path from 'node:path'

export function manifestAlignmentFailures(developmentManifest, productionManifest, fields) {
  return fields
    .filter(
      (field) =>
        JSON.stringify(developmentManifest[field]) !== JSON.stringify(productionManifest[field]),
    )
    .map((field) => `G2 manifests disagree on ${field}`)
}

export function forbiddenTrackedPaths(relativePaths) {
  return relativePaths.filter((relativePath) => {
    const basename = path.posix.basename(relativePath)
    return (
      relativePath.startsWith('var/') ||
      relativePath.split('/').includes('dist') ||
      relativePath.endsWith('.ehpk') ||
      (basename.startsWith('.env') && !basename.endsWith('.example')) ||
      basename === 'cert.pem' ||
      basename.endsWith('.credentials') ||
      basename.endsWith('.credentials.json')
    )
  })
}

export function artifactBoundaryFailures(buffers, accessKey = null) {
  const failures = []
  for (const origin of ['https://doge.h1ka.ru', 'http://127.0.0.1:8787']) {
    const needle = Buffer.from(origin)
    if (buffers.some((buffer) => buffer.includes(needle))) {
      failures.push(`A fixed Gateway origin was embedded in the G2 artifact: ${origin}`)
    }
  }
  if (accessKey) {
    const needle = Buffer.from(accessKey)
    if (buffers.some((buffer) => buffer.includes(needle))) {
      failures.push('A local access key was embedded in the G2 artifact')
    }
  }
  return failures
}
