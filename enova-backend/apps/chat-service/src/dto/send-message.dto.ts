import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SendMessageDto {
    @IsString()
    @IsNotEmpty({ message: "ID de usuario es requerido" })
    userId: string;

    @IsString()
    @IsNotEmpty({ message: "Mensaje no puede estar vacío" })
    @MaxLength(5000, { message: "Mensaje muy largo (máximo 5000 caracteres)" })
    message: string;

    @IsString()
    @IsNotEmpty({ message: "ID de sala es requerido" })
    roomId: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    username?: string;

    @IsOptional()
    @IsString()
    clientMessageId?: string;
}
