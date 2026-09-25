import { describe, expect, it } from 'vitest'
import { buildNodeApiModel } from './node'

describe('buildNodeApiModel for NestJS', () => {
  const model = buildNodeApiModel(
    [
      {
        path: 'src/main.ts',
        text: "const app = await NestFactory.create(AppModule)\napp.setGlobalPrefix('api')",
      },
      {
        path: 'src/orders/orders.controller.ts',
        text: `
@ApiTags('orders')
@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService, private logger: Logger) {}

  @Get()
  findAll() {}

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateOrderDto) {}
}`,
      },
      { path: 'src/orders/orders.service.ts', text: 'export class OrdersService {}' },
      { path: 'src/orders/dto/create-order.dto.ts', text: 'export class CreateOrderDto {}' },
      { path: 'src/auth/jwt.guard.ts', text: 'export class JwtGuard {}' },
      { path: 'src/orders/orders.controller.spec.ts', text: "@Controller('x') class X {}" },
    ],
    'nest',
  )

  it('reads controllers, their routes with the global prefix, guards and dependencies', () => {
    expect(model.resources).toHaveLength(1)
    expect(model.resources[0]).toMatchObject({
      name: 'Orders',
      route: '/api/orders',
      auth: true,
      uses: ['OrdersService', 'Logger'],
    })
    expect(model.resources[0].endpoints).toEqual([
      { verb: 'GET', route: '/api/orders', action: 'findAll', auth: true },
      { verb: 'GET', route: '/api/orders/:id', action: 'findOne', auth: false },
      { verb: 'POST', route: '/api/orders', action: 'create', auth: true },
    ])
  })

  it('sorts the other files into layers by their suffix', () => {
    expect(model.parts.map((part) => [part.name, part.kind])).toEqual([
      ['CreateOrderDto', 'model'],
      ['JwtGuard', 'middleware'],
      ['main', 'startup'],
      ['OrdersService', 'service'],
    ])
  })
})

describe('buildNodeApiModel for Express', () => {
  const model = buildNodeApiModel(
    [
      {
        path: 'server/app.ts',
        text: `
import express from 'express'
import ordersRouter from './routes/orders.js'
const app = express()
app.use('/api/orders', ordersRouter)
app.get('/health', (req, res) => res.send('ok'))
`,
      },
      {
        path: 'server/routes/orders.ts',
        text: `
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listOrders, OrderService } from '../services/orders'
const router = Router()
router.get('/', listOrders)
router.post('/', requireAuth, (req, res) => {})
router.route('/:id').get(getOrder).delete(requireAuth, removeOrder)
export default router
`,
      },
      {
        path: 'server/services/orders.ts',
        text: 'export class OrderService {}\nexport function listOrders() {}',
      },
      { path: 'server/middleware/auth.ts', text: 'export function requireAuth() {}' },
      {
        path: 'web/src/api.ts',
        text: "import axios from 'axios'\nconst api = axios.create()\napi.get('/orders')",
      },
    ],
    'express',
  )

  it('reads routers with the prefix they are mounted on', () => {
    const orders = model.resources.find((resource) => resource.name === 'orders')!

    expect(orders.route).toBe('/api/orders')
    expect(orders.endpoints).toEqual([
      { verb: 'GET', route: '/api/orders', action: 'listOrders', auth: false },
      { verb: 'POST', route: '/api/orders', action: undefined, auth: true },
      { verb: 'GET', route: '/api/orders/:id', action: 'getOrder', auth: false },
      { verb: 'DELETE', route: '/api/orders/:id', action: 'removeOrder', auth: true },
    ])
    expect(orders.uses).toEqual(['listOrders', 'OrderService'])
  })

  it('leaves out HTTP clients and front-end files', () => {
    expect(model.resources.map((resource) => resource.name)).toEqual(['app', 'orders'])
    expect(model.parts.map((part) => part.path)).toEqual([
      'server/middleware/auth.ts',
      'server/services/orders.ts',
    ])
  })
})
