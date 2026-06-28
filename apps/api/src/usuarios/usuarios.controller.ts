import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PermitirInadimplente } from '../common/decorators/permitir-inadimplente.decorator';
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

class AlterarSenhaDto {
  @IsString()
  senhaAtual!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  novaSenha!: string;
}

@Controller('me')
@UseGuards(JwtAuthGuard)
@PermitirInadimplente() // /me precisa carregar para a tela de bloqueio/alterar senha/sair
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

  // Troca de senha do próprio usuário (qualquer papel).
  @Patch('senha')
  alterarSenha(@CurrentUser() user: AuthUser, @Body() dto: AlterarSenhaDto) {
    return this.usuarios.alterarSenha(user.sub, dto.senhaAtual, dto.novaSenha);
  }
}
