export interface ForecastInput {
  currentCrowd: number;
  platformCapacity: number;
  vehicleCapacity: number;
  nextVehicleArrival: number;
  recentCrowdGrowth: number;
  followingBusArrival: number;
}

export interface ForecastOutput {
  predictedCrowd: number;
  occupancy: number;
  risk: "NORMAL" | "WATCH" | "WARNING" | "HIGH" | "CRITICAL";
  riskExplanation: string;
}

export function calculateForecast(input: ForecastInput): ForecastOutput {
  const nextVehicleArrival = Math.max(0, input.nextVehicleArrival);
  const followingBusArrival = Math.max(nextVehicleArrival, input.followingBusArrival);
  const crowdGrowth = input.recentCrowdGrowth;
  
  const crowdAtNextVehicle = Math.max(0, input.currentCrowd + crowdGrowth * nextVehicleArrival);
  const crowdAfterNextVehicle = Math.max(0, crowdAtNextVehicle - input.vehicleCapacity);
  const predictedCrowd = Math.max(0, Math.round(crowdAfterNextVehicle + crowdGrowth * (followingBusArrival - nextVehicleArrival)));
  
  const occupancy = input.platformCapacity > 0 ? (predictedCrowd / input.platformCapacity) * 100 : 0;
  
  let risk: "NORMAL" | "WATCH" | "WARNING" | "HIGH" | "CRITICAL" = "NORMAL";
  if (occupancy >= 100) risk = "CRITICAL";
  else if (occupancy >= 95) risk = "HIGH";
  else if (occupancy >= 85) risk = "WARNING";
  else if (occupancy >= 70) risk = "WATCH";

  const available = Math.round(input.vehicleCapacity);
  let riskExplanation = "";
  if (risk === 'NORMAL') riskExplanation = 'Projected crowd remains within the normal operating range.';
  else if (risk === 'WATCH') riskExplanation = `Projected occupancy reaches ${occupancy.toFixed(1)}%; keep the platform under observation.`;
  else if (risk === 'WARNING') riskExplanation = `Projected occupancy reaches ${occupancy.toFixed(1)}%; prepare a controlled response.`;
  else if (risk === 'HIGH') riskExplanation = `Projected occupancy reaches ${occupancy.toFixed(1)}%; the next vehicle has ${available} boarding spaces.`;
  else riskExplanation = `Projected demand exceeds safe capacity at ${occupancy.toFixed(1)}%; act before the horizon closes.`;

  return { predictedCrowd, occupancy, risk, riskExplanation };
}
