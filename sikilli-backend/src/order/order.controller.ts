import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrderService } from './order.service';

function validateCreateOrder(body: unknown): {
  clientId: number;
  productName: string;
  amount: number;
} {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Invalid request body');
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const clientId = Number(b.clientId);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    errors.push('clientId must be a positive integer');
  }

  const productName =
    typeof b.productName === 'string' ? b.productName.trim() : '';
  if (!productName) errors.push('productName is required');
  else if (productName.length > 150)
    errors.push('productName must be 150 characters or fewer');

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('amount must be a positive number');
  }

  if (errors.length) throw new BadRequestException(errors);
  return { clientId, productName, amount };
}

function validateUpdateOrder(body: unknown): {
  productName?: string;
  amount?: number;
} {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Invalid request body');
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];
  const out: { productName?: string; amount?: number } = {};

  if (b.productName !== undefined) {
    const productName =
      typeof b.productName === 'string' ? b.productName.trim() : '';
    if (!productName) errors.push('productName cannot be empty');
    else if (productName.length > 150)
      errors.push('productName must be 150 characters or fewer');
    else out.productName = productName;
  }

  if (b.amount !== undefined) {
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push('amount must be a positive number');
    } else {
      out.amount = amount;
    }
  }

  if (errors.length) throw new BadRequestException(errors);
  return out;
}

@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    const data = validateCreateOrder(body);
    return this.orderService.create(data);
  }

  @Get()
  findAll() {
    return this.orderService.findAll();
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const data = validateUpdateOrder(body);
    return this.orderService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.remove(id);
  }

  @Post(':id/sync')
  retrySync(@Param('id', ParseIntPipe) id: number) {
    return this.orderService.retrySync(id);
  }
}
