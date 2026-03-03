import { IsNumber, IsPositive, IsString, Matches, Min, Max } from 'class-validator';

export class PaintPixelDto {
  @IsNumber()
  @IsPositive()
  canvasId!: number;

  @IsNumber()
  @Min(0)
  x!: number;

  @IsNumber()
  @Min(0)
  y!: number;

  @IsNumber()
  @Min(1)
  @Max(31)
  colorIndex!: number;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/)
  painter!: string;
}
