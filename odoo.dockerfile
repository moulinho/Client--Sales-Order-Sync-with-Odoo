FROM odoo:18

# Copy config
COPY odoo.conf /etc/odoo/odoo.conf

# Copy startup script with execute permission set at copy time (avoids chmod as non-root)
COPY --chmod=755 odoo-start.sh /odoo-start.sh

# Odoo listens on 8069
EXPOSE 8069

# Initialize DB then start server
CMD ["/odoo-start.sh"]
