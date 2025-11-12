import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Observable } from "rxjs";
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getCookie } from "@shared/utils/getCookie";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private jwtService: JwtService,private readonly configService:ConfigService) {}
  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean>{
    const request : FastifyRequest = context.switchToHttp().getRequest();
    const token = getCookie(request,'token')
    if(!token)  throw new UnauthorizedException(); 
    try {
      const payload = await this.jwtService.verifyAsync(
        token,
        {
          secret: this.configService.get<string>('JWT_SECRET')
        }
      );
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}