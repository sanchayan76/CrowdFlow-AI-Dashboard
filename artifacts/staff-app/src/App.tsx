import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  ClipboardList,
  History,
  LogOut,
  MapPin,
  Search,
  Send,
  Shield,
  ShieldAlert,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type IncidentStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESPONDING' | 'RESOLVED' | 'ESCALATED';
type ConnectionState = 'connected' | 'reconnecting' | 'offline';

type StaffUser = {
  id: string;
  name: string;
  role: 'security' | 'crowd_control' | 'supervisor';
  roleLabel: string;
  available: boolean;
};

type Alert = {
  id: string;
  severity: Severity;
  location: string;
  zone: string;
  title: string;
  description: string;
  density: number;
  threshold: number;
  status: IncidentStatus;
  assignedTo: string | null;
  assignedName: string | null;
  createdAt: number;
  updatedAt: number;
  instructions: string | null;
  timeline: TimelineEntry[];
};

type TimelineEntry = {
  action: string;
  actor: string;
  time: number;
  type: 'info' | 'critical' | 'success';
};

type ActivityEntry = {
  id: string;
  alertId: string;
  action: string;
  location: string;
  actor: string;
  time: number;
};

// ────────────────────────────────────────────────────────────────────────────────
// DEMO DATA
// ────────────────────────────────────────────────────────────────────────────────

const DEMO_STAFF: StaffUser = {
  id: 'staff-01',
  name: 'Arjun Mehta',
  role: 'crowd_control',
  roleLabel: 'Crowd Control Officer',
  available: true,
};

function createDemoAlerts(): Alert[] {
  const now = Date.now();
  return [
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
      timeline: [
        { action: 'Alert generated — density 92% exceeded threshold 80%', actor: 'System', time: now - 12_000, type: 'critical' },
      ],
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
      timeline: [
        { action: 'Alert generated — ingress bottleneck detected', actor: 'System', time: now - 45_000, type: 'critical' },
      ],
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
      timeline: [
        { action: 'Alert generated — exit route obstruction reported', actor: 'System', time: now - 30_000, type: 'critical' },
      ],
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────────

type AppState = {
  user: StaffUser | null;
  alerts: Alert[];
  activity: ActivityEntry[];
  connection: ConnectionState;
  lastSync: number;
};

type AppAction =
  | { type: 'LOGIN'; user: StaffUser }
  | { type: 'LOGOUT' }
  | { type: 'SET_ALERTS'; alerts: Alert[] }
  | { type: 'UPDATE_ALERT'; id: string; changes: Partial<Alert>; entry?: TimelineEntry; activityAction?: string }
  | { type: 'SET_CONNECTION'; state: ConnectionState }
  | { type: 'SYNC' };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.user };
    case 'LOGOUT':
      return { ...state, user: null };
    case 'SET_ALERTS':
      return { ...state, alerts: action.alerts };
    case 'UPDATE_ALERT': {
      const now = Date.now();
      const alerts = state.alerts.map((a) =>
        a.id === action.id
          ? {
              ...a,
              ...action.changes,
              updatedAt: now,
              timeline: action.entry ? [...a.timeline, action.entry] : a.timeline,
            }
          : a,
      );
      const activity = action.activityAction
        ? [
            {
              id: `act-${now}`,
              alertId: action.id,
              action: action.activityAction,
              location: state.alerts.find((a) => a.id === action.id)?.location ?? '',
              actor: state.user?.name ?? 'Unknown',
              time: now,
            },
            ...state.activity,
          ]
        : state.activity;
      return { ...state, alerts, activity, lastSync: now };
    }
    case 'SET_CONNECTION':
      return { ...state, connection: action.state };
    case 'SYNC':
      return { ...state, lastSync: Date.now() };
    default:
      return state;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ────────────────────────────────────────────────────────────────────────────────

type StaffContextValue = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  acknowledgeAlert: (id: string) => void;
  claimAlert: (id: string) => void;
  respondAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  escalateAlert: (id: string) => void;
  addNote: (id: string, note: string) => void;
};

const StaffContext = createContext<StaffContextValue | null>(null);

function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('StaffContext not found');
  return ctx;
}

function StaffProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, {
    user: DEMO_STAFF,
    alerts: [],
    activity: [],
    connection: 'reconnecting',
    lastSync: Date.now(),
  });

  useEffect(() => {
    // Initial fetch
    fetch('/api/v1/state')
      .then(res => res.json())
      .then(data => {
        dispatch({ type: 'SET_ALERTS', alerts: data.alerts });
        dispatch({ type: 'SET_CONNECTION', state: 'connected' });
      })
      .catch(() => dispatch({ type: 'SET_CONNECTION', state: 'offline' }));

    // SSE connection
    const evtSource = new EventSource('/api/v1/stream');
    
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      dispatch({ type: 'SET_ALERTS', alerts: data.alerts });
      dispatch({ type: 'SET_CONNECTION', state: 'connected' });
      dispatch({ type: 'SYNC' });
    };

    evtSource.onerror = () => {
      dispatch({ type: 'SET_CONNECTION', state: 'offline' });
    };

    return () => evtSource.close();
  }, []);

  const userName = state.user?.name ?? 'Staff';

  const acknowledgeAlert = useCallback(
    (id: string) => {
      const entry = { action: `Acknowledged by ${userName}`, actor: userName, time: Date.now(), type: 'info' };
      fetch(`/api/v1/alert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { status: 'ACKNOWLEDGED' }, timelineEntry: entry }),
      });
      dispatch({
        type: 'UPDATE_ALERT',
        id,
        changes: { status: 'ACKNOWLEDGED' },
        entry,
        activityAction: 'Acknowledged alert',
      });
    },
    [userName],
  );

  const claimAlert = useCallback(
    (id: string) => {
      if (!state.user) return;
      const entry = { action: `Claimed by ${userName}`, actor: userName, time: Date.now(), type: 'info' };
      fetch(`/api/v1/alert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { assignedTo: state.user.id, assignedName: state.user.name, status: 'ACKNOWLEDGED' }, timelineEntry: entry }),
      });
      dispatch({
        type: 'UPDATE_ALERT',
        id,
        changes: { assignedTo: state.user.id, assignedName: state.user.name, status: 'ACKNOWLEDGED' },
        entry,
        activityAction: 'Claimed incident',
      });
    },
    [state.user, userName],
  );

  const respondAlert = useCallback(
    (id: string) => {
      const entry = { action: `${userName} is responding`, actor: userName, time: Date.now(), type: 'info' };
      fetch(`/api/v1/alert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { status: 'RESPONDING' }, timelineEntry: entry }),
      });
      dispatch({
        type: 'UPDATE_ALERT',
        id,
        changes: { status: 'RESPONDING' },
        entry,
        activityAction: 'Started responding',
      });
    },
    [userName],
  );

  const resolveAlert = useCallback(
    (id: string) => {
      const entry = { action: `Resolved by ${userName}`, actor: userName, time: Date.now(), type: 'success' };
      fetch(`/api/v1/alert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { status: 'RESOLVED' }, timelineEntry: entry }),
      });
      dispatch({
        type: 'UPDATE_ALERT',
        id,
        changes: { status: 'RESOLVED' },
        entry,
        activityAction: 'Resolved incident',
      });
    },
    [userName],
  );

  const escalateAlert = useCallback(
    (id: string) => {
      const entry = { action: `Escalated by ${userName}`, actor: userName, time: Date.now(), type: 'critical' };
      fetch(`/api/v1/alert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: { status: 'ESCALATED' }, timelineEntry: entry }),
      });
      dispatch({
        type: 'UPDATE_ALERT',
        id,
        changes: { status: 'ESCALATED' },
        entry,
        activityAction: 'Escalated to supervisor',
      });
    },
    [userName],
  );

  const addNote = useCallback(
    (id: string, note: string) => {
      const entry = { action: `Note: ${note}`, actor: userName, time: Date.now(), type: 'info' };
      fetch(`/api/v1/alert/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: {}, timelineEntry: entry }),
      });
      dispatch({
        type: 'UPDATE_ALERT',
        id,
        changes: {},
        entry,
        activityAction: `Added note: "${note}"`,
      });
    },
    [userName],
  );

  const value = useMemo(
    () => ({ state, dispatch, acknowledgeAlert, claimAlert, respondAlert, resolveAlert, escalateAlert, addNote }),
    [state, dispatch, acknowledgeAlert, claimAlert, respondAlert, resolveAlert, escalateAlert, addNote],
  );

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

// ────────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ────────────────────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function severityOrder(s: Severity): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[s];
}

function densityColor(density: number, threshold: number): string {
  if (density >= threshold) return 'var(--staff-critical)';
  if (density >= threshold * 0.9) return 'var(--staff-high)';
  if (density >= threshold * 0.75) return 'var(--staff-medium)';
  return 'var(--staff-success)';
}

// ────────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ────────────────────────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`severity-badge ${severity.toLowerCase()}`}>
      {severity === 'CRITICAL' && <CircleAlert size={11} />}
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`incident-status ${status.toLowerCase()}`}>{status}</span>;
}

function DensityBar({ density, threshold }: { density: number; threshold: number }) {
  if (threshold === 0) return null;
  return (
    <div className="density-bar">
      <div
        className="density-bar-fill"
        style={{ width: `${Math.min(100, density)}%`, background: densityColor(density, threshold) }}
      />
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`staff-toast ${type}`}>
      {type === 'success' && <CheckCircle2 size={18} />}
      {type === 'error' && <CircleAlert size={18} />}
      {type === 'info' && <Bell size={18} />}
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ opacity: 0.6 }}><X size={16} /></button>
    </div>
  );
}

function ConfirmDialog({
  title, message, confirmLabel, confirmType = 'primary', onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  confirmType?: 'primary' | 'danger' | 'success';
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: 13, color: 'var(--staff-text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="staff-action-btn secondary small" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
          <button className={`staff-action-btn ${confirmType} small`} onClick={onConfirm} style={{ flex: 1 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ────────────────────────────────────────────────────────────────────────────────

function LoginScreen() {
  const { dispatch } = useStaff();
  const [email, setEmail] = useState('arjun.mehta@crowdflow.io');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your staff email'); return; }
    setLoading(true);
    setError('');
    // Simulate login
    setTimeout(() => {
      dispatch({ type: 'LOGIN', user: DEMO_STAFF });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', marginBottom: 16 }}>
            <Shield size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>CrowdFlow <span style={{ color: 'var(--staff-brand-light)' }}>Staff</span></h1>
          <p style={{ fontSize: 13, color: 'var(--staff-text-secondary)', marginTop: 6 }}>Sign in to your staff account</p>
        </div>
        <form onSubmit={handleLogin}>
          <input
            className="login-input"
            type="email"
            placeholder="Staff email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p style={{ fontSize: 12, color: 'var(--staff-critical)', marginTop: 8 }}>{error}</p>}
          <button
            className="staff-action-btn primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 16 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: 'var(--staff-text-muted)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Demo mode — any credentials will sign in as a sample staff member.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// HEADER
// ────────────────────────────────────────────────────────────────────────────────

function AppHeader() {
  const { state } = useStaff();
  return (
    <header className="staff-header">
      <div className="staff-header-left">
        <div className="staff-header-brand">
          <Shield size={20} color="var(--staff-brand-light)" />
          CrowdFlow <span>Staff</span>
        </div>
      </div>
      <div className="staff-header-right">
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--staff-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.user?.available ? 'var(--staff-success)' : 'var(--staff-text-muted)' }} />
          {state.user?.available ? 'Available' : 'Busy'}
        </div>
        <button className="staff-icon-btn has-badge" aria-label="Notifications">
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}

function StatusBar() {
  const { state } = useStaff();
  const criticalCount = state.alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  const myCount = state.alerts.filter((a) => a.assignedTo === state.user?.id && a.status !== 'RESOLVED').length;
  const highRiskCount = state.alerts.filter((a) => (a.severity === 'CRITICAL' || a.severity === 'HIGH') && a.status !== 'RESOLVED').length;

  return (
    <div className="staff-status-bar">
      <div className="staff-status-item">
        <span className={`staff-status-dot ${state.connection}`} />
        <span style={{ color: state.connection === 'connected' ? 'var(--staff-success)' : state.connection === 'offline' ? 'var(--staff-critical)' : 'var(--staff-medium)' }}>
          {state.connection === 'connected' ? 'LIVE' : state.connection === 'offline' ? 'OFFLINE' : 'RECONNECTING'}
        </span>
        <span style={{ color: 'var(--staff-text-muted)' }}>·</span>
        <span style={{ color: 'var(--staff-text-muted)' }}>{formatTime(state.lastSync)}</span>
      </div>
      <div className="staff-status-item" style={{ color: criticalCount > 0 ? 'var(--staff-critical)' : 'var(--staff-text-secondary)' }}>
        <CircleAlert size={12} />
        <strong>{criticalCount}</strong> Critical
      </div>
      <div className="staff-status-item" style={{ color: 'var(--staff-brand-light)' }}>
        <ClipboardList size={12} />
        <strong>{myCount}</strong> Assigned
      </div>
      <div className="staff-status-item" style={{ color: highRiskCount > 0 ? 'var(--staff-high)' : 'var(--staff-text-secondary)' }}>
        <AlertTriangle size={12} />
        <strong>{highRiskCount}</strong> High risk
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ALERT CARD
// ────────────────────────────────────────────────────────────────────────────────

function AlertCard({ alert, onOpen }: { alert: Alert; onOpen: () => void }) {
  const { state, acknowledgeAlert, claimAlert } = useStaff();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);

  const isNew = alert.status === 'NEW';
  const isUnassigned = !alert.assignedTo;
  const isMine = alert.assignedTo === state.user?.id;

  const handlePrimaryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNew && isUnassigned) {
      claimAlert(alert.id);
      setToast({ msg: 'Incident claimed', type: 'success' });
    } else if (isNew && isMine) {
      acknowledgeAlert(alert.id);
      setToast({ msg: 'Alert acknowledged', type: 'success' });
    } else {
      onOpen();
    }
  };

  return (
    <>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className={`alert-card severity-${alert.severity.toLowerCase()}`} onClick={onOpen}>
        <div className="alert-card-header">
          <div>
            <div className="alert-card-location">
              <MapPin size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
              {alert.location}
              {alert.zone && <span style={{ color: 'var(--staff-text-muted)', fontWeight: 500 }}> · {alert.zone}</span>}
            </div>
            <div className="alert-card-title">{alert.title}</div>
          </div>
          <SeverityBadge severity={alert.severity} />
        </div>

        <div className="alert-card-body">
          {alert.density > 0 && (
            <div className="alert-card-metrics">
              <div className="alert-card-metric">
                Density: <strong style={{ color: densityColor(alert.density, alert.threshold) }}>{alert.density}%</strong>
              </div>
              {alert.threshold > 0 && (
                <div className="alert-card-metric">
                  Threshold: <strong>{alert.threshold}%</strong>
                </div>
              )}
            </div>
          )}
          {alert.density > 0 && alert.threshold > 0 && <DensityBar density={alert.density} threshold={alert.threshold} />}
          <div className="alert-card-desc">{alert.description}</div>
        </div>

        <div className="alert-card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="alert-card-time"><Clock size={12} /> {timeAgo(alert.updatedAt)}</div>
            <div className="alert-card-assignment">
              {alert.assignedName ? (
                <span style={{ color: 'var(--staff-brand-light)' }}>{isMine ? 'Assigned to you' : alert.assignedName}</span>
              ) : (
                <span>Unassigned</span>
              )}
            </div>
          </div>
          <button className="staff-action-btn primary small" onClick={handlePrimaryAction}>
            {isNew && isUnassigned ? (
              <><Zap size={13} /> Take</>
            ) : isNew ? (
              <><Check size={13} /> Ack</>
            ) : (
              <><ChevronRight size={14} /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// INCIDENT DETAIL
// ────────────────────────────────────────────────────────────────────────────────

function IncidentDetail({ alert, onBack }: { alert: Alert; onBack: () => void }) {
  const { state, acknowledgeAlert, claimAlert, respondAlert, resolveAlert, escalateAlert, addNote } = useStaff();
  const [noteText, setNoteText] = useState('');
  const [confirm, setConfirm] = useState<{ action: string; fn: () => void } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const isMine = alert.assignedTo === state.user?.id;
  const isUnassigned = !alert.assignedTo;

  const doAction = (label: string, fn: () => void, needsConfirm: boolean) => {
    if (needsConfirm && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH')) {
      setConfirm({ action: label, fn });
    } else {
      fn();
      setToast({ msg: label, type: 'success' });
    }
  };

  const handleConfirm = () => {
    if (confirm) {
      confirm.fn();
      setToast({ msg: confirm.action, type: 'success' });
      setConfirm(null);
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addNote(alert.id, noteText.trim());
    setNoteText('');
    setToast({ msg: 'Note added', type: 'info' });
  };

  const actions: Array<{ label: string; icon: ReactNode; type: string; fn: () => void; show: boolean; confirm: boolean }> = [
    { label: 'Acknowledge', icon: <Check size={15} />, type: 'primary', fn: () => acknowledgeAlert(alert.id), show: alert.status === 'NEW' && !isUnassigned, confirm: false },
    { label: 'Take Incident', icon: <Zap size={15} />, type: 'primary', fn: () => claimAlert(alert.id), show: isUnassigned, confirm: false },
    { label: 'Mark Responding', icon: <Send size={15} />, type: 'primary', fn: () => respondAlert(alert.id), show: alert.status === 'ACKNOWLEDGED' && (isMine || isUnassigned), confirm: false },
    { label: 'Resolve', icon: <CheckCircle2 size={15} />, type: 'success', fn: () => resolveAlert(alert.id), show: (alert.status === 'RESPONDING' || alert.status === 'ACKNOWLEDGED') && (isMine || isUnassigned), confirm: true },
    { label: 'Escalate to Supervisor', icon: <ShieldAlert size={15} />, type: 'danger', fn: () => escalateAlert(alert.id), show: alert.status !== 'RESOLVED' && alert.status !== 'ESCALATED', confirm: true },
  ];

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          title={`Confirm: ${confirm.action}`}
          message={`Are you sure you want to ${confirm.action.toLowerCase()} this ${alert.severity.toLowerCase()} severity incident at ${alert.location}?`}
          confirmLabel={confirm.action}
          confirmType={confirm.action.includes('Escalate') ? 'danger' : 'success'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={alert.status} />
          <SeverityBadge severity={alert.severity} />
        </div>
      </div>

      <div className="staff-content">
        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--staff-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            <MapPin size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
            {alert.location} · {alert.zone}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>{alert.title}</h1>
        </div>

        {/* Key Info */}
        <div className="detail-section">
          <div className="detail-row">
            <span className="detail-row-label">Incident ID</span>
            <span className="detail-row-value" style={{ fontFamily: 'monospace' }}>{alert.id}</span>
          </div>
          <div className="detail-row">
            <span className="detail-row-label">Severity</span>
            <SeverityBadge severity={alert.severity} />
          </div>
          {alert.density > 0 && (
            <>
              <div className="detail-row">
                <span className="detail-row-label">Current Density</span>
                <span className="detail-row-value" style={{ color: densityColor(alert.density, alert.threshold) }}>{alert.density}%</span>
              </div>
              <div className="detail-row">
                <span className="detail-row-label">Threshold</span>
                <span className="detail-row-value">{alert.threshold}%</span>
              </div>
            </>
          )}
          {alert.density > 0 && alert.threshold > 0 && (
            <div style={{ paddingTop: 8 }}>
              <DensityBar density={alert.density} threshold={alert.threshold} />
            </div>
          )}
          <div className="detail-row">
            <span className="detail-row-label">Detected</span>
            <span className="detail-row-value">{formatTime(alert.createdAt)} · {timeAgo(alert.createdAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-row-label">Last Updated</span>
            <span className="detail-row-value">{timeAgo(alert.updatedAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-row-label">Assigned</span>
            <span className="detail-row-value" style={{ color: alert.assignedName ? 'var(--staff-brand-light)' : 'var(--staff-text-muted)' }}>
              {alert.assignedName ?? 'Unassigned'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-row-label">Status</span>
            <StatusBadge status={alert.status} />
          </div>
        </div>

        {/* Description */}
        <div className="detail-section">
          <div className="staff-section-title">Description</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--staff-text-secondary)' }}>{alert.description}</p>
        </div>

        {/* Instructions */}
        {alert.instructions && (
          <div className="detail-section" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
            <div className="staff-section-title" style={{ color: 'var(--staff-brand-light)' }}>Recommended Response</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--staff-text)' }}>{alert.instructions}</p>
          </div>
        )}

        {/* Actions */}
        {alert.status !== 'RESOLVED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {actions.filter((a) => a.show).map((a) => (
              <button key={a.label} className={`staff-action-btn ${a.type}`} onClick={() => doAction(a.label, a.fn, a.confirm)}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Add Note */}
        {alert.status !== 'RESOLVED' && (
          <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              ref={noteInputRef}
              className="login-input"
              placeholder="Add a short note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{ fontSize: 13 }}
            />
            <button className="staff-action-btn secondary small" type="submit" disabled={!noteText.trim()} style={{ flexShrink: 0, width: 44 }}>
              <Send size={14} />
            </button>
          </form>
        )}

        {/* Timeline */}
        <div className="detail-section">
          <div className="staff-section-title">Activity Timeline</div>
          <div className="timeline">
            {[...alert.timeline].reverse().map((entry, i) => (
              <div key={i} className={`timeline-item ${entry.type}`}>
                <div style={{ fontWeight: 600, color: 'var(--staff-text)' }}>{entry.action}</div>
                <div className="timeline-time">{formatTime(entry.time)} · {timeAgo(entry.time)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ALERTS TAB
// ────────────────────────────────────────────────────────────────────────────────

type AlertFilter = 'all' | 'critical' | 'high' | 'mine' | 'unassigned';

function AlertsTab() {
  const { state } = useStaff();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeAlerts = state.alerts.filter((a) => a.status !== 'RESOLVED');

  const filtered = activeAlerts
    .filter((a) => {
      if (filter === 'critical') return a.severity === 'CRITICAL';
      if (filter === 'high') return a.severity === 'HIGH';
      if (filter === 'mine') return a.assignedTo === state.user?.id;
      if (filter === 'unassigned') return !a.assignedTo;
      return true;
    })
    .filter((a) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.location.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q);
    })
    .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity) || b.updatedAt - a.updatedAt);

  const selectedAlert = selectedId ? state.alerts.find((a) => a.id === selectedId) : null;

  if (selectedAlert) {
    return <IncidentDetail alert={selectedAlert} onBack={() => setSelectedId(null)} />;
  }

  const filterBtns: Array<{ key: AlertFilter; label: string; cls?: string }> = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical', cls: 'critical' },
    { key: 'high', label: 'High' },
    { key: 'mine', label: 'Assigned to me' },
    { key: 'unassigned', label: 'Unassigned' },
  ];

  return (
    <>
      <StatusBar />
      <div className="staff-search">
        <Search size={16} />
        <input placeholder="Search location or incident ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
      </div>
      <div className="staff-filters">
        {filterBtns.map(({ key, label, cls }) => (
          <button
            key={key}
            className={`staff-filter-btn ${cls ?? ''} ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="staff-content" style={{ paddingTop: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={40} />
            <p>{search ? 'No alerts match your search.' : 'No active alerts. All clear.'}</p>
          </div>
        ) : (
          filtered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onOpen={() => setSelectedId(alert.id)} />
          ))
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// MY TASKS TAB
// ────────────────────────────────────────────────────────────────────────────────

function MyTasksTab() {
  const { state } = useStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const myTasks = state.alerts
    .filter((a) => a.assignedTo === state.user?.id)
    .sort((a, b) => {
      if (a.status === 'RESOLVED' && b.status !== 'RESOLVED') return 1;
      if (a.status !== 'RESOLVED' && b.status === 'RESOLVED') return -1;
      return severityOrder(a.severity) - severityOrder(b.severity) || b.updatedAt - a.updatedAt;
    });

  const selectedAlert = selectedId ? state.alerts.find((a) => a.id === selectedId) : null;

  if (selectedAlert) {
    return <IncidentDetail alert={selectedAlert} onBack={() => setSelectedId(null)} />;
  }

  const active = myTasks.filter((t) => t.status !== 'RESOLVED');
  const resolved = myTasks.filter((t) => t.status === 'RESOLVED');

  return (
    <div className="staff-content">
      <div className="staff-section-title">Active ({active.length})</div>
      {active.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 24px' }}>
          <ClipboardList size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <p>No active tasks assigned to you.</p>
        </div>
      ) : (
        active.map((alert) => (
          <AlertCard key={alert.id} alert={alert} onOpen={() => setSelectedId(alert.id)} />
        ))
      )}

      {resolved.length > 0 && (
        <>
          <div className="staff-section-title" style={{ marginTop: 24 }}>Resolved ({resolved.length})</div>
          {resolved.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onOpen={() => setSelectedId(alert.id)} />
          ))}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// ACTIVITY TAB
// ────────────────────────────────────────────────────────────────────────────────

function ActivityTab() {
  const { state } = useStaff();

  return (
    <div className="staff-content">
      <div className="staff-section-title">Recent Activity</div>
      {state.activity.length === 0 ? (
        <div className="empty-state">
          <History size={36} />
          <p>No activity yet. Actions you take on alerts will appear here.</p>
        </div>
      ) : (
        <div className="detail-section" style={{ padding: 0, overflow: 'hidden' }}>
          {state.activity.slice(0, 50).map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                borderBottom: '1px solid var(--staff-border)',
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'var(--staff-surface-raised)',
                  display: 'grid', placeItems: 'center',
                  color: 'var(--staff-brand-light)',
                }}
              >
                <History size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{entry.action}</div>
                <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace' }}>{entry.alertId}</span>
                  <span>·</span>
                  <span>{entry.location}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', flexShrink: 0 }}>
                {timeAgo(entry.time)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ────────────────────────────────────────────────────────────────────────────────

function ProfileTab() {
  const { state, dispatch } = useStaff();
  const [notifEnabled, setNotifEnabled] = useState(false);

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === 'granted');
  };

  useEffect(() => {
    if ('Notification' in window) {
      setNotifEnabled(Notification.permission === 'granted');
    }
  }, []);

  if (!state.user) return null;

  return (
    <div className="staff-content">
      {/* Profile Card */}
      <div className="detail-section" style={{ textAlign: 'center', padding: 24 }}>
        <div className="profile-avatar" style={{ margin: '0 auto 12px' }}>
          {state.user.name.split(' ').map((n) => n[0]).join('')}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{state.user.name}</h2>
        <p style={{ fontSize: 13, color: 'var(--staff-text-secondary)', marginTop: 4 }}>{state.user.roleLabel}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: 12, color: 'var(--staff-success)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--staff-success)' }} />
          Available
        </div>
      </div>

      {/* Settings */}
      <div className="detail-section">
        <div className="staff-section-title">Settings</div>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0', borderBottom: '1px solid var(--staff-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={16} color="var(--staff-text-secondary)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Push Notifications</span>
          </div>
          <button
            className={`staff-action-btn small ${notifEnabled ? 'success' : 'secondary'}`}
            onClick={requestNotifications}
            style={{ width: 'auto', height: 32, fontSize: 11 }}
          >
            {notifEnabled ? <><Check size={12} /> Enabled</> : 'Enable'}
          </button>
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wifi size={16} color="var(--staff-text-secondary)" />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Connection</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--staff-success)', fontWeight: 600 }}>
            {state.connection === 'connected' ? 'Connected' : state.connection}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="detail-section">
        <div className="staff-section-title">Session Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'var(--staff-bg)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--staff-brand-light)' }}>
              {state.activity.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', marginTop: 4 }}>Actions taken</div>
          </div>
          <div style={{ background: 'var(--staff-bg)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--staff-success)' }}>
              {state.alerts.filter((a) => a.status === 'RESOLVED' && a.assignedTo === state.user?.id).length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', marginTop: 4 }}>Resolved</div>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <button
        className="staff-action-btn danger"
        style={{ marginTop: 8 }}
        onClick={() => dispatch({ type: 'LOGOUT' })}
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// BOTTOM NAVIGATION
// ────────────────────────────────────────────────────────────────────────────────

type Tab = 'alerts' | 'tasks' | 'activity' | 'profile';

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { state } = useStaff();
  const criticalCount = state.alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  const myTaskCount = state.alerts.filter((a) => a.assignedTo === state.user?.id && a.status !== 'RESOLVED').length;

  const items: Array<{ key: Tab; label: string; icon: ReactNode; badge?: number }> = [
    { key: 'alerts', label: 'Alerts', icon: <AlertTriangle size={20} />, badge: criticalCount > 0 ? criticalCount : undefined },
    { key: 'tasks', label: 'My Tasks', icon: <ClipboardList size={20} />, badge: myTaskCount > 0 ? myTaskCount : undefined },
    { key: 'activity', label: 'Activity', icon: <History size={20} /> },
    { key: 'profile', label: 'Profile', icon: <User size={20} /> },
  ];

  return (
    <nav className="staff-bottom-nav">
      {items.map(({ key, label, icon, badge }) => (
        <button key={key} className={`staff-nav-item ${tab === key ? 'active' : ''}`} onClick={() => onTab(key)}>
          {icon}
          <span>{label}</span>
          {badge != null && badge > 0 && <span className="staff-nav-badge">{badge}</span>}
        </button>
      ))}
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ────────────────────────────────────────────────────────────────────────────────

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>('alerts');

  return (
    <div className="staff-app">
      <div className="demo-banner">
        <Shield size={12} /> DEMO MODE — Sample data for demonstration
      </div>
      <AppHeader />
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'tasks' && <MyTasksTab />}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'profile' && <ProfileTab />}
      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}

export default function App() {
  return (
    <StaffProvider>
      <AuthenticatedApp />
    </StaffProvider>
  );
}
