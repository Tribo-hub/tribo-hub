import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  AcceptInviteDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  SignupDto,
} from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: any) {
    // subdomínio (produção) tem prioridade; tenant no corpo é fallback p/ dev
    return this.auth.login(dto.email, dto.senha, req.tenantSlug ?? dto.tenant ?? null);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('accept-invite')
  @HttpCode(200)
  aceitarConvite(@Body() dto: AcceptInviteDto) {
    return this.auth.aceitarConvite(dto.token, dto.senha);
  }

  @Post('signup')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  signup(@Body() dto: SignupDto, @Req() req: any) {
    return this.auth.signup(dto.nome, dto.email, dto.senha, req.tenantSlug ?? dto.tenant ?? null);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgot(@Body() dto: ForgotPasswordDto, @Req() req: any) {
    return this.auth.solicitarResetSenha(dto.email, req.tenantSlug ?? dto.tenant ?? null);
  }

  @Post('reset-password')
  @HttpCode(200)
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.redefinirSenha(dto.token, dto.senha);
  }

  @Post('logout')
  @HttpCode(200)
  logout() {
    // MVP: logout é stateless no cliente (descarta tokens).
    // Blacklist de refresh token entra no endurecimento (Fase 7).
    return { ok: true };
  }
}
