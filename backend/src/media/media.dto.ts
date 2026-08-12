import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MediaType } from '@prisma/client';

export const CONTENT_TYPE_BY_MEDIA_TYPE: Record<MediaType, string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm'],
};

const ALLOWED_CONTENT_TYPES = Object.values(CONTENT_TYPE_BY_MEDIA_TYPE).flat();

// post = média d'une publication (clé posts/<userId>/...) ; avatar/cover = photo de profil ou de
// couverture (clés avatars|covers/<userId>/...), forcément des images. Le préfixe de clé sert de
// frontière de sécurité dans MediaService.assertUploadedObject : un avatar ne peut pas être réutilisé
// comme média de post et inversement.
export type UploadPurpose = 'post' | 'avatar' | 'cover';
const ALLOWED_PURPOSES: UploadPurpose[] = ['post', 'avatar', 'cover'];

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

  @IsOptional()
  @IsIn(ALLOWED_PURPOSES)
  purpose?: UploadPurpose;
}
