import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}

export class StartConversationDto {
  @IsString()
  @MaxLength(30)
  username!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
