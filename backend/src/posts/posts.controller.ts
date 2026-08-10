import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  feed(@Query() query: FeedQueryDto) {
    return this.posts.feed(query.cursor);
  }

  @Get('feed/following')
  @UseGuards(JwtAuthGuard)
  feedFollowing(@CurrentUser() principal: AuthPrincipal, @Query() query: FeedQueryDto) {
    return this.posts.feedFollowing(principal.sub, query.cursor);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreatePostDto) {
    return this.posts.create(principal.sub, dto);
  }

  @Get('posts/:id')
  findOne(@Param('id') id: string) {
    return this.posts.findOne(id);
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
}
