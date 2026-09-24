import { baseName, extensionOf } from './source'

export type LensKind = 'web' | 'api' | 'db'
export type WebFramework = 'next' | 'nuxt' | 'vue' | 'react'

export interface DetectedLens {
  kind: LensKind
  /** Shown next to the tab: "Next.js", ".NET", "PL/SQL". */
  tech: string
  framework?: WebFramework
}

export const WEB_CODE = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue'])
export const WEB_STYLE = new Set(['css', 'scss', 'sass', 'less', 'styl'])
export const WEB_ASSET = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'avif',
  'ico',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'mp4',
  'webm',
  'mp3',
])

/** Extensions Oracle tools and people use for PL/SQL and DDL scripts. */
export const PLSQL_EXTENSIONS = new Set([
  'sql',
  'pks',
  'pkb',
  'pck',
  'pkg',
  'pls',
  'plb',
  'prc',
  'fnc',
  'trg',
  'vw',
  'tab',
  'seq',
  'typ',
  'tps',
  'tpb',
  'ddl',
])

const FRAMEWORK_LABELS: Record<WebFramework, string> = {
  next: 'Next.js',
  nuxt: 'Nuxt',
  vue: 'Vue',
  react: 'React',
}

const hasDependency = (manifest: string, name: string) =>
  new RegExp(`"${name.replace('/', '\\/')}"\\s*:`).test(manifest)

/**
 * Which lenses fit the project, from its file names and its `package.json`
 * files. Cheap: nothing else is read until a lens is opened.
 */
export function detectLenses(paths: string[], packageJsons: string[]): DetectedLens[] {
  const lenses: DetectedLens[] = []
  const extensions = new Set(paths.map(extensionOf))

  let framework: WebFramework | null = null

  if (packageJsons.some((text) => hasDependency(text, 'next'))) framework = 'next'
  else if (packageJsons.some((text) => hasDependency(text, 'nuxt'))) framework = 'nuxt'
  else if (packageJsons.some((text) => hasDependency(text, 'vue')) || extensions.has('vue'))
    framework = 'vue'
  else if (
    packageJsons.some((text) => hasDependency(text, 'react')) ||
    extensions.has('jsx') ||
    extensions.has('tsx')
  )
    framework = 'react'

  if (framework) lenses.push({ kind: 'web', tech: FRAMEWORK_LABELS[framework], framework })

  if (extensions.has('csproj') || (extensions.has('cs') && paths.some(isDotnetEntry))) {
    lenses.push({ kind: 'api', tech: '.NET' })
  }

  if (paths.some((path) => PLSQL_EXTENSIONS.has(extensionOf(path)))) {
    lenses.push({ kind: 'db', tech: 'PL/SQL' })
  }

  return lenses
}

const isDotnetEntry = (path: string) => {
  const name = baseName(path)

  return name === 'Program.cs' || name === 'Startup.cs' || name.endsWith('Controller.cs')
}
