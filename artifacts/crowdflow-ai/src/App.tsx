import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Clock3,
  CloudRain,
  Gauge,
  KeyRound,
  Languages,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Menu,
  MessageSquareText,
  PauseCircle,
  Play,
  Radio,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  Sparkles,
  TrainFront,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';

type Risk = 'NORMAL' | 'WATCH' | 'WARNING' | 'HIGH' | 'CRITICAL';
type Page = 'overview' | 'live' | 'forecast' | 'actions' | 'announcements' | 'settings';
type AnnouncementSource = 'Gemini' | 'Deterministic fallback';
type GeminiStatus = 'idle' | 'testing' | 'connected' | 'error';

type ScenarioInput = {
  currentCrowd: number;
  platformCapacity: number;
  vehicleCapacity: number;
  nextVehicleArrival: number;
  recentCrowdGrowth: number;
  followingBusArrival: number;
};

type ForecastResult = {
  predictedCrowd: number;
  occupancy: number;
  risk: Risk;
  riskExplanation: string;
  chartPoints: Array<{ minute: number; crowd: number; capacity: number }>;
};

type Recommendation = {
  action: string;
  label: string;
  reason: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'Accepted' | 'Review';
};

type Announcement = {
  language: string;
  text: string;
  timestamp: string;
  source: AnnouncementSource;
};

type Thresholds = { watch: number; warning: number; high: number; critical: number };

const defaultScenario: ScenarioInput = {
  currentCrowd: 438,
  platformCapacity: 600,
  vehicleCapacity: 600,
  nextVehicleArrival: 7,
  recentCrowdGrowth: 18,
  followingBusArrival: 14,
};

const stationData = [
  { name: 'Central Terminal', code: 'CEN-01', location: 'North concourse', current: 1240, capacity: 2400, trend: 4.6 },
  { name: 'Harbour Exchange', code: 'HBR-02', location: 'East line', current: 988, capacity: 1600, trend: -2.1 },
  { name: 'Northgate', code: 'NGT-04', location: 'Interchange', current: 612, capacity: 980, trend: 1.8 },
  { name: 'Riverside', code: 'RIV-07', location: 'South line', current: 324, capacity: 720, trend: -5.3 },
];

const platforms = [
  { id: 'p1', name: 'Platform 01', crowd: 438, capacity: 600, destination: 'Northbound local', next: '2 min' },
  { id: 'p2', name: 'Platform 02', crowd: 512, capacity: 600, destination: 'Airport express', next: '8 min' },
  { id: 'p3', name: 'Platform 03', crowd: 276, capacity: 500, destination: 'Harbour line', next: '5 min' },
  { id: 'p4', name: 'Platform 04', crowd: 184, capacity: 450, destination: 'Riverside local', next: '11 min' },
];

const navItems: Array<{ href: string; page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { href: '/', page: 'overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/live-crowd', page: 'live', label: 'Live Crowd', icon: Radio },
  { href: '/forecast', page: 'forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/settings', page: 'settings', label: 'Settings', icon: Settings2 },
];

function calculateForecast(input: ScenarioInput, thresholds: Thresholds): ForecastResult {
  const nextVehicleArrival = Math.max(0, input.nextVehicleArrival);
  const followingBusArrival = Math.max(nextVehicleArrival, input.followingBusArrival);
  const crowdGrowth = input.recentCrowdGrowth;
  const crowdAtNextVehicle = Math.max(0, input.currentCrowd + crowdGrowth * nextVehicleArrival);
  const crowdAfterNextVehicle = Math.max(0, crowdAtNextVehicle - input.vehicleCapacity);
  const predictedCrowd = Math.max(0, Math.round(crowdAfterNextVehicle + crowdGrowth * (followingBusArrival - nextVehicleArrival)));
  const occupancy = input.platformCapacity > 0 ? (predictedCrowd / input.platformCapacity) * 100 : 0;
  const risk: Risk =
    occupancy >= thresholds.critical ? 'CRITICAL' :
      occupancy >= thresholds.high ? 'HIGH' :
        occupancy >= thresholds.warning ? 'WARNING' :
          occupancy >= thresholds.watch ? 'WATCH' : 'NORMAL';
  const available = Math.round(input.vehicleCapacity);
  const riskExplanation =
    risk === 'NORMAL' ? 'Projected crowd remains within the normal operating range.' :
      risk === 'WATCH' ? `Projected occupancy reaches ${occupancy.toFixed(1)}%; keep the platform under observation.` :
        risk === 'WARNING' ? `Projected occupancy reaches ${occupancy.toFixed(1)}%; prepare a controlled response.` :
          risk === 'HIGH' ? `Projected occupancy reaches ${occupancy.toFixed(1)}%; the next vehicle has ${available} boarding spaces.` :
            `Projected demand exceeds safe capacity at ${occupancy.toFixed(1)}%; act before the horizon closes.`;
  const pointCount = 6;
  const chartPoints = Array.from({ length: pointCount + 1 }, (_, index) => {
    const minute = Math.round((followingBusArrival / pointCount) * index);
    const crowd = minute < nextVehicleArrival
      ? input.currentCrowd + crowdGrowth * minute
      : crowdAfterNextVehicle + crowdGrowth * (minute - nextVehicleArrival);
    return {
      minute,
      crowd: Math.max(0, Math.round(crowd)),
      capacity: input.platformCapacity,
    };
  });
  return { predictedCrowd, occupancy, risk, riskExplanation, chartPoints };
}

function getRecommendation(result: ForecastResult, input: ScenarioInput): Recommendation {
  if (result.risk === 'CRITICAL') {
    return { action: 'HOLD_CONCOURSE', label: 'Hold passengers at concourse', reason: 'Projected platform demand exceeds capacity before the next dependable boarding window.', priority: 'Urgent', status: 'Pending' };
  }
  if (result.risk === 'HIGH') {
    return { action: 'REDIRECT_PASSENGERS', label: 'Redirect passengers to Platform 03', reason: `Platform is approaching capacity and the next vehicle can carry ${input.vehicleCapacity} people.`, priority: 'High', status: 'Pending' };
  }
  if (result.risk === 'WARNING') {
    return { action: 'TRIGGER_PA', label: 'Prepare a public announcement', reason: 'A short, calm intervention now can spread arrivals before the platform enters high risk.', priority: 'Medium', status: 'Pending' };
  }
  if (result.risk === 'WATCH') {
    return { action: 'MONITOR', label: 'Keep monitoring the platform', reason: 'Occupancy is elevated but remains within the configured watch band.', priority: 'Low', status: 'Pending' };
  }
  return { action: 'NO_ACTION', label: 'No immediate action', reason: 'Current flow can be managed within the normal operating range.', priority: 'Low', status: 'Pending' };
}

function riskClass(risk: Risk) {
  return `cf-risk cf-risk-${risk.toLowerCase()}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type CrowdFlowContextValue = {
  scenario: ScenarioInput;
  draftScenario: ScenarioInput;
  result: ForecastResult;
  recommendation: Recommendation;
  thresholds: Thresholds;
  announcements: Announcement[];
  setDraft: (field: keyof ScenarioInput, value: number) => void;
  recalculate: () => void;
  setThreshold: (field: keyof Thresholds, value: number) => void;
  updateRecommendation: (status: Recommendation['status']) => void;
  generateAnnouncement: (language: string) => Promise<Announcement>;
  geminiStatus: GeminiStatus;
  geminiMessage: string;
  testGeminiKey: (key?: string, model?: string) => Promise<boolean>;
};

const CrowdFlowContext = createContext<CrowdFlowContextValue | null>(null);

function useCrowdFlow() {
  const value = useContext(CrowdFlowContext);
  if (!value) throw new Error('CrowdFlow context is unavailable');
  return value;
}

function CrowdFlowProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioInput>(defaultScenario);
  const [draftScenario, setDraftScenario] = useState<ScenarioInput>(defaultScenario);
  const [thresholds, setThresholds] = useState<Thresholds>({ watch: 70, warning: 85, high: 95, critical: 100 });
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatus>('idle');
  const [geminiMessage, setGeminiMessage] = useState('Paste a Gemini API key in Settings to enable free AI announcement drafts.');
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { language: 'English', text: 'Passengers are requested to remain in the concourse temporarily and follow station staff instructions. Please allow arriving passengers to exit first.', timestamp: '09:42', source: 'Deterministic fallback' },
    { language: 'Tamil', text: 'பயணிகள் தற்காலிகமாக கான்கோர்ஸில் காத்திருக்குமாறு கேட்டுக்கொள்ளப்படுகிறார்கள். பணியாளர்களின் அறிவுறுத்தல்களைப் பின்பற்றவும்.', timestamp: '09:18', source: 'Gemini' },
  ]);

  // Connect to backend
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    
    fetch(`${baseUrl}/api/v1/state`)
      .then(res => res.json())
      .then(data => {
        if (data.scenario) setScenario(data.scenario);
      })
      .catch(() => {});

    const evtSource = new EventSource(`${baseUrl}/api/v1/stream`);
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.scenario) setScenario(data.scenario);
    };
    return () => evtSource.close();
  }, []);

  const result = useMemo(() => calculateForecast(scenario, thresholds), [scenario, thresholds]);
  const recommendation = useMemo(() => getRecommendation(result, scenario), [result, scenario]);
  const setDraft = (field: keyof ScenarioInput, value: number) => {
    setDraftScenario((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  };
  const recalculate = () => {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    fetch(`${baseUrl}/api/v1/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftScenario),
    });
  };
  const setThreshold = (field: keyof Thresholds, value: number) => setThresholds((current) => ({ ...current, [field]: value }));
  const [latestActionStatus, setLatestActionStatus] = useState<Recommendation['status']>('Pending');
  const updateRecommendation = (status: Recommendation['status']) => {
    setLatestActionStatus(status);
  };
  const displayedRecommendation = { ...recommendation, status: latestActionStatus };

  const testGeminiKey = async (providedKey?: string, providedModel?: string) => {
    const key = (providedKey ?? window.localStorage.getItem('crowdflow-gemini-key') ?? '').trim();
    const model = providedModel ?? window.localStorage.getItem('crowdflow-gemini-model') ?? 'gemini-2.5-flash-lite';
    if (!key) {
      setGeminiStatus('error');
      setGeminiMessage('Paste a Gemini API key first, then save it on this device.');
      return false;
    }
    setGeminiStatus('testing');
    setGeminiMessage(`Checking ${model}…`);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: CONNECTED' }] }] }),
      });
      if (!response.ok) throw new Error('Gemini rejected the key');
      setGeminiStatus('connected');
      setGeminiMessage(`Connected to ${model}. Gemini is ready for announcement drafts.`);
      return true;
    } catch {
      setGeminiStatus('error');
      setGeminiMessage('Gemini rejected this key or model. Check the key, then try again.');
      return false;
    }
  };

  const generateAnnouncement = async (language: string) => {
    const key = window.localStorage.getItem('crowdflow-gemini-key') ?? '';
    const model = window.localStorage.getItem('crowdflow-gemini-model') || 'gemini-2.5-flash-lite';
    const fallbackText = language === 'Tamil'
      ? 'பயணிகள் தற்காலிகமாக கான்கோர்ஸில் காத்திருக்குமாறு கேட்டுக்கொள்ளப்படுகிறார்கள். பணியாளர்களின் அறிவுறுத்தல்களைப் பின்பற்றவும்.'
      : language === 'Hindi'
        ? 'यात्रियों से अनुरोध है कि वे कुछ समय के लिए कॉनकोर्स में प्रतीक्षा करें और स्टेशन कर्मचारियों के निर्देशों का पालन करें।'
        : 'Passengers are requested to remain in the concourse temporarily and follow station staff instructions. Please allow arriving passengers to exit first.';
    let text = fallbackText;
    let source: AnnouncementSource = 'Deterministic fallback';
    if (key) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Draft one short, calm public station announcement in ${language}. Do not claim certainty. Station: Central Terminal. Platform risk: ${result.risk}. Recommended response: ${displayedRecommendation.label}. Next vehicle arrives in ${scenario.nextVehicleArrival} minutes. Return only the announcement text.` }] }],
          }),
        });
        if (!response.ok) {
          setGeminiStatus('error');
          setGeminiMessage('Gemini rejected the request. Check the saved key and selected model.');
          throw new Error('Gemini request failed');
        }
        const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const modelText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (modelText) {
          text = modelText;
          source = 'Gemini';
          setGeminiStatus('connected');
          setGeminiMessage(`Connected to ${model}. Gemini draft generated successfully.`);
        }
      } catch {
        source = 'Deterministic fallback';
      }
    }
    const announcement = { language, text, timestamp: formatTime(), source };
    setAnnouncements((current) => [announcement, ...current]);
    return announcement;
  };
  const value = { scenario, draftScenario, result, recommendation: displayedRecommendation, thresholds, announcements, setDraft, recalculate, setThreshold, updateRecommendation, generateAnnouncement, geminiStatus, geminiMessage, testGeminiKey };
  return <CrowdFlowContext.Provider value={value}>{children}</CrowdFlowContext.Provider>;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2 no-underline" data-testid="link-brand">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-400 shadow-lg shadow-violet-900/30">
        <span className="h-3 w-3 rounded-full border-2 border-white/90" />
      </span>
      <span className="cf-brand-copy">
        <span className="block text-sm font-extrabold tracking-tight text-[#F8F7FF]">CrowdFlow <span className="text-[#C4B5FD]">AI</span></span>
        <span className="block text-[9px] font-bold uppercase tracking-[.2em] text-[#8F88B5]">Operations control</span>
      </span>
    </Link>
  );
}

function Sidebar({ page }: { page: Page }) {
  return (
    <aside className="cf-sidebar">
      <Brand />
      <nav className="mt-12 space-y-1" aria-label="Primary navigation">
        <div className="cf-side-caption mb-3 px-3 text-[9px] font-bold uppercase tracking-[.2em] text-[#5e587d]">Workspace</div>
        {navItems.map(({ href, page: navPage, label, icon: Icon }) => (
          <Link key={navPage} href={href} className={`cf-nav-link no-underline ${page === navPage ? 'active' : ''}`} data-testid={`link-nav-${navPage}`}>
            <Icon size={16} strokeWidth={1.8} />
            <span className="cf-nav-copy">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto cf-side-caption rounded-xl border border-[#a78bfa]/10 bg-[#151044]/60 p-3">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#c4b5fd]"><span className="h-2 w-2 rounded-full bg-[#67e8a5]" /> System nominal</div>
        <p className="mt-2 text-[10px] leading-relaxed text-[#8f88b5]">Forecasts are estimates based on current operating data.</p>
      </div>
    </aside>
  );
}

function Topbar({ page }: { page: Page }) {
  const labels: Record<Page, [string, string]> = {
    overview: ['Overview', 'Current operating picture'],
    live: ['Live Crowd', 'Observe station movement'],
    forecast: ['Forecast', 'Run a transparent what-if'],
    actions: ['Actions', 'Review the next best move'],
    announcements: ['Announcements', 'Prepare clear public language'],
    settings: ['Settings', 'Tune this control room'],
  };
  return (
    <header className="flex items-start justify-between gap-4 border-b border-[#a78bfa]/10 px-4 py-5 sm:px-8 lg:px-10">
      <div className="flex items-start gap-3">
        <div className="mt-1 hidden rounded-lg bg-[#151044] p-2 text-[#c4b5fd] sm:block"><Menu size={15} /></div>
        <div><div className="text-xl font-extrabold tracking-[-.04em] text-[#f8f7ff]">{labels[page][0]}</div><div className="mt-1 text-xs text-[#8f88b5]">{labels[page][1]}</div></div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-[#a78bfa]/12 bg-[#100c35]/60 px-3 py-2 text-[10px] font-bold text-[#8f88b5] sm:flex"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#67e8a5]" /> LIVE · 09:48</div>
        <button className="relative rounded-lg border border-[#a78bfa]/12 bg-[#100c35]/60 p-2.5 text-[#8f88b5] hover:text-[#f8f7ff]" aria-label="View alerts" data-testid="button-view-alerts"><Bell size={16} /><span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#ec4899]" /></button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#a78bfa] to-[#ec4899] text-[10px] font-black text-[#0b0928]" data-testid="text-operator-avatar">OP</div>
      </div>
    </header>
  );
}

function PageFrame({ page, children }: { page: Page; children: ReactNode }) {
  return <div className="cf-shell"><Sidebar page={page} /><main className="cf-main"><Topbar page={page} /><div className="cf-page">{children}</div></main></div>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-3"><div>{eyebrow && <div className="cf-label mb-2">{eyebrow}</div>}<h2 className="m-0 text-base font-extrabold tracking-[-.03em] text-[#f8f7ff]">{title}</h2></div>{action}</div>;
}

function RiskBadge({ risk }: { risk: Risk }) {
  return <span className={riskClass(risk)} data-testid={`status-risk-${risk.toLowerCase()}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{risk}</span>;
}

function CrowdProgress({ value, tone = '#a78bfa' }: { value: number; tone?: string }) {
  return <div className="cf-progress"><span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }} /></div>;
}

function KpiCard({ label, value, sub, icon: Icon, accent, footer }: { label: string; value: string; sub: string; icon: typeof Users; accent: string; footer?: ReactNode }) {
  return <div className="cf-panel cf-kpi cf-reveal" data-testid={`card-kpi-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="mb-5 flex items-start justify-between"><div className="cf-label">{label}</div><span className="rounded-lg p-2" style={{ color: accent, background: `${accent}18` }}><Icon size={16} /></span></div><div className="cf-kpi-value text-[#f8f7ff]">{value}</div><div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#8f88b5]"><span>{sub}</span>{footer}</div></div>;
}

function ForecastChart({ result, compact = false }: { result: ForecastResult; compact?: boolean }) {
  return <div className={compact ? 'h-[168px] w-full' : 'h-[320px] w-full'} data-testid="chart-forecast">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={result.chartPoints} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="rgba(167,139,250,.1)" vertical={false} />
        <XAxis dataKey="minute" tick={{ fill: '#8f88b5', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}m`} />
        <YAxis tick={{ fill: '#8f88b5', fontSize: 10 }} tickLine={false} axisLine={false} width={42} tickFormatter={(value) => `${Math.round(Number(value))}`} />
        <Tooltip contentStyle={{ background: '#100c35', border: '1px solid rgba(167,139,250,.2)', borderRadius: 9, color: '#f8f7ff', fontSize: 11 }} labelFormatter={(label) => `${label} minutes`} />
        <ReferenceLine y={result.chartPoints[0]?.capacity} stroke="#ec4899" strokeDasharray="4 5" strokeOpacity={.65} />
        <Line type="monotone" dataKey="crowd" stroke="#a78bfa" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#ec4899', stroke: '#f8f7ff', strokeWidth: 1 }} />
        {!compact && <Line type="monotone" dataKey="capacity" stroke="#ec4899" strokeWidth={1} strokeDasharray="4 5" dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function ScenarioControls({ showPresets = true }: { showPresets?: boolean }) {
  const { draftScenario, setDraft, recalculate } = useCrowdFlow();
  const fields: Array<[keyof ScenarioInput, string, string, number, number, number]> = [
    ['currentCrowd', 'Current crowd', 'people', 0, 2000, 1],
    ['platformCapacity', 'Platform capacity', 'people', 100, 3000, 10],
    ['vehicleCapacity', 'Vehicle capacity', 'people', 100, 2000, 10],
    ['nextVehicleArrival', 'Next vehicle arrives in', 'min', 0, 60, 1],
    ['recentCrowdGrowth', 'Recent crowd growth / min', 'people', -30, 100, 1],
    ['followingBusArrival', 'Following bus arrives in', 'min', 1, 120, 1],
  ];
  const setPreset = (name: string) => {
    const presets: Record<string, ScenarioInput> = {
      Normal: { ...defaultScenario, currentCrowd: 280, platformCapacity: 600, vehicleCapacity: 600, nextVehicleArrival: 4, recentCrowdGrowth: 8, followingBusArrival: 12 },
      Busy: { ...defaultScenario, currentCrowd: 450, platformCapacity: 600, vehicleCapacity: 600, nextVehicleArrival: 8, recentCrowdGrowth: 23, followingBusArrival: 18 },
      Delayed: { ...defaultScenario, currentCrowd: 470, platformCapacity: 600, vehicleCapacity: 600, nextVehicleArrival: 18, recentCrowdGrowth: 18, followingBusArrival: 28 },
      'Near capacity': { ...defaultScenario, currentCrowd: 545, platformCapacity: 600, vehicleCapacity: 600, nextVehicleArrival: 9, recentCrowdGrowth: 15, followingBusArrival: 16 },
      Critical: { ...defaultScenario, currentCrowd: 590, platformCapacity: 600, vehicleCapacity: 500, nextVehicleArrival: 16, recentCrowdGrowth: 28, followingBusArrival: 26 },
    };
    const next = presets[name];
    Object.entries(next).forEach(([field, value]) => setDraft(field as keyof ScenarioInput, value));
  };
  return <div className="cf-panel p-5 sm:p-6" data-testid="panel-scenario-controls">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><div className="cf-label mb-2">Prediction inputs</div><h3 className="m-0 text-base font-extrabold text-[#f8f7ff]">Six signals only</h3><p className="mt-1 text-xs text-[#8f88b5]">Prediction uses current crowd, both capacities, both arrival times, and recent growth.</p></div><Zap size={18} className="text-[#c4b5fd]" /></div>
    {showPresets && <div className="mb-5 flex flex-wrap gap-2">{['Normal', 'Busy', 'Delayed', 'Near capacity', 'Critical'].map((preset) => <button key={preset} onClick={() => setPreset(preset)} className="cf-btn cf-btn-quiet h-8 px-3 text-[10px]" data-testid={`button-preset-${preset.toLowerCase().replaceAll(' ', '-')}`}>{preset}</button>)}</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([field, label, unit, min, max, step]) => <label key={field} className="block rounded-xl border border-[#a78bfa]/10 bg-[#0b0928]/35 p-3"><span className="flex items-center justify-between gap-2 text-[10px] font-bold text-[#c4b5fd]"><span>{label}</span><span className="cf-mono rounded-md bg-[#a78bfa]/10 px-2 py-1 text-[#f8f7ff]">{draftScenario[field]} {unit}</span></span><input className="mt-3 w-full accent-[#a78bfa]" type="range" min={min} max={max} step={step} value={draftScenario[field]} onChange={(event) => setDraft(field, Number(event.target.value))} data-testid={`input-${field}`} /></label>)}
    </div>
    <button onClick={recalculate} className="cf-btn cf-btn-primary mt-5 w-full" data-testid="button-recalculate"><RefreshCw size={15} /> Recalculate forecast</button>
  </div>;
}

function RecommendationCard({ compact = false }: { compact?: boolean }) {
  const { recommendation, result, updateRecommendation } = useCrowdFlow();
  return <div className="cf-panel p-5" data-testid="card-recommendation">
    <div className="flex items-start justify-between gap-4"><div><div className="cf-label mb-2">Immediate action</div><div className="flex items-center gap-2"><Lightbulb size={17} className="text-[#f0bd69]" /><h3 className="m-0 text-base font-extrabold text-[#f8f7ff]">{recommendation.label}</h3></div></div><RiskBadge risk={result.risk} /></div>
    <p className="mt-4 text-sm leading-relaxed text-[#c4b5fd]" data-testid="text-recommendation-reason">{recommendation.reason}</p>
    {!compact && <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => updateRecommendation('Accepted')} className="cf-btn cf-btn-primary" data-testid="button-accept-action"><Check size={14} /> Accept action</button><button onClick={() => updateRecommendation('Review')} className="cf-btn cf-btn-secondary" data-testid="button-review-action"><CircleHelp size={14} /> Review later</button></div>}
    <div className="mt-4 flex items-center gap-2 text-[10px] text-[#8f88b5]"><Clock3 size={12} /> Suggested just now · priority <span className="font-bold text-[#f0bd69]">{recommendation.priority}</span></div>
  </div>;
}

function Overview() {
  const { result, scenario, announcements } = useCrowdFlow();
  const currentOccupancy = (scenario.currentCrowd / scenario.platformCapacity) * 100;
  return <PageFrame page="overview">
    <div className="cf-reveal mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#8f88b5]"><span className="h-1.5 w-1.5 rounded-full bg-[#67e8a5]" /> Central Terminal · CEN-01</div><h1 className="m-0 text-2xl font-extrabold tracking-[-.05em] text-[#f8f7ff] sm:text-3xl">Good morning, operator.</h1><p className="mt-2 text-sm text-[#8f88b5]">Here is the decision picture until the following bus in {scenario.followingBusArrival} minutes.</p></div><div className="flex items-center gap-2 rounded-lg border border-[#a78bfa]/12 bg-[#100c35]/70 px-3 py-2 text-[10px] text-[#8f88b5]"><Clock3 size={13} className="text-[#c4b5fd]" /> Data refreshed 18 sec ago</div></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Current crowd" value={scenario.currentCrowd.toLocaleString()} sub={`${currentOccupancy.toFixed(1)}% of platform capacity`} icon={Users} accent="#a78bfa" footer={<span className="flex items-center gap-1 text-[#67e8a5]"><ArrowDownRight size={12} /> 2.4%</span>} />
      <KpiCard label={`Forecast · ${scenario.followingBusArrival} min`} value={result.predictedCrowd.toLocaleString()} sub={`${result.predictedCrowd - scenario.currentCrowd >= 0 ? '+' : ''}${result.predictedCrowd - scenario.currentCrowd} people projected`} icon={TrendingUp} accent="#ec4899" footer={<RiskBadge risk={result.risk} />} />
      <KpiCard label="Occupancy" value={`${result.occupancy.toFixed(1)}%`} sub={`Platform capacity ${scenario.platformCapacity}`} icon={Gauge} accent="#f0bd69" footer={<CrowdProgress value={result.occupancy} tone="#f0bd69" />} />
      <KpiCard label="Next vehicle" value={`${scenario.nextVehicleArrival} min`} sub={`${scenario.vehicleCapacity} people capacity`} icon={TrainFront} accent="#67e8a5" footer={<span className="text-[#67e8a5]">Approaching</span>} />
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_.8fr]">
      <div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Signal / short horizon" title="Crowd trajectory" action={<span className="cf-mono text-[10px] text-[#8f88b5]">0—{scenario.followingBusArrival} MIN</span>} /><ForecastChart result={result} compact /><div className="mt-3 flex flex-wrap items-center gap-5 text-[10px] text-[#8f88b5]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#a78bfa]" /> projected crowd</span><span className="flex items-center gap-2"><i className="h-px w-3 border-t border-dashed border-[#ec4899]" /> vehicle capacity line</span><span className="ml-auto font-bold text-[#c4b5fd]">{result.riskExplanation}</span></div></div>
      <RecommendationCard compact />
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Station pulse" title="Platforms at a glance" action={<Link href="/live-crowd" className="flex items-center gap-1 text-[10px] font-bold text-[#c4b5fd] no-underline" data-testid="link-view-platforms">View live crowd <ChevronRight size={13} /></Link>} /><div>{platforms.slice(0, 3).map((platform) => { const occupancy = platform.crowd / platform.capacity * 100; const platformRisk: Risk = occupancy >= 100 ? 'CRITICAL' : occupancy >= 95 ? 'HIGH' : occupancy >= 85 ? 'WARNING' : occupancy >= 70 ? 'WATCH' : 'NORMAL'; return <div key={platform.id} className="cf-table-row" data-testid={`row-platform-${platform.id}`}><div><div className="text-xs font-bold text-[#f8f7ff]">{platform.name}</div><div className="mt-1 text-[10px] text-[#8f88b5]">{platform.destination}</div></div><div className="cf-mono text-xs text-[#c4b5fd]">{platform.crowd}</div><div><CrowdProgress value={occupancy} tone={platformRisk === 'NORMAL' ? '#67e8a5' : '#a78bfa'} /><div className="mt-1 text-[9px] text-[#8f88b5]">{occupancy.toFixed(0)}% full</div></div><RiskBadge risk={platformRisk} /></div>; })}</div></div>
      <div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Latest communications" title="Announcement preview" action={<Link href="/announcements" className="text-[10px] font-bold text-[#c4b5fd] no-underline" data-testid="link-all-announcements">See all</Link>} /><div className="rounded-xl border border-[#a78bfa]/12 bg-[#0b0928]/60 p-4"><div className="mb-3 flex items-center justify-between text-[10px]"><span className="flex items-center gap-2 font-bold text-[#c4b5fd]"><MessageSquareText size={13} /> {announcements[0]?.language ?? 'English'}</span><span className="text-[#8f88b5]">{announcements[0]?.timestamp}</span></div><p className="m-0 text-xs leading-relaxed text-[#f8f7ff]">{announcements[0]?.text}</p><div className="mt-4 flex items-center gap-2 text-[9px] text-[#8f88b5]"><Sparkles size={11} className="text-[#ec4899]" /> {announcements[0]?.source} · review before publishing</div></div></div>
    </div>
    <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#ec4899]/15 bg-[#ec4899]/[.05] px-4 py-3 text-[11px] text-[#c4b5fd]"><ShieldAlert size={15} className="shrink-0 text-[#f472b6]" /><span>Operator note: forecasts are estimates from currently available data, not guarantees. Use official procedures for urgent situations.</span></div>
  </PageFrame>;
}

function LiveCrowd() {
  const [station, setStation] = useState('Central Terminal');
  const [selected, setSelected] = useState('p1');
  const { scenario } = useCrowdFlow();
  const chosen = platforms.find((platform) => platform.id === selected) ?? platforms[0];
  const trend = [321, 344, 368, 391, 402, 415, 426, scenario.currentCrowd];
  return <PageFrame page="live">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><div className="cf-label mb-2">Live monitoring</div><h1 className="m-0 text-2xl font-extrabold tracking-[-.05em] text-[#f8f7ff]">Where people are now</h1><p className="mt-2 text-sm text-[#8f88b5]">Sensor and operator snapshots · updated every 30 seconds</p></div><div className="flex gap-2"><select className="cf-select w-auto min-w-[170px]" value={station} onChange={(event) => setStation(event.target.value)} data-testid="select-live-station"><option>Central Terminal</option><option>Harbour Exchange</option><option>Northgate</option></select><select className="cf-select w-auto" value={selected} onChange={(event) => setSelected(event.target.value)} data-testid="select-live-platform">{platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></div></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[.8fr_1.2fr]">
      <div className="cf-panel p-5 sm:p-6"><div className="cf-label mb-4">Selected platform</div><div className="flex items-end justify-between"><div><div className="text-3xl font-extrabold tracking-[-.07em] text-[#f8f7ff]" data-testid="text-selected-crowd">{chosen.id === 'p1' ? scenario.currentCrowd : chosen.crowd}</div><div className="mt-1 text-xs text-[#8f88b5]">people present · {chosen.destination}</div></div><RiskBadge risk={chosen.crowd / chosen.capacity * 100 >= 85 ? 'WARNING' : 'WATCH'} /></div><div className="mt-7"><div className="mb-2 flex justify-between text-[10px] text-[#8f88b5]"><span>Occupancy</span><span className="cf-mono text-[#c4b5fd]">{((chosen.id === 'p1' ? scenario.currentCrowd : chosen.crowd) / chosen.capacity * 100).toFixed(1)}%</span></div><CrowdProgress value={(chosen.id === 'p1' ? scenario.currentCrowd : chosen.crowd) / chosen.capacity * 100} /><div className="mt-3 flex justify-between text-[10px] text-[#8f88b5]"><span>Capacity</span><span className="cf-mono">{chosen.capacity} people</span></div></div><div className="mt-8 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#0b0928]/70 p-3"><div className="cf-label">Next arrival</div><div className="mt-2 text-sm font-extrabold text-[#f8f7ff]">{chosen.next}</div></div><div className="rounded-xl bg-[#0b0928]/70 p-3"><div className="cf-label">Last update</div><div className="mt-2 text-sm font-extrabold text-[#f8f7ff]">18 sec ago</div></div></div></div>
      <div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Selected platform / last 35 minutes" title="Snapshot trend" action={<span className="flex items-center gap-1 text-[10px] text-[#67e8a5]"><Radio size={12} /> receiving</span>} /><div className="h-[240px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend.map((crowd, index) => ({ time: `${index * 5}m`, crowd }))} margin={{ top: 8, right: 10, bottom: 0, left: -22 }}><CartesianGrid stroke="rgba(167,139,250,.1)" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#8f88b5', fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: '#8f88b5', fontSize: 10 }} tickLine={false} axisLine={false} width={40} /><Tooltip contentStyle={{ background: '#100c35', border: '1px solid rgba(167,139,250,.2)', borderRadius: 9, fontSize: 11 }} /><Line type="monotone" dataKey="crowd" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: '#a78bfa', strokeWidth: 0, r: 2 }} /></LineChart></ResponsiveContainer></div><div className="mt-3 flex items-center gap-2 text-[10px] text-[#8f88b5]"><TrendingUp size={13} className="text-[#ec4899]" /> Crowd has risen 36% since 09:15</div></div>
    </div>
    <div className="mt-4"><SectionTitle eyebrow="All monitored areas" title="Platform occupancy" /><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{platforms.map((platform, index) => { const crowd = index === 0 ? scenario.currentCrowd : platform.crowd; const occupancy = crowd / platform.capacity * 100; const risk: Risk = occupancy >= 100 ? 'CRITICAL' : occupancy >= 95 ? 'HIGH' : occupancy >= 85 ? 'WARNING' : occupancy >= 70 ? 'WATCH' : 'NORMAL'; return <button key={platform.id} className="cf-panel text-left p-4 transition-transform hover:-translate-y-0.5" onClick={() => setSelected(platform.id)} data-testid={`button-platform-${platform.id}`}><div className="flex items-start justify-between"><div><div className="text-sm font-extrabold text-[#f8f7ff]">{platform.name}</div><div className="mt-1 text-[10px] text-[#8f88b5]">{platform.destination}</div></div><RiskBadge risk={risk} /></div><div className="mt-5 flex items-end justify-between"><div className="cf-mono text-xl font-bold text-[#c4b5fd]">{crowd}<span className="text-xs font-normal text-[#8f88b5]"> / {platform.capacity}</span></div><span className="text-xs font-bold text-[#8f88b5]">{occupancy.toFixed(0)}%</span></div><div className="mt-3"><CrowdProgress value={occupancy} tone={risk === 'NORMAL' ? '#67e8a5' : risk === 'WATCH' ? '#f0bd69' : '#ec4899'} /></div></button>; })}</div></div>
  </PageFrame>;
}

function Forecast() {
  const { result, scenario, geminiStatus } = useCrowdFlow();
  return <PageFrame page="forecast">
    <div className="mb-6"><div className="cf-label mb-2">Transparent simulator</div><h1 className="m-0 text-2xl font-extrabold tracking-[-.05em] text-[#f8f7ff]">Forecast the next move</h1><p className="mt-2 max-w-2xl text-sm text-[#8f88b5]">Change the operating assumptions, then recalculate. The numerical result is local and deterministic; AI never decides the risk state.</p></div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#a78bfa]/12 bg-[#151044]/50 px-4 py-3 text-[11px] text-[#c4b5fd]"><span className="flex items-center gap-2"><Sparkles size={14} className={geminiStatus === 'connected' ? 'text-[#67e8a5]' : 'text-[#f472b6]'} />{geminiStatus === 'connected' ? 'Gemini connected · free Flash-Lite drafts are ready.' : 'Want AI-assisted wording? Add your free Gemini key in Settings.'}</span><Link href="/settings" className="cf-btn cf-btn-secondary h-8 no-underline" data-testid="link-forecast-gemini-settings">Open Gemini settings <ChevronRight size={12} /></Link></div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[.75fr_1.25fr]"><ScenarioControls /><div className="space-y-4"><div className="cf-panel p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="cf-label mb-2">Calculated output</div><h2 className="m-0 text-base font-extrabold text-[#f8f7ff]">Estimated crowd when the following bus arrives</h2></div><RiskBadge risk={result.risk} /></div><div className="mt-6 grid grid-cols-3 gap-3"><div><div className="cf-label">Predicted crowd</div><div className="mt-2 text-2xl font-extrabold tracking-[-.06em] text-[#f8f7ff]" data-testid="text-predicted-crowd">{result.predictedCrowd}</div><div className="mt-1 text-[10px] text-[#8f88b5]">people</div></div><div><div className="cf-label">Occupancy</div><div className="mt-2 text-2xl font-extrabold tracking-[-.06em] text-[#f8f7ff]" data-testid="text-forecast-occupancy">{result.occupancy.toFixed(1)}%</div><div className="mt-1 text-[10px] text-[#8f88b5]">of platform capacity {scenario.platformCapacity}</div></div><div><div className="cf-label">Net flow</div><div className="mt-2 text-2xl font-extrabold tracking-[-.06em] text-[#f8f7ff]">{result.predictedCrowd - scenario.currentCrowd > 0 ? '+' : ''}{result.predictedCrowd - scenario.currentCrowd}</div><div className="mt-1 text-[10px] text-[#8f88b5]">people after the bus sequence</div></div></div><div className="mt-6"><ForecastChart result={result} /></div><div className="mt-4 rounded-xl border border-[#a78bfa]/10 bg-[#0b0928]/50 px-4 py-3 text-xs leading-relaxed text-[#c4b5fd]" data-testid="text-risk-explanation"><span className="mr-2 font-bold text-[#f0bd69]">Why this risk?</span>{result.riskExplanation}</div></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="cf-panel p-5"><div className="cf-label mb-3">Calculation trace</div><div className="cf-mono space-y-2 text-[11px] text-[#c4b5fd]"><div className="flex justify-between"><span>current crowd</span><span>{scenario.currentCrowd}</span></div><div className="flex justify-between"><span>platform capacity</span><span>{scenario.platformCapacity} people</span></div><div className="flex justify-between"><span>growth until next vehicle</span><span>{(scenario.recentCrowdGrowth * scenario.nextVehicleArrival).toFixed(0)} people</span></div><div className="flex justify-between"><span>vehicle boarding capacity</span><span>-{scenario.vehicleCapacity} people</span></div><div className="flex justify-between"><span>growth until following bus</span><span>{(scenario.recentCrowdGrowth * Math.max(0, scenario.followingBusArrival - scenario.nextVehicleArrival)).toFixed(0)} people</span></div><div className="mt-3 border-t border-[#a78bfa]/10 pt-3 flex justify-between font-bold text-[#f8f7ff]"><span>predicted crowd</span><span>{result.predictedCrowd}</span></div></div></div><div className="cf-panel p-5"><div className="cf-label mb-3">Vehicle sequence</div><div className="flex items-center gap-3"><div className="rounded-xl bg-[#67e8a5]/10 p-3 text-[#67e8a5]"><TrainFront size={20} /></div><div><div className="text-sm font-extrabold text-[#f8f7ff]">Next in {scenario.nextVehicleArrival} min</div><div className="mt-1 text-[10px] text-[#8f88b5]">{scenario.vehicleCapacity} capacity · following bus in {scenario.followingBusArrival} min</div></div></div></div></div></div></div>
  </PageFrame>;
}

function Actions() {
  const { recommendation, result, announcements, updateRecommendation } = useCrowdFlow();
  const [history, setHistory] = useState<Array<{ label: string; status: string; time: string }>>([
    { label: 'Monitor platform flow', status: 'Completed', time: '09:26' },
    { label: 'Brief platform team', status: 'Completed', time: '09:11' },
    { label: 'Hold at concourse', status: 'Dismissed', time: '08:54' },
  ]);
  const act = (status: Recommendation['status']) => {
    updateRecommendation(status);
    setHistory((current) => [{ label: recommendation.label, status: status === 'Accepted' ? 'Accepted' : 'Review queued', time: formatTime() }, ...current]);
  };
  return <PageFrame page="actions">
    <div className="mb-6"><div className="cf-label mb-2">Decision queue</div><h1 className="m-0 text-2xl font-extrabold tracking-[-.05em] text-[#f8f7ff]">One clear next action</h1><p className="mt-2 text-sm text-[#8f88b5]">A recommendation is a starting point for operator review, never an autonomous instruction.</p></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_.95fr]"><div className="cf-panel overflow-hidden p-6 sm:p-8"><div className="absolute right-[-45px] top-[-55px] h-44 w-44 rounded-full bg-[#ec4899]/[.08] blur-2xl" /><div className="relative flex items-start justify-between gap-4"><div><div className="cf-label mb-3">Recommended response · generated 09:48</div><div className="flex items-center gap-3"><div className="rounded-xl bg-[#f0bd69]/10 p-3 text-[#f0bd69]"><Lightbulb size={22} /></div><h2 className="m-0 max-w-sm text-2xl font-extrabold leading-tight tracking-[-.05em] text-[#f8f7ff]" data-testid="text-action-label">{recommendation.label}</h2></div></div><RiskBadge risk={result.risk} /></div><div className="mt-8 rounded-xl border border-[#a78bfa]/12 bg-[#0b0928]/55 p-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#8f88b5]">Reasoning from structured facts</div><p className="m-0 text-sm leading-relaxed text-[#c4b5fd]" data-testid="text-action-reason">{recommendation.reason}</p></div><div className="mt-6 flex flex-wrap gap-2"><button onClick={() => act('Accepted')} className="cf-btn cf-btn-primary" data-testid="button-action-accept"><Check size={15} /> Accept action</button><button onClick={() => act('Review')} className="cf-btn cf-btn-secondary" data-testid="button-action-review"><CircleHelp size={15} /> Send to review</button><button onClick={() => act('Pending')} className="cf-btn cf-btn-quiet" data-testid="button-action-dismiss"><X size={14} /> Dismiss</button></div><div className="mt-5 flex items-center gap-2 text-[10px] text-[#8f88b5]"><ShieldAlert size={12} className="text-[#f0bd69]" /> Current state: <span className="font-bold text-[#c4b5fd]">{recommendation.status}</span> · priority {recommendation.priority}</div></div><div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Audit trail" title="Action history" action={<span className="cf-mono text-[10px] text-[#8f88b5]">{history.length} entries</span>} /><div className="space-y-1">{history.map((item, index) => <div key={`${item.time}-${index}`} className="flex items-center gap-3 border-b border-[#a78bfa]/10 py-3 last:border-0" data-testid={`row-action-history-${index}`}><div className={`h-2 w-2 rounded-full ${item.status === 'Accepted' ? 'bg-[#67e8a5]' : item.status === 'Dismissed' ? 'bg-[#8f88b5]' : 'bg-[#f0bd69]'}`} /><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-[#f8f7ff]">{item.label}</div><div className="mt-1 text-[10px] text-[#8f88b5]">{item.time}</div></div><span className="text-[10px] font-bold text-[#c4b5fd]">{item.status}</span></div>)}</div></div></div>
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3"><div className="cf-panel p-5"><div className="cf-label">Risk state</div><div className="mt-4"><RiskBadge risk={result.risk} /></div><p className="mt-3 text-xs leading-relaxed text-[#8f88b5]">Based on deterministic capacity thresholds.</p></div><div className="cf-panel p-5"><div className="cf-label">Public language</div><div className="mt-4 text-sm font-extrabold text-[#f8f7ff]">{announcements[0]?.language ?? 'English'} ready</div><Link href="/announcements" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-[#c4b5fd] no-underline" data-testid="link-action-announcements">Review announcement <ChevronRight size={12} /></Link></div><div className="cf-panel p-5"><div className="cf-label">Operator control</div><div className="mt-4 text-sm font-extrabold text-[#f8f7ff]">Human approval required</div><p className="mt-3 text-xs leading-relaxed text-[#8f88b5]">No action is sent to station systems by CrowdFlow.</p></div></div>
  </PageFrame>;
}

function Announcements() {
  const { announcements, generateAnnouncement } = useCrowdFlow();
  const [language, setLanguage] = useState('English');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const create = async () => { setGenerating(true); await generateAnnouncement(language); setGenerating(false); };
  const copy = async (text: string, index: number) => { await navigator.clipboard?.writeText(text); setCopied(index); window.setTimeout(() => setCopied(null), 1600); };
  const read = (text: string) => { window.speechSynthesis?.cancel(); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text)); };
  return <PageFrame page="announcements">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><div className="cf-label mb-2">Human-reviewed language</div><h1 className="m-0 text-2xl font-extrabold tracking-[-.05em] text-[#f8f7ff]">Announcements</h1><p className="mt-2 text-sm text-[#8f88b5]">Draft a calm message from the current operating picture. Review before publishing.</p></div><div className="flex items-center gap-2"><select className="cf-select w-auto" value={language} onChange={(event) => setLanguage(event.target.value)} data-testid="select-announcement-language"><option>English</option><option>Tamil</option><option>Hindi</option></select><button className="cf-btn cf-btn-primary" onClick={create} disabled={generating} data-testid="button-generate-announcement"><Sparkles size={14} /> {generating ? 'Drafting…' : 'Draft announcement'}</button></div></div>
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#a78bfa]/12 bg-[#151044]/50 px-4 py-3 text-[11px] text-[#c4b5fd]"><BrainCircuit size={16} className="text-[#ec4899]" /><span>AI-assisted wording is optional. Numerical risk and operating decisions remain deterministic.</span></div>
    <div className="space-y-3">{announcements.length === 0 ? <div className="cf-panel p-10 text-center text-sm text-[#8f88b5]">No announcements yet. Draft one from the current risk state.</div> : announcements.map((announcement, index) => <div key={`${announcement.timestamp}-${index}`} className="cf-panel p-5 sm:p-6" data-testid={`card-announcement-${index}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-[#a78bfa]/10 p-2 text-[#c4b5fd]"><Languages size={15} /></span><span className="text-xs font-extrabold text-[#f8f7ff]">{announcement.language}</span><span className="rounded-full border border-[#a78bfa]/12 px-2 py-1 text-[9px] font-bold text-[#8f88b5]">{announcement.source}</span></div><span className="text-[10px] text-[#8f88b5]">{announcement.timestamp}</span></div><p className="mt-5 max-w-3xl text-sm leading-7 text-[#f8f7ff]" data-testid={`text-announcement-${index}`}>{announcement.text}</p><div className="mt-5 flex gap-2"><button onClick={() => copy(announcement.text, index)} className="cf-btn cf-btn-secondary h-8 text-[10px]" data-testid={`button-copy-announcement-${index}`}><Clipboard size={13} /> {copied === index ? 'Copied' : 'Copy'}</button><button onClick={() => read(announcement.text)} className="cf-btn cf-btn-quiet h-8 text-[10px]" data-testid={`button-read-announcement-${index}`}><Play size={12} /> Read aloud</button><button onClick={create} className="cf-btn cf-btn-quiet h-8 text-[10px]" data-testid={`button-regenerate-announcement-${index}`}><RefreshCw size={12} /> Regenerate</button></div></div>)}</div>
  </PageFrame>;
}

function Settings() {
  const { thresholds, setThreshold, geminiStatus, geminiMessage, testGeminiKey } = useCrowdFlow();
  const [apiKey, setApiKey] = useState(() => window.localStorage.getItem('crowdflow-gemini-key') ?? '');
  const [model, setModel] = useState(() => window.localStorage.getItem('crowdflow-gemini-model') || 'gemini-2.5-flash-lite');
  const [saved, setSaved] = useState(false);
  const save = async () => { const trimmedKey = apiKey.trim(); window.localStorage.setItem('crowdflow-gemini-key', trimmedKey); window.localStorage.setItem('crowdflow-gemini-model', model); setApiKey(trimmedKey); await testGeminiKey(trimmedKey, model); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const statusTone = geminiStatus === 'connected' ? '#67e8a5' : geminiStatus === 'error' ? '#f472b6' : '#a78bfa';
  return <PageFrame page="settings">
    <div className="mb-6"><div className="cf-label mb-2">Control room preferences</div><h1 className="m-0 text-2xl font-extrabold tracking-[-.05em] text-[#f8f7ff]">Settings</h1><p className="mt-2 text-sm text-[#8f88b5]">These preferences are local to this browser and shape the operator view.</p></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_.8fr]">
      <div className="space-y-4"><div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Station defaults" title="Primary operating area" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-bold text-[#c4b5fd]">Default station</span><select className="cf-select" data-testid="select-default-station"><option>Central Terminal · CEN-01</option><option>Harbour Exchange · HBR-02</option><option>Northgate · NGT-04</option></select></label><label><span className="mb-1.5 block text-[10px] font-bold text-[#c4b5fd]">Default platform</span><select className="cf-select" data-testid="select-default-platform">{platforms.map((platform) => <option key={platform.id}>{platform.name}</option>)}</select></label></div></div><div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Risk engine" title="Capacity thresholds" action={<span className="text-[10px] text-[#8f88b5]">percent full</span>} /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([['watch', 'Watch'], ['warning', 'Warning'], ['high', 'High'], ['critical', 'Critical']] as Array<[keyof Thresholds, string]>).map(([key, label]) => <label key={key}><span className="mb-1.5 block text-[10px] font-bold text-[#c4b5fd]">{label}</span><input className="cf-input cf-mono" type="number" min="1" max="200" value={thresholds[key]} onChange={(event) => setThreshold(key, Number(event.target.value))} data-testid={`input-threshold-${key}`} /></label>)}</div><p className="mt-4 text-[10px] leading-relaxed text-[#8f88b5]">Risk labels are calculated locally. Keep the sequence ascending: watch → warning → high → critical.</p></div><div className="cf-panel p-5 sm:p-6"><SectionTitle eyebrow="Operator language" title="Announcement languages" /><div className="flex flex-wrap gap-2">{['English', 'Tamil', 'Hindi'].map((item, index) => <button key={item} className={`cf-btn ${index === 0 ? 'cf-btn-secondary' : 'cf-btn-quiet'} h-9`} data-testid={`button-language-${item.toLowerCase()}`}><Languages size={13} /> {item}{index === 0 && <Check size={12} />}</button>)}</div></div></div>
      <div className="cf-panel border-[#ec4899]/25 p-5 sm:p-6"><form onSubmit={(event) => { event.preventDefault(); void save(); }}><div className="mb-5 flex items-start justify-between"><div><div className="cf-label mb-2 text-[#f472b6]">Optional AI assistance</div><h2 className="m-0 text-lg font-extrabold text-[#f8f7ff]">Gemini API key</h2></div><div className="rounded-xl bg-[#ec4899]/10 p-3 text-[#f472b6]"><KeyRound size={20} /></div></div><p className="text-xs leading-relaxed text-[#c4b5fd]">Paste any Gemini API key from Google AI Studio. CrowdFlow tests it against the free Gemini 2.5 Flash-Lite model before using it for announcement drafts.</p><label className="mt-6 block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#8f88b5]">API key</span><input className="cf-input cf-mono" type="password" autoComplete="new-password" value={apiKey} placeholder="AIza…" onChange={(event) => setApiKey(event.target.value)} data-testid="input-gemini-api-key" /></label><label className="mt-4 block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#8f88b5]">Free model</span><select className="cf-select" value={model} onChange={(event) => setModel(event.target.value)} data-testid="select-gemini-model"><option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite · free tier</option><option value="gemini-2.5-flash">Gemini 2.5 Flash · free tier</option></select></label><button type="submit" disabled={geminiStatus === 'testing'} className="cf-btn cf-btn-primary mt-5 w-full" data-testid="button-save-gemini"><Save size={14} /> {geminiStatus === 'testing' ? 'Testing key…' : saved ? 'Saved and connected' : 'Save & test Gemini key'}</button><div className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-[10px] leading-relaxed" style={{ borderColor: `${statusTone}35`, background: `${statusTone}0d`, color: statusTone }} data-testid="status-gemini-connection"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: statusTone }} /><span>{geminiMessage}</span></div><div className="mt-5 flex gap-2 rounded-xl border border-[#a78bfa]/10 bg-[#0b0928]/50 p-3 text-[10px] leading-relaxed text-[#8f88b5]"><ShieldAlert size={14} className="mt-0.5 shrink-0 text-[#c4b5fd]" /><span>Gemini drafts are suggestions only. CrowdFlow keeps numerical forecast and risk decisions independent from model text.</span></div></form></div>
    </div>
  </PageFrame>;
}

function DashboardPage({ page }: { page: Page }) {
  if (page === 'overview') return <Overview />;
  if (page === 'live') return <LiveCrowd />;
  if (page === 'forecast') return <Forecast />;
  if (page === 'actions') return <Actions />;
  if (page === 'announcements') return <Announcements />;
  return <Settings />;
}

const queryClient = new QueryClient();

function Router() {
  return <ErrorBoundary><Switch>
    <Route path="/" component={() => <DashboardPage page="overview" />} />
    <Route path="/live-crowd" component={() => <DashboardPage page="live" />} />
    <Route path="/forecast" component={() => <DashboardPage page="forecast" />} />
    <Route path="/actions" component={() => <DashboardPage page="actions" />} />
    <Route path="/announcements" component={() => <DashboardPage page="announcements" />} />
    <Route path="/settings" component={() => <DashboardPage page="settings" />} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><CrowdFlowProvider><Router /></CrowdFlowProvider></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;