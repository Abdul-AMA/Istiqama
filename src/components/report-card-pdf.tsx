import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import path from "path"

Font.register({
  family: "Amiri",
  src: path.join(process.cwd(), "public", "fonts", "Amiri-Regular.ttf"),
})

const styles = StyleSheet.create({
  page: {
    fontFamily: "Amiri",
    fontSize: 12,
    direction: "rtl",
    padding: 40,
    backgroundColor: "#fff",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "2 solid #16a34a",
    paddingBottom: 12,
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: "Amiri",
    fontSize: 20,
    color: "#16a34a",
  },
  headerSub: {
    fontFamily: "Amiri",
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: "Amiri",
    fontSize: 13,
    color: "#16a34a",
    borderBottom: "1 solid #d1fae5",
    paddingBottom: 4,
    marginBottom: 10,
    marginTop: 16,
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  label: {
    fontFamily: "Amiri",
    fontSize: 11,
    color: "#555",
    width: "40%",
  },
  value: {
    fontFamily: "Amiri",
    fontSize: 11,
    color: "#1a1a1a",
    width: "58%",
    textAlign: "right",
  },
  valueBold: {
    fontFamily: "Amiri",
    fontSize: 11,
    color: "#15803d",
    width: "58%",
    textAlign: "right",
  },
  // Highlight box for surah range
  surahBox: {
    backgroundColor: "#f0fdf4",
    border: "1 solid #86efac",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  surahBoxTitle: {
    fontFamily: "Amiri",
    fontSize: 10,
    color: "#555",
    marginBottom: 4,
    textAlign: "right",
  },
  surahBoxValue: {
    fontFamily: "Amiri",
    fontSize: 13,
    color: "#15803d",
    textAlign: "right",
  },
  statsGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    width: "22%",
    backgroundColor: "#f0fdf4",
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Amiri",
    fontSize: 18,
    color: "#16a34a",
    textAlign: "center",
  },
  statLabel: {
    fontFamily: "Amiri",
    fontSize: 9,
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },
  notesBox: {
    backgroundColor: "#fafafa",
    border: "1 solid #e5e7eb",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    minHeight: 50,
  },
  notesText: {
    fontFamily: "Amiri",
    fontSize: 11,
    color: "#333",
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1 solid #d1fae5",
    paddingTop: 8,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  footerText: {
    fontFamily: "Amiri",
    fontSize: 9,
    color: "#999",
  },
})

type SardEntry = { date: string; juz: string; rating: string } | null

type ReportData = {
  studentName: string
  photoUrl?: string | null
  className: string
  teacherName: string
  from: string
  to: string
  totalPagesMemorized: number
  fromSurahName: string | null
  fromAyah: number | null
  toSurahName: string | null
  toAyah: number | null
  newPagesInRange: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  totalSessions: number
  attendancePct: number
  attendanceDays: number
  avgRatingLabel: string
  sessionsCount: number
  lastSardFardi: SardEntry
  lastSardJamai: SardEntry
  teacherNotes: string
}

export function ReportCardDocument({ data }: { data: ReportData }) {
  const surahRange =
    data.fromSurahName && data.fromAyah && data.toSurahName && data.toAyah
      ? `من سورة ${data.fromSurahName} آية ${data.fromAyah} الى سورة ${data.toSurahName} آية ${data.toAyah}`
      : null

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>مركز استقامة لتحفيظ القرآن الكريم</Text>
            <Text style={styles.headerSub}>
              كشف متابعة الطالب  |  {data.from} - {data.to}
            </Text>
          </View>
        </View>

        {/* Student info */}
        <Text style={styles.sectionTitle}>بيانات الطالب</Text>
        <View style={styles.row}>
          <Text style={styles.label}>اسم الطالب:</Text>
          <Text style={styles.value}>{data.studentName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>الحلقة:</Text>
          <Text style={styles.value}>{data.className}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>المعلم:</Text>
          <Text style={styles.value}>{data.teacherName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>الفترة:</Text>
          <Text style={styles.value}>
            {data.from} الى {data.to}
          </Text>
        </View>

        {/* Surah range highlight */}
        <Text style={styles.sectionTitle}>المحفوظ الاجمالي</Text>
        <View style={styles.surahBox}>
          <Text style={styles.surahBoxTitle}>عدد الصفحات المحفوظة</Text>
          <Text style={styles.surahBoxValue}>{data.totalPagesMemorized} صفحة</Text>
          {surahRange ? (
            <>
              <Text style={[styles.surahBoxTitle, { marginTop: 6 }]}>النطاق</Text>
              <Text style={styles.surahBoxValue}>{surahRange}</Text>
            </>
          ) : null}
        </View>

        {/* Period stats */}
        <Text style={styles.sectionTitle}>ملخص الفترة</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.newPagesInRange}</Text>
            <Text style={styles.statLabel}>{"صفحات جديدة\nفي الفترة"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.attendanceDays}</Text>
            <Text style={styles.statLabel}>{"ايام\nالحضور"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.attendancePct}%</Text>
            <Text style={styles.statLabel}>{"نسبة\nالحضور"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.avgRatingLabel}</Text>
            <Text style={styles.statLabel}>{"متوسط\nالتقييم"}</Text>
          </View>
        </View>

        {/* Attendance detail */}
        <Text style={styles.sectionTitle}>تفاصيل الحضور</Text>
        <View style={styles.row}>
          <Text style={styles.label}>اجمالي الجلسات:</Text>
          <Text style={styles.value}>{data.totalSessions}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>حاضر:</Text>
          <Text style={styles.valueBold}>{data.presentCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>غائب:</Text>
          <Text style={styles.value}>{data.absentCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>متاخر:</Text>
          <Text style={styles.value}>{data.lateCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>معذور:</Text>
          <Text style={styles.value}>{data.excusedCount}</Text>
        </View>

        {/* Sard */}
        <Text style={styles.sectionTitle}>السرد</Text>
        <View style={styles.row}>
          <Text style={styles.label}>اخر سرد فردي:</Text>
          <Text style={styles.value}>
            {data.lastSardFardi
              ? `${data.lastSardFardi.juz} - ${data.lastSardFardi.rating} (${data.lastSardFardi.date})`
              : "لا يوجد"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>اخر سرد جماعي:</Text>
          <Text style={styles.value}>
            {data.lastSardJamai
              ? `${data.lastSardJamai.juz} - ${data.lastSardJamai.rating} (${data.lastSardJamai.date})`
              : "لا يوجد"}
          </Text>
        </View>

        {/* Teacher notes */}
        <Text style={styles.sectionTitle}>ملاحظات المعلم</Text>
        <View style={styles.notesBox}>
          <Text style={styles.notesText}>
            {data.teacherNotes || "لا توجد ملاحظات"}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>استقامة - مركز تحفيظ القران الكريم</Text>
          <Text style={styles.footerText}>
            {data.studentName}  |  {data.from} - {data.to}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
