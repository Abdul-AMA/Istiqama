import { PrismaClient, Tone } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// 604-page Madani Mushaf — all 114 surahs
const SURAHS: { number: number; nameAr: string; ayahCount: number; startPage: number }[] = [
  { number: 1,   nameAr: "الفاتحة",    ayahCount: 7,   startPage: 1   },
  { number: 2,   nameAr: "البقرة",     ayahCount: 286, startPage: 2   },
  { number: 3,   nameAr: "آل عمران",   ayahCount: 200, startPage: 50  },
  { number: 4,   nameAr: "النساء",     ayahCount: 176, startPage: 77  },
  { number: 5,   nameAr: "المائدة",    ayahCount: 120, startPage: 106 },
  { number: 6,   nameAr: "الأنعام",    ayahCount: 165, startPage: 128 },
  { number: 7,   nameAr: "الأعراف",    ayahCount: 206, startPage: 151 },
  { number: 8,   nameAr: "الأنفال",    ayahCount: 75,  startPage: 177 },
  { number: 9,   nameAr: "التوبة",     ayahCount: 129, startPage: 187 },
  { number: 10,  nameAr: "يونس",       ayahCount: 109, startPage: 208 },
  { number: 11,  nameAr: "هود",        ayahCount: 123, startPage: 221 },
  { number: 12,  nameAr: "يوسف",       ayahCount: 111, startPage: 235 },
  { number: 13,  nameAr: "الرعد",      ayahCount: 43,  startPage: 249 },
  { number: 14,  nameAr: "إبراهيم",    ayahCount: 52,  startPage: 255 },
  { number: 15,  nameAr: "الحجر",      ayahCount: 99,  startPage: 262 },
  { number: 16,  nameAr: "النحل",      ayahCount: 128, startPage: 267 },
  { number: 17,  nameAr: "الإسراء",    ayahCount: 111, startPage: 282 },
  { number: 18,  nameAr: "الكهف",      ayahCount: 110, startPage: 293 },
  { number: 19,  nameAr: "مريم",       ayahCount: 98,  startPage: 305 },
  { number: 20,  nameAr: "طه",         ayahCount: 135, startPage: 312 },
  { number: 21,  nameAr: "الأنبياء",   ayahCount: 112, startPage: 322 },
  { number: 22,  nameAr: "الحج",       ayahCount: 78,  startPage: 332 },
  { number: 23,  nameAr: "المؤمنون",   ayahCount: 118, startPage: 342 },
  { number: 24,  nameAr: "النور",      ayahCount: 64,  startPage: 350 },
  { number: 25,  nameAr: "الفرقان",    ayahCount: 77,  startPage: 359 },
  { number: 26,  nameAr: "الشعراء",    ayahCount: 227, startPage: 367 },
  { number: 27,  nameAr: "النمل",      ayahCount: 93,  startPage: 377 },
  { number: 28,  nameAr: "القصص",      ayahCount: 88,  startPage: 385 },
  { number: 29,  nameAr: "العنكبوت",   ayahCount: 69,  startPage: 396 },
  { number: 30,  nameAr: "الروم",      ayahCount: 60,  startPage: 404 },
  { number: 31,  nameAr: "لقمان",      ayahCount: 34,  startPage: 411 },
  { number: 32,  nameAr: "السجدة",     ayahCount: 30,  startPage: 415 },
  { number: 33,  nameAr: "الأحزاب",    ayahCount: 73,  startPage: 418 },
  { number: 34,  nameAr: "سبأ",        ayahCount: 54,  startPage: 428 },
  { number: 35,  nameAr: "فاطر",       ayahCount: 45,  startPage: 434 },
  { number: 36,  nameAr: "يس",         ayahCount: 83,  startPage: 440 },
  { number: 37,  nameAr: "الصافات",    ayahCount: 182, startPage: 446 },
  { number: 38,  nameAr: "ص",          ayahCount: 88,  startPage: 453 },
  { number: 39,  nameAr: "الزمر",      ayahCount: 75,  startPage: 458 },
  { number: 40,  nameAr: "غافر",       ayahCount: 85,  startPage: 467 },
  { number: 41,  nameAr: "فصلت",       ayahCount: 54,  startPage: 477 },
  { number: 42,  nameAr: "الشورى",     ayahCount: 53,  startPage: 483 },
  { number: 43,  nameAr: "الزخرف",     ayahCount: 89,  startPage: 489 },
  { number: 44,  nameAr: "الدخان",     ayahCount: 59,  startPage: 496 },
  { number: 45,  nameAr: "الجاثية",    ayahCount: 37,  startPage: 499 },
  { number: 46,  nameAr: "الأحقاف",    ayahCount: 35,  startPage: 502 },
  { number: 47,  nameAr: "محمد",       ayahCount: 38,  startPage: 507 },
  { number: 48,  nameAr: "الفتح",      ayahCount: 29,  startPage: 511 },
  { number: 49,  nameAr: "الحجرات",    ayahCount: 18,  startPage: 515 },
  { number: 50,  nameAr: "ق",          ayahCount: 45,  startPage: 518 },
  { number: 51,  nameAr: "الذاريات",   ayahCount: 60,  startPage: 520 },
  { number: 52,  nameAr: "الطور",      ayahCount: 49,  startPage: 523 },
  { number: 53,  nameAr: "النجم",      ayahCount: 62,  startPage: 526 },
  { number: 54,  nameAr: "القمر",      ayahCount: 55,  startPage: 528 },
  { number: 55,  nameAr: "الرحمن",     ayahCount: 78,  startPage: 531 },
  { number: 56,  nameAr: "الواقعة",    ayahCount: 96,  startPage: 534 },
  { number: 57,  nameAr: "الحديد",     ayahCount: 29,  startPage: 537 },
  { number: 58,  nameAr: "المجادلة",   ayahCount: 22,  startPage: 542 },
  { number: 59,  nameAr: "الحشر",      ayahCount: 24,  startPage: 545 },
  { number: 60,  nameAr: "الممتحنة",   ayahCount: 13,  startPage: 549 },
  { number: 61,  nameAr: "الصف",       ayahCount: 14,  startPage: 551 },
  { number: 62,  nameAr: "الجمعة",     ayahCount: 11,  startPage: 553 },
  { number: 63,  nameAr: "المنافقون",  ayahCount: 11,  startPage: 554 },
  { number: 64,  nameAr: "التغابن",    ayahCount: 18,  startPage: 556 },
  { number: 65,  nameAr: "الطلاق",     ayahCount: 12,  startPage: 558 },
  { number: 66,  nameAr: "التحريم",    ayahCount: 12,  startPage: 560 },
  { number: 67,  nameAr: "الملك",      ayahCount: 30,  startPage: 562 },
  { number: 68,  nameAr: "القلم",      ayahCount: 52,  startPage: 564 },
  { number: 69,  nameAr: "الحاقة",     ayahCount: 52,  startPage: 566 },
  { number: 70,  nameAr: "المعارج",    ayahCount: 44,  startPage: 568 },
  { number: 71,  nameAr: "نوح",        ayahCount: 28,  startPage: 570 },
  { number: 72,  nameAr: "الجن",       ayahCount: 28,  startPage: 572 },
  { number: 73,  nameAr: "المزمل",     ayahCount: 20,  startPage: 574 },
  { number: 74,  nameAr: "المدثر",     ayahCount: 56,  startPage: 575 },
  { number: 75,  nameAr: "القيامة",    ayahCount: 40,  startPage: 577 },
  { number: 76,  nameAr: "الإنسان",    ayahCount: 31,  startPage: 578 },
  { number: 77,  nameAr: "المرسلات",   ayahCount: 50,  startPage: 580 },
  { number: 78,  nameAr: "النبأ",      ayahCount: 40,  startPage: 582 },
  { number: 79,  nameAr: "النازعات",   ayahCount: 46,  startPage: 583 },
  { number: 80,  nameAr: "عبس",        ayahCount: 42,  startPage: 585 },
  { number: 81,  nameAr: "التكوير",    ayahCount: 29,  startPage: 586 },
  { number: 82,  nameAr: "الانفطار",   ayahCount: 19,  startPage: 587 },
  { number: 83,  nameAr: "المطففين",   ayahCount: 36,  startPage: 587 },
  { number: 84,  nameAr: "الانشقاق",   ayahCount: 25,  startPage: 589 },
  { number: 85,  nameAr: "البروج",     ayahCount: 22,  startPage: 590 },
  { number: 86,  nameAr: "الطارق",     ayahCount: 17,  startPage: 591 },
  { number: 87,  nameAr: "الأعلى",     ayahCount: 19,  startPage: 591 },
  { number: 88,  nameAr: "الغاشية",    ayahCount: 26,  startPage: 592 },
  { number: 89,  nameAr: "الفجر",      ayahCount: 30,  startPage: 593 },
  { number: 90,  nameAr: "البلد",      ayahCount: 20,  startPage: 594 },
  { number: 91,  nameAr: "الشمس",      ayahCount: 15,  startPage: 595 },
  { number: 92,  nameAr: "الليل",      ayahCount: 21,  startPage: 595 },
  { number: 93,  nameAr: "الضحى",      ayahCount: 11,  startPage: 596 },
  { number: 94,  nameAr: "الشرح",      ayahCount: 8,   startPage: 596 },
  { number: 95,  nameAr: "التين",      ayahCount: 8,   startPage: 597 },
  { number: 96,  nameAr: "العلق",      ayahCount: 19,  startPage: 597 },
  { number: 97,  nameAr: "القدر",      ayahCount: 5,   startPage: 598 },
  { number: 98,  nameAr: "البينة",     ayahCount: 8,   startPage: 598 },
  { number: 99,  nameAr: "الزلزلة",    ayahCount: 8,   startPage: 599 },
  { number: 100, nameAr: "العاديات",   ayahCount: 11,  startPage: 599 },
  { number: 101, nameAr: "القارعة",    ayahCount: 11,  startPage: 600 },
  { number: 102, nameAr: "التكاثر",    ayahCount: 8,   startPage: 600 },
  { number: 103, nameAr: "العصر",      ayahCount: 3,   startPage: 601 },
  { number: 104, nameAr: "الهمزة",     ayahCount: 9,   startPage: 601 },
  { number: 105, nameAr: "الفيل",      ayahCount: 5,   startPage: 601 },
  { number: 106, nameAr: "قريش",       ayahCount: 4,   startPage: 602 },
  { number: 107, nameAr: "الماعون",    ayahCount: 7,   startPage: 602 },
  { number: 108, nameAr: "الكوثر",     ayahCount: 3,   startPage: 602 },
  { number: 109, nameAr: "الكافرون",   ayahCount: 6,   startPage: 603 },
  { number: 110, nameAr: "النصر",      ayahCount: 3,   startPage: 603 },
  { number: 111, nameAr: "المسد",      ayahCount: 5,   startPage: 603 },
  { number: 112, nameAr: "الإخلاص",    ayahCount: 4,   startPage: 604 },
  { number: 113, nameAr: "الفلق",      ayahCount: 5,   startPage: 604 },
  { number: 114, nameAr: "الناس",      ayahCount: 6,   startPage: 604 },
]

async function main() {
  console.log("🌱 Seeding database…")

  // 1. Surahs
  console.log("  📖 Upserting 114 surahs…")
  for (const surah of SURAHS) {
    await prisma.surah.upsert({
      where:  { number: surah.number },
      update: { nameAr: surah.nameAr, ayahCount: surah.ayahCount, startPage: surah.startPage },
      create: surah,
    })
  }
  console.log("  ✓ Surahs done")

  // 2. Principal account
  console.log("  👤 Upserting principal account…")
  const passwordHash = await bcrypt.hash("Admin1234", 12)
  const principal = await prisma.user.upsert({
    where:  { email: "admin@istiqama.app" },
    update: {},
    create: {
      email:        "admin@istiqama.app",
      fullName:     "مدير النظام",
      passwordHash,
      role:         "PRINCIPAL",
      isActive:     true,
    },
  })
  console.log("  ✓ Principal account done")

  // 3. Default message categories
  console.log("  💬 Upserting default message categories…")
  const categories: {
    name: string
    tone: Tone
    template: string
    sortOrder: number
  }[] = [
    {
      name: "تنبيه",
      tone: Tone.NEUTRAL,
      template:
        "السلام عليكم ولي أمر الطالب {student_name}،\nنود تنبيهكم بخصوص {student_name} في حلقة {class_name}.\nبتاريخ {date}: {attendance_status}.\nللتواصل: المعلم {teacher_name}.",
      sortOrder: 1,
    },
    {
      name: "إنذار",
      tone: Tone.WARNING,
      template:
        "السلام عليكم ولي أمر الطالب {student_name}،\nنحيطكم علماً بأن {student_name} يحتاج إلى متابعة عاجلة في حلقة {class_name}.\nالمجموع المحفوظ: {total_memorized} صفحة. نسبة الحضور منخفضة.\nيرجى التواصل مع المعلم {teacher_name} في أقرب وقت.",
      sortOrder: 2,
    },
    {
      name: "تشجيع",
      tone: Tone.POSITIVE,
      template:
        "السلام عليكم ولي أمر الطالب {student_name}،\nيسعدنا إخباركم بتقدم {student_name} الرائع في حلقة {class_name}.\nأتم اليوم: {today_sabaq}. التقييم: {rating}.\nالمجموع المحفوظ: {total_memorized} صفحة. بارك الله فيه وفيكم!",
      sortOrder: 3,
    },
  ]

  for (const cat of categories) {
    const existing = await prisma.messageCategory.findFirst({
      where: { name: cat.name, createdByUserId: principal.id },
    })
    if (!existing) {
      await prisma.messageCategory.create({
        data: { ...cat, createdByUserId: principal.id },
      })
    }
  }
  console.log("  ✓ Message categories done")

  console.log("✅ Seeding complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
