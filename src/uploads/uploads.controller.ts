import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../generated/prisma/enums';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(AuthGuard, RoleGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('slug') slug?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const result = await this.uploads.uploadImage(
      file.buffer,
      'event-covers',
      slug || undefined,
    );
    return { url: result.url };
  }
}
