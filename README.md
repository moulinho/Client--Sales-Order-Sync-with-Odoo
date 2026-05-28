# Client & Sales Order Sync with Odoo

A full-stack application that manages clients and sale orders locally and automatically syncs every action to an Odoo 18 instance via the **XML-RPC API** — no double entry.

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────┐        ┌───────────────┐
│  Next.js 15         │  proxy │  NestJS 11           │  RPC   │  Odoo 18      │
│  (frontend)         │ ──────▶│  (API + business     │ ──────▶│  (XML-RPC     │
│  localhost:3000     │        │   logic + Prisma ORM)│        │   /xmlrpc/2/) │
└─────────────────────┘        └──────────────────────┘        └───────────────┘
                                         │
                                         ▼
                                  PostgreSQL 15
                                  (shared with Odoo)
```

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL 15 + Prisma ORM |
| Odoo integration | Odoo XML-RPC API (`/xmlrpc/2/`) |
| Container | Docker + Docker Compose |

---

## How to Run the Project

### Full stack — one command (recommended)

```bash
docker compose up --build
```

This starts four services:

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| NestJS API | http://localhost:3001 |
| Odoo 18 | http://localhost:8069 |
| PostgreSQL | localhost:5432 |

**First boot takes ~90 seconds.** Odoo initialises the `skilli` database and installs the Sales module automatically. The backend waits for PostgreSQL to be healthy before running migrations and starting.

---

### Run locally (without Docker for the app)

**Step 1 — start PostgreSQL and Odoo via Docker:**

```bash
docker compose up db odoo -d
```

Wait for Odoo to be ready:
```bash
docker compose ps   # db should show "(healthy)"
```

**Step 2 — configure and start the NestJS backend:**

```bash
cd sikilli-backend
npm install
cp .env.example .env
```

The `.env.example` values already match the Docker services — no edits needed if you use the default setup



Run migrations and start the dev server:

```bash
npx prisma migrate deploy
npm run start:dev
```

**Step 3 — start the Next.js frontend:**

```bash
cd sikilli-frontend
yarn install
yarn dev
```

Open **http://localhost:3000**.

---
|

These credentials are set automatically by the Docker Compose configuration — no manual Odoo setup is required.

To verify synced data directly:
- **Contacts** → find any client created through the app
- **Sales → Orders** → find orders linked to their respective partners

---

## API Endpoints

### Clients

| Method | Path | Description | Odoo sync |
|---|---|---|---|
| `POST` | `/clients` | Create a client | Creates `res.partner` |
| `GET` | `/clients` | List all clients | — |
| `PATCH` | `/clients/:id` | Update a client | Updates `res.partner` |
| `DELETE` | `/clients/:id` | Delete a client | Archives `res.partner` |
| `POST` | `/clients/:id/sync` | Retry failed Odoo sync | Creates `res.partner` |

### Orders

| Method | Path | Description | Odoo sync |
|---|---|---|---|
| `POST` | `/orders` | Create an order | Creates `sale.order` |
| `GET` | `/orders` | List all orders | — |
| `PATCH` | `/orders/:id` | Update an order | Replaces `sale.order` |
| `DELETE` | `/orders/:id` | Delete an order | Cancels `sale.order` |
| `POST` | `/orders/:id/sync` | Retry failed Odoo sync | Creates `sale.order` |

---

## Odoo Objects Used and Why

### `res.partner` — clients

Odoo's universal contact model. Every customer, supplier, and contact in Odoo is a `res.partner`. Using it makes each client immediately visible in Contacts, Sales, and Invoicing without extra configuration, and it is the required type for the `partner_id` field on a sale order.

Fields written: `name`, `email`, `phone`, `active`.

### `sale.order` — orders

The standard Odoo sales document. It carries the partner reference (`partner_id`) and one or more order lines. This is the correct object for recording a sale — it feeds into invoicing, stock, and reporting automatically.

Fields written: `partner_id`, `order_line` (via the ORM create command `[0, 0, {...}]`).

### `sale.order.line` — order lines

Every `sale.order` requires at least one line with a product, quantity, and unit price. The app creates one line per order (quantity = 1, price = the submitted amount).

### `product.product` — products

Odoo requires a real product record on each order line. The app searches for an existing product by name; if none exists, it creates a `service`-type product on the fly. Service products have no stock tracking requirement, making them the lightest valid choice for arbitrary product names entered by the user.

---

## Local Data Model

```
Client
  id            Int      PK, autoincrement
  name          String
  email         String   unique
  phone         String?
  odooPartnerId Int?     unique — Odoo res.partner id (null = sync pending)
  createdAt     DateTime

Order
  id            Int      PK, autoincrement
  productName   String
  amount        Float
  odooOrderId   Int?     Odoo sale.order id (null = sync pending)
  clientId      Int      FK → Client
  createdAt     DateTime
```

`odooPartnerId` and `odooOrderId` being `null` signals a pending or failed Odoo sync. The frontend shows a **"pending"** badge on those rows and a **Sync** button to retry.

---

## Assumptions and Simplifications

- **Single Odoo account.** All Odoo calls use one admin account from environment variables. There is no per-user auth against Odoo.
- **UID caching.** The Odoo session UID is cached in memory after the first successful login. If Odoo returns an auth error, the cache is cleared and the next request re-authenticates automatically.
- **Order updates replace the Odoo order.** Editing a confirmed sale order in Odoo requires cancelling it first and returning it to draft — a flow that varies with module configuration. Instead, the app cancels the old order, archives it, and creates a new one, updating `odooOrderId` in the local database.
- **Auto-sync client on order create.** If an order is created for a client whose initial Odoo sync failed, the app syncs the client to Odoo automatically before creating the order — no manual retry needed.
- **Client deletion is guarded.** Deleting a client that has existing orders returns HTTP 400. Orders must be deleted first.
- **Duplicate email returns 409.** Attempting to create a client with an email that already exists returns a clear `409 Conflict` response instead of a raw database error.
- **No app-level authentication.** The application has no login system and is intended as an internal-tool demo.
- **No pagination.** All clients and orders are returned in a single list, ordered by creation date descending.
- **Shared PostgreSQL instance.** The app and Odoo share the same PostgreSQL container. The app uses the default `postgres` database; Odoo creates and uses its own `skilli` database on the same server.

---

## Error Handling

- If Odoo is unreachable or returns an error, the record is still saved locally — no data is lost.
- The full error is logged server-side via NestJS `Logger`.
- The client receives a human-readable message (`"Odoo sync failed — check server logs for details"`). No stack traces or internal Odoo details are exposed.
- Input validation errors return HTTP 400 with a structured list of field-level messages.
- Duplicate email returns HTTP 409 with a specific message.

---

## What I Would Improve with More Time

1. **Automatic sync retry queue.** Use BullMQ or a scheduled cron job to retry records where `odooPartnerId` or `odooOrderId` is `null`, with exponential backoff. Add a `syncStatus` column (`pending` / `synced` / `error`) so the UI can reflect the exact state rather than just "null = pending".

2. **Authentication.** Add JWT-based login to protect all mutating endpoints with a `JwtAuthGuard`. Without it the app is only suitable for a trusted internal network.

3. **Bidirectional sync.** Poll Odoo's `write_date` field periodically to pull state changes back (order confirmed, partner archived) and keep the local database consistent with Odoo.

4. **Pagination.** Replace the full-list responses with cursor-based pagination on `GET /clients` and `GET /orders` to support large datasets.

5. **Swagger / OpenAPI.** Add `@nestjs/swagger` to auto-generate interactive API documentation for reviewers and future integrators.

6. **End-to-end tests.** Integration tests that spin up a real Odoo instance (or a controlled mock) and verify the full sync flow — create, update, delete, and retry — including network failure scenarios.

7. **Health endpoint.** Expose `GET /health` on the NestJS API that verifies both the database connection and Odoo reachability, enabling more precise Docker and load-balancer health checks.
