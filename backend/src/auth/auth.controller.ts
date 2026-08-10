import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from './current-user.decorator';
import { AuthPrincipal } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

// Throttle dédié, plus strict que la limite globale (120/min), pour ralentir le brute-force
// de mots de passe et le credential stuffing sur ces deux routes sensibles.
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.auth.register(dto, request.ip, request.get('user-agent'));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.auth.login(dto, request.ip, request.get('user-agent'));
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.auth.refresh(dto.refreshToken, request.ip, request.get('user-agent'));
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() principal: AuthPrincipal) {
    await this.auth.logout(principal.sid);
  }
}
