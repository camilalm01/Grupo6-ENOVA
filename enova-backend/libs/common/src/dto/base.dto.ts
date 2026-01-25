import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO base para paginación
 */
export class PaginationDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    limit?: number = 20;
}

/**
 * Respuesta paginada genérica
 */
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
