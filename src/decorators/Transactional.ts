import { TransactionManager } from "../core/transaction-manager";

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

    descriptor.value = function (...args: any[]) {
      return TransactionManager.runInTransaction(
        () => originalMethod.apply(this, args),
        options.isolationLevel
      );
    };

    return descriptor;
  };
}
