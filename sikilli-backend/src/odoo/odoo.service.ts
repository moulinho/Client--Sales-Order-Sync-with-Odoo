import { Injectable, Logger } from '@nestjs/common';
import * as xmlrpc from 'xmlrpc';

@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);
  private uid: number | null = null;

  // ── Config ────────────────────────────────────────────────────────────────

  private get host() {
    return process.env.ODOO_HOST ?? 'localhost';
  }
  private get port() {
    return parseInt(process.env.ODOO_PORT ?? '8069', 10);
  }
  private get db() {
    return process.env.ODOO_DB ?? 'odoo';
  }
  private get username() {
    return process.env.ODOO_USERNAME ?? 'admin';
  }
  private get password() {
    return process.env.ODOO_PASSWORD ?? 'admin';
  }

  // ── XML-RPC transport ─────────────────────────────────────────────────────

  /**
   * Promisified XML-RPC method call.
   * Resets the cached uid when Odoo reports an authentication error so
   * the next request will re-authenticate automatically.
   */
  private call(
    path: string,
    method: string,
    params: unknown[],
  ): Promise<unknown> {
    const useSSL = this.port === 443 || this.port === 8443;
    const clientFactory = useSSL
      ? xmlrpc.createSecureClient
      : xmlrpc.createClient;

    const client = clientFactory({
      host: this.host,
      port: this.port,
      path,
    });

    return new Promise((resolve, reject) => {
      client.methodCall(
        method,
        params as any[],
        (err: object, value: unknown) => {
          if (err) {
            const msg = (err as Error).message ?? JSON.stringify(err);
            if (msg.includes('AccessDenied') || msg.includes('session')) {
              this.uid = null;
            }
            reject(new Error(`Odoo XML-RPC error: ${msg}`));
          } else {
            resolve(value);
          }
        },
      );
    });
  }

  // ── Authentication ────────────────────────────────────────────────────────

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;

    const uid = (await this.call('/xmlrpc/2/common', 'authenticate', [
      this.db,
      this.username,
      this.password,
      {},
    ])) as number | false;

    if (!uid || typeof uid !== 'number') {
      throw new Error(
        'Odoo authentication failed — check ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD',
      );
    }
    this.uid = uid;
    this.logger.log(`Authenticated to Odoo (XML-RPC) as uid=${uid}`);
    return uid;
  }

  private async execute(
    model: string,
    method: string,
    args: unknown[],
    kwargs: object = {},
  ): Promise<unknown> {
    const uid = await this.authenticate();
    return this.call('/xmlrpc/2/object', 'execute_kw', [
      this.db,
      uid,
      this.password,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  // ── Partners (res.partner) ────────────────────────────────────────────────

  async createPartner(data: {
    name: string;
    email: string;
    phone?: string;
  }): Promise<number> {
    const id = (await this.execute('res.partner', 'create', [
      {
        name: data.name,
        email: data.email,
        phone: data.phone ?? false,
        customer_rank: 1,
      },
    ])) as number;
    this.logger.log(`Created Odoo partner id=${id}`);
    return id;
  }

  async updatePartner(
    odooId: number,
    data: { name?: string; email?: string; phone?: string | null },
  ): Promise<void> {
    const vals: Record<string, unknown> = {};
    if (data.name !== undefined) vals.name = data.name;
    if (data.email !== undefined) vals.email = data.email;
    if (data.phone !== undefined) vals.phone = data.phone ?? false;
    await this.execute('res.partner', 'write', [[odooId], vals]);
    this.logger.log(`Updated Odoo partner id=${odooId}`);
  }

  async archivePartner(odooId: number): Promise<void> {
    await this.execute('res.partner', 'write', [[odooId], { active: false }]);
    this.logger.log(`Archived Odoo partner id=${odooId}`);
  }

  // ── Sale orders (sale.order) ──────────────────────────────────────────────

  private async resolveProduct(
    productName: string,
    amount: number,
  ): Promise<number> {
    const existing = (await this.execute(
      'product.product',
      'search_read',
      [[['name', '=', productName]]],
      { fields: ['id'], limit: 1 },
    )) as { id: number }[];

    if (existing.length > 0) return existing[0].id;

    const productId = (await this.execute('product.product', 'create', [
      { name: productName, type: 'service', list_price: amount },
    ])) as number;
    this.logger.log(
      `Created Odoo product id=${productId} name="${productName}"`,
    );
    return productId;
  }

  async createSaleOrder(
    partnerId: number,
    productName: string,
    amount: number,
  ): Promise<number> {
    const productId = await this.resolveProduct(productName, amount);
    const orderId = (await this.execute('sale.order', 'create', [
      {
        partner_id: partnerId,
        order_line: [
          [
            0,
            0,
            {
              product_id: productId,
              product_uom_qty: 1,
              price_unit: amount,
              name: productName,
            },
          ],
        ],
      },
    ])) as number;
    this.logger.log(`Created Odoo sale.order id=${orderId}`);
    return orderId;
  }

  async updateSaleOrder(
    odooId: number,
    partnerId: number,
    productName: string,
    amount: number,
  ): Promise<number> {
    await this.cancelSaleOrder(odooId);
    const newId = await this.createSaleOrder(partnerId, productName, amount);
    this.logger.log(
      `Updated Odoo sale.order: cancelled id=${odooId}, created id=${newId}`,
    );
    return newId;
  }

  async cancelSaleOrder(odooId: number): Promise<void> {
    const orders = (await this.execute(
      'sale.order',
      'search_read',
      [[['id', '=', odooId]]],
      { fields: ['state'], limit: 1 },
    )) as { id: number; state: string }[];

    if (orders.length === 0) return;

    const state = orders[0].state;
    if (state === 'sale' || state === 'done') {
      await this.execute('sale.order', 'action_cancel', [[odooId]]);
    }
    await this.execute('sale.order', 'write', [[odooId], { active: false }]);
    this.logger.log(`Cancelled/archived Odoo sale.order id=${odooId}`);
  }
}
