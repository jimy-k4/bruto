import { describe, expect, it } from 'vitest'
import { buildDbModel } from './sql'

const TABLES = `
-- Customers and their orders
CREATE TABLE customers (
  id          NUMBER(10)    NOT NULL,
  name        VARCHAR2(100 CHAR) NOT NULL,
  email       VARCHAR2(200),
  CONSTRAINT customers_pk PRIMARY KEY (id)
);

CREATE TABLE "Orders" (
  id           NUMBER PRIMARY KEY,
  customer_id  NUMBER NOT NULL REFERENCES customers (id),
  total        NUMBER(12,2) DEFAULT 0 CHECK (total >= 0),
  created_at   DATE DEFAULT SYSDATE
);

CREATE TABLE order_lines (
  order_id   NUMBER,
  line_no    NUMBER,
  product_id NUMBER,
  CONSTRAINT order_lines_pk PRIMARY KEY (order_id, line_no),
  CONSTRAINT order_lines_order_fk FOREIGN KEY (order_id) REFERENCES "Orders" (id)
);

CREATE TABLE products (id NUMBER PRIMARY KEY, name VARCHAR2(50));

ALTER TABLE order_lines ADD CONSTRAINT order_lines_product_fk
  FOREIGN KEY (product_id) REFERENCES products (id);

CREATE SEQUENCE orders_seq START WITH 1;
`

const PACKAGE_SPEC = `
CREATE OR REPLACE EDITIONABLE PACKAGE sales.pkg_orders AUTHID DEFINER AS
  PROCEDURE create_order(p_customer IN customers.id%TYPE);
  FUNCTION order_total(p_order IN NUMBER) RETURN NUMBER;
END pkg_orders;
/
`

const PACKAGE_BODY = `
CREATE OR REPLACE PACKAGE BODY sales.pkg_orders AS
  /* private helper */
  PROCEDURE log_change(p_text VARCHAR2) IS BEGIN NULL; END;

  PROCEDURE create_order(p_customer IN customers.id%TYPE) IS
  BEGIN
    INSERT INTO "Orders" (id, customer_id) VALUES (orders_seq.NEXTVAL, p_customer);
    log_change('created');
  END;

  FUNCTION order_total(p_order IN NUMBER) RETURN NUMBER IS
    v_total NUMBER;
  BEGIN
    SELECT SUM(1) INTO v_total FROM order_lines l, products p WHERE l.product_id = p.id;
    RETURN v_total;
  END;
END pkg_orders;
/
CREATE OR REPLACE VIEW v_customer_orders AS
  SELECT c.name, o.total FROM customers c JOIN "Orders" o ON o.customer_id = c.id;

CREATE OR REPLACE TRIGGER trg_orders_audit
  BEFORE UPDATE ON "Orders" FOR EACH ROW
BEGIN
  :NEW.created_at := SYSDATE;
END;
/
`

describe('buildDbModel', () => {
  const model = buildDbModel([
    { path: 'db/tables.sql', text: TABLES },
    // The body is read before the specification on purpose.
    { path: 'db/pkg_orders.pkb', text: PACKAGE_BODY },
    { path: 'db/pkg_orders.pks', text: PACKAGE_SPEC },
    { path: 'README.md', text: 'CREATE TABLE ignored (id NUMBER);' },
  ])

  it('reads tables, columns and primary keys', () => {
    expect(model.tables.map((table) => table.name)).toEqual([
      'CUSTOMERS',
      'ORDER_LINES',
      'Orders',
      'PRODUCTS',
    ])

    const customers = model.tables.find((table) => table.name === 'CUSTOMERS')!

    expect(customers.columns).toEqual([
      { name: 'ID', type: 'NUMBER(10)', primaryKey: true, nullable: false },
      { name: 'NAME', type: 'VARCHAR2(100 CHAR)', primaryKey: false, nullable: false },
      { name: 'EMAIL', type: 'VARCHAR2(200)', primaryKey: false, nullable: true },
    ])
    expect(
      model.tables
        .find((table) => table.name === 'ORDER_LINES')!
        .columns.filter((column) => column.primaryKey)
        .map((column) => column.name),
    ).toEqual(['ORDER_ID', 'LINE_NO'])
  })

  it('finds foreign keys inline, as constraints and added later', () => {
    expect(model.relations).toEqual([
      { from: 'Orders', fromColumns: ['CUSTOMER_ID'], to: 'CUSTOMERS', toColumns: ['ID'] },
      { from: 'ORDER_LINES', fromColumns: ['ORDER_ID'], to: 'Orders', toColumns: ['ID'] },
      { from: 'ORDER_LINES', fromColumns: ['PRODUCT_ID'], to: 'PRODUCTS', toColumns: ['ID'] },
    ])
  })

  it('joins a package specification and body, and tells public from private', () => {
    const pkg = model.programs.find((program) => program.kind === 'package')!

    expect(pkg).toMatchObject({
      name: 'PKG_ORDERS',
      hasSpec: true,
      hasBody: true,
      paths: ['db/pkg_orders.pkb', 'db/pkg_orders.pks'],
      tables: ['CUSTOMERS', 'ORDER_LINES', 'Orders', 'PRODUCTS'],
    })
    expect(pkg.members).toEqual([
      { kind: 'procedure', name: 'LOG_CHANGE', public: false },
      { kind: 'procedure', name: 'CREATE_ORDER', public: true },
      { kind: 'function', name: 'ORDER_TOTAL', public: true },
    ])
  })

  it('reads views, triggers and sequences', () => {
    const find = (kind: string) => model.programs.find((program) => program.kind === kind)

    expect(find('view')).toMatchObject({
      name: 'V_CUSTOMER_ORDERS',
      tables: ['CUSTOMERS', 'Orders'],
    })
    expect(find('trigger')).toMatchObject({ name: 'TRG_ORDERS_AUDIT', on: 'Orders' })
    expect(find('sequence')).toMatchObject({ name: 'ORDERS_SEQ', paths: ['db/tables.sql'] })
  })
})

describe('buildDbModel for PostgreSQL migrations', () => {
  const migrations = [
    {
      path: 'supabase/migrations/20260101_init.sql',
      text: `
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz default now()
);

create table public.bookings (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id),
  starts_at timestamptz not null
);

alter table public.profiles enable row level security;

create policy "Users read their own profile" on public.profiles
  for select using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username) values (new.id, new.email);
  return new;
end;
$$;

alter table public.bookings add column notes text;
`,
    },
    {
      path: 'supabase/migrations/20260201_more.sql',
      text: `
alter table only public.bookings
  add column if not exists status text default 'pending',
  drop column notes;

create policy "Users read their own profile" on public.bookings for all using (true);
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();
`,
    },
  ]
  const model = buildDbModel(migrations, 'postgres')

  it('keeps PostgreSQL names in lower case and follows the migrations in order', () => {
    expect(model.tables.map((table) => table.name)).toEqual(['bookings', 'profiles'])
    expect(model.tables[0].columns.map((column) => column.name)).toEqual([
      'id',
      'profile_id',
      'starts_at',
      'status',
    ])
    expect(model.relations).toEqual([
      { from: 'bookings', fromColumns: ['profile_id'], to: 'profiles', toColumns: ['id'] },
    ])
  })

  it('marks row level security and lists policies per table', () => {
    expect(model.tables.find((table) => table.name === 'profiles')?.rls).toBe(true)
    expect(model.tables.find((table) => table.name === 'bookings')?.rls).toBeUndefined()
    expect(
      model.programs
        .filter((program) => program.kind === 'policy')
        .map((policy) => [policy.name, policy.on, policy.command]),
    ).toEqual([
      ['Users read their own profile', 'bookings', 'all'],
      ['Users read their own profile', 'profiles', 'select'],
    ])
  })

  it('reads dollar-quoted functions without swallowing what follows', () => {
    const find = (kind: string) => model.programs.find((program) => program.kind === kind)

    expect(find('function')).toMatchObject({ name: 'handle_new_user', tables: ['profiles'] })
    expect(find('trigger')).toMatchObject({ name: 'on_auth_user_created', on: 'users' })
  })
})
