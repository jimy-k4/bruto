import { describe, expect, it } from 'vitest'
import { detectLenses, detectionFiles } from './detect'

const file = (path: string, text: string) => ({ path, text })
const pkg = (...names: string[]) =>
  file(
    'package.json',
    JSON.stringify({ dependencies: Object.fromEntries(names.map((name) => [name, '1'])) }),
  )
const stacks = (paths: string[], samples: { path: string; text: string }[] = []) =>
  detectLenses(paths, samples).map((lens) => `${lens.kind}:${lens.tech}`)

describe('detectLenses', () => {
  it('names the web framework from package.json, most specific first', () => {
    expect(stacks(['package.json'], [pkg('next', 'react')])).toEqual(['web:Next.js'])
    expect(stacks(['package.json'], [pkg('@sveltejs/kit', 'svelte')])).toEqual(['web:SvelteKit'])
    expect(stacks(['package.json'], [pkg('@angular/core')])).toEqual(['web:Angular'])
    expect(stacks(['src/pages/index.astro'])).toEqual(['web:Astro'])
    expect(stacks(['src/App.vue'])).toEqual(['web:Vue'])
    expect(stacks(['src/App.tsx'])).toEqual(['web:React'])
  })

  it('names the API stack from the project files and manifests', () => {
    expect(stacks(['Api/Api.csproj', 'Api/Program.cs'])).toEqual(['api:.NET'])
    expect(stacks(['package.json'], [pkg('@nestjs/core', 'express')])).toEqual(['api:NestJS'])
    expect(stacks(['package.json'], [pkg('express')])).toEqual(['api:Express'])
    expect(
      stacks(['requirements.txt'], [file('requirements.txt', 'fastapi==0.110\nuvicorn')]),
    ).toEqual(['api:FastAPI'])
    expect(
      stacks(['pyproject.toml'], [file('pyproject.toml', 'dependencies = ["Flask>=3"]')]),
    ).toEqual(['api:Flask'])
    expect(
      stacks(['pom.xml'], [file('pom.xml', '<artifactId>spring-boot-starter-web</artifactId>')]),
    ).toEqual(['api:Spring'])
  })

  it('tells Oracle, PostgreSQL, plain SQL and Prisma apart', () => {
    expect(stacks(['db/pkg_orders.pkb'])).toEqual(['db:PL/SQL'])
    expect(
      stacks(
        ['db/schema.sql'],
        [file('db/schema.sql', 'CREATE TABLE t (id NUMBER(10), name VARCHAR2(20));')],
      ),
    ).toEqual(['db:PL/SQL'])
    expect(stacks(['supabase/migrations/001_init.sql'])).toEqual(['db:PostgreSQL'])
    expect(
      stacks(
        ['db/001.sql'],
        [file('db/001.sql', 'create table t (id uuid primary key, data jsonb);')],
      ),
    ).toEqual(['db:PostgreSQL'])
    expect(
      stacks(['db/001.sql'], [file('db/001.sql', 'create table t (id int primary key);')]),
    ).toEqual(['db:SQL'])
    expect(stacks(['prisma/schema.prisma', 'prisma/migrations/1/migration.sql'])).toEqual([
      'db:Prisma',
    ])
    expect(stacks(['README.md'])).toEqual([])
  })

  it('reads the manifests and only a few SQL scripts', () => {
    const wanted = detectionFiles()
    const scripts = Array.from({ length: 20 }, (_, index) => `db/${index}.sql`).filter(wanted)

    expect(scripts.length).toBeLessThan(20)
    expect(
      ['package.json', 'api/requirements-dev.txt', 'pom.xml', 'src/App.tsx'].map(wanted),
    ).toEqual([true, true, true, false])
  })
})
