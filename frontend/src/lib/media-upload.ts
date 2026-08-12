import { apiFetch } from './api-client';
import type { MediaType } from './types';

const IMAGE_TYPES: Record<string, MediaType> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'video/mp4': 'VIDEO',
  'video/webm': 'VIDEO',
};

export function mediaTypeForFile(file: File): MediaType | null {
  return IMAGE_TYPES[file.type] ?? null;
}

interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
}

// Flux en 2 temps : (1) l'API signe une URL PUT MinIO pour cet utilisateur/ce type de fichier,
// (2) le navigateur uploade directement vers MinIO (jamais via notre API — évite de faire
// transiter des Mo de vidéo par le serveur Node). La clé renvoyée sert ensuite de référence dans
// CreatePostDto.media[].key ; le serveur revérifie l'objet réellement uploadé à la création du post.
export async function uploadMedia(file: File, mediaType: MediaType, purpose?: 'post' | 'avatar' | 'cover'): Promise<string> {
  const { uploadUrl, key, requiredHeaders } = await apiFetch<UploadUrlResponse>('/media/upload-url', {
    method: 'POST',
    body: { mediaType, contentType: file.type, sizeBytes: file.size, purpose },
  });

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: requiredHeaders,
    body: file,
  });
  if (!putResponse.ok) throw new Error("Échec de l'envoi du fichier");

  return key;
}
