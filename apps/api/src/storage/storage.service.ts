import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { env } from '@tribohub/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly client: SupabaseClient;
  private readonly bucket = env.SUPABASE_STORAGE_BUCKET;

  constructor() {
    if (!env.SUPABASE_URL || !env.supabaseServiceRoleKey) {
      throw new InternalServerErrorException('Supabase Storage não configurado (.env)');
    }
    this.client = createClient(env.SUPABASE_URL, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }

  // Gera uma URL assinada para o cliente subir o arquivo diretamente (sem passar pelo backend).
  async urlDeUpload(path: string) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);
    if (error) throw new InternalServerErrorException(error.message);
    return { path, token: data.token, signedUrl: data.signedUrl };
  }

  // Gera uma URL assinada temporária para leitura (bucket privado).
  async urlDeDownload(path: string, expiraEmSegundos = 3600) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiraEmSegundos);
    if (error) throw new InternalServerErrorException(error.message);
    return { url: data.signedUrl };
  }
}
