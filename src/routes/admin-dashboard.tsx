import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getExecutiveDashboard } from '@/server/dashboard.functions'
import { Users, CalendarDays, UserCheck, TrendingUp, Wallet, AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <KpiCard icon={Users} label="Total Registrations" value={num(data.counts.totalRegistrations)} accent={INDIGO} i={0} />
        <KpiCard icon={UserCheck} label="Unique Participants" value={num(data.counts.uniqueParticipants)} accent={VIOLET} i={1} />
        <KpiCard icon={CalendarDays} label="Active Schedules" value={num(data.counts.activeSchedules)} accent={EMERALD} i={2} />
      </div>

      {/* Finance headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard icon={Wallet} label="Expected" value={money(data.finance.expected)} accent={INDIGO} i={0} small />
        <KpiCard icon={Wallet} label="Collected" value={money(data.finance.collected)} accent={EMERALD} i={1} small />
        <KpiCard icon={AlertCircle} label="Outstanding" value={money(data.finance.outstanding)} accent={RED} i={2} small />
        <KpiCard icon={TrendingUp} label="Collection Rate" value={`${data.finance.collectionRate}%`} accent={INDIGO} i={3} small />
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
        <Panel title="Revenue Over Time" subtitle="Expected vs collected by month" i={1}>
          {(data.revenueByMonth ?? []).length === 0 ? <Empty note="Set schedule prices to see revenue." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.revenueByMonth}>
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
                <RTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="expected" name="Expected" stroke={INDIGO} strokeWidth={2} fill="url(#gExp)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={EMERALD} strokeWidth={2} fill="url(#gCol)" />
              </AreaChart>
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
function KpiCard({ icon: Icon, label, value, accent, i, small }: { icon: any; label: string; value: any; accent: string; i: number; small?: boolean }) {
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
