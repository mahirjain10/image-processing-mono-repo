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

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import CreateUserDto from './dto/create-user.dto';
import LoginUserDto from './dto/user.dto';
import { JwtService } from '@nestjs/jwt';
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
    return res.status(statusCode).send({
      message: 'User created successfully',
      statusCode,
      data: { ...savedUser, token },
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
    if (user.password !== password) {
      throw new BadRequestException('Password mismatch');
    }
  }
}
