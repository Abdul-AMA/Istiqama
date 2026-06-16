"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-background">
      <div className="text-6xl">📵</div>
      <h1 className="text-2xl font-bold text-foreground">لا يوجد اتصال بالإنترنت</h1>
      <p className="text-muted-foreground max-w-xs">
        لا يمكن تحميل الصفحة حالياً. تحقق من اتصالك وحاول مجدداً.
      </p>
      <p className="text-sm text-muted-foreground">
        البيانات المحفوظة محلياً ستُزامن تلقائياً عند عودة الاتصال.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
