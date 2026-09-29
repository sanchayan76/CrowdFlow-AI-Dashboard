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
  MapPin,
  Radio,
  Search,
  Send,
  Shield,
  ShieldAlert,
  TrendingUp,
  TrainFront,
  Users,
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

type Platform = {
  id: string;
  name: string;
  crowd: number;
  capacity: number;
  destination: string;
  next: string;
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
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────

const DEMO_STAFF: StaffUser = {
  id: 'staff-01',
  name: 'Arjun Mehta',
  role: 'crowd_control',
  roleLabel: 'Crowd Control Officer',
  available: true,
};

const API_BASE = import.meta.env.VITE_API_URL || '';

// ────────────────────────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────────

type AppState = {
  user: StaffUser;
  alerts: Alert[];
  platforms: Platform[];
  activity: ActivityEntry[];
  connection: ConnectionState;
  lastSync: number;
};

type AppAction =
  | { type: 'SET_ALERTS'; alerts: Alert[] }
  | { type: 'SET_PLATFORMS'; platforms: Platform[] }
  | { type: 'UPDATE_ALERT'; id: string; changes: Partial<Alert>; entry?: TimelineEntry; activityAction?: string }
  | { type: 'SET_CONNECTION'; state: ConnectionState }
  | { type: 'SYNC' };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ALERTS':
      return { ...state, alerts: action.alerts, lastSync: Date.now() };
    case 'SET_PLATFORMS':
      return { ...state, platforms: action.platforms };
    case 'UPDATE_ALERT': {
      const now = Date.now();
      const alerts = state.alerts.map((a) =>
        a.id === action.id
          ? { ...a, ...action.changes, updatedAt: now, timeline: action.entry ? [...a.timeline, action.entry] : a.timeline }
          : a,
      );
      const activity = action.activityAction
        ? [{ id: `act-${now}`, alertId: action.id, action: action.activityAction, location: state.alerts.find((a) => a.id === action.id)?.location ?? '', actor: state.user.name, time: now }, ...state.activity]
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
    platforms: [],
    activity: [],
    connection: 'reconnecting',
    lastSync: Date.now(),
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/state`)
      .then(res => res.json())
      .then(data => {
        if (data.alerts) dispatch({ type: 'SET_ALERTS', alerts: data.alerts });
        if (data.platforms) dispatch({ type: 'SET_PLATFORMS', platforms: data.platforms });
        dispatch({ type: 'SET_CONNECTION', state: 'connected' });
      })
      .catch(() => dispatch({ type: 'SET_CONNECTION', state: 'offline' }));

    const evtSource = new EventSource(`${API_BASE}/api/v1/stream`);
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.alerts) dispatch({ type: 'SET_ALERTS', alerts: data.alerts });
      if (data.platforms) dispatch({ type: 'SET_PLATFORMS', platforms: data.platforms });
      dispatch({ type: 'SET_CONNECTION', state: 'connected' });
      dispatch({ type: 'SYNC' });
    };
    evtSource.onerror = () => {
      dispatch({ type: 'SET_CONNECTION', state: 'offline' });
    };
    return () => evtSource.close();
  }, []);

  const userName = state.user.name;

  const postAlert = (id: string, updates: object, timelineEntry: object) => {
    fetch(`${API_BASE}/api/v1/alert/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, timelineEntry }),
    });
  };

  const acknowledgeAlert = useCallback((id: string) => {
    const entry: TimelineEntry = { action: `Acknowledged by ${userName}`, actor: userName, time: Date.now(), type: 'info' };
    postAlert(id, { status: 'ACKNOWLEDGED' }, entry);
    dispatch({ type: 'UPDATE_ALERT', id, changes: { status: 'ACKNOWLEDGED' }, entry, activityAction: 'Acknowledged alert' });
  }, [userName]);

  const claimAlert = useCallback((id: string) => {
    const entry: TimelineEntry = { action: `Claimed by ${userName}`, actor: userName, time: Date.now(), type: 'info' };
    postAlert(id, { assignedTo: state.user.id, assignedName: userName, status: 'ACKNOWLEDGED' }, entry);
    dispatch({ type: 'UPDATE_ALERT', id, changes: { assignedTo: state.user.id, assignedName: userName, status: 'ACKNOWLEDGED' }, entry, activityAction: 'Claimed incident' });
  }, [state.user.id, userName]);

  const respondAlert = useCallback((id: string) => {
    const entry: TimelineEntry = { action: `${userName} is responding`, actor: userName, time: Date.now(), type: 'info' };
    postAlert(id, { status: 'RESPONDING' }, entry);
    dispatch({ type: 'UPDATE_ALERT', id, changes: { status: 'RESPONDING' }, entry, activityAction: 'Started responding' });
  }, [userName]);

  const resolveAlert = useCallback((id: string) => {
    const entry: TimelineEntry = { action: `Resolved by ${userName}`, actor: userName, time: Date.now(), type: 'success' };
    postAlert(id, { status: 'RESOLVED' }, entry);
    dispatch({ type: 'UPDATE_ALERT', id, changes: { status: 'RESOLVED' }, entry, activityAction: 'Resolved incident' });
  }, [userName]);

  const escalateAlert = useCallback((id: string) => {
    const entry: TimelineEntry = { action: `Escalated by ${userName}`, actor: userName, time: Date.now(), type: 'critical' };
    postAlert(id, { status: 'ESCALATED' }, entry);
    dispatch({ type: 'UPDATE_ALERT', id, changes: { status: 'ESCALATED' }, entry, activityAction: 'Escalated to supervisor' });
  }, [userName]);

  const addNote = useCallback((id: string, note: string) => {
    const entry: TimelineEntry = { action: `Note: ${note}`, actor: userName, time: Date.now(), type: 'info' };
    postAlert(id, {}, entry);
    dispatch({ type: 'UPDATE_ALERT', id, changes: {}, entry, activityAction: `Added note: "${note}"` });
  }, [userName]);

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
  if (threshold === 0) return 'var(--staff-text-secondary)';
  if (density >= threshold) return 'var(--staff-critical)';
  if (density >= threshold * 0.9) return 'var(--staff-high)';
  if (density >= threshold * 0.75) return 'var(--staff-medium)';
  return 'var(--staff-success)';
}

function platformRisk(crowd: number, capacity: number): Severity {
  const occupancy = (crowd / capacity) * 100;
  if (occupancy >= 100) return 'CRITICAL';
  if (occupancy >= 85) return 'HIGH';
  if (occupancy >= 70) return 'MEDIUM';
  return 'LOW';
}

function platformRiskColor(crowd: number, capacity: number): string {
  const r = platformRisk(crowd, capacity);
  if (r === 'CRITICAL') return 'var(--staff-critical)';
  if (r === 'HIGH') return 'var(--staff-high)';
  if (r === 'MEDIUM') return 'var(--staff-medium)';
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
      <div className="density-bar-fill" style={{ width: `${Math.min(100, density)}%`, background: densityColor(density, threshold) }} />
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
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

function ConfirmDialog({ title, message, confirmLabel, confirmType = 'primary', onConfirm, onCancel }: {
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
          <button className={`staff-action-btn ${confirmType} small`} onClick={onConfirm} style={{ flex: 1 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// HEADER
// ────────────────────────────────────────────────────────────────────────────────

function AppHeader() {
  const { state } = useStaff();
  const criticalCount = state.alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
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
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.connection === 'connected' ? 'var(--staff-success)' : state.connection === 'offline' ? 'var(--staff-critical)' : 'var(--staff-medium)' }} />
          {state.connection === 'connected' ? 'Live' : state.connection === 'offline' ? 'Offline' : '…'}
        </div>
        <button className={`staff-icon-btn ${criticalCount > 0 ? 'has-badge' : ''}`} aria-label="Notifications">
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}

function StatusBar() {
  const { state } = useStaff();
  const criticalCount = state.alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  const myCount = state.alerts.filter((a) => a.assignedTo === state.user.id && a.status !== 'RESOLVED').length;
  const highRiskCount = state.alerts.filter((a) => (a.severity === 'CRITICAL' || a.severity === 'HIGH') && a.status !== 'RESOLVED').length;
  return (
    <div className="staff-status-bar">
      <div className="staff-status-item">
        <span className={`staff-status-dot ${state.connection}`} />
        <span style={{ color: state.connection === 'connected' ? 'var(--staff-success)' : 'var(--staff-critical)' }}>
          {state.connection === 'connected' ? 'LIVE' : 'OFFLINE'}
        </span>
        <span style={{ color: 'var(--staff-text-muted)' }}>·</span>
        <span style={{ color: 'var(--staff-text-muted)' }}>{formatTime(state.lastSync)}</span>
      </div>
      <div className="staff-status-item" style={{ color: criticalCount > 0 ? 'var(--staff-critical)' : 'var(--staff-text-secondary)' }}>
        <CircleAlert size={12} /> <strong>{criticalCount}</strong> Critical
      </div>
      <div className="staff-status-item" style={{ color: 'var(--staff-brand-light)' }}>
        <ClipboardList size={12} /> <strong>{myCount}</strong> Assigned
      </div>
      <div className="staff-status-item" style={{ color: highRiskCount > 0 ? 'var(--staff-high)' : 'var(--staff-text-secondary)' }}>
        <AlertTriangle size={12} /> <strong>{highRiskCount}</strong> High risk
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
  const isMine = alert.assignedTo === state.user.id;

  const handlePrimaryAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isNew && isUnassigned) { claimAlert(alert.id); setToast({ msg: 'Incident claimed', type: 'success' }); }
    else if (isNew && isMine) { acknowledgeAlert(alert.id); setToast({ msg: 'Alert acknowledged', type: 'success' }); }
    else { onOpen(); }
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
              <div className="alert-card-metric">Density: <strong style={{ color: densityColor(alert.density, alert.threshold) }}>{alert.density}%</strong></div>
              {alert.threshold > 0 && <div className="alert-card-metric">Threshold: <strong>{alert.threshold}%</strong></div>}
            </div>
          )}
          {alert.density > 0 && alert.threshold > 0 && <DensityBar density={alert.density} threshold={alert.threshold} />}
          <div className="alert-card-desc">{alert.description}</div>
        </div>
        <div className="alert-card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="alert-card-time"><Clock size={12} /> {timeAgo(alert.updatedAt)}</div>
            <div className="alert-card-assignment">
              {alert.assignedName
                ? <span style={{ color: 'var(--staff-brand-light)' }}>{isMine ? 'Assigned to you' : alert.assignedName}</span>
                : <span>Unassigned</span>}
            </div>
          </div>
          <button className="staff-action-btn primary small" onClick={handlePrimaryAction}>
            {isNew && isUnassigned ? <><Zap size={13} /> Take</> : isNew ? <><Check size={13} /> Ack</> : <ChevronRight size={14} />}
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

  const isMine = alert.assignedTo === state.user.id;
  const isUnassigned = !alert.assignedTo;

  const doAction = (label: string, fn: () => void, needsConfirm: boolean) => {
    if (needsConfirm && (alert.severity === 'CRITICAL' || alert.severity === 'HIGH')) {
      setConfirm({ action: label, fn });
    } else { fn(); setToast({ msg: label, type: 'success' }); }
  };

  const handleConfirm = () => { if (confirm) { confirm.fn(); setToast({ msg: confirm.action, type: 'success' }); setConfirm(null); } };

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
      {confirm && <ConfirmDialog title={`Confirm: ${confirm.action}`} message={`Are you sure you want to ${confirm.action.toLowerCase()} this ${alert.severity.toLowerCase()} severity incident at ${alert.location}?`} confirmLabel={confirm.action} confirmType={confirm.action.includes('Escalate') ? 'danger' : 'success'} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}

      <div className="detail-header">
        <button className="detail-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={alert.status} />
          <SeverityBadge severity={alert.severity} />
        </div>
      </div>

      <div className="staff-content">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--staff-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            <MapPin size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
            {alert.location} · {alert.zone}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>{alert.title}</h1>
        </div>

        <div className="detail-section">
          <div className="detail-row"><span className="detail-row-label">Incident ID</span><span className="detail-row-value" style={{ fontFamily: 'monospace' }}>{alert.id}</span></div>
          <div className="detail-row"><span className="detail-row-label">Severity</span><SeverityBadge severity={alert.severity} /></div>
          {alert.density > 0 && <>
            <div className="detail-row"><span className="detail-row-label">Current Density</span><span className="detail-row-value" style={{ color: densityColor(alert.density, alert.threshold) }}>{alert.density}%</span></div>
            <div className="detail-row"><span className="detail-row-label">Threshold</span><span className="detail-row-value">{alert.threshold}%</span></div>
          </>}
          {alert.density > 0 && alert.threshold > 0 && <div style={{ paddingTop: 8 }}><DensityBar density={alert.density} threshold={alert.threshold} /></div>}
          <div className="detail-row"><span className="detail-row-label">Detected</span><span className="detail-row-value">{formatTime(alert.createdAt)} · {timeAgo(alert.createdAt)}</span></div>
          <div className="detail-row"><span className="detail-row-label">Assigned</span><span className="detail-row-value" style={{ color: alert.assignedName ? 'var(--staff-brand-light)' : 'var(--staff-text-muted)' }}>{alert.assignedName ?? 'Unassigned'}</span></div>
          <div className="detail-row"><span className="detail-row-label">Status</span><StatusBadge status={alert.status} /></div>
        </div>

        <div className="detail-section">
          <div className="staff-section-title">Description</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--staff-text-secondary)' }}>{alert.description}</p>
        </div>

        {alert.instructions && (
          <div className="detail-section" style={{ borderColor: 'rgba(124,58,237,0.2)' }}>
            <div className="staff-section-title" style={{ color: 'var(--staff-brand-light)' }}>Recommended Response</div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--staff-text)' }}>{alert.instructions}</p>
          </div>
        )}

        {alert.status !== 'RESOLVED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {actions.filter((a) => a.show).map((a) => (
              <button key={a.label} className={`staff-action-btn ${a.type}`} onClick={() => doAction(a.label, a.fn, a.confirm)}>{a.icon} {a.label}</button>
            ))}
          </div>
        )}

        {alert.status !== 'RESOLVED' && (
          <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input className="login-input" placeholder="Add a short note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ fontSize: 13 }} />
            <button className="staff-action-btn secondary small" type="submit" disabled={!noteText.trim()} style={{ flexShrink: 0, width: 44 }}><Send size={14} /></button>
          </form>
        )}

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
      if (filter === 'mine') return a.assignedTo === state.user.id;
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
  if (selectedAlert) return <IncidentDetail alert={selectedAlert} onBack={() => setSelectedId(null)} />;

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
          <button key={key} className={`staff-filter-btn ${cls ?? ''} ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      <div className="staff-content" style={{ paddingTop: 0 }}>
        {filtered.length === 0 ? (
          <div className="empty-state"><CheckCircle2 size={40} /><p>{search ? 'No alerts match your search.' : 'No active alerts. All clear.'}</p></div>
        ) : (
          filtered.map((alert) => <AlertCard key={alert.id} alert={alert} onOpen={() => setSelectedId(alert.id)} />)
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// LIVE CROWD TAB
// ────────────────────────────────────────────────────────────────────────────────

function LiveCrowdTab() {
  const { state } = useStaff();

  const totalCrowd = state.platforms.reduce((sum, p) => sum + p.crowd, 0);
  const totalCapacity = state.platforms.reduce((sum, p) => sum + p.capacity, 0);
  const overallOccupancy = totalCapacity > 0 ? (totalCrowd / totalCapacity) * 100 : 0;

  return (
    <div className="staff-content">
      {/* Overall summary */}
      <div className="detail-section" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="staff-section-title" style={{ marginBottom: 4 }}>Station Overview</div>
            <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.connection === 'connected' ? 'var(--staff-success)' : 'var(--staff-critical)' }} />
              {state.connection === 'connected' ? 'Receiving live data' : 'Offline'} · Updated {formatTime(state.lastSync)}
            </div>
          </div>
          <Radio size={16} color="var(--staff-success)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={{ background: 'var(--staff-bg)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--staff-brand-light)' }}>{totalCrowd.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', marginTop: 4 }}>Total crowd</div>
          </div>
          <div style={{ background: 'var(--staff-bg)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: overallOccupancy >= 85 ? 'var(--staff-critical)' : overallOccupancy >= 70 ? 'var(--staff-high)' : 'var(--staff-success)' }}>{overallOccupancy.toFixed(0)}%</div>
            <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', marginTop: 4 }}>Occupancy</div>
          </div>
          <div style={{ background: 'var(--staff-bg)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--staff-text)' }}>{state.platforms.length}</div>
            <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', marginTop: 4 }}>Platforms</div>
          </div>
        </div>
      </div>

      {/* Platform list */}
      <div className="staff-section-title">Platform Occupancy</div>

      {state.platforms.length === 0 ? (
        <div className="empty-state">
          <TrainFront size={36} />
          <p>No platform data available yet.</p>
        </div>
      ) : (
        state.platforms.map((platform) => {
          const occupancy = (platform.crowd / platform.capacity) * 100;
          const risk = platformRisk(platform.crowd, platform.capacity);
          const color = platformRiskColor(platform.crowd, platform.capacity);

          return (
            <div key={platform.id} className="alert-card" style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: 'solid' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--staff-text)' }}>{platform.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrainFront size={12} /> {platform.destination}
                  </div>
                </div>
                <SeverityBadge severity={risk} />
              </div>

              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', fontWeight: 600 }}>CROWD</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--staff-text)', marginTop: 2 }}>{platform.crowd}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', fontWeight: 600 }}>CAPACITY</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--staff-text-secondary)', marginTop: 2 }}>{platform.capacity}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--staff-text-muted)', fontWeight: 600 }}>NEXT ARR.</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--staff-success)', marginTop: 2 }}>{platform.next}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4, color: 'var(--staff-text-muted)' }}>
                  <span>Occupancy</span>
                  <span style={{ color, fontWeight: 700 }}>{occupancy.toFixed(1)}%</span>
                </div>
                <div className="density-bar">
                  <div className="density-bar-fill" style={{ width: `${Math.min(100, occupancy)}%`, background: color }} />
                </div>
              </div>
            </div>
          );
        })
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
        <div className="empty-state"><History size={36} /><p>No activity yet. Actions you take on alerts will appear here.</p></div>
      ) : (
        <div className="detail-section" style={{ padding: 0, overflow: 'hidden' }}>
          {state.activity.slice(0, 50).map((entry) => (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--staff-border)', fontSize: 13 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--staff-surface-raised)', display: 'grid', placeItems: 'center', color: 'var(--staff-brand-light)' }}>
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
              <div style={{ fontSize: 11, color: 'var(--staff-text-muted)', flexShrink: 0 }}>{timeAgo(entry.time)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// BOTTOM NAVIGATION (3 tabs: Alerts, Live Crowd, Activity)
// ────────────────────────────────────────────────────────────────────────────────

type Tab = 'alerts' | 'crowd' | 'activity';

function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const { state } = useStaff();
  const criticalCount = state.alerts.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;

  const items: Array<{ key: Tab; label: string; icon: ReactNode; badge?: number }> = [
    { key: 'alerts', label: 'Alerts', icon: <AlertTriangle size={20} />, badge: criticalCount > 0 ? criticalCount : undefined },
    { key: 'crowd', label: 'Live Crowd', icon: <Users size={20} /> },
    { key: 'activity', label: 'Activity', icon: <History size={20} /> },
  ];

  return (
    <nav className="staff-bottom-nav" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
      <div className="demo-banner"><Shield size={12} /> DEMO MODE — Synced with CrowdFlow Dashboard</div>
      <AppHeader />
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'crowd' && <LiveCrowdTab />}
      {tab === 'activity' && <ActivityTab />}
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
