import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Client } from '../../generated/prisma';
import { OdooService } from '../odoo/odoo.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private odoo: OdooService,
  ) {}

  /**
   * Returns the Odoo partner id for the client, syncing them to Odoo first
   * if they have not been synced yet. Throws if Odoo is unreachable.
   */
  private async ensureClientSynced(client: Client): Promise<number> {
    if (client.odooPartnerId) return client.odooPartnerId;

    this.logger.log(
      `Client id=${client.id} not in Odoo yet — syncing automatically`,
    );
    const odooPartnerId = await this.odoo.createPartner({
      name: client.name,
      email: client.email,
      phone: client.phone ?? undefined,
    });
    await this.prisma.client.update({
      where: { id: client.id },
      data: { odooPartnerId },
    });
    client.odooPartnerId = odooPartnerId;
    this.logger.log(
      `Auto-synced client id=${client.id} → Odoo partner id=${odooPartnerId}`,
    );
    return odooPartnerId;
  }

  async create(data: {
    clientId: number;
    productName: string;
    amount: number;
  }) {
    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!client) throw new NotFoundException(`Client ${data.clientId} not found`);

    const order = await this.prisma.order.create({
      data: {
        clientId: data.clientId,
        productName: data.productName,
        amount: data.amount,
      },
    });

    let odooWarning: string | null = null;
    try {
      const partnerId = await this.ensureClientSynced(client);
      const odooOrderId = await this.odoo.createSaleOrder(
        partnerId,
        data.productName,
        data.amount,
      );
      await this.prisma.order.update({
        where: { id: order.id },
        data: { odooOrderId },
      });
      order.odooOrderId = odooOrderId;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      this.logger.error(
        `Odoo sync failed for order id=${order.id}: ${msg}`,
      );
      odooWarning = `Odoo sync failed: ${msg}`;
    }

    return { ...order, odooWarning };
  }

  async update(
    id: number,
    data: { productName?: string; amount?: number },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const updated = await this.prisma.order.update({ where: { id }, data });

    let odooWarning: string | null = null;
    try {
      const partnerId = await this.ensureClientSynced(order.client);
      if (order.odooOrderId) {
        const newOdooId = await this.odoo.updateSaleOrder(
          order.odooOrderId,
          partnerId,
          updated.productName,
          updated.amount,
        );
        await this.prisma.order.update({
          where: { id },
          data: { odooOrderId: newOdooId },
        });
        updated.odooOrderId = newOdooId;
      } else {
        const odooOrderId = await this.odoo.createSaleOrder(
          partnerId,
          updated.productName,
          updated.amount,
        );
        await this.prisma.order.update({
          where: { id },
          data: { odooOrderId },
        });
        updated.odooOrderId = odooOrderId;
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      this.logger.error(
        `Odoo sync failed for order id=${id}: ${msg}`,
      );
      odooWarning = `Odoo sync failed: ${msg}`;
    }

    return { ...updated, odooWarning };
  }

  async remove(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    await this.prisma.order.delete({ where: { id } });

    if (order.odooOrderId) {
      try {
        await this.odoo.cancelSaleOrder(order.odooOrderId);
      } catch (err) {
        this.logger.error(
          `Odoo cancel failed for order id=${id}: ${(err as Error).message}`,
        );
      }
    }
  }

  async retrySync(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.odooOrderId) {
      return { ...order, odooWarning: null }; // already synced
    }

    let odooWarning: string | null = null;
    try {
      const partnerId = await this.ensureClientSynced(order.client);
      const odooOrderId = await this.odoo.createSaleOrder(
        partnerId,
        order.productName,
        order.amount,
      );
      await this.prisma.order.update({
        where: { id },
        data: { odooOrderId },
      });
      order.odooOrderId = odooOrderId;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      this.logger.error(
        `Odoo retry sync failed for order id=${id}: ${msg}`,
      );
      odooWarning = `Odoo sync failed: ${msg}`;
    }

    return { ...order, odooWarning };
  }

  findAll() {
    return this.prisma.order.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
