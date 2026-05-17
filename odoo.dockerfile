FROM odoo:18

# Copy custom Odoo config (DB settings hardcoded to avoid PORT env var conflict)
COPY odoo.conf /etc/odoo/odoo.conf

# Expose Odoo HTTP port
EXPOSE 8069

# Initialize base modules on first start, then serve
CMD ["/usr/bin/odoo", "--config=/etc/odoo/odoo.conf", "--init=base", "--without-demo=all"]
