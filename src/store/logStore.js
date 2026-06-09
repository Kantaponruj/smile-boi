// In-memory fallback for local dev; Vercel KV when KV_REST_API_URL is set
let memStore = []

async function getKV() {
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

async function appendLog(entry) {
  const kv = process.env.KV_REST_API_URL ? await getKV() : null
  if (kv) {
    await kv.lpush('tagging_logs', entry)
    await kv.ltrim('tagging_logs', 0, 199)
  } else {
    memStore.unshift(entry)
    if (memStore.length > 200) memStore = memStore.slice(0, 200)
  }
}

async function getLogs(limit = 100) {
  const kv = process.env.KV_REST_API_URL ? await getKV() : null
  if (kv) {
    return kv.lrange('tagging_logs', 0, limit - 1)
  }
  return memStore.slice(0, limit)
}

async function clearLogs() {
  const kv = process.env.KV_REST_API_URL ? await getKV() : null
  if (kv) {
    await kv.del('tagging_logs')
  } else {
    memStore = []
  }
}

module.exports = { appendLog, getLogs, clearLogs }
