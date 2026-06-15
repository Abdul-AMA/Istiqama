import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// 40 Arabic male student names
const NAMES = [
  // ابو السامر (10)
  "عبدالله أحمد السالم",
  "محمد عمر الرشيد",
  "يوسف خالد المطيري",
  "إبراهيم سعد الغامدي",
  "عمر فهد الشمري",
  "سلمان ناصر العتيبي",
  "عبدالرحمن علي الزهراني",
  "فيصل محمد الحربي",
  "تركي عبدالله القحطاني",
  "بندر سلطان الدوسري",
  // ابو مازن (10)
  "خالد إبراهيم البلوي",
  "ماجد يوسف العنزي",
  "سعود أحمد الرويلي",
  "نواف عمر السبيعي",
  "وليد حسن المالكي",
  "منصور محمد الأسمري",
  "عادل فيصل السهلي",
  "هاني عبدالله الشهري",
  "رائد سعد الثبيتي",
  "أنس خالد المري",
  // ابو العبد (10)
  "حمزة طارق السلمي",
  "زياد عمر الجهني",
  "أيمن محمد العمري",
  "بلال سلمان الغامدي",
  "قيس فهد الحازمي",
  "مصطفى علي البقمي",
  "عمار ناصر الهاجري",
  "سامي عبدالرحمن الشريف",
  "جابر يوسف المسعود",
  "ليث إبراهيم القرني",
  // ابو خالد (10)
  "أسامة محمد السعدي",
  "معاذ خالد البريكي",
  "شهاب أحمد الزيد",
  "صالح عمر الفيفي",
  "أحمد سعود العوفي",
  "نايف فيصل الرشيدي",
  "عزيز عبدالله الحمدان",
  "ضرار ماجد السعيد",
  "طارق منصور العجمي",
  "حارث وليد الخثلان",
]

const GUARDIAN_NAMES = [
  "أحمد السالم", "عمر الرشيد", "خالد المطيري", "سعد الغامدي", "فهد الشمري",
  "ناصر العتيبي", "علي الزهراني", "محمد الحربي", "عبدالله القحطاني", "سلطان الدوسري",
  "إبراهيم البلوي", "يوسف العنزي", "أحمد الرويلي", "عمر السبيعي", "حسن المالكي",
  "محمد الأسمري", "فيصل السهلي", "عبدالله الشهري", "سعد الثبيتي", "خالد المري",
  "طارق السلمي", "عمر الجهني", "محمد العمري", "سلمان الغامدي", "فهد الحازمي",
  "علي البقمي", "ناصر الهاجري", "عبدالرحمن الشريف", "يوسف المسعود", "إبراهيم القرني",
  "محمد السعدي", "خالد البريكي", "أحمد الزيد", "عمر الفيفي", "سعود العوفي",
  "فيصل الرشيدي", "عبدالله الحمدان", "ماجد السعيد", "منصور العجمي", "وليد الخثلان",
]

const GRADES = [
  "أول ثانوي", "ثاني ثانوي", "ثالث ثانوي",
  "أول إعدادي", "ثاني إعدادي", "ثالث إعدادي",
  "رابع ابتدائي", "خامس ابتدائي", "سادس ابتدائي",
]

const NEIGHBORHOODS = ["حي النزهة", "حي الروضة", "حي الملك فهد", "حي العزيزية", "حي الصفا", "حي الشاطئ"]

// Class names as they appear in the DB
const CLASS_NAMES = ["ابو السامر", "ابو مازن", "ابو العبد", "ابو خالد"]

async function main() {
  console.log("🔍 Looking up classes…")

  const classes = await prisma.class.findMany({
    where: { name: { in: CLASS_NAMES } },
    select: { id: true, name: true },
  })

  if (classes.length !== 4) {
    console.error(`❌ Expected 4 classes, found ${classes.length}:`, classes.map(c => c.name))
    process.exit(1)
  }

  // Sort to match our name order
  const orderedClasses = CLASS_NAMES.map(name => {
    const cls = classes.find(c => c.name === name)
    if (!cls) throw new Error(`Class not found: ${name}`)
    return cls
  })

  console.log("✅ Found classes:", orderedClasses.map(c => `${c.name} (${c.id})`).join(", "))

  console.log("🎓 Creating 40 students…")

  for (let i = 0; i < 40; i++) {
    const classIndex = Math.floor(i / 10)
    const cls = orderedClasses[classIndex]

    // Random date of birth (age 8–18)
    const age = 8 + Math.floor(Math.random() * 11)
    const dob = new Date()
    dob.setFullYear(dob.getFullYear() - age)
    dob.setMonth(Math.floor(Math.random() * 12))
    dob.setDate(1 + Math.floor(Math.random() * 28))

    const phone = `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`

    await prisma.student.create({
      data: {
        fullName: NAMES[i],
        gender: "MALE",
        dateOfBirth: dob,
        guardianName: GUARDIAN_NAMES[i],
        guardianPhone: phone,
        schoolGrade: GRADES[Math.floor(Math.random() * GRADES.length)],
        neighborhood: NEIGHBORHOODS[Math.floor(Math.random() * NEIGHBORHOODS.length)],
        status: "ACTIVE",
        classId: cls.id,
        previousHifzPages: Math.floor(Math.random() * 30),
        currentTotalPagesMemorized: Math.floor(Math.random() * 30),
        enrollmentDate: new Date(),
      },
    })

    console.log(`  ✓ [${i + 1}/40] ${NAMES[i]} → ${cls.name}`)
  }

  console.log("\n✅ Done! 40 students created and assigned.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
