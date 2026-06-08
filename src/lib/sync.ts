import { db, type PendingOp } from "./db"

async function processOp(op: PendingOp): Promise<boolean> {
  const endpoint =
    op.type === "CREATE_GUEST_STUDENT"
      ? "/api/sync/guest-student"
      : "/api/sync/daily-session"

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: op.payload }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()

    // If a guest student was just created, update any queued sessions referencing the temp local ID
    if (op.type === "CREATE_GUEST_STUDENT" && data.studentId) {
      const localId = (op.payload as { localId: string }).localId
      if (localId) {
        const sessions = await db.pendingOps.where("type").equals("SAVE_DAILY_SESSION").toArray()
        for (const session of sessions) {
          const payload = session.payload as { entries: Array<{ studentId: string }> }
          let changed = false
          const updatedEntries = payload.entries.map((entry) => {
            if (entry.studentId === localId) {
              changed = true
              return { ...entry, studentId: data.studentId }
            }
            return entry
          })
          if (changed) {
            await db.pendingOps.update(session.id!, {
              payload: { ...payload, entries: updatedEntries },
            })
          }
        }
      }
    }

    await db.pendingOps.delete(op.id!)
    return true
  } catch {
    const retries = op.retries + 1
    await db.pendingOps.update(op.id!, {
      retries,
      status: retries >= 3 ? "FAILED" : "PENDING",
    })
    return false
  }
}

export async function drainQueue(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine) return

  const ops = await db.pendingOps.where("status").equals("PENDING").toArray()

  // CREATE_GUEST_STUDENT always before SAVE_DAILY_SESSION, then by createdAt
  ops.sort((a, b) => {
    if (a.type === b.type) return a.createdAt - b.createdAt
    return a.type === "CREATE_GUEST_STUDENT" ? -1 : 1
  })

  for (const op of ops) {
    if (!navigator.onLine) break
    await db.pendingOps.update(op.id!, { status: "SYNCING" })
    const ok = await processOp(op)
    if (!ok) {
      const current = await db.pendingOps.get(op.id!)
      if (current?.status === "SYNCING") {
        await db.pendingOps.update(op.id!, { status: "PENDING" })
      }
    }
  }
}

export async function retryFailed(): Promise<void> {
  await db.pendingOps
    .where("status")
    .equals("FAILED")
    .modify({ status: "PENDING", retries: 0 })
  await drainQueue()
}
