import test from 'node:test';
import assert from 'node:assert';
import { AuthService } from './auth.service.js';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

test('AuthService unit tests', async (t) => {
  await t.test('login throws BadRequestException if email or password missing', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const service = new AuthService(mockConfigService);

    // when / then
    await assert.rejects(async () => {
      await service.login({ email: '', password: 'password' });
    }, BadRequestException);

    await assert.rejects(async () => {
      await service.login({ email: 'user@example.com', password: '' });
    }, BadRequestException);
  });

  await t.test('login returns dev login immediately when email is dev account', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: 'pool-1', clientId: 'client-1' } }),
    } as any;
    const service = new AuthService(mockConfigService);

    // when
    const result = await service.login({ email: 'dev@notebooklm.local', password: 'anyPassword123!' });

    // then
    assert.strictEqual(result.token, 'dev-token-default-user');
    assert.strictEqual(result.user.userId, '00000000-0000-7000-8000-000000000001');
    assert.strictEqual(result.user.email, 'dev@notebooklm.local');
  });

  await t.test('login falls back to dev login when clientId is not configured', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: '', clientId: '' } }),
    } as any;
    const service = new AuthService(mockConfigService);

    // when
    const result = await service.login({ email: 'test@example.com', password: 'password123' });

    // then
    assert.strictEqual(result.token, 'dev-token-default-user');
    assert.strictEqual(result.user.userId, '00000000-0000-7000-8000-000000000001');
    assert.strictEqual(result.user.email, 'test@example.com');
  });

  await t.test('login calls Cognito InitiateAuth and extracts token and user sub', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: 'us-east-1_pool', clientId: 'client-123', region: 'us-east-1' } }),
    } as any;
    const service = new AuthService(mockConfigService);

    const payload = Buffer.from(JSON.stringify({ sub: 'cognito-sub-12345' })).toString('base64');
    const mockIdToken = `header.${payload}.signature`;

    (service as any).callCognito = async (target: string, body: any) => {
      assert.strictEqual(target, 'AWSCognitoIdentityProviderService.InitiateAuth');
      assert.strictEqual(body.ClientId, 'client-123');
      assert.strictEqual(body.AuthParameters.USERNAME, 'realuser@example.com');
      return {
        AuthenticationResult: {
          IdToken: mockIdToken,
          RefreshToken: 'refresh-token-xyz',
        },
      };
    };

    // when
    const result = await service.login({ email: 'realuser@example.com', password: 'Password123!' });

    // then
    assert.strictEqual(result.token, mockIdToken);
    assert.strictEqual(result.refreshToken, 'refresh-token-xyz');
    assert.strictEqual(result.user.userId, 'cognito-sub-12345');
    assert.strictEqual(result.user.email, 'realuser@example.com');
  });

  await t.test('login handles NotAuthorizedException from Cognito', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: 'pool', clientId: 'client' } }),
    } as any;
    const service = new AuthService(mockConfigService);

    (service as any).callCognito = async () => {
      const err: any = new Error('Incorrect username or password');
      err.__type = 'NotAuthorizedException';
      throw err;
    };

    // when / then
    await assert.rejects(async () => {
      await service.login({ email: 'wrong@example.com', password: 'bad' });
    }, (err: any) => {
      assert.ok(err instanceof UnauthorizedException);
      assert.strictEqual(err.message, 'Incorrect username or password');
      return true;
    });
  });

  await t.test('signUp throws BadRequestException if email or password missing', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const service = new AuthService(mockConfigService);

    // when / then
    await assert.rejects(async () => {
      await service.signUp({ email: '', password: 'pwd' });
    }, BadRequestException);
  });

  await t.test('signUp succeeds with Cognito response', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: 'pool', clientId: 'client' } }),
    } as any;
    const service = new AuthService(mockConfigService);

    (service as any).callCognito = async (target: string, body: any) => {
      assert.strictEqual(target, 'AWSCognitoIdentityProviderService.SignUp');
      return {
        UserSub: 'sub-new-user',
        UserConfirmed: false,
      };
    };

    // when
    const result = await service.signUp({ email: 'new@example.com', password: 'Password123!' });

    // then
    assert.strictEqual(result.userSub, 'sub-new-user');
    assert.strictEqual(result.userConfirmed, false);
    assert.ok(result.message.includes('confirmation code'));
  });

  await t.test('devLogin returns developer credentials', () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const service = new AuthService(mockConfigService);

    // when
    const result = service.devLogin();

    // then
    assert.strictEqual(result.token, 'dev-token-default-user');
    assert.strictEqual(result.user.userId, '00000000-0000-7000-8000-000000000001');
  });
});
