"use client";

import { useEffect, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, Bell, Bot, BriefcaseBusiness, Check,
  ChevronDown, CircleHelp, Database, Download, ExternalLink, Filter, Gauge,
  Layers3, MapPin, Menu, RefreshCw, Search, Settings2, Sparkles, Target, TerminalSquare, X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Language = "zh" | "en";
type CountRow = { name: string; value: number; name_en?: string };
type Job = {
  post_id: string;
  title_zh: string;
  title_en: string;
  category_zh: string;
  category_en: string;
  parent_category_zh: string;
  parent_category_en: string;
  location: { zh: string; en: string }[];
  publish_time: number | null;
  source_url: string;
  signal_tags: string[];
};
type Summary = {
  source: {
    source_url: string;
    source_api: string;
    fetched_at: string;
    reported_total: number;
    fetched_pages: number;
    unique_rows: number;
    missing_rows: number;
    complete: boolean;
    validation: Record<string, boolean>;
  };
  dimensions: { id: string; label_zh: string; label_en: string; type: string; source: string }[];
  metrics: { total: number; categories: number; cities: number; ai_jobs: number; ecommerce_jobs: number };
  category_counts: CountRow[];
  function_counts: CountRow[];
  city_counts: CountRow[];
  experience_counts: CountRow[];
  rd_experience_counts: CountRow[];
  ai_experience_counts: CountRow[];
  ecommerce_experience_counts: CountRow[];
  signal_counts: CountRow[];
  ai_city_counts: CountRow[];
  ecommerce_category_counts: CountRow[];
  newest: Job[];
};

const categoryEn: Record<string, string> = {
  研发: "R&D", 运营: "Operations", 产品: "Product", "职能 / 支持": "Corporate functions",
  销售: "Sales", 设计: "Design", 市场: "Marketing", 游戏策划: "Game planning", 教研教学: "Education",
};
const navItems = [
  { id: "overview", zh: "总览", en: "Overview", icon: Gauge },
  { id: "jobs", zh: "岗位池", en: "Job pool", icon: BriefcaseBusiness },
  { id: "structure", zh: "结构分析", en: "Structure", icon: BarChart3 },
  { id: "signals", zh: "关键词雷达", en: "Signals", icon: Sparkles },
  { id: "crawler", zh: "抓取任务", en: "Crawl task", icon: RefreshCw },
];
const colors = ["#71e3bf", "#7d8cff", "#f1bc7a", "#b6a1ff", "#566174", "#78b9d4"];
const copy = {
  zh: {
    workspace: "字节跳动社招", source: "官方招聘站 · 社招/正式", workbench: "监控工作台", scope: "监测范围 · 当前全量快照",
    title: "岗位外招动态", subtitle: "从真实岗位快照中识别研发结构、业务重点与 AI / 电商信号。", date: "快照时间", sync: "已核验",
    syncShort: "核验通过", allJobs: "当前在招岗位", jobFamilies: "岗位类别", aiJobs: "AI 相关岗位", locations: "覆盖地点",
    vsSource: "来自源站", latest: "最新岗位池", latestKicker: "LATEST SOURCE RECORDS", category: "岗位类别", location: "地点",
    published: "发布时间", sourceLanguage: "源站中文", open: "打开源站", signal: "业务信号", signalNote: "规则归因",
    ask: "问问岗位数据", placeholder: "例如：大模型岗位集中在哪些城市？", aiTrend: "AI / 大模型", ecommerce: "电商相关",
    locationTrend: "地点分布", viewInsight: "查看洞察", every7: "每 7 天", download: "下载全量数据", dimensions: "开放分析维度",
    verified: "真实性校验", records: "条记录", pages: "页", missing: "缺失", noMissing: "无缺失", derived: "基于源文案规则归类",
    loading: "正在载入真实快照…", noResults: "当前筛选没有岗位。",
  },
  en: {
    workspace: "ByteDance experienced", source: "Official careers · Experienced / Regular", workbench: "Monitoring workspace",
    scope: "Scope · Full source snapshot", title: "External hiring signals", subtitle: "Read engineering mix, business focus and AI / e-commerce signals from the live source snapshot.",
    date: "Snapshot", sync: "Verified", syncShort: "Checks passed", allJobs: "Active jobs", jobFamilies: "Job families", aiJobs: "AI-related jobs",
    locations: "Locations", vsSource: "From source", latest: "Latest job pool", latestKicker: "LATEST SOURCE RECORDS", category: "Job family",
    location: "Location", published: "Published", sourceLanguage: "Source language: zh", open: "Open source", signal: "Business signals",
    signalNote: "Rule-derived", ask: "Ask the job data", placeholder: "For example: where are AI jobs concentrated?", aiTrend: "AI / LLM",
    ecommerce: "E-commerce", locationTrend: "Locations", viewInsight: "View insight", every7: "Every 7 days", download: "Download full snapshot",
    dimensions: "Open analysis dimensions", verified: "Integrity checks", records: "records", pages: "pages", missing: "missing", noMissing: "none",
    derived: "Rule-derived from source text", loading: "Loading the verified source snapshot…", noResults: "No jobs match the current filters.",
  },
};

function pct(value: number, total: number) { return total ? `${Math.round((value / total) * 100)}%` : "0%"; }
function formatDate(value: string, lang: Language) {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
function labelFor(row: CountRow, lang: Language) { return lang === "en" ? (row.name_en ?? categoryEn[row.name] ?? row.name) : row.name; }
function jobLocation(job: Job, lang: Language) { return (job.location ?? []).map((item) => lang === "en" ? item.en || item.zh : item.zh).join(", "); }

function Donut({ rows, total, lang }: { rows: CountRow[]; total: number; lang: Language }) {
  const background = rows.slice(0, 5).reduce<{ segments: string[]; cursor: number }>((state, row, index) => {
    const start = state.cursor;
    const cursor = state.cursor + (row.value / total) * 100;
    return { segments: [...state.segments, `${colors[index]} ${start}% ${cursor}%`], cursor };
  }, { segments: [], cursor: 0 }).segments.join(", ");
  return <div className="donut" style={{ background: `conic-gradient(${background})` }}><div className="donut-hole"><span>{total.toLocaleString()}</span><small>{lang === "zh" ? "岗位" : "jobs"}</small></div></div>;
}

function MetricCard({ label, value, foot, icon, accent = false }: { label: string; value: string | number; foot: React.ReactNode; icon: React.ReactNode; accent?: boolean }) {
  return <div className={`metric-card ${accent ? "accent-card" : ""}`}><div className="metric-label">{label}<span className="metric-icon">{icon}</span></div><div className="metric-value">{value}</div><div className="metric-foot neutral">{foot}</div></div>;
}

function CrawlerView({ summary, lang, t }: { summary: Summary; lang: Language; t: typeof copy.zh }) {
  return <section className="crawler-layout">
    <div className="panel crawler-main-panel">
      <div className="panel-heading"><div><div className="panel-kicker">SOURCE CONFIGURATION</div><h2>{lang === "zh" ? "来源与抓取计划" : "Source and cadence"}</h2></div><span className="pill green"><span className="status-dot" />{t.every7}</span></div>
      <div className="source-card"><div className="source-icon"><TerminalSquare size={20} /></div><div className="source-info"><strong>{t.workspace} · {t.source}</strong><span>{summary.source.source_url}</span></div><button className="icon-button" aria-label="Settings"><Settings2 size={17} /></button></div>
      <div className="crawl-grid">
        <div className="crawl-stat"><span>{lang === "zh" ? "抓取频率" : "Cadence"}</span><strong>{t.every7}</strong><small>{lang === "zh" ? "下次按调度执行" : "Next run follows schedule"}</small></div>
        <div className="crawl-stat"><span>{lang === "zh" ? "上次全量" : "Last full run"}</span><strong>{summary.source.unique_rows.toLocaleString()}</strong><small>{formatDate(summary.source.fetched_at, lang)}</small></div>
        <div className="crawl-stat"><span>{lang === "zh" ? "完整性" : "Completeness"}</span><strong>{summary.source.complete ? "100%" : "Review"}</strong><small>{summary.source.fetched_pages} / {summary.source.fetched_pages} {t.pages}</small></div>
      </div>
      <div className="task-timeline"><div className="timeline-line" />{[lang === "zh" ? "发现岗位列表" : "Discover posts", lang === "zh" ? "解析详情字段" : "Parse fields", lang === "zh" ? "标准化与去重" : "Normalize & dedupe", lang === "zh" ? "写入分析层" : "Write analysis layer"].map((item) => <div className="timeline-step" key={item}><div className="timeline-dot complete"><Check size={12} /></div><strong>{item}</strong><span>{lang === "zh" ? "已完成" : "Complete"}</span></div>)}</div>
    </div>
    <div className="panel schema-panel">
      <div className="panel-heading"><div><div className="panel-kicker">CONFIGURABLE DIMENSIONS</div><h2>{t.dimensions}</h2></div><CircleHelp size={17} className="muted-icon" /></div>
      <div className="schema-list">{summary.dimensions.map((dimension) => <div className="schema-row" key={dimension.id}><span className="schema-check"><Check size={12} /></span><span>{lang === "zh" ? dimension.label_zh : dimension.label_en}</span><code>{dimension.id}</code></div>)}</div>
      <div className="schema-note"><Layers3 size={16} /><span>{lang === "zh" ? "维度由 id / field / type / source 描述，后续可新增或替换。" : "Each dimension is described by id / field / type / source and can be extended later."}</span></div>
    </div>
  </section>;
}

function JobsPanel({ summary, lang, t, activeCategory, setActiveCategory, activeLocation, setActiveLocation }: {
  summary: Summary; lang: Language; t: typeof copy.zh; activeCategory: string; setActiveCategory: (value: string) => void; activeLocation: string; setActiveLocation: (value: string) => void;
}) {
  const categories = summary.category_counts;
  const locations = summary.city_counts;
  const filteredJobs = summary.newest.filter((job) => (activeCategory === "全部" || job.parent_category_zh === activeCategory) && (activeLocation === "全部" || job.location.some((item) => item.zh === activeLocation)));
  return <section className="panel jobs-panel">
    <div className="panel-heading"><div><div className="panel-kicker">{t.latestKicker}</div><h2>{t.latest}</h2></div><div className="job-actions"><div className="filter-group"><Filter size={14} /><select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}><option value="全部">{lang === "zh" ? "全部类别" : "All families"}</option>{categories.map((item) => <option key={item.name} value={item.name}>{labelFor(item, lang)}</option>)}</select></div><div className="filter-group"><MapPin size={14} /><select value={activeLocation} onChange={(event) => setActiveLocation(event.target.value)}><option value="全部">{lang === "zh" ? "全部地点" : "All locations"}</option>{locations.slice(0, 20).map((item) => <option key={item.name} value={item.name}>{labelFor(item, lang)}</option>)}</select></div></div></div>
    <div className="job-table"><div className="job-table-head"><span>{lang === "zh" ? "岗位名称" : "Title"}</span><span>{t.category}</span><span>{t.location}</span><span>{t.published}</span><span /></div>{filteredJobs.slice(0, 8).map((job) => <div className="job-row" key={job.post_id}><div className="job-title"><span className="job-pulse" /><div><strong>{job.title_zh}</strong><span>{t.sourceLanguage} · {job.signal_tags.slice(0, 2).join(" · ") || "—"}</span></div></div><div className="job-dept"><strong>{lang === "zh" ? job.parent_category_zh : job.parent_category_en}</strong><span>{lang === "zh" ? job.category_zh : job.category_en}</span></div><div className="job-location"><MapPin size={14} />{jobLocation(job, lang)}</div><div className="job-posted">{job.publish_time ? formatDate(new Date(job.publish_time).toISOString(), lang) : "—"}</div><a className="icon-button row-arrow" href={job.source_url} target="_blank" rel="noreferrer" aria-label={`${t.open} ${job.title_zh}`}><ExternalLink size={15} /></a></div>)}</div>
    {filteredJobs.length === 0 && <div className="empty-state">{t.noResults}</div>}
    <div className="table-footer"><span>{lang === "zh" ? `显示最新 ${Math.min(filteredJobs.length, 8)} 条，完整 ${summary.metrics.total.toLocaleString()} 条可下载` : `Showing ${Math.min(filteredJobs.length, 8)} latest records; download all ${summary.metrics.total.toLocaleString()}`}</span><span><span className="status-dot" /> {t.source}</span></div>
  </section>;
}

export default function Home() {
  const [lang, setLang] = useState<Language>("zh");
  const [activeView, setActiveView] = useState("overview");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activeLocation, setActiveLocation] = useState("全部");
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const t = copy[lang];

  useEffect(() => {
    fetch("/data/bytedance-dashboard-summary.json").then((response) => response.json() as Promise<Summary>).then((data) => setSummary(data)).catch(() => setSummary(null));
  }, []);

  if (!summary) return <main className="radar-shell"><div className="loading-state"><div className="brand-mark"><Target size={18} /></div><strong>{t.loading}</strong></div></main>;

  const categories = summary.category_counts;
  const locations = summary.city_counts;
  const aiPct = pct(summary.metrics.ai_jobs, summary.metrics.total);
  const ecommercePct = pct(summary.metrics.ecommerce_jobs, summary.metrics.total);
  const topAiCity = summary.ai_city_counts[0];
  const topEcommerceCategory = summary.ecommerce_category_counts[0];
  const isEcommerceQuery = query.toLowerCase().includes("电商") || query.toLowerCase().includes("ecommerce");
  const insight = isEcommerceQuery
    ? (lang === "zh" ? `电商信号命中 ${summary.metrics.ecommerce_jobs.toLocaleString()} 个岗位（${ecommercePct}）。最集中的岗位大类是 ${topEcommerceCategory?.name ?? "—"}。` : `E-commerce signals match ${summary.metrics.ecommerce_jobs.toLocaleString()} jobs (${ecommercePct}). The leading job family is ${topEcommerceCategory ? labelFor(topEcommerceCategory, lang) : "—"}.`)
    : (lang === "zh" ? `AI / 大模型关键词命中 ${summary.metrics.ai_jobs.toLocaleString()} 个岗位（${aiPct}）。相关岗位最多的地点是 ${topAiCity?.name ?? "—"}。` : `AI / LLM keywords match ${summary.metrics.ai_jobs.toLocaleString()} jobs (${aiPct}). The leading location is ${topAiCity ? labelFor(topAiCity, lang) : "—"}.`);
  const experienceData = summary.rd_experience_counts.slice(0, 6).map((row) => ({
    ...row,
    ai: summary.ai_experience_counts.find((item) => item.name === row.name)?.value ?? 0,
    ecommerce: summary.ecommerce_experience_counts.find((item) => item.name === row.name)?.value ?? 0,
  }));

  return <main className="radar-shell">
    <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><Target size={18} strokeWidth={2.4} /></div><div><div className="brand-name">signal<span>/</span>radar</div><div className="brand-caption">{lang === "zh" ? "招聘情报工作台" : "Hiring intelligence"}</div></div><button className="icon-button mobile-only" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
      <div className="workspace-switcher"><div className="workspace-logo">BD</div><div className="workspace-copy"><strong>{t.workspace}</strong><span>{t.source}</span></div><ChevronDown size={15} className="muted-icon" /></div>
      <div className="nav-section-label">{t.workbench}</div>
      <nav className="main-nav" aria-label={t.workbench}>{navItems.map(({ id, zh, en, icon: Icon }) => <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => { setActiveView(id); setMobileNavOpen(false); }}><Icon size={17} strokeWidth={activeView === id ? 2.3 : 1.8} /><span>{lang === "zh" ? zh : en}</span>{id === "signals" && <span className="nav-badge">{summary.signal_counts.length}</span>}</button>)}</nav>
      <div className="nav-section-label nav-spacer-label">{lang === "zh" ? "配置" : "Configuration"}</div><nav className="main-nav"><button className="nav-item"><Database size={17} /><span>{lang === "zh" ? "数据字典" : "Data dictionary"}</span></button><button className="nav-item"><Settings2 size={17} /><span>{lang === "zh" ? "监控设置" : "Monitor settings"}</span></button></nav>
      <div className="sidebar-footer"><div className="health-row"><span className="status-dot" /> {t.syncShort}</div><div className="footer-meta">{t.date} · {formatDate(summary.source.fetched_at, lang)}</div></div>
    </aside>
    <section className="main-canvas">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>{t.workbench}</span><span className="slash">/</span><strong>{navItems.find((item) => item.id === activeView)?.[lang === "zh" ? "zh" : "en"]}</strong></div><div className="topbar-actions"><div className="lang-toggle" role="group" aria-label="Language"><button className={lang === "zh" ? "selected" : ""} onClick={() => setLang("zh")}>中文</button><button className={lang === "en" ? "selected" : ""} onClick={() => setLang("en")}>EN</button></div><div className="sync-status"><span className="status-dot" /> {t.sync} <span className="sync-time">{formatDate(summary.source.fetched_at, lang)}</span></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><div className="avatar">ZW</div></div></header>
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow"><Activity size={14} /> {t.scope}</div><h1>{activeView === "crawler" ? (lang === "zh" ? "抓取任务" : "Crawl task") : activeView === "signals" ? (lang === "zh" ? "关键词雷达" : "Signal radar") : t.title}</h1><p>{activeView === "crawler" ? (lang === "zh" ? "管理来源、抓取频率与最近一次全量同步。" : "Manage the source, cadence and last full sync.") : t.subtitle}</p></div><div className="heading-actions"><a className="button secondary" href={summary.source.source_url} target="_blank" rel="noreferrer"><ExternalLink size={15} /> {t.source}</a><a className="button secondary" href="/data/bytedance-social-jobs.json" download><Download size={15} /> {t.download}</a><button className="button primary" onClick={() => setActiveView("crawler")}><RefreshCw size={16} /> {lang === "zh" ? "查看同步任务" : "View crawl task"}</button></div></div>
        <section className="source-banner"><div className="source-banner-icon"><Check size={15} /></div><div><strong>{t.verified}</strong><span>{summary.source.unique_rows.toLocaleString()} {t.records} · {summary.source.fetched_pages} {t.pages} · {t.missing} {summary.source.missing_rows === 0 ? t.noMissing : summary.source.missing_rows}</span></div><a href={summary.source.source_url} target="_blank" rel="noreferrer">{summary.source.source_url.replace("https://", "")}</a></section>
        {activeView === "crawler" ? <CrawlerView summary={summary} lang={lang} t={t} /> : <>
          <section className="metric-grid"><MetricCard label={t.allJobs} value={summary.metrics.total.toLocaleString()} foot={<><Check size={14} /> {t.vsSource}</>} icon={<BriefcaseBusiness size={15} />} accent /><MetricCard label={t.jobFamilies} value={summary.metrics.categories} foot={lang === "zh" ? "一级岗位类别" : "top-level families"} icon={<Layers3 size={15} />} /><MetricCard label={t.aiJobs} value={aiPct} foot={<><span className="tiny-bar"><i style={{ width: aiPct }} /></span>{summary.metrics.ai_jobs.toLocaleString()}</>} icon={<Bot size={15} />} /><MetricCard label={t.locations} value={summary.metrics.cities} foot={lang === "zh" ? "城市 / 地区" : "cities / regions"} icon={<MapPin size={15} />} /></section>
          <section className="insight-strip"><div className="insight-strip-icon"><Sparkles size={17} /></div><div className="insight-strip-copy"><strong>{lang === "zh" ? "源数据已接入" : "Live source connected"}</strong><span>{summary.source.unique_rows.toLocaleString()} {t.records} {lang === "zh" ? "均来自官方社招接口，当前快照完整。" : "were fetched from the official experienced-hire API with a complete snapshot."}</span></div><button className="text-button" onClick={() => setActiveView("signals")}>{t.viewInsight} <ArrowUpRight size={15} /></button></section>
          <section className="dashboard-grid">
            <div className="panel seniority-panel"><div className="panel-heading"><div><div className="panel-kicker">R&amp;D EXPERIENCE MIX</div><h2>{lang === "zh" ? "研发岗位 × 经验要求" : "R&amp;D jobs × experience"}</h2></div><span className="derived-badge">{t.derived}</span></div><div className="chart-legend"><span><i className="legend-dot mint" />{lang === "zh" ? "研发岗位数" : "R&amp;D jobs"}</span><span><i className="legend-dot violet" />{lang === "zh" ? "AI 命中" : "AI signal"}</span><span><i className="legend-dot amber" />{lang === "zh" ? "电商命中" : "E-commerce"}</span></div><div className="seniority-chart"><ResponsiveContainer width="100%" height={240}><BarChart data={experienceData} layout="vertical" margin={{ top: 4, right: 42, left: 12, bottom: 0 }} barCategoryGap={14}><CartesianGrid horizontal={false} stroke="#243044" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={86} tick={{ fill: "#9aa6b9", fontSize: 12 }} /><Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={{ background: "#151e2b", border: "1px solid #2b394b", borderRadius: 10, color: "#eef4fa" }} /><Bar dataKey="value" name={lang === "zh" ? "研发岗位" : "R&D jobs"} fill="#71e3bf" radius={[0, 5, 5, 0]} barSize={14}><LabelList dataKey="value" position="right" fill="#d9e5ed" fontSize={12} /></Bar><Bar dataKey="ai" name={lang === "zh" ? "AI 命中" : "AI signal"} fill="#7d8cff" radius={[0, 5, 5, 0]} barSize={7} /><Bar dataKey="ecommerce" name={lang === "zh" ? "电商命中" : "E-commerce"} fill="#f1bc7a" radius={[0, 5, 5, 0]} barSize={7} /></BarChart></ResponsiveContainer></div></div>
            <div className="panel department-panel"><div className="panel-heading"><div><div className="panel-kicker">JOB FAMILY MIX</div><h2>{lang === "zh" ? "岗位类别 / 业务领域" : "Job family / business area"}</h2></div><span className="derived-badge">{t.derived}</span></div><div className="donut-wrap"><Donut rows={categories} total={summary.metrics.total} lang={lang} /><div className="department-legend">{categories.slice(0, 5).map((item, index) => <div className="department-row" key={item.name}><span><i className="legend-dot" style={{ background: colors[index] }} />{labelFor(item, lang)}</span><strong>{pct(item.value, summary.metrics.total)}</strong></div>)}</div></div></div>
            <div className="panel location-panel"><div className="panel-heading"><div><div className="panel-kicker">LOCATION SIGNAL</div><h2>{t.locationTrend}</h2></div><MapPin size={17} className="muted-icon" /></div><div className="location-list">{locations.slice(0, 6).map((item, i) => <div className="location-row" key={item.name}><span className="location-name">{labelFor(item, lang)}</span><div className="location-bar"><i style={{ width: `${(item.value / locations[0].value) * 100}%`, opacity: `${1 - i * 0.08}` }} /></div><span className="location-delta">{pct(item.value, summary.metrics.total)}</span></div>)}</div><div className="location-foot"><span>{lang === "zh" ? "第一地点" : "Top location"}</span><strong>{labelFor(locations[0], lang)}</strong><span className="foot-muted">{locations[0].value.toLocaleString()} {t.records}</span></div></div>
            <div className="panel assistant-panel"><div className="panel-heading"><div><div className="panel-kicker">NATURAL LANGUAGE LENS</div><h2>{t.ask}</h2></div><div className="ai-badge"><Bot size={14} /> AI</div></div><div className="assistant-input"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} /><button onClick={() => setQuery(query || (lang === "zh" ? "大模型" : "AI"))} aria-label="Run analysis"><ArrowUpRight size={17} /></button></div><div className="suggestion-row"><button onClick={() => setQuery(lang === "zh" ? "大模型" : "AI")}>{t.aiTrend}</button><button onClick={() => setQuery(lang === "zh" ? "电商" : "ecommerce")}>{t.ecommerce}</button><button onClick={() => setQuery(lang === "zh" ? "地点" : "location")}>{t.locationTrend}</button></div><div className="assistant-answer"><div className="answer-mark"><Sparkles size={15} /></div><div><strong>{insight}</strong><p>{t.signalNote} · {t.derived}</p><div className="answer-bullets"><span><i />{lang === "zh" ? "来源：岗位标题、描述、任职要求" : "Source: title, description, requirements"}</span><span><i />{lang === "zh" ? "不含未公开的内部部门字段" : "No private department field is inferred"}</span></div></div></div></div>
          </section>
          <JobsPanel summary={summary} lang={lang} t={t} activeCategory={activeCategory} setActiveCategory={setActiveCategory} activeLocation={activeLocation} setActiveLocation={setActiveLocation} />
        </>}
      </div>
    </section>
  </main>;
}
