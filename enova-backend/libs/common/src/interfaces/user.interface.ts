export interface IUser {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
    role?: string;
}

export interface IAuthenticatedUser extends IUser {
    iat?: number;
    exp?: number;
}
