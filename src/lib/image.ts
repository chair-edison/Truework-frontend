export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** 선택 가능한 원본 한도(압축 전). 서버 업로드 한도는 UPLOAD_MAX_BYTES. */
export const PICK_MAX_BYTES = 20 * 1024 * 1024;
/** API: 원본과 서버 변환 후 이미지 모두 4 MiB 이하 */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export type FileProblem = "fileType" | "fileSize" | null;

export function validateImage(file: File): FileProblem {
  if (!ACCEPTED_TYPES.includes(file.type)) return "fileType";
  if (file.size > PICK_MAX_BYTES) return "fileSize";
  return null;
}

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
}

/**
 * 업로드 전 긴 변을 줄이고 JPEG 로 재인코딩한다(EXIF 등 메타데이터도 제거됨).
 * 4 MiB 를 넘으면 해상도·품질을 단계적으로 낮춘다. 끝내 넘으면 null.
 */
export async function prepareScreenshot(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file.size <= UPLOAD_MAX_BYTES ? file : null;
  }
  try {
    for (const [side, q] of [[2000, 0.85], [1600, 0.8], [1280, 0.75], [1024, 0.7]] as const) {
      const blob = await encode(bitmap, side, q);
      if (blob && blob.size <= UPLOAD_MAX_BYTES) return blob;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
