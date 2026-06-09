'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const PRESETS = [
  { label: '📋 ขอใบเสนอราคา', text: 'ขอใบเสนอราคาสินค้าด้วยครับ' },
  { label: '🤔 กำลังพิจารณา',  text: 'กำลังพิจารณาสินค้าอยู่ครับ น่าสนใจดี' },
  { label: '💬 สอบถามทั่วไป',  text: 'สวัสดีครับ มีอะไรแนะนำไหม' },
]

const LEVEL = {
  high:   { badge: 'bg-green-900/50 text-green-300 border border-green-700/40',  dot: 'bg-green-400',  label: 'HIGH' },
  medium: { badge: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/40', dot: 'bg-yellow-400', label: 'MED' },
  low:    { badge: 'bg-red-900/50 text-red-300 border border-red-700/40',         dot: 'bg-red-400',    label: 'LOW' },
}

const ACTION = {
  tag:          { cls: 'text-green-400',  label: '✓ Tagged' },
  tag_with_flag:{ cls: 'text-yellow-400', label: '⚑ Flagged' },
  refuse:       { cls: 'text-red-400',    label: '✕ Refused' },
}

function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 self-end"
         style={{ background: 'linear-gradient(135deg,#06C755,#04a045)' }}>
      S
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end msg-enter">
      <div className="bubble-user px-4 py-2.5 max-w-[75%] shadow-lg shadow-green-900/20">
        <p className="text-white text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 msg-enter">
      <BotAvatar />
      <div className="bubble-bot px-4 py-3.5 flex gap-1.5 items-center">
        <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 block" />
        <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 block" />
        <span className="typing-dot w-2 h-2 rounded-full bg-gray-400 block" />
      </div>
    </div>
  )
}

function BotResultCard({ result }) {
  const cs     = result?.confidence_signal || {}
  const level  = cs.level || 'low'
  const tag    = result?.answer_summary?.tag || '—'
  const desc   = result?.answer_summary?.description || ''
  const action = result?.recommended_action || 'refuse'
  const section = result?.source_evidence?.section ? `§${result.source_evidence.section}` : ''
  const missing = result?.missing_information
  const score   = cs.weighted_final != null ? `${(cs.weighted_final * 100).toFixed(0)}%` : ''

  const lv  = LEVEL[level]  || LEVEL.low
  const act = ACTION[action] || ACTION.refuse

  return (
    <div className="flex items-end gap-2 msg-enter">
      <BotAvatar />
      <div className="bubble-bot px-4 py-3.5 max-w-[82%] space-y-2.5 shadow-lg shadow-black/30">

        {/* Confidence + action row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${lv.badge}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${lv.dot} mr-1.5 align-middle`} />
            {lv.label} {score}
          </span>
          <span className={`text-xs font-semibold ${act.cls}`}>{act.label}</span>
        </div>

        {/* Tag */}
        <div>
          <div className="text-white font-bold text-[15px] leading-tight">{tag}</div>
          {section && (
            <div className="text-gray-500 text-xs mt-0.5">Corporate Tagging Rulebook {section}</div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-300 text-xs leading-relaxed">{desc}</p>

        {/* Missing info warning */}
        {missing && (
          <div className="rounded-xl px-3 py-2 text-yellow-300 text-xs leading-relaxed"
               style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}>
            ⚠ {missing}
          </div>
        )}

        {/* Score bar */}
        <div className="pt-1 border-t border-white/5 space-y-1.5">
          <ScoreBar label="Vector" value={cs.vector_similarity || 0} color="#06C755" />
          <ScoreBar label="LLM"    value={cs.llm_self_score    || 0} color="#3b82f6" />
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, color }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 text-xs w-10 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
             style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
      </div>
      <span className="text-gray-500 text-xs w-7 text-right">{pct}%</span>
    </div>
  )
}

function ErrorBubble() {
  return (
    <div className="flex items-end gap-2 msg-enter">
      <div className="w-8 h-8 rounded-full bg-red-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">!</div>
      <div className="bubble-bot px-4 py-2.5">
        <p className="text-red-400 text-sm">เกิดข้อผิดพลาด กรุณาลองใหม่</p>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages,    setMessages]    = useState([{ id: 'welcome', type: 'welcome' }])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [status,      setStatus]      = useState('กำลังเชื่อมต่อ...')
  const [showPresets, setShowPresets] = useState(true)
  const chatRef  = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setStatus(d.mock ? 'Mock Mode • Online' : 'Online'))
      .catch(() => setStatus('Offline'))
  }, [])

  const send = useCallback(async (text) => {
    if (!text.trim() || loading) return
    setInput('')
    setShowPresets(false)

    const typingId = `typing-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, type: 'user', text },
      { id: typingId, type: 'typing' },
    ])
    setLoading(true)

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [{
            type: 'message',
            message: { type: 'text', id: String(Date.now()), text },
            source: { type: 'user', userId: 'Udemo' + Math.random().toString(36).slice(2, 6) },
            replyToken: 'mock-reply-token',
            timestamp: Date.now(),
          }],
        }),
      })
      const data = await res.json()
      const result = data.results?.[0]

      setMessages(prev => prev
        .filter(m => m.id !== typingId)
        .concat({ id: `bot-${Date.now()}`, type: 'bot', result }))
    } catch {
      setMessages(prev => prev
        .filter(m => m.id !== typingId)
        .concat({ id: `err-${Date.now()}`, type: 'error' }))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  function clearChat() {
    setMessages([{ id: 'welcome', type: 'welcome' }])
    setShowPresets(true)
    setInput('')
    inputRef.current?.focus()
  }

  function renderMsg(msg) {
    switch (msg.type) {
      case 'welcome':
        return (
          <div key={msg.id} className="flex items-end gap-2 msg-enter">
            <BotAvatar />
            <div className="bubble-bot px-4 py-3 max-w-[78%]">
              <p className="text-gray-100 text-sm leading-relaxed">สวัสดีครับ! ผมคือ smileChatBot 🤖</p>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">ส่งข้อความเพื่อทดสอบระบบ AI Intent Tagging ลองพิมพ์หรือเลือก quick reply ด้านล่าง</p>
            </div>
          </div>
        )
      case 'user':    return <UserBubble    key={msg.id} text={msg.text} />
      case 'bot':     return <BotResultCard key={msg.id} result={msg.result} />
      case 'typing':  return <TypingBubble  key={msg.id} />
      case 'error':   return <ErrorBubble   key={msg.id} />
      default:        return null
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4"
         style={{ background: 'linear-gradient(135deg,#0f0f1a 0%,#1a1a2e 60%,#1a2040 100%)' }}>

      <div className="w-full max-w-sm flex flex-col rounded-3xl overflow-hidden"
           style={{
             height: 'min(720px, calc(100vh - 2rem))',
             boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 0 80px rgba(6,199,85,0.08), 0 30px 60px rgba(0,0,0,0.6)',
           }}>

        {/* ── Header ── */}
        <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
             style={{ background: 'linear-gradient(90deg,#06C755,#05b34c)', backdropFilter: 'blur(12px)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
               style={{ background: 'rgba(255,255,255,0.18)' }}>S</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm">smileChatBot</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>{status}</div>
          </div>
          <button onClick={clearChat} title="Clear chat"
                  className="p-1.5 rounded-full transition-colors hover:bg-white/15"
                  style={{ color: 'rgba(255,255,255,0.7)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5" width={18} height={18}
                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>

        {/* ── Chat Area ── */}
        <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
             style={{ background: '#1a1c2a' }}>
          {messages.map(renderMsg)}

          {showPresets && (
            <div className="flex flex-wrap gap-2 pl-10 msg-enter">
              {PRESETS.map(p => (
                <button key={p.text} onClick={() => send(p.text)}
                        className="text-xs px-3 py-1.5 rounded-full transition-all active:scale-95"
                        style={{
                          background: 'rgba(6,199,85,0.1)',
                          border: '1px solid rgba(6,199,85,0.3)',
                          color: '#06C755',
                        }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Input Bar ── */}
        <div className="px-3 py-3 flex items-center gap-2 flex-shrink-0"
             style={{ background: '#1e2130', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="พิมพ์ข้อความ..."
            disabled={loading}
            autoFocus
            className="flex-1 rounded-full px-4 py-2.5 text-sm focus:outline-none transition-all disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: '#f1f1f1',
              caretColor: '#06C755',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg,#06C755,#05b34c)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
