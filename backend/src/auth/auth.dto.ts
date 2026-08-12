import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/)
  username!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class BootstrapAdminDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  // Clé d'objet renvoyée par POST /media/upload-url (purpose: 'avatar'/'cover'), pas une URL :
  // UsersService revérifie côté serveur (existence, propriétaire, type) via MediaService avant
  // de la convertir en avatarUrl/coverUrl définitive — même patron que CreatePostDto.media[].key.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  avatarKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverKey?: string;
}
