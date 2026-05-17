import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '../../generated/prisma/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { OdooService } from '../odoo/odoo.service';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    private prisma: PrismaService,
    private odoo: OdooService,
  ) {}

  async create(data: { name: string; email: string; phone?: string }) {
    let client;
    try {
      client = await this.prisma.client.create({
        data: { name: data.name, email: data.email, phone: data.phone },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A client with email "${data.email}" already exists`);
      }
      throw err;
    }

    let odooWarning: string | null = null;
    try {
      const odooPartnerId = await this.odoo.createPartner(data);
      await this.prisma.client.update({
        where: { id: client.id },
        data: { odooPartnerId },
      });
      client.odooPartnerId = odooPartnerId;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      this.logger.error(
        `Odoo sync failed for client id=${client.id}: ${msg}`,
      );
      odooWarning = `Odoo sync failed: ${msg}`;
    }

    return { ...client, odooWarning };
  }

  async update(
    id: number,
    data: { name?: string; email?: string; phone?: string | null },
  ) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException(`Client ${id} not found`);

    let updated;
    try {
      updated = await this.prisma.client.update({ where: { id }, data });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`A client with email "${data.email}" already exists`);
      }
      throw err;
    }

    let odooWarning: string | null = null;
    if (client.odooPartnerId) {
      try {
        await this.odoo.updatePartner(client.odooPartnerId, data);
      } catch (err) {
        this.logger.error(
          `Odoo update failed for client id=${id}: ${(err as Error).message}`,
        );
        odooWarning = 'Odoo sync failed — check server logs for details';
      }
    } else {
      // Not yet in Odoo — attempt first sync
      try {
        const odooPartnerId = await this.odoo.createPartner({
          name: updated.name,
          email: updated.email,
          phone: updated.phone ?? undefined,
        });
        await this.prisma.client.update({
          where: { id },
          data: { odooPartnerId },
        });
        updated.odooPartnerId = odooPartnerId;
      } catch (err) {
        this.logger.error(
          `Odoo sync failed for client id=${id}: ${(err as Error).message}`,
        );
        odooWarning = 'Odoo sync failed — check server logs for details';
      }
    }

    return { ...updated, odooWarning };
  }

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { odooOrders: true },
    });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    if (client.odooOrders.length > 0) {
      throw new BadRequestException(
        `Cannot delete client with existing orders — delete orders first`,
      );
    }

    await this.prisma.client.delete({ where: { id } });

    if (client.odooPartnerId) {
      try {
        await this.odoo.archivePartner(client.odooPartnerId);
      } catch (err) {
        this.logger.error(
          `Odoo archive failed for client id=${id}: ${(err as Error).message}`,
        );
      }
    }
  }

  async retrySync(id: number) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    if (client.odooPartnerId) {
      return { ...client, odooWarning: null }; // already synced
    }

    let odooWarning: string | null = null;
    try {
      const odooPartnerId = await this.odoo.createPartner({
        name: client.name,
        email: client.email,
        phone: client.phone ?? undefined,
      });
      await this.prisma.client.update({
        where: { id },
        data: { odooPartnerId },
      });
      client.odooPartnerId = odooPartnerId;
    } catch (err) {
      this.logger.error(
        `Odoo retry sync failed for client id=${id}: ${(err as Error).message}`,
      );
      odooWarning = 'Odoo sync failed — check server logs for details';
    }

    return { ...client, odooWarning };
  }

  findAll() {
    return this.prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
