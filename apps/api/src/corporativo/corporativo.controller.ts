import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CorporativoService } from './corporativo.service';

class ConvidarDto {
  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsEmail()
  email!: string;
}

class MarcaDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  corPrimaria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
}

@Controller('painel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin_tenant)
export class CorporativoController {
  constructor(private readonly corp: CorporativoService) {}

  @Patch('marca')
  atualizarMarca(@CurrentUser() u: AuthUser, @Body() dto: MarcaDto) {
    return this.corp.atualizarMarca(u.contaId!, dto);
  }

  @Post('colaboradores')
  convidar(@CurrentUser() u: AuthUser, @Body() dto: ConvidarDto) {
    return this.corp.convidar(u.contaId!, dto.nome, dto.email);
  }

  @Get('colaboradores')
  listar(@CurrentUser() u: AuthUser) {
    return this.corp.listarColaboradores(u.contaId!);
  }

  @Patch('colaboradores/:id/status')
  status(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('ativo') ativo: boolean) {
    return this.corp.definirStatusColaborador(u.contaId!, id, ativo);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() u: AuthUser) {
    return this.corp.dashboard(u);
  }

  @Get('dashboard/ranking')
  ranking(@CurrentUser() u: AuthUser) {
    return this.corp.ranking(u.contaId!);
  }

  @Get('dashboard/inativos')
  inativos(@CurrentUser() u: AuthUser) {
    return this.corp.inativos(u.contaId!);
  }
}
