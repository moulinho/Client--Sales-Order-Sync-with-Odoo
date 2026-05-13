import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { OdooModule } from './odoo/odoo.module';
import { ClientModule } from './client/client.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [PrismaModule, OdooModule, ClientModule, OrderModule],
  controllers: [AppController],
})
export class AppModule {}
