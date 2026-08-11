import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { MediaType } from '@prisma/client';
import { CONTENT_TYPE_BY_MEDIA_TYPE, CreateUploadUrlDto } from './media.dto';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const MAX_BYTES_BY_MEDIA_TYPE: Record<MediaType, number> = {
  IMAGE: 15 * 1024 * 1024,
  VIDEO: 200 * 1024 * 1024,
};

const UPLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class MediaService {
  private readonly s3: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.publicBaseUrl = this.config.getOrThrow<string>('S3_PUBLIC_BASE_URL').replace(/\/+$/, '');
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const credentials = {
      accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
      secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
    };

    // Client "interne" : utilisé pour les appels serveur->MinIO (HEAD/DELETE) via le DNS
    // interne au cluster, plus rapide et indépendant de l'Ingress public.
    this.s3 = new S3Client({
      region,
      endpoint: this.config.getOrThrow<string>('S3_ENDPOINT'),
      forcePathStyle: true, // requis par MinIO (adressage par chemin, pas par sous-domaine de bucket)
      credentials,
    });

    // Client "public" : utilisé uniquement pour signer des URLs (aucun appel réseau réel ici),
    // avec l'endpoint public. Nécessaire pour que les URLs pré-signées renvoyées au client
    // (navigateur, hors du cluster) pointent vers un hôte qu'il peut réellement joindre —
    // le DNS interne au cluster ne serait pas résolvable depuis l'extérieur.
    this.presignClient = new S3Client({
      region,
      endpoint: this.publicBaseUrl,
      forcePathStyle: true,
      credentials,
    });
  }

  /** Génère une URL PUT pré-signée : le client uploade directement vers MinIO, sans passer par l'API. */
  async createUploadUrl(userId: string, dto: CreateUploadUrlDto) {
    const allowedTypes = CONTENT_TYPE_BY_MEDIA_TYPE[dto.mediaType];
    if (!allowedTypes.includes(dto.contentType)) {
      throw new BadRequestException(`Type de contenu non autorisé pour ${dto.mediaType}`);
    }
    const maxBytes = MAX_BYTES_BY_MEDIA_TYPE[dto.mediaType];
    if (dto.sizeBytes > maxBytes) {
      throw new BadRequestException(`Fichier trop volumineux (max ${Math.floor(maxBytes / 1024 / 1024)} Mo)`);
    }

    const ext = EXT_BY_CONTENT_TYPE[dto.contentType];
    const key = `posts/${userId}/${randomUUID()}.${ext}`;

    const uploadUrl = await getSignedUrl(
      this.presignClient,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: dto.contentType }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return {
      uploadUrl,
      key,
      requiredHeaders: { 'Content-Type': dto.contentType },
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  /**
   * Vérifie, au moment de la création du post (pas seulement au moment de la signature de l'URL),
   * que l'objet appartient bien à l'utilisateur, existe réellement dans le bucket et respecte les
   * limites annoncées. Un client pourrait ignorer les contraintes côté client, donc on revérifie
   * côté serveur à partir des métadonnées réelles de l'objet uploadé.
   */
  async assertUploadedObject(userId: string, key: string, mediaType: MediaType): Promise<string> {
    if (!key.startsWith(`posts/${userId}/`) || key.includes('..')) {
      throw new BadRequestException('Média invalide');
    }

    const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => null);
    if (!head) {
      throw new NotFoundException("Le fichier n'a pas été trouvé, réessaie l'upload");
    }

    const contentType = head.ContentType ?? '';
    if (!CONTENT_TYPE_BY_MEDIA_TYPE[mediaType].includes(contentType)) {
      await this.deleteObject(key);
      throw new BadRequestException('Type de fichier invalide');
    }

    const maxBytes = MAX_BYTES_BY_MEDIA_TYPE[mediaType];
    if ((head.ContentLength ?? 0) > maxBytes) {
      await this.deleteObject(key);
      throw new BadRequestException('Fichier trop volumineux');
    }

    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  async deleteObject(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }
}
