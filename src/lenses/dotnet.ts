import type { SourceFile } from '../storage/projectFiles'
import { balanced, baseName, extensionOf, splitTopLevel, stemOf, stripCComments } from './source'

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface Endpoint {
  verb: HttpVerb
  /** Full route, e.g. `/api/orders/{id}`. */
  route: string
  /** Controller action or handler name, when there is one. */
  action?: string
  auth: boolean
}

/** A controller, or a group of minimal-API endpoints. */
export interface ApiResource {
  name: string
  route: string
  path: string
  kind: 'controller' | 'minimal'
  auth: boolean
  endpoints: Endpoint[]
  /** Types injected through the constructor: the services it depends on. */
  uses: string[]
}

export type ApiPartKind =
  'service' | 'repository' | 'model' | 'middleware' | 'data' | 'startup' | 'other'

export interface ApiPart {
  name: string
  path: string
  kind: ApiPartKind
  /** Every type the file declares, to match what resources inject. */
  types: string[]
}

export interface ApiModel {
  resources: ApiResource[]
  parts: ApiPart[]
}

export const isDotnetFile = (path: string) => extensionOf(path) === 'cs'

const VERBS: Record<string, HttpVerb> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
}

/** `api` + `orders/{id}` → `/api/orders/{id}`; a template starting with `/` or `~/` stands alone. */
function combine(base: string, template: string): string {
  if (template.startsWith('~/')) return `/${template.slice(2)}`.replace(/\/+$/, '') || '/'
  if (template.startsWith('/')) return template.replace(/\/+$/, '') || '/'

  const joined = [base, template].filter(Boolean).join('/')

  return `/${joined.replace(/^\/+/, '')}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1')
}

/** Attributes (strings and one level of brackets inside) and modifiers, up to the end. */
const LEADING_ATTRIBUTES =
  /((?:\[(?:[^[\]"]|"(?:[^"\\]|\\.)*"|\[[^\]]*\])*\]\s*)*)(?:(?:public|private|protected|internal|static|sealed|abstract|partial|async|virtual|override|new)\s+)*$/

/** The attributes written right before `index`: `[ApiController]`, `[Route("api/[controller]")]`… */
function attributesBefore(code: string, index: number): string {
  return LEADING_ATTRIBUTES.exec(code.slice(Math.max(0, index - 1500), index))?.[1] ?? ''
}

const routeAttribute = (attributes: string) =>
  /\[\s*Route\s*\(\s*(?:template\s*:\s*)?@?"([^"]*)"/.exec(attributes)?.[1]

const hasAttribute = (attributes: string, name: string) =>
  new RegExp(`[\\[,]\\s*${name}\\b`).test(attributes)

/** Parameter types of a constructor or primary constructor: `IOrderService orders` → `IOrderService`. */
function parameterTypes(parameters: string): string[] {
  return splitTopLevel(parameters, true)
    .map((parameter) => parameter.replace(/^\[[^\]]*\]\s*/, '').trim())
    .map((parameter) => /^([\w.<>,\s?[\]]+?)\s+\w+(\s*=.*)?$/.exec(parameter)?.[1]?.trim() ?? '')
    .map((type) => type.replace(/\?$/, '').split('.').pop() ?? '')
    .filter((type) => /^[A-Z]/.test(type))
}

function parseControllers(file: SourceFile, code: string): ApiResource[] {
  const resources: ApiResource[] = []
  const classPattern = /\bclass\s+(\w+)\s*(?:\(([^)]*)\))?\s*(?::\s*([^{]+))?\{/g

  for (const match of code.matchAll(classPattern)) {
    const [, name, primary, bases = ''] = match
    const attributes = attributesBefore(code, match.index)
    const isController =
      /\b(ControllerBase|Controller|ODataController)\b/.test(bases) ||
      hasAttribute(attributes, 'ApiController') ||
      /Controller$/.test(name)

    if (!isController) continue

    const bodyStart = match.index + match[0].length - 1
    const body = balanced(code, bodyStart, '{}') ?? ''
    const short = name.replace(/Controller$/, '')
    const base = (routeAttribute(attributes) ?? '').replace(/\[controller\]/gi, short)
    const classAuth = hasAttribute(attributes, 'Authorize')
    const endpoints: Endpoint[] = []

    for (const verbMatch of body.matchAll(
      /\[\s*Http(Get|Post|Put|Patch|Delete|Head|Options)\b/gi,
    )) {
      const signature = /(?:public|private|protected|internal)[^(;{=]*?\s(\w+)\s*\(/.exec(
        body.slice(verbMatch.index),
      )
      const action = signature?.[1]
      const methodAttributes = body.slice(
        verbMatch.index,
        verbMatch.index + (signature?.index ?? 0),
      )
      const before = attributesBefore(body, verbMatch.index)
      const allAttributes = before + methodAttributes
      const template =
        /Http\w+\s*\(\s*(?:template\s*:\s*)?@?"([^"]*)"/.exec(methodAttributes)?.[1] ??
        routeAttribute(allAttributes) ??
        ''

      endpoints.push({
        verb: VERBS[verbMatch[1].toLowerCase()],
        route: combine(base, template.replace(/\[action\]/gi, action ?? '')),
        action,
        auth:
          (classAuth || hasAttribute(allAttributes, 'Authorize')) &&
          !hasAttribute(allAttributes, 'AllowAnonymous'),
      })
    }

    // Dependencies arrive through the constructor, classic or primary.
    const constructor = new RegExp(`\\b${name}\\s*\\(`).exec(body)
    const parameters =
      primary ??
      (constructor ? balanced(body, constructor.index + constructor[0].length - 1) : null) ??
      ''

    resources.push({
      name: short,
      route: combine(base, ''),
      path: file.path,
      kind: 'controller',
      auth: classAuth,
      endpoints,
      uses: [...new Set(parameterTypes(parameters))],
    })
  }

  return resources
}

/** Minimal APIs: `app.MapGet("/x", …)` and groups made with `MapGroup("/api")`. */
function parseMinimalApis(file: SourceFile, code: string): ApiResource[] {
  const prefixes = new Map<string, string>()
  const groupAuth = new Set<string>()

  for (const match of code.matchAll(
    /\b(\w+)\s*=\s*(\w+)\s*\.\s*MapGroup\(\s*@?"([^"]*)"\s*\)([^;]*);/g,
  )) {
    const [, variable, parent, route, rest] = match

    prefixes.set(variable, combine(prefixes.get(parent) ?? '', route.replace(/^\/+/, '')))
    if (/RequireAuthorization/.test(rest) || groupAuth.has(parent)) groupAuth.add(variable)
  }

  const groups = new Map<string, ApiResource>()

  for (const match of code.matchAll(
    /\b(\w+)\s*\.\s*Map(Get|Post|Put|Patch|Delete)\(\s*@?"([^"]*)"([^;]*);/g,
  )) {
    const [, variable, verb, route, rest] = match
    const prefix = prefixes.get(variable) ?? ''
    const key = prefix || stemOf(file.path)
    const handler = /,\s*(\w+)\s*\)/.exec(rest)?.[1]
    const resource =
      groups.get(key) ??
      ({
        name: prefix ? (prefix.split('/').filter(Boolean).pop() ?? key) : key,
        route: prefix || '/',
        path: file.path,
        kind: 'minimal',
        auth: groupAuth.has(variable),
        endpoints: [],
        uses: [],
      } satisfies ApiResource)

    resource.endpoints.push({
      verb: VERBS[verb.toLowerCase()],
      // Inside a group, "/" and "/x" are relative to the group's prefix.
      route: combine(prefix, route.replace(/^\/+/, '')),
      action: handler && /^[A-Z]/.test(handler) ? handler : undefined,
      auth: groupAuth.has(variable) || /RequireAuthorization/.test(rest),
    })
    groups.set(key, resource)
  }

  return [...groups.values()]
}

const MODEL_FOLDERS =
  /(^|\/)(models?|dtos?|entities|domain|viewmodels|contracts|requests|responses)\//i

function classifyPart(path: string, code: string, types: string[]): ApiPartKind {
  const name = baseName(path)

  if (name === 'Program.cs' || name === 'Startup.cs') return 'startup'
  if (/:\s*[\w.]*DbContext\b/.test(code) || types.some((type) => type.endsWith('DbContext')))
    return 'data'
  if (types.some((type) => type.endsWith('Middleware'))) return 'middleware'
  if (types.some((type) => /Repository$/.test(type)) || /(^|\/)repositor(y|ies)\//i.test(path))
    return 'repository'
  if (types.some((type) => /Service$/.test(type)) || /(^|\/)services\//i.test(path))
    return 'service'
  if (
    MODEL_FOLDERS.test(path) ||
    /\brecord\s+\w+/.test(code) ||
    types.some((type) => /(Dto|Request|Response|Model|Entity|Command|Query)$/.test(type))
  )
    return 'model'

  return 'other'
}

const isTestPath = (path: string) => /(^|\/)[\w.]*tests?(\/|\.)/i.test(path)

/** The API of a .NET project: resources with their endpoints, and the layers around them. */
export function buildApiModel(sources: SourceFile[]): ApiModel {
  const resources: ApiResource[] = []
  const parts: ApiPart[] = []

  for (const file of sources) {
    if (!isDotnetFile(file.path) || isTestPath(file.path)) continue

    const code = stripCComments(file.text)
    const controllers = parseControllers(file, code)
    const minimal = parseMinimalApis(file, code)

    resources.push(...controllers, ...minimal)

    if (controllers.length > 0) continue

    const types = [...code.matchAll(/\b(?:class|interface|record|struct|enum)\s+(\w+)/g)].map(
      (match) => match[1],
    )

    if (types.length === 0 && minimal.length === 0) continue

    parts.push({
      name: types[0] ?? stemOf(file.path),
      path: file.path,
      kind: classifyPart(file.path, code, types),
      types,
    })
  }

  resources.sort((a, b) => a.route.localeCompare(b.route))
  parts.sort((a, b) => a.name.localeCompare(b.name))

  return { resources, parts }
}

/** The part a resource's dependency means: `IOrderService` is served by `OrderService`. */
export function partFor(parts: ApiPart[], type: string): ApiPart | undefined {
  const plain = type.replace(/^I(?=[A-Z])/, '')

  return (
    parts.find((part) => part.types.includes(type)) ??
    parts.find((part) => part.types.includes(plain))
  )
}
