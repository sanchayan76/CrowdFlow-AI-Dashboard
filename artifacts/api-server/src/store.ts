export type ScenarioInput = {
  currentCrowd: number;
  platformCapacity: number;
  vehicleCapacity: number;
  nextVehicleArrival: number;
  recentCrowdGrowth: number;
  followingBusArrival: number;
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
  alerts: Alert[];
};

const now = Date.now();

let state: AppState = {
  scenario: {
    currentCrowd: 438,
    platformCapacity: 600,
    vehicleCapacity: 600,
    nextVehicleArrival: 7,
    recentCrowdGrowth: 18,
    followingBusArrival: 14,
  },
  alerts: [
    {
      id: 'INC-2401',
      severity: 'CRITICAL',
      location: 'GATE 03',
      zone: 'North Concourse',
      title: 'Crowd Density Exceeded',
      description: 'Crowd is building near the entrance. Entry flow rate has tripled in the last 5 minutes. Gate capacity approaching unsafe levels.',
      density: 92,
      threshold: 80,
      status: 'NEW',
      assignedTo: null,
      assignedName: null,
      createdAt: now - 12_000,
      updatedAt: now - 12_000,
      instructions: 'Redirect incoming foot traffic to Gate 04. Brief security team at north post. Prepare to hold concourse entry if density exceeds 95%.',
      timeline: [{ action: 'Alert generated — density 92% exceeded threshold 80%', actor: 'System', time: now - 12_000, type: 'critical' }],
    },
    {
      id: 'INC-2400',
      severity: 'HIGH',
      location: 'FOOD COURT — ZONE B',
      zone: 'East Wing',
      title: 'Unusual Crowd Buildup',
      description: 'Monitor entry flow and clear the exit. Crowd density rising steadily with no events scheduled in this zone.',
      density: 78,
      threshold: 75,
      status: 'ACKNOWLEDGED',
      assignedTo: 'staff-01',
      assignedName: 'Arjun Mehta',
      createdAt: now - 180_000,
      updatedAt: now - 60_000,
      instructions: 'Check if any informal gathering or promotion is causing the buildup. Clear exit paths and monitor for 10 minutes.',
      timeline: [
        { action: 'Alert generated — density 78% exceeded threshold 75%', actor: 'System', time: now - 180_000, type: 'critical' },
        { action: 'Acknowledged by Arjun Mehta', actor: 'Arjun Mehta', time: now - 60_000, type: 'info' },
      ],
    }
  ]
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
