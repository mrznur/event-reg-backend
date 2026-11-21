import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactDto } from './contact.dto';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  // POST /api/contact — 3 submissions per minute per IP
  @Post()
  @HttpCode(200)
  @Throttle({ global: { ttl: 60_000, limit: 3 } })
  send(@Body() dto: ContactDto) {
    return this.contact.send(dto);
  }
}
