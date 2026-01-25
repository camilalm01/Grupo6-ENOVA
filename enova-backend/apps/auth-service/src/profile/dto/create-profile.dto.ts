import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProfileDto {
    @IsString()
    id: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    display_name?: string;

    @IsOptional()
    @IsString()
    avatar_url?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    bio?: string;
}
