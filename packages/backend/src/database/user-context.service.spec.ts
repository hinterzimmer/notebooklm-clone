import test from 'node:test';
import assert from 'node:assert';
import { UserContextService } from './user-context.service.js';

test('UserContextService tests', async (t) => {
  await t.test('returns undefined outside of runWithUser context', () => {
    // given
    const service = new UserContextService();

    // when
    const userId = service.getUserId();
    const tenantId = service.getTenantId();

    // then
    assert.strictEqual(userId, undefined);
    assert.strictEqual(tenantId, undefined);
  });

  await t.test('returns userId and tenantId within runWithUser context', async () => {
    // given
    const service = new UserContextService();
    const contextUser = { userId: 'u-123', tenantId: 't-456' };

    // when
    const result = await service.runWithUser(contextUser, async () => {
      const innerUserId = service.getUserId();
      const innerTenantId = service.getTenantId();
      return { innerUserId, innerTenantId };
    });

    // then
    assert.strictEqual(result.innerUserId, 'u-123');
    assert.strictEqual(result.innerTenantId, 't-456');
    assert.strictEqual(service.getUserId(), undefined);
  });

  await t.test('maintains isolation between concurrent user contexts', async () => {
    // given
    const service = new UserContextService();

    // when
    const [resA, resB] = await Promise.all([
      service.runWithUser({ userId: 'user-A' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getUserId();
      }),
      service.runWithUser({ userId: 'user-B' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return service.getUserId();
      }),
    ]);

    // then
    assert.strictEqual(resA, 'user-A');
    assert.strictEqual(resB, 'user-B');
  });

  await t.test('setUser sets context via enterWith for subsequent execution', async () => {
    // given
    const service = new UserContextService();

    // when
    service.setUser({ userId: 'entered-user', tenantId: 'entered-tenant' });

    // then
    assert.strictEqual(service.getUserId(), 'entered-user');
    assert.strictEqual(service.getTenantId(), 'entered-tenant');
  });
});
