import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const countryCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class UpdateSelfDeclaredProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  dateOfBirth?: string;

  @IsOptional()
  @Transform(countryCode)
  @Matches(/^[A-Z]{2}$/)
  nationalityCountryCode?: string;

  @IsOptional()
  @Transform(countryCode)
  @Matches(/^[A-Z]{2}$/)
  residenceCountryCode?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(/^\+[1-9]\d{7,14}$/)
  phoneE164?: string;
}
