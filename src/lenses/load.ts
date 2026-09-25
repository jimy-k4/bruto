import { readSources, type IndexedFile } from '../storage/projectFiles'
import { WEB_CODE, type DetectedLens } from './detect'
import { buildApiModel, isDotnetFile, type ApiModel } from './dotnet'
import { buildNodeApiModel, isNodeFile } from './node'
import { buildPrismaModel, isPrismaFile } from './prisma'
import { buildPythonApiModel, isPythonFile } from './python'
import { extensionOf } from './source'
import { buildSpringApiModel, isJavaFile } from './spring'
import { buildDbModel, isSqlFile, type DbModel } from './sql'
import { buildWebModel, isWebFile, type WebModel } from './web'

export type LensModel = WebModel | ApiModel | DbModel

/** Reads only the code a lens needs, then parses it with the reader for its stack. */
export async function loadLens(
  lens: DetectedLens,
  files: IndexedFile[],
  paths: string[],
): Promise<LensModel> {
  const read = (wanted: (path: string) => boolean) => readSources(files, wanted)

  if (lens.kind === 'web') {
    const sources = await read((path) => WEB_CODE.has(extensionOf(path)) && isWebFile(path))

    return buildWebModel(paths, sources, lens.framework ?? 'react')
  }

  if (lens.kind === 'api') {
    switch (lens.api) {
      case 'nest':
      case 'express':
      case 'fastify':
        return buildNodeApiModel(await read(isNodeFile), lens.api)
      case 'fastapi':
      case 'flask':
        return buildPythonApiModel(await read(isPythonFile))
      case 'spring':
        return buildSpringApiModel(await read(isJavaFile))
      default:
        return buildApiModel(await read(isDotnetFile))
    }
  }

  const dialect = lens.db

  if (dialect === 'prisma') return buildPrismaModel(await read(isPrismaFile))

  return buildDbModel(await read(isSqlFile), dialect ?? 'sql')
}

/** What a lens draws when its code can't be read. */
export function emptyModel(lens: DetectedLens): LensModel {
  if (lens.kind === 'web') return { framework: lens.framework ?? 'react', elements: [] }
  if (lens.kind === 'api') return { resources: [], parts: [] }

  return { tables: [], relations: [], programs: [] }
}
