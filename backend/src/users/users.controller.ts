import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SiteRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { UpdateProfileDto } from '../auth/auth.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';

class PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}

class UpdateRoleDto {
  @IsEnum(SiteRole)
  role!: SiteRole;
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
  @UseGuards(OptionalJwtAuthGuard)
  publicProfile(@Param('username') username: string, @OptionalUser() principal: AuthPrincipal | undefined) {
    return this.users.publicProfile(username, principal?.sub);
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

  @Patch(':username/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateRole(@Param('username') username: string, @Body() dto: UpdateRoleDto) {
    return this.users.updateRole(username, dto.role);
  }
}
