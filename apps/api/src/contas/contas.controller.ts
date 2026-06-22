import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, TipoConta } from '@tribohub/db';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContasService } from './contas.service';
import { CreateContaDto, UpdateAssinaturaDto, UpdateContaDto } from './dto/create-conta.dto';

@Controller('admin/contas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.super_admin)
export class ContasController {
  constructor(private readonly contas: ContasService) {}

  @Post()
  criar(@Body() dto: CreateContaDto) {
    return this.contas.criar(dto);
  }

  @Get()
  listar(
    @Query('page') page?: string,
    @Query('tipoConta') tipoConta?: TipoConta,
    @Query('ativo') ativo?: string,
  ) {
    return this.contas.listar({
      page: page ? Number(page) : 1,
      tipoConta,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.contas.obter(id);
  }

  @Get(':id/usuarios')
  usuarios(@Param('id') id: string) {
    return this.contas.listarUsuarios(id);
  }

  @Patch(':id/assinatura')
  atualizarAssinatura(@Param('id') id: string, @Body() dto: UpdateAssinaturaDto) {
    return this.contas.atualizarAssinatura(id, dto);
  }

  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateContaDto) {
    return this.contas.atualizar(id, dto);
  }

  @Patch(':id/status')
  definirStatus(@Param('id') id: string, @Body('ativo') ativo: boolean) {
    return this.contas.definirStatus(id, ativo);
  }
}
