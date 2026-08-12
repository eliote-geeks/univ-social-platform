import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { OptionalUser } from '../auth/optional-user.decorator';
import { CreateCommentDto, CreatePostDto, SetReactionDto } from './posts.dto';
import { PostsService } from './posts.service';

class FeedQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}

@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get('feed')
  @UseGuards(OptionalJwtAuthGuard)
  feed(@OptionalUser() principal: AuthPrincipal | undefined, @Query() query: FeedQueryDto) {
    return this.posts.feed(query.cursor, principal?.sub);
  }

  @Get('feed/following')
  @UseGuards(JwtAuthGuard)
  feedFollowing(@CurrentUser() principal: AuthPrincipal, @Query() query: FeedQueryDto) {
    return this.posts.feedFollowing(principal.sub, query.cursor);
  }

  @Get('users/:username/posts')
  @UseGuards(OptionalJwtAuthGuard)
  byAuthor(@Param('username') username: string, @OptionalUser() principal: AuthPrincipal | undefined, @Query() query: FeedQueryDto) {
    return this.posts.byAuthor(username, query.cursor, principal?.sub);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreatePostDto) {
    return this.posts.create(principal.sub, dto);
  }

  @Get('posts/:id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(@Param('id') id: string, @OptionalUser() principal: AuthPrincipal | undefined) {
    return this.posts.findOne(id, principal?.sub);
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  comment(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: CreateCommentDto) {
    return this.posts.comment(id, principal.sub, dto);
  }

  @Post('posts/:id/reaction')
  @UseGuards(JwtAuthGuard)
  reaction(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: SetReactionDto) {
    return this.posts.react(id, principal.sub, dto.type);
  }

  @Delete('posts/:id/reaction')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async removeReaction(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    await this.posts.removeReaction(id, principal.sub);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    await this.posts.remove(id, principal.sub, principal.role === 'MODERATOR' || principal.role === 'ADMIN');
  }
}
