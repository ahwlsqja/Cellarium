import { IsNumber, IsPositive } from 'class-validator';

export class JoinCanvasDto {
  @IsNumber()
  @IsPositive()
  canvasId!: number;
}
