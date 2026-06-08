"use client"

import { useState, useActionState } from "react"
import { createCategory, updateCategory, toggleCategoryActive } from "@/lib/actions/message-categories.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Pencil, PowerOff, Power } from "lucide-react"
import { toast } from "sonner"

type Category = {
  id: string
  name: string
  tone: "NEUTRAL" | "POSITIVE" | "WARNING"
  template: string
  sortOrder: number
  isActive: boolean
}

const TONE_LABELS: Record<string, string> = {
  NEUTRAL: "محايد",
  POSITIVE: "إيجابي",
  WARNING: "تحذيري",
}
const TONE_COLORS: Record<string, string> = {
  NEUTRAL: "secondary",
  POSITIVE: "default",
  WARNING: "destructive",
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: Category
  onDone: () => void
}) {
  const action = category
    ? updateCategory.bind(null, category.id)
    : createCategory

  const [state, formAction, pending] = useActionState(action, { error: undefined, success: false })
  const [tone, setTone] = useState(category?.tone ?? "NEUTRAL")
  const [isActive, setIsActive] = useState(category?.isActive ?? true)

  if (state.success) {
    toast.success(category ? "تم التعديل" : "تم الإنشاء")
    onDone()
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="isActive" value={String(isActive)} />
      <div className="space-y-1">
        <Label htmlFor="name">الاسم</Label>
        <Input id="name" name="name" defaultValue={category?.name} required />
      </div>
      <div className="space-y-1">
        <Label>النبرة</Label>
        <input type="hidden" name="tone" value={tone} />
        <Select value={tone} onValueChange={(v) => { if (v != null) setTone(v as typeof tone) }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NEUTRAL">محايد</SelectItem>
            <SelectItem value="POSITIVE">إيجابي</SelectItem>
            <SelectItem value="WARNING">تحذيري</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="sortOrder">الترتيب</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          defaultValue={category?.sortOrder ?? 0}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="template">القالب</Label>
        <Textarea
          id="template"
          name="template"
          defaultValue={category?.template}
          rows={6}
          className="font-arabic text-sm"
          required
        />
        <p className="text-xs text-muted-foreground">
          المتغيرات المتاحة: {"{student_name}"} {"{guardian_name}"} {"{class_name}"} {"{teacher_name}"} {"{date}"} {"{today_sabaq}"} {"{today_revision}"} {"{rating}"} {"{mistakes}"} {"{attendance_status}"} {"{total_memorized}"}
        </p>
      </div>
      {category && (
        <div className="flex items-center gap-2">
          <input type="hidden" name="isActive" value={String(isActive)} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? "تعطيل" : "تفعيل"}
          </Button>
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الحفظ…" : "حفظ"}
        </Button>
      </div>
    </form>
  )
}

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  async function handleToggle(cat: Category) {
    await toggleCategoryActive(cat.id, !cat.isActive)
    toast.success(cat.isActive ? "تم التعطيل" : "تم التفعيل")
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          فئة جديدة
        </Button>
      </div>

      <div className="grid gap-3">
        {categories.map((cat) => (
          <Card key={cat.id} className={cat.isActive ? "" : "opacity-60"}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={TONE_COLORS[cat.tone] as "default" | "secondary" | "destructive"}>
                    {TONE_LABELS[cat.tone]}
                  </Badge>
                  {cat.isActive ? (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      نشط
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      معطّل
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-2 mb-3">
                {cat.template}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setEditing(cat)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => handleToggle(cat)}
                >
                  {cat.isActive ? (
                    <PowerOff className="h-3.5 w-3.5" />
                  ) : (
                    <Power className="h-3.5 w-3.5" />
                  )}
                  {cat.isActive ? "تعطيل" : "تفعيل"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>فئة رسائل جديدة</DialogTitle>
          </DialogHeader>
          <CategoryForm onDone={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل الفئة</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
              category={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
