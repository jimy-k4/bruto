import type { SourceFile } from '../storage/projectFiles'
import { WEB_ASSET, WEB_CODE, WEB_STYLE, type WebFramework } from './detect'
import { baseName, dirName, extensionOf, joinPath, stemOf } from './source'

export type WebRole =
  | 'page'
  | 'layout'
  | 'component'
  | 'hook'
  | 'store'
  | 'service'
  | 'server'
  | 'entry'
  | 'style'
  | 'asset'
  | 'config'
  | 'test'

export interface WebElement {
  path: string
  name: string
  role: WebRole
  /** URL of a page, layout or server route, when it can be told. */
  route?: string
  /** Project files this one imports. */
  uses: string[]
  /** How many project files import this one. */
  usedBy: number
}

export interface WebModel {
  framework: WebFramework
  elements: WebElement[]
}

/** Files the web lens looks at, by extension. */
export const isWebFile = (path: string) => {
  const extension = extensionOf(path)

  return WEB_CODE.has(extension) || WEB_STYLE.has(extension) || WEB_ASSET.has(extension)
}

const CONFIG_NAME =
  /^(vite|vitest|next|nuxt|tailwind|postcss|eslint|prettier|babel|jest|playwright|webpack|rollup|svelte|astro|vue)\.config$|^\.?(eslintrc|prettierrc|babelrc)$/

const segmentsOf = (path: string) => path.toLowerCase().split('/').slice(0, -1)

/** The folder after which Next's `app/` or `pages/` routing starts, or -1. */
const routingRoot = (segments: string[], name: string) => {
  const index = segments.indexOf(name)

  // Only at the top of the project or of src/: a components/pages folder isn't routing.
  return index === 0 || (index === 1 && segments[0] === 'src') ? index : -1
}

/** `users/[id]/page` → `/users/:id`; route groups `(group)` and `@slots` are left out. */
function fileRoute(parts: string[]): string {
  const route = parts
    .filter((part) => !/^\(.*\)$/.test(part) && !part.startsWith('@'))
    .filter((part) => part !== 'index')
    .map((part) => part.replace(/^\[\.\.\.(.+)\]$/, '*$1').replace(/^\[(.+)\]$/, ':$1'))
    .join('/')

  return `/${route}`
}

/**
 * Classifies a file by its path inside its app: `web/app/page.tsx` in a
 * repository whose front lives in `web/` is read as `app/page.tsx`.
 */
function classify(
  fullPath: string,
  framework: WebFramework,
  roots: string[],
): Pick<WebElement, 'role' | 'route'> {
  const root = roots.find((item) => fullPath.startsWith(`${item}/`))
  const path = root ? fullPath.slice(root.length + 1) : fullPath
  const extension = extensionOf(path)
  const name = baseName(path)
  const stem = stemOf(path)
  const segments = segmentsOf(path)
  const original = path.split('/')
  const has = (...names: string[]) => segments.some((segment) => names.includes(segment))

  if (
    /\.(test|spec|stories)\.[a-z]+$/i.test(name) ||
    has('__tests__', 'e2e', 'tests', 'test', 'cypress')
  )
    return { role: 'test' }
  if (WEB_STYLE.has(extension)) return { role: 'style' }
  if (WEB_ASSET.has(extension)) return { role: 'asset' }
  if (segments.length <= 1 && CONFIG_NAME.test(stem)) return { role: 'config' }
  if (name.endsWith('.d.ts')) return { role: 'config' }

  // Next.js app router: folders are the URL, special file names say what each file is.
  const app = framework === 'next' ? routingRoot(segments, 'app') : -1

  if (app !== -1) {
    const routeParts = original.slice(app + 1, -1)

    if (stem === 'page') return { role: 'page', route: fileRoute(routeParts) }
    if (stem === 'route') return { role: 'server', route: fileRoute(routeParts) }
    if (
      ['layout', 'template', 'loading', 'error', 'not-found', 'default', 'global-error'].includes(
        stem,
      )
    )
      return { role: 'layout', route: fileRoute(routeParts) }
  }

  // SvelteKit: src/routes/…/+page.svelte, +layout, +server, +error.
  const kitRoutes = framework === 'sveltekit' ? routingRoot(segments, 'routes') : -1

  if (kitRoutes !== -1 && stem.startsWith('+')) {
    const routeParts = original.slice(kitRoutes + 1, -1)

    if (stem === '+page' && extension === 'svelte')
      return { role: 'page', route: fileRoute(routeParts) }
    if (extension !== 'svelte') return { role: 'server', route: fileRoute(routeParts) }

    return { role: 'layout', route: fileRoute(routeParts) }
  }

  // Astro: src/pages/…, where .ts and .js files are endpoints.
  const astroPages = framework === 'astro' ? routingRoot(segments, 'pages') : -1

  if (astroPages !== -1) {
    const routeParts = [...original.slice(astroPages + 1, -1), stem]

    return ['ts', 'js'].includes(extension)
      ? { role: 'server', route: fileRoute(routeParts) }
      : { role: 'page', route: fileRoute(routeParts) }
  }

  // Angular names say what a file is: orders.component.ts, auth.guard.ts…
  if (framework === 'angular') {
    const kind = ANGULAR_KIND.exec(stem)?.[1]

    if (kind === 'component' || kind === 'directive' || kind === 'pipe')
      return { role: 'component' }
    if (kind === 'service' || kind === 'guard' || kind === 'interceptor' || kind === 'resolver')
      return { role: 'service' }
    if (kind === 'store' || kind === 'effects' || kind === 'reducer') return { role: 'store' }
    if (kind === 'module' || kind === 'routes' || kind === 'config' || stem === 'main')
      return { role: 'entry' }
  }

  // File-based routing: Next's pages/ and Nuxt's pages/.
  const pages = framework === 'next' || framework === 'nuxt' ? routingRoot(segments, 'pages') : -1

  if (pages !== -1) {
    const routeParts = [...original.slice(pages + 1, -1), stem]

    if (routeParts[0]?.toLowerCase() === 'api')
      return { role: 'server', route: fileRoute(routeParts) }
    if (stem.startsWith('_')) return { role: 'layout' }

    return { role: 'page', route: fileRoute(routeParts) }
  }

  if (framework === 'nuxt' && has('server')) {
    const server = segments.indexOf('server')
    return { role: 'server', route: fileRoute([...original.slice(server + 1, -1), stem]) }
  }

  if (
    has('pages', 'views', 'screens', 'routes') &&
    ['tsx', 'jsx', 'vue', 'svelte', 'astro', 'js', 'ts'].includes(extension)
  )
    return /^use[A-Z]/.test(stem) ? { role: 'hook' } : { role: 'page' }
  if (has('layouts') || /Layout$/.test(stem)) return { role: 'layout' }
  if (/^use[A-Z]/.test(stem) || has('hooks', 'composables')) return { role: 'hook' }
  if (has('store', 'stores', 'state', 'redux', 'slices') || /(Store|Slice)$/.test(stem))
    return { role: 'store' }
  if (has('components', 'ui')) return { role: 'component' }
  if (has('services', 'api', 'lib', 'utils', 'helpers', 'plugins', 'middleware'))
    return { role: 'service' }
  if (/^(App|main|index|router|routes)$/i.test(stem) && segments.length <= 1)
    return { role: 'entry' }
  if (/^[A-Z]/.test(stem) && ['tsx', 'jsx', 'vue', 'svelte', 'astro'].includes(extension))
    return { role: 'component' }

  return { role: 'service' }
}

const IMPORT =
  /\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g

const RESOLVE_SUFFIXES = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.vue',
  '.svelte',
  '.astro',
  '.mjs',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
  '/index.vue',
]

/** The project file an import points at, if it is one of ours. */
function resolveImport(from: string, specifier: string, known: Set<string>): string | null {
  let base: string[]

  if (specifier.startsWith('.')) base = [joinPath(dirName(from), specifier)]
  else if (/^[@~]\//.test(specifier))
    base = [joinPath('src', specifier.slice(2)), specifier.slice(2)]
  else return null

  for (const candidate of base) {
    for (const suffix of RESOLVE_SUFFIXES) {
      if (known.has(candidate + suffix)) return candidate + suffix
    }
  }

  return null
}

/** Named imports of a file, to find which file a router's `element: <Users />` means. */
function importedNames(source: SourceFile, known: Set<string>): Map<string, string> {
  const names = new Map<string, string>()
  const pattern = /\bimport\s+(\w+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]/g

  for (const match of source.text.matchAll(pattern)) {
    const target = resolveImport(source.path, match[3], known)

    if (!target) continue
    if (match[1]) names.set(match[1], target)

    for (const item of (match[2] ?? '').split(',')) {
      const local = item
        .split(/\s+as\s+/)
        .pop()
        ?.trim()

      if (local) names.set(local, target)
    }
  }

  // Lazy routes: const Users = lazy(() => import('./pages/Users'))
  for (const match of source.text.matchAll(
    /\b(\w+)\s*=\s*(?:React\.)?lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/g,
  )) {
    const target = resolveImport(source.path, match[2], known)

    if (target) names.set(match[1], target)
  }

  return names
}

/** Routes declared in code: React Router and Vue Router, as objects or JSX. */
function declaredRoutes(source: SourceFile, known: Set<string>): Map<string, string> {
  const routes = new Map<string, string>()
  const text = source.text

  if (
    !/\b(createBrowserRouter|createHashRouter|createRouter|<Route\b|RouteObject|routes\s*[:=])/.test(
      text,
    )
  )
    return routes

  const names = importedNames(source, known)
  const assign = (route: string, target: string | null | undefined) => {
    if (target && !routes.has(target))
      routes.set(target, route.startsWith('/') ? route : `/${route}`)
  }

  for (const match of text.matchAll(/<Route\b([^>]*)>/g)) {
    const attributes = match[1]
    const route = /\bpath=["']([^"']+)["']/.exec(attributes)?.[1]
    const component =
      /\belement=\{\s*<\s*([A-Z]\w*)/.exec(attributes)?.[1] ??
      /\b(?:component|Component)=\{\s*([A-Z]\w*)/.exec(attributes)?.[1]

    if (route && component) assign(route, names.get(component))
  }

  for (const match of text.matchAll(/\bpath\s*:\s*['"`]([^'"`]*)['"`]/g)) {
    // The component is declared next to the path, inside the same route object.
    const around = text.slice(match.index, match.index + 300).split(/\bpath\s*:/)[1] ?? ''
    // Vue's component: () => import(…) and Angular's loadComponent: () => import(…).
    const lazyImport =
      /\b(?:component|loadComponent)\s*:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/.exec(
        around,
      )?.[1]
    const component = /\b(?:component|element|Component)\s*:\s*<?\s*([A-Z]\w*)/.exec(around)?.[1]
    const target = lazyImport
      ? resolveImport(source.path, lazyImport, known)
      : component
        ? names.get(component)
        : null

    assign(match[1], target)
  }

  return routes
}

const ANGULAR_KIND =
  /\.(component|service|guard|interceptor|resolver|pipe|directive|module|routes|config|store|effects|reducer)$/

/** What a file is called on the lens: route files take their folder's name, Angular drops its suffix. */
function elementName(path: string): string {
  const stem = stemOf(path)

  if (stem === 'index' || stem === 'page' || stem.startsWith('+'))
    return baseName(dirName(path)) || stem

  return stem.replace(ANGULAR_KIND, '')
}

/** Everything the web lens draws: each file with its role, route and imports. */
export function buildWebModel(
  paths: string[],
  sources: SourceFile[],
  framework: WebFramework,
): WebModel {
  const webPaths = paths.filter(isWebFile)
  // Folders holding a package.json are app roots; the deepest one wins.
  const roots = paths
    .filter((path) => baseName(path) === 'package.json')
    .map(dirName)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  const known = new Set(webPaths)
  const textOf = new Map(sources.map((source) => [source.path, source.text]))
  const routes = new Map<string, string>()

  for (const source of sources) {
    for (const [target, route] of declaredRoutes(source, known)) {
      if (!routes.has(target)) routes.set(target, route)
    }
  }

  const elements: WebElement[] = webPaths.map((path) => {
    const { role, route } = classify(path, framework, roots)
    const text = textOf.get(path)
    const uses = new Set<string>()

    if (text && WEB_CODE.has(extensionOf(path))) {
      for (const match of text.matchAll(IMPORT)) {
        const target = resolveImport(path, match[1] ?? match[2] ?? match[3], known)

        if (target && target !== path) uses.add(target)
      }
    }

    const routed = routes.get(path)

    return {
      path,
      name: elementName(path),
      // A file a router points at is a page, whatever folder it lives in.
      role: routed && role !== 'layout' ? 'page' : role,
      route: route ?? routed,
      uses: [...uses],
      usedBy: 0,
    }
  })

  const byPath = new Map(elements.map((element) => [element.path, element]))

  for (const element of elements) {
    for (const used of element.uses) {
      const target = byPath.get(used)

      if (target) target.usedBy++
    }
  }

  return { framework, elements }
}
