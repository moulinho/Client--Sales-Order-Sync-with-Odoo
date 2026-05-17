FROM odoo:18

# Copy custom Odoo config
COPY odoo.conf /etc/odoo/odoo.conf

# Expose the default Odoo port
EXPOSE 8069

CMD ["/usr/bin/odoo", "--config=/etc/odoo/odoo.conf"]
