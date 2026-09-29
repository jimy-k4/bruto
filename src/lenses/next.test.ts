import { describe, expect, it } from 'vitest'
import { buildNextApiModel, isNextFile } from './next'

const file = (path: string, text: string) => ({ path, text })

describe('buildNextApiModel', () => {
  const model = buildNextApiModel([
    file(
      'app/api/admin/users/[id]/route.ts',
      `import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequestToken, isAdmin } from "@/lib/admin-auth"
import { db } from "@/db"

export async function GET(request: NextRequest) {
  const user = await getUserFromRequestToken(request)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await db.query.users.findMany())
}

export const DELETE = async (request: NextRequest) => {
  await db.delete(request.url)
  return NextResponse.json({ ok: true })
}`,
    ),
    file(
      'app/api/previews/route.ts',
      `// Public: the cards ask for their screenshots.
export async function GET() { return new Response('ok') }
export async function POST(request: Request) { return new Response(null, { status: 201 }) }`,
    ),
    file(
      'app/api/auth/[...all]/route.ts',
      `import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"

export const { GET, POST } = toNextJsHandler(auth)`,
    ),
    file(
      'app/(marketing)/feed.xml/route.ts',
      `const handler = () => new Response('<rss/>')
export { handler as GET }`,
    ),
    file(
      'app/admin/actions.ts',
      `"use server"

import { db } from "@/db"
import { photos, type Localized } from "@/db/schema"
import { requireSession } from "@/lib/session"

export type SaveResult = { ok: boolean }

export async function saveCostume(input: unknown): Promise<SaveResult> {
  await requireSession()
  return { ok: true }
}

export const deletePhoto = async (id: string) => {
  await db.delete(photos)
}`,
    ),
    file(
      'pages/api/webhooks/[provider].ts',
      `export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.status(200).json({ ok: true })
}`,
    ),
    file('pages/api/health.ts', `export default function handler(req, res) { res.send('ok') }`),
    file(
      'lib/admin-auth.ts',
      `import { createClient } from "./supabase/server"
export async function getUserFromRequestToken(request: Request) {}
export function isAdmin(user: unknown) { return true }`,
    ),
    file('lib/supabase/server.ts', `export function createClient() {}`),
    file('lib/session.ts', `export async function requireSession() {}`),
    file('lib/auth.ts', `export const auth = betterAuth({})`),
    file('db/index.ts', `export const db = drizzle()`),
    file('db/schema.ts', `export const photos = pgTable("photos", {})\nexport type Localized = {}`),
    file(
      'middleware.ts',
      `import { updateSession } from "@/lib/supabase/middleware"
export async function middleware(request) { return updateSession(request) }`,
    ),
    file('lib/supabase/middleware.ts', `export async function updateSession(request) {}`),
    file('lib/format.ts', `export const money = (n: number) => n.toFixed(2)`),
    file('components/save-button.ts', `"use client"\nexport const x = 1`),
    file('app/api/admin/users/[id]/route.test.ts', `export async function GET() {}`),
  ])
  const byRoute = (route: string) => model.resources.find((resource) => resource.route === route)

  it('reads each route handler with the methods it exports and whether it checks the caller', () => {
    expect(byRoute('/api/admin/users/:id')).toMatchObject({
      name: 'users',
      path: 'app/api/admin/users/[id]/route.ts',
      auth: false,
      endpoints: [
        { verb: 'GET', route: '/api/admin/users/:id', auth: true },
        { verb: 'DELETE', route: '/api/admin/users/:id', auth: false },
      ],
    })
    expect(byRoute('/api/previews')!.endpoints.map((endpoint) => endpoint.auth)).toEqual([
      false,
      false,
    ])
  })

  it('reads methods exported by destructuring or renaming, and leaves route groups out', () => {
    expect(byRoute('/api/auth/*all')!.endpoints.map((endpoint) => endpoint.verb)).toEqual([
      'GET',
      'POST',
    ])
    expect(byRoute('/feed.xml')).toMatchObject({ name: 'feed.xml', endpoints: [{ verb: 'GET' }] })
  })

  it('reads pages/api handlers by the methods they compare, or as answering any', () => {
    expect(byRoute('/api/webhooks/:provider')!.endpoints).toEqual([
      { verb: 'POST', route: '/api/webhooks/:provider', auth: false },
    ])
    expect(byRoute('/api/health')!.endpoints).toEqual([
      { verb: 'ANY', route: '/api/health', auth: false },
    ])
  })

  it('reads server actions by name, under the URL of their folder', () => {
    expect(byRoute('/admin')).toMatchObject({
      name: 'admin/actions',
      endpoints: [
        { verb: 'ACTION', action: 'saveCostume', auth: true },
        { verb: 'ACTION', action: 'deletePhoto', auth: false },
      ],
      uses: ['db', 'photos', 'Localized', 'requireSession'],
    })
  })

  it('keeps tests out', () => {
    expect(model.resources.filter((resource) => resource.path.includes('.test.'))).toEqual([])
  })

  it('places the modules routes and actions use, through @/ imports, in their layers', () => {
    expect(model.parts.map((part) => [part.name, part.kind])).toEqual([
      ['admin-auth', 'middleware'],
      ['auth', 'middleware'],
      ['db', 'data'],
      ['middleware', 'middleware'],
      ['schema', 'data'],
      ['session', 'middleware'],
      ['supabase/middleware', 'data'],
      ['supabase/server', 'data'],
    ])
    expect(byRoute('/api/admin/users/:id')!.uses).toEqual([
      'getUserFromRequestToken',
      'isAdmin',
      'db',
    ])
  })

  it('leaves out what no route uses and UI code', () => {
    const paths = model.parts.map((part) => part.path)

    expect(paths).not.toContain('lib/format.ts')
    expect(paths).not.toContain('components/save-button.ts')
  })

  it('reads .ts and .js, and a .tsx only when it is a route or actions file', () => {
    expect(['lib/db.ts', 'app/api/x/route.tsx', 'app/actions.tsx'].every(isNextFile)).toBe(true)
    expect(['app/page.tsx', 'components/Button.tsx', 'types.d.ts'].some(isNextFile)).toBe(false)
  })
})

describe('buildNextApiModel with a middleware', () => {
  const routes = [
    file('app/api/e/route.ts', 'export async function POST() {}'),
    file('app/api/previews/[slug]/route.ts', 'export async function PUT() {}'),
    file('app/actions.ts', '"use server"\nexport async function addSite() {}'),
  ]
  const locked = (middleware: string) =>
    Object.fromEntries(
      buildNextApiModel([...routes, file('proxy.ts', middleware)]).resources.map((resource) => [
        resource.route,
        resource.auth,
      ]),
    )

  it('guards what its matcher covers when it checks the caller', () => {
    expect(
      locked(`export function proxy(request) {
  const [scheme] = (request.headers.get("authorization") ?? "").split(" ")
  return new NextResponse("No", { status: 401 })
}
export const config = {
  matcher: ["/((?!api/e$|p\\.js$|_next/static|_next/image).*)"],
}`),
    ).toEqual({ '/': true, '/api/e': false, '/api/previews/:slug': true })
  })

  it('reads :path* matchers, and guards every path without a matcher', () => {
    const check = 'const user = await supabase.auth.getUser(token)'

    expect(locked(`${check}\nexport const config = { matcher: ['/api/previews/:path*'] }`)).toEqual(
      { '/': false, '/api/e': false, '/api/previews/:slug': true },
    )
    expect(locked(check)).toEqual({ '/': true, '/api/e': true, '/api/previews/:slug': true })
  })

  it('guards nothing when it leaves the API out, or only redirects', () => {
    expect(
      locked(`const user = await supabase.auth.getUser(token)
export const config = { matcher: ["/((?!_next/static|api/|.*\\..*).*)"] }`),
    ).toEqual({ '/': true, '/api/e': false, '/api/previews/:slug': false })
    expect(
      locked(`export function proxy(request) { return NextResponse.redirect(new URL('/es', request.url)) }
export const config = { matcher: "/" }`),
    ).toEqual({ '/': false, '/api/e': false, '/api/previews/:slug': false })
  })
})
