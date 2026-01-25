import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class JoinRoomDto {
    @IsString()
    @IsNotEmpty({ message: "ID de sala es requerido" })
    roomId: string;

    @IsOptional()
    @IsString()
    userId?: string;
}
