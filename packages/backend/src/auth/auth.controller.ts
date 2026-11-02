import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CognitoAuthGuard } from './cognito.guard.js';
import { Public } from './public.decorator.js';
import { LoginRequest, SignUpRequest } from '@notebooklm/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginRequest) {
    return this.authService.login(body);
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() body: SignUpRequest) {
    return this.authService.signUp(body);
  }

  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin() {
    return this.authService.devLogin();
  }

  @UseGuards(CognitoAuthGuard)
  @Get('me')
  async getProfile(@Req() req: any) {
    return {
      user: req.user,
    };
  }
}
