import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;

  // Opcional: slug da conta (tenant). Usado quando não há subdomínio (ex.: dev em localhost).
  // O subdomínio do Host tem prioridade sobre este campo.
  @IsOptional()
  @IsString()
  tenant?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
