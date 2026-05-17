FROM odoo:18

# Copy config and startup script
COPY odoo.conf /etc/odoo/odoo.conf
COPY odoo-start.sh /odoo-start.sh
RUN chmod +x /odoo-start.sh

# Odoo listens on 8069
EXPOSE 8069

# Initialize DB then start server
CMD ["/odoo-start.sh"]
