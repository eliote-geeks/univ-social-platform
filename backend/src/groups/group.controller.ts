import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { CreatePostDto } from '../posts/posts.dto';
import { AddGroupMemberDto, CreateGroupDto, CursorQueryDto, UpdateGroupDto, UpdateGroupMemberRoleDto } from './group.dto';
import { GroupsService } from './group.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@OptionalUser() principal: AuthPrincipal | undefined, @Query() query: CursorQueryDto) {
    return this.groups.list(principal?.sub, query.q, query.cursor);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateGroupDto) {
    return this.groups.create(principal.sub, dto.name, dto.description, dto.visibility);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  getBySlug(@Param('slug') slug: string, @OptionalUser() principal: AuthPrincipal | undefined) {
    return this.groups.getBySlug(slug, principal?.sub);
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  update(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateGroupDto) {
    return this.groups.update(slug, principal.sub, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal) {
    await this.groups.remove(slug, principal.sub);
  }

  @Post(':slug/join')
  @UseGuards(JwtAuthGuard)
  join(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal) {
    return this.groups.join(slug, principal.sub);
  }

  @Post(':slug/leave')
  @UseGuards(JwtAuthGuard)
  leave(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal) {
    return this.groups.leave(slug, principal.sub);
  }

  @Get(':slug/members')
  @UseGuards(OptionalJwtAuthGuard)
  listMembers(@Param('slug') slug: string, @OptionalUser() principal: AuthPrincipal | undefined, @Query() query: CursorQueryDto) {
    return this.groups.listMembers(slug, principal?.sub, query.cursor);
  }

  @Post(':slug/members')
  @UseGuards(JwtAuthGuard)
  addMember(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: AddGroupMemberDto) {
    return this.groups.addMember(slug, principal.sub, dto.username);
  }

  @Delete(':slug/members/:username')
  @UseGuards(JwtAuthGuard)
  removeMember(@Param('slug') slug: string, @Param('username') username: string, @CurrentUser() principal: AuthPrincipal) {
    return this.groups.removeMember(slug, principal.sub, username);
  }

  @Patch(':slug/members/:username/role')
  @UseGuards(JwtAuthGuard)
  updateMemberRole(
    @Param('slug') slug: string,
    @Param('username') username: string,
    @CurrentUser() principal: AuthPrincipal,
    @Body() dto: UpdateGroupMemberRoleDto,
  ) {
    return this.groups.updateMemberRole(slug, principal.sub, username, dto.role);
  }

  @Get(':slug/posts')
  @UseGuards(OptionalJwtAuthGuard)
  feed(@Param('slug') slug: string, @OptionalUser() principal: AuthPrincipal | undefined, @Query() query: CursorQueryDto) {
    return this.groups.feed(slug, principal?.sub, query.cursor);
  }

  @Post(':slug/posts')
  @UseGuards(JwtAuthGuard)
  createPost(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: CreatePostDto) {
    return this.groups.createPost(slug, principal.sub, dto);
  }
}
