import { Knex } from "knex";

export interface TransactionOptions {
  isolationLevel?: Knex.IsolationLevels;
  readOnly?: boolean;
}

declare module "koa" {
  interface BaseContext {
    transaction?: Knex.Transaction;
  }
}
