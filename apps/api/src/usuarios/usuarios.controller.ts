import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuariosService } from './usuarios.service';

class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

class AvatarUploadDto {
  @IsString()
  @MaxLength(255)
  nomeArquivo!: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.usuarios.me(user.sub);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.usuarios.updateMe(user.sub, dto);
  }

  // URL assinada para o próprio usuário (inclui aluno) subir o avatar.
  @Post('avatar-upload-url')
  avatarUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: AvatarUploadDto) {
    return this.usuarios.urlAvatarUpload(user, dto.nomeArquivo);
  }
}
