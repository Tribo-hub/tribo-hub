import { TipoConta } from '@tribohub/db';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
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
}
