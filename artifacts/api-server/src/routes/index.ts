import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apiRoutes from "./api";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/v1", apiRoutes);

export default router;
