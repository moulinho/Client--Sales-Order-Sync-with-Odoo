import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [OdooModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
