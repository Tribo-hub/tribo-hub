import { IsInt, IsOptional, Min } from 'class-validator';

export class ConfigGamificacaoDto {
  @IsOptional() @IsInt() @Min(0) xpAula?: number;
  @IsOptional() @IsInt() @Min(0) xpTrilha?: number;
  @IsOptional() @IsInt() @Min(0) xpPlanoItem?: number;
  @IsOptional() @IsInt() @Min(0) xpQuiz?: number;
  @IsOptional() @IsInt() @Min(0) xpAvaliacao?: number;
  @IsOptional() @IsInt() @Min(0) xpComentario?: number;
  @IsOptional() @IsInt() @Min(1) xpPorNivel?: number;
  @IsOptional() @IsInt() @Min(1) badgeAulas1?: number;
  @IsOptional() @IsInt() @Min(1) badgeAulas2?: number;
  @IsOptional() @IsInt() @Min(1) badgeAulas3?: number;
  @IsOptional() @IsInt() @Min(1) badgeCert1?: number;
  @IsOptional() @IsInt() @Min(1) badgeCert2?: number;
  @IsOptional() @IsInt() @Min(1) badgeNivel?: number;
}
