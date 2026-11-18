import { Body, Controller, Param, Post } from '@nestjs/common';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationsService } from './registrations.service';

@Controller('events/:slug/registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post()
  register(@Param('slug') slug: string, @Body() dto: CreateRegistrationDto) {
    return this.registrations.register(slug, dto);
  }
}
