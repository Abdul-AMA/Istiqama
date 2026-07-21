// Generates the fully self-contained, offline-capable static HTML page a
// teacher downloads to submit a daily session via Telegram when they have
// no connectivity. No prisma/server-only imports here — both the teacher
// and admin routes call this from a client component so the download can
// be built (and rebuilt on dropdown change) without a server round-trip.
//
// The per-student data model mirrors the online daily-session page exactly
// (src/app/(auth)/daily/daily-session-client.tsx): surah/ayah-based حفظ
// جديد / مراجعة entries (multiple each), so both paths save identically
// through saveDailySessionCore. واجب الغد (tomorrow's homework) is an
// offline-only, report-only addition — it is never sent in the Telegram
// payload and never saved to the DB.
//
// See docs/telegram-architecture.md §6 and §9 for the design this implements.

export interface OfflineFormRosterStudent {
  id: string
  fullName: string
}

export interface OfflineFormSurah {
  number: number
  nameAr: string
  ayahCount: number
}

export interface OfflineFormOptions {
  teacherId: string
  halaqaId: string
  halaqaName: string
  teacherName: string
  roster: OfflineFormRosterStudent[]
  surahs: OfflineFormSurah[]
  botUsername: string
  generatedAt: Date
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeJsString(s: string): string {
  // Used only inside a JS string literal embedded in the page — guards
  // against a roster name containing a quote or a literal </script>.
  return JSON.stringify(s).slice(1, -1).replace(/</g, "\\u003C")
}

function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003C")
}

function formatTimestamp(d: Date): string {
  return d.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const ATTENDANCE_OPTIONS = [
  { code: "P", label: "حاضر" },
  { code: "L", label: "متأخر" },
  { code: "A", label: "غائب" },
  { code: "E", label: "معذور" },
]

const RATING_OPTIONS = [
  { value: 4, label: "ممتاز" },
  { value: 3, label: "جيد جداً" },
  { value: 2, label: "جيد" },
  { value: 1, label: "يحتاج إعادة" },
]

const RATING_BUTTONS_HTML = RATING_OPTIONS.map(
  (r) => `<button type="button" class="rating-btn" data-rating="${r.value}">${r.label}</button>`
).join("")

function studentCardHtml(s: OfflineFormRosterStudent): string {
  const attButtons = ATTENDANCE_OPTIONS.map(
    (o) => `<button type="button" class="att-btn" data-att="${o.code}">${o.label}</button>`
  ).join("")

  return `
  <div class="card" data-student-id="${escapeHtml(s.id)}" data-student-name="${escapeHtml(s.fullName)}">
    <div class="card-header">${escapeHtml(s.fullName)}</div>
    <div class="att-row">${attButtons}</div>
    <div class="hifz-area hidden">
      <label class="dnr-row">
        <input type="checkbox" class="dnr-cb" />
        <span>لم يُسمَع اليوم</span>
      </label>

      <div class="today-sections">
        <div class="section-block hifz-section" data-rec-type="NEW">
          <p class="section-title">حفظ جديد</p>
          <div class="entries-list"></div>
          <button type="button" class="add-entry-btn">+ إضافة سورة</button>
        </div>
        <div class="section-block muraja-section" data-rec-type="RECENT_REVISION">
          <p class="section-title">مراجعة</p>
          <div class="entries-list"></div>
          <button type="button" class="add-entry-btn">+ إضافة سورة</button>
        </div>
      </div>

      <label class="note-label">ملاحظات عامة (اختياري)
        <textarea class="note-field" maxlength="100" rows="2" placeholder="حتى 100 حرف — بدون : ; _ |"></textarea>
      </label>
      <div class="note-counter">0/100</div>

      <div class="section-block homework-section" data-rec-type="HOMEWORK">
        <p class="section-title homework-title">📝 واجب الغد (اختياري — لعرضه في التقرير فقط، لا يُرسَل مع البيانات)</p>
        <div class="entries-list"></div>
        <button type="button" class="add-entry-btn">+ إضافة سورة</button>
      </div>
    </div>
    <div class="att-hint">اختر حالة الحضور أولاً</div>
    <div class="card-error"></div>
  </div>`
}

export function generateOfflineFormHtml(opts: OfflineFormOptions): string {
  const { teacherId, halaqaId, halaqaName, teacherName, roster, surahs, botUsername, generatedAt } = opts

  const cardsHtml = roster.map(studentCardHtml).join("\n")
  const generatedAtLabel = formatTimestamp(generatedAt)

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>نموذج الحصة غير المتصل — ${escapeHtml(halaqaName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    background: #f4f6f5;
    color: #1f2937;
    padding: 12px;
    padding-bottom: 190px;
  }
  header.page-head {
    background: #16a34a;
    color: #fff;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 14px;
  }
  header.page-head h1 { margin: 0 0 4px; font-size: 18px; }
  header.page-head p { margin: 2px 0; font-size: 13px; opacity: .95; }
  .meta-row { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
  .meta-row label { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .meta-row input[type=date] {
    height: 38px; border-radius: 8px; border: 1px solid #d1d5db; padding: 0 8px; font-size: 14px;
  }
  #error-summary {
    display: none;
    background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b;
    border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; font-size: 13px;
  }
  #error-summary ul { margin: 6px 0 0; padding-inline-start: 18px; }
  .card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
    padding: 12px; margin-bottom: 10px;
  }
  .card.has-error { border-color: #fca5a5; box-shadow: 0 0 0 1px #fca5a5; }
  .card-header { font-weight: 700; font-size: 15px; margin-bottom: 8px; }
  .att-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .att-btn {
    border: 1px solid #d1d5db; background: #fff; border-radius: 8px;
    padding: 8px 4px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .att-btn.selected[data-att=P] { background: #dcfce7; border-color: #86efac; color: #166534; }
  .att-btn.selected[data-att=L] { background: #fef9c3; border-color: #fde047; color: #854d0e; }
  .att-btn.selected[data-att=A] { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
  .att-btn.selected[data-att=E] { background: #f3f4f6; border-color: #d1d5db; color: #374151; }
  .att-hint { font-size: 12px; color: #9ca3af; margin-top: 6px; }
  .hifz-area { margin-top: 10px; border-top: 1px dashed #e5e7eb; padding-top: 10px; }
  .dnr-row { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 10px; }

  .section-block {
    border: 2px solid #e5e7eb; border-radius: 12px; padding: 10px; margin-bottom: 10px;
  }
  .hifz-section { border-color: #86efac; background: #f0fdf4; }
  .muraja-section { border-color: #93c5fd; background: #eff6ff; }
  .homework-section { border-color: #fcd34d; background: #fffbeb; }
  .section-title { font-size: 13px; font-weight: 700; margin: 0 0 8px; }
  .entries-list:empty::before {
    content: "لا يوجد — اضغط + لإضافة سورة";
    display: block; text-align: center; font-size: 12px; color: #9ca3af; padding: 6px 0;
  }
  .entry-row {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 10px; margin-bottom: 8px;
  }
  .entry-top { display: flex; align-items: center; gap: 8px; }
  .entry-top select { flex: 1; height: 38px; border-radius: 8px; border: 1px solid #d1d5db; padding: 0 8px; font-size: 13px; }
  .remove-entry-btn {
    shrink: 0; border: none; background: transparent; color: #9ca3af; font-size: 15px;
    cursor: pointer; padding: 4px 8px;
  }
  .add-entry-btn {
    display: block; width: 100%; border: 1px dashed #9ca3af; background: transparent;
    border-radius: 10px; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: #374151;
  }
  .entry-fields { margin-top: 8px; }
  .completed-row { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; margin-bottom: 8px; cursor: pointer; }
  .ayah-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ayah-row label, .pages-row-label { font-size: 11px; color: #6b7280; display: flex; flex-direction: column; gap: 4px; }
  .ayah-row input, .pages-row-label input {
    height: 36px; border-radius: 8px; border: 1px solid #d1d5db; padding: 0 8px; font-size: 14px; text-align: center;
  }
  .ayah-row input[readonly], .pages-row-label input[readonly] { background: #f3f4f6; }
  .pages-row-label { margin-top: 8px; }
  .rating-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px; }
  .rating-btn { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; padding: 6px 2px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .rating-btn.selected[data-rating="4"] { background: #16a34a; color: #fff; border-color: #16a34a; }
  .rating-btn.selected[data-rating="3"] { background: #2563eb; color: #fff; border-color: #2563eb; }
  .rating-btn.selected[data-rating="2"] { background: #eab308; color: #fff; border-color: #eab308; }
  .rating-btn.selected[data-rating="1"] { background: #ef4444; color: #fff; border-color: #ef4444; }
  .mistakes-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 8px; }
  .mistakes-row input { height: 32px; width: 70px; border-radius: 8px; border: 1px solid #d1d5db; text-align: center; }

  .note-label { display: block; font-size: 12px; color: #6b7280; margin-top: 4px; }
  .note-field { width: 100%; margin-top: 4px; border-radius: 8px; border: 1px solid #d1d5db; padding: 6px 8px; font-size: 13px; font-family: inherit; resize: none; }
  .note-counter { font-size: 11px; color: #9ca3af; text-align: left; }

  .homework-title { color: #92400e; }

  .card-error { display: none; font-size: 12px; color: #b91c1c; margin-top: 6px; font-weight: 600; }
  .hidden { display: none !important; }

  footer.submit-bar {
    position: fixed; inset-inline: 0; bottom: 0; background: #fff;
    border-top: 1px solid #e5e7eb; padding: 10px 12px; box-shadow: 0 -2px 8px rgba(0,0,0,.05);
  }
  footer.submit-bar p.submit-hint { margin: 8px 0 8px; font-size: 12px; color: #6b7280; text-align: center; }
  #continue-btn {
    width: 100%; height: 44px; border: 1px solid #16a34a; border-radius: 10px;
    background: #fff; color: #16a34a; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  #continue-btn:disabled { border-color: #9ca3af; color: #9ca3af; cursor: not-allowed; }
  #submit-btn {
    width: 100%; height: 48px; border: none; border-radius: 10px;
    background: #16a34a; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  }
  #submit-btn:disabled { background: #9ca3af; cursor: not-allowed; }

  .report-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 50;
    display: flex; align-items: flex-end; justify-content: center;
  }
  .report-panel {
    background: #fff; border-radius: 16px 16px 0 0; padding: 16px; width: 100%; max-width: 480px;
    max-height: 88vh; overflow-y: auto;
  }
  .report-panel h2 { margin: 0 0 10px; font-size: 16px; }
  .report-textarea {
    width: 100%; border-radius: 10px; border: 1px solid #d1d5db; padding: 10px; font-size: 13px;
    font-family: inherit; resize: none; white-space: pre-wrap;
  }
  .report-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  .report-actions button {
    height: 42px; border-radius: 10px; border: 1px solid #d1d5db; background: #f9fafb;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }
  #whatsapp-share-btn { background: #25d366; border-color: #25d366; color: #fff; }
  .report-back-btn {
    display: block; width: 100%; margin-top: 10px; height: 42px; border-radius: 10px;
    border: none; background: transparent; color: #6b7280; font-size: 13px; font-weight: 600; cursor: pointer;
  }
</style>
</head>
<body>
  <header class="page-head">
    <h1>${escapeHtml(halaqaName)}</h1>
    <p>المعلم: ${escapeHtml(teacherName)}</p>
    <p>آخر تحديث: ${escapeHtml(generatedAtLabel)}</p>
  </header>

  <div class="meta-row">
    <label>التاريخ <input type="date" id="session-date" /></label>
  </div>

  <div id="error-summary">
    <strong>يرجى إكمال البيانات التالية قبل الإرسال:</strong>
    <ul id="error-list"></ul>
  </div>

  <div id="cards">${cardsHtml}</div>

  <footer class="submit-bar">
    <button type="button" id="continue-btn">📋 متابعة — عرض تقرير اليوم</button>
    <p class="submit-hint">بعد الضغط على إرسال، افتح تيليجرام واضغط على زر الإرسال لإكمال العملية</p>
    <button type="button" id="submit-btn">إرسال البيانات عبر تيليجرام</button>
  </footer>

  <div id="report-overlay" class="report-overlay hidden">
    <div class="report-panel">
      <h2>تقرير الحصة اليومية</h2>
      <textarea id="report-textarea" class="report-textarea" rows="14" readonly></textarea>
      <div class="report-actions">
        <button type="button" id="copy-report-btn">نسخ التقرير</button>
        <button type="button" id="whatsapp-share-btn">مشاركة عبر واتساب</button>
      </div>
      <button type="button" id="report-back-btn" class="report-back-btn">رجوع للتعديل</button>
    </div>
  </div>

<script>
(function () {
  "use strict";

  var ISTQ_PREFIX = "ISTQ|";
  var TEACHER_ID = "${escapeJsString(teacherId)}";
  var HALAQA_ID = "${escapeJsString(halaqaId)}";
  var HALAQA_NAME = "${escapeJsString(halaqaName)}";
  var TEACHER_NAME = "${escapeJsString(teacherName)}";
  var BOT_USERNAME = "${escapeJsString(botUsername)}";
  var FORBIDDEN_CHARS = /[:;_|]/g;
  var RATING_OPTIONS_HTML = ${embedJson(RATING_BUTTONS_HTML)};
  var RATING_AR = ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"];
  var ATT_LABEL = { P: "حاضر", L: "متأخر", A: "غائب", E: "معذور" };

  var SURAHS = ${embedJson(surahs)};
  var SURAH_MAP = {};
  SURAHS.forEach(function (s) { SURAH_MAP[s.number] = s; });

  function todayLocalIso() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  var dateInput = document.getElementById("session-date");
  var today = todayLocalIso();
  dateInput.value = today;
  dateInput.max = today;

  // ── Surah <select> population ─────────────────────────────────────────
  function buildSurahOptionsHtml(placeholder) {
    var html = "<option value=\\"\\">" + placeholder + "</option>";
    SURAHS.forEach(function (s) {
      html += "<option value=\\"" + s.number + "\\">" + s.number + ". " + s.nameAr + "</option>";
    });
    return html;
  }

  // ── Dynamic حفظ/مراجعة/واجب الغد entry rows ─────────────────────────────
  // kind "full" (حفظ جديد / مراجعة) includes pages/rating/mistakes; kind
  // "homework" is surah + ayah range or كاملة only — no rating fields.
  function createEntryRow(kind) {
    var isHomework = kind === "homework";
    var row = document.createElement("div");
    row.className = "entry-row";
    var extraFields = isHomework ? "" :
      '<label class="pages-row-label">عدد الصفحات<input type="number" class="entry-pages" min="0.5" step="0.5" /></label>' +
      '<div class="rating-row">' + RATING_OPTIONS_HTML + '</div>' +
      '<label class="mistakes-row">عدد الأخطاء<input type="number" class="entry-mistakes" min="0" value="0" /></label>';
    row.innerHTML =
      '<div class="entry-top">' +
        '<select class="entry-surah surah-select"></select>' +
        '<button type="button" class="remove-entry-btn" aria-label="حذف">✕</button>' +
      '</div>' +
      '<div class="entry-fields hidden">' +
        '<label class="completed-row"><input type="checkbox" class="entry-completed" /><span>' +
          (isHomework ? "السورة كاملة" : "تم الحفظ كاملاً") + '</span></label>' +
        '<div class="ayah-row">' +
          '<label>من آية<input type="number" class="entry-from-ayah" min="1" value="1" /></label>' +
          '<label>إلى آية<input type="number" class="entry-to-ayah" min="1" /></label>' +
        '</div>' +
        extraFields +
      '</div>';

    var select = row.querySelector(".entry-surah");
    select.innerHTML = buildSurahOptionsHtml("اختر سورة");
    var fieldsEl = row.querySelector(".entry-fields");
    var fromInp = row.querySelector(".entry-from-ayah");
    var toInp = row.querySelector(".entry-to-ayah");
    var completedCb = row.querySelector(".entry-completed");

    select.addEventListener("change", function () {
      var num = select.value;
      fieldsEl.classList.toggle("hidden", !num);
      if (num) {
        var s = SURAH_MAP[num];
        fromInp.value = "1";
        toInp.value = s ? String(s.ayahCount) : "";
        fromInp.readOnly = false;
        toInp.readOnly = false;
        completedCb.checked = false;
      }
      validateAll();
    });

    completedCb.addEventListener("change", function () {
      var num = select.value;
      var s = SURAH_MAP[num];
      if (completedCb.checked && s) {
        fromInp.value = "1";
        toInp.value = String(s.ayahCount);
        fromInp.readOnly = true;
        toInp.readOnly = true;
      } else {
        fromInp.readOnly = false;
        toInp.readOnly = false;
      }
      validateAll();
    });

    row.querySelectorAll(".rating-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        row.querySelectorAll(".rating-btn").forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        validateAll();
      });
    });

    row.querySelectorAll(".entry-from-ayah, .entry-to-ayah, .entry-pages, .entry-mistakes").forEach(function (inp) {
      inp.addEventListener("input", validateAll);
    });

    row.querySelector(".remove-entry-btn").addEventListener("click", function () {
      row.remove();
      validateAll();
    });

    return row;
  }

  document.querySelectorAll(".add-entry-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var section = btn.closest(".section-block");
      var kind = section.getAttribute("data-rec-type") === "HOMEWORK" ? "homework" : "full";
      section.querySelector(".entries-list").appendChild(createEntryRow(kind));
    });
  });

  // ── Per-card wiring: attendance, لم يُسمَع, homework, general note ─────
  document.querySelectorAll(".card").forEach(function (card) {
    var attRow = card.querySelector(".att-row");
    var hifzArea = card.querySelector(".hifz-area");
    var attHint = card.querySelector(".att-hint");
    var todaySections = card.querySelector(".today-sections");
    var dnrCb = card.querySelector(".dnr-cb");

    attRow.querySelectorAll(".att-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        attRow.querySelectorAll(".att-btn").forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        var code = btn.getAttribute("data-att");
        var isPresent = code === "P" || code === "L";
        hifzArea.classList.toggle("hidden", !isPresent);
        attHint.classList.add("hidden");
        validateAll();
      });
    });

    dnrCb.addEventListener("change", function () {
      todaySections.classList.toggle("hidden", dnrCb.checked);
      validateAll();
    });

    var noteField = card.querySelector(".note-field");
    var noteCounter = card.querySelector(".note-counter");
    noteField.addEventListener("input", function () {
      noteField.value = noteField.value.replace(FORBIDDEN_CHARS, " ").slice(0, 100);
      noteCounter.textContent = noteField.value.length + "/100";
    });
  });

  // ── Single source of truth: read one card's full state ────────────────
  function readEntries(sectionEl, name, problems) {
    var list = [];
    sectionEl.querySelectorAll(".entry-row").forEach(function (row) {
      var surah = row.querySelector(".entry-surah").value;
      if (!surah) return;
      var completed = row.querySelector(".entry-completed").checked;
      var from = row.querySelector(".entry-from-ayah").value || "1";
      var to = row.querySelector(".entry-to-ayah").value;
      var pages = row.querySelector(".entry-pages").value;
      var ratingBtn = row.querySelector(".rating-btn.selected");
      var rating = ratingBtn ? ratingBtn.getAttribute("data-rating") : "";
      var mistakes = row.querySelector(".entry-mistakes").value || "0";
      if (!rating || (!completed && !to)) {
        problems.push(name + ": بيانات سورة غير مكتملة");
        return;
      }
      list.push({
        surah: surah,
        from: from,
        to: completed ? String(SURAH_MAP[surah].ayahCount) : to,
        completed: completed,
        pages: pages,
        rating: rating,
        mistakes: mistakes,
      });
    });
    return list;
  }

  function readHomeworkEntries(sectionEl, name, problems) {
    var list = [];
    sectionEl.querySelectorAll(".entry-row").forEach(function (row) {
      var surah = row.querySelector(".entry-surah").value;
      if (!surah) return;
      var completed = row.querySelector(".entry-completed").checked;
      var from = row.querySelector(".entry-from-ayah").value || "1";
      var to = row.querySelector(".entry-to-ayah").value;
      if (!completed && !to) {
        problems.push(name + ": بيانات واجب الغد غير مكتملة");
        return;
      }
      list.push({
        surah: surah,
        from: from,
        to: completed ? String(SURAH_MAP[surah].ayahCount) : to,
        completed: completed,
      });
    });
    return list;
  }

  function readCardState(card) {
    var studentId = card.getAttribute("data-student-id");
    var name = card.getAttribute("data-student-name");
    var attBtn = card.querySelector(".att-btn.selected");
    var attCode = attBtn ? attBtn.getAttribute("data-att") : "";
    var isPresent = attCode === "P" || attCode === "L";
    var dnr = isPresent && card.querySelector(".dnr-cb").checked;
    var problems = [];

    if (!attCode) problems.push(name + ": لم يُحدَّد الحضور");

    var hifzEntries = [], murajaEntries = [], generalNote = "", homeworkEntries = [];

    if (isPresent) {
      if (!dnr) {
        hifzEntries = readEntries(card.querySelector('.section-block[data-rec-type="NEW"]'), name, problems);
        murajaEntries = readEntries(card.querySelector('.section-block[data-rec-type="RECENT_REVISION"]'), name, problems);
        if (hifzEntries.length === 0 && murajaEntries.length === 0) {
          problems.push(name + ': أضف حفظاً أو اضغط "لم يُسمَع اليوم"');
        }
      }

      var noteField = card.querySelector(".note-field");
      generalNote = (noteField.value || "").replace(FORBIDDEN_CHARS, " ").trim().slice(0, 100);

      homeworkEntries = readHomeworkEntries(card.querySelector('.section-block[data-rec-type="HOMEWORK"]'), name, problems);
    }

    return {
      studentId: studentId, name: name, attCode: attCode, isPresent: isPresent, dnr: dnr,
      hifzEntries: hifzEntries, murajaEntries: murajaEntries, generalNote: generalNote,
      homeworkEntries: homeworkEntries, problems: problems,
    };
  }

  // ── Validation ───────────────────────────────────────────────────────
  function validateAll() {
    var allProblems = [];
    document.querySelectorAll(".card").forEach(function (card) {
      var state = readCardState(card);
      var cardErrorEl = card.querySelector(".card-error");
      if (state.problems.length > 0) {
        card.classList.add("has-error");
        cardErrorEl.textContent = state.problems.join(" — ");
        cardErrorEl.classList.remove("hidden");
        allProblems = allProblems.concat(state.problems);
      } else {
        card.classList.remove("has-error");
        cardErrorEl.classList.add("hidden");
      }
    });

    var summary = document.getElementById("error-summary");
    var list = document.getElementById("error-list");
    if (allProblems.length > 0) {
      list.innerHTML = allProblems.map(function (p) { return "<li>" + p + "</li>"; }).join("");
      summary.style.display = "block";
    } else {
      summary.style.display = "none";
    }
    document.getElementById("continue-btn").disabled = allProblems.length > 0;
    document.getElementById("submit-btn").disabled = allProblems.length > 0;
    return allProblems.length === 0;
  }

  // ── Payload building (surah/ayah entries — no واجب الغد) ───────────────
  function entryToPart(type, e) {
    return [type, e.surah, e.from, e.to, e.completed ? "1" : "0", e.pages || "", e.rating, e.mistakes].join(":");
  }

  function buildStudentBlock(state) {
    var parts = [];
    state.hifzEntries.forEach(function (e) { parts.push(entryToPart("N", e)); });
    state.murajaEntries.forEach(function (e) { parts.push(entryToPart("R", e)); });
    var note = state.isPresent ? state.generalNote : "";
    return [state.studentId, state.attCode, parts.join("_"), note].join(":");
  }

  function buildPayload() {
    var dateStr = dateInput.value;
    var blocks = [];
    document.querySelectorAll(".card").forEach(function (card) {
      blocks.push(buildStudentBlock(readCardState(card)));
    });
    return ISTQ_PREFIX + [TEACHER_ID, HALAQA_ID, dateStr, blocks.join(";")].join("|");
  }

  // ── Report building (mirrors the online group report, plus واجب الغد) ──
  function surahName(num) {
    var s = SURAH_MAP[num];
    return s ? s.nameAr : ("سورة " + num);
  }
  function fmtAyahs(e) {
    return e.completed ? "(كاملة)" : (e.from + "–" + e.to);
  }
  function fmtHifzEntry(e) {
    var pages = e.pages ? (" " + e.pages + "ص") : "";
    var rating = RATING_AR[e.rating] || "";
    var mistakesNum = parseInt(e.mistakes, 10) || 0;
    var mistakes = mistakesNum > 0 ? (" أخطاء:" + mistakesNum) : "";
    return surahName(e.surah) + " " + fmtAyahs(e) + pages + " ⭐" + rating + mistakes;
  }
  function fmtSimpleEntry(e) {
    return surahName(e.surah) + " " + fmtAyahs(e);
  }

  function buildReport() {
    var dateStr = dateInput.value;
    var lines = [
      "📚 تقرير حلقة " + HALAQA_NAME,
      "📅 " + dateStr,
      "👨‍🏫 المعلم: " + TEACHER_NAME,
      "─────────────────",
    ];
    var absentList = [];

    document.querySelectorAll(".card").forEach(function (card) {
      var state = readCardState(card);
      if (!state.attCode) return;

      if (!state.isPresent) {
        absentList.push(state.name + " (" + ATT_LABEL[state.attCode] + ")");
        return;
      }

      lines.push("👤 " + state.name + " — " + ATT_LABEL[state.attCode]);

      if (state.dnr) {
        lines.push("   📖 لم يُسمَع اليوم");
      } else {
        if (state.hifzEntries.length > 0) {
          lines.push("   📖 حفظ: " + state.hifzEntries.map(fmtHifzEntry).join(" | "));
        } else {
          lines.push("   📖 لا حفظ جديد");
        }
        if (state.murajaEntries.length > 0) {
          lines.push("   🔄 مراجعة: " + state.murajaEntries.map(fmtSimpleEntry).join(" | "));
        }
      }

      if (state.homeworkEntries.length > 0) {
        lines.push("   📝 واجب الغد: " + state.homeworkEntries.map(fmtSimpleEntry).join(" | "));
      }
      if (state.generalNote) {
        lines.push("   💬 " + state.generalNote);
      }
    });

    if (absentList.length > 0) {
      lines.push("─────────────────");
      lines.push("❌ الغياب: " + absentList.join("، "));
    }
    lines.push("─────────────────");
    lines.push("بارك الله في جميع الطلاب 🤲");
    return lines.join("\\n");
  }

  // ── متابعة → report overlay → واتساب / رجوع ────────────────────────────
  document.getElementById("continue-btn").addEventListener("click", function () {
    if (!validateAll()) {
      document.getElementById("error-summary").scrollIntoView({ behavior: "smooth" });
      return;
    }
    document.getElementById("report-textarea").value = buildReport();
    document.getElementById("report-overlay").classList.remove("hidden");
  });

  document.getElementById("report-back-btn").addEventListener("click", function () {
    document.getElementById("report-overlay").classList.add("hidden");
  });

  document.getElementById("copy-report-btn").addEventListener("click", function () {
    var ta = document.getElementById("report-textarea");
    ta.focus();
    ta.select();
    var copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value);
        copied = true;
      }
    } catch (e) { /* fall through to execCommand */ }
    if (!copied) {
      try { copied = document.execCommand("copy"); } catch (e) { /* manual copy remains available — text stays selected */ }
    }
    var btn = document.getElementById("copy-report-btn");
    var original = btn.textContent;
    btn.textContent = copied ? "✓ تم النسخ" : "انسخ يدوياً (محدَّد)";
    setTimeout(function () { btn.textContent = original; }, 2000);
  });

  document.getElementById("whatsapp-share-btn").addEventListener("click", function () {
    var text = document.getElementById("report-textarea").value;
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  });

  // ── إرسال عبر تيليجرام (unchanged mechanism, new payload shape) ────────
  document.getElementById("submit-btn").addEventListener("click", function () {
    if (!validateAll()) {
      document.getElementById("error-summary").scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!BOT_USERNAME) {
      alert("لم يتم إعداد بوت تيليجرام بعد — يرجى التواصل مع الإدارة");
      return;
    }
    var payload = buildPayload();
    var url = "https://t.me/" + BOT_USERNAME + "?text=" + encodeURIComponent(payload);
    window.location.href = url;
  });
})();
</script>
</body>
</html>`
}
