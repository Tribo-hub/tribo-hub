import { TipoConta } from '@tribohub/db';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateContaDto {
  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsEnum(TipoConta)
  tipoConta!: TipoConta;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string;

  @IsString()
  @MaxLength(255)
  adminNome!: string;

  @IsEmail()
  adminEmail!: string;

  @IsOptional()
  @IsString()
  plano?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsuarios?: number;
}

export class UpdateContaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  corPrimaria?: string;

  // Subdomínio da área de membros (ex.: "vendas" -> vendas.tribohub.com.br).
  // Só letras minúsculas, números e hífen; 2 a 63 caracteres (limite de rótulo DNS).
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/, {
    message: 'Subdomínio inválido: use apenas letras minúsculas, números e hífen (2 a 63 caracteres).',
  })
  subdominio?: string;

  @IsOptional()
  @IsBoolean()
  permiteAutoCadastro?: boolean;

  @IsOptional()
  @IsBoolean()
  permiteComentarios?: boolean;

  @IsOptional()
  @IsBoolean()
  sessaoUnica?: boolean;

  @IsOptional()
  @IsBoolean()
  boasVindasAtivo?: boolean;

  @IsOptional()
  @IsString()
  mensagemBoasVindas?: string;
}

export class UpdateAssinaturaDto {
  @IsOptional()
  @IsString()
  plano?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorBase?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsuarios?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  alunosIncluidos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPorExcedente?: number;
}
