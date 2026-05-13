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
import { ClientService } from './client.service';

function validateCreateClient(body: unknown): {
  name: string;
  email: string;
  phone?: string;
} {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Invalid request body');
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) errors.push('name is required');
  else if (name.length > 100) errors.push('name must be 100 characters or fewer');

  const email =
    typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email) errors.push('email is required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('email is invalid');
  else if (email.length > 150)
    errors.push('email must be 150 characters or fewer');

  let phone: string | undefined;
  if (b.phone !== undefined && b.phone !== null && b.phone !== '') {
    const raw = typeof b.phone === 'string' ? b.phone.trim() : '';
    if (raw.length > 30) errors.push('phone must be 30 characters or fewer');
    else phone = raw;
  }

  if (errors.length) throw new BadRequestException(errors);
  return { name, email, phone };
}

function validateUpdateClient(body: unknown): {
  name?: string;
  email?: string;
  phone?: string | null;
} {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Invalid request body');
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];
  const out: { name?: string; email?: string; phone?: string | null } = {};

  if (b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name) errors.push('name cannot be empty');
    else if (name.length > 100) errors.push('name must be 100 characters or fewer');
    else out.name = name;
  }

  if (b.email !== undefined) {
    const email =
      typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!email) errors.push('email cannot be empty');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push('email is invalid');
    else if (email.length > 150)
      errors.push('email must be 150 characters or fewer');
    else out.email = email;
  }

  if ('phone' in b) {
    if (b.phone === null || b.phone === '') {
      out.phone = null;
    } else {
      const raw = typeof b.phone === 'string' ? b.phone.trim() : '';
      if (raw.length > 30) errors.push('phone must be 30 characters or fewer');
      else out.phone = raw;
    }
  }

  if (errors.length) throw new BadRequestException(errors);
  return out;
}

@Controller('clients')
export class ClientController {
  constructor(private clientService: ClientService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    const data = validateCreateClient(body);
    return this.clientService.create(data);
  }

  @Get()
  findAll() {
    return this.clientService.findAll();
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const data = validateUpdateClient(body);
    return this.clientService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientService.remove(id);
  }

  @Post(':id/sync')
  retrySync(@Param('id', ParseIntPipe) id: number) {
    return this.clientService.retrySync(id);
  }
}
