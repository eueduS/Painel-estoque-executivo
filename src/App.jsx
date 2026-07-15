import { useState, useEffect, useMemo } from "react";
import mudeLogo from "./assets/mude-logo.jpeg";
import {
  Package,
  MapPin,
  Sun,
  Moon,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  TrendingUp,
  LayoutGrid,
  ArrowLeftRight,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

/* =========================================================================
   LIVE SOURCE CONFIG — Google Sheets via gviz (JSONP, no backend needed)
   ========================================================================= */
const SHEET_ID = "1oe6_aCLLFaGZFW351kiBur5Y79KCvv9Rt40_frl6CXI";
const GID_ESTOQUE = "1020351573";
const GID_MOV = "1020503030";
const REFRESH_MS = 60000;

let gvizCounter = 0;
function fetchGvizTab(gid) {
  return new Promise((resolve, reject) => {
    const cbName = `__gvizCb_${gid}_${gvizCounter++}`;
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Tempo esgotado ao buscar a planilha"));
    }, 15000);
    function cleanup() {
      clearTimeout(timeoutId);
      try {
        delete window[cbName];
      } catch (e) {
        window[cbName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    window[cbName] = (json) => {
      cleanup();
      try {
        if (!json || json.status === "error") {
          reject(new Error("Planilha retornou erro"));
          return;
        }
        const cols = (json.table.cols || []).map((c) => (c.label || c.id || "").toString().trim());
        const rows = (json.table.rows || []).map((r) =>
          (r.c || []).map((cell) => {
            if (!cell) return "";
            if (cell.f !== undefined && cell.f !== null) return cell.f;
            return cell.v !== undefined && cell.v !== null ? cell.v : "";
          })
        );
        resolve({ cols, rows });
      } catch (e) {
        reject(e);
      }
    };
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${gid}&tqx=out:json;responseHandler:${cbName}&t=${Date.now()}`;
    const script = document.createElement("script");
    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error("Falha ao carregar a planilha"));
    };
    document.body.appendChild(script);
  });
}

function findCol(cols, needle) {
  return cols.findIndex((c) => c.toLowerCase().includes(needle.toLowerCase()));
}

function parseEstoqueRows(cols, rows) {
  const idx = {
    praca: findCol(cols, "praça"),
    item: findCol(cols, "item em estoque"),
    critico: findCol(cols, "item crítico"),
    min: findCol(cols, "mínima"),
    atual: findCol(cols, "atual"),
    falta: findCol(cols, "falta"),
    prioridade: findCol(cols, "prioridade"),
    comprar: findCol(cols, "a comprar"),
  };
  return rows
    .map((r) => ({
      praca: (r[idx.praca] || "").toString().trim().toUpperCase(),
      item: (r[idx.item] || "").toString().trim(),
      critico: (r[idx.critico] || "").toString().trim().toLowerCase() === "sim",
      min: Number(r[idx.min]) || 0,
      atual: r[idx.atual] === "" ? null : Number(r[idx.atual]) || 0,
      falta: Number(r[idx.falta]) || 0,
      prioridade: Number(r[idx.prioridade]) || 0,
      comprar: Number(r[idx.comprar]) || 0,
    }))
    .filter((r) => r.praca && r.item);
}

/* =========================================================================
   FALLBACK DATA — usado até a 1a sincronização, ou se a planilha ficar fora
   ========================================================================= */
const estoqueDataFallback = [
  { praca: "RIO", item: "CPU", critico: true, min: 15, atual: 11, falta: -4, comprar: 4, prioridade: 3 },
  { praca: "RIO", item: "Cabo HDMI", critico: false, min: 15, atual: 20, falta: 5, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Cabo HDMI-DVI", critico: true, min: 5, atual: 9, falta: 4, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Cabo de Rede", critico: false, min: 15, atual: 37, falta: 22, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Cooler G", critico: false, min: 40, atual: 20, falta: -20, comprar: 20, prioridade: 5 },
  { praca: "RIO", item: "Cooler P", critico: false, min: 40, atual: 251, falta: 211, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Fita 3M", critico: false, min: 10, atual: 9, falta: -1, comprar: 1, prioridade: 1 },
  { praca: "RIO", item: "Fonte LED NHV3", critico: true, min: 5, atual: 8, falta: 3, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Fonte LED SV3", critico: true, min: 5, atual: 42, falta: 37, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Fonte LED VLC 3.9", critico: true, min: 5, atual: 26, falta: 21, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Fonte PC", critico: false, min: 15, atual: 17, falta: 2, comprar: 0, prioridade: 0 },
  { praca: "RIO", item: "Sender", critico: false, min: 10, atual: 1, falta: -9, comprar: 9, prioridade: 9 },
  { praca: "FORTALEZA", item: "CPU", critico: true, min: 5, atual: 3, falta: -2, comprar: 2, prioridade: 4 },
  { praca: "FORTALEZA", item: "Cabo HDMI-DVI", critico: true, min: 5, atual: 4, falta: -1, comprar: 1, prioridade: 2 },
  { praca: "FORTALEZA", item: "Cabo de Rede", critico: false, min: 5, atual: 4, falta: -1, comprar: 1, prioridade: 2 },
  { praca: "FORTALEZA", item: "Cooler G", critico: false, min: 10, atual: 5, falta: -5, comprar: 5, prioridade: 5 },
  { praca: "FORTALEZA", item: "Cooler P", critico: false, min: 10, atual: 0, falta: -10, comprar: 10, prioridade: 10 },
  { praca: "FORTALEZA", item: "Fita 3M", critico: false, min: 10, atual: 12, falta: 2, comprar: 0, prioridade: 0 },
  { praca: "FORTALEZA", item: "Fonte LED NHV3", critico: true, min: 5, atual: 5, falta: 0, comprar: 0, prioridade: 0 },
  { praca: "FORTALEZA", item: "Fonte PC", critico: false, min: 5, atual: 3, falta: -2, comprar: 2, prioridade: 4 },
  { praca: "FORTALEZA", item: "Hub Card NHV3", critico: false, min: 2, atual: 2, falta: 0, comprar: 0, prioridade: 0 },
  { praca: "FORTALEZA", item: "Sender", critico: false, min: 5, atual: 1, falta: -4, comprar: 4, prioridade: 8 },
  { praca: "RECIFE", item: "CPU", critico: true, min: 7, atual: 1, falta: -6, comprar: 6, prioridade: 9 },
  { praca: "RECIFE", item: "Cabo HDMI-DVI", critico: true, min: 5, atual: 1, falta: -4, comprar: 4, prioridade: 8 },
  { praca: "RECIFE", item: "Cabo de Rede", critico: false, min: 5, atual: 10, falta: 5, comprar: 0, prioridade: 0 },
  { praca: "RECIFE", item: "Cooler G", critico: false, min: 10, atual: 3, falta: -7, comprar: 7, prioridade: 7 },
  { praca: "RECIFE", item: "Cooler P", critico: false, min: 10, atual: 30, falta: 20, comprar: 0, prioridade: 0 },
  { praca: "RECIFE", item: "Fita 3M", critico: false, min: 10, atual: 22, falta: 12, comprar: 0, prioridade: 0 },
  { praca: "RECIFE", item: "Fonte LED SV3", critico: true, min: 5, atual: 7, falta: 2, comprar: 0, prioridade: 0 },
  { praca: "RECIFE", item: "Fonte LED VLC 3.9", critico: true, min: 5, atual: 10, falta: 5, comprar: 0, prioridade: 0 },
  { praca: "RECIFE", item: "Fonte PC", critico: false, min: 7, atual: 1, falta: -6, comprar: 6, prioridade: 9 },
  { praca: "RECIFE", item: "Modem Plug-in (ZTE)", critico: false, min: 5, atual: 5, falta: 0, comprar: 0, prioridade: 0 },
  { praca: "RECIFE", item: "Sender", critico: false, min: 7, atual: 5, falta: -2, comprar: 2, prioridade: 3 },
  { praca: "FLORIANÓPOLIS", item: "CPU", critico: true, min: 5, atual: 3, falta: -2, comprar: 2, prioridade: 4 },
  { praca: "FLORIANÓPOLIS", item: "Cabo HDMI-DVI", critico: false, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Cabo de Rede", critico: false, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Cooler G", critico: false, min: 10, atual: 0, falta: -10, comprar: 10, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Cooler P", critico: false, min: 10, atual: 0, falta: -10, comprar: 10, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Fita 3M", critico: false, min: 10, atual: 0, falta: -10, comprar: 10, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Fonte LED VLC 3.9", critico: true, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Fonte PC", critico: false, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
  { praca: "FLORIANÓPOLIS", item: "Sender", critico: false, min: 7, atual: 0, falta: -7, comprar: 7, prioridade: 10 },
  { praca: "BRASILIA", item: "CPU", critico: true, min: 5, atual: 2, falta: -3, comprar: 3, prioridade: 6 },
  { praca: "BRASILIA", item: "Cabo HDMI-DVI", critico: true, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
  { praca: "BRASILIA", item: "Cabo de Rede", critico: false, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
  { praca: "BRASILIA", item: "Cooler G", critico: false, min: 10, atual: 45, falta: 35, comprar: 0, prioridade: 0 },
  { praca: "BRASILIA", item: "Cooler P", critico: false, min: 10, atual: 16, falta: 6, comprar: 0, prioridade: 0 },
  { praca: "BRASILIA", item: "Fita 3M", critico: false, min: 7, atual: 3, falta: -4, comprar: 4, prioridade: 6 },
  { praca: "BRASILIA", item: "Fonte LED NHV3", critico: true, min: 5, atual: 1, falta: -4, comprar: 4, prioridade: 8 },
  { praca: "BRASILIA", item: "Fonte PC", critico: false, min: 5, atual: 2, falta: -3, comprar: 3, prioridade: 6 },
  { praca: "BRASILIA", item: "Sender", critico: false, min: 5, atual: 0, falta: -5, comprar: 5, prioridade: 10 },
];

const PRACAS = ["RIO", "FORTALEZA", "RECIFE", "FLORIANÓPOLIS", "BRASILIA"];
const PRACA_COLORS = {
  RIO: "#6366F1",
  FORTALEZA: "#0EA5E9",
  RECIFE: "#8B5CF6",
  "FLORIANÓPOLIS": "#06B6D4",
  BRASILIA: "#3B82F6",
};
const COLOR_ROSE = "#F43F5E";
const COLOR_AMBER = "#F59E0B";

/* =========================================================================
   THEME
   ========================================================================= */
function useTheme() {
  const [dark, setDark] = useState(true);
  const t = dark
    ? {
        dark: true,
        bg: "bg-slate-950",
        bgAlt: "bg-zinc-900/60",
        border: "border-zinc-800",
        text: "text-slate-100",
        textDim: "text-slate-400",
        textFaint: "text-slate-500",
        cardHover: "hover:bg-zinc-900",
        inputBg: "bg-zinc-800",
        inputBorder: "border-zinc-700",
        rowHover: "hover:bg-zinc-800/40",
        theadBg: "bg-zinc-900",
        track: "bg-zinc-800",
      }
    : {
        dark: false,
        bg: "bg-slate-50",
        bgAlt: "bg-white",
        border: "border-slate-200",
        text: "text-slate-900",
        textDim: "text-slate-600",
        textFaint: "text-slate-400",
        cardHover: "hover:bg-slate-100",
        inputBg: "bg-white",
        inputBorder: "border-slate-300",
        rowHover: "hover:bg-slate-100",
        theadBg: "bg-slate-100",
        track: "bg-slate-200",
      };
  return { dark, setDark, t };
}

/* =========================================================================
   SMALL COMPONENTS
   ========================================================================= */
function Tooltip({ text }) {
  return (
    <span className="relative inline-flex group align-middle">
      <HelpCircle size={13} className="text-slate-500 cursor-help" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 rounded-lg bg-zinc-800 text-slate-100 text-[11px] leading-relaxed px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-zinc-700">
        {text}
      </span>
    </span>
  );
}

function ProgressRing({ pct, color, trackColor, size = 72, strokeWidth = 7 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fontWeight="700"
        fill={color}
      >
        {pct}%
      </text>
    </svg>
  );
}

function BigFractionCard({ title, tooltip, falta, total, color, colorClass, active, onClick, t }) {
  const pct = total > 0 ? Math.round((falta / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className={`text-left w-full rounded-2xl border p-6 sm:p-7 flex items-center justify-between gap-6 transition-all ${t.bgAlt} ${
        active ? "border-current" : t.border
      } ${t.cardHover}`}
      style={active ? { borderColor: color } : {}}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${t.textDim}`}>{title}</span>
          <Tooltip text={tooltip} />
        </div>
        <div className={`font-display font-bold ${colorClass} leading-none`}>
          <span className="text-5xl sm:text-6xl">{falta}</span>
          <span className={`text-2xl sm:text-3xl ${t.textFaint}`}> / {total}</span>
        </div>
        <p className={`text-xs mt-3 ${t.textFaint}`}>{pct}% dos itens {title.toLowerCase()} precisam de atenção imediata</p>
        <span className={`inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide ${active ? "" : "opacity-0"}`} style={{ color }}>
          Filtro ativo na tabela ↓
        </span>
      </div>
      <ProgressRing pct={pct} color={color} trackColor={t.dark ? "#27272a" : "#e2e8f0"} />
    </button>
  );
}

function KpiCard({ icon, label, value, note, t }) {
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-5 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${t.textDim}`}>{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0`}>{icon}</div>
      </div>
      <div className={`font-display text-3xl font-bold ${t.text}`}>{value}</div>
      {note && <p className={`text-xs leading-relaxed ${t.textFaint}`}>{note}</p>}
    </div>
  );
}

function LastUpdatedBadge({ lastUpdated, syncing, syncError, onRefresh, t }) {
  function formatHMS(d) {
    if (!d) return "--:--:--";
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  const dotColor = syncError ? "bg-amber-400" : "bg-emerald-400";
  return (
    <button
      onClick={onRefresh}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${t.border} ${t.bgAlt} text-xs ${t.textDim} ${t.cardHover} transition-colors`}
      title={syncError ? "Não foi possível sincronizar — mostrando últimos dados conhecidos. Clique para tentar de novo." : "Clique para sincronizar agora"}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor} ${syncing ? "pulse-dot" : ""}`} />
      <span className="font-mono">{formatHMS(lastUpdated)}</span>
      <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
    </button>
  );
}

function PracaHealthRow({ praca, total, faltando, sharedMax, color, t }) {
  const trackPct = sharedMax > 0 ? (total / sharedMax) * 100 : 0;
  const filledPct = sharedMax > 0 ? (faltando / sharedMax) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-24 sm:w-28 shrink-0 font-semibold tracking-wide" style={{ color }}>
        {praca}
      </span>
      <div className="flex-1 relative h-6">
        <div className={`absolute inset-y-0 left-0 rounded-md ${t.track}`} style={{ width: `${trackPct}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-md bg-rose-500/80 transition-all duration-500" style={{ width: `${filledPct}%` }} />
      </div>
      <span className={`font-mono text-xs w-16 text-right shrink-0 ${t.textDim}`}>
        {faltando}/{total}
      </span>
    </div>
  );
}

function CriticoChipRow({ value, onChange, counts, t, onTodos }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => (onTodos ? onTodos() : onChange(null))}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          value === null ? `${t.text} border-current` : `${t.textFaint} ${t.border} ${t.cardHover}`
        }`}
      >
        Todos ({counts.sim + counts.nao})
      </button>
      <button
        onClick={() => onChange(value === true ? null : true)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${t.cardHover}`}
        style={value === true ? { color: COLOR_ROSE, borderColor: COLOR_ROSE, backgroundColor: `${COLOR_ROSE}1A` } : { color: t.dark ? "#71717a" : "#94a3b8", borderColor: t.dark ? "#3f3f46" : "#e2e8f0" }}
      >
        Críticos ({counts.sim})
      </button>
      <button
        onClick={() => onChange(value === false ? null : false)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${t.cardHover}`}
        style={value === false ? { color: COLOR_AMBER, borderColor: COLOR_AMBER, backgroundColor: `${COLOR_AMBER}1A` } : { color: t.dark ? "#71717a" : "#94a3b8", borderColor: t.dark ? "#3f3f46" : "#e2e8f0" }}
      >
        Não Críticos ({counts.nao})
      </button>
    </div>
  );
}

function TabBar({ tabs, active, onChange, t }) {
  return (
    <div className={`flex flex-wrap gap-2 border-b ${t.border} mb-6 pb-0`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            active === tab.id ? `border-indigo-500 ${t.text}` : `border-transparent ${t.textFaint} ${t.cardHover}`
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* =========================================================================
   APP
   ========================================================================= */
export default function App() {
  const { dark, setDark, t } = useTheme();

  const [estoqueRows, setEstoqueRows] = useState(estoqueDataFallback);
  const [movCols, setMovCols] = useState([]);
  const [movRows, setMovRows] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [syncErrorDetail, setSyncErrorDetail] = useState("");

  const [activeTab, setActiveTab] = useState("resumo");
  const [expandedPraca, setExpandedPraca] = useState(null);
  const [somenteEmFalta, setSomenteEmFalta] = useState(false);
  const [pracaFilter, setPracaFilter] = useState(null);
  const [criticoFilter, setCriticoFilter] = useState(null);
  const [pracaFilterFalt, setPracaFilterFalt] = useState(null);
  const [criticoFilterFalt, setCriticoFilterFalt] = useState(null);
  const [searchFalt, setSearchFalt] = useState("");
  const [pageFalt, setPageFalt] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 8;

  async function refreshData() {
    setSyncing(true);
    try {
      const [est, mov] = await Promise.all([fetchGvizTab(GID_ESTOQUE), fetchGvizTab(GID_MOV)]);
      const parsed = parseEstoqueRows(est.cols, est.rows);
      if (parsed.length > 0) setEstoqueRows(parsed);
      setMovCols(mov.cols);
      setMovRows(mov.rows.filter((r) => r.some((v) => v !== "")));
      setSyncError(false);
      setSyncErrorDetail("");
    } catch (e) {
      setSyncError(true);
      setSyncErrorDetail(e && e.message ? e.message : String(e));
    } finally {
      setLastUpdated(new Date());
      setSyncing(false);
    }
  }

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const kpis = useMemo(() => {
    const criticos = estoqueRows.filter((d) => d.critico);
    const naoCriticos = estoqueRows.filter((d) => !d.critico);
    return {
      criticosFalta: criticos.filter((d) => d.falta < 0).length,
      criticosTotal: criticos.length,
      naoCriticosFalta: naoCriticos.filter((d) => d.falta < 0).length,
      naoCriticosTotal: naoCriticos.length,
      totalComprar: estoqueRows.reduce((s, d) => s + d.comprar, 0),
      totalCadastrado: estoqueRows.length,
    };
  }, [estoqueRows]);

  const saudeByPraca = useMemo(
    () =>
      PRACAS.map((p) => {
        const itens = estoqueRows.filter((d) => d.praca === p);
        const faltando = itens.filter((d) => d.falta < 0).length;
        return { praca: p, total: itens.length, faltando };
      }),
    [estoqueRows]
  );
  const maxItensPraca = Math.max(...saudeByPraca.map((x) => x.total), 1);

  const faltantesPorPracaCriticidade = useMemo(
    () =>
      PRACAS.filter((p) => !pracaFilterFalt || p === pracaFilterFalt).map((p) => {
        const itens = estoqueRows.filter((d) => d.praca === p && d.falta < 0);
        return {
          praca: p,
          "Críticos em Falta": itens.filter((d) => d.critico).length,
          "Não Críticos em Falta": itens.filter((d) => !d.critico).length,
        };
      }),
    [estoqueRows, pracaFilterFalt]
  );

  const comprasPorPraca = useMemo(
    () =>
      PRACAS.map((p) => {
        const itens = estoqueRows.filter((d) => d.praca === p);
        return { praca: p, qtd: itens.reduce((s, d) => s + d.comprar, 0), itensComFalta: itens.filter((d) => d.comprar > 0).length };
      }),
    [estoqueRows]
  );

  const itensParaComprarPorPraca = useMemo(() => {
    const map = {};
    PRACAS.forEach((p) => {
      map[p] = estoqueRows
        .filter((d) => d.praca === p && d.comprar > 0)
        .sort((a, b) => b.comprar - a.comprar);
    });
    return map;
  }, [estoqueRows]);

  function togglePracaExpand(praca) {
    setExpandedPraca((prev) => (prev === praca ? null : praca));
  }

  const topCompras = useMemo(() => {
    const map = {};
    estoqueRows.forEach((d) => {
      map[d.item] = (map[d.item] || 0) + d.comprar;
    });
    return Object.entries(map)
      .map(([item, qtd]) => ({ item, qtd }))
      .filter((x) => x.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [estoqueRows]);

  const filteredRows = useMemo(() => {
    let rows = estoqueRows;
    if (pracaFilter) rows = rows.filter((d) => d.praca === pracaFilter);
    if (criticoFilter !== null) rows = rows.filter((d) => d.critico === criticoFilter);
    if (somenteEmFalta) rows = rows.filter((d) => d.falta < 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((d) => d.item.toLowerCase().includes(q) || d.praca.toLowerCase().includes(q));
    }
    return rows;
  }, [estoqueRows, pracaFilter, criticoFilter, somenteEmFalta, search]);

  const itensPorPraca = useMemo(() => {
    const map = {};
    PRACAS.forEach((p) => {
      map[p] = estoqueRows.filter((d) => d.praca === p).length;
    });
    return map;
  }, [estoqueRows]);

  const criticosCount = useMemo(
    () => ({ sim: estoqueRows.filter((d) => d.critico).length, nao: estoqueRows.filter((d) => !d.critico).length }),
    [estoqueRows]
  );

  const faltantesPorPraca = useMemo(() => {
    const map = {};
    PRACAS.forEach((p) => {
      map[p] = estoqueRows.filter((d) => d.praca === p && d.falta < 0).length;
    });
    return map;
  }, [estoqueRows]);

  const criticosFaltantesCount = useMemo(() => {
    const faltando = estoqueRows.filter((d) => d.falta < 0);
    return { sim: faltando.filter((d) => d.critico).length, nao: faltando.filter((d) => !d.critico).length };
  }, [estoqueRows]);

  const faltantesRows = useMemo(() => {
    let rows = estoqueRows.filter((d) => d.falta < 0);
    if (pracaFilterFalt) rows = rows.filter((d) => d.praca === pracaFilterFalt);
    if (criticoFilterFalt !== null) rows = rows.filter((d) => d.critico === criticoFilterFalt);
    if (searchFalt.trim()) {
      const q = searchFalt.trim().toLowerCase();
      rows = rows.filter((d) => d.item.toLowerCase().includes(q) || d.praca.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => a.falta - b.falta);
  }, [estoqueRows, pracaFilterFalt, criticoFilterFalt, searchFalt]);

  useEffect(() => {
    setPageFalt(0);
  }, [pracaFilterFalt, criticoFilterFalt, searchFalt]);

  const totalPagesFalt = Math.max(1, Math.ceil(faltantesRows.length / pageSize));
  const currentPageFalt = Math.min(pageFalt, totalPagesFalt - 1);
  const pagedRowsFalt = faltantesRows.slice(currentPageFalt * pageSize, currentPageFalt * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [somenteEmFalta, pracaFilter, criticoFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = filteredRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  function toggleQuickFilter(criticoValue) {
    const alreadyActive = criticoFilter === criticoValue && somenteEmFalta;
    if (alreadyActive) {
      setCriticoFilter(null);
      setSomenteEmFalta(false);
    } else {
      setCriticoFilter(criticoValue);
      setSomenteEmFalta(true);
    }
    setActiveTab("estoque");
  }

  const tabs = [
    { id: "resumo", label: "Resumo", icon: <LayoutGrid size={16} /> },
    { id: "faltantes", label: "Itens Faltantes", icon: <AlertTriangle size={16} /> },
    { id: "compras", label: "Compras", icon: <TrendingUp size={16} /> },
    { id: "estoque", label: "Estoque Completo", icon: <Package size={16} /> },
    { id: "movimentacoes", label: "Movimentações", icon: <ArrowLeftRight size={16} /> },
  ];

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start sm:items-center justify-between mb-6 flex-col sm:flex-row gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src={mudeLogo} alt="mude" className="h-6 sm:h-7 w-auto rounded" />
              <span className={`font-display text-xs font-semibold uppercase tracking-[0.2em] ${t.textFaint}`}>· Operações</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Painel Executivo de Estoque</h1>
            <p className={`text-sm mt-1 ${t.textDim}`}>Dados ao vivo, direto da planilha de controle das 5 praças</p>
          </div>
          <div className="flex items-center gap-2">
            <LastUpdatedBadge lastUpdated={lastUpdated} syncing={syncing} syncError={syncError} onRefresh={refreshData} t={t} />
            <button
              onClick={() => setDark(!dark)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.border} ${t.bgAlt} ${t.cardHover} text-sm transition-colors`}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {syncError && (
          <div className="mb-6 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
            Não consegui sincronizar com a planilha agora — mostrando os últimos dados conhecidos.
            {syncErrorDetail && <span className="block mt-1 font-mono opacity-70">Detalhe técnico: {syncErrorDetail}</span>}
          </div>
        )}

        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} t={t} />

        {activeTab === "resumo" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <KpiCard t={t} icon={<Package size={16} />} label="Total de Itens Cadastrados" value={kpis.totalCadastrado} note="Registros ativos nas 5 praças." />
              <KpiCard t={t} icon={<MapPin size={16} />} label="Praças Ativas" value="5 Praças" note={PRACAS.join(", ")} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
              <BigFractionCard
                t={t}
                title="Itens Críticos em Falta"
                tooltip="Peças críticas (essenciais para operação) que estão com estoque abaixo do mínimo recomendado, do total de peças críticas cadastradas na planilha."
                falta={kpis.criticosFalta}
                total={kpis.criticosTotal}
                color={COLOR_ROSE}
                colorClass="text-rose-500"
                active={criticoFilter === true && somenteEmFalta}
                onClick={() => toggleQuickFilter(true)}
              />
              <BigFractionCard
                t={t}
                title="Itens Não Críticos em Falta"
                tooltip="Peças de uso comum (não essenciais) que estão abaixo do estoque mínimo, do total de peças não críticas cadastradas."
                falta={kpis.naoCriticosFalta}
                total={kpis.naoCriticosTotal}
                color={COLOR_AMBER}
                colorClass="text-amber-500"
                active={criticoFilter === false && somenteEmFalta}
                onClick={() => toggleQuickFilter(false)}
              />
            </div>

            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-5`}>
              <div className="flex items-center gap-1.5 mb-1">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Saúde do Estoque por Praça</h2>
                <Tooltip text="Barra cinza = total de itens cadastrados na praça. Preenchimento vermelho = quantos desses itens estão em falta. Dá pra comparar proporção E tamanho entre praças ao mesmo tempo." />
              </div>
              <p className={`text-xs mb-4 ${t.textFaint}`}>Cinza = total cadastrado · Vermelho = em falta</p>
              <div className="space-y-3">
                {saudeByPraca.map((row) => (
                  <PracaHealthRow key={row.praca} praca={row.praca} total={row.total} faltando={row.faltando} sharedMax={maxItensPraca} color={PRACA_COLORS[row.praca]} t={t} />
                ))}
              </div>
            </div>

            <p className={`text-xs text-center mt-4 ${t.textFaint}`}>
              Veja o detalhamento de unidades na aba <strong className={t.textDim}>Compras</strong>, a lista completa em <strong className={t.textDim}>Estoque Completo</strong>, ou o histórico em <strong className={t.textDim}>Movimentações</strong>.
            </p>
          </>
        )}

        {activeTab === "compras" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="sm:col-span-1">
                <KpiCard t={t} icon={<TrendingUp size={16} />} label="Qtd. Total a Comprar" value={`${kpis.totalComprar} un.`} note="Soma de unidades necessárias nas 5 praças." />
              </div>
              <div className={`sm:col-span-2 rounded-2xl border ${t.border} ${t.bgAlt} p-4 text-xs ${t.textDim} leading-relaxed flex items-center`}>
                Esta aba mostra <strong className={t.text}>unidades a comprar</strong>, não contagem de itens — os totais aqui não coincidem com os cards "Falta" do Resumo, que contam registros.
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
              <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-5`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Compra Consolidada por Praça</h2>
                  <Tooltip text="Total de unidades a comprar em cada praça, somando todos os itens." />
                </div>
                <p className={`text-xs mb-4 ${t.textFaint}`}>Unidades a comprar por praça</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={comprasPorPraca} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.dark ? "#27272a" : "#e2e8f0"} vertical={false} />
                    <XAxis dataKey="praca" tick={{ fontSize: 11, fill: t.dark ? "#94a3b8" : "#64748b" }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.dark ? "#94a3b8" : "#64748b" }} />
                    <RechartsTooltip contentStyle={{ background: t.dark ? "#18181b" : "#fff", border: `1px solid ${t.dark ? "#3f3f46" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: t.dark ? "#f1f5f9" : "#1e293b", fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: t.dark ? "#cbd5e1" : "#334155" }} />
                    <Bar dataKey="qtd" name="Unidades a comprar" radius={[4, 4, 0, 0]} activeBar={false} background={false}>
                      {comprasPorPraca.map((row) => (
                        <Cell key={row.praca} fill={PRACA_COLORS[row.praca]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-5`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Top Produtos — Compra Consolidada</h2>
                  <Tooltip text="Itens com maior quantidade total a comprar, somando todas as praças. Ajuda a priorizar pedidos de compra em lote." />
                </div>
                <p className={`text-xs mb-4 ${t.textFaint}`}>Unidades a comprar, somando as 5 praças</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topCompras} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.dark ? "#27272a" : "#e2e8f0"} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: t.dark ? "#94a3b8" : "#64748b" }} />
                    <YAxis type="category" dataKey="item" width={110} tick={{ fontSize: 11, fill: t.dark ? "#94a3b8" : "#64748b" }} />
                    <RechartsTooltip contentStyle={{ background: t.dark ? "#18181b" : "#fff", border: `1px solid ${t.dark ? "#3f3f46" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: t.dark ? "#f1f5f9" : "#1e293b", fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: t.dark ? "#cbd5e1" : "#334155" }} />
                    <Bar dataKey="qtd" fill="#6366F1" radius={[0, 4, 4, 0]} name="Unidades a comprar" activeBar={false} background={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-5`}>
              <div className="flex items-center gap-1.5 mb-1">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Resumo por Praça</h2>
                <Tooltip text="Clique numa praça para ver exatamente quais itens precisam ser comprados ali." />
              </div>
              <p className={`text-xs mb-4 ${t.textFaint}`}>Clique numa praça para ver os itens</p>
              <div className={`divide-y ${t.border}`}>
                {comprasPorPraca.map((row) => {
                  const isOpen = expandedPraca === row.praca;
                  const itens = itensParaComprarPorPraca[row.praca] || [];
                  return (
                    <div key={row.praca}>
                      <button
                        onClick={() => togglePracaExpand(row.praca)}
                        className={`w-full flex items-center justify-between py-3 text-sm ${t.cardHover} rounded-lg px-2 -mx-2 transition-colors`}
                      >
                        <span className="flex items-center gap-2">
                          <ChevronDown size={14} className={`${t.textFaint} transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          <span className="font-semibold" style={{ color: PRACA_COLORS[row.praca] }}>
                            {row.praca}
                          </span>
                        </span>
                        <span className={t.textDim}>
                          {row.itensComFalta} itens · <span className="font-mono font-semibold text-indigo-400">{row.qtd} un.</span>
                        </span>
                      </button>
                      {isOpen && (
                        <div className="pb-3 pl-6 pr-2 space-y-1.5">
                          {itens.length === 0 ? (
                            <p className={`text-xs ${t.textFaint}`}>Nenhum item precisa de compra nesta praça no momento. 🎉</p>
                          ) : (
                            itens.map((d, i) => (
                              <div key={i} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-lg ${t.dark ? "bg-zinc-800/50" : "bg-slate-100"}`}>
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className={`truncate ${t.text}`}>{d.item}</span>
                                  {d.critico && <span className="shrink-0 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px] font-semibold">Crítico</span>}
                                </span>
                                <span className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className={`${t.textFaint}`}>faltam {Math.abs(d.falta)}</span>
                                  <span className="font-mono font-semibold text-indigo-400">{d.comprar} un.</span>
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === "faltantes" && (
          <>
            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-5 mb-6`}>
              <div className="flex items-center gap-1.5 mb-1">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Itens Faltantes por Praça e Criticidade</h2>
                <Tooltip text="De todos os itens em falta em cada praça, quantos são críticos (vermelho) e quantos não são (âmbar)." />
              </div>
              <p className={`text-xs mb-4 ${t.textFaint}`}>Composição dos itens em falta, por praça</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={faltantesPorPracaCriticidade} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.dark ? "#27272a" : "#e2e8f0"} vertical={false} />
                  <XAxis dataKey="praca" tick={{ fontSize: 11, fill: t.dark ? "#94a3b8" : "#64748b" }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: t.dark ? "#94a3b8" : "#64748b" }} />
                  <RechartsTooltip contentStyle={{ background: t.dark ? "#18181b" : "#fff", border: `1px solid ${t.dark ? "#3f3f46" : "#e2e8f0"}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: t.dark ? "#f1f5f9" : "#1e293b", fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: t.dark ? "#cbd5e1" : "#334155" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {criticoFilterFalt !== false && <Bar dataKey="Críticos em Falta" stackId="a" fill={COLOR_ROSE} radius={criticoFilterFalt === true ? [4, 4, 0, 0] : [0, 0, 0, 0]} activeBar={false} background={false} />}
                  {criticoFilterFalt !== true && <Bar dataKey="Não Críticos em Falta" stackId="a" fill={COLOR_AMBER} radius={[4, 4, 0, 0]} activeBar={false} background={false} />}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-4 mb-4`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${t.textDim}`}>Filtrar por praça (só itens em falta)</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setPracaFilterFalt(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    !pracaFilterFalt ? `${t.text} border-current` : `${t.textFaint} ${t.border} ${t.cardHover}`
                  }`}
                >
                  Todas ({estoqueRows.filter((d) => d.falta < 0).length})
                </button>
                {PRACAS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPracaFilterFalt((prev) => (prev === p ? null : p))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${t.cardHover}`}
                    style={
                      pracaFilterFalt === p
                        ? { color: PRACA_COLORS[p], borderColor: PRACA_COLORS[p], backgroundColor: `${PRACA_COLORS[p]}1A` }
                        : { color: t.dark ? "#71717a" : "#94a3b8", borderColor: t.dark ? "#3f3f46" : "#e2e8f0" }
                    }
                  >
                    {p} ({faltantesPorPraca[p] || 0})
                  </button>
                ))}
              </div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${t.textDim}`}>Filtrar por importância</p>
              <CriticoChipRow value={criticoFilterFalt} onChange={setCriticoFilterFalt} counts={criticosFaltantesCount} t={t} />
              <div className="relative">
                <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
                <input
                  value={searchFalt}
                  onChange={(e) => setSearchFalt(e.target.value)}
                  placeholder="Buscar por item ou praça..."
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text}`}
                />
              </div>
            </div>

            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={t.theadBg}>
                    <tr className={`text-left border-b ${t.border}`}>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim}`}>Praça</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim}`}>Item</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim}`}>Crítico</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Mínimo</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Atual</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Falta</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Comprar</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {pagedRowsFalt.map((d, i) => (
                      <tr key={i} className={`${t.rowHover} transition-colors`}>
                        <td className="px-4 py-2.5 font-semibold text-xs tracking-wide" style={{ color: PRACA_COLORS[d.praca] }}>
                          {d.praca}
                        </td>
                        <td className="px-4 py-2.5">{d.item}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              d.critico ? "bg-rose-500/15 text-rose-400" : t.dark ? "bg-zinc-700/50 text-slate-400" : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {d.critico ? "Sim" : "Não"}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono ${t.textDim}`}>{d.min}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${t.textDim}`}>{d.atual === null ? "—" : d.atual}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-rose-500">{d.falta}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-indigo-400">{d.comprar}</td>
                      </tr>
                    ))}
                    {pagedRowsFalt.length === 0 && (
                      <tr>
                        <td colSpan="7" className={`px-4 py-10 text-center text-sm ${t.textFaint}`}>
                          Nenhum item em falta com esses filtros. 🎉
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className={`flex items-center justify-between px-4 py-3 border-t ${t.border} text-xs ${t.textDim}`}>
                <span>
                  {faltantesRows.length === 0 ? 0 : currentPageFalt * pageSize + 1}–{Math.min((currentPageFalt + 1) * pageSize, faltantesRows.length)} de {faltantesRows.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPageFalt((p) => Math.max(0, p - 1))}
                    disabled={currentPageFalt === 0}
                    className={`p-1.5 rounded-lg border ${t.border} disabled:opacity-30 ${t.cardHover}`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono">
                    {currentPageFalt + 1} / {totalPagesFalt}
                  </span>
                  <button
                    onClick={() => setPageFalt((p) => Math.min(totalPagesFalt - 1, p + 1))}
                    disabled={currentPageFalt >= totalPagesFalt - 1}
                    className={`p-1.5 rounded-lg border ${t.border} disabled:opacity-30 ${t.cardHover}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "estoque" && (
          <>
            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} p-4 mb-4`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${t.textDim}`}>Filtrar por praça</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setPracaFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    !pracaFilter ? `${t.text} border-current` : `${t.textFaint} ${t.border} ${t.cardHover}`
                  }`}
                >
                  Todas ({estoqueRows.length})
                </button>
                {PRACAS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPracaFilter((prev) => (prev === p ? null : p))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${t.cardHover}`}
                    style={
                      pracaFilter === p
                        ? { color: PRACA_COLORS[p], borderColor: PRACA_COLORS[p], backgroundColor: `${PRACA_COLORS[p]}1A` }
                        : { color: t.dark ? "#71717a" : "#94a3b8", borderColor: t.dark ? "#3f3f46" : "#e2e8f0" }
                    }
                  >
                    {p} ({itensPorPraca[p] || 0})
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <p className={`text-xs font-semibold uppercase tracking-wide ${t.textDim}`}>Filtrar por importância</p>
                <button
                  onClick={() => setSomenteEmFalta((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${t.cardHover}`}
                  style={
                    somenteEmFalta
                      ? { color: COLOR_ROSE, borderColor: COLOR_ROSE, backgroundColor: `${COLOR_ROSE}1A` }
                      : { color: t.dark ? "#71717a" : "#94a3b8", borderColor: t.dark ? "#3f3f46" : "#e2e8f0" }
                  }
                >
                  Só itens em falta
                </button>
              </div>
              <CriticoChipRow
                value={criticoFilter}
                onChange={setCriticoFilter}
                counts={criticosCount}
                t={t}
                onTodos={() => {
                  setCriticoFilter(null);
                  setSomenteEmFalta(false);
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textFaint}`} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por item ou praça..."
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${t.inputBorder} ${t.inputBg} ${t.text}`}
                  />
                </div>
                <span className={`text-xs ${t.textFaint}`}>{filteredRows.length} itens encontrados</span>
              </div>
            </div>

            <div className={`rounded-2xl border ${t.border} ${t.bgAlt} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={t.theadBg}>
                    <tr className={`text-left border-b ${t.border}`}>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim}`}>Praça</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim}`}>Item</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim}`}>Crítico</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Mínimo</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Atual</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Falta/Exced.</th>
                      <th className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide ${t.textDim} text-right`}>Comprar</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {pagedRows.map((d, i) => (
                      <tr key={i} className={`${t.rowHover} transition-colors`}>
                        <td className="px-4 py-2.5 font-semibold text-xs tracking-wide" style={{ color: PRACA_COLORS[d.praca] }}>
                          {d.praca}
                        </td>
                        <td className="px-4 py-2.5">{d.item}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              d.critico ? "bg-rose-500/15 text-rose-400" : t.dark ? "bg-zinc-700/50 text-slate-400" : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {d.critico ? "Sim" : "Não"}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono ${t.textDim}`}>{d.min}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${t.textDim}`}>{d.atual === null ? "—" : d.atual}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${d.falta < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                          {d.falta > 0 ? `+${d.falta}` : d.falta}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${d.comprar > 0 ? "text-indigo-400" : t.textFaint}`}>{d.comprar}</td>
                      </tr>
                    ))}
                    {pagedRows.length === 0 && (
                      <tr>
                        <td colSpan="7" className={`px-4 py-10 text-center text-sm ${t.textFaint}`}>
                          Nenhum item corresponde à busca ou filtro selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className={`flex items-center justify-between px-4 py-3 border-t ${t.border} text-xs ${t.textDim}`}>
                <span>
                  {filteredRows.length === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredRows.length)} de {filteredRows.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className={`p-1.5 rounded-lg border ${t.border} disabled:opacity-30 ${t.cardHover}`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono">
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className={`p-1.5 rounded-lg border ${t.border} disabled:opacity-30 ${t.cardHover}`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "movimentacoes" && (
          <div className={`rounded-2xl border ${t.border} ${t.bgAlt} overflow-hidden`}>
            <div className={`p-5 border-b ${t.border}`}>
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide mb-1">Movimentações de Estoque</h2>
              <p className={`text-xs ${t.textFaint}`}>Direto da aba "Movimentações" da planilha — atualiza a cada sincronização.</p>
            </div>
            {movRows.length === 0 ? (
              <div className={`p-10 text-center text-sm ${t.textFaint}`}>{syncing ? "Carregando movimentações…" : "Nenhuma movimentação encontrada nesta aba da planilha."}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={t.theadBg}>
                    <tr className={`text-left border-b ${t.border}`}>
                      {movCols.map((c, i) => (
                        <th key={i} className={`px-4 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap ${t.textDim}`}>
                          {c || `Col. ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {movRows.map((row, i) => (
                      <tr key={i} className={`${t.rowHover} transition-colors`}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5 whitespace-nowrap">
                            {cell === "" ? "—" : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p className={`text-xs text-center mt-8 ${t.textFaint}`}>Painel Executivo de Estoque · MUDE · Sincronizado automaticamente a cada 60s</p>
      </div>
    </div>
  );
}
