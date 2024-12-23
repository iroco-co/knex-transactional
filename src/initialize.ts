import { TransactionManager } from "./core/transaction-manager";
import type { Knex } from "knex";

export function initializeTransactions(db: Knex):Knex {
  return TransactionManager.initialize(db);
}
