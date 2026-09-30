import type { SourceFile } from '../storage/projectFiles'
import { WEB_CODE, type DetectedLens } from './detect'
import { buildApiModel, isDotnetFile, type ApiModel } from './dotnet'
import { buildDrizzleModel, isDrizzleCandidate } from './drizzle'
import { buildNextApiModel, isNextFile } from './next'
import { buildNodeApiModel, isNodeFile } from './node'
import { buildPrismaModel, isPrismaFile } from './prisma'
import { buildPythonApiModel, isPythonFile } from './python'
import { extensionOf } from './source'
import { buildSpringApiModel, isJavaFile } from './spring'
import { buildDbModel, isSqlFile, type DbModel } from './sql'
import { buildWebModel, isWebFile, type WebModel } from './web'

export type LensModel = WebModel | ApiModel | DbModel

/** What a lens reads and how it parses it. Pure: the parsing runs in a worker. */
export interface LensReader {
  wanted: (path: string) => boolean
  build: (sources: SourceFile[], paths: string[]) => LensModel
}

/** The reader for a lens's stack. */
export function readerFor(lens: DetectedLens): LensReader {
  if (lens.kind === 'web') {
    const framework = lens.framework ?? 'react'

    return {
      wanted: (path) => WEB_CODE.has(extensionOf(path)) && isWebFile(path),
      build: (sources, paths) => buildWebModel(paths, sources, framework),
    }
  }

  if (lens.kind === 'api') {
    const stack = lens.api

    switch (stack) {
      case 'nest':
      case 'express':
      case 'fastify':
        return { wanted: isNodeFile, build: (sources) => buildNodeApiModel(sources, stack) }
      case 'next':
        return { wanted: isNextFile, build: (sources) => buildNextApiModel(sources) }
      case 'fastapi':
      case 'flask':
        return { wanted: isPythonFile, build: (sources) => buildPythonApiModel(sources) }
      case 'spring':
        return { wanted: isJavaFile, build: (sources) => buildSpringApiModel(sources) }
      default:
        return { wanted: isDotnetFile, build: (sources) => buildApiModel(sources) }
    }
  }

  const dialect = lens.db

  if (dialect === 'prisma') {
    return { wanted: isPrismaFile, build: (sources) => buildPrismaModel(sources) }
  }
  if (dialect === 'drizzle') {
    return { wanted: isDrizzleCandidate, build: (sources) => buildDrizzleModel(sources) }
  }

  return { wanted: isSqlFile, build: (sources) => buildDbModel(sources, dialect ?? 'sql') }
}
