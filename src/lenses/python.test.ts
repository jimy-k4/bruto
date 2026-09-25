import { describe, expect, it } from 'vitest'
import { buildPythonApiModel } from './python'

describe('buildPythonApiModel for FastAPI', () => {
  const model = buildPythonApiModel([
    {
      path: 'app/main.py',
      text: `
from fastapi import FastAPI
from app.routers import orders

app = FastAPI()
app.include_router(orders.router, prefix="/api")

@app.get("/health")
def health():
    return "ok"
`,
    },
    {
      path: 'app/routers/orders.py',
      text: `
from fastapi import APIRouter, Depends
from app.services.orders import OrderService
from app.deps import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"])

@router.get("/")
async def list_orders(service: OrderService = Depends()):
    ...

# @router.delete("/{order_id}") is commented out
@router.post("/{order_id}/cancel")
async def cancel_order(order_id: int, user=Depends(get_current_user)):
    ...
`,
    },
    { path: 'app/services/orders.py', text: 'class OrderService:\n    pass' },
    { path: 'app/deps.py', text: 'def get_current_user():\n    pass' },
    { path: 'tests/test_orders.py', text: '@router.get("/x")\ndef test(): pass' },
  ])

  it('reads routers, the prefixes they are included with, and who needs a user', () => {
    const orders = model.resources.find((resource) => resource.name === 'orders')!

    expect(orders.route).toBe('/api/orders')
    expect(orders.endpoints).toEqual([
      { verb: 'GET', route: '/api/orders', action: 'list_orders', auth: false },
      { verb: 'POST', route: '/api/orders/{order_id}/cancel', action: 'cancel_order', auth: true },
    ])
    expect(orders.uses).toEqual(['OrderService', 'get_current_user'])
    expect(model.resources.map((resource) => resource.route)).toEqual(['/', '/api/orders'])
  })

  it('sorts the other modules into layers', () => {
    expect(model.parts.map((part) => [part.path, part.kind])).toEqual([
      ['app/deps.py', 'middleware'],
      ['app/services/orders.py', 'service'],
    ])
  })
})

describe('buildPythonApiModel for Flask', () => {
  const model = buildPythonApiModel([
    {
      path: 'shop/orders.py',
      text: `
from flask import Blueprint
from flask_login import login_required

bp = Blueprint("orders", __name__, url_prefix="/orders")

@bp.route("/", methods=["GET", "POST"])
@login_required
def orders():
    ...

@bp.get("/<int:order_id>")
def order(order_id):
    ...
`,
    },
  ])

  it('reads blueprints, their methods and login_required', () => {
    expect(model.resources[0].endpoints).toEqual([
      { verb: 'GET', route: '/orders', action: 'orders', auth: true },
      { verb: 'POST', route: '/orders', action: 'orders', auth: true },
      { verb: 'GET', route: '/orders/<int:order_id>', action: 'order', auth: false },
    ])
  })
})
