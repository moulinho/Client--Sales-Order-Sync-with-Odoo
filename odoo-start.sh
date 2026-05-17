#!/bin/bash
set -e

echo "==> Initializing Odoo database with base + sales modules..."

# Initialize base and sales management (idempotent — safe to run on every restart)
/usr/bin/odoo \
  --config=/etc/odoo/odoo.conf \
  --init=base,sale_management,contacts \
  --without-demo=all \
  --stop-after-init \
  || echo "==> Init step completed (modules may already be installed)"

echo "==> Starting Odoo HTTP server on port 8069..."
exec /usr/bin/odoo --config=/etc/odoo/odoo.conf
