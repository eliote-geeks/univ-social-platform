import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { MediaType, PostVisibility, ReactionType } from '@prisma/client';

export class CreateMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsUrl({ protocols: ['https'] })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  altText?: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsEnum(PostVisibility)
  visibility?: PostVisibility;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateMediaDto)
  media?: CreateMediaDto[];
}

export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class SetReactionDto {
  @IsEnum(ReactionType)
  type!: ReactionType;
}
