import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve, relative, isAbsolute } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(resolve(root, 'TEMPLATE-MANIFEST.json'), 'utf8'))
const implementationOnly = process.argv.includes('--implementation-only')
let checked = 0
const failures = []
for (const item of manifest.files) {
  if (implementationOnly && (item.path.startsWith('src/content/') || item.path === 'README.md')) continue
  const target = resolve(root, item.path)
  const rel = relative(root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Invalid manifest path: ' + item.path)
  try {
    const bytes = await readFile(target)
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== item.sha256 || bytes.length !== item.bytes) failures.push(item.path + ': differs from baseline')
    checked++
  } catch (error) { failures.push(item.path + ': ' + error.message) }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log(`Verified ${checked} ${implementationOnly ? 'implementation' : 'template'} files against the baseline.`)
