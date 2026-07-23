import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgenteDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icone?: string;

  @IsString()
  @MaxLength(600)
  url!: string;
}

export class CreateAgenteTenantDto extends CreateAgenteDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trilhaIds?: string[];

  @IsOptional()
  @IsBoolean()
  todasTrilhas?: boolean;
}
