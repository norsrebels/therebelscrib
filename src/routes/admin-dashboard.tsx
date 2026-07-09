import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getExecutiveDashboard } from '@/server/dashboard.functions'
import { Users, CalendarDays, UserCheck, TrendingUp, Wallet, AlertCircle, TrendingDown, Percent, Coins, Target, Repeat } from 'lucide-react'
import { motion } from 'motion/react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ComposedChart, Line,
} from 'recharts'

export const Route = createFileRoute('/admin-dashboard')({
  component: DashboardPage,
})

// Palette mined from the AI Studio prototype, mapped to finance semantics.
const INDIGO = '#4f46e5'
const EMERALD = '#10b981'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const VIOLET = '#a855f7'
const SLATE = '#94a3b8'
const POSITION_COLORS: Record<string, string> = {
  OS: '#3b82f6', OPP: RED, MB: EMERALD, S: AMBER, L: VIOLET,
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n ?? 0)
}
function num(n: number): string {
  return new Intl.NumberFormat().format(n ?? 0)
}

function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cashGrain, setCashGrain] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    getExecutiveDashboard()
      .then(setData)
      .catch((e) => setError(e?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-sm text-[rgb(var(--muted-fg))]">Loading dashboard…</p></div>
  if (error) return <div className="max-w-6xl mx-auto px-4 py-8"><p className="text-sm text-red-500">{error}</p></div>
  if (!data) return null

  const paymentData = [
    { name: 'Paid', value: data.finance.paidCount, color: EMERALD },
    { name: 'Partial', value: data.finance.partialCount, color: AMBER },
    { name: 'Unpaid', value: data.finance.unpaidCount, color: RED },
  ].filter((d) => d.value > 0)

  const typeData = (data.byType ?? []).map((t: any, i: number) => ({ name: t.type, value: t.count, color: [INDIGO, VIOLET, AMBER, EMERALD][i % 4] }))
  const agingData = [
    { name: '0–30d', value: data.aging?.d0_30 ?? 0, color: EMERALD },
    { name: '31–60d', value: data.aging?.d31_60 ?? 0, color: AMBER },
    { name: '61–90d', value: data.aging?.d61_90 ?? 0, color: '#f97316' },
    { name: '90d+', value: data.aging?.d90_plus ?? 0, color: RED },
  ]
  const agingTotal = agingData.reduce((s, a) => s + a.value, 0)
  const expenseCatData = (data.expenseByCategory ?? []).map((e: any, i: number) => ({
    name: e.category, value: e.total, color: [RED, AMBER, INDIGO, VIOLET, EMERALD, '#06b6d4', '#ec4899', '#64748b'][i % 8],
  }))
  // Merge monthly expenses into the revenue series for the break-even line.
  const expenseMonthMap: Record<string, number> = {}
  ;(data.expenseByMonth ?? []).forEach((e: any) => { expenseMonthMap[e.month] = e.total })
  const revenueWithExpenses = (data.revenueByMonth ?? []).map((m: any) => ({
    ...m, expenses: expenseMonthMap[m.month] ?? 0,
  }))


  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={22} />
          <h1 className="text-2xl font-extrabold tracking-tight">Executive Dashboard</h1>
        </div>
        <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">Club performance at a glance — participation, finance, and operations.</p>
      </motion.div>

      {/* Headline counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard icon={Users} label="Total Registrations" value={num(data.counts.totalRegistrations)} accent={INDIGO} i={0} delta={data.trend?.regDelta} />
        <KpiCard icon={UserCheck} label="Unique Participants" value={num(data.counts.uniqueParticipants)} accent={VIOLET} i={1} />
        <KpiCard icon={CalendarDays} label="Active Schedules" value={num(data.counts.activeSchedules)} accent={EMERALD} i={2} />
        <KpiCard icon={Repeat} label="Retention (90d)" value={`${data.retention?.rate ?? 0}%`} accent={INDIGO} i={3} />
      </div>

      {/* Finance headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard icon={Wallet} label="Expected" value={money(data.finance.expected)} accent={INDIGO} i={0} small />
        <KpiCard icon={Wallet} label="Collected" value={money(data.finance.collected)} accent={EMERALD} i={1} small delta={data.trend?.cashDelta} />
        <KpiCard icon={AlertCircle} label="Outstanding" value={money(data.finance.outstanding)} accent={RED} i={2} small />
        <KpiCard icon={TrendingUp} label="Collection Rate" value={`${data.finance.collectionRate}%`} accent={INDIGO} i={3} small />
      </div>

      {/* Financial depth */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard icon={data.finance.net >= 0 ? TrendingUp : TrendingDown} label="Net (cash)" value={money(data.finance.net)} accent={data.finance.net >= 0 ? EMERALD : RED} i={0} small />
        <KpiCard icon={TrendingDown} label="Expenses" value={money(data.finance.expenses)} accent={AMBER} i={1} small />
        <KpiCard icon={Percent} label="Net Margin" value={`${data.finance.netMargin}%`} accent={data.finance.netMargin >= 0 ? EMERALD : RED} i={2} small />
        <KpiCard icon={Coins} label="Revenue / Player" value={money(data.finance.revenuePerParticipant)} accent={INDIGO} i={3} small />
        <KpiCard icon={Coins} label="Cost / Player" value={money(data.finance.costPerParticipant)} accent={AMBER} i={4} small />
        <KpiCard icon={Target} label="Break-even" value={`${data.finance.breakEvenPct}%`} accent={data.finance.breakEvenPct >= 100 ? EMERALD : RED} i={5} small />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Registrations over time */}
        <Panel title="Registrations Over Time" subtitle="Are we growing? (last 12 months)" i={0}>
          {(data.byMonth ?? []).length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.byMonth}>
                <defs>
                  <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={INDIGO} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={INDIGO} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="count" name="Registrations" stroke={INDIGO} strokeWidth={2} fill="url(#gReg)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Revenue over time */}
        <Panel title="Revenue Over Time" subtitle="Expected vs collected, with expense break-even line" i={1}>
          {(data.revenueByMonth ?? []).length === 0 ? <Empty note="Set schedule prices to see revenue." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={revenueWithExpenses}>
                <defs>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={INDIGO} stopOpacity={0.2} /><stop offset="95%" stopColor={INDIGO} stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={EMERALD} stopOpacity={0.25} /><stop offset="95%" stopColor={EMERALD} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="expected" name="Expected" stroke={INDIGO} strokeWidth={2} fill="url(#gExp)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={EMERALD} strokeWidth={2} fill="url(#gCol)" />
                <Line type="monotone" dataKey="expenses" name="Expenses (break-even)" stroke={RED} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Cash flow — revenue vs expenses, clickable week/month/year */}
        <Panel title="Cash Flow" subtitle="Collected revenue vs expenses over time" i={2}>
          <div className="flex gap-1.5 mb-3">
            {(['week', 'month', 'year'] as const).map((g) => (
              <button key={g} onClick={() => setCashGrain(g)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border capitalize transition-colors ${cashGrain === g ? 'border-[rgb(var(--accent-500))] bg-[rgb(var(--accent-500))]/10 text-[rgb(var(--accent-600))]' : 'border-[rgb(var(--border-soft))]'}`}>
                {g === 'week' ? 'Weekly' : g === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          {(data.cashFlow?.[cashGrain] ?? []).length === 0 ? <Empty note="No cash-flow data for this range yet." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={data.cashFlow[cashGrain]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="period" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="collected" name="Revenue" stroke={EMERALD} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke={RED} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net" name="Net" stroke={INDIGO} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Registrations by schedule */}
        <Panel title="Registrations by Schedule" subtitle="Which events draw the most people?" i={4}>
          {(data.bySchedule ?? []).length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.bySchedule} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={SLATE} fontSize={10} tickLine={false} axisLine={false} width={90} />
                <RTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="registrations" name="Registrations" fill={INDIGO} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* By venue */}
        <Panel title="Registrations by Venue" subtitle="Which venues host the most players?" i={11}>
          {(data.byVenue ?? []).length === 0 ? <Empty note="No venue data yet." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byVenue} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="venue" stroke={SLATE} fontSize={10} tickLine={false} axisLine={false} width={90} />
                <RTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="registrations" name="Registrations" fill={VIOLET} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Revenue by venue */}
        <Panel title="Revenue by Venue" subtitle="Collected revenue per venue" i={12}>
          {(data.byVenue ?? []).filter((v: any) => v.collected > 0).length === 0 ? <Empty note="No revenue by venue yet." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(data.byVenue ?? []).filter((v: any) => v.collected > 0)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="venue" stroke={SLATE} fontSize={10} tickLine={false} axisLine={false} width={90} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="collected" name="Collected" fill={EMERALD} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Per-schedule profitability */}
        <Panel title="Profit by Event" subtitle="Collected revenue minus each event's own expenses" i={13}>
          {(data.perSchedule ?? []).length === 0 ? <Empty note="No priced events yet." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.perSchedule} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke={SLATE} fontSize={10} tickLine={false} axisLine={false} width={90} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="net" name="Net" radius={[0, 4, 4, 0]}>
                  {(data.perSchedule ?? []).map((s: any, i: number) => <Cell key={i} fill={s.net >= 0 ? EMERALD : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* New vs returning (provisional) */}
        <Panel title="New vs Returning" subtitle="Player growth by month — estimate until identity is unified" i={14}>
          {(data.newVsReturning ?? []).length === 0 ? <Empty note="Not enough history yet." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.newVsReturning}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="month" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="newPlayers" name="New" stackId="p" fill={INDIGO} radius={[0, 0, 0, 0]} />
                <Bar dataKey="returningPlayers" name="Returning" stackId="p" fill={EMERALD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Fill rate by schedule */}
        {(data.bySchedule ?? []).some((s: any) => s.fillRate != null) && (
          <Panel title="Fill Rate by Schedule" subtitle="Registrations vs capacity (%)" i={15}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(data.bySchedule ?? []).filter((s: any) => s.fillRate != null)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="name" stroke={SLATE} fontSize={10} tickLine={false} axisLine={false} width={90} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="fillRate" name="Fill %" radius={[0, 4, 4, 0]}>
                  {(data.bySchedule ?? []).filter((s: any) => s.fillRate != null).map((s: any, i: number) => (
                    <Cell key={i} fill={s.fillRate >= 80 ? EMERALD : s.fillRate >= 50 ? AMBER : RED} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {/* Payment status */}
        <Panel title="Payment Status" subtitle="How much is still owed?" i={5}>
          {paymentData.length === 0 ? <Empty note="No priced registrations yet." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {paymentData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <RTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Outstanding aging */}
        <Panel title="Outstanding Aging" subtitle="How old is the unpaid balance?" i={9}>
          {agingTotal === 0 ? <Empty note="Nothing outstanding — all collected." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => money(Number(v))} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {agingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Expenses by category */}
        {expenseCatData.length > 0 && (
          <Panel title="Expenses by Category" subtitle="Where does the money go?" i={10}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {expenseCatData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <RTooltip contentStyle={tooltipStyle} formatter={(v: any) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {/* Registration types */}
        <Panel title="Registration Types" subtitle="How do people sign up?" i={6}>
          {typeData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {typeData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <RTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Position distribution */}
        <Panel title="Position Distribution" subtitle="Do we have balanced positions?" i={7}>
          {(data.byPosition ?? []).length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byPosition}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="position" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <RTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Players" radius={[4, 4, 0, 0]}>
                  {data.byPosition.map((p: any, i: number) => <Cell key={i} fill={POSITION_COLORS[p.position] ?? '#64748b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Community breakdown */}
        {(data.byCommunity ?? []).length > 0 && (
          <Panel title="Registrations by Community" subtitle="Which communities drive signups?" i={8}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byCommunity} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis type="number" stroke={SLATE} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={SLATE} fontSize={10} tickLine={false} axisLine={false} width={90} />
                <RTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="registrations" name="Registrations" radius={[0, 4, 4, 0]}>
                  {data.byCommunity.map((c: any, i: number) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        )}
      </div>
    </div>
  )
}

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border-soft))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--fg))',
}

// KPI card with the prototype's corner-accent + hover-lift polish, on our theme.
function KpiCard({ icon: Icon, label, value, accent, i, small, delta }: { icon: any; label: string; value: any; accent: string; i: number; small?: boolean; delta?: number | null }) {
  const showDelta = delta !== undefined
  const up = (delta ?? 0) >= 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] px-4 py-3 transition-shadow hover:shadow-md">
      <div className="absolute top-0 right-0 h-14 w-14 rounded-bl-full flex items-start justify-end p-2" style={{ background: `${accent}14` }}>
        <Icon size={14} style={{ color: accent }} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--muted-fg))] block">{label}</span>
      <span className={`${small ? 'text-xl' : 'text-3xl'} font-extrabold tracking-tight block mt-1`} style={{ color: accent }}>{value}</span>
      {showDelta && (
        <span className={`text-[10px] font-bold ${delta === null ? 'text-[rgb(var(--muted-fg))]' : up ? 'text-emerald-500' : 'text-red-500'}`}>
          {delta === null ? '— vs last 30d' : `${up ? '▲' : '▼'} ${Math.abs(delta)}% vs last 30d`}
        </span>
      )}
    </motion.div>
  )
}

function Panel({ title, subtitle, children, i }: { title: string; subtitle?: string; children: React.ReactNode; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.04 }}
      className="rounded-xl border border-[rgb(var(--border-soft))] bg-[rgb(var(--surface))] p-4 transition-shadow hover:shadow-md">
      <p className="font-bold text-sm">{title}</p>
      {subtitle && <p className="text-[11px] text-[rgb(var(--muted-fg))] mb-3">{subtitle}</p>}
      {children}
    </motion.div>
  )
}

function Empty({ note }: { note?: string }) {
  return <div className="h-[220px] flex items-center justify-center text-xs text-[rgb(var(--muted-fg))]">{note || 'No data yet.'}</div>
}
