import test from 'node:test';
import assert from 'node:assert';
import { AuthController } from './auth.controller.js';

test('AuthController unit tests', async (t) => {
  await t.test('login delegates to authService.login', async () => {
    // given
    let calledWith: any;
    const mockAuthService = {
      login: async (dto: any) => {
        calledWith = dto;
        return {
          token: 'jwt-token-123',
          user: { userId: 'u-1', email: dto.email },
        };
      },
    } as any;
    const controller = new AuthController(mockAuthService);

    // when
    const res = await controller.login({ email: 'user@example.com', password: 'secretPassword1!' });

    // then
    assert.strictEqual(calledWith.email, 'user@example.com');
    assert.strictEqual(res.token, 'jwt-token-123');
  });

  await t.test('signUp delegates to authService.signUp', async () => {
    // given
    let calledWith: any;
    const mockAuthService = {
      signUp: async (dto: any) => {
        calledWith = dto;
        return { userSub: 'sub-1', userConfirmed: true, message: 'Success' };
      },
    } as any;
    const controller = new AuthController(mockAuthService);

    // when
    const res = await controller.signUp({ email: 'new@example.com', password: 'Password123!' });

    // then
    assert.strictEqual(calledWith.email, 'new@example.com');
    assert.strictEqual(res.userSub, 'sub-1');
  });

  await t.test('devLogin delegates to authService.devLogin', async () => {
    // given
    const mockAuthService = {
      devLogin: () => ({
        token: 'dev-token-default-user',
        user: { userId: '00000000-0000-7000-8000-000000000001', email: 'dev@notebooklm.local' },
      }),
    } as any;
    const controller = new AuthController(mockAuthService);

    // when
    const res = await controller.devLogin();

    // then
    assert.strictEqual(res.token, 'dev-token-default-user');
    assert.strictEqual(res.user.userId, '00000000-0000-7000-8000-000000000001');
  });

  await t.test('getProfile returns user from request object', async () => {
    // given
    const controller = new AuthController({} as any);
    const mockReq = {
      user: { userId: 'u-456', email: 'me@example.com' },
    };

    // when
    const res = await controller.getProfile(mockReq);

    // then
    assert.deepStrictEqual(res.user, mockReq.user);
  });
});
