import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { UpdateProfileDto } from '../auth/auth.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

class PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}

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

  @Post(':username/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('username') username: string, @CurrentUser() principal: AuthPrincipal) {
    return this.users.follow(principal.sub, username);
  }

  @Delete(':username/follow')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async unfollow(@Param('username') username: string, @CurrentUser() principal: AuthPrincipal) {
    await this.users.unfollow(principal.sub, username);
  }

  @Get(':username/followers')
  followers(@Param('username') username: string, @Query() query: PaginationQueryDto) {
    return this.users.followers(username, query.cursor);
  }

  @Get(':username/following')
  following(@Param('username') username: string, @Query() query: PaginationQueryDto) {
    return this.users.following(username, query.cursor);
  }
}
