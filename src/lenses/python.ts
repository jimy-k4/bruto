import type { SourceFile } from '../storage/projectFiles'
import type { ApiModel, ApiPart, ApiPartKind, ApiResource, HttpVerb } from './dotnet'
import {
  balanced,
  baseName,
  dirName,
  extensionOf,
  joinRoute,
  splitTopLevel,
  stemOf,
} from './source'

export const isPythonFile = (path: string) => extensionOf(path) === 'py'

const isTestPath = (path: string) =>
  /(^|\/)(tests?|__tests__)\//.test(path) || /(^|\/)(test_[^/]*|[^/]*_test)\.py$/.test(path)

const VERBS: Record<string, HttpVerb> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
}

/** Dependencies and decorators that mean "only for signed-in users". */
const AUTH =
  /\b\w*(auth|current_user|get_user|login_required|jwt_required|verify|token|security|require_user|permission)\w*/i

/** Removes `#` comments, leaving strings (which hold routes) alone. */
function stripHashComments(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      let quote: string | null = null

      for (let index = 0; index < line.length; index++) {
        const char = line[index]

        if (quote) {
          if (char === '\\') index++
          else if (char === quote) quote = null
        } else if (char === '"' || char === "'") quote = char
        else if (char === '#') return line.slice(0, index)
      }

      return line
    })
    .join('\n')
}

const keyword = (args: string, name: string) =>
  new RegExp(String.raw`\b${name}\s*=\s*(['"])([^'"]*)\1`).exec(args)?.[2]

/** `app.routers.orders` or `.orders` (relative to `from`) → the project file it is. */
function resolveModule(from: string, dotted: string, known: string[]): string | null {
  const leading = /^\.+/.exec(dotted)?.[0].length ?? 0
  let base = dotted.slice(leading).replace(/\./g, '/')

  if (leading > 0) {
    let directory = dirName(from)

    for (let level = 1; level < leading; level++) directory = dirName(directory)
    base = [directory, base].filter(Boolean).join('/')
  }

  const candidates = [`${base}.py`, `${base}/__init__.py`]

  // Absolute imports start at a source root the index doesn't know: match by ending.
  return (
    known.find((path) => candidates.includes(path)) ??
    known.find((path) => candidates.some((candidate) => path.endsWith(`/${candidate}`))) ??
    null
  )
}

/** Local names a module imports, with the file each comes from. */
function importsOf(file: SourceFile, code: string, known: string[]): Map<string, string> {
  const names = new Map<string, string>()

  for (const match of code.matchAll(/^\s*from\s+([\w.]+)\s+import\s+\(?([^)\n]+)\)?/gm)) {
    for (const item of match[2].split(',')) {
      const [imported, local = imported] = item.trim().split(/\s+as\s+/)

      if (!imported) continue

      // `from app.routers import orders` imports a module; `from .orders import router`, a name in it.
      const target =
        resolveModule(file.path, `${match[1]}.${imported}`, known) ??
        resolveModule(file.path, match[1], known)

      if (target) names.set(local.trim(), target)
    }
  }

  for (const match of code.matchAll(/^\s*import\s+([\w.]+)(?:\s+as\s+(\w+))?/gm)) {
    const target = resolveModule(file.path, match[1], known)

    if (target) names.set(match[2] ?? match[1].split('.').pop()!, target)
  }

  return names
}

interface Router {
  variable: string
  prefix: string
  auth: boolean
}

/** Routers and apps a module creates: APIRouter, FastAPI, Blueprint, Flask. */
function routersOf(code: string): Router[] {
  const routers: Router[] = []

  for (const match of code.matchAll(/^(\w+)\s*=\s*(APIRouter|FastAPI|Blueprint|Flask)\s*\(/gm)) {
    const args = balanced(code, match.index + match[0].length - 1) ?? ''

    routers.push({
      variable: match[1],
      prefix: keyword(args, 'prefix') ?? keyword(args, 'url_prefix') ?? '',
      auth: /\bdependencies\s*=/.test(args) && AUTH.test(args),
    })
  }

  return routers
}

function parseRoutes(file: SourceFile, code: string): Map<string, ApiResource> {
  const routers = routersOf(code)
  const resources = new Map<string, ApiResource>()

  for (const match of code.matchAll(
    /^[ \t]*@(\w+)\.(get|post|put|patch|delete|head|options|route|api_route)\s*\(/gm,
  )) {
    const router = routers.find((item) => item.variable === match[1])

    if (!router) continue

    const args = balanced(code, match.index + match[0].length - 1) ?? ''
    const route = /^\s*(['"])([^'"]*)\1/.exec(args)?.[2] ?? ''
    const methods =
      match[2] === 'route' || match[2] === 'api_route'
        ? [
            ...(/\bmethods\s*=\s*\[([^\]]*)\]/.exec(args)?.[1] ?? "'GET'").matchAll(
              /['"](\w+)['"]/g,
            ),
          ]
            .map((method) => VERBS[method[1].toLowerCase()])
            .filter(Boolean)
        : [VERBS[match[2]]]
    // The decorators under this one and the function they wrap.
    const rest = code.slice(match.index + match[0].length + args.length)
    const definition = /^([\s\S]*?)^\s*(?:async\s+)?def\s+(\w+)\s*\(/m.exec(rest)
    const signatureStart = definition ? definition.index + definition[0].length - 1 : -1
    const signature = signatureStart >= 0 ? (balanced(rest, signatureStart) ?? '') : ''
    const auth =
      router.auth ||
      AUTH.test(definition?.[1] ?? '') ||
      /\b(Depends|Security)\s*\(\s*\w*(auth|current_user|get_user|verify|token)/i.test(signature)
    const resource =
      resources.get(router.variable) ??
      ({
        name: router.prefix
          ? (router.prefix.split('/').filter(Boolean).pop() ?? stemOf(file.path))
          : moduleName(file.path),
        route: joinRoute(router.prefix),
        path: file.path,
        kind: 'minimal',
        auth: router.auth,
        endpoints: [],
        uses: [],
      } satisfies ApiResource)

    for (const verb of methods) {
      resource.endpoints.push({
        verb,
        route: joinRoute(router.prefix, route),
        action: definition?.[2],
        auth,
      })
    }

    // What the handlers ask for: `service: OrderService = Depends()`, `Depends(get_db)`.
    for (const dependency of splitTopLevel(signature)) {
      const type = /:\s*(?:Annotated\[\s*)?([A-Z]\w*)/.exec(dependency)?.[1]
      const provider = /\bDepends\(\s*(\w+)/.exec(dependency)?.[1]

      for (const name of [type, provider]) {
        if (
          name &&
          !resource.uses.includes(name) &&
          !/^(Request|Response|Session|str|int)$/.test(name)
        ) {
          resource.uses.push(name)
        }
      }
    }

    resources.set(router.variable, resource)
  }

  return resources
}

const moduleName = (path: string) =>
  stemOf(path) === '__init__' ? baseName(dirName(path)) || 'app' : stemOf(path)

const PART_FOLDERS: [RegExp, ApiPartKind][] = [
  [/(^|\/)services?\//, 'service'],
  [/(^|\/)(repositories|repository|repos|crud)\//, 'repository'],
  [/(^|\/)(models?|schemas?|entities|dtos?)\//, 'model'],
  [/(^|\/)(middlewares?|dependencies|deps|auth)\//, 'middleware'],
  [/(^|\/)(db|database)\//, 'data'],
]

function classifyPythonPart(path: string): ApiPartKind | null {
  const stem = stemOf(path)

  if (/^(main|app|asgi|wsgi|settings|config)$/.test(stem)) return 'startup'
  if (/(^|_)(service|services)$/.test(stem)) return 'service'
  if (/(^|_)(repository|repositories|crud)$/.test(stem)) return 'repository'
  if (/^(models?|schemas?)$|_(model|schema)s?$/.test(stem)) return 'model'
  if (/^(deps|dependencies|middleware|security|auth)$/.test(stem)) return 'middleware'
  if (/^(db|database|session)$/.test(stem)) return 'data'

  for (const [pattern, kind] of PART_FOLDERS) if (pattern.test(path)) return kind

  return null
}

/** The API of a FastAPI or Flask project: routers with their endpoints, and the layers around them. */
export function buildPythonApiModel(sources: SourceFile[]): ApiModel {
  const files = sources
    .filter((file) => isPythonFile(file.path) && !isTestPath(file.path))
    .map((file) => ({ file, code: stripHashComments(file.text) }))
  const known = files.map(({ file }) => file.path)
  const perFile = new Map(files.map(({ file, code }) => [file.path, parseRoutes(file, code)]))

  // Prefixes added where routers are plugged in: include_router / register_blueprint.
  for (const { file, code } of files) {
    const imports = importsOf(file, code, known)

    for (const match of code.matchAll(
      /\.(include_router|register_blueprint)\s*\(\s*([\w.]+)\s*(?:,([^)]*))?\)/g,
    )) {
      const prefix = keyword(match[3] ?? '', 'prefix') ?? keyword(match[3] ?? '', 'url_prefix')

      if (!prefix) continue

      const [head, ...tail] = match[2].split('.')
      const target = imports.get(head) ?? (tail.length === 0 ? file.path : null)
      const variable = tail.at(-1) ?? match[2]
      const resources = target ? perFile.get(target) : undefined
      const resource =
        resources?.get(variable) ??
        (resources && resources.size === 1 ? [...resources.values()][0] : undefined)

      if (!resource) continue

      resource.route = joinRoute(prefix, resource.route)
      for (const endpoint of resource.endpoints) endpoint.route = joinRoute(prefix, endpoint.route)
    }
  }

  const resources = [...perFile.values()].flatMap((map) => [...map.values()])
  const routed = new Set(resources.map((resource) => resource.path))
  const parts: ApiPart[] = []

  for (const { file, code } of files) {
    if (routed.has(file.path)) continue

    const kind = classifyPythonPart(file.path)

    if (!kind) continue

    const types = [...code.matchAll(/^(?:class|def|async\s+def)\s+(\w+)/gm)].map(
      (match) => match[1],
    )

    parts.push({
      name: types.find((type) => /^[A-Z]/.test(type)) ?? moduleName(file.path),
      path: file.path,
      kind,
      types,
    })
  }

  resources.sort((a, b) => a.route.localeCompare(b.route))
  parts.sort((a, b) => a.name.localeCompare(b.name))

  return { resources, parts }
}
