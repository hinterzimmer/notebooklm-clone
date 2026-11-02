import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LoginRequest,
  SignUpRequest,
  AuthResponse,
} from '@notebooklm/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const awsConfig = this.configService.get('aws') || {};
    const cognitoConfig = awsConfig.cognito || {};
    this.userPoolId = cognitoConfig.userPoolId || '';
    this.clientId = cognitoConfig.clientId || '';
    this.region = cognitoConfig.region || awsConfig.region || 'us-east-1';
  }

  /**
   * Performs authentication via AWS Cognito InitiateAuth (USER_PASSWORD_AUTH).
   * Falls back to dev credentials if dev account is requested or in development mode when unconfigured.
   */
  async login(dto: LoginRequest): Promise<AuthResponse> {
    const { email, password } = dto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    // Direct dev fallback for dev users
    if (email === 'dev@notebooklm.local' || email.startsWith('dev-')) {
      return this.devLogin(email);
    }

    if (!this.clientId) {
      this.logger.warn('COGNITO_CLIENT_ID not configured; using dev fallback login');
      return this.devLogin(email);
    }

    try {
      const response = await this.callCognito('AWSCognitoIdentityProviderService.InitiateAuth', {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const authResult = response.AuthenticationResult;
      if (!authResult || !authResult.IdToken) {
        throw new UnauthorizedException('Authentication failed: Missing token in Cognito response');
      }

      // Extract sub from ID token payload
      const userId = this.extractSubFromToken(authResult.IdToken) || '00000000-0000-7000-8000-000000000001';

      return {
        token: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
        user: {
          userId,
          email,
        },
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`Cognito InitiateAuth error: ${err.message || err}`);
      const errType = err.__type || err.name || '';
      if (errType.includes('NotAuthorizedException')) {
        throw new UnauthorizedException('Incorrect username or password');
      } else if (errType.includes('UserNotFoundException')) {
        throw new UnauthorizedException('User does not exist');
      } else if (errType.includes('UserNotConfirmedException')) {
        throw new UnauthorizedException('User account is not confirmed yet');
      }
      throw new UnauthorizedException(err.message || 'Authentication failed');
    }
  }

  /**
   * Registers a new user via AWS Cognito SignUp.
   */
  async signUp(dto: SignUpRequest): Promise<{ userSub: string; userConfirmed: boolean; message: string }> {
    const { email, password } = dto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    if (!this.clientId) {
      return {
        userSub: '00000000-0000-7000-8000-000000000001',
        userConfirmed: true,
        message: 'Dev registration successful',
      };
    }

    try {
      const response = await this.callCognito('AWSCognitoIdentityProviderService.SignUp', {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
        ],
      });

      return {
        userSub: response.UserSub,
        userConfirmed: !!response.UserConfirmed,
        message: response.UserConfirmed
          ? 'Registration successful'
          : 'Registration successful. Please check your email for the confirmation code.',
      };
    } catch (err: any) {
      this.logger.error(`Cognito SignUp error: ${err.message || err}`);
      const errType = err.__type || err.name || '';
      if (errType.includes('UsernameExistsException')) {
        throw new BadRequestException('An account with this email already exists');
      } else if (errType.includes('InvalidPasswordException')) {
        throw new BadRequestException('Password does not meet requirements (min 8 chars, 1 uppercase, 1 lowercase, 1 number)');
      }
      throw new BadRequestException(err.message || 'Registration failed');
    }
  }

  /**
   * Instant dev login for local developer workflows.
   */
  devLogin(email = 'dev@notebooklm.local'): AuthResponse {
    return {
      token: 'dev-token-default-user',
      user: {
        userId: '00000000-0000-7000-8000-000000000001',
        email,
      },
    };
  }

  /**
   * Helper to execute Cognito JSON 1.1 RPC calls.
   */
  private async callCognito(target: string, payload: Record<string, any>): Promise<any> {
    const url = `https://cognito-idp.${this.region}.amazonaws.com/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': target,
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json();
    if (!res.ok) {
      const error: any = new Error(data.message || data.__type || 'Cognito API error');
      error.__type = data.__type;
      throw error;
    }
    return data;
  }

  private extractSubFromToken(token: string): string | undefined {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        return payload.sub;
      }
    } catch {}
    return undefined;
  }
}
