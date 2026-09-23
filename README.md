# paciolidb-rail-demo

Proyecto ejemplo: un riel de pagos ficticio (ledgers `payglobal-core` y
`payglobal-railman`) corriendo **sobre PacioliDB** — el mismo bundle local o
en Cloudflare.

## Auth local

`.dev.vars` trae `AUTH_TOKEN=demo-local-token` (solo desarrollo). En
producción: `wrangler secret put AUTH_TOKEN` y `PACIOLI_TOKEN=<mismo>`.

## Correr local

```bash
bash scripts/setup.sh   # clona motor pinneado + instala deps (o ENGINE_DIR=/ruta/cljedger)
npm run dev             # worker local en :8787 (D1 local)
# otra terminal:
npm run seed && npm run demo
```

## Desplegar

```bash
npm run deploy          # wrangler deploy (pide crear D1 real la 1ra vez)
PACIOLI_API=https://<tu>.workers.dev npm run seed && PACIOLI_API=https://<tu>.workers.dev npm run demo
```

## Qué prueba (`scripts/demo.mjs`, todo verificado)

Core: funding 1000 → pago 180 + fee 5 con hold → consumo.
Riel: pending → settled 100 (intent R-1), replay sin duplicar, descuadrado rechazado.
Lecturas: trial-balance (1100/4110/1200/clearing), register con `railIntentId`, income.
