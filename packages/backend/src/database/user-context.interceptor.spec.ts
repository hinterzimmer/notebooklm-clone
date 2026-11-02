import test from 'node:test';
import assert from 'node:assert';
import { of, firstValueFrom } from 'rxjs';
import { UserContextInterceptor } from './user-context.interceptor.js';
import { UserContextService } from './user-context.service.js';

test('UserContextInterceptor unit tests', async (t) => {
  await t.test('wraps execution inside runWithUser when user is present on request', async () => {
    // given
    const userContextService = new UserContextService();
    const interceptor = new UserContextInterceptor(userContextService);

    let observedUserId: string | undefined;
    let observedTenantId: string | undefined;

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'u-cognito-999', tenantId: 't-123' },
        }),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => {
        observedUserId = userContextService.getUserId();
        observedTenantId = userContextService.getTenantId();
        return of({ success: true });
      },
    } as any;

    // when
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);

    // then
    assert.deepStrictEqual(result, { success: true });
    assert.strictEqual(observedUserId, 'u-cognito-999');
    assert.strictEqual(observedTenantId, 't-123');
    // Context is clean outside
    assert.strictEqual(userContextService.getUserId(), undefined);
  });

  await t.test('passes through unchanged when user is not present on request', async () => {
    // given
    const userContextService = new UserContextService();
    const interceptor = new UserContextInterceptor(userContextService);

    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => of({ publicData: true }),
    } as any;

    // when
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
    const result = await firstValueFrom(result$);

    // then
    assert.deepStrictEqual(result, { publicData: true });
    assert.strictEqual(userContextService.getUserId(), undefined);
  });
});
