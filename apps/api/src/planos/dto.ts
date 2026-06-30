import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PlanoItemTipo } from '@tribohub/db';

export class CriarPlanoDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  capaUrl?: string;

  @IsOptional()
  @IsString()
  trilhaId?: string;

  @IsOptional()
  @IsString()
  moduloId?: string;

  @IsOptional()
  @IsDateString()
  prazoEm?: string;

  @IsOptional()
  @IsDateString()
  releasedAt?: string;

  @IsOptional()
  @IsIn(['fixo', 'relativo'])
  agendamento?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  liberaAposDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  prazoDias?: number;

  @IsOptional()
  @IsBoolean()
  analiseAtiva?: boolean;
}

// PATCH do plano — todos os campos opcionais.
export class AtualizarPlanoDto {
  @IsOptional() @IsString() @MaxLength(255) titulo?: string;
  @IsOptional() @IsString() @MaxLength(255) subtitulo?: string;
  @IsOptional() @IsString() @MaxLength(2000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(500) capaUrl?: string;
  @IsOptional() @IsDateString() prazoEm?: string;
  @IsOptional() @IsDateString() releasedAt?: string;
  @IsOptional() @IsIn(['fixo', 'relativo']) agendamento?: string;
  @IsOptional() @IsInt() @Min(0) liberaAposDias?: number;
  @IsOptional() @IsInt() @Min(0) prazoDias?: number;
  @IsOptional() @IsBoolean() analiseAtiva?: boolean;
}

export class CriarItemDto {
  @IsString()
  @MaxLength(500)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsEnum(PlanoItemTipo)
  tipo?: PlanoItemTipo;

  @IsOptional()
  @IsString()
  aulaId?: string;

  @IsOptional()
  @IsDateString()
  prazoEm?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  prazoDias?: number;
}

export class AtualizarItemDto {
  @IsOptional() @IsString() @MaxLength(500) titulo?: string;
  @IsOptional() @IsString() @MaxLength(5000) descricao?: string;
  @IsOptional() @IsDateString() prazoEm?: string;
  @IsOptional() @IsInt() @Min(0) prazoDias?: number;
}

// Reordenação de tarefas (drag & drop): lista de ids na nova ordem.
export class ReordenarItensDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  ids!: string[];
}

// Aluno: marca/atualiza a própria tarefa (check / resumo / link).
export class ResponderItemDto {
  @IsOptional()
  @IsBoolean()
  concluido?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  texto?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  links?: string[];
}

// Mentor: registra a análise escrita de um aluno.
export class AnaliseDto {
  @IsString()
  @MaxLength(8000)
  texto!: string;
}
