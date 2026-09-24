import { describe, expect, it } from 'vitest'
import { detectLenses } from './detect'
import { buildWebModel } from './web'

const byPath = (model: ReturnType<typeof buildWebModel>) =>
  new Map(model.elements.map((element) => [element.path, element]))

describe('detectLenses', () => {
  it('names the web framework from package.json, most specific first', () => {
    expect(detectLenses(['package.json'], ['{"dependencies":{"next":"15","react":"19"}}'])).toEqual(
      [{ kind: 'web', tech: 'Next.js', framework: 'next' }],
    )
    expect(detectLenses(['src/App.vue'], [])[0]).toMatchObject({ framework: 'vue' })
    expect(detectLenses(['src/App.tsx'], [])[0]).toMatchObject({ framework: 'react' })
  })

  it('finds .NET and PL/SQL projects by their files', () => {
    expect(detectLenses(['Api/Api.csproj', 'Api/Program.cs'], []).map((lens) => lens.kind)).toEqual(
      ['api'],
    )
    expect(detectLenses(['db/pkg_orders.pkb'], []).map((lens) => lens.kind)).toEqual(['db'])
    expect(detectLenses(['README.md'], [])).toEqual([])
  })
})

describe('buildWebModel', () => {
  it('reads the routes of the Next.js app router from its folders', () => {
    const model = byPath(
      buildWebModel(
        [
          'app/page.tsx',
          'app/layout.tsx',
          'app/(shop)/products/[id]/page.tsx',
          'app/api/orders/route.ts',
          'app/components/Header.tsx',
          'next.config.js',
        ],
        [],
        'next',
      ),
    )

    expect(model.get('app/page.tsx')).toMatchObject({ role: 'page', route: '/' })
    expect(model.get('app/layout.tsx')).toMatchObject({ role: 'layout', route: '/' })
    expect(model.get('app/(shop)/products/[id]/page.tsx')).toMatchObject({
      role: 'page',
      route: '/products/:id',
    })
    expect(model.get('app/api/orders/route.ts')).toMatchObject({
      role: 'server',
      route: '/api/orders',
    })
    expect(model.get('app/components/Header.tsx')?.role).toBe('component')
    expect(model.get('next.config.js')?.role).toBe('config')
  })

  it('reads routes relative to the app folder in a repository with several apps', () => {
    const model = byPath(
      buildWebModel(
        ['web/package.json', 'web/app/cart/page.tsx', 'web/app/layout.tsx'],
        [],
        'next',
      ),
    )

    expect(model.get('web/app/cart/page.tsx')).toMatchObject({ role: 'page', route: '/cart' })
    expect(model.get('web/app/layout.tsx')?.role).toBe('layout')
  })

  it('reads file routing from pages/ in Next.js and Nuxt', () => {
    const next = byPath(
      buildWebModel(
        ['pages/index.tsx', 'pages/users/[id].tsx', 'pages/api/me.ts', 'pages/_app.tsx'],
        [],
        'next',
      ),
    )

    expect(next.get('pages/index.tsx')).toMatchObject({ role: 'page', route: '/' })
    expect(next.get('pages/users/[id].tsx')).toMatchObject({ role: 'page', route: '/users/:id' })
    expect(next.get('pages/api/me.ts')).toMatchObject({ role: 'server', route: '/api/me' })
    expect(next.get('pages/_app.tsx')?.role).toBe('layout')

    const nuxt = byPath(buildWebModel(['pages/blog/[slug].vue'], [], 'nuxt'))
    expect(nuxt.get('pages/blog/[slug].vue')).toMatchObject({ role: 'page', route: '/blog/:slug' })
  })

  it('gives each kind of file its role', () => {
    const model = byPath(
      buildWebModel(
        [
          'src/main.tsx',
          'src/views/Home.vue',
          'src/layouts/Default.vue',
          'src/components/Card.tsx',
          'src/hooks/useAuth.ts',
          'src/composables/useCart.ts',
          'src/stores/cart.ts',
          'src/services/api.ts',
          'src/styles/app.css',
          'public/logo.svg',
          'src/components/Card.test.tsx',
        ],
        [],
        'vue',
      ),
    )

    expect([...model.values()].map((element) => [element.path, element.role])).toEqual([
      ['src/main.tsx', 'entry'],
      ['src/views/Home.vue', 'page'],
      ['src/layouts/Default.vue', 'layout'],
      ['src/components/Card.tsx', 'component'],
      ['src/hooks/useAuth.ts', 'hook'],
      ['src/composables/useCart.ts', 'hook'],
      ['src/stores/cart.ts', 'store'],
      ['src/services/api.ts', 'service'],
      ['src/styles/app.css', 'style'],
      ['public/logo.svg', 'asset'],
      ['src/components/Card.test.tsx', 'test'],
    ])
  })

  it('follows imports, counts uses and resolves the @/ alias', () => {
    const paths = [
      'src/pages/Home.tsx',
      'src/components/Card.tsx',
      'src/components/Button/index.tsx',
    ]
    const model = byPath(
      buildWebModel(
        paths,
        [
          {
            path: 'src/pages/Home.tsx',
            text: "import Card from '../components/Card'\nimport { Button } from '@/components/Button'\nimport React from 'react'",
          },
          { path: 'src/components/Card.tsx', text: "import { Button } from './Button'" },
        ],
        'react',
      ),
    )

    expect(model.get('src/pages/Home.tsx')?.uses).toEqual([
      'src/components/Card.tsx',
      'src/components/Button/index.tsx',
    ])
    expect(model.get('src/components/Button/index.tsx')?.usedBy).toBe(2)
  })

  it('takes routes from React Router and Vue Router declarations', () => {
    const paths = [
      'src/router.tsx',
      'src/screens/Users.tsx',
      'src/Orders.tsx',
      'src/router/index.ts',
      'src/Detail.vue',
    ]
    const model = byPath(
      buildWebModel(
        paths,
        [
          {
            path: 'src/router.tsx',
            text: `import Users from './screens/Users'
              const Orders = lazy(() => import('./Orders'))
              export const router = createBrowserRouter([
                { path: '/users', element: <Users /> },
                { path: 'orders', element: <Orders /> },
              ])`,
          },
          {
            path: 'src/router/index.ts',
            text: `export default createRouter({ routes: [
                { path: '/detail/:id', component: () => import('../Detail.vue') },
              ] })`,
          },
        ],
        'react',
      ),
    )

    expect(model.get('src/screens/Users.tsx')).toMatchObject({ role: 'page', route: '/users' })
    expect(model.get('src/Orders.tsx')).toMatchObject({ role: 'page', route: '/orders' })
    expect(model.get('src/Detail.vue')).toMatchObject({ role: 'page', route: '/detail/:id' })
  })
})
