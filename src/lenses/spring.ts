import type { SourceFile } from '../storage/projectFiles'
import type { ApiModel, ApiPart, ApiPartKind, ApiResource, Endpoint, HttpVerb } from './dotnet'
import {
  ANNOTATION,
  annotationsBefore,
  balanced,
  extensionOf,
  firstString,
  joinRoute,
  splitTopLevel,
  stemOf,
  stripCComments,
} from './source'

export const isJavaFile = (path: string) => extensionOf(path) === 'java'

const isTestPath = (path: string) => /(^|\/)src\/test\//.test(path) || /Tests?\.java$/.test(path)

const AUTH = /@(PreAuthorize|PostAuthorize|Secured|RolesAllowed)\b/

/** The path an annotation maps: `@GetMapping("/{id}")`, `@RequestMapping(path = "/x")`. */
const mappedPath = (args: string | undefined) => {
  const named = /\b(?:value|path)\s*=\s*\{?\s*"([^"]*)"/.exec(args ?? '')?.[1]

  return named ?? firstString(args) ?? ''
}

/** Types a class gets from Spring: constructor parameters and injected or final fields. */
function injectedTypes(name: string, body: string): string[] {
  const types = new Set<string>()
  const constructor = new RegExp(String.raw`\b${name}\s*\(`).exec(body)

  if (constructor) {
    for (const parameter of splitTopLevel(
      balanced(body, constructor.index + constructor[0].length - 1) ?? '',
      true,
    )) {
      const type = /([A-Z][\w]*)(?:<[^>]*>)?\s+\w+\s*$/.exec(
        parameter.replace(/@\w+(\([^)]*\))?\s*/g, ''),
      )?.[1]

      if (type) types.add(type)
    }
  }

  // @Autowired fields, and final fields filled by Lombok's @RequiredArgsConstructor.
  for (const match of body.matchAll(
    /(?:@Autowired\s+(?:private\s+|protected\s+)?|\bprivate\s+final\s+)([A-Z]\w*)(?:<[^>]*>)?\s+\w+\s*;/g,
  )) {
    types.add(match[1])
  }

  return [...types]
}

function parseControllers(file: SourceFile, code: string): ApiResource[] {
  const resources: ApiResource[] = []

  for (const match of code.matchAll(/\bclass\s+(\w+)[^{]*\{/g)) {
    const annotations = annotationsBefore(code, match.index)

    if (!/@(RestController|Controller)\b/.test(annotations)) continue

    const name = match[1]
    const body = balanced(code, match.index + match[0].length - 1, '{}') ?? ''
    const base = mappedPath(
      new RegExp(String.raw`@RequestMapping\s*\(((?:[^()]|\([^()]*\))*)\)`).exec(annotations)?.[1],
    )
    const classAuth = AUTH.test(annotations)
    const endpoints: Endpoint[] = []

    for (const mapping of body.matchAll(
      new RegExp(
        String.raw`@(Get|Post|Put|Patch|Delete|Request)Mapping\b(?:\s*\(((?:[^()]|\([^()]*\))*)\))?`,
        'g',
      ),
    )) {
      const verbs: HttpVerb[] =
        mapping[1] === 'Request'
          ? [...(mapping[2] ?? '').matchAll(/RequestMethod\.(\w+)/g)].map(
              (item) => item[1] as HttpVerb,
            )
          : [mapping[1].toUpperCase() as HttpVerb]
      const after = body.slice(mapping.index)
      const chain = new RegExp(String.raw`^(?:${ANNOTATION}\s*)+`).exec(after)?.[0] ?? ''
      const action = /^[\w<>[\],.?\s]*?\b(\w+)\s*\(/.exec(after.slice(chain.length))?.[1]
      const annotations = annotationsBefore(body, mapping.index) + chain

      for (const verb of verbs.length > 0 ? verbs : (['GET'] as HttpVerb[])) {
        endpoints.push({
          verb,
          route: joinRoute(base, mappedPath(mapping[2])),
          action,
          auth: classAuth || AUTH.test(annotations),
        })
      }
    }

    resources.push({
      name: name.replace(/(Rest)?Controller$/, ''),
      route: joinRoute(base),
      path: file.path,
      kind: 'controller',
      auth: classAuth,
      endpoints,
      uses: injectedTypes(name, body),
    })
  }

  return resources
}

function classifyJavaPart(path: string, code: string, types: string[]): ApiPartKind | null {
  if (/@SpringBootApplication\b|@Configuration\b/.test(code)) return 'startup'
  if (
    /@Repository\b|\bextends\s+\w*(Jpa|Crud|PagingAndSorting|Mongo|Reactive\w*)Repository\b/.test(
      code,
    )
  )
    return 'repository'
  if (/@Service\b/.test(code) || types.some((type) => /Service(Impl)?$/.test(type)))
    return 'service'
  if (
    /@(ControllerAdvice|RestControllerAdvice)\b|\bimplements\s+(Filter|HandlerInterceptor)\b|extends\s+OncePerRequestFilter/.test(
      code,
    )
  )
    return 'middleware'
  if (
    /@(Entity|Table|Document|Embeddable)\b|\brecord\s+\w+/.test(code) ||
    /(^|\/)(models?|entities|entity|domain|dtos?)\//i.test(path)
  )
    return 'model'

  return null
}

/** The API of a Spring project: controllers with their mappings, and the layers around them. */
export function buildSpringApiModel(sources: SourceFile[]): ApiModel {
  const resources: ApiResource[] = []
  const parts: ApiPart[] = []

  for (const file of sources) {
    if (!isJavaFile(file.path) || isTestPath(file.path)) continue

    const code = stripCComments(file.text)
    const controllers = parseControllers(file, code)

    resources.push(...controllers)

    if (controllers.length > 0) continue

    const types = [...code.matchAll(/\b(?:class|interface|record|enum)\s+(\w+)/g)].map(
      (match) => match[1],
    )
    const kind = classifyJavaPart(file.path, code, types)

    if (kind) parts.push({ name: types[0] ?? stemOf(file.path), path: file.path, kind, types })
  }

  resources.sort((a, b) => a.route.localeCompare(b.route))
  parts.sort((a, b) => a.name.localeCompare(b.name))

  return { resources, parts }
}
