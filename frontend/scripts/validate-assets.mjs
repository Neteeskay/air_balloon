/* global URL, console, process */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1')
const source = join(root, 'src')
const publicDir = join(root, 'public')
const extensions = new Set(['.ts', '.tsx', '.css', '.html'])
const files = []
const walk = directory => readdirSync(directory).forEach(name => {
  const path = join(directory, name)
  if (statSync(path).isDirectory()) walk(path)
  else if ([...extensions].some(extension => name.endsWith(extension))) files.push(path)
})
walk(source)

const missing = []
const references = new Set()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/["']\/assets\/([^"')\s]+)/g)) {
    const reference = `/assets/${match[1]}`.split(/[?#]/)[0]
    references.add(reference)
    if (!existsSync(join(publicDir, reference.slice(1)))) missing.push(`${relative(root, file)}: ${reference}`)
  }
}
if (missing.length) {
  console.error(`Broken literal asset references (${missing.length}):\n${missing.join('\n')}`)
  process.exit(1)
}
console.log(`Validated ${references.size} literal /assets references; broken references: 0.`)
