import Dexie, { type Table } from "dexie"

export type OpType = "SAVE_DAILY_SESSION" | "CREATE_GUEST_STUDENT"
export type OpStatus = "PENDING" | "SYNCING" | "FAILED"

export interface PendingOp {
  id?: number
  type: OpType
  payload: unknown
  createdAt: number
  status: OpStatus
  retries: number
}

export interface CachedData {
  key: string
  value: unknown
  updatedAt: number
}

class IstiqamaDB extends Dexie {
  pendingOps!: Table<PendingOp>
  cachedData!: Table<CachedData>

  constructor() {
    super("istiqama")
    this.version(1).stores({
      pendingOps: "++id, type, status, createdAt",
      cachedData: "key",
    })
  }
}

export const db = new IstiqamaDB()
