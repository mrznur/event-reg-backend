import { Injectable } from '@nestjs/common';
import { AboutImageKey } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

const KEYS = Object.values(AboutImageKey) as AboutImageKey[];

@Injectable()
export class AboutService {
  constructor(private readonly prisma: PrismaService) {}

  async getImages() {
    const rows = await this.prisma.aboutImage.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, { url: r.url, alt: r.alt }]));

    // Ensure all four keys are always present, even if a row is missing.
    const images = Object.fromEntries(
      KEYS.map((key) => [key, map[key] ?? { url: '', alt: `BUCC ${key}` }]),
    );

    return { images };
  }
}
