import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMenuLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nome!: string;

  @IsString()
  @MaxLength(500)
  url!: string;
}
