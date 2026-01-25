import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePostDto {
    @IsString()
    @IsNotEmpty({ message: "El título es requerido" })
    @MaxLength(200)
    title: string;

    @IsString()
    @IsNotEmpty({ message: "El contenido es requerido" })
    @MaxLength(10000)
    content: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    category?: string;
}
