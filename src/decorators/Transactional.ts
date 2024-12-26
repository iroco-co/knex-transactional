import type { Knex } from "knex";
import { TransactionManager } from "../core/transaction-manager";

export function Transactional(options: Knex.TransactionConfig = {}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return TransactionManager.runInTransaction(
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}
