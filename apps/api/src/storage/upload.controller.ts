import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StorageService } from './storage.service';

class UploadUrlDto {
  @IsIn(['videos', 'materiais', 'legendas', 'imagens'])
  pasta!: string;

  @IsString()
  @MaxLength(255)
  nomeArquivo!: string;
}

@Controller('painel/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.super_admin, Role.admin_tenant)
export class UploadController {
  constructor(private readonly storage: StorageService) {}

  // Retorna URL assinada para o frontend subir o arquivo direto no Storage.
  @Post('signed-url')
  urlDeUpload(@CurrentUser() user: AuthUser, @Body() dto: UploadUrlDto) {
    const base = user.contaId ?? 'plataforma';
    const seguro = dto.nomeArquivo.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${base}/${dto.pasta}/${Date.now()}-${seguro}`;
    return this.storage.urlDeUpload(path);
  }

  // Retorna URL assinada temporária para leitura de um arquivo do próprio tenant.
  @Get('signed-download')
  urlDeDownload(@CurrentUser() user: AuthUser, @Query('path') path: string) {
    return this.storage.urlDeDownload(path);
  }
}
