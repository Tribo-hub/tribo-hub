import { Controller, Get, Param } from '@nestjs/common';
import { AlunoService } from './aluno.service';

// Endpoint público (sem autenticação) de verificação de certificado.
@Controller('verificar')
export class VerificacaoController {
  constructor(private readonly aluno: AlunoService) {}

  @Get(':codigo')
  verificar(@Param('codigo') codigo: string) {
    return this.aluno.verificar(codigo);
  }
}
