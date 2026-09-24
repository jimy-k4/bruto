import { describe, expect, it } from 'vitest'
import { buildApiModel, partFor } from './dotnet'

const CONTROLLER = `
using Microsoft.AspNetCore.Mvc;

namespace Shop.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orders;

    public OrdersController(IOrderService orders, ILogger<OrdersController> logger)
    {
        _orders = orders;
    }

    // [HttpGet("commented")] must not count
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<OrderDto>>> GetAll() => Ok(await _orders.All());

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> Get(int id) => Ok(await _orders.Find(id));

    [HttpPost]
    [ProducesResponseType(201)]
    public IActionResult Create([FromBody] CreateOrderRequest request) => Created("", null);

    [Route("{id}/cancel")]
    [HttpPut]
    public IActionResult Cancel(int id) => NoContent();

    [HttpDelete("~/admin/orders/{id}")]
    public IActionResult Remove(int id) => NoContent();
}
`

const PROGRAM = `
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var products = app.MapGroup("/api/products").RequireAuthorization();
products.MapGet("/", GetProducts);
products.MapPost("/{id}/stock", (int id) => Results.Ok());

app.MapGet("/health", () => "ok");
app.Run();
`

const SOURCES = [
  { path: 'Shop.Api/Controllers/OrdersController.cs', text: CONTROLLER },
  { path: 'Shop.Api/Program.cs', text: PROGRAM },
  {
    path: 'Shop.Api/Services/OrderService.cs',
    text: 'public interface IOrderService {}\npublic class OrderService : IOrderService {}',
  },
  { path: 'Shop.Api/Data/ShopContext.cs', text: 'public class ShopContext : DbContext {}' },
  { path: 'Shop.Api/Dtos/OrderDto.cs', text: 'public record OrderDto(int Id);' },
  { path: 'Shop.Api/Middleware/ErrorMiddleware.cs', text: 'public class ErrorMiddleware {}' },
  { path: 'Shop.Tests/OrdersTests.cs', text: 'public class OrdersTests {}' },
]

describe('buildApiModel', () => {
  const model = buildApiModel(SOURCES)

  it('reads controllers: routes, verbs, actions and authorization', () => {
    const orders = model.resources.find((resource) => resource.name === 'Orders')!

    expect(orders).toMatchObject({ route: '/api/Orders', kind: 'controller', auth: true })
    expect(orders.endpoints).toEqual([
      { verb: 'GET', route: '/api/Orders', action: 'GetAll', auth: false },
      { verb: 'GET', route: '/api/Orders/{id:int}', action: 'Get', auth: true },
      { verb: 'POST', route: '/api/Orders', action: 'Create', auth: true },
      { verb: 'PUT', route: '/api/Orders/{id}/cancel', action: 'Cancel', auth: true },
      { verb: 'DELETE', route: '/admin/orders/{id}', action: 'Remove', auth: true },
    ])
  })

  it('knows what a controller depends on', () => {
    const orders = model.resources.find((resource) => resource.name === 'Orders')!

    expect(orders.uses).toEqual(['IOrderService', 'ILogger<OrdersController>'])
    expect(partFor(model.parts, 'IOrderService')?.path).toBe('Shop.Api/Services/OrderService.cs')
  })

  it('reads minimal APIs and their groups', () => {
    const products = model.resources.find((resource) => resource.route === '/api/products')!
    const loose = model.resources.find((resource) => resource.route === '/')!

    expect(products.endpoints).toEqual([
      { verb: 'GET', route: '/api/products', action: 'GetProducts', auth: true },
      { verb: 'POST', route: '/api/products/{id}/stock', action: undefined, auth: true },
    ])
    expect(loose.endpoints).toEqual([
      { verb: 'GET', route: '/health', action: undefined, auth: false },
    ])
  })

  it('sorts the other files into layers and leaves tests out', () => {
    expect(model.parts.map((part) => [part.name, part.kind])).toEqual([
      ['ErrorMiddleware', 'middleware'],
      ['IOrderService', 'service'],
      ['OrderDto', 'model'],
      ['Program', 'startup'],
      ['ShopContext', 'data'],
    ])
  })
})
