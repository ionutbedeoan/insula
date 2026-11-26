import { readFile, writeFile } from 'node:fs/promises'

const html = await readFile('dist/index.html', 'utf8')
const script = html.match(/<script type="module"[^>]+src="([^"]+)"[^>]*><\/script>/)
const css = html.match(/<link rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/)
if (!script || !css) throw new Error('Expected a single application bundle and stylesheet.')
const bundle = await readFile(new URL(script[1], new URL('../dist/', import.meta.url)), 'utf8')
const notices = await readFile('dist/THIRD_PARTY_NOTICES.md', 'utf8')
const styles = await readFile(new URL(css[1], new URL('../dist/', import.meta.url)), 'utf8')
if (/\bimport\s*\(/.test(bundle)) throw new Error('Keep the offline build in a single bundle.')
const output = html
  .replace(script[0], () => '<script type="module">' + bundle.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace(css[0], () => '<style>' + styles + '</style>')
const standalone = output + '\n<!--\n' + notices.replace(/-->/g, '—>') + '\n-->\n'
await writeFile('dist/The-Forgotten-Island.html', standalone)
await writeFile('The-Forgotten-Island-Mobile.html', standalone)
