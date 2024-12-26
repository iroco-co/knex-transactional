import type { Knex } from "knex";
import { TransactionManager } from "./transaction-manager";

export function initializeTransactions(db: Knex): Knex {
  return TransactionManager.initialize(db);
}
