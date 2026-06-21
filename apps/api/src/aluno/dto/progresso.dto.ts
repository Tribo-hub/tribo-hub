import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

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
