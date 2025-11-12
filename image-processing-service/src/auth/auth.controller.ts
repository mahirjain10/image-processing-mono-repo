import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { FastifyRequest, FastifyReply } from 'fastify';
import { JWT_COOKIE_EXPIRES_IN, LOGIN_LIMIT_FIELD } from '@auth/constants/users.constant';
import { AuthService } from '@src/auth/auth.service';
import CreateUserDto from '@src/auth/dto/create-user.dto';
import LoginUserDto from '@src/auth/dto/user.dto';
import { setCookie } from '@shared/utils/setCookie';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}
  @Post('/register')
  async register(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Body() createUserDto: CreateUserDto,
  ) {
    const { email, password } = createUserDto;
    let statusCode = HttpStatus.CREATED;
    const user = await this.authService.findUserByEmail(email);
    if (user) {
      throw new BadRequestException(
        'User already registered with the given email',
      );
    }
    const savedUser = await this.authService.createUser(createUserDto);
    const payload = {
      id: savedUser.id,
      email: savedUser.email,
    };
    const token = this.jwtService.sign(payload);
    setCookie(res,'token',token,JWT_COOKIE_EXPIRES_IN)
    return res.status(statusCode).send({
      message: 'User created successfully',
      statusCode,
      success:true
      // data: { ...savedUser, token },
    });
  }

  @Post('/login')
  async login(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Body() LoginUserDto: LoginUserDto,
  ) {
    const { email, password } = LoginUserDto;
    const user = await this.authService.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User with given email not found');
    }
    if (user.uploadLimit >= 5){
      throw new BadRequestException('Rate Limit Exceeded')
    }
    if (user.password !== password) {
      throw new BadRequestException('Password mismatch');
    }
    const statusCode = HttpStatus.OK
    await this.authService.updateRateLimits(user.email,LOGIN_LIMIT_FIELD,user.loginLimit++)
    const payload = {
      id: user.id,
      email: user.email,
    };
    const token = this.jwtService.sign(payload);
    setCookie(res,'token',token,JWT_COOKIE_EXPIRES_IN)
    return res.status(statusCode).send({
      message: 'User Logged in successfully',
      statusCode,
      data:null
    });
  }
}
