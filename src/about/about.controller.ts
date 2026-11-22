import { Controller, Get } from '@nestjs/common';
import { AboutService } from './about.service';

@Controller('about-images')
export class AboutController {
  constructor(private readonly about: AboutService) {}

  // GET /api/about-images — public, no auth
  @Get()
  getImages() {
    return this.about.getImages();
  }
}
