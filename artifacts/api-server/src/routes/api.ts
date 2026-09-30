import { Router } from "express";
import { getState, subscribe, updateScenario, updateAlert } from "../store";

const router = Router();

router.get("/state", (req, res) => {
  res.json(getState());
});

router.post("/scenario", (req, res) => {
  const { scenario, platformId } = req.body;
  if (scenario) {
    updateScenario(scenario, platformId);
  }
  res.json({ success: true });
});

router.post("/alert/:id", (req, res) => {
  const { id } = req.params;
  const { updates, timelineEntry } = req.body;
  updateAlert(id, updates, timelineEntry);
  res.json({ success: true });
});

router.get("/stream", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendState = (state: any) => {
    res.write(`data: ${JSON.stringify(state)}\n\n`);
  };

  sendState(getState());
  const unsubscribe = subscribe(sendState);
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
