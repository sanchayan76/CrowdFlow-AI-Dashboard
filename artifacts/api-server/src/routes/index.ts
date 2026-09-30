import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiRoutes from "./api";
import simulationRouter from "./simulation";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1", apiRoutes);
router.use("/v1", simulationRouter);

export default router;
