/** A small project with a Next.js front, a .NET API and an Oracle schema, for the lens tests. */
export const LENS_PROJECT: Record<string, string> = {
  'web/package.json': '{ "dependencies": { "next": "15.0.0", "react": "19.0.0" } }',
  'web/app/layout.tsx':
    "import Header from './components/Header'\nexport default function Layout() {}",
  'web/app/page.tsx':
    "import Hero from './components/Hero'\nimport ProductCard from './components/ProductCard'\nexport default function Home() {}",
  'web/app/products/[id]/page.tsx':
    "import ProductCard from '../../components/ProductCard'\nimport Price from '../../components/Price'\nimport { useCart } from '../../hooks/useCart'",
  'web/app/cart/page.tsx':
    "import Price from '../components/Price'\nimport { useCart } from '../hooks/useCart'",
  'web/app/api/orders/route.ts': 'export async function POST() {}',
  'web/app/components/Header.tsx': '',
  'web/app/components/Hero.tsx': '',
  'web/app/components/ProductCard.tsx': "import Price from './Price'",
  'web/app/components/Price.tsx': '',
  'web/app/hooks/useCart.ts': '',
  'web/app/globals.css': '',
  'web/public/logo.svg': '',
  'api/Shop.Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
  'api/Program.cs': `var app = builder.Build();
var products = app.MapGroup("/api/products");
products.MapGet("/", GetProducts);
products.MapGet("/{id}", GetProduct);
app.MapGet("/health", () => "ok");`,
  'api/Controllers/OrdersController.cs': `[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    public OrdersController(IOrderService orders) {}
    [HttpGet] public IActionResult List() => Ok();
    [HttpGet("{id}")] public IActionResult Get(int id) => Ok();
    [HttpPost] public IActionResult Create(OrderDto dto) => Ok();
    [HttpDelete("{id}")] public IActionResult Cancel(int id) => Ok();
}`,
  'api/Controllers/CustomersController.cs': `[ApiController]
[Route("api/customers")]
public class CustomersController(ICustomerService customers) : ControllerBase
{
    [HttpGet] public IActionResult List() => Ok();
    [HttpPut("{id}")] [Authorize] public IActionResult Update(int id) => Ok();
}`,
  'api/Services/OrderService.cs':
    'public interface IOrderService {}\npublic class OrderService : IOrderService {}',
  'api/Services/CustomerService.cs':
    'public interface ICustomerService {}\npublic class CustomerService : ICustomerService {}',
  'api/Data/ShopContext.cs': 'public class ShopContext : DbContext {}',
  'api/Dtos/OrderDto.cs': 'public record OrderDto(int Id);',
  'db/tables.sql': `CREATE TABLE customers (id NUMBER PRIMARY KEY, name VARCHAR2(100) NOT NULL, email VARCHAR2(200));
CREATE TABLE orders (id NUMBER PRIMARY KEY, customer_id NUMBER REFERENCES customers(id), total NUMBER(12,2), created_at DATE);
CREATE TABLE products (id NUMBER PRIMARY KEY, name VARCHAR2(100), price NUMBER(10,2));
CREATE TABLE order_lines (order_id NUMBER, line_no NUMBER, product_id NUMBER,
  CONSTRAINT order_lines_pk PRIMARY KEY (order_id, line_no),
  CONSTRAINT ol_order_fk FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT ol_product_fk FOREIGN KEY (product_id) REFERENCES products (id));
CREATE SEQUENCE orders_seq;`,
  'db/pkg_orders.pks': `CREATE OR REPLACE PACKAGE pkg_orders AS
  PROCEDURE create_order(p_customer customers.id%TYPE);
  FUNCTION order_total(p_order NUMBER) RETURN NUMBER;
END;
/`,
  'db/pkg_orders.pkb': `CREATE OR REPLACE PACKAGE BODY pkg_orders AS
  PROCEDURE log_it IS BEGIN NULL; END;
  PROCEDURE create_order(p_customer customers.id%TYPE) IS BEGIN INSERT INTO orders (id) VALUES (orders_seq.NEXTVAL); END;
  FUNCTION order_total(p_order NUMBER) RETURN NUMBER IS v NUMBER; BEGIN SELECT SUM(1) INTO v FROM order_lines; RETURN v; END;
END;
/`,
  'db/pkg_stock.pks': `CREATE OR REPLACE PACKAGE pkg_stock AS
  PROCEDURE reserve(p_product NUMBER);
END;
/`,
  'db/views.sql': `CREATE OR REPLACE VIEW v_customer_orders AS SELECT c.name, o.total FROM customers c JOIN orders o ON o.customer_id = c.id;
CREATE OR REPLACE TRIGGER trg_orders_bi BEFORE INSERT ON orders FOR EACH ROW BEGIN NULL; END;
/`,
}

/** Writes files into the test project folder (browser private file system). */
export const writeProjectFiles = async (files: Record<string, string>) => {
  const root = await navigator.storage.getDirectory()
  const project = await root.getDirectoryHandle('demo')

  for (const [path, text] of Object.entries(files)) {
    const parts = path.split('/')
    let directory = project

    for (const part of parts.slice(0, -1)) {
      directory = await directory.getDirectoryHandle(part, { create: true })
    }

    const writable = await (
      await directory.getFileHandle(parts.at(-1)!, { create: true })
    ).createWritable()
    await writable.write(text)
    await writable.close()
  }
}
