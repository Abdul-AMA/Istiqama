import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer"
import path from "path"

// Register Amiri font for Arabic RTL
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
    fontSize: 22,
    color: "#16a34a",
  },
  headerSub: {
    fontFamily: "Amiri",
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },
  logo: {
    fontSize: 30,
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
  newPagesInRange: number
  presentCount: number
  absentCount: number
  lateCount: number
  excusedCount: number
  totalSessions: number
  attendancePct: number
  avgRatingLabel: string
  sessionsCount: number
  lastSardFardi: SardEntry
  lastSardJamai: SardEntry
  teacherNotes: string
}

export function ReportCardDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>مركز استقامة لتحفيظ القرآن الكريم</Text>
            <Text style={styles.headerSub}>
              كشف متابعة الطالب | {data.from} — {data.to}
            </Text>
          </View>
          <Text style={styles.logo}>🕌</Text>
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
            {data.from} إلى {data.to}
          </Text>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>ملخص الأداء</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.totalPagesMemorized}</Text>
            <Text style={styles.statLabel}>إجمالي المحفوظ{"\n"}(صفحة)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.newPagesInRange}</Text>
            <Text style={styles.statLabel}>صفحات جديدة{"\n"}في الفترة</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.attendancePct}%</Text>
            <Text style={styles.statLabel}>نسبة{"\n"}الحضور</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.avgRatingLabel}</Text>
            <Text style={styles.statLabel}>متوسط{"\n"}التقييم</Text>
          </View>
        </View>

        {/* Attendance detail */}
        <Text style={styles.sectionTitle}>تفاصيل الحضور</Text>
        <View style={styles.row}>
          <Text style={styles.label}>إجمالي الجلسات:</Text>
          <Text style={styles.value}>{data.totalSessions}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>حاضر:</Text>
          <Text style={styles.value}>{data.presentCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>غائب:</Text>
          <Text style={styles.value}>{data.absentCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>متأخر:</Text>
          <Text style={styles.value}>{data.lateCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>معذور:</Text>
          <Text style={styles.value}>{data.excusedCount}</Text>
        </View>

        {/* Sard */}
        <Text style={styles.sectionTitle}>السرد</Text>
        <View style={styles.row}>
          <Text style={styles.label}>آخر سرد فردي:</Text>
          <Text style={styles.value}>
            {data.lastSardFardi
              ? `${data.lastSardFardi.juz} — ${data.lastSardFardi.rating} (${data.lastSardFardi.date})`
              : "لا يوجد"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>آخر سرد مجتمعي:</Text>
          <Text style={styles.value}>
            {data.lastSardJamai
              ? `${data.lastSardJamai.juz} — ${data.lastSardJamai.rating} (${data.lastSardJamai.date})`
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
          <Text style={styles.footerText}>استقامة — مركز تحفيظ القرآن الكريم</Text>
          <Text style={styles.footerText}>
            {data.studentName} | {data.from} — {data.to}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
