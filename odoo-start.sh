#!/bin/bash
set -e

echo "==> Checking if Odoo database needs initialization..."

# Run init in a separate pass that stops after completion (idempotent)
/usr/bin/odoo \
  --config=/etc/odoo/odoo.conf \
  --init=base \
  --without-demo=all \
  --stop-after-init \
  || echo "==> Init step finished (may already be initialized)"

echo "==> Starting Odoo HTTP server on port 8069..."
exec /usr/bin/odoo --config=/etc/odoo/odoo.conf
