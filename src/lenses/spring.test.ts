import { describe, expect, it } from 'vitest'
import { buildSpringApiModel } from './spring'

describe('buildSpringApiModel', () => {
  const model = buildSpringApiModel([
    {
      path: 'src/main/java/shop/web/OrderController.java',
      text: `
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;

    @GetMapping
    public List<OrderDto> list() { return orderService.all(); }

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable Long id) { return null; }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping(value = "/{id}")
    public void delete(@PathVariable Long id) {}

    @RequestMapping(path = "/{id}/cancel", method = RequestMethod.POST)
    public ResponseEntity<Void> cancel(@PathVariable Long id) { return null; }
}`,
    },
    {
      path: 'src/main/java/shop/service/OrderService.java',
      text: '@Service\npublic class OrderService {}',
    },
    {
      path: 'src/main/java/shop/repo/OrderRepository.java',
      text: 'public interface OrderRepository extends JpaRepository<Order, Long> {}',
    },
    {
      path: 'src/main/java/shop/model/Order.java',
      text: '@Entity\npublic class Order {}',
    },
    {
      path: 'src/main/java/shop/ShopApplication.java',
      text: '@SpringBootApplication\npublic class ShopApplication {}',
    },
    { path: 'src/test/java/shop/OrderControllerTest.java', text: '@RestController class X {}' },
  ])

  it('reads controllers, their mappings, security and injected services', () => {
    expect(model.resources).toHaveLength(1)
    expect(model.resources[0]).toMatchObject({
      name: 'Order',
      route: '/api/orders',
      auth: false,
      uses: ['OrderService'],
    })
    expect(model.resources[0].endpoints).toEqual([
      { verb: 'GET', route: '/api/orders', action: 'list', auth: false },
      { verb: 'GET', route: '/api/orders/{id}', action: 'get', auth: false },
      { verb: 'DELETE', route: '/api/orders/{id}', action: 'delete', auth: true },
      { verb: 'POST', route: '/api/orders/{id}/cancel', action: 'cancel', auth: false },
    ])
  })

  it('sorts the other classes into layers by their annotations', () => {
    expect(model.parts.map((part) => [part.name, part.kind])).toEqual([
      ['Order', 'model'],
      ['OrderRepository', 'repository'],
      ['OrderService', 'service'],
      ['ShopApplication', 'startup'],
    ])
  })
})
