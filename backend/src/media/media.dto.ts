import { IsEnum, IsIn, IsInt, Max, Min } from 'class-validator';
import { MediaType } from '@prisma/client';

export const CONTENT_TYPE_BY_MEDIA_TYPE: Record<MediaType, string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm'],
};

const ALLOWED_CONTENT_TYPES = Object.values(CONTENT_TYPE_BY_MEDIA_TYPE).flat();

export class CreateUploadUrlDto {
  @IsEnum(MediaType)
  mediaType!: MediaType;

  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: string;

  // Borne haute large (taille vidéo max) ; la limite précise par type est appliquée dans le service.
  @IsInt()
  @Min(1)
  @Max(200 * 1024 * 1024)
  sizeBytes!: number;
}
