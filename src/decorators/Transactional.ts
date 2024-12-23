import { AsyncLocalStorage } from "async_hooks";

import { Knex } from "knex";

import { getKnexInstance } from "../initialize";

const transactionStorage = new AsyncLocalStorage<Knex.Transaction>();

export function getCurrentTransaction(): Knex.Transaction | undefined {
  return transactionStorage.getStore();
}

interface TransactionOptions {
  isolationLevel?:
    | "read uncommitted"
    | "read committed"
    | "repeatable read"
    | "serializable";
  readOnly?: boolean;
}

export function Transactional(options: TransactionOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (getCurrentTransaction()) {
        return originalMethod.apply(this, args);
      }

      const knex = getKnexInstance();
      const trx = await knex.transaction({
        isolationLevel: options.isolationLevel,
        readOnly: options.readOnly,
      });

      try {
        return await new Promise((resolve, reject) => {
          transactionStorage.run(trx, async () => {
            try {
              const methodResult = await originalMethod.apply(this, args);
              await trx.commit();
              resolve(methodResult);
            } catch (err) {
              await trx.rollback();
              reject(err);
            }
          });
        });
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    };

    return descriptor;
  };
}
