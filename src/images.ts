import { isCloudMode } from './cloudStorage';

const MAX_BYTES = 10_000_000;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export interface UploadedImage {
  src: string;
  /** True if backed by a server-stored file we should DELETE when removed. */
  cloud: boolean;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Only JPEG, PNG, GIF, and WebP images are supported.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image is over 10 MB.');
  }
  if (isCloudMode()) {
    const fd = new FormData();
    fd.append('file', file);
    let res: Response;
    try {
      res = await fetch('/api/images', { method: 'POST', body: fd });
    } catch (e: any) {
      throw new Error(`Network error during upload: ${e?.message ?? 'unknown'}`);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const trimmed = detail.replace(/<[^>]+>/g, '').trim().slice(0, 120);
      throw new Error(
        `Upload failed (${res.status})${trimmed ? `: ${trimmed}` : ''}`
      );
    }
    let json: { url: string };
    try {
      json = (await res.json()) as { url: string };
    } catch {
      throw new Error('Upload succeeded but server did not return JSON. The deploy may be missing the /api/images endpoint — try redeploying.');
    }
    if (!json?.url) throw new Error('Server response missing url field');
    return { src: json.url, cloud: true };
  }
  // Dev: stash as base64 data URL inside the JSON state
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
  return { src: dataUrl, cloud: false };
}

export async function deleteImage(src: string): Promise<void> {
  if (!src.startsWith('/api/images/')) return; // data URL or unknown — nothing to delete server-side
  const id = src.replace('/api/images/', '');
  try {
    await fetch(`/api/images/${id}`, { method: 'DELETE' });
  } catch {
    // best-effort; UI removal already happened
  }
}
