import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy, Component } from 'react';
import {
  BookOpen, House, Settings, PanelLeft, ChevronDown, Clock, Trash2,
  Edit3, Palette, NotebookPen, CalendarDays, Grid3X3,
  Maximize2, Search, X
} from 'lucide-react';
import { BiTransferAlt, BiGame, BiDna} from 'react-icons/bi';
import { FaSortAmountDown } from "react-icons/fa";
import { RiRobot2Line } from "react-icons/ri";
import { GoBeaker } from "react-icons/go";
import { SlCalculator } from "react-icons/sl";
import { PiCircleDashedBold } from "react-icons/pi";
import { BsOpencollective } from "react-icons/bs";
import { HiMiniChartBar } from "react-icons/hi2";
import { useHistory } from '@/context/HistoryContext';
import ScienceJoke from '@/components/shared/ScienceJoke';
import SettingsPanel from '@/components/shared/SettingsPanel';
import { AuthWelcomeModal } from '@/components/shared/AuthWelcomeModal';
import { APP_THEMES } from '@/styles/themes';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { AccountRequired } from '@/components/tools/toolUtils';
import { rankToolSearchResults } from '@/lib/toolSearch';
import WorkspaceTabs from '@/components/shell/WorkspaceTabs';

// Eagerly loaded calculators
import DigestCalculator from '@/components/calculators/DigestCalculator';
import LigationCalculator from '@/components/calculators/LigationCalculator';
import GibsonCalculator from '@/components/calculators/GibsonCalculator';
import PCRCalculator from '@/components/calculators/PCRCalculator';
import DilutionCalculator from '@/components/calculators/DilutionCalculator';
import ProteinConcCalculator from '@/components/calculators/ProteinConcCalculator';

// Lazy loaded non-calculators and other tools
const BufferMediumTool = lazy(() => import('@/components/tools/BufferMediumTool'));
const UsefulTools = lazy(() => import('@/components/tools/UsefulTools'));
const NotesTool = lazy(() => import('@/components/tools/NotesTool'));
const AgendaTool = lazy(() => import('@/components/tools/AgendaTool'));
const AIAssistant = lazy(() => import('@/components/calculators/AIAssistant'));
const ProtocolLibrary = lazy(() => import('@/components/calculators/ProtocolLibrary'));
const GelSimulator = lazy(() => import('@/components/calculators/GelSimulator'));
const PlasmidAnalyzer = lazy(() => import('@/components/calculators/PlasmidAnalyzer'));

const SETTINGS_KEY = 'biba_bench_buddy_settings';
const RECENTS_KEY = 'bibabenchbuddy_recent_activity_contexts_v2';
const SIDEBAR_WIDTH_KEY = 'bibabenchbuddy_sidebar_width';
const DEFAULT_ACCENT_COLOR = '#db2777';
const HIDDEN_HISTORY_TOOL_IDS = new Set(['__seq_analyzer_library__']);
const isHiddenHistoryTool = toolId => HIDDEN_HISTORY_TOOL_IDS.has(toolId) || String(toolId || '').startsWith('__account_state__:');

class LazyToolErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("LazyToolErrorBoundary caught error:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-semibold">This tool could not be loaded.</p>
        <p className="mt-1 text-xs leading-relaxed opacity-80">
          Refresh the app and try again. In development this can happen when Vite refreshes optimized dependencies.
        </p>
        {this.state.error?.message && (
          <p className="mt-2 text-xs font-mono text-red-600 dark:text-red-400 bg-white/70 dark:bg-black/20 p-2 rounded border border-amber-200/60 break-words">
            {this.state.error.message}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }
}

function getSettingsKey(userId) {
  return userId ? `${SETTINGS_KEY}_${userId}` : SETTINGS_KEY;
}

function loadSettings(userId) {
  try {
    const key = getSettingsKey(userId);
    const saved = localStorage.getItem(key);
    if (!saved) return null;
    const settings = JSON.parse(saved);
    if (!userId) {
      // Never allow API keys for guests
      const apiKeys = ['groqApiKey', 'openaiApiKey', 'geminiApiKey', 'openrouterApiKey', 'anthropicApiKey', 'deepseekApiKey'];
      apiKeys.forEach(k => delete settings[k]);
    }
    return settings;
  } catch {
    return null;
  }
}

const DEFAULT_SETTINGS = {
  appTheme: 'default',
  fontSize: '16px',
  language: 'en',
  accentColor: DEFAULT_ACCENT_COLOR,
};

function getAccentTokens(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value || '');
  const hex = match ? match[1] : DEFAULT_ACCENT_COLOR.slice(1);
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  const lightness = (maximum + minimum) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);

  return {
    color: `#${hex}`,
    hsl: `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`,
    foreground: luminance > 0.62 ? '0 0% 9%' : '0 0% 100%',
  };
}

const CALCULATORS = [
  { id: 'digest', name: 'Digestion', icon: BiGame, gradient: 'from-rose-500 to-purple-400' },
  { id: 'ligation', name: 'Ligation', icon: BsOpencollective, gradient: 'from-orange-500 to-pink-500' },
  { id: 'gibson', name: 'Gibson', icon: PiCircleDashedBold, gradient: 'from-rose-400 to-purple-500' },
  { id: 'pcr', name: 'PCR', icon: BiTransferAlt, gradient: 'from-pink-500 to-orange-500' },
  { id: 'dilution', name: 'Dilutions', icon: SlCalculator, gradient: 'from-rose-500 to-pink-500' },
  { id: 'protein', name: 'BCA assay', icon: HiMiniChartBar, gradient: 'from-purple-500 to-pink-500' },
];
// Tools with their sub-tabs (for sidebar navigation)
const TOOL_TABS = {
  digest: [
    { id: 'single', label: 'Single Digest' },
    { id: 'batch', label: 'Multiple Digest' },
  ],
  ligation: [
    { id: 'single', label: 'Single Ligation' },
    { id: 'batch', label: 'Batch Ligation' },
  ],
  gibson: [
    { id: 'single', label: 'Single Gibson' },
    { id: 'batch', label: 'Batch Gibson' },
  ],
  pcr: [
    { id: 'mix', label: 'PCR Mix' },
    { id: 'program', label: 'PCR Program' },
    { id: 'oepcr', label: 'OE-PCR' },
    { id: 'product', label: 'Product Sequence' },
  ],
  dilution: [
    { id: 'c1v1', label: 'C₁V₁' },
    { id: 'sample', label: 'Sample Dilution' },
    { id: 'addto', label: 'Add to Volume' },
    { id: 'serial', label: 'Serial Dilution' },
  ],
  protein: [
    { id: 'standards', label: 'BCA assay' },
    { id: 'prep', label: 'SDS-PAGE Prep' },
  ],
  gel: [
    { id: 'dna', label: 'DNA Gel' },
    { id: 'wb', label: 'Western Blot' },
  ],
  protocols: [
    { id: 'library', label: 'Protocol Library' },
    { id: 'ai', label: 'AI Generator' },
  ],
};

const TOOL_GROUPS = [
  {
    id: 'lab',
    label: 'Lab Tools',
    tools: [
      { id: 'gel', name: 'Gel Simulator', icon: FaSortAmountDown, gradient: 'from-blue-600 to-cyan-500' },
      { id: 'plasmid', name: 'Sequence Analyzer', icon: BiDna, gradient: 'from-teal-500 to-sky-500' },
      { id: 'plates', name: 'Plate Labeler', icon: Grid3X3, gradient: 'from-emerald-500 to-sky-500' },
      { id: 'buffer', name: 'Buffers', icon: GoBeaker, direction: 'bg-gradient-to-tl', gradient: 'from-blue-600 via-violet-500 to-pink-400' },
    ],
  },
  {
    id: 'general',
    label: 'Planning & Documentation',
    tools: [
      { id: 'notes', name: 'Notes', icon: NotebookPen, direction: 'bg-gradient-to-br', gradient: 'from-pink-500 to-blue-500' },
      { id: 'agenda', name: 'Agenda', icon: CalendarDays, direction: 'bg-gradient-to-tr', gradient: 'from-blue-500 to-pink-500' },
      { id: 'protocols', name: 'Protocols', icon: BookOpen, direction: 'bg-gradient-to-bl', gradient: 'from-fuchsia-500 via-purple-500 to-blue-500' },
    ],
  },
];

const SEARCHABLE_TOOLS = [...CALCULATORS, ...TOOL_GROUPS.flatMap(group => group.tools)];
const TOOL_BY_ID = new Map(SEARCHABLE_TOOLS.map(tool => [tool.id, tool]));

const TOOL_DESCRIPTIONS = {
  digest: 'Plan restriction digests and enzyme mixes',
  ligation: 'Calculate vector and insert ligation ratios',
  gibson: 'Assemble overlapping DNA fragments',
  pcr: 'Build PCR mixes, programs and products',
  dilution: 'Calculate single and serial dilutions',
  protein: 'BCA standards and SDS-PAGE preparation',
  gel: 'Preview DNA gels and western blots',
  plasmid: 'Inspect, annotate and align sequences',
  plates: 'Create clear sample and plate layouts',
  notes: 'Keep bench notes beside your calculations',
  agenda: 'Plan experiments and lab work',
  protocols: 'Build and organize reusable protocols',
  buffer: 'Prepare buffers and growth media',
};

const TOOL_SEARCH_ITEMS = [
  ...CALCULATORS.map(tool => ({ ...tool, toolId: tool.id, label: tool.name, category: 'Calculators' })),
  ...TOOL_GROUPS.flatMap(group => group.tools.map(tool => ({
    ...tool,
    toolId: tool.id,
    label: tool.name,
    category: group.label,
  }))),
  ...Object.entries(TOOL_TABS).flatMap(([toolId, tabs]) => {
    const parent = TOOL_BY_ID.get(toolId);
    const category = CALCULATORS.some(tool => tool.id === toolId)
      ? 'Calculators'
      : TOOL_GROUPS.find(group => group.tools.some(tool => tool.id === toolId))?.label || 'Tool';
    return tabs.map(tab => ({
      toolId,
      tabId: tab.id,
      label: tab.label,
      parentLabel: parent?.name || toolId,
      category,
    }));
  }),
].map(item => ({
  ...item,
  keywords: {
    digest: 'restriction enzyme dna digest multiple batch',
    ligation: 'vector insert dna cloning batch',
    gibson: 'assembly fragments cloning batch',
    pcr: 'polymerase chain reaction primers thermocycler',
    dilution: 'concentration c1v1 serial sample volume',
    protein: 'bca assay sds page sample prep concentration',
    gel: 'electrophoresis dna western blot bands',
    plasmid: 'sequence dna alignment map analyzer',
    plates: 'plate labeler wells samples',
    notes: 'notebook writing',
    agenda: 'calendar planning',
    protocols: 'library ai methods',
    buffer: 'medium recipe chemistry',
  }[item.toolId] || '',
}));

// ── All tool IDs to keep mounted ─────────────────────────────────────────────
const ALL_IDS = [
  'digest', 'ligation', 'gibson', 'pcr', 'dilution', 'protein',
  'buffer', 'plates', 'notes', 'agenda', 'protocols', 'ai', 'gel', 'plasmid',
];

// ── Custom tab colors ────────────────────────────────────────────────────────
const TAB_COLORS = [
  { id: 'rose', name: 'Rose/Rood', activeClass: 'bg-rose-500 hover:bg-rose-600 text-white', previewBg: 'bg-rose-500' },
  { id: 'blue', name: 'Blauw', activeClass: 'bg-blue-500 hover:bg-blue-600 text-white', previewBg: 'bg-blue-500' },
  { id: 'emerald', name: 'Groen', activeClass: 'bg-emerald-500 hover:bg-emerald-600 text-white', previewBg: 'bg-emerald-500' },
  { id: 'purple', name: 'Paars', activeClass: 'bg-purple-500 hover:bg-purple-600 text-white', previewBg: 'bg-purple-500' },
  { id: 'orange', name: 'Oranje', activeClass: 'bg-orange-500 hover:bg-orange-600 text-white', previewBg: 'bg-orange-500' },
  { id: 'amber', name: 'Geel', activeClass: 'bg-amber-500 hover:bg-amber-600 text-white', previewBg: 'bg-amber-500' },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ active, onSelect, onSelectTab, activeTab, isDark, iconStyle, iconTextColor, onRestoreHistory, onOpenAI, isMobile, collapsed, labels, lang, width, onResizeStart }) {
  const [expandedCalc, setExpandedCalc] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [showFullHistoryModal, setShowFullHistoryModal] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const { history, deleteHistoryItem, clearHistory } = useHistory();
  const visibleHistory = history.filter(item => !item.data?.hidden && !isHiddenHistoryTool(item.toolId));

  const filteredHistory = useMemo(() => {
    if (!historyQuery.trim()) return visibleHistory;
    const q = historyQuery.toLowerCase();
    return visibleHistory.filter(item => {
      const title = (item.data?.preview || item.toolName || item.toolId || '').toLowerCase();
      const tool = (item.toolName || item.toolId || '').toLowerCase();
      return title.includes(q) || tool.includes(q);
    });
  }, [visibleHistory, historyQuery]);

  // Auto-expand active tool's tabs
  useEffect(() => {
    if (active && TOOL_TABS[active]) setExpandedCalc(active);
  }, [active]);

  const btnBase = (isActive) => `w-full flex items-center gap-2 px-2.5 py-1.5 min-h-[32px] rounded-lg text-sm font-medium mb-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${isActive
    ? (isDark ? 'bg-white/15 text-white font-semibold' : 'bg-[#e7e7e7] text-[#0d0d0d] font-semibold')
    : (isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[#5d5d5d] hover:bg-[#ececec] hover:text-[#0d0d0d]')
    }`;

  const renderToolIcon = (tool) => (
    <div
      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${iconStyle ? '' : `${tool.direction || 'bg-gradient-to-br'} ${tool.gradient}`}`}
      style={iconStyle || {}}
    >
      <tool.icon className={`w-2.5 h-2.5 ${iconTextColor || 'text-white'}`} />
    </div>
  );

  if (collapsed && !isMobile) {
    return (
      <aside
        aria-label={labels.navigation}
        className={`relative z-30 flex h-full w-14 shrink-0 flex-col items-center border-r pt-2 ${
          isDark ? 'border-white/10 bg-slate-900' : 'border-[#e5e5e5] bg-[#f7f7f8]'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          title={labels.homepage}
          aria-label={labels.homepage}
          className={`mb-1 flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            active === null
              ? isDark ? 'bg-white/15 text-white' : 'bg-[#e7e7e7] text-[#0d0d0d]'
              : isDark ? 'text-white/60 hover:bg-white/10' : 'text-[#6f6f6f] hover:bg-[#ececec] hover:text-[#0d0d0d]'
          }`}
        >
          <House className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenAI}
          title={labels.aiAssistant}
          aria-label={labels.aiAssistant}
          className={`my-0.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            active === 'ai'
              ? isDark ? 'bg-white/15 text-white' : 'bg-[#e7e7e7] text-[#0d0d0d]'
              : isDark ? 'text-white/60 hover:bg-white/10' : 'text-[#6f6f6f] hover:bg-[#ececec] hover:text-[#0d0d0d]'
          }`}
        >
          <RiRobot2Line className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label={labels.navigation}
      className={`${isMobile ? 'absolute left-0 top-0 z-50 h-full w-64 shadow-2xl' : 'relative z-30 h-full shrink-0'} overflow-y-auto border-r ${isDark ? 'bg-slate-900 border-white/10' : 'bg-[#f7f7f8] border-[#e5e5e5]'}`}
      style={isMobile ? undefined : { width }}
    >
      <div className="shrink-0 px-2 py-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 min-h-[34px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            active === null
              ? (isDark ? 'bg-white/15 text-white font-semibold' : 'bg-[#e7e7e7] text-[#0d0d0d] font-semibold')
              : (isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[#5d5d5d] hover:bg-[#ececec] hover:text-[#0d0d0d]')
          }`}
        >
          <House className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-xs">{labels.homepage}</span>
        </button>
        <button
          type="button"
          onClick={onOpenAI}
          className={`mt-0.5 w-full flex items-center gap-2 px-2 py-1.5 min-h-[34px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
            active === 'ai'
              ? (isDark ? 'bg-white/15 text-white font-semibold' : 'bg-[#e7e7e7] text-[#0d0d0d] font-semibold')
              : (isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[#5d5d5d] hover:bg-[#ececec] hover:text-[#0d0d0d]')
          }`}
        >
          <RiRobot2Line className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-xs">{labels.aiAssistant}</span>
        </button>
      </div>

      {/* Calculations */}
      <div className="px-2 pt-1 pb-0.5">
        <p className={`px-1 mb-1.5 text-[11px] font-semibold tracking-wide ${isDark ? 'text-white/45' : 'text-[#737373]'}`}>{labels.calculators}</p>
        {CALCULATORS.map(c => {
          const isActive = active === c.id;
          const hasTabs = !!TOOL_TABS[c.id];
          const isExpanded = expandedCalc === c.id;
          return (
            <div key={c.id}>
              <button
                onClick={() => {
                  onSelect(c.id);
                  if (hasTabs) setExpandedCalc(isExpanded ? null : c.id);
                }}
                className={btnBase(isActive)}
              >
                {renderToolIcon(c)}
                <span className="text-xs flex-1 text-left">{c.name}</span>
                {hasTabs && <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />}
              </button>
              {hasTabs && isExpanded && (
                <div className="ml-5 mb-0.5 space-y-0.5">
                  {TOOL_TABS[c.id].map(tab => (
                    <button key={tab.id} onClick={() => { onSelect(c.id); onSelectTab(c.id, tab.id); }}
                      className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors ${isActive && activeTab[c.id] === tab.id
                        ? (isDark ? 'bg-white/20 text-white font-semibold' : 'bg-slate-200/80 text-slate-900 font-semibold')
                        : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60')
                        }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tool groups */}
      {TOOL_GROUPS.map(group => (
        <div key={group.id} className="px-2 pt-0.5 pb-0.5">
          <p className={`px-1 mb-1 text-[11px] font-semibold tracking-wide ${isDark ? 'text-white/45' : 'text-[#737373]'}`}>{group.label}</p>
          {group.tools.map(t => {
            const isActive = active === t.id;
            const hasTabs = !!TOOL_TABS[t.id];
            const isExpanded = expandedCalc === t.id;
            return (
              <div key={t.id}>
                <button
                  onClick={() => {
                    onSelect(t.id);
                    if (hasTabs) setExpandedCalc(isExpanded ? null : t.id);
                  }}
                  className={btnBase(isActive)}
                >
                  {renderToolIcon(t)}
                  <span className="text-xs flex-1 text-left">{t.name}</span>
                  {hasTabs && <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />}
                </button>
                {hasTabs && isExpanded && (
                  <div className="ml-5 mb-0.5 space-y-0.5">
                    {TOOL_TABS[t.id].map(tab => (
                      <button key={tab.id} onClick={() => { onSelect(t.id); onSelectTab(t.id, tab.id); }}
                        className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors ${isActive && activeTab[t.id] === tab.id
                          ? (isDark ? 'bg-white/20 text-white font-semibold' : 'bg-slate-200/80 text-slate-900 font-semibold')
                          : (isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60')
                          }`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* History section */}
      <div className={`mt-auto border-t p-2 pt-3 flex flex-col ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between w-full px-1 mb-2">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="flex items-center gap-1.5 group flex-1 text-left"
          >
            <p className={`text-[11px] font-semibold tracking-wide flex items-center gap-1.5 ${isDark ? 'text-white/45 group-hover:text-white/70' : 'text-[#737373] group-hover:text-[#444]'}`}>
              <Clock className="w-3.5 h-3.5" /> {labels.history}
            </p>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${historyExpanded ? 'rotate-180' : ''} ${isDark ? 'text-white/30' : 'text-slate-300'}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFullHistoryModal(true);
            }}
            title={lang === 'nl' ? 'Volledige geschiedenis openen' : 'Open full history'}
            className={`p-1 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'}`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {historyExpanded && (
          <div className="animate-in slide-in-from-bottom-2 duration-300">
            {visibleHistory.length === 0 ? (
              <p className={`text-xs text-center p-4 italic ${isDark ? 'text-white/20' : 'text-slate-300'}`}>{labels.empty}</p>
            ) : (
              <div className="overflow-y-auto space-y-0.5 pr-1" style={{ maxHeight: '160px' }}>
                {visibleHistory.map(item => {
                  const displayTitle = item.data?.preview || item.toolName || item.toolId || 'History item';
                  const displayDate = new Date(item.createdAt || item.timestamp);

                  return (
                    <div
                      key={item.id}
                      className={`group flex items-start justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                      onClick={() => onRestoreHistory(item)}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className={`text-xs font-medium truncate ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                          {displayTitle}
                        </p>
                        <p className={`text-[10px] truncate ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                          {displayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')} · {displayDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {!isMobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={lang === 'nl' ? 'Breedte van zijbalk aanpassen' : 'Resize sidebar'}
          onPointerDown={onResizeStart}
          className="sidebar-resize-handle absolute inset-y-0 right-[-3px] z-40 w-1.5 cursor-col-resize touch-none bg-transparent transition-colors"
        />
      )}

      {/* Full History Modal */}
      {showFullHistoryModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            setShowFullHistoryModal(false);
            setHistoryQuery('');
          }}
        >
          <div
            className={`flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {lang === 'nl' ? 'Geschiedenis' : 'History'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {visibleHistory.length} {visibleHistory.length === 1 ? (lang === 'nl' ? 'sessie opgeslagen' : 'session saved') : (lang === 'nl' ? 'sessies opgeslagen' : 'sessions saved')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {visibleHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm(lang === 'nl' ? 'Weet je zeker dat je alle geschiedenis wilt wissen?' : 'Are you sure you want to clear all history?')) {
                        clearHistory();
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      isDark ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    {labels.clearAll}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowFullHistoryModal(false);
                    setHistoryQuery('');
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search filter */}
            <div className={`p-4 border-b ${isDark ? 'border-white/10 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="relative">
                <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/30' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder={lang === 'nl' ? 'Zoek in geschiedenis...' : 'Search history...'}
                  className={`w-full pl-10 pr-4 py-2 text-sm rounded-xl border outline-none transition-all ${
                    isDark
                      ? 'bg-slate-900 border-white/10 text-white placeholder-white/30 focus:border-emerald-500/50'
                      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20'
                  }`}
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className={`w-10 h-10 mx-auto mb-3 opacity-30 ${isDark ? 'text-white' : 'text-slate-400'}`} />
                  <p className={`text-sm ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                    {historyQuery ? (lang === 'nl' ? 'Geen overeenkomende items gevonden.' : 'No matching items found.') : labels.empty}
                  </p>
                </div>
              ) : (
                filteredHistory.map((item) => {
                  const displayTitle = item.data?.preview || item.toolName || item.toolId || 'History item';
                  const displayDate = new Date(item.createdAt || item.timestamp);
                  const isNote = item.toolId === 'notes';

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onRestoreHistory(item);
                        setShowFullHistoryModal(false);
                        setHistoryQuery('');
                      }}
                      className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer border transition-all duration-150 ${
                        isDark
                          ? 'bg-white/[0.02] border-white/5 hover:bg-white/10 hover:border-white/15'
                          : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
                        <div
                          className={`p-2.5 rounded-xl shrink-0 ${
                            isNote
                              ? isDark ? 'bg-pink-500/10 text-pink-400' : 'bg-pink-50 text-pink-600'
                              : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isNote ? <Edit3 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isDark ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {item.toolName || item.toolId}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                              {displayDate.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-US')} ·{' '}
                              {displayDate.toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {displayTitle}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHistoryItem(item.id);
                        }}
                        title={lang === 'nl' ? 'Verwijderen' : 'Delete'}
                        className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                          isDark ? 'hover:bg-rose-500/20 text-rose-400' : 'hover:bg-rose-50 text-rose-600'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ToolFinder({ open, onClose, onSelect, isDark, isMobile, labels }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const results = useMemo(() => rankToolSearchResults(TOOL_SEARCH_ITEMS, query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const choose = item => {
    onSelect(item);
    onClose();
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault();
      setSelectedIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault();
      setSelectedIndex(index => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter' && results[selectedIndex]) {
      event.preventDefault();
      choose(results[selectedIndex]);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[120] flex justify-center bg-slate-950/55 px-3 backdrop-blur-sm ${isMobile ? 'items-start pt-16' : 'items-start pt-[14vh]'}`}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={labels.toolFinder}
        className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
        onKeyDown={handleKeyDown}
      >
        <div className={`flex items-center gap-3 border-b px-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
          <Search className={`h-5 w-5 shrink-0 ${isDark ? 'text-white/45' : 'text-slate-400'}`} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label={labels.searchTools}
            placeholder={labels.searchTools}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className={`rounded-lg p-2 ${isDark ? 'text-white/45 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} aria-label={labels.clearSearch}>
              <X className="h-4 w-4" />
            </button>
          )}
          {!isMobile && <kbd className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'border-white/10 bg-white/5 text-white/40' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>ESC</kbd>}
        </div>

        <div className="max-h-[min(60vh,30rem)] overflow-y-auto p-2" role="listbox" aria-label={labels.searchResults}>
          {!query && <p className={`px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/35' : 'text-slate-400'}`}>{labels.quickAccess}</p>}
          {results.length ? results.map((item, index) => {
            const Icon = item.icon || TOOL_BY_ID.get(item.toolId)?.icon;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${item.toolId}-${item.tabId || 'root'}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => choose(item)}
                className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${isSelected ? (isDark ? 'bg-white/10' : 'bg-slate-100') : (isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient || 'from-slate-500 to-slate-700'}`}>
                  {Icon && <Icon className="h-4 w-4 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span className={`block truncate text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{item.tabId ? `${item.parentLabel} · ${item.category}` : item.category}</span>
                </span>
                {isSelected && !isMobile && <span className={`text-[10px] ${isDark ? 'text-white/35' : 'text-slate-400'}`}>↵</span>}
              </button>
            );
          }) : (
            <div className="px-4 py-10 text-center">
              <Search className={`mx-auto mb-3 h-7 w-7 ${isDark ? 'text-white/20' : 'text-slate-300'}`} />
              <p className="text-sm font-semibold">{labels.noToolsFound}</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{labels.tryAnotherSearch}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const ALL_BODY_THEME_CLASSES = Object.values(APP_THEMES).map(t => t.bodyClass).filter(Boolean);

export default function Home() {
  const { user, isLoadingAuth, isPasswordRecovery } = useAuth();
  const isMobile = useIsMobile();
  const [active, setActive] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tool');
      return saved && ALL_IDS.includes(saved) ? saved : null;
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [visitedIds, setVisitedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tool');
      return saved && ALL_IDS.includes(saved) ? new Set([saved]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSettings, setShowSettings] = useState(false);
  const [showToolFinder, setShowToolFinder] = useState(false);
  const [showAuthWelcome, setShowAuthWelcome] = useState(false);
  const [authWelcomeMode, setAuthWelcomeMode] = useState('login');
  const [homeSearch, setHomeSearch] = useState('');
  const [recentContexts, setRecentContexts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
      return Array.isArray(saved) ? saved.slice(0, 5) : [];
    } catch {
      return [];
    }
  });
  const [workspaceTabs, setWorkspaceTabs] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tool');
      if (saved && ALL_IDS.includes(saved)) {
        const tool = TOOL_BY_ID.get(saved);
        return [
          { id: 'home', toolId: null, title: 'Home' },
          { id: `workspace-${saved}-restored`, toolId: saved, title: `${tool?.name || 'Workspace'} 1`, icon: tool?.icon },
        ];
      }
    } catch {}
    return [{ id: 'home', toolId: null, title: 'Home' }];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tool');
      return saved && ALL_IDS.includes(saved) ? `workspace-${saved}-restored` : 'home';
    } catch {
      return 'home';
    }
  });

  useEffect(() => {
    try {
      if (active) {
        localStorage.setItem('bibabenchbuddy_active_tool', active);
      } else {
        localStorage.removeItem('bibabenchbuddy_active_tool');
      }
    } catch {}
  }, [active]);

  useEffect(() => {
    if (user) setShowAuthWelcome(false);
  }, [user]);

  const dismissAuthWelcome = () => {
    setShowAuthWelcome(false);
  };

  // Auto-open settings panel for password recovery
  useEffect(() => {
    if (isPasswordRecovery) {
      setShowSettings(true);
    }
  }, [isPasswordRecovery]);

  useEffect(() => {
    const openAuth = event => {
      setAuthWelcomeMode(event.detail?.mode === 'signup' ? 'signup' : 'login');
      setShowAuthWelcome(true);
    };
    window.addEventListener('bibabench:open-auth', openAuth);
    return () => window.removeEventListener('bibabench:open-auth', openAuth);
  }, []);

  useEffect(() => {
    const openSettingsShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', openSettingsShortcut);
    return () => window.removeEventListener('keydown', openSettingsShortcut);
  }, []);

  useEffect(() => {
    const openToolFinderShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowToolFinder(true);
      }
    };
    window.addEventListener('keydown', openToolFinderShortcut);
    return () => window.removeEventListener('keydown', openToolFinderShortcut);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return window.innerWidth >= 768 && localStorage.getItem('bibabenchbuddy_sidebar_expanded') === 'true';
    } catch {
      return false;
    }
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      return Number.isFinite(storedWidth) && storedWidth >= 190 && storedWidth <= 360 ? storedWidth : 224;
    } catch {
      return 224;
    }
  });

  const handleSidebarResizeStart = useCallback(event => {
    if (isMobile) return;
    event.preventDefault();
    const startingX = event.clientX;
    const startingWidth = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = moveEvent => {
      setSidebarWidth(Math.min(360, Math.max(190, startingWidth + moveEvent.clientX - startingX)));
    };
    const handlePointerUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [isMobile, sidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); } catch {}
  }, [sidebarWidth]);

  useEffect(() => {
    if (isMobile) return;
    try { localStorage.setItem('bibabenchbuddy_sidebar_expanded', String(sidebarOpen)); } catch {}
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('bibabenchbuddy_active_tab');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('bibabenchbuddy_active_tab', JSON.stringify(activeTab));
    } catch {}
  }, [activeTab]);

  const [historyData, setHistoryData] = useState(null);
  const [editingTab, setEditingTab] = useState(null); // { toolKey, tabId, name }
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, toolKey: string, tab: object }

  const getSubtoolKey = (toolId) => {
    if (!TOOL_TABS[toolId]) return toolId;
    const subTabId = activeTab[toolId] || TOOL_TABS[toolId][0].id;
    return `${toolId}-${subTabId}`;
  };

  const [toolInstances, setToolInstances] = useState(() => {
    const initial = {};
    ALL_IDS.forEach(id => {
      if (TOOL_TABS[id]) {
        TOOL_TABS[id].forEach(subtab => {
          const key = `${id}-${subtab.id}`;
          initial[key] = [{ id: `default-${key}`, name: 'Tab 1' }];
        });
      } else {
        initial[id] = [{ id: `default-${id}`, name: 'Tab 1' }];
      }
    });
    return initial;
  });

  const [activeInstance, setActiveInstance] = useState(() => {
    const initial = {};
    ALL_IDS.forEach(id => {
      if (TOOL_TABS[id]) {
        TOOL_TABS[id].forEach(subtab => {
          const key = `${id}-${subtab.id}`;
          initial[key] = `default-${key}`;
        });
      } else {
        initial[id] = `default-${id}`;
      }
    });
    return initial;
  });

  const recordRecentActivity = useCallback(() => {
    if (!active) return;
    const subtabId = TOOL_TABS[active]
      ? (activeTab[active] || TOOL_TABS[active][0].id)
      : null;
    const toolKey = subtabId ? `${active}-${subtabId}` : active;
    const instanceId = activeInstance[toolKey] || null;
    const instanceName = (toolInstances[toolKey] || []).find(instance => instance.id === instanceId)?.name || null;
    const recentKey = `${active}:${subtabId || 'root'}:${instanceId || 'single'}`;
    const nextItem = {
      key: recentKey,
      toolId: active,
      subtabId,
      instanceId,
      instanceName,
      lastUsed: Date.now(),
    };

    setRecentContexts(previous => {
      const existing = previous[0];
      if (existing?.key === recentKey && existing.instanceName === instanceName) return previous;
      const next = [nextItem, ...previous.filter(item => item.key !== recentKey)].slice(0, 5);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [active, activeInstance, activeTab, toolInstances]);

  const handleToolActivityCapture = useCallback(event => {
    if (!active) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('[data-recent-ignore="true"]')) return;

    if (event.type === 'click') {
      const button = target.closest('button, [role="button"], [role="switch"]');
      if (!button || button.getAttribute('role') === 'tab' || button.disabled) return;
      const label = [button.getAttribute('aria-label'), button.getAttribute('title'), button.textContent]
        .filter(Boolean)
        .join(' ')
        .trim()
        .toLowerCase();
      if (/\b(help|info|close|open|expand|collapse|previous|next|copy|download|export|print|show|hide|log in|sign up)\b/.test(label)) return;
    }

    recordRecentActivity();
  }, [active, recordRecentActivity]);
  const [proteinAssaySamplesByTab, setProteinAssaySamplesByTab] = useState({});
  const handleProteinAssaySamplesChange = useCallback((tabIndex, samples) => {
    setProteinAssaySamplesByTab(previous => ({ ...previous, [tabIndex]: samples }));
  }, []);

  const handleAddTab = (toolKey) => {
    const newId = `${toolKey}-${Date.now()}`;
    const currentList = toolInstances[toolKey] || [];
    const nextNum = currentList.length + 1;
    const newTab = { id: newId, name: `Tab ${nextNum}` };
    setToolInstances(prev => ({
      ...prev,
      [toolKey]: [...currentList, newTab]
    }));
    setActiveInstance(prev => ({
      ...prev,
      [toolKey]: newId
    }));
  };

  const handleRemoveTab = (toolKey, tabId, e) => {
    e.stopPropagation();
    const currentList = toolInstances[toolKey] || [];
    if (currentList.length <= 1) return;
    const index = currentList.findIndex(t => t.id === tabId);
    const newList = currentList.filter(t => t.id !== tabId);
    setToolInstances(prev => ({
      ...prev,
      [toolKey]: newList
    }));
    if (activeInstance[toolKey] === tabId) {
      const nextActiveIndex = index > 0 ? index - 1 : 0;
      setActiveInstance(prev => ({
        ...prev,
        [toolKey]: newList[nextActiveIndex].id
      }));
    }
  };

  const handleCommitRename = () => {
    if (!editingTab) return;
    const { toolKey, tabId, name } = editingTab;
    const trimmed = name.trim();
    if (trimmed) {
      setToolInstances(prev => {
        const list = prev[toolKey] || [];
        return {
          ...prev,
          [toolKey]: list.map(t => t.id === tabId ? { ...t, name: trimmed } : t)
        };
      });
    }
    setEditingTab(null);
  };

  const handleSetTabColor = (toolKey, tabId, colorId) => {
    setToolInstances(prev => {
      const list = prev[toolKey] || [];
      return {
        ...prev,
        [toolKey]: list.map(t => t.id === tabId ? { ...t, color: colorId } : t)
      };
    });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Accept both decimal separators app-wide. Number inputs normally reject a
  // comma before React receives it, so normalize it at keydown level while
  // preserving the current value and caret position.
  useEffect(() => {
    const normalizeDecimalKey = (event) => {
      if (event.key !== ',') return;
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.type !== 'number' && input.inputMode !== 'decimal') return;
      event.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const next = `${input.value.slice(0, start)}.${input.value.slice(end)}`;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      requestAnimationFrame(() => input.setSelectionRange?.(start + 1, start + 1));
    };
    window.addEventListener('keydown', normalizeDecimalKey, true);
    return () => window.removeEventListener('keydown', normalizeDecimalKey, true);
  }, []);

  useEffect(() => {
    if (active) {
      setVisitedIds(prev => {
        if (prev.has(active)) return prev;
        const next = new Set(prev);
        next.add(active);
        return next;
      });
    }
  }, [active]);

  useEffect(() => {
    const initialSettings = { ...DEFAULT_SETTINGS, ...(loadSettings(user?.id) || {}) };
    setSettings(initialSettings);
    if (user && isSyncEnabled()) {
      syncSettingsFromRemote(user.id);
    }
  }, [user]);

  useEffect(() => {
    const key = getSettingsKey(user?.id);
    localStorage.setItem(key, JSON.stringify(settings));
    document.documentElement.style.fontSize = settings.fontSize || '16px';
    const currentTheme = APP_THEMES[settings.appTheme] || APP_THEMES.default;
    if (currentTheme.isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.body.classList.remove(...ALL_BODY_THEME_CLASSES);
    if (currentTheme.bodyClass) document.body.classList.add(currentTheme.bodyClass);
  }, [settings, user]);

  // Grouped undo/redo for inputs (fixes per-character undo)
  useEffect(() => {
    let activeElement = null;
    let typingTimeout = null;
    let isRestoring = false;
    const historyMap = new WeakMap();

    const getVal = (el) => el.isContentEditable ? el.innerText : el.value;
    const setVal = (el, val) => {
      isRestoring = true;
      if (el.isContentEditable) {
        el.innerText = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        const proto = el.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, val);
        else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      isRestoring = false;
    };

    const getState = (el) => {
      if (!historyMap.has(el)) {
        historyMap.set(el, { history: [getVal(el)], index: 0 });
      }
      return historyMap.get(el);
    };

    const saveState = (el, val) => {
      const state = getState(el);
      if (state.index < state.history.length - 1) {
        state.history = state.history.slice(0, state.index + 1);
      }
      if (state.history[state.history.length - 1] !== val) {
        state.history.push(val);
        state.index++;
      }
    };

    const handleFocus = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if (!isInput) return;
      activeElement = e.target;
      getState(activeElement); // Initialize if not present
    };

    const handleInput = (e) => {
      if (isRestoring || e.target !== activeElement) return;
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (activeElement) saveState(activeElement, getVal(activeElement));
      }, 400); // 400ms pause groups the typing changes
    };

    const handleBlur = (e) => {
      if (e.target === activeElement) {
        clearTimeout(typingTimeout);
        if (activeElement) {
          const currentVal = getVal(activeElement);
          const state = getState(activeElement);
          if (currentVal !== state.history[state.index]) saveState(activeElement, currentVal);
        }
        activeElement = null;
      }
    };

    const handleKeyDown = (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if (!isInput || e.target !== activeElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        clearTimeout(typingTimeout);
        const state = getState(activeElement);

        if (e.shiftKey) { // Redo
          if (state.index < state.history.length - 1) {
            state.index++;
            setVal(activeElement, state.history[state.index]);
          }
        } else { // Undo
          const currentVal = getVal(activeElement);
          if (currentVal !== state.history[state.index]) {
            saveState(activeElement, currentVal);
            state.index--;
          }
          if (state.index > 0) {
            state.index--;
            setVal(activeElement, state.history[state.index]);
          }
        }
      } else if (!isMac && cmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        clearTimeout(typingTimeout);
        const state = getState(activeElement);
        if (state.index < state.history.length - 1) {
          state.index++;
          setVal(activeElement, state.history[state.index]);
        }
      }
    };

    window.addEventListener('focusin', handleFocus);
    window.addEventListener('input', handleInput);
    window.addEventListener('focusout', handleBlur);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('focusin', handleFocus);
      window.removeEventListener('input', handleInput);
      window.removeEventListener('focusout', handleBlur);
      window.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(typingTimeout);
    };
  }, []);

  const syncSettingsFromRemote = async userId => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

      if (!error && data?.settings) {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        setSettings(mergedSettings);
        const key = getSettingsKey(userId);
        localStorage.setItem(key, JSON.stringify(mergedSettings));
      }
    } catch (err) {
      console.warn('Sync failed:', err);
    }
  };



  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  const isMacElectron = isElectron && navigator.platform.toUpperCase().includes('MAC');

  const lang = settings.language || 'en';
  const labels = {
    back: lang === 'nl' ? 'Terug' : 'Back',
    aiAssistant: lang === 'nl' ? 'AI Assistent' : 'AI Assistant',
    settings: lang === 'nl' ? 'Instellingen' : 'Settings',
    homepage: lang === 'nl' ? 'Homepage' : 'Homepage',
    calculators: lang === 'nl' ? 'Berekeningen' : 'Calculations',
    recent: lang === 'nl' ? 'Recent gebruikt' : 'Recently used',
    history: lang === 'nl' ? 'Geschiedenis' : 'History',
    clearAll: lang === 'nl' ? 'Alles wissen' : 'Clear All',
    empty: lang === 'nl' ? 'Leeg' : 'Empty',
    toolFinder: lang === 'nl' ? 'Vind een tool' : 'Find a tool',
    toolFinderTooltip: lang === 'nl' ? 'Vind een tool — Doorzoek alle calculators en tools (⌘K / Ctrl+K)' : 'Find a tool — Search all calculators and tools (⌘K / Ctrl+K)',
    searchTools: lang === 'nl' ? 'Zoek calculators en tools…' : 'Search calculators and tools…',
    searchResults: lang === 'nl' ? 'Zoekresultaten' : 'Search results',
    quickAccess: lang === 'nl' ? 'Snelle toegang' : 'Quick access',
    noToolsFound: lang === 'nl' ? 'Geen tools gevonden' : 'No tools found',
    tryAnotherSearch: lang === 'nl' ? 'Probeer een andere zoekterm.' : 'Try another search term.',
    clearSearch: lang === 'nl' ? 'Zoekopdracht wissen' : 'Clear search',
    navigation: lang === 'nl' ? 'Toolnavigatie' : 'Tool navigation',
    workspaces: lang === 'nl' ? 'Werkruimtes' : 'Workspaces',
    newWorkspace: lang === 'nl' ? 'Nieuwe werkruimte' : 'New workspace',
    close: lang === 'nl' ? 'Sluit' : 'Close',
  };

  const theme = APP_THEMES[settings.appTheme] || APP_THEMES.default;
  const isDark = theme.isDark;
  const accent = getAccentTokens(settings.accentColor);
  const bgStyle = {
    background: theme.bg,
    '--app-accent': accent.color,
    '--primary': accent.hsl,
    '--primary-foreground': accent.foreground,
    '--ring': accent.hsl,
    '--sidebar-ring': accent.hsl,
  };
  const iconStyle = theme.iconStyle;

  const titleColor = theme.textPrimary || (isDark ? 'text-white' : 'text-slate-800');
  const sectionLabelColor = isDark ? 'text-white/40' : 'text-slate-400';
  const cardTextPrimary = theme.textPrimary || (isDark ? 'text-white' : 'text-slate-800');

  const isHome = !active;

  const activateWorkspace = workspaceId => {
    const workspace = workspaceTabs.find(tab => tab.id === workspaceId);
    if (!workspace) return;
    setActiveWorkspaceId(workspaceId);
    setActive(workspace.toolId);
    if (workspace.subtabId) {
      setActiveTab(previous => ({ ...previous, [workspace.toolId]: workspace.subtabId }));
    }
    setHistoryData(null);
    if (isMobile) setSidebarOpen(false);
  };

  const openTool = (toolId, tabId = null) => {
    if (!toolId) {
      activateWorkspace('home');
      return;
    }

    if (toolId === 'notes' && active === 'notes') {
      window.dispatchEvent(new CustomEvent('bibabench:notes-reset'));
    }

    // A tool has one top-level workspace. Its existing internal calculator tabs
    // remain the supported way to create multiple independent instances.
    const existing = workspaceTabs.find(tab => tab.toolId === toolId);
    if (existing) {
      setActiveWorkspaceId(existing.id);
      setActive(toolId);
      if (tabId) {
        setActiveTab(previous => ({ ...previous, [toolId]: tabId }));
        setWorkspaceTabs(previous => previous.map(tab => tab.id === existing.id ? { ...tab, subtabId: tabId } : tab));
      }
      setHistoryData(null);
      if (isMobile) setSidebarOpen(false);
      return;
    }

    const tool = TOOL_BY_ID.get(toolId);
    const workspace = {
      id: `workspace-${toolId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      toolId,
      subtabId: tabId,
      title: `${tool?.name || (toolId === 'ai' ? labels.aiAssistant : 'Workspace')} 1`,
      icon: tool?.icon || (toolId === 'ai' ? RiRobot2Line : undefined),
    };
    setWorkspaceTabs(previous => [...previous, workspace]);
    setActiveWorkspaceId(workspace.id);
    setActive(toolId);
    if (tabId) setActiveTab(previous => ({ ...previous, [toolId]: tabId }));
    setHistoryData(null);
    if (isMobile) setSidebarOpen(false);
  };

  const openRecentContext = item => {
    openTool(item.toolId, item.subtabId);
    const toolKey = item.subtabId ? `${item.toolId}-${item.subtabId}` : item.toolId;
    const instanceExists = item.instanceId && (toolInstances[toolKey] || []).some(instance => instance.id === item.instanceId);
    if (instanceExists) {
      setActiveInstance(previous => ({ ...previous, [toolKey]: item.instanceId }));
    }
  };

  const closeWorkspace = workspaceId => {
    const index = workspaceTabs.findIndex(tab => tab.id === workspaceId);
    if (index < 0 || workspaceTabs[index].toolId === null) return;
    const remaining = workspaceTabs.filter(tab => tab.id !== workspaceId);
    setWorkspaceTabs(remaining);
    if (workspaceId !== activeWorkspaceId) return;
    const nextWorkspace = remaining[Math.max(0, index - 1)] || remaining[0];
    setActiveWorkspaceId(nextWorkspace.id);
    setActive(nextWorkspace.toolId);
    if (nextWorkspace.subtabId) {
      setActiveTab(previous => ({ ...previous, [nextWorkspace.toolId]: nextWorkspace.subtabId }));
    }
    setHistoryData(null);
  };

  const goHome = () => activateWorkspace('home');

  const handleSelectTab = (toolId, tabId) => {
    setActiveTab(prev => ({ ...prev, [toolId]: tabId }));
  };

  const handleRestoreHistory = item => {
    openTool(item.toolId, item.data?.tab || null);

    if (item.data?.tab) {
      handleSelectTab(item.toolId, item.data.tab);
    }

    setHistoryData(item);
  };

  const getComponent = (id, instanceId, subtabId = null) => {
    const subtoolKey = subtabId ? `${id}-${subtabId}` : getSubtoolKey(id);
    const isAct = active === id && activeInstance[subtoolKey] === instanceId;
    const hData = isAct ? historyData : null;
    const calculatorProps = { historyData: hData, isActive: isAct, isDark, theme, settings, user };

    const renderLazy = (ComponentInstance) => (
      <LazyToolErrorBoundary resetKey={`${id}-${instanceId}`}>
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
          </div>
        }>
          {ComponentInstance}
        </Suspense>
      </LazyToolErrorBoundary>
    );
    const requireAccount = (toolName, component) => (
      <AccountRequired toolName={toolName}>{component}</AccountRequired>
    );

    switch (id) {
      case 'digest':
        return <DigestCalculator {...calculatorProps} externalTab={activeTab['digest']} onTabChange={t => handleSelectTab('digest', t)} tabs={renderToolTabs('digest-' + (activeTab['digest'] || 'single'))} />;
      case 'ligation':
        return <LigationCalculator {...calculatorProps} externalTab={activeTab['ligation']} onTabChange={t => handleSelectTab('ligation', t)} tabs={renderToolTabs('ligation-' + (activeTab['ligation'] || 'single'))} />;
      case 'gibson':
        return <GibsonCalculator {...calculatorProps} externalTab={activeTab['gibson']} onTabChange={t => handleSelectTab('gibson', t)} tabs={renderToolTabs('gibson-' + (activeTab['gibson'] || 'single'))} />;
      case 'pcr':
        return <PCRCalculator {...calculatorProps} externalTab={activeTab['pcr']} onTabChange={t => handleSelectTab('pcr', t)} tabs={renderToolTabs('pcr-' + (activeTab['pcr'] || 'mix'))} />;
      case 'dilution':
        return <DilutionCalculator {...calculatorProps} externalTab={activeTab['dilution']} onTabChange={t => handleSelectTab('dilution', t)} tabs={renderToolTabs('dilution-' + (activeTab['dilution'] || 'c1v1'))} />;
      case 'buffer':
        return requireAccount('Buffer & Medium', renderLazy(<BufferMediumTool {...calculatorProps} />));
      case 'plates':
        return requireAccount('Plate Labeler', renderLazy(<UsefulTools {...calculatorProps} initialTool={id} />));
      case 'notes':
        return requireAccount('Notes', renderLazy(<NotesTool {...calculatorProps} />));
      case 'agenda':
        return requireAccount('Agenda', renderLazy(<AgendaTool {...calculatorProps} />));
      case 'protein':
        {
          const proteinSubtab = subtabId || activeTab['protein'] || 'standards';
          const instanceIndex = (toolInstances[`protein-${proteinSubtab}`] || []).findIndex(instance => instance.id === instanceId);
          return <ProteinConcCalculator
            {...calculatorProps}
            externalTab={proteinSubtab}
            onTabChange={t => handleSelectTab('protein', t)}
            tabs={renderToolTabs(`protein-${proteinSubtab}`)}
            linkedAssaySamples={proteinSubtab === 'prep' ? (proteinAssaySamplesByTab[instanceIndex] || []) : undefined}
            assayTabIndex={instanceIndex}
            onAssaySamplesChange={proteinSubtab === 'standards' ? handleProteinAssaySamplesChange : undefined}
          />;
        }
      case 'protocols':
        return requireAccount('Protocols', renderLazy(<ProtocolLibrary {...calculatorProps} externalTab={activeTab['protocols']} onTabChange={t => handleSelectTab('protocols', t)} tabs={renderToolTabs('protocols-' + (activeTab['protocols'] || 'library'))} />));
      case 'ai':
        return renderLazy(<AIAssistant {...calculatorProps} />);
      case 'gel':
        return renderLazy(<GelSimulator {...calculatorProps} externalTab={activeTab['gel']} onTabChange={t => handleSelectTab('gel', t)} tabs={renderToolTabs('gel-' + (activeTab['gel'] || 'dna'))} />);
      case 'plasmid':
        return requireAccount('Sequence Analyzer', renderLazy(<PlasmidAnalyzer {...calculatorProps} tabs={renderToolTabs('plasmid')} />));
      default:
        return null;
    }
  };

  const renderToolTabs = (toolKey) => {
    if (isHome || active === 'ai') return null;
    const currentTabs = toolInstances[toolKey] || [];
    const currentActiveId = activeInstance[toolKey];

    return (
      <div data-recent-ignore="true" className="mb-4 mt-1 min-w-0 border-b border-[#e5e5e5] dark:border-white/10">
        <div className="flex min-w-0 items-end gap-3 overflow-x-auto scrollbar-none">
          <span className={`shrink-0 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${isDark ? 'text-white/35' : 'text-[#8a8a8a]'}`}>
            {lang === 'nl' ? 'Berekeningen' : 'Calculations'}
          </span>
          <div className="flex min-w-0 items-end gap-0.5">
              {currentTabs.map((tab) => {
                const isActive = tab.id === currentActiveId;
                const isEditing = editingTab && editingTab.toolKey === toolKey && editingTab.tabId === tab.id;
                return (
                  <div
                    key={tab.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, toolKey, tab });
                    }}
                    className="group relative flex h-9 shrink-0 items-center"
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTab.name}
                        onChange={(e) => setEditingTab(prev => ({ ...prev, name: e.target.value }))}
                        onBlur={handleCommitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCommitRename();
                          } else if (e.key === 'Escape') {
                            setEditingTab(null);
                          }
                        }}
                        className="mx-2 w-20 border-b border-current/40 bg-transparent px-0.5 text-center text-xs text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveInstance(prev => ({ ...prev, [toolKey]: tab.id }))}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingTab({ toolKey, tabId: tab.id, name: tab.name });
                        }}
                        className={`h-full px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 ${
                          isActive
                            ? isDark ? 'text-white' : 'text-[#0d0d0d]'
                            : isDark ? 'text-white/45 hover:bg-white/5 hover:text-white/80' : 'text-[#6f6f6f] hover:bg-[#f7f7f8] hover:text-[#0d0d0d]'
                        }`}
                      >
                        {tab.name}
                      </button>
                    )}
                    {currentTabs.length > 1 && (
                      <button
                        type="button"
                        aria-label={`${labels.close} ${tab.name}`}
                        onClick={(e) => handleRemoveTab(toolKey, tab.id, e)}
                        className={`mr-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${isDark ? 'text-white/40 hover:bg-white/10 hover:text-white' : 'text-[#8a8a8a] hover:bg-[#ececec] hover:text-[#0d0d0d]'}`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {isActive && <span className={`absolute inset-x-1 bottom-0 h-0.5 ${isDark ? 'bg-white/80' : 'bg-[#0d0d0d]'}`} />}
                  </div>
                );
              })}
              
              <button
                type="button"
                onClick={() => handleAddTab(toolKey)}
                className={`mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${isDark ? 'text-white/45 hover:bg-white/10 hover:text-white' : 'text-[#6f6f6f] hover:bg-[#ececec] hover:text-[#0d0d0d]'}`}
                aria-label={lang === 'nl' ? 'Nieuwe berekening openen' : 'Open new calculation'}
                title={lang === 'nl' ? 'Nieuwe berekening openen' : 'Open new calculation'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
          </div>
        </div>
      </div>
    );
  };

  // Ensure context menu stays inside viewport
  let adjustedX = contextMenu ? contextMenu.x : 0;
  let adjustedY = contextMenu ? contextMenu.y : 0;
  if (contextMenu) {
    const menuWidth = 192;
    const menuHeight = 160;
    if (adjustedX + menuWidth > window.innerWidth) {
      adjustedX = window.innerWidth - menuWidth - 8;
    }
    if (adjustedY + menuHeight > window.innerHeight) {
      adjustedY = window.innerHeight - menuHeight - 8;
    }
  }

  const normalizedHomeSearch = homeSearch.trim().toLowerCase();
  const homeSearchTerms = normalizedHomeSearch.split(/\s+/).filter(Boolean);
  const matchesHomeSearch = tool => {
    if (!homeSearchTerms.length) return true;
    const searchText = [
      tool.name,
      TOOL_DESCRIPTIONS[tool.id],
      ...TOOL_SEARCH_ITEMS.filter(item => item.toolId === tool.id).flatMap(item => [item.label, item.keywords]),
    ].join(' ').toLowerCase();
    return homeSearchTerms.every(term => searchText.includes(term));
  };
  const visibleHomeGroups = [
    { id: 'calculators', label: labels.calculators, tools: CALCULATORS.filter(matchesHomeSearch) },
    ...TOOL_GROUPS.map(group => ({ ...group, tools: group.tools.filter(matchesHomeSearch) })),
  ].filter(group => group.tools.length > 0);
  const visibleRecentContexts = recentContexts.filter(item => item.toolId === 'ai' || TOOL_BY_ID.has(item.toolId));

  return (
    <div className="app-accent h-screen flex flex-col overflow-hidden" style={bgStyle}>
      {/* ── Header ── */}
      <header
        className={`sticky top-0 z-[60] h-11 shrink-0 border-b ${isDark ? 'border-white/10 bg-slate-950' : 'border-[#e5e5e5] bg-[#f7f7f8]'}`}
        style={{ WebkitAppRegion: isElectron ? 'drag' : 'initial' }}
      >
        <div className={`relative flex h-full items-center justify-center ${isMacElectron ? 'pl-28 pr-3' : 'px-3'}`}>
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: isMacElectron ? 76 : 8, WebkitAppRegion: 'no-drag' }}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(previous => !previous)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${isDark ? 'text-white/70 hover:bg-white/10' : 'text-[#5d5d5d] hover:bg-[#e9e9e9]'}`}
              aria-label={sidebarOpen ? (lang === 'nl' ? 'Zijbalk sluiten' : 'Close sidebar') : (lang === 'nl' ? 'Zijbalk openen' : 'Open sidebar')}
              title={sidebarOpen ? (lang === 'nl' ? 'Zijbalk sluiten' : 'Close sidebar') : (lang === 'nl' ? 'Zijbalk openen' : 'Open sidebar')}
            >
              <PanelLeft className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
          <span className={`max-w-[55vw] truncate text-xs font-semibold ${isDark ? 'text-white/70' : 'text-[#454545]'}`}>
            {isHome ? 'BiBaBenchBuddy' : (TOOL_BY_ID.get(active)?.name || labels.aiAssistant)}
          </span>
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
            {!isOnline && (
              <div
                className={`mr-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
                title={lang === 'nl' ? 'Je bent offline — synchronisatie is gepauzeerd' : 'You are offline — sync is paused'}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[#6f6f6f] hover:bg-[#e9e9e9] hover:text-[#0d0d0d]'}`}
              title={labels.settings}
              aria-label={labels.settings}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
        {(isMobile ? sidebarOpen : true) && (
          <>
            {isMobile && (
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <Sidebar
              active={active}
              onSelect={(id) => {
                if (id) openTool(id);
                else goHome();
              }}
              onSelectTab={handleSelectTab}
              activeTab={activeTab}
              isDark={isDark}
              iconStyle={iconStyle}
              iconTextColor={theme.iconTextColor}
              onRestoreHistory={(item) => {
                handleRestoreHistory(item);
              }}
              onOpenAI={() => openTool('ai')}
              isMobile={isMobile}
              collapsed={!isMobile && !sidebarOpen}
              labels={labels}
              lang={lang}
              width={sidebarWidth}
              onResizeStart={handleSidebarResizeStart}
            />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <WorkspaceTabs
            tabs={workspaceTabs}
            activeId={activeWorkspaceId}
            onSelect={activateWorkspace}
            onClose={closeWorkspace}
            onNew={() => {
              setShowToolFinder(true);
            }}
            isDark={isDark}
            labels={labels}
          />

        <main 
          onClick={() => { if (isMobile && sidebarOpen) setSidebarOpen(false); }}
          onInputCapture={handleToolActivityCapture}
          onChangeCapture={handleToolActivityCapture}
          onClickCapture={handleToolActivityCapture}
          className={`compact-app flex-1 ${active === 'plasmid' ? 'px-1 sm:px-2.5 lg:px-3.5 pt-1 pb-1' : isHome ? 'px-3 sm:px-5 lg:px-7 pt-5 pb-0' : 'tool-workspace px-2 sm:px-4 lg:px-6 pt-2 pb-6'} overflow-y-auto overflow-x-hidden relative flex flex-col cursor-default`}
        >

          {/* ── HOME ── */}
          {isHome && (
            <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col">
              <div className="mb-6 flex flex-col gap-4 border-b border-[#e5e5e5] pb-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <h2 className={`text-xl font-bold tracking-tight sm:text-2xl ${titleColor}`}>
                    Lab tools that actually save time
                  </h2>
                  <div className="mt-1 max-w-2xl"><ScienceJoke isDark={isDark} /></div>
                </div>
                <div className="w-full lg:w-auto">
                  <label className={`flex h-9 min-w-0 items-center gap-2 rounded-lg border px-3 transition-[border-color,box-shadow] focus-within:ring-2 focus-within:ring-slate-400/40 sm:w-80 ${
                    isDark ? 'border-white/10 bg-white/5 text-white' : 'border-[#d9d9d9] bg-white text-[#0d0d0d]'
                  }`}>
                    <Search className={`h-4 w-4 shrink-0 ${isDark ? 'text-white/40' : 'text-slate-400'}`} />
                    <span className="sr-only">{labels.searchTools}</span>
                    <input
                      type="text"
                      inputMode="search"
                      value={homeSearch}
                      onChange={event => setHomeSearch(event.target.value)}
                      placeholder={labels.searchTools}
                      name="tool-search"
                      autoComplete="off"
                      className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none shadow-none ring-0"
                    />
                    {homeSearch && (
                      <button type="button" onClick={() => setHomeSearch('')} className="rounded p-0.5 opacity-50 hover:opacity-100" aria-label={labels.clearSearch}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-5">
                {!homeSearchTerms.length && visibleRecentContexts.length > 0 && (
                  <section aria-labelledby="home-recent-heading">
                    <div className="mb-2.5 flex items-center gap-2">
                      <Clock className={`h-3.5 w-3.5 ${isDark ? 'text-white/45' : 'text-[#737373]'}`} aria-hidden="true" />
                      <h3 id="home-recent-heading" className={`text-[11px] font-semibold tracking-wide ${isDark ? 'text-white/55' : 'text-[#5f5f5f]'}`}>
                        {labels.recent}
                      </h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(190px,240px))]">
                      {visibleRecentContexts.map(item => {
                        const tool = TOOL_BY_ID.get(item.toolId);
                        const Icon = tool?.icon || RiRobot2Line;
                        const subtool = TOOL_TABS[item.toolId]?.find(tab => tab.id === item.subtabId);
                        const toolKey = item.subtabId ? `${item.toolId}-${item.subtabId}` : item.toolId;
                        const instance = (toolInstances[toolKey] || []).find(tab => tab.id === item.instanceId);
                        const detail = [subtool?.label, instance?.name || item.instanceName].filter(Boolean).join(' · ')
                          || (lang === 'nl' ? 'Werkruimte' : 'Workspace');

                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => openRecentContext(item)}
                            className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)] ${
                              isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-[#e5e5e5] bg-white hover:border-[#cccccc] hover:bg-[#fafafa]'
                            }`}
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tool?.direction || 'bg-gradient-to-br'} ${tool?.gradient || 'from-slate-600 to-slate-800'}`}>
                              <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className={`block truncate text-xs font-semibold ${cardTextPrimary}`}>{tool?.name || labels.aiAssistant}</span>
                              <span className={`block truncate text-[11px] ${isDark ? 'text-white/40' : 'text-[#777]'}`}>{detail}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {visibleHomeGroups.map(group => (
                  <section key={group.id} aria-labelledby={`home-group-${group.id}`}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <h3 id={`home-group-${group.id}`} className={`text-[11px] font-bold uppercase tracking-[0.14em] ${sectionLabelColor}`}>{group.label}</h3>
                      <span className={`text-[10px] ${isDark ? 'text-white/25' : 'text-slate-300'}`}>{group.tools.length}</span>
                    </div>
                    <div className="grid grid-cols-2 justify-start gap-2.5 sm:grid-cols-[repeat(3,minmax(0,180px))] md:grid-cols-[repeat(4,minmax(0,180px))] lg:grid-cols-[repeat(5,minmax(0,180px))] xl:grid-cols-[repeat(6,minmax(0,180px))]">
                      {group.tools.map(tool => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => openTool(tool.id)}
                          title={`${tool.name} — ${TOOL_DESCRIPTIONS[tool.id]}`}
                          className={`group flex aspect-[4/3] min-w-0 flex-col items-center justify-center gap-3 rounded-xl border p-3 text-center transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                            isDark ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10' : 'border-[#e5e5e5] bg-[#f7f7f8] hover:border-[#d2d2d2] hover:bg-white hover:shadow-sm'
                          }`}
                        >
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyle ? '' : `${tool.direction || 'bg-gradient-to-br'} ${tool.gradient}`}`} style={iconStyle || {}}>
                            <tool.icon className={`h-[18px] w-[18px] ${theme?.iconTextColor || 'text-white'}`} aria-hidden="true" />
                          </span>
                          <span className={`min-w-0 text-sm font-semibold leading-tight ${cardTextPrimary}`}>{tool.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
                {visibleHomeGroups.length === 0 && (
                  <div className={`rounded-xl border border-dashed px-4 py-10 text-center ${isDark ? 'border-white/15 text-white/45' : 'border-slate-300 text-slate-500'}`}>
                    <Search className="mx-auto mb-2 h-5 w-5 opacity-50" />
                    <p className="text-sm font-medium">{labels.noToolsFound}</p>
                    <button type="button" onClick={() => setHomeSearch('')} className="accent-text mt-2 text-xs hover:underline">{labels.clearSearch}</button>
                  </div>
                )}
              </div>

              {/* Footer moved to homepage body */}
              <div className={`pt-8 pb-3 text-center text-[11px] flex flex-col items-center gap-2 transition-colors ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                <p>
                  {settings.language === 'nl'
                    ? 'Controleer altijd berekeningen voor gebruik in experimenten'
                    : 'Always verify calculations before use in experiments'}
                </p>

                <div>
                  <a
                    href="https://www.buymeacoffee.com/daphnewoodpecker"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      // Ensure external links open in system browser in Electron/local-file mode
                      if (window.location.protocol === 'file:' || navigator.userAgent.toLowerCase().includes('electron')) {
                        e.preventDefault();
                        window.open("https://www.buymeacoffee.com/daphnewoodpecker", "_blank");
                      }
                    }}
                    className="inline-block transition-transform hover:scale-105 active:scale-95 shadow-lg rounded-xl overflow-hidden"
                  >
                    <img
                      src="https://img.buymeacoffee.com/button-api/?text=Buy me a cookie&emoji=🍪&slug=daphnewoodpecker&button_colour=fda8ff&font_colour=000000&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"
                      alt="Buy me a cookie"
                      className="h-6"
                    />
                  </a>
                </div>
              </div>

            </div>
          )}

          {ALL_IDS.map(id => {
            const isVisited = visitedIds.has(id);
            if (!isVisited) return null;

            return (
              <div
                key={id}
                style={{ display: active === id ? 'block' : 'none' }}
                className="transition-all duration-300 w-full"
              >
                {TOOL_TABS[id] ? (
                  TOOL_TABS[id].map(subtab => {
                    const subtoolKey = `${id}-${subtab.id}`;
                    const instances = toolInstances[subtoolKey] || [];
                    const activeInst = activeInstance[subtoolKey];
                    const isSubtabActive = activeTab[id] === subtab.id || (!activeTab[id] && subtab.id === TOOL_TABS[id][0].id);

                    return (
                      <div
                        key={subtoolKey}
                        style={{ display: isSubtabActive ? 'block' : 'none' }}
                      >
                        {instances.map(inst => (
                          <div
                            key={inst.id}
                            style={{ display: activeInst === inst.id ? 'block' : 'none' }}
                          >
                            {getComponent(id, inst.id, subtab.id)}
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  (toolInstances[id] || []).map(inst => (
                    <div
                      key={inst.id}
                      style={{ display: activeInstance[id] === inst.id ? 'block' : 'none' }}
                    >
                      {getComponent(id, inst.id)}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </main>
      </div>
      </div>



      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <ToolFinder
        open={showToolFinder}
        onClose={() => {
          setShowToolFinder(false);
        }}
        onSelect={item => {
          openTool(item.toolId, item.tabId);
        }}
        isDark={isDark}
        isMobile={isMobile}
        labels={labels}
      />

      {!isLoadingAuth && !user && !isPasswordRecovery && (
        <AuthWelcomeModal
          open={showAuthWelcome}
          onClose={dismissAuthWelcome}
          initialMode={authWelcomeMode}
        />
      )}

      {contextMenu && (
        <div
          style={{ top: adjustedY, left: adjustedX }}
          className="fixed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 w-48 text-xs font-medium text-slate-700 dark:text-slate-200 z-[100] backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setEditingTab({ toolKey: contextMenu.toolKey, tabId: contextMenu.tab.id, name: contextMenu.tab.name });
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span>Naam wijzigen</span>
          </button>
          <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
          <div className="px-3 py-1 text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-slate-400" />
            <span>Kleur wijzigen</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 px-3 py-2">
            {TAB_COLORS.map((colorOption) => (
              <button
                key={colorOption.id}
                onClick={() => {
                  handleSetTabColor(contextMenu.toolKey, contextMenu.tab.id, colorOption.id);
                  setContextMenu(null);
                }}
                className={`w-5 h-5 rounded-full ${colorOption.previewBg} border border-slate-200/50 dark:border-white/10 hover:scale-110 active:scale-95 transition-transform`}
                title={colorOption.name}
              />
            ))}
          </div>
          {contextMenu.tab.color && (
            <button
              onClick={() => {
                handleSetTabColor(contextMenu.toolKey, contextMenu.tab.id, null);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Herstel standaard kleur
            </button>
          )}
        </div>
      )}
    </div>
  );
}
