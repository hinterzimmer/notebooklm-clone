import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { UserContextService } from '../database/user-context.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);
  private verifier: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly userContextService: UserContextService,
    @Optional() private readonly reflector?: Reflector,
  ) {
    const awsConfig = this.configService.get('aws') || {};
    const { userPoolId, clientId } = awsConfig.cognito || {};

    if (userPoolId && clientId) {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: null,
        clientId,
      });
    } else {
      this.logger.warn(
        'COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID not set. Dev authorization fallback will be used if provided.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (request.query && typeof request.query.token === 'string') {
      token = request.query.token;
    }

    if (!token) {
      throw new UnauthorizedException('Missing Authorization Bearer token');
    }

    // Allow dev token fallback during local development
    if (token.startsWith('dev-token')) {
      const user = { userId: '00000000-0000-7000-8000-000000000001', email: 'dev@notebooklm.local' };
      request.user = user;
      this.userContextService?.setUser?.(user);
      return true;
    }

    try {
      if (this.verifier) {
        const payload = await this.verifier.verify(token);
        const userId = payload.sub;
        const tenantId = (payload['custom:tenant_id'] as string) || undefined;
        const email = (payload.email as string) || undefined;
        request.user = { userId, tenantId, email };
        // Bind to AsyncLocalStorage for database queries and interceptors
        this.userContextService?.setUser?.({ userId, tenantId });
        if (typeof this.userContextService?.runWithUser === 'function') {
          this.userContextService.runWithUser({ userId, tenantId }, () => Promise.resolve());
        }
        return true;
      } else {
        // Fallback for local testing if verifier is not configured: parse base64 payload or user id
        let userId = '00000000-0000-7000-8000-000000000001';
        let email: string | undefined;
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (decoded.sub) userId = decoded.sub;
            if (decoded.email) email = decoded.email;
          } else if (token.length >= 36) {
            userId = token;
          }
        } catch {}
        request.user = { userId, email };
        this.userContextService?.setUser?.({ userId });
        return true;
      }
    } catch (err) {
      this.logger.error('Cognito JWT verification failed', err);
      throw new UnauthorizedException('Invalid or expired Cognito JWT token');
    }
  }
}

