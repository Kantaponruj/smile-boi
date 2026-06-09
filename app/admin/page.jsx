'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const LEVEL = {
  high:   { badge: 'bg-green-900/50 text-green-300 border border-green-800/50',   dot: 'bg-green-400',  label: 'HIGH' },
  medium: { badge: 'bg-yellow-900/50 text-yellow-300 border border-yellow-800/50', dot: 'bg-yellow-400', label: 'MED' },
  low:    { badge: 'bg-red-900/50 text-red-300 border border-red-800/50',          dot: 'bg-red-400',    label: 'LOW' },
}

const ACTION = {
  tag:           { cls: 'text-green-400',  label: '✓ Tagged' },
  tag_with_flag: { cls: 'text-yellow-400', label: '⚑ Flagged' },
  refuse:        { cls: 'text-red-400',    label: '✕ Refused' },
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1" style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.05)' }}>
      <span className="text-gray-500 text-xs uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false)
  const lv  = LEVEL[log.level]  || LEVEL.low
  const act = ACTION[log.action] || ACTION.refuse
  const score = log.score != null ? `${(log.score * 100).toFixed(0)}%` : '—'
  const time  = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('th-TH') : '—'
  const date  = log.timestamp ? new Date(log.timestamp).toLocaleDateString('th-TH') : ''

  return (
    <>
      <tr
        onClick={() => setExpanded(v => !v)}
        className="border-b border-white/5 cursor-pointer transition-colors hover:bg-white/3"
      >
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-bold ${lv.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lv.dot}`} />
            {lv.label}
          </span>
        </td>
        <td className="px-4 py-3 text-white text-sm font-medium">{log.tag || '—'}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold ${act.cls}`}>{act.label}</span>
        </td>
        <td className="px-4 py-3 text-gray-400 text-sm font-mono">{score}</td>
        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[160px]">{log.message}</td>
        <td className="px-4 py-3 text-gray-600 text-xs">
          <div>{date}</div>
          <div>{time}</div>
        </td>
        <td className="px-4 py-3 text-gray-700 text-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/5">
          <td colSpan={7} className="px-4 pb-4">
            <div className="rounded-xl p-4 space-y-2 text-xs" style={{ background: '#161824', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex gap-4 text-gray-400">
                <span><span className="text-gray-600">Case ID:</span> {log.case_id}</span>
              </div>
              {log.description && (
                <p className="text-gray-300 leading-relaxed">{log.description}</p>
              )}
              {log.missing_information && (
                <div className="rounded-lg px-3 py-2 text-yellow-300" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)' }}>
                  ⚠ {log.missing_information}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminPage() {
  const [logs,         setLogs]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastRefresh,  setLastRefresh]  = useState(null)
  const [filter,       setFilter]       = useState('all')
  const [clearing,     setClearing]     = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const r = await fetch('/api/admin')
      const d = await r.json()
      setLogs(d.logs || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    const t = setInterval(fetchLogs, 10000)
    return () => clearInterval(t)
  }, [fetchLogs])

  async function clearAll() {
    if (!confirm('ล้าง log ทั้งหมดใช่ไหม?')) return
    setClearing(true)
    await fetch('/api/admin', { method: 'DELETE' })
    await fetchLogs()
    setClearing(false)
  }

  const stats = {
    total:  logs.length,
    high:   logs.filter(l => l.level === 'high').length,
    medium: logs.filter(l => l.level === 'medium').length,
    low:    logs.filter(l => l.level === 'low').length,
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter)

  return (
    <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 60%,#1a2040 100%)', fontFamily: "'Noto Sans Thai', sans-serif" }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">smileChatBot — Tagging Log</p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-gray-600 text-xs">อัปเดต {lastRefresh.toLocaleTimeString('th-TH')}</span>
            )}
            <button onClick={fetchLogs}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors text-gray-300 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              ↻ Refresh
            </button>
            <button onClick={clearAll} disabled={clearing}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {clearing ? 'กำลังล้าง...' : 'ล้าง Log'}
            </button>
            <Link href="/"
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors text-gray-300 hover:text-white"
                  style={{ background: 'rgba(6,199,85,0.1)', border: '1px solid rgba(6,199,85,0.2)', color: '#06C755' }}>
              Chat Demo →
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="ทั้งหมด"  value={stats.total}  color="text-white" />
          <StatCard label="HIGH"     value={stats.high}   color="text-green-400" />
          <StatCard label="MEDIUM"   value={stats.medium} color="text-yellow-400" />
          <StatCard label="LOW"      value={stats.low}    color="text-red-400" />
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {['all','high','medium','low'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all capitalize"
                    style={{
                      background: filter === f ? 'rgba(6,199,85,0.15)' : 'rgba(255,255,255,0.04)',
                      border: filter === f ? '1px solid rgba(6,199,85,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      color: filter === f ? '#06C755' : '#9ca3af',
                    }}>
              {f === 'all' ? 'ทั้งหมด' : f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.05)' }}>
          {loading ? (
            <div className="p-12 text-center text-gray-600 text-sm">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-600 text-sm">ยังไม่มี log — ลองส่งข้อความใน Chat Demo</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['ระดับ', 'Tag', 'Action', 'Score', 'ข้อความ', 'เวลา', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => <LogRow key={i} log={log} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
