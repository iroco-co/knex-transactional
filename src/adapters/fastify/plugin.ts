import { FastifyPluginAsync } from "fastify";
import { TransactionManager } from "../../core/transaction-manager";

export const fastifyTransactionPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", async () => {
    return TransactionManager.runInTransaction(async () => {});
  });
};
