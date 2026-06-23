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

export class AcceptInviteDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  senha!: string;
}

export class SignupDto {
  @IsString()
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;

  @IsOptional()
  @IsString()
  tenant?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  tenant?: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  senha!: string;
}
