import type { Knex } from "knex";
import { TransactionManager } from "../core/transaction-manager";

interface TransactionOptions {
  isolationLevel?: Knex.IsolationLevels;
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
      const isolationLevel = options.isolationLevel;

      return TransactionManager.runInTransaction(
        () => originalMethod.apply(this, args),
        isolationLevel
      );
    };

    return descriptor;
  };
}
