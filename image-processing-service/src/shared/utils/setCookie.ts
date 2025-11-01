import type { FastifyReply } from 'fastify'
export const setCookie = (res: FastifyReply, key: string, value: string, expiresIn?: number) => {
    const calculatedMilliseconds = expiresIn ||  30 * 60
    const now = new Date();
    const expires = new Date(now.getTime() + calculatedMilliseconds * 1000);
    console.log(expires);

    res.setCookie(key, value, {
        expires,
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
    });
};