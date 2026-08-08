import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { env } from '@tribohub/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private client?: SupabaseClient;
  private readonly bucket = env.SUPABASE_STORAGE_BUCKET;

  // Cache de URLs assinadas por caminho (a assinatura é por path, não por usuário — pode ser
  // reusada com segurança dentro da validade). Evita reassinar o mesmo arquivo a cada request.
  private readonly cacheAssinatura = new Map<string, { url: string; exp: number }>();
  private static readonly ASSINATURA_SEG = 6 * 60 * 60; // validade da URL (6h — cobre vídeos longos)
  private static readonly CACHE_MS = 5 * 60 * 60 * 1000; // reusa do cache por 5h (buffer de 1h antes de expirar)

  // Cliente criado sob demanda — não derruba o boot se o Storage não estiver configurado.
  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!env.SUPABASE_URL || !env.supabaseServiceRoleKey) {
        throw new InternalServerErrorException('Supabase Storage não configurado (.env)');
      }
      this.client = createClient(env.SUPABASE_URL, env.supabaseServiceRoleKey, {
        auth: { persistSession: false },
      });
    }
    return this.client;
  }

  // Gera uma URL assinada para o cliente subir o arquivo diretamente (sem passar pelo backend).
  async urlDeUpload(path: string) {
    const { data, error } = await this.getClient().storage
      .from(this.bucket)
      .createSignedUploadUrl(path);
    if (error) throw new InternalServerErrorException(error.message);
    return { path, token: data.token, signedUrl: data.signedUrl };
  }

  // Sobe um buffer gerado no servidor (ex.: PDF de certificado).
  async uploadBuffer(path: string, buffer: Buffer, contentType: string) {
    const { error } = await this.getClient().storage
      .from(this.bucket)
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw new InternalServerErrorException(error.message);
    return { path };
  }

  // Gera uma URL assinada temporária para leitura (bucket privado).
  async urlDeDownload(path: string, expiraEmSegundos = 3600) {
    const { data, error } = await this.getClient().storage
      .from(this.bucket)
      .createSignedUrl(path, expiraEmSegundos);
    if (error) throw new InternalServerErrorException(error.message);
    return { url: data.signedUrl };
  }

  // Assina VÁRIOS caminhos de uma vez (createSignedUrls), usando cache. Retorna um Map path->url.
  // Só vai à rede pelos paths ainda não cacheados. Reduz N round-trips (1 por arquivo) a ~1 por request.
  async urlsDeDownload(paths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const agora = Date.now();
    const faltam: string[] = [];
    for (const p of new Set(paths)) {
      if (!p) continue;
      const c = this.cacheAssinatura.get(p);
      if (c && c.exp > agora) out.set(p, c.url);
      else faltam.push(p);
    }
    if (faltam.length) {
      const { data, error } = await this.getClient().storage
        .from(this.bucket)
        .createSignedUrls(faltam, StorageService.ASSINATURA_SEG);
      if (error) throw new InternalServerErrorException(error.message);
      (data ?? []).forEach((d, i) => {
        const p = faltam[i];
        if (d?.signedUrl && !d.error) {
          this.cacheAssinatura.set(p, { url: d.signedUrl, exp: agora + StorageService.CACHE_MS });
          out.set(p, d.signedUrl);
        }
      });
    }
    return out;
  }
}
