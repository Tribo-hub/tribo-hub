import { CategoriaTrilha, TipoVideo } from '@tribohub/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AnexoDto {
  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsString()
  path!: string;
}

export class CreateTrilhaDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsString()
  @MaxLength(4000)
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
  @MaxLength(4000)
  descricao?: string;

  @IsOptional()
  @IsEnum(CategoriaTrilha)
  categoria?: CategoriaTrilha;

  @IsOptional()
  publicado?: boolean;

  @IsOptional()
  @IsString()
  capaUrl?: string;

  @IsOptional()
  @IsBoolean()
  exibirComoOferta?: boolean;

  @IsOptional()
  @IsBoolean()
  ofertaTodosAlunos?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ofertaParaTrilhas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  checkoutUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  whatsappUrl?: string;

  @IsOptional()
  @IsIn(['matricula', 'fixa'])
  dripBase?: string;

  @IsOptional()
  @IsString()
  dripInicioEm?: string | null; // data ISO (yyyy-mm-dd) quando dripBase = fixa
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

export class UpdateModuloDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ordem?: number;
}

export class CreateAulaDto {
  @IsString()
  @MaxLength(255)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(TipoVideo)
  tipoVideo?: TipoVideo;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoIdExterno?: string;

  @IsOptional()
  @IsString()
  conteudoTexto?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  liberaAposDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  duracaoSegundos?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnexoDto)
  anexos?: AnexoDto[];

  @IsInt()
  @Min(1)
  ordem!: number;
}

export class CriarPerguntaDto {
  @IsString()
  @MaxLength(500)
  pergunta!: string;
}

export class ResponderComentarioDto {
  @IsString()
  @MaxLength(2000)
  texto!: string;

  @IsOptional()
  @IsString()
  respostaAId?: string;
}

export class UpdateAulaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(TipoVideo)
  tipoVideo?: TipoVideo;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoIdExterno?: string;

  @IsOptional()
  @IsString()
  conteudoTexto?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  liberaAposDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  duracaoSegundos?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnexoDto)
  anexos?: AnexoDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  ordem?: number;
}
