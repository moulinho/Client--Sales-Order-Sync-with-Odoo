# test-sikilli — NestJS API

Backend for the Sikilli project. See the [root README](../README.md) for full setup instructions, Odoo credentials, and design decisions.

## Quick start (standalone)

```bash
npm install
# create .env from the root README's template
npx prisma migrate deploy
npm run start:dev   # http://localhost:3001
```

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled output |
| `npm run test` | Unit tests |
