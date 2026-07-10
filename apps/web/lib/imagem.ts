// Reduz/comprime uma imagem no navegador antes do upload (capas de curso/plano).
// Mantém a proporção, limita o maior lado e converte para JPEG. Se algo falhar,
// devolve o arquivo original (ex.: formatos que o navegador não decodifica).
export async function comprimirImagem(file: File, maxLado = 1400, qualidade = 0.85): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', qualidade));
    if (!blob || blob.size >= file.size) return file; // não piora se já era menor
    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
