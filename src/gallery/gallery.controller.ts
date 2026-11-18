import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { CreateGalleryImageDto } from './dto/create-gallery-image.dto';
import { UpdateGalleryImageDto } from './dto/update-gallery-image.dto';
import { GalleryService } from './gallery.service';

class GalleryQuery {
  @IsOptional()
  @IsString()
  eventId?: string;
}

@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  // Public ─────────────────────────────────────────────────────────────────────

  // GET /api/gallery
  // GET /api/gallery?eventId=<id>
  @Get()
  list(@Query() query: GalleryQuery) {
    return this.gallery.list(query.eventId);
  }

  // Admin-only ──────────────────────────────────────────────────────────────────

  // POST /api/gallery
  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateGalleryImageDto) {
    return this.gallery.create(dto);
  }

  // PATCH /api/gallery/:id
  @Patch(':id')
  @UseGuards(AuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateGalleryImageDto) {
    return this.gallery.update(id, dto);
  }

  // DELETE /api/gallery/:id
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string) {
    return this.gallery.remove(id);
  }
}
