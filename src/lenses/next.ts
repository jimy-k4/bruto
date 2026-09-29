import type { SourceFile } from '../storage/projectFiles'
import type { ApiModel, ApiPart, ApiPartKind, ApiResource, Endpoint, HttpVerb } from './dotnet'
import { classifyNodePart, exportedNames, importsOf, isNodeFile, isTestPath } from './node'
import { balanced, baseName, dirName, stemOf, stripCComments } from './source'
import { fileRoute, routingRoot, segmentsOf } from './web'

/** Server code is .ts or .js; a .tsx is only read when it is a route or an actions file. */
export const isNextFile = (path: string) =>
  isNodeFile(path) || /(^|\/)(route|actions?)\.[jt]sx$/.test(path)

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
const METHOD = new RegExp(`\\b(${METHODS.join('|')})\\b`, 'g')

/** Signs that a handler checks who is calling before it answers. */
const AUTH =
  /\b(?:getServerSession|getSession|getUser\w*|currentUser|require(?:Session|User|Auth|Admin|Login)\w*|isAdmin|withAuth|verify(?:Token|Session|Jwt)\w*|getToken|unauthori[sz]ed|forbidden)\b|\bauth\s*\(\s*\)|\.auth\.|\bstatus\s*:\s*40[13]\b|\bauthorization\b/i

/** Where each top-level export starts, so a handler's code runs to the next one. */
const exportStarts = (code: string) => [...code.matchAll(/^export\b/gm)].map((match) => match.index)

function segmentAt(code: string, index: number, starts: number[]) {
  return code.slice(index, starts.find((start) => start > index) ?? code.length)
}

/** The methods an app router `route.ts` exports: functions, consts, destructured or renamed. */
function routeEndpoints(code: string, route: string): Endpoint[] {
  const starts = exportStarts(code)
  const endpoints: Endpoint[] = []
  const add = (verb: string, index: number | null) => {
    if (endpoints.some((endpoint) => endpoint.verb === verb)) return

    endpoints.push({
      verb: verb as HttpVerb,
      route,
      auth: index !== null && AUTH.test(segmentAt(code, index, starts)),
    })
  }

  for (const match of code.matchAll(
    /^export\s+(?:async\s+)?(?:function\s+|(?:const|let|var)\s+)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm,
  ))
    add(match[1], match.index)

  // export const { GET, POST } = handlers, and export { handler as GET }
  for (const match of code.matchAll(
    /^export\s+(?:(?:const|let|var)\s+\{([^}]*)\}\s*=|\{([^}]*)\})/gm,
  ))
    for (const verb of (match[1] ?? match[2]).matchAll(METHOD)) add(verb[1], null)

  return endpoints.sort((a, b) => methodOrder(a.verb) - methodOrder(b.verb))
}

const methodOrder = (verb: string) => (METHODS as readonly string[]).indexOf(verb)

/** A `pages/api` handler answers the methods it compares `req.method` with, or every one. */
function pagesEndpoints(code: string, route: string): Endpoint[] {
  const verbs = new Set<string>()

  for (const match of code.matchAll(
    /\bmethod\s*[!=]==?\s*['"`](\w+)['"`]|\bcase\s+['"`](\w+)['"`]\s*:|\[([^\]]*)\]\.includes\(\s*\w+\.method\b/g,
  )) {
    for (const verb of (match[1] ?? match[2] ?? match[3]).toUpperCase().matchAll(METHOD))
      verbs.add(verb[1])
  }

  const auth = AUTH.test(code)

  return verbs.size > 0
    ? METHODS.filter((verb) => verbs.has(verb)).map((verb) => ({ verb, route, auth }))
    : [{ verb: 'ANY', route, auth }]
}

/** A file whose first statement is 'use server': every function it exports is a server action. */
function serverActions(code: string): Endpoint[] {
  if (!/^\s*['"]use server['"]/.test(code)) return []

  const starts = exportStarts(code)

  return [
    ...code.matchAll(
      /^export\s+(?:default\s+)?(?:async\s+function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*async\b)/gm,
    ),
  ].map((match) => ({
    verb: 'ACTION',
    route: '',
    action: match[1] ?? match[2],
    auth: AUTH.test(segmentAt(code, match.index, starts)),
  }))
}

/** `app/admin/users/[id]/route.ts` → `/admin/users/:id`, the URL of the folder a file is in. */
function routeOf(path: string, root: 'app' | 'pages'): string | null {
  const segments = segmentsOf(path)
  const index = routingRoot(segments, root)

  if (index === -1) return null

  const original = path.split('/')
  const folders = original.slice(index + 1, -1)

  return fileRoute(root === 'pages' ? [...folders, stemOf(path)] : folders)
}

/** A resource is named by the last fixed part of its URL: `/api/users/:id` → users. */
const nameOf = (route: string, fallback: string) =>
  route
    .split('/')
    .filter((part) => part && !/^[:*]/.test(part))
    .at(-1) ?? fallback

/** Names that say little alone: `lib/supabase/server.ts` is "supabase/server". */
const GENERIC_STEMS = /^(index|server|client|middleware|utils?|helpers?|types|config|actions?)$/

function partName(path: string) {
  const stem = stemOf(path)
  const folder = baseName(dirName(path))

  if (stem === 'index') return folder || stem
  return GENERIC_STEMS.test(stem) && folder ? `${folder}/${stem}` : stem
}

const MIDDLEWARE = /^(?:src\/)?(middleware|proxy)\.[cm]?[jt]s$/
const INSTRUMENTATION = /^(?:src\/)?instrumentation\.[cm]?[jt]s$/

function classifyNextPart(path: string): ApiPartKind {
  if (MIDDLEWARE.test(path)) return 'middleware'
  if (INSTRUMENTATION.test(path)) return 'startup'

  const stem = stemOf(path)

  if (
    /(^|\/)(supabase|db|database|drizzle|prisma|sql)(\/|$)/.test(dirName(path)) ||
    /^(db|database|supabase|prisma|drizzle|sql|postgres|connection|schema)([-_.]|$)/.test(stem)
  )
    return 'data'
  if (/auth|session|guard|permission/i.test(stem)) return 'middleware'

  return (
    classifyNodePart(path) ??
    (/(^|\/)(lib|utils|server|services?)\//.test(path) ? 'service' : 'other')
  )
}

/**
 * A `config.matcher` path as a regular expression: `(…)` groups are regular
 * expressions already, `/:path*` is any rest of the path.
 */
function matcherRegExp(pattern: string): RegExp | null {
  let source = ''

  for (let index = 0; index < pattern.length;) {
    const group = pattern[index] === '(' ? balanced(pattern, index) : null
    const param = /^\/:\w+([*+?])?/.exec(pattern.slice(index))

    if (group !== null) {
      source += `(${group})`
      index += group.length + 2
    } else if (param) {
      source += { '*': '(?:/.*)?', '+': '/.+', '?': '(?:/[^/]+)?' }[param[1] ?? ''] ?? '/[^/]+'
      index += param[0].length
    } else {
      source += pattern[index].replace(/[.*+?^${}|[\]\\]/g, '\\$&')
      index++
    }
  }

  try {
    return new RegExp(`^${source}/?$`)
  } catch {
    return null
  }
}

/** The paths a middleware runs on, from its `config.matcher`; without one, every path. */
function middlewarePaths(code: string): RegExp[] {
  const config = /^export\s+const\s+config\s*=\s*\{/m.exec(code)
  const body = config ? (balanced(code, config.index + config[0].length - 1, '{}') ?? '') : ''
  const matcher = /\bmatcher\s*:\s*(\[[\s\S]*?\]\s*[,}]|(['"`])(?:\\.|(?!\2).)*\2)/.exec(`${body}}`)

  if (!matcher) return [/^/]

  // [{ source: '/admin/:path*', has: […] }] names its paths as `source`.
  const strings = /\bsource\s*:/.test(matcher[1])
    ? [...matcher[1].matchAll(/\bsource\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/g)]
    : [...matcher[1].matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)]

  return strings
    .map((match) => matcherRegExp(match[2].replace(/\\(.)/g, '$1')))
    .filter((pattern): pattern is RegExp => pattern !== null)
}

/** A URL to try a matcher on: `/users/:id` → `/users/x`. */
const samplePath = (route: string) => route.replace(/\/[:*][^/]+/g, '/x')

/** UI code a route may import but that isn't part of the server. */
const isUiModule = (path: string, code: string) =>
  /(^|\/)(components|hooks)\//.test(path) || /^\s*['"]use client['"]/.test(code)

/** What a file serves, if anything: a route handler, a `pages/api` handler or server actions. */
function endpointsOf(path: string, code: string): { route: string; endpoints: Endpoint[] } {
  const appRoute = routeOf(path, 'app')
  const pagesRoute = routeOf(path, 'pages')

  if (appRoute !== null && stemOf(path) === 'route')
    return { route: appRoute, endpoints: routeEndpoints(code, appRoute) }
  if (pagesRoute !== null && /^\/api(\/|$)/.test(pagesRoute))
    return { route: pagesRoute, endpoints: pagesEndpoints(code, pagesRoute) }

  // Actions next to a page belong to its URL; elsewhere they have none.
  return { route: appRoute ?? '', endpoints: serverActions(code) }
}

/**
 * The API of a Next.js project: route handlers (`app/…/route.ts`), API routes
 * (`pages/api/…`) and server actions ('use server'), over the modules they use.
 */
export function buildNextApiModel(sources: SourceFile[]): ApiModel {
  const files = sources
    .filter((file) => isNextFile(file.path) && !isTestPath(file.path))
    .map((file) => ({ file, code: stripCComments(file.text) }))
  const known = new Set(files.map(({ file }) => file.path))
  const codeOf = new Map(files.map(({ file, code }) => [file.path, code]))
  const importsFor = new Map(
    files.map(({ file, code }) => [file.path, importsOf(file, code, known)]),
  )
  const resources: ApiResource[] = []

  for (const { file, code } of files) {
    const path = file.path
    const { route, endpoints } = endpointsOf(path, code)

    if (endpoints.length === 0) continue

    const actions = endpoints[0].verb === 'ACTION'

    resources.push({
      name: actions ? partName(path) : nameOf(route, stemOf(path)),
      route,
      path,
      kind: 'minimal',
      auth: endpoints.every((endpoint) => endpoint.auth),
      endpoints,
      uses: [],
    })
  }

  const middleware = files.map(({ file }) => file.path).filter((path) => MIDDLEWARE.test(path))

  // A middleware that checks the caller guards every URL its matcher covers.
  for (const path of middleware) {
    const code = codeOf.get(path)!

    if (!AUTH.test(code)) continue

    const paths = middlewarePaths(code)

    for (const resource of resources) {
      if (!resource.route || !paths.some((pattern) => pattern.test(samplePath(resource.route))))
        continue

      resource.auth = true
      for (const endpoint of resource.endpoints) endpoint.auth = true
    }
  }

  // The server's modules: what routes, actions and the middleware import, and what those import.
  const roots = [...resources.map((resource) => resource.path), ...middleware]
  const routed = new Set(resources.map((resource) => resource.path))
  const reached = new Set<string>()
  const queue = [...roots]

  for (const root of roots) if (!routed.has(root)) reached.add(root)

  while (queue.length > 0) {
    for (const target of importsFor.get(queue.shift()!)?.values() ?? []) {
      if (reached.has(target) || routed.has(target) || isUiModule(target, codeOf.get(target)!))
        continue

      reached.add(target)
      queue.push(target)
    }
  }

  for (const path of files.map(({ file }) => file.path))
    if (INSTRUMENTATION.test(path)) reached.add(path)

  const parts: ApiPart[] = [...reached].map((path) => ({
    name: partName(path),
    path,
    kind: classifyNextPart(path),
    types: exportedNames(codeOf.get(path)!),
  }))
  const partAt = new Map(parts.map((part) => [part.path, part]))

  for (const resource of resources) {
    for (const [name, target] of importsFor.get(resource.path)!) {
      const part = partAt.get(target)

      if (!part) continue

      // A default import, or one renamed, is still what the route uses from that module.
      if (!part.types.includes(name)) part.types.push(name)
      resource.uses.push(name)
    }
  }

  resources.sort((a, b) => a.route.localeCompare(b.route) || a.name.localeCompare(b.name))
  parts.sort((a, b) => a.name.localeCompare(b.name))

  return { resources, parts }
}
