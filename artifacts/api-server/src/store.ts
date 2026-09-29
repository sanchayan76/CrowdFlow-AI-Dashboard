export type ScenarioInput = {
  currentCrowd: number;
  platformCapacity: number;
  vehicleCapacity: number;
  nextVehicleArrival: number;
  recentCrowdGrowth: number;
  followingBusArrival: number;
};

export type Platform = {
  id: string;
  name: string;
  crowd: number;
  capacity: number;
  destination: string;
  next: string;
};

export type Alert = {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  zone: string;
  title: string;
  description: string;
  density: number;
  threshold: number;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED' | 'ESCALATED';
  assignedTo: string | null;
  assignedName: string | null;
  createdAt: number;
  updatedAt: number;
  instructions: string | null;
  timeline: { action: string; actor: string; time: number; type: 'info' | 'critical' | 'success' }[];
};

export type AppState = {
  scenario: ScenarioInput;
  platforms: Platform[];
  alerts: Alert[];
};

let state: AppState = {
  scenario: {
    currentCrowd: 0,
    platformCapacity: 0,
    vehicleCapacity: 0,
    nextVehicleArrival: 0,
    recentCrowdGrowth: 0,
    followingBusArrival: 0,
  },
  platforms: [],
  alerts: [],
};

const clients = new Set<(state: AppState) => void>();

export function getState() {
  return state;
}

export function updateScenario(updates: Partial<ScenarioInput>) {
  state.scenario = { ...state.scenario, ...updates };
  notifyClients();
}

export function updateAlert(id: string, updates: Partial<Alert>, timelineEntry?: Alert['timeline'][0]) {
  state.alerts = state.alerts.map(a => {
    if (a.id === id) {
      return {
        ...a,
        ...updates,
        updatedAt: Date.now(),
        timeline: timelineEntry ? [...a.timeline, timelineEntry] : a.timeline
      };
    }
    return a;
  });
  notifyClients();
}

export function subscribe(callback: (state: AppState) => void) {
  clients.add(callback);
  return () => clients.delete(callback);
}

function notifyClients() {
  clients.forEach(client => client(state));
}
