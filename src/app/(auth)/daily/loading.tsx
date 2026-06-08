import { Skeleton } from "@/components/ui/skeleton"

export default function DailyLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  )
}
