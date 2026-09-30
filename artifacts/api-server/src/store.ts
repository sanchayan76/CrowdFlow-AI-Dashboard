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

export type Announcement = {
  language: string;
  text: string;
  timestamp: string;
  source: string;
};

export type AppState = {
  scenario: ScenarioInput;
  platforms: Platform[];
  alerts: Alert[];
  announcements: Announcement[];
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
  alerts: []
};

let announcements: Announcement[] = [];

const clients = new Set<(state: AppState) => void>();

export function getState() {
  return { ...state, announcements };
}

export function updateScenario(updates: Partial<ScenarioInput>, platformId?: string) {
  state.scenario = { ...state.scenario, ...updates };
  
  if (platformId) {
    state.platforms = state.platforms.map(p => {
      if (p.id === platformId) {
        return {
          ...p,
          crowd: updates.currentCrowd ?? p.crowd,
          capacity: updates.platformCapacity ?? p.capacity,
        };
      }
      return p;
    });
  }
  
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

export function addAlert(alert: Alert) {
  state.alerts = [alert, ...state.alerts];
  notifyClients();
}

export function subscribe(callback: (state: AppState) => void) {
  clients.add(callback);
  return () => clients.delete(callback);
}

export function addAnnouncement(announcement: Announcement) {
  announcements = [announcement, ...announcements].slice(0, 50);
  notifyClients();
}

function notifyClients() {
  const fullState = { ...state, announcements };
  clients.forEach(client => client(fullState));
}
