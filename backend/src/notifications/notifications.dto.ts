import { IsOptional, IsString, MaxLength } from 'class-validator';

export class NotificationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}
