const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_PX = 1400;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "File must be an image";
  if (file.size > MAX_FILE_BYTES) return "Image must be under 10 MB";
  return null;
}

export function getResizeDimensions(
  width: number,
  height: number,
  max = MAX_IMAGE_PX,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  if (width >= height) {
    return { width: max, height: Math.round((height / width) * max) };
  }
  return { width: Math.round((width / height) * max), height: max };
}
