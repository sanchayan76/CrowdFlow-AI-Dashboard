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
  platforms: [
    { id: 'p1', name: 'Platform 01', crowd: 438, capacity: 600, destination: 'Northbound local', next: '2 min' },
    { id: 'p2', name: 'Platform 02', crowd: 512, capacity: 600, destination: 'Airport express', next: '8 min' },
    { id: 'p3', name: 'Platform 03', crowd: 276, capacity: 500, destination: 'Harbour line', next: '5 min' },
    { id: 'p4', name: 'Platform 04', crowd: 184, capacity: 450, destination: 'Riverside local', next: '11 min' },
  ],
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
    },
    {
      id: 'INC-2399',
      severity: 'MEDIUM',
      location: 'PLATFORM 02',
      zone: 'South Terminal',
      title: 'Elevated Occupancy',
      description: 'Platform approaching watch-level density. Next train arrives in 8 minutes. Monitoring crowd accumulation rate.',
      density: 71,
      threshold: 70,
      status: 'RESPONDING',
      assignedTo: 'staff-02',
      assignedName: 'Priya Nair',
      createdAt: now - 420_000,
      updatedAt: now - 90_000,
      instructions: 'Monitor boarding queue. If density rises above 80%, activate platform overflow protocol.',
      timeline: [
        { action: 'Alert generated — density 71% exceeded threshold 70%', actor: 'System', time: now - 420_000, type: 'info' },
        { action: 'Acknowledged by Priya Nair', actor: 'Priya Nair', time: now - 300_000, type: 'info' },
        { action: 'Priya Nair is responding', actor: 'Priya Nair', time: now - 90_000, type: 'info' },
      ],
    },
    {
      id: 'INC-2398',
      severity: 'HIGH',
      location: 'MAIN ENTRANCE',
      zone: 'Central Lobby',
      title: 'Ingress Bottleneck Detected',
      description: 'Security checkpoint causing significant queuing. Estimated wait exceeds 12 minutes during peak entry period.',
      density: 85,
      threshold: 80,
      status: 'NEW',
      assignedTo: null,
      assignedName: null,
      createdAt: now - 45_000,
      updatedAt: now - 45_000,
      instructions: 'Open auxiliary screening lanes. Deploy additional staff to manage queue. Consider opening Gate 02 for overflow.',
      timeline: [{ action: 'Alert generated — ingress bottleneck detected', actor: 'System', time: now - 45_000, type: 'critical' }],
    },
    {
      id: 'INC-2397',
      severity: 'LOW',
      location: 'PARKING — LEVEL 2',
      zone: 'West Structure',
      title: 'Moderate Foot Traffic',
      description: 'Elevated pedestrian movement between parking and venue. No immediate concern but tracking trend.',
      density: 45,
      threshold: 60,
      status: 'ACKNOWLEDGED',
      assignedTo: 'staff-01',
      assignedName: 'Arjun Mehta',
      createdAt: now - 600_000,
      updatedAt: now - 300_000,
      instructions: null,
      timeline: [
        { action: 'Alert generated — moderate foot traffic', actor: 'System', time: now - 600_000, type: 'info' },
        { action: 'Acknowledged by Arjun Mehta', actor: 'Arjun Mehta', time: now - 300_000, type: 'info' },
      ],
    },
    {
      id: 'INC-2396',
      severity: 'CRITICAL',
      location: 'EMERGENCY EXIT C',
      zone: 'South Terminal',
      title: 'Exit Route Obstructed',
      description: 'Emergency exit C partially blocked by vendor equipment. Immediate clearance required for safety compliance.',
      density: 0,
      threshold: 0,
      status: 'NEW',
      assignedTo: null,
      assignedName: null,
      createdAt: now - 30_000,
      updatedAt: now - 30_000,
      instructions: 'Remove obstruction immediately. Verify exit path is fully clear. Report compliance status to supervisor.',
      timeline: [{ action: 'Alert generated — exit route obstruction reported', actor: 'System', time: now - 30_000, type: 'critical' }],
    },
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
