import type { SourceFile } from '../storage/projectFiles'
import type { ApiStack } from './detect'
import type { ApiModel, ApiPart, ApiPartKind, ApiResource, Endpoint, HttpVerb } from './dotnet'
import {
  ANNOTATION,
  annotationsBefore,
  balanced,
  baseName,
  dirName,
  extensionOf,
  firstString,
  joinPath,
  joinRoute,
  splitTopLevel,
  stemOf,
  stripCComments,
} from './source'

export const isNodeFile = (path: string) =>
  ['ts', 'js', 'mjs', 'cjs', 'mts', 'cts'].includes(extensionOf(path)) && !path.endsWith('.d.ts')

const isTestPath = (path: string) =>
  /\.(test|spec|e2e-spec)\.[a-z]+$/.test(path) || /(^|\/)(__tests__|test|tests|e2e)\//.test(path)

const VERBS: Record<string, HttpVerb> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
}

/** Middleware names that mean "only for signed-in users". */
const AUTH = /\b\w*(auth|protect|requireUser|requireLogin|loggedIn|verifyToken|jwt|session)\w*\b/i

const RESOLVE_SUFFIXES = ['', '.ts', '.js', '.mjs', '.cjs', '/index.ts', '/index.js']

/** The project file an import points at; TypeScript ESM often imports `./x.js` for `./x.ts`. */
function resolveModule(from: string, specifier: string, known: Set<string>): string | null {
  if (!specifier.startsWith('.')) return null

  const base = joinPath(dirName(from), specifier)

  for (const candidate of [base, base.replace(/\.(js|mjs|cjs)$/, '')]) {
    for (const suffix of RESOLVE_SUFFIXES) {
      if (known.has(candidate + suffix)) return candidate + suffix
    }
  }

  return null
}

/** Local names a file imports, with the file each comes from. */
function importsOf(file: SourceFile, code: string, known: Set<string>): Map<string, string> {
  const names = new Map<string, string>()
  const add = (local: string | undefined, specifier: string) => {
    const target = resolveModule(file.path, specifier, known)

    if (local && target) names.set(local.trim(), target)
  }

  for (const match of code.matchAll(
    /\bimport\s+(?:type\s+)?(\w+)?\s*,?\s*(?:\{([^}]*)\}|\*\s+as\s+(\w+))?\s*from\s+['"]([^'"]+)['"]/g,
  )) {
    add(match[1], match[4])
    add(match[3], match[4])

    for (const item of (match[2] ?? '').split(',')) add(item.split(/\s+as\s+/).pop(), match[4])
  }

  for (const match of code.matchAll(
    /\b(?:const|let|var)\s+(?:(\w+)|\{([^}]*)\})\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g,
  )) {
    add(match[1], match[3])

    for (const item of (match[2] ?? '').split(',')) add(item.split(':').pop(), match[3])
  }

  return names
}

/** A file's own name for a resource: `routes/orders.ts` → orders, `orders/index.ts` → orders. */
const resourceName = (path: string) => {
  const stem = stemOf(path).replace(/\.(routes?|router|controller)$/i, '')

  return stem === 'index' ? baseName(dirName(path)) || stem : stem
}

// ---------------------------------------------------------------------------
// NestJS: controllers are classes, routes are decorators.

function parseNestControllers(file: SourceFile, code: string, globalPrefix: string): ApiResource[] {
  const resources: ApiResource[] = []

  for (const match of code.matchAll(/\bclass\s+(\w+)[^{]*\{/g)) {
    const decorators = annotationsBefore(code, match.index)
    const controller = new RegExp(String.raw`@Controller\b(\s*\((?:[^()]|\([^()]*\))*\))?`).exec(
      decorators,
    )

    if (!controller) continue

    const name = match[1]
    const body = balanced(code, match.index + match[0].length - 1, '{}') ?? ''
    const base = joinRoute(globalPrefix, firstString(controller[1]) ?? '')
    const classAuth = /@(UseGuards|Auth|Roles)\b/.test(decorators)
    const endpoints: Endpoint[] = []

    for (const verb of body.matchAll(
      new RegExp(
        String.raw`@(Get|Post|Put|Patch|Delete|Head|Options|All)\b(\s*\((?:[^()]|\([^()]*\))*\))?`,
        'g',
      ),
    )) {
      const after = body.slice(verb.index)
      const chain = new RegExp(String.raw`^(?:${ANNOTATION}\s*)+`).exec(after)?.[0] ?? ''
      const action = /^(?:(?:public|private|protected|static|async)\s+)*(\w+)\s*\(/.exec(
        after.slice(chain.length),
      )?.[1]
      const decorators = annotationsBefore(body, verb.index) + chain
      const public_ = /@(Public|AllowAnonymous|SkipAuth)\b/.test(decorators)

      endpoints.push({
        verb: verb[1] === 'All' ? 'GET' : VERBS[verb[1].toLowerCase()],
        route: joinRoute(base, firstString(verb[2]) ?? ''),
        action,
        auth: (classAuth || /@(UseGuards|Auth|Roles)\b/.test(decorators)) && !public_,
      })
    }

    const constructor = /\bconstructor\s*\(/.exec(body)
    const parameters = constructor
      ? (balanced(body, constructor.index + constructor[0].length - 1) ?? '')
      : ''
    const uses = splitTopLevel(parameters, true)
      .map((parameter) => /:\s*([A-Z]\w*)/.exec(parameter)?.[1])
      .filter((type): type is string => Boolean(type))

    resources.push({
      name: name.replace(/Controller$/, ''),
      route: base,
      path: file.path,
      kind: 'controller',
      auth: classAuth,
      endpoints,
      uses: [...new Set(uses)],
    })
  }

  return resources
}

// ---------------------------------------------------------------------------
// Express, Fastify, Hono: routes are calls on an app or a router.

const SERVER_IMPORT =
  /\bfrom\s+['"](express|fastify|hono|koa-router|@koa\/router)['"]|require\(\s*['"](express|fastify|hono|koa-router)['"]\s*\)/

/** Variables that hold an app or a router in this file. */
function receiversOf(code: string): Set<string> {
  const receivers = new Set<string>()

  for (const match of code.matchAll(
    /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:express\s*\(|express\.Router\s*\(|Router\s*\(|(?:fastify|Fastify)\s*\(|new\s+(?:Hono|Router)\s*\()/g,
  )) {
    receivers.add(match[1])
  }

  // Fastify plugins and exported route functions get the app as a parameter.
  for (const match of code.matchAll(
    /(?:function\s*\w*\s*\(|\(\s*|=\s*)(fastify|app|server|router|instance)\s*(?::\s*\w+)?\s*[,)]/g,
  )) {
    receivers.add(match[1])
  }

  return receivers
}

interface RouteCall {
  verb: HttpVerb
  route: string
  action?: string
  auth: boolean
}

function routeCalls(code: string, receivers: Set<string>): RouteCall[] {
  const calls: RouteCall[] = []
  // `router.use(requireAuth)`: everything the router serves needs a user.
  // Fastify says the same with a hook: `fastify.addHook('onRequest', fastify.authenticate)`.
  const fileAuth = [...receivers].some((receiver) =>
    [
      ...code.matchAll(
        new RegExp(String.raw`\b${receiver}\s*\.\s*(?:use|addHook)\(([^)]*)\)`, 'g'),
      ),
    ].some((use) => AUTH.test(use[1].replace(/^\s*(['"`])[^'"`]*\1\s*,?/, ''))),
  )

  for (const match of code.matchAll(
    /\b(\w+)\s*\.\s*(get|post|put|patch|delete|head|options|all)\s*\(\s*(['"`])([^'"`]*)\3/g,
  )) {
    if (!receivers.has(match[1])) continue

    const open = match.index + match[0].indexOf('(')
    const args = splitTopLevel(balanced(code, open) ?? '')
    const handler = args.at(-1) ?? ''
    const middle = args.slice(1, -1).join(',')

    calls.push({
      verb: match[2] === 'all' ? 'GET' : VERBS[match[2]],
      route: match[4],
      action: /^[\w.]+$/.test(handler) ? handler.split('.').pop() : undefined,
      auth: fileAuth || AUTH.test(middle),
    })
  }

  // router.route('/x').get(list).post(create)
  for (const match of code.matchAll(/\b(\w+)\s*\.\s*route\(\s*(['"`])([^'"`]*)\2\s*\)/g)) {
    if (!receivers.has(match[1])) continue

    let chain = code.slice(match.index + match[0].length)
    let link: RegExpExecArray | null

    while ((link = /^\s*\.\s*(get|post|put|patch|delete|all)\s*\(([^)]*)\)/.exec(chain))) {
      chain = chain.slice(link[0].length)
      calls.push({
        verb: link[1] === 'all' ? 'GET' : VERBS[link[1]],
        route: match[3],
        action: splitTopLevel(link[2]).at(-1)?.split('.').pop(),
        auth: fileAuth || AUTH.test(link[2]),
      })
    }
  }

  // fastify.route({ method: 'GET', url: '/x', preHandler: [fastify.authenticate], handler })
  for (const match of code.matchAll(/\b(\w+)\s*\.\s*route\(\s*\{/g)) {
    if (!receivers.has(match[1])) continue

    const options = balanced(code, match.index + match[0].length - 1, '{}') ?? ''
    const method = /\bmethod\s*:\s*\[?\s*['"`](\w+)/.exec(options)?.[1]?.toLowerCase()
    const url = /\b(?:url|path)\s*:\s*['"`]([^'"`]*)/.exec(options)?.[1]

    if (method && url !== undefined && VERBS[method]) {
      calls.push({
        verb: VERBS[method],
        route: url,
        action: /\bhandler\s*:\s*([\w.]+)/.exec(options)?.[1]?.split('.').pop(),
        auth: fileAuth || AUTH.test(options.replace(/\bhandler\s*:[\s\S]*$/, '')),
      })
    }
  }

  return calls
}

/** Where each router file is mounted: `app.use('/api/orders', ordersRouter)`. */
function mountsOf(
  file: SourceFile,
  code: string,
  imports: Map<string, string>,
  known: Set<string>,
): { target: string; prefix: string }[] {
  const mounts: { target: string; prefix: string }[] = []
  const targetOf = (argument: string) => {
    const required = /require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/.exec(
      argument,
    )

    if (required) return resolveModule(file.path, required[1] ?? required[2], known)

    return imports.get(argument.trim().split('.')[0]) ?? null
  }

  for (const match of code.matchAll(/\.\s*(?:use|route)\(\s*(['"`])([^'"`]+)\1\s*,/g)) {
    const args = splitTopLevel(balanced(code, match.index + match[0].indexOf('(')) ?? '')

    for (const argument of args.slice(1)) {
      const target = targetOf(argument)

      if (target) mounts.push({ target, prefix: match[2] })
    }
  }

  // Fastify: app.register(ordersRoutes, { prefix: '/orders' })
  for (const match of code.matchAll(/\.\s*register\(\s*([^,]+),\s*\{([^}]*)\}/g)) {
    const prefix = /\bprefix\s*:\s*['"`]([^'"`]+)/.exec(match[2])?.[1]
    const target = targetOf(match[1])

    if (prefix && target) mounts.push({ target, prefix })
  }

  return mounts
}

// ---------------------------------------------------------------------------
// The layers around the routes.

const PART_SUFFIXES: [RegExp, ApiPartKind][] = [
  [/\.(service|provider)$/, 'service'],
  [/\.(repository|repo)$/, 'repository'],
  [/\.(entity|model|schema|dto)$/, 'model'],
  [/\.(guard|middleware|interceptor|filter|pipe|strategy)$/, 'middleware'],
  [/\.module$/, 'startup'],
]

const PART_FOLDERS: [RegExp, ApiPartKind][] = [
  [/(^|\/)services?\//, 'service'],
  [/(^|\/)(repositories|repository|repos)\//, 'repository'],
  [/(^|\/)(models?|entities|schemas|dtos?)\//, 'model'],
  [/(^|\/)(middlewares?|guards|plugins)\//, 'middleware'],
  [/(^|\/)(db|database|data|prisma|drizzle)\//, 'data'],
]

function classifyNodePart(path: string): ApiPartKind | null {
  const stem = stemOf(path)

  if (/^(main|server|app)$/.test(stem) && path.split('/').length <= 3) return 'startup'

  for (const [pattern, kind] of PART_SUFFIXES) if (pattern.test(stem)) return kind
  for (const [pattern, kind] of PART_FOLDERS) if (pattern.test(path)) return kind

  return null
}

/** Layers a router depends on, as .NET controllers depend on injected services. */
const DEPENDENCY_LAYERS = new Set<ApiPartKind>(['service', 'repository', 'data'])

const exportedNames = (code: string) =>
  [
    ...code.matchAll(
      /\bexport\s+(?:default\s+)?(?:abstract\s+)?(?:class|interface|function|const|let|type)\s+(\w+)/g,
    ),
  ].map((match) => match[1])

/** The API of a Node project: NestJS controllers, or Express / Fastify / Hono routers. */
export function buildNodeApiModel(sources: SourceFile[], stack: ApiStack): ApiModel {
  const files = sources
    .filter((file) => isNodeFile(file.path) && !isTestPath(file.path))
    .map((file) => ({ file, code: stripCComments(file.text) }))
  const known = new Set(files.map(({ file }) => file.path))
  const resources: ApiResource[] = []

  if (stack === 'nest') {
    const globalPrefix =
      files
        .map(({ code }) => /\.setGlobalPrefix\(\s*['"`]([^'"`]+)/.exec(code)?.[1])
        .find(Boolean) ?? ''

    for (const { file, code } of files)
      resources.push(...parseNestControllers(file, code, globalPrefix))
  } else {
    const imports = new Map(
      files.map(({ file, code }) => [file.path, importsOf(file, code, known)]),
    )
    const mounts = files.flatMap(({ file, code }) =>
      mountsOf(file, code, imports.get(file.path)!, known).map((mount) => ({
        ...mount,
        from: file.path,
      })),
    )
    const prefixOf = (path: string, depth = 0): string => {
      const mount = mounts.find((item) => item.target === path)

      return mount && depth < 8 ? joinRoute(prefixOf(mount.from, depth + 1), mount.prefix) : ''
    }

    for (const { file, code } of files) {
      const mounted = mounts.some((mount) => mount.target === file.path)

      if (!SERVER_IMPORT.test(code) && !mounted) continue

      const calls = routeCalls(code, receiversOf(code))

      if (calls.length === 0) continue

      const prefix = prefixOf(file.path)
      const fileImports = imports.get(file.path)!

      resources.push({
        name: resourceName(file.path),
        route: prefix || '/',
        path: file.path,
        kind: 'minimal',
        auth: calls.every((call) => call.auth),
        endpoints: calls.map((call) => ({ ...call, route: joinRoute(prefix, call.route) })),
        // What a router imports from the service layers: its dependencies.
        uses: [...fileImports.entries()]
          .filter(([, target]) => DEPENDENCY_LAYERS.has(classifyNodePart(target) ?? 'other'))
          .map(([name]) => name),
      })
    }
  }

  const routed = new Set(resources.map((resource) => resource.path))
  // Only the server's own folders: a front end in the same repository isn't part of the API.
  const roots = [...routed].map((path) => (path.includes('/') ? `${path.split('/')[0]}/` : ''))
  const parts: ApiPart[] = []

  for (const { file, code } of files) {
    if (routed.has(file.path)) continue
    if (roots.length > 0 && !roots.some((root) => file.path.startsWith(root))) continue

    const kind = classifyNodePart(file.path)

    if (!kind) continue

    const types = exportedNames(code)

    parts.push({
      name: types.find((type) => /^[A-Z]/.test(type)) ?? stemOf(file.path),
      path: file.path,
      kind,
      types,
    })
  }

  resources.sort((a, b) => a.route.localeCompare(b.route))
  parts.sort((a, b) => a.name.localeCompare(b.name))

  return { resources, parts }
}
