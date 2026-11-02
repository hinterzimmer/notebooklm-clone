import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface UserContext {
  userId: string;
  tenantId?: string;
}

@Injectable()
export class UserContextService {
  private readonly als = new AsyncLocalStorage<UserContext>();

  runWithUser<T>(user: UserContext, callback: () => T): T {
    return this.als.run(user, callback);
  }

  setUser(user: UserContext): void {
    this.als.enterWith(user);
  }

  getUserId(): string | undefined {
    return this.als.getStore()?.userId;
  }

  getTenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }
}
