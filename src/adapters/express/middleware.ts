import { Request, Response, NextFunction } from "express";
import { TransactionManager } from "../../core/transaction-manager";

export function expressTransactionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  TransactionManager.runInTransaction(() => {
    return new Promise((resolve) => {
      next();
      res.on("finish", resolve);
    });
  }).catch(next);
}
