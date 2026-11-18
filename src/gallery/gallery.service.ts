import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGalleryImageDto } from './dto/create-gallery-image.dto';
import { UpdateGalleryImageDto } from './dto/update-gallery-image.dto';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(eventId?: string) {
    const images = await this.prisma.galleryImage.findMany({
      where: eventId ? { eventId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return { images };
  }

  async create(dto: CreateGalleryImageDto) {
    const image = await this.prisma.galleryImage.create({
      data: {
        title: dto.title,
        url: dto.url,
        caption: dto.caption,
        eventId: dto.eventId ?? null,
      },
    });
    return { image };
  }

  async update(id: string, dto: UpdateGalleryImageDto) {
    await this.findOrThrow(id);
    const image = await this.prisma.galleryImage.update({
      where: { id },
      data: {
        title: dto.title,
        url: dto.url,
        caption: dto.caption,
        eventId: dto.eventId,
      },
    });
    return { image };
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.galleryImage.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const image = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!image) throw new NotFoundException('Gallery image not found');
    return image;
  }
}
