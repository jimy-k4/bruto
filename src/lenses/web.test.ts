import { describe, expect, it } from 'vitest'
import { buildWebModel } from './web'

const byPath = (model: ReturnType<typeof buildWebModel>) =>
  new Map(model.elements.map((element) => [element.path, element]))

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

describe('buildWebModel for SvelteKit, Astro and Angular', () => {
  it('reads SvelteKit routes from src/routes', () => {
    const model = byPath(
      buildWebModel(
        [
          'src/routes/+page.svelte',
          'src/routes/+layout.svelte',
          'src/routes/blog/[slug]/+page.svelte',
          'src/routes/blog/[slug]/+page.server.ts',
          'src/routes/api/orders/+server.ts',
          'src/lib/components/PostCard.svelte',
        ],
        [],
        'sveltekit',
      ),
    )

    expect(model.get('src/routes/+page.svelte')).toMatchObject({ role: 'page', route: '/' })
    expect(model.get('src/routes/+layout.svelte')).toMatchObject({ role: 'layout' })
    expect(model.get('src/routes/blog/[slug]/+page.svelte')).toMatchObject({
      role: 'page',
      route: '/blog/:slug',
      name: '[slug]',
    })
    expect(model.get('src/routes/blog/[slug]/+page.server.ts')).toMatchObject({ role: 'server' })
    expect(model.get('src/routes/api/orders/+server.ts')).toMatchObject({
      role: 'server',
      route: '/api/orders',
    })
    expect(model.get('src/lib/components/PostCard.svelte')).toMatchObject({ role: 'component' })
  })

  it('reads Astro pages and endpoints from src/pages', () => {
    const model = byPath(
      buildWebModel(
        ['src/pages/index.astro', 'src/pages/blog/[slug].astro', 'src/pages/api/feed.ts'],
        [],
        'astro',
      ),
    )

    expect(model.get('src/pages/index.astro')).toMatchObject({ role: 'page', route: '/' })
    expect(model.get('src/pages/blog/[slug].astro')).toMatchObject({ route: '/blog/:slug' })
    expect(model.get('src/pages/api/feed.ts')).toMatchObject({ role: 'server', route: '/api/feed' })
  })

  it('reads Angular files by their suffix and routes by their component', () => {
    const paths = [
      'src/app/app.routes.ts',
      'src/app/orders/orders.component.ts',
      'src/app/orders/order-detail.component.ts',
      'src/app/orders/orders.service.ts',
      'src/app/auth/auth.guard.ts',
    ]
    const model = byPath(
      buildWebModel(
        paths,
        [
          {
            path: 'src/app/app.routes.ts',
            text: `import { OrdersComponent } from './orders/orders.component'
export const routes: Routes = [
  { path: 'orders', component: OrdersComponent },
  { path: 'orders/:id', loadComponent: () => import('./orders/order-detail.component').then((m) => m.OrderDetailComponent) },
]`,
          },
        ],
        'angular',
      ),
    )

    expect(model.get('src/app/app.routes.ts')).toMatchObject({ role: 'entry' })
    expect(model.get('src/app/orders/orders.component.ts')).toMatchObject({
      role: 'page',
      route: '/orders',
      name: 'orders',
    })
    expect(model.get('src/app/orders/order-detail.component.ts')).toMatchObject({
      role: 'page',
      route: '/orders/:id',
    })
    expect(model.get('src/app/orders/orders.service.ts')).toMatchObject({ role: 'service' })
    expect(model.get('src/app/auth/auth.guard.ts')).toMatchObject({ role: 'service', name: 'auth' })
  })
})
