import { CategoriaTrilha, TipoVideo } from '@tribohub/db';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTrilhaDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsString()
  descricao!: string;

  @IsOptional()
  @IsEnum(CategoriaTrilha)
  categoria?: CategoriaTrilha;

  @IsOptional()
  @IsString()
  capaUrl?: string;
}

export class UpdateTrilhaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(CategoriaTrilha)
  categoria?: CategoriaTrilha;

  @IsOptional()
  publicado?: boolean;
}

export class CreateModuloDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsInt()
  @Min(1)
  ordem!: number;
}

export class CreateAulaDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(TipoVideo)
  tipoVideo!: TipoVideo;

  @IsString()
  videoUrl!: string;

  @IsOptional()
  @IsString()
  videoIdExterno?: string;

  @IsInt()
  @Min(1)
  duracaoSegundos!: number;

  @IsInt()
  @Min(1)
  ordem!: number;
}
