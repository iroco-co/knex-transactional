import { TransactionManager } from "./core/transaction-manager";
import type { Knex } from "knex";

export function initializeTransactions(db: Knex) {
  TransactionManager.initialize(db);
}
