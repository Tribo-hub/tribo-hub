import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CriarEventoDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsString()
  @MaxLength(1000)
  linkAcesso!: string;

  @IsDateString()
  inicioEm!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoMin?: number;

  @IsOptional()
  @IsString()
  trilhaId?: string;
}

export class AtualizarEventoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  linkAcesso?: string;

  @IsOptional()
  @IsDateString()
  inicioEm?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoMin?: number;

  @IsOptional()
  @IsString()
  trilhaId?: string | null;
}
