import { symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { importMetaProblems } from './sources'

const NESTED_URL =
  'uses import.meta.url below src/, where a built service resolves it from the directory of the main; form the URL in a module directly in src/ and import it.'
const UNBUILT = (member: string): string =>
  `uses import.meta.${member}, which a built service does not have; form a URL from import.meta.url.`

const workspace = useTempDir({ prefix: 'service-sources-' })

/**
 * Scans a service whose sources are the given files.
 *
 * @param tree - The text of each file, by its name below `apps/hello/src`
 * @returns One line per use a built service would resolve differently
 */
function problems(tree: Record<string, string>): readonly string[] {
  for (const [name, text] of entries(tree)) workspace.write(join('apps', 'hello', 'src', name), text)
  return importMetaProblems(join(workspace.path, 'apps', 'hello', 'src'), workspace.path, [])
}

describe('importMetaProblems', () => {
  it('finds no problem in sources that never read import.meta', () => {
    expect(problems({ 'main.ts': 'export const ready = true\n', 'routes/hello.ts': 'export const route = 1\n' })).toEqual([])
  })

  it('leaves import.meta.url alone in a module directly in src/', () => {
    expect(problems({ 'assets.ts': "export const assetsUrl = new URL('./assets/', import.meta.url)\n" })).toEqual([])
  })

  it('refuses import.meta.url in a module below src/, with its path and line', () => {
    expect(problems({ 'routes/notice.ts': "\n\n\n\nexport const notice = new URL('../assets/notice.txt', import.meta.url)\n" })).toEqual([
      `apps/hello/src/routes/notice.ts:5 ${NESTED_URL}`,
    ])
  })

  it.each(['dirname', 'filename'])('refuses import.meta.%s in a module directly in src/', (member) => {
    expect(problems({ 'service.ts': `export const here = import.meta.${member}\n` })).toEqual([
      `apps/hello/src/service.ts:1 ${UNBUILT(member)}`,
    ])
  })

  it('refuses import.meta.dirname in a module below src/', () => {
    expect(problems({ 'routes/notice.ts': 'export const here = import.meta.dirname\n' })).toEqual([
      `apps/hello/src/routes/notice.ts:1 ${UNBUILT('dirname')}`,
    ])
  })

  it.each([
    ['parentheses', '(import.meta).dirname'],
    ['a cast', '(import.meta as { dirname: string }).dirname'],
    ['an angle-bracket cast', '(<{ dirname: string }>import.meta).dirname'],
    ['a non-null assertion', 'import.meta!.dirname'],
    ['a satisfies clause', '(import.meta satisfies object).dirname'],
    ['a cast inside parentheses twice over', '((import.meta as { dirname: string })!).dirname'],
  ])('refuses import.meta.dirname read through %s', (_, expression) => {
    expect(problems({ 'service.ts': `export const here = ${expression}\n` })).toEqual([`apps/hello/src/service.ts:1 ${UNBUILT('dirname')}`])
  })

  it('reads no file behind a link out of the sources', () => {
    workspace.write('elsewhere/found.ts', 'export const here = import.meta.dirname\n')
    workspace.mkdir(join('apps', 'hello', 'src'))
    // why: a junction links a directory on Windows without the symlink privilege, and the type is ignored elsewhere
    symlinkSync(workspace.resolve('elsewhere'), workspace.resolve('apps', 'hello', 'src', 'linked'), 'junction')
    expect(problems({ 'main.ts': 'export const ready = true\n' })).toEqual([])
  })

  it.each([
    ['between brackets', "import.meta['dirname']"],
    ['between brackets as a template', 'import.meta[`dirname`]'],
    ['between brackets under a cast', "(import.meta as Record<string, string>)['dirname']"],
  ])('refuses import.meta.dirname read %s', (_, expression) => {
    expect(problems({ 'service.ts': `export const here = ${expression}\n` })).toEqual([`apps/hello/src/service.ts:1 ${UNBUILT('dirname')}`])
  })

  it('leaves a member read between brackets by a computed name alone, whatever the variable is called', () => {
    expect(
      problems({
        'routes/notice.ts': "const url = 'env'\nconst dirname = 'env'\nexport const here = [import.meta[url], import.meta[dirname]]\n",
      })
    ).toEqual([])
  })

  it('refuses the members taken from import.meta by destructuring, under the name each is taken by', () => {
    expect(
      problems({
        'routes/notice.ts':
          "const key = 'x'\nconst { url, dirname: here, ['filename']: file, 'env': env, [key]: dirname, 7: seven, ...filename } = import.meta\nexport { url, here, file, env, dirname, seven, filename }\n",
      })
    ).toEqual([
      `apps/hello/src/routes/notice.ts:2 ${NESTED_URL}`,
      `apps/hello/src/routes/notice.ts:2 ${UNBUILT('dirname')}`,
      `apps/hello/src/routes/notice.ts:2 ${UNBUILT('filename')}`,
    ])
  })

  it('leaves a destructuring of anything else, and one with no initialiser, alone', () => {
    expect(
      problems({
        'routes/notice.ts': 'const { dirname } = { dirname: 1 }\nfor (const { url } of [{ url: 2 }]) void url\nexport { dirname }\n',
      })
    ).toEqual([])
  })

  it('refuses import.meta.url in a file beside src/ that the sources import', () => {
    workspace.write(
      'apps/hello/service.config.ts',
      "export default { immutable: { notice: new URL('./notice.txt', import.meta.url).href } }\n"
    )
    expect(
      importMetaProblems(workspace.resolve('apps', 'hello', 'src'), workspace.path, [
        workspace.resolve('apps', 'hello', 'service.config.ts'),
      ])
    ).toEqual([
      'apps/hello/service.config.ts:1 uses import.meta.url outside src/, where a built service resolves it from the directory of the main; form the URL in a module directly in src/ and import it.',
    ])
  })

  it('leaves the other meta property, new.target, alone', () => {
    expect(problems({ 'routes/made.ts': 'export function Made(): unknown {\n  return new.target.name\n}\n' })).toEqual([])
  })

  it('leaves any other member alone', () => {
    expect(problems({ 'routes/mode.ts': 'export const mode = import.meta.env\n' })).toEqual([])
  })

  it('leaves a mention in a comment, a string or a template literal alone', () => {
    expect(
      problems({
        'routes/notes.ts': [
          '// import.meta.dirname',
          "export const a = 'import.meta.url'",
          'export const b = `import.meta.filename`',
          '',
        ].join('\n'),
      })
    ).toEqual([])
  })

  it('reads neither a spec nor a file under __test-utils__', () => {
    expect(
      problems({
        'routes/notice.spec.ts': 'export const here = import.meta.dirname\n',
        '__test-utils__/fixture.ts': 'export const here = import.meta.dirname\n',
      })
    ).toEqual([])
  })

  it.each(['mts', 'cts', 'js', 'mjs', 'cjs'])('reads a .%s file', (extension) => {
    expect(problems({ [`here.${extension}`]: 'export const here = import.meta.filename\n' })).toEqual([
      `apps/hello/src/here.${extension}:1 ${UNBUILT('filename')}`,
    ])
  })

  it('does not read a .json file', () => {
    expect(problems({ 'data.json': '{ "note": "import.meta.dirname" }\n' })).toEqual([])
  })

  it('lists files by path, then uses by line', () => {
    expect(
      problems({
        'routes/b.ts': 'export const one = import.meta.url\nexport const two = import.meta.dirname\n',
        'routes/a.ts': 'export const here = import.meta.filename\n',
      })
    ).toEqual([
      `apps/hello/src/routes/a.ts:1 ${UNBUILT('filename')}`,
      `apps/hello/src/routes/b.ts:1 ${NESTED_URL}`,
      `apps/hello/src/routes/b.ts:2 ${UNBUILT('dirname')}`,
    ])
  })
})
