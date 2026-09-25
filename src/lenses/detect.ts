import type { SourceFile } from '../storage/projectFiles'
import { baseName, extensionOf } from './source'

export type LensKind = 'web' | 'api' | 'db'
export type WebFramework =
  'next' | 'nuxt' | 'sveltekit' | 'astro' | 'angular' | 'vue' | 'svelte' | 'react'
export type ApiStack = 'dotnet' | 'nest' | 'express' | 'fastify' | 'fastapi' | 'flask' | 'spring'
export type DbStack = 'oracle' | 'postgres' | 'sql' | 'prisma'

export interface DetectedLens {
  kind: LensKind
  /** Shown next to the tab: "Next.js", ".NET", "PostgreSQL". */
  tech: string
  framework?: WebFramework
  api?: ApiStack
  db?: DbStack
}

export const WEB_CODE = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro'])
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

/** Extensions only Oracle tools use: a project with any of them speaks PL/SQL. */
const ORACLE_EXTENSIONS = new Set([
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
])

/** Every extension the database lens reads. */
export const SQL_EXTENSIONS = new Set([...ORACLE_EXTENSIONS, 'sql', 'ddl', 'pgsql', 'psql'])

/** Files worth reading to tell what a project is built with. Small and few. */
const MANIFESTS = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
])

/** SQL scripts read to tell Oracle from PostgreSQL. */
const SQL_SAMPLES = 12

/** The files `detectLenses` wants to see: manifests, and a few SQL scripts. */
export function detectionFiles(): (path: string) => boolean {
  let sql = 0

  return (path) =>
    MANIFESTS.has(baseName(path)) || /^requirements.*\.txt$/.test(baseName(path))
      ? true
      : SQL_EXTENSIONS.has(extensionOf(path)) && sql++ < SQL_SAMPLES
}

const WEB_LABELS: Record<WebFramework, string> = {
  next: 'Next.js',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  astro: 'Astro',
  angular: 'Angular',
  vue: 'Vue',
  svelte: 'Svelte',
  react: 'React',
}

const API_LABELS: Record<ApiStack, string> = {
  dotnet: '.NET',
  nest: 'NestJS',
  express: 'Express',
  fastify: 'Fastify',
  fastapi: 'FastAPI',
  flask: 'Flask',
  spring: 'Spring',
}

const DB_LABELS: Record<DbStack, string> = {
  oracle: 'PL/SQL',
  postgres: 'PostgreSQL',
  sql: 'SQL',
  prisma: 'Prisma',
}

/** A dependency named in a package.json. */
const npm = (text: string, name: string) =>
  new RegExp(`"${name.replace(/[/.]/g, '\\$&')}"\\s*:`).test(text)

/** A package named in a Python or Java manifest (any version syntax). */
const mentions = (text: string, name: string) =>
  new RegExp(`(^|[^\\w-])${name.replace(/[.]/g, '\\.')}([^\\w-]|$)`, 'im').test(text)

const ORACLE_SIGNS =
  /\b(?:VARCHAR2|NVARCHAR2|PLS_INTEGER|SYSDATE|SYSTIMESTAMP|NUMBER\s*\(|CREATE\s+(?:OR\s+REPLACE\s+)?PACKAGE)\b|%(?:ROW)?TYPE\b/gi
const POSTGRES_SIGNS =
  /\b(?:plpgsql|timestamptz|jsonb|bigserial|serial|gen_random_uuid|uuid_generate_v4|CREATE\s+POLICY|ROW\s+LEVEL\s+SECURITY|CREATE\s+EXTENSION)\b|\$\$/gi

const count = (texts: string[], pattern: RegExp) =>
  texts.reduce((sum, text) => sum + (text.match(pattern)?.length ?? 0), 0)

function detectDb(paths: string[], samples: SourceFile[]): DbStack | null {
  const extensions = new Set(paths.map(extensionOf))

  if (extensions.has('prisma')) return 'prisma'
  if ([...ORACLE_EXTENSIONS].some((extension) => extensions.has(extension))) return 'oracle'
  if (!paths.some((path) => SQL_EXTENSIONS.has(extensionOf(path)))) return null

  const sql = samples.filter((file) => SQL_EXTENSIONS.has(extensionOf(file.path)))
  const texts = sql.map((file) => file.text)
  const oracle = count(texts, ORACLE_SIGNS)
  const postgres = count(texts, POSTGRES_SIGNS)
  const postgresProject =
    paths.some((path) => /(^|\/)supabase\//.test(path)) ||
    extensions.has('pgsql') ||
    extensions.has('psql') ||
    samples.some(
      (file) =>
        (baseName(file.path) === 'package.json' &&
          ['pg', 'postgres', '@supabase/supabase-js', '@neondatabase/serverless'].some((name) =>
            npm(file.text, name),
          )) ||
        (baseName(file.path) !== 'package.json' && mentions(file.text, 'psycopg2?')),
    )

  if (oracle > postgres) return 'oracle'
  if (postgres > 0 || postgresProject) return 'postgres'

  return 'sql'
}

function detectWeb(paths: string[], packages: string[]): WebFramework | null {
  const extensions = new Set(paths.map(extensionOf))
  const uses = (name: string) => packages.some((text) => npm(text, name))

  if (uses('next')) return 'next'
  if (uses('nuxt')) return 'nuxt'
  if (uses('@sveltejs/kit')) return 'sveltekit'
  if (uses('astro') || extensions.has('astro')) return 'astro'
  if (uses('@angular/core')) return 'angular'
  if (uses('vue') || extensions.has('vue')) return 'vue'
  if (uses('svelte') || extensions.has('svelte')) return 'svelte'
  if (uses('react') || extensions.has('jsx') || extensions.has('tsx')) return 'react'

  return null
}

function detectApi(paths: string[], samples: SourceFile[]): ApiStack | null {
  const extensions = new Set(paths.map(extensionOf))
  const packages = samples.filter((file) => baseName(file.path) === 'package.json')
  const python = samples.filter((file) => /\.(txt|toml)$|^Pipfile$/.test(baseName(file.path)))
  const java = samples.filter((file) =>
    /^(pom\.xml|build\.gradle(\.kts)?)$/.test(baseName(file.path)),
  )
  const uses = (name: string) => packages.some((file) => npm(file.text, name))

  if (extensions.has('csproj') || (extensions.has('cs') && paths.some(isDotnetEntry)))
    return 'dotnet'
  if (uses('@nestjs/core')) return 'nest'
  if (uses('express')) return 'express'
  if (uses('fastify')) return 'fastify'
  if (python.some((file) => mentions(file.text, 'fastapi'))) return 'fastapi'
  if (python.some((file) => mentions(file.text, 'flask'))) return 'flask'
  if (java.some((file) => /spring-boot|org\.springframework/.test(file.text))) return 'spring'

  return null
}

/**
 * Which lenses fit the project, from its file names, its manifests
 * (`package.json`, `requirements.txt`, `pom.xml`…) and a few SQL scripts.
 * Cheap: nothing else is read until a lens is opened.
 */
export function detectLenses(paths: string[], samples: SourceFile[]): DetectedLens[] {
  const lenses: DetectedLens[] = []
  const packages = samples
    .filter((file) => baseName(file.path) === 'package.json')
    .map((file) => file.text)
  const framework = detectWeb(paths, packages)
  const api = detectApi(paths, samples)
  const db = detectDb(paths, samples)

  if (framework) lenses.push({ kind: 'web', tech: WEB_LABELS[framework], framework })
  if (api) lenses.push({ kind: 'api', tech: API_LABELS[api], api })
  if (db) lenses.push({ kind: 'db', tech: DB_LABELS[db], db })

  return lenses
}

const isDotnetEntry = (path: string) => {
  const name = baseName(path)

  return name === 'Program.cs' || name === 'Startup.cs' || name.endsWith('Controller.cs')
}
