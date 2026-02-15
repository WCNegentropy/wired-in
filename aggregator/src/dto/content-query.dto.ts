import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ContentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  platforms?: string; // comma-separated

  @IsOptional()
  @IsIn(['date', 'score', 'relevance'])
  sort?: 'date' | 'score' | 'relevance' = 'date';

  @IsOptional()
  @IsString()
  q?: string;
}
