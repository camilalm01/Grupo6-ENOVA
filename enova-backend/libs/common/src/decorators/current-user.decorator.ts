import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { IAuthenticatedUser } from "../interfaces/user.interface";

/**
 * Decorador para obtener el usuario autenticado del request
 * Uso: @CurrentUser() user: IAuthenticatedUser
 */
export const CurrentUser = createParamDecorator(
    (data: keyof IAuthenticatedUser | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as IAuthenticatedUser;

        if (!user) {
            return null;
        }

        return data ? user[data] : user;
    },
);
