import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class UploadsService {
  private readonly env: string;

  constructor(private readonly config: ConfigService) {
    this.env = this.config.get<string>('NODE_ENV') === 'production'
      ? 'production'
      : 'development';

    cloudinary.config({
      cloud_name: this.config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    buffer: Buffer,
    type: 'event-covers' | 'avatars' = 'event-covers',
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    const folder = `event-reg/${this.env}/${type}`;

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            public_id: publicId,          // e.g. the event slug — makes URL predictable
            overwrite: true,              // re-uploading the same slug replaces the old image
            resource_type: 'image',
            transformation: [{ quality: 'auto', fetch_format: 'auto' }],
          },
          (error, result: UploadApiResponse | undefined) => {
            if (error || !result) {
              reject(
                new InternalServerErrorException(
                  error?.message ?? 'Cloudinary upload failed',
                ),
              );
              return;
            }
            resolve({ url: result.secure_url, publicId: result.public_id });
          },
        )
        .end(buffer);
    });
  }
}
