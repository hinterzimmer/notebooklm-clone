import test from 'node:test';
import assert from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';
import { CognitoAuthGuard } from './cognito.guard.js';

test('CognitoAuthGuard unit tests', async (t) => {
  const createMockContext = (headers: Record<string, string> = {}, query: Record<string, string> = {}) => {
    const request: any = {
      headers,
      query,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  };

  await t.test('throws UnauthorizedException when token is missing', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const mockUserContext = {} as any;
    const guard = new CognitoAuthGuard(mockConfigService, mockUserContext);
    const { switchToHttp } = createMockContext();

    // when
    let error: any;
    try {
      await guard.canActivate({ switchToHttp } as any);
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof UnauthorizedException);
    assert.strictEqual(error.message, 'Missing Authorization Bearer token');
  });

  await t.test('accepts dev-token and sets default developer user context', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const mockUserContext = {} as any;
    const guard = new CognitoAuthGuard(mockConfigService, mockUserContext);
    const { switchToHttp, request } = createMockContext({ authorization: 'Bearer dev-token-sample' });

    // when
    const result = await guard.canActivate({ switchToHttp } as any);

    // then
    assert.strictEqual(result, true);
    assert.strictEqual(request.user.userId, '00000000-0000-7000-8000-000000000001');
  });

  await t.test('extracts token from query parameter if header is not present', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const mockUserContext = {} as any;
    const guard = new CognitoAuthGuard(mockConfigService, mockUserContext);
    const { switchToHttp, request } = createMockContext({}, { token: 'dev-token-from-query' });

    // when
    const result = await guard.canActivate({ switchToHttp } as any);

    // then
    assert.strictEqual(result, true);
    assert.strictEqual(request.user.userId, '00000000-0000-7000-8000-000000000001');
  });

  await t.test('verifies valid Cognito token with verifier and sets userId and tenantId', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: 'us-east-1_pool', clientId: 'client-1' } }),
    } as any;
    let userContextSet = false;
    const mockUserContext = {
      runWithUser: (user: any, cb: any) => {
        userContextSet = true;
        return cb();
      },
    } as any;
    const guard = new CognitoAuthGuard(mockConfigService, mockUserContext);
    (guard as any).verifier = {
      verify: async (token: string) => ({
        sub: 'cognito-user-999',
        'custom:tenant_id': 'tenant-888',
      }),
    };
    const { switchToHttp, request } = createMockContext({ authorization: 'Bearer real-cognito-jwt' });

    // when
    const result = await guard.canActivate({ switchToHttp } as any);

    // then
    assert.strictEqual(result, true);
    assert.strictEqual(request.user.userId, 'cognito-user-999');
    assert.strictEqual(request.user.tenantId, 'tenant-888');
    assert.strictEqual(userContextSet, true);
  });

  await t.test('throws UnauthorizedException when verifier fails verification', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: { userPoolId: 'us-east-1_pool12345', clientId: 'client123' } }),
    } as any;
    const guard = new CognitoAuthGuard(mockConfigService, {} as any);
    (guard as any).verifier = {
      verify: async () => {
        throw new Error('Token expired');
      },
    };
    const { switchToHttp } = createMockContext({ authorization: 'Bearer expired-jwt' });

    // when
    let error: any;
    try {
      await guard.canActivate({ switchToHttp } as any);
    } catch (err) {
      error = err;
    }

    // then
    assert.ok(error instanceof UnauthorizedException);
    assert.strictEqual(error.message, 'Invalid or expired Cognito JWT token');
  });

  await t.test('uses fallback base64 decoder when verifier is not configured', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const guard = new CognitoAuthGuard(mockConfigService, {} as any);
    const payload = Buffer.from(JSON.stringify({ sub: 'user-sub-decoded' })).toString('base64');
    const jwtToken = `header.${payload}.signature`;
    const { switchToHttp, request } = createMockContext({ authorization: `Bearer ${jwtToken}` });

    // when
    const result = await guard.canActivate({ switchToHttp } as any);

    // then
    assert.strictEqual(result, true);
    assert.strictEqual(request.user.userId, 'user-sub-decoded');
  });

  await t.test('bypasses authentication when @Public() metadata is present', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    const mockReflector = {
      getAllAndOverride: (key: string) => key === 'isPublic',
    } as any;
    const guard = new CognitoAuthGuard(mockConfigService, {} as any, mockReflector);
    const mockContext = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as any;

    // when
    const result = await guard.canActivate(mockContext);

    // then
    assert.strictEqual(result, true);
  });

  await t.test('invokes setUser on userContextService when token is valid', async () => {
    // given
    const mockConfigService = {
      get: () => ({ cognito: {} }),
    } as any;
    let setUserCalledWith: any;
    const mockUserContext = {
      setUser: (user: any) => {
        setUserCalledWith = user;
      },
    } as any;
    const guard = new CognitoAuthGuard(mockConfigService, mockUserContext);
    const { switchToHttp } = createMockContext({ authorization: 'Bearer dev-token-check' });

    // when
    const result = await guard.canActivate({ switchToHttp } as any);

    // then
    assert.strictEqual(result, true);
    assert.strictEqual(setUserCalledWith.userId, '00000000-0000-7000-8000-000000000001');
  });
});

