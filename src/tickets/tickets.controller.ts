import { Controller, Get, Param } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // GET /api/tickets/:code — public, no auth required
  @Get(':code')
  getByCode(@Param('code') code: string) {
    return this.tickets.getByCode(code);
  }
}
