import type { FastifyRequest } from 'fastify';

export const getCookie=(req:FastifyRequest,key:string): string|undefined=>{
    return req.cookies[key]
}