import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getExecutiveDashboard } from '@/server/dashboard.functions'
import { Users, CalendarDays, UserCheck, TrendingUp, Wallet, AlertCircle } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend,
)

export const Route = createFileRoute('/admin-dashboard')({
  component: DashboardPage,
})

const POSITION_COLORS: Record<string, string> = {
  OS: '#3b82f6', OPP: '#ef4444', MB: '#22c55e', S: '#f59e0b', L: '#a855f7',
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

  const monthLabels = data.byMonth.map((m: any) => m.month)
  const chartFont = { family: 'inherit' }
  const gridColor = 'rgba(128,128,128,0.12)'
  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: gridColor }, ticks: { font: chartFont } },
      y: { grid: { color: gridColor }, ticks: { font: chartFont }, beginAtZero: true },
    },
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={22} />
        <h1 className="text-2xl font-bold">Executive Dashboard</h1>
      </div>
      <p className="text-sm text-[rgb(var(--muted-fg))] mb-6">Club performance at a glance — participation, finance, and operations.</p>

      {/* Headline counts */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard icon={Users} label="Total Registrations" value={data.counts.totalRegistrations} />
        <StatCard icon={UserCheck} label="Unique Participants" value={data.counts.uniqueParticipants} />
        <StatCard icon={CalendarDays} label="Active Schedules" value={data.counts.activeSchedules} />
      </div>

      {/* Finance headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard icon={Wallet} label="Expected Revenue" value={money(data.finance.expected)} />
        <StatCard icon={Wallet} label="Collected" value={money(data.finance.collected)} tone="green" />
        <StatCard icon={AlertCircle} label="Outstanding" value={money(data.finance.outstanding)} tone="red" />
        <StatCard icon={TrendingUp} label="Collection Rate" value={`${data.finance.collectionRate}%`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Registrations over time */}
        <Panel title="Registrations Over Time" subtitle="Are we growing? (last 12 months)">
          {data.byMonth.length === 0 ? <Empty /> : (
            <div className="h-56">
              <Line data={{
                labels: monthLabels,
                datasets: [{
                  data: data.byMonth.map((m: any) => m.count),
                  borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)',
                  fill: true, tension: 0.3,
                }],
              }} options={baseOpts as any} />
            </div>
          )}
        </Panel>

        {/* Revenue over time */}
        <Panel title="Revenue Over Time" subtitle="Expected vs collected by month">
          {data.revenueByMonth.length === 0 ? <Empty note="Set schedule prices to see revenue." /> : (
            <div className="h-56">
              <Bar data={{
                labels: data.revenueByMonth.map((m: any) => m.month),
                datasets: [
                  { label: 'Expected', data: data.revenueByMonth.map((m: any) => m.expected), backgroundColor: 'rgba(59,130,246,0.5)' },
                  { label: 'Collected', data: data.revenueByMonth.map((m: any) => m.collected), backgroundColor: '#22c55e' },
                ],
              }} options={{ ...baseOpts, plugins: { legend: { display: true, position: 'bottom' } } } as any} />
            </div>
          )}
        </Panel>

        {/* Registrations per schedule + fill */}
        <Panel title="Registrations by Schedule" subtitle="Which events draw the most people?">
          {data.bySchedule.length === 0 ? <Empty /> : (
            <div className="h-56">
              <Bar data={{
                labels: data.bySchedule.map((s: any) => s.name),
                datasets: [{ data: data.bySchedule.map((s: any) => s.registrations), backgroundColor: '#3b82f6' }],
              }} options={{ ...baseOpts, indexAxis: 'y' } as any} />
            </div>
          )}
        </Panel>

        {/* Payment status breakdown */}
        <Panel title="Payment Status" subtitle="How much is still owed?">
          {(data.finance.paidCount + data.finance.partialCount + data.finance.unpaidCount) === 0 ? <Empty note="No priced registrations yet." /> : (
            <div className="h-56 flex items-center justify-center">
              <Doughnut data={{
                labels: ['Paid', 'Partial', 'Unpaid'],
                datasets: [{
                  data: [data.finance.paidCount, data.finance.partialCount, data.finance.unpaidCount],
                  backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                }],
              }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } as any} />
            </div>
          )}
        </Panel>

        {/* Registration type mix */}
        <Panel title="Registration Types" subtitle="How do people sign up?">
          {data.byType.length === 0 ? <Empty /> : (
            <div className="h-56 flex items-center justify-center">
              <Doughnut data={{
                labels: data.byType.map((t: any) => t.type),
                datasets: [{ data: data.byType.map((t: any) => t.count), backgroundColor: ['#3b82f6', '#a855f7', '#f59e0b'] }],
              }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } as any} />
            </div>
          )}
        </Panel>

        {/* Position distribution */}
        <Panel title="Position Distribution" subtitle="Do we have balanced positions?">
          {data.byPosition.length === 0 ? <Empty /> : (
            <div className="h-56">
              <Bar data={{
                labels: data.byPosition.map((p: any) => p.position),
                datasets: [{
                  data: data.byPosition.map((p: any) => p.count),
                  backgroundColor: data.byPosition.map((p: any) => POSITION_COLORS[p.position] ?? '#64748b'),
                }],
              }} options={baseOpts as any} />
            </div>
          )}
        </Panel>

        {/* Community breakdown */}
        {data.byCommunity.length > 0 && (
          <Panel title="Registrations by Community" subtitle="Which communities drive signups?">
            <div className="h-56">
              <Bar data={{
                labels: data.byCommunity.map((c: any) => c.name),
                datasets: [{
                  data: data.byCommunity.map((c: any) => c.registrations),
                  backgroundColor: data.byCommunity.map((c: any) => c.color),
                }],
              }} options={{ ...baseOpts, indexAxis: 'y' } as any} />
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone?: 'green' | 'red' }) {
  const toneClass = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : ''
  return (
    <div className="rounded-xl border border-[rgb(var(--border-soft))] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[rgb(var(--muted-fg))] mb-1">
        <Icon size={13} /><span className="text-[11px] uppercase font-bold">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--border-soft))] p-4">
      <p className="font-bold text-sm">{title}</p>
      {subtitle && <p className="text-[11px] text-[rgb(var(--muted-fg))] mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}

function Empty({ note }: { note?: string }) {
  return <div className="h-56 flex items-center justify-center text-xs text-[rgb(var(--muted-fg))]">{note || 'No data yet.'}</div>
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}
