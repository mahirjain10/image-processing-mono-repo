import type { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthRequest extends FastifyRequest{
    user:{
        id:string,
        email:string
    }
}