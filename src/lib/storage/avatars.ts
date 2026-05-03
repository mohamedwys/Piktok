import { File } from 'expo-file-system';
import {
  manipulateAsync,
  SaveFormat,
} from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';
const TARGET_SIZE = 512;
const JPEG_QUALITY = 0.8;
const PUBLIC_URL_SEGMENT = `/storage/v1/object/public/${BUCKET}/`;

export type UploadedAvatar = {
  publicUrl: string;
  path: string;
};

function generateFilename(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}.jpg`;
}

/**
 * Resize the picked image to a 512x512 JPEG @ quality 0.8 and upload it
 * under `avatars/<userId>/<filename>.jpg`. Returns the public URL and the
 * storage path so callers can persist the URL on the seller row and later
 * delete the file by path.
 */
export async function uploadAvatar(
  userId: string,
  fileUri: string,
): Promise<UploadedAvatar> {
  const resized = await manipulateAsync(
    fileUri,
    [{ resize: { width: TARGET_SIZE, height: TARGET_SIZE } }],
    { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
  );

  const file = new File(resized.uri);
  const bytes = await file.bytes();

  const path = `${userId}/${generateFilename()}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (error) throw error;

  const { data: pub } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return { publicUrl: pub.publicUrl, path: data.path };
}

/**
 * Best-effort delete by path. Never throws — Supabase Storage delete errors
 * (object missing, RLS denial on a stale URL after sign-out, network blip)
 * must not break the foreground UX since the new avatar is already saved.
 */
export async function deleteAvatarByPath(path: string): Promise<void> {
  if (path.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Swallowed by design.
  }
}

/**
 * Best-effort delete by public URL. Parses out the storage path from a
 * public URL produced by `getPublicUrl`. Silent no-op when the URL does
 * not belong to the avatars bucket (e.g. legacy URL, third-party host).
 */
export async function deleteAvatarByUrl(publicUrl: string): Promise<void> {
  if (publicUrl.length === 0) return;
  const idx = publicUrl.indexOf(PUBLIC_URL_SEGMENT);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + PUBLIC_URL_SEGMENT.length);
  if (path.length === 0) return;
  await deleteAvatarByPath(path);
}
