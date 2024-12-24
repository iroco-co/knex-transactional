import { AsyncLocalStorage } from "async_hooks";

import { Knex } from "knex";

export class TransactionManager {
  private static storage = new AsyncLocalStorage<Map<string, any>>();
  private static originalDb: Knex;
  private static proxiedDb: Knex;

  static initialize(knexInstance: Knex): Knex {
    this.originalDb = knexInstance;

    this.proxiedDb = new Proxy(knexInstance, {
      get: (target: any, prop: string | symbol) => {
        if (prop === "__isProxy") {
          return true;
        }

        if (prop === "transaction") {
          return target[prop].bind(target);
        }

        const value = target[prop];
        if (typeof value === "function") {
          return (...args: any[]) => {
            const trx = TransactionManager.getTransaction();
            if (trx && prop !== "transaction") {
              return (trx as any)[prop](...args);
            }

            return value.apply(target, args);
          };
        }

        return value;
      },
      apply: (target: any, thisArg: any, argumentsList: any[]) => {
        const trx = TransactionManager.getTransaction();
        if (trx) {
          return trx(...argumentsList);
        }
        return target.apply(thisArg, argumentsList);
      },
    });

    return this.proxiedDb;
  }

  static async runInTransaction<T>(
    callback: () => Promise<T>,
    options: Knex.TransactionConfig
  ): Promise<T> {
    if (!this.originalDb) {
      throw new Error("Database not initialized");
    }

    const store = new Map<string, any>();

    return this.storage.run(store, async () => {
      const trx = await this.originalDb.transaction(options);

      store.set("transaction", trx);

      try {
        const result = await callback();
        await trx.commit();
        return result;
      } catch (error) {
        if (!trx.isCompleted()) {
          await trx.rollback();
        }
        throw error;
      } finally {
        store.delete("transaction");
      }
    });
  }

  static getTransaction(): Knex.Transaction | undefined {
    const store = this.storage.getStore();
    if (!store) {
      return undefined;
    }

    const trx = store.get("transaction");
    return trx;
  }
}
