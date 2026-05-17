import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import matchesRouter from "./matches";
import betsRouter from "./bets";
import walletRouter from "./wallet";
import jackpotsRouter from "./jackpots";
import usersRouter from "./users";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(matchesRouter);
router.use(betsRouter);
router.use(walletRouter);
router.use(jackpotsRouter);
router.use(usersRouter);
router.use(adminRouter);

export default router;
