import { Router } from "express";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { addAnnouncement, addAlert, getState } from "../store";

const router = Router();

router.post("/simulate", async (req, res) => {
  const { scenario, language, apiKey, model } = req.body;
  const lang = language || "English";
  
  const keyToUse = apiKey || process.env.GEMINI_API_KEY;
  const modelToUse = model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!keyToUse) {
    return res.status(400).json({ error: "No API key provided" });
  }

  const ai = new GoogleGenAI({ apiKey: keyToUse });

  const prompt = `
You are a Station & Platform Crowd Agent simulation.
Calculate the crowd forecast based on the following input data and recommend exactly ONE operational move.

Input Data:
- Current Crowd: ${scenario.currentCrowd} people
- Platform Capacity: ${scenario.platformCapacity} people
- Recent Crowd Growth: ${scenario.recentCrowdGrowth} people per minute
- Next vehicle arrives in: ${scenario.nextVehicleArrival} minutes
- Following bus arrives in: ${scenario.followingBusArrival} minutes
- Vehicle Capacity: ${scenario.vehicleCapacity} people

Tasks:
1. Calculate the predicted crowd when the following bus arrives. (Current Crowd + Growth * Following Bus Arrival - Vehicle Capacity * Number of vehicles).
2. Calculate the occupancy percentage at that time (predicted crowd / platform capacity * 100).
3. Determine the risk level ("NORMAL", "WATCH", "WARNING", "HIGH", "CRITICAL"). Normal < 70%, Watch >= 70%, Warning >= 85%, High >= 95%, Critical >= 100%.
4. Provide a short risk explanation.
5. Provide a short summary of the situation.
6. Recommend exactly ONE operational move (e.g., "OPEN_BAY_2", "HOLD_CONCOURSE", "REDIRECT_PASSENGERS").
7. Give a short reason for the recommended move.
8. Provide a PA announcement in ${lang} suitable for public broadcast. Ensure it is safe and non-threatening.
`;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      predictedCrowd: { type: Type.INTEGER },
      occupancy: { type: Type.NUMBER },
      riskLevel: { type: Type.STRING },
      riskExplanation: { type: Type.STRING },
      summary: { type: Type.STRING },
      recommendedMove: { type: Type.STRING },
      reason: { type: Type.STRING },
      paAnnouncement: { type: Type.STRING }
    },
    required: ["predictedCrowd", "occupancy", "riskLevel", "riskExplanation", "summary", "recommendedMove", "reason", "paAnnouncement"]
  };

  try {
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });
    
    if (response.text) {
      const parsed = JSON.parse(response.text);
      
      // Broadcast announcement to all connected clients (staff app, etc.)
      if (parsed.paAnnouncement) {
        addAnnouncement({
          language: lang,
          text: parsed.paAnnouncement,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'Gemini',
        });
      }
      
      // Generate an alert if the risk is elevated
      if (['WARNING', 'HIGH', 'CRITICAL'].includes(parsed.riskLevel)) {
        const now = Date.now();
        const severityMap: any = { 'WARNING': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL' };
        
        const platformId = req.body.platformId;
        const state = getState();
        const platform = state.platforms.find((p: any) => p.id === platformId);
        const locationName = platform ? platform.name : (platformId || 'Unknown Platform');
        
        addAlert({
          id: `INC-${Math.floor(Math.random() * 10000)}`,
          severity: severityMap[parsed.riskLevel],
          location: locationName,
          zone: 'Platform',
          title: parsed.summary || 'Elevated Crowd Risk',
          description: parsed.riskExplanation || 'Crowd density is rising',
          density: parsed.occupancy,
          threshold: parsed.riskLevel === 'CRITICAL' ? 100 : parsed.riskLevel === 'HIGH' ? 95 : 85,
          status: 'NEW',
          assignedTo: null,
          assignedName: null,
          createdAt: now,
          updatedAt: now,
          instructions: parsed.recommendedMove + ': ' + parsed.reason,
          timeline: [{ action: `AI Detected ${parsed.riskLevel} condition`, actor: 'AI System', time: now, type: 'critical' }]
        });
      }
      
      return res.json({
        forecast: {
          predictedCrowd: parsed.predictedCrowd,
          occupancy: parsed.occupancy,
          risk: parsed.riskLevel,
          riskExplanation: parsed.riskExplanation
        },
        aiAnalysis: {
          riskLevel: parsed.riskLevel,
          summary: parsed.summary,
          recommendedMove: parsed.recommendedMove,
          reason: parsed.reason,
          paAnnouncement: parsed.paAnnouncement
        }
      });
    } else {
      throw new Error("Empty response from Gemini");
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
