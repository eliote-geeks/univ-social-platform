import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { CreatePostDto } from '../posts/posts.dto';
import { CreatePageDto, CursorQueryDto, UpdatePageDto } from './page.dto';
import { PagesService } from './page.service';

@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: CursorQueryDto, @OptionalUser() principal: AuthPrincipal | undefined) {
    return this.pages.list(query.q, query.cursor, principal?.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreatePageDto) {
    return this.pages.create(principal.sub, dto.name, dto.description, dto.category);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  getBySlug(@Param('slug') slug: string, @OptionalUser() principal: AuthPrincipal | undefined) {
    return this.pages.getBySlug(slug, principal?.sub);
  }

  @Patch(':slug')
  @UseGuards(JwtAuthGuard)
  update(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: UpdatePageDto) {
    return this.pages.update(slug, principal.sub, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal) {
    await this.pages.remove(slug, principal.sub);
  }

  @Post(':slug/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal) {
    return this.pages.follow(slug, principal.sub);
  }

  @Delete(':slug/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal) {
    return this.pages.unfollow(slug, principal.sub);
  }

  @Get(':slug/followers')
  listFollowers(@Param('slug') slug: string, @Query() query: CursorQueryDto) {
    return this.pages.listFollowers(slug, query.cursor);
  }

  @Get(':slug/posts')
  feed(@Param('slug') slug: string, @Query() query: CursorQueryDto) {
    return this.pages.feed(slug, query.cursor);
  }

  @Post(':slug/posts')
  @UseGuards(JwtAuthGuard)
  createPost(@Param('slug') slug: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: CreatePostDto) {
    return this.pages.createPost(slug, principal.sub, dto);
  }
}
