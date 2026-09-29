import { Router } from "express";
import { getState, subscribe, updateScenario, updateAlert } from "../store";

const router = Router();

router.get("/state", (req, res) => {
  res.json(getState());
});

router.post("/scenario", (req, res) => {
  updateScenario(req.body);
  res.json({ success: true });
});

router.post("/alert/:id", (req, res) => {
  const { id } = req.params;
  const { updates, timelineEntry } = req.body;
  updateAlert(id, updates, timelineEntry);
  res.json({ success: true });
});

router.get("/stream", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendState = (state: any) => {
    res.write(`data: ${JSON.stringify(state)}\n\n`);
  };

  sendState(getState());
  const unsubscribe = subscribe(sendState);

  req.on('close', () => {
    unsubscribe();
  });
});

export default router;
