import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  // Identifiants des membres à ajouter en plus du créateur (qui devient OWNER automatiquement).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(49)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  usernames!: string[];
}

export class AddMemberDto {
  @IsString()
  @MaxLength(30)
  username!: string;
}

export class RenameGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;
}
