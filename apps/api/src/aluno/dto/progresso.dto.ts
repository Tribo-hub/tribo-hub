import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ProgressoDto {
  @IsString()
  aulaId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentualAssistido?: number;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}

export class AvaliacaoDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  nota!: number;
}

export class RespostaQuizItem {
  @IsString()
  perguntaId!: string;

  @IsString()
  @MaxLength(2000)
  resposta!: string;
}

export class ResponderQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespostaQuizItem)
  respostas!: RespostaQuizItem[];
}

export class ComentarioDto {
  @IsString()
  @MaxLength(2000)
  texto!: string;

  @IsOptional()
  @IsString()
  respostaAId?: string;
}
