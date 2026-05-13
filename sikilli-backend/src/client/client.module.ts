import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [OdooModule],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
