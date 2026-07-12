import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import matchesRouter from "./matches";
import betsRouter from "./bets";
import walletRouter from "./wallet";
import withdrawalsRouter from "./withdrawals";
import jackpotsRouter from "./jackpots";
import usersRouter from "./users";
import adminRouter from "./admin";
import loyaltyRouter from "./loyalty";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(matchesRouter);
router.use(betsRouter);
router.use(walletRouter);
router.use(withdrawalsRouter);
router.use(jackpotsRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(loyaltyRouter);

export default router;
