import { PlataformaExterna, TipoAcesso } from '@tribohub/db';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOfertaDto {
  @IsString()
  trilhaId!: string;

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
  @IsInt()
  @Min(1)
  duracaoAcessoDias?: number;
}

export class ProrrogarDto {
  @IsInt()
  @Min(1)
  dias!: number;
}
