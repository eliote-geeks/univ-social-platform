import { ReportStatus, ReportTargetType } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsString()
  @MaxLength(64)
  targetId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class ReviewReportDto {
  // ACTIONED = le contenu/compte visé est sanctionné, DISMISSED = signalement classé sans suite.
  @IsIn(['ACTIONED', 'DISMISSED'])
  status!: 'ACTIONED' | 'DISMISSED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;

  // Par défaut true quand status=ACTIONED : applique réellement la sanction (suppression du
  // contenu, suspension du compte…). À mettre à false pour ne consigner qu'une décision "actée"
  // sans effet automatique (ex: avertissement informel déjà donné hors-plateforme).
  @IsOptional()
  @IsBoolean()
  applyAction?: boolean;
}
