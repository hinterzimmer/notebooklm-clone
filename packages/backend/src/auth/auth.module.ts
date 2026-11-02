import { Module } from '@nestjs/common';
import { CognitoAuthGuard } from './cognito.guard.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, CognitoAuthGuard],
  exports: [AuthService, CognitoAuthGuard],
})
export class AuthModule {}

