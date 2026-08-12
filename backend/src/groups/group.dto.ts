import { GroupVisibility } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(GroupVisibility)
  visibility?: GroupVisibility;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(GroupVisibility)
  visibility?: GroupVisibility;

  // Clé d'objet renvoyée par POST /media/upload-url (purpose: 'cover') — voir
  // UpdateProfileDto.avatarKey pour le patron complet (revérification côté serveur).
  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverKey?: string;
}

export class AddGroupMemberDto {
  @IsString()
  @MaxLength(30)
  username!: string;
}

export class UpdateGroupMemberRoleDto {
  // L'OWNER n'est jamais assignable via cette route : il n'y en a qu'un, désigné à la
  // création ou promu automatiquement au départ du précédent (cf. GroupsService.leave).
  @IsIn(['ADMIN', 'MEMBER'])
  role!: 'ADMIN' | 'MEMBER';
}
