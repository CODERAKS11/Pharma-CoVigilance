import { useState } from 'react';
import '../../styles/dashboard.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { Activity, Clock, Copy, GitCompare, Pill } from 'lucide-react';
import { StatCard } from '../../components/ui/StatCard';
import { mockDashboardStats } from '../../api/mockData';

const SEVERITY_COLORS: Record<string, string> = {
  Definite: '#8C2F2A',
  Probable: '#B8641E',
  Possible: '#A88A1A',
  Doubtful: '#5C6470',
};

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const stats = mockDashboardStats;

  const volumeData = dateRange === '7d'
    ? stats.volumeOverTime.slice(-7)
    : dateRange === '90d'
    ? stats.volumeOverTime
    : stats.volumeOverTime;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Analytics Dashboard</h2>
        <p>Pharmacovigilance processing metrics and signal overview</p>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        <StatCard
          label="Cases Processed"
          value={stats.casesProcessed.toLocaleString()}
          icon={<Activity size={20} />}
          trend="up"
          trendLabel="+12.3% from last month"
          accentColor="var(--teal)"
        />
        <StatCard
          label="Avg. Time to Review"
          value={stats.avgTimeToReview}
          icon={<Clock size={20} />}
          trend="down"
          trendLabel="-18% from last month"
          accentColor="var(--severity-probable)"
        />
        <StatCard
          label="Duplicate Detection Rate"
          value={`${stats.duplicateRate}%`}
          subtitle={`Precision ${stats.duplicatePrecision}% · Recall ${stats.duplicateRecall}%`}
          icon={<Copy size={20} />}
          trend="up"
          trendLabel="+2.1% precision"
          accentColor="var(--indigo)"
        />
        <StatCard
          label="Naranjo Agreement"
          value={`${stats.naranjoAgreementRate}%`}
          subtitle="AI vs. Reviewer agreement"
          icon={<GitCompare size={20} />}
          trend="up"
          trendLabel="+1.8% from last month"
          accentColor="var(--confirmed-green)"
        />
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }}>
        {/* Top Drugs Bar Chart */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Pill size={15} /> Top Reported Drugs
            </h3>
          </div>
          <div className="card-body" style={{ padding: '16px 12px' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.topDrugs} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--ink-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink)' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--ink)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#fff',
                  }}
                />
                <Bar dataKey="count" fill="var(--teal)" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
            {/* SR-only data table */}
            <table className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
              <caption>Top Reported Drugs</caption>
              <thead><tr><th>Drug</th><th>Count</th></tr></thead>
              <tbody>
                {stats.topDrugs.map(d => <tr key={d.name}><td>{d.name}</td><td>{d.count}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Severity Distribution Donut */}
        <div className="card">
          <div className="card-header">
            <h3>Causality Distribution</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={stats.severityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="category"
                  label={(props: any) => `${props.category} ${(props.percent * 100).toFixed(0)}%`}
                  labelLine={false}
                  fontSize={11}
                >
                  {stats.severityDistribution.map(entry => (
                    <Cell key={entry.category} fill={SEVERITY_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--ink)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <table className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
              <caption>Causality Distribution</caption>
              <thead><tr><th>Category</th><th>Count</th></tr></thead>
              <tbody>
                {stats.severityDistribution.map(d => <tr key={d.category}><td>{d.category}</td><td>{d.count}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Volume Over Time */}
      <div className="card">
        <div className="card-header">
          <h3>Case Volume Over Time</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                className={`btn btn-sm ${dateRange === range ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDateRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body" style={{ padding: '16px 12px' }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volumeData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--teal)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--ink-tertiary)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--ink-tertiary)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--ink)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#fff',
                }}
                labelFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              />
              <Area type="monotone" dataKey="count" stroke="var(--teal)" fill="url(#tealGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
