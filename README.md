# SaaS POS Backend

Node.js Express backend for a multi-tenant point-of-sale SaaS app. It uses PostgreSQL, Prisma, JWT authentication, and tenant-scoped queries for users, products, and sales.

## Stack

- Express + TypeScript
- PostgreSQL + Prisma
- JWT bearer authentication
- bcrypt password hashing
- Zod request validation

## Getting Started

```bash
cp .env.example .env
npm install
npm run db:up
npm run prisma:migrate
npm run dev
```

The API starts on `http://localhost:3000` by default.

Run the React POS dashboard in another terminal:

```bash
npm run web:dev
```

The dashboard starts on `http://127.0.0.1:5173` and calls the REST API at `http://localhost:3000`.

## Tenant Isolation

Authentication tokens include `tenant_id`, `tenantId`, `userId`, and `role`. Protected routes run through:

- `requireAuth`, which validates the JWT and attaches `req.auth`
- `requireTenant`, which verifies the tenant exists and attaches `req.context.tenant_id`
- route-level Prisma filters like `where: { tenantId: req.context.tenant_id }`

Writes always derive `tenantId` from the authenticated token, never from client input.

## Base Endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `GET /users`
- `POST /users`
- `GET /products`
- `POST /products`
- `PATCH /products/:id`
- `GET /sales`
- `POST /sales`

## POS Dashboard

The React dashboard includes:

- Login/register screen backed by `/auth/login` and `/auth/register`
- Product list backed by `GET /products`
- Local cart with quantity controls
- Checkout backed by `POST /sales`
- Live stock refresh after checkout and every 10 seconds

## Example Requests

Register a tenant owner:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Main Street Store",
    "tenantSlug": "main-street",
    "name": "Store Owner",
    "email": "owner@example.com",
    "password": "password123"
  }'
```

Create a product:

```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "sku": "COFFEE-001",
    "name": "Coffee",
    "priceCents": 350,
    "stock": 100
  }'
```

Create a sale:

```bash
curl -X POST http://localhost:3000/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "taxCents": 35,
    "items": [
      { "productId": "<product-id>", "quantity": 2 }
    ]
  }'
```

The sale endpoint stores the sale and sale items in one PostgreSQL transaction and deducts product stock using tenant-scoped inventory updates.
