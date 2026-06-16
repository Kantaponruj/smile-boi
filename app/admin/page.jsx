'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const LEVEL = {
  high:   { cls: 'text-emerald-500',  label: 'HIGH' },
  medium: { cls: 'text-amber-500',    label: 'MED' },
  low:    { cls: 'text-rose-500',     label: 'LOW' },
}

const ACTION = {
  tag:           { cls: 'text-zinc-500',    label: 'tagged' },
  tag_with_flag: { cls: 'text-amber-600',   label: 'flagged' },
  refuse:        { cls: 'text-rose-600',    label: 'refused' },
}

function LogRow({ log, index }) {
  const [expanded, setExpanded] = useState(false)
  const lv  = LEVEL[log.level]  || LEVEL.low
  const act = ACTION[log.action] || ACTION.refuse
  const score = log.score != null ? `${(log.score * 100).toFixed(0)}%` : '—'
  const dt   = log.timestamp ? new Date(log.timestamp) : null
  const time = dt ? dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'
  const date = dt ? dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) : ''

  return (
    <>
      <tr
        onClick={() => setExpanded(v => !v)}
        className="group cursor-pointer border-b border-white/[0.04] transition-colors duration-75 hover:bg-white/[0.02]"
      >
        <td className="pl-6 pr-2 py-3.5 text-zinc-700 text-[11px] font-mono tabular-nums w-10">
          {String(index + 1).padStart(2, '0')}
        </td>
        <td className="px-3 py-3.5 w-14">
          <span className={`text-[11px] font-mono font-semibold tracking-wide ${lv.cls}`}>
            {lv.label}
          </span>
        </td>
        <td className="px-3 py-3.5 text-zinc-200 text-sm">{log.tag || '—'}</td>
        <td className="px-3 py-3.5 w-20">
          <span className={`text-[11px] ${act.cls}`}>{act.label}</span>
        </td>
        <td className="px-3 py-3.5 w-16">
          <span className="text-zinc-500 text-[11px] font-mono tabular-nums">{score}</span>
        </td>
        <td className="px-3 py-3.5 max-w-[200px]">
          <span className="text-zinc-600 text-xs truncate block">{log.message || '—'}</span>
        </td>
        <td className="px-3 pr-6 py-3.5 text-right w-24">
          <div className="text-zinc-700 text-[11px] font-mono tabular-nums leading-snug">
            <div>{date}</div>
            <div>{time}</div>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/[0.04]">
          <td colSpan={7} className="pl-[72px] pr-6 pb-5 pt-0">
            <div className="pt-3 space-y-2 text-xs border-t border-white/[0.04]">
              <div className="text-zinc-700 font-mono text-[11px]">{log.case_id}</div>
              {log.description && (
                <p className="text-zinc-400 leading-relaxed max-w-2xl">{log.description}</p>
              )}
              {log.missing_information && (
                <p className="text-amber-600/70 leading-relaxed">{log.missing_information}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AdminPage() {
  const [logs,        setLogs]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [filter,      setFilter]      = useState('all')
  const [clearing,    setClearing]    = useState(false)

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

  const FILTERS = [
    { key: 'all',    label: 'ทั้งหมด', count: stats.total  },
    { key: 'high',   label: 'HIGH',    count: stats.high   },
    { key: 'medium', label: 'MED',     count: stats.medium },
    { key: 'low',    label: 'LOW',     count: stats.low    },
  ]

  return (
    <div
      className="min-h-screen py-10 px-6"
      style={{ background: '#0c0c0e', fontFamily: "'Figtree', 'Noto Sans Thai', sans-serif" }}
    >
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-end justify-between pb-7 border-b border-white/[0.05]">
          <div className="space-y-1.5">
            <div className="text-zinc-700 text-[11px] font-mono tracking-[0.18em] uppercase">
              smileBOI · admin
            </div>
            <h1 className="text-zinc-100 text-xl font-semibold tracking-tight">Tagging Log</h1>
          </div>

          <div className="flex items-center gap-1.5">
            {lastRefresh && (
              <span className="text-zinc-700 text-[11px] font-mono mr-2">
                {lastRefresh.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchLogs}
              title="Refresh"
              className="h-7 w-7 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 transition-colors text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              ↻
            </button>
            <button
              onClick={clearAll}
              disabled={clearing}
              className="h-7 px-3 rounded text-[11px] text-rose-700 hover:text-rose-400 transition-colors disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {clearing ? '...' : 'ล้าง log'}
            </button>
            <Link
              href="/"
              className="h-7 px-3 rounded text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors inline-flex items-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              Chat Demo →
            </Link>
          </div>
        </div>

        {/* Stats — inline, no cards */}
        <div className="flex items-center gap-2 text-sm font-mono tabular-nums">
          <span className="text-zinc-200 font-semibold">{stats.total}</span>
          <span className="text-zinc-700 text-xs ml-0.5">total</span>
          <span className="text-zinc-800 mx-2">·</span>
          <span className="text-emerald-500 font-semibold">{stats.high}</span>
          <span className="text-zinc-700 text-xs ml-0.5">high</span>
          <span className="text-zinc-800 mx-1">·</span>
          <span className="text-amber-500 font-semibold">{stats.medium}</span>
          <span className="text-zinc-700 text-xs ml-0.5">med</span>
          <span className="text-zinc-800 mx-1">·</span>
          <span className="text-rose-500 font-semibold">{stats.low}</span>
          <span className="text-zinc-700 text-xs ml-0.5">low</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {FILTERS.map(f => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="h-7 px-3 rounded text-[11px] transition-all duration-75"
                style={{
                  background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                  border:     active ? '1px solid rgba(255,255,255,0.10)' : '1px solid transparent',
                  color:      active ? '#e4e4e2' : '#52524e',
                }}
              >
                {f.label}
                <span
                  className="ml-1.5"
                  style={{ color: active ? '#71717a' : '#3f3f46' }}
                >
                  {f.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', overflow: 'hidden' }}>
          {loading ? (
            <div className="py-20 text-center text-zinc-800 text-[11px] font-mono tracking-[0.2em]">
              LOADING…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <div className="text-zinc-700 text-xs">ยังไม่มี log</div>
              <div className="text-zinc-800 text-[11px]">ลองส่งข้อความใน Chat Demo</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th className="pl-6 pr-2 py-3 text-left text-zinc-700 text-[10px] font-mono uppercase tracking-widest w-10">#</th>
                    <th className="px-3 py-3 text-left text-zinc-700 text-[10px] uppercase tracking-widest w-14">Lvl</th>
                    <th className="px-3 py-3 text-left text-zinc-700 text-[10px] uppercase tracking-widest">Tag</th>
                    <th className="px-3 py-3 text-left text-zinc-700 text-[10px] uppercase tracking-widest w-20">Action</th>
                    <th className="px-3 py-3 text-left text-zinc-700 text-[10px] uppercase tracking-widest w-16">Score</th>
                    <th className="px-3 py-3 text-left text-zinc-700 text-[10px] uppercase tracking-widest">Message</th>
                    <th className="px-3 pr-6 py-3 text-right text-zinc-700 text-[10px] uppercase tracking-widest w-24">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => <LogRow key={i} log={log} index={i} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
