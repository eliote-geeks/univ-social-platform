import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { UpdateProfileDto } from '../auth/auth.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() principal: AuthPrincipal) {
    return this.users.me(principal.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(principal.sub, dto);
  }

  @Get(':username')
  publicProfile(@Param('username') username: string) {
    return this.users.publicProfile(username);
  }
}
