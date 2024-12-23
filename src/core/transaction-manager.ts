import { AsyncLocalStorage } from "async_hooks";
import { Knex } from "knex";

interface KnexTransaction extends Knex.Transaction {
  client: any;
  config?: {
    isolationLevel?: Knex.IsolationLevels;
  };
}

export class TransactionManager {
  private static storage = new AsyncLocalStorage<Map<string, any>>();
  private static db: Knex;

  static initialize(knexInstance: Knex) {
    this.db = knexInstance;

    const proxiedDb = new Proxy(knexInstance, {
      get: (target: any, prop: string | symbol) => {
        if (typeof target[prop] === "function" && prop !== "client") {
          return function (...args: any[]) {
            const trx = TransactionManager.getTransaction();
            console.log(`DB Method called: ${String(prop)}`, {
              hasTransaction: !!trx,
              args,
            });

            if (trx) {
              return (trx as any)[prop].apply(trx, args);
            }
            return target[prop].apply(target, args);
          };
        }

        if (prop === "client") {
          return new Proxy(target.client, {
            get: (clientTarget: any, clientProp: string | symbol) => {
              if (clientProp === "query") {
                return async function (
                  conn: any,
                  sql: any,
                  status: any,
                  value: any
                ) {
                  const trx =
                    TransactionManager.getTransaction() as KnexTransaction;
                  console.log("Raw query execution:", {
                    sql,
                    hasTransaction: !!trx,
                    connectionId: conn?.processID,
                  });

                  if (trx) {
                    return trx.client
                      .query(conn, sql, status, value)
                      .catch((err: any) => {
                        console.error("Query error:", err);
                        throw err;
                      });
                  }
                  return clientTarget.query.call(
                    clientTarget,
                    conn,
                    sql,
                    status,
                    value
                  );
                };
              }
              return clientTarget[clientProp];
            },
          });
        }
        return target[prop];
      },
    });

    this.db = proxiedDb;
    return proxiedDb;
  }

  static async runInTransaction<T>(
    callback: () => Promise<T>,
    isolationLevel?: string
  ): Promise<T> {
    const store = new Map<string, any>();

    return this.storage.run(store, async () => {
      console.log("Starting transaction");

      const normalizedIsolationLevel =
        isolationLevel?.toLowerCase() as Knex.IsolationLevels;

      const trx = (await this.db.transaction({
        isolationLevel: normalizedIsolationLevel,
      })) as KnexTransaction;

      store.set("transaction", trx);
      console.log("Transaction created");

      try {
        const result = await callback();
        await trx.commit();
        console.log("Transaction committed");
        return result;
      } catch (error) {
        console.error("Transaction error, rolling back:", error);
        await trx.rollback(error);
        throw error;
      }
    });
  }

  static getTransaction(): Knex.Transaction | undefined {
    const store = this.storage.getStore();
    if (!store) {
      console.log("No active storage");
      return undefined;
    }
    return store.get("transaction");
  }
}
