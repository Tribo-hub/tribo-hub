import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@tribohub/db';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContasService } from './contas.service';
import { CreateMenuLinkDto } from './dto/menu-link.dto';

@Controller('admin/menu-links')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.super_admin)
export class MenuLinksController {
  constructor(private readonly contas: ContasService) {}

  @Get()
  listar() {
    return this.contas.listarLinksMenu();
  }

  @Post()
  criar(@Body() dto: CreateMenuLinkDto) {
    return this.contas.criarLinkMenu(dto.nome, dto.url);
  }

  @Delete(':id')
  remover(@Param('id') id: string) {
    return this.contas.removerLinkMenu(id);
  }
}
