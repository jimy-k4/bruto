import type { ApiModel } from './dotnet'
import type { DbModel } from './plsql'
import type { WebModel } from './web'

/** Whether some note points at any of these files. */
type Noted = (paths: string[]) => boolean

/** A lens model cut down to the elements some note points at. */
export function keepNotedModel<Model extends WebModel | ApiModel | DbModel>(
  model: Model,
  noted: Noted,
): Model {
  if ('elements' in model) {
    return { ...model, elements: model.elements.filter((element) => noted([element.path])) }
  }

  if ('resources' in model) {
    return {
      ...model,
      resources: model.resources.filter((resource) => noted([resource.path])),
      parts: model.parts.filter((part) => noted([part.path])),
    }
  }

  const tables = model.tables.filter((table) => noted([table.path]))
  const names = new Set(tables.map((table) => table.name))

  return {
    ...model,
    tables,
    // A key is only drawn between two tables that are both still there.
    relations: model.relations.filter(
      (relation) => names.has(relation.from) && names.has(relation.to),
    ),
    programs: model.programs.filter((program) => noted(program.paths)),
  }
}
