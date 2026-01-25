import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class TypingDto {
    @IsString()
    @IsNotEmpty({ message: "ID de sala es requerido" })
    roomId: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsBoolean()
    isTyping: boolean;
}
