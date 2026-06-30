import { PlataformaExterna, TipoAcesso } from '@tribohub/db';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOfertaDto {
  @IsString()
  trilhaId!: string;

  @IsOptional()
  @IsString()
  turmaId?: string | null;

  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsOptional()
  @IsEnum(PlataformaExterna)
  plataformaExterna?: PlataformaExterna;

  @IsString()
  @MaxLength(255)
  codigoProdutoExterno!: string;

  @IsEnum(TipoAcesso)
  tipoAcesso!: TipoAcesso;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoAcessoDias?: number;
}

export class UpdateOfertaDto {
  @IsOptional()
  @IsString()
  trilhaId?: string;

  @IsOptional()
  @IsString()
  turmaId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsEnum(PlataformaExterna)
  plataformaExterna?: PlataformaExterna;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  codigoProdutoExterno?: string;

  @IsOptional()
  @IsEnum(TipoAcesso)
  tipoAcesso?: TipoAcesso;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoAcessoDias?: number;
}

export class IntegracaoDto {
  @IsEnum(PlataformaExterna)
  plataforma!: PlataformaExterna;

  @IsString()
  @MaxLength(255)
  webhookSecret!: string;
}

export class CortesiaDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsString()
  trilhaId!: string;

  @IsOptional()
  @IsString()
  turmaId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoAcessoDias?: number;
}

export class ProrrogarDto {
  @IsInt()
  @Min(1)
  dias!: number;
}

export class EditarAlunoDto {
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
  @MinLength(6)
  @MaxLength(72)
  senha?: string;
}
