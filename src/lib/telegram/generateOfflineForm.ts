// Generates the fully self-contained, offline-capable static HTML page a
// teacher downloads to submit a daily session via Telegram when they have
// no connectivity. No prisma/server-only imports here — both the teacher
// and admin routes call this from a client component so the download can
// be built (and rebuilt on dropdown change) without a server round-trip.
// See docs/telegram-architecture.md §9 for the design this implements.

export interface OfflineFormRosterStudent {
  id: string
  fullName: string
}

export interface OfflineFormOptions {
  teacherId: string
  halaqaId: string
  halaqaName: string
  teacherName: string
  roster: OfflineFormRosterStudent[]
  botUsername: string
  generatedAt: Date
}

const MAX_MUSHAF_PAGE = 604

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

const HIFZ_TYPES = [
  { code: "N", label: "سبق (جديد)" },
  { code: "R", label: "سبقي (مراجعة قريبة)" },
  { code: "O", label: "منزل (مراجعة بعيدة)" },
]

const RATING_OPTIONS = [
  { value: 4, label: "ممتاز" },
  { value: 3, label: "جيد جداً" },
  { value: 2, label: "جيد" },
  { value: 1, label: "يحتاج إعادة" },
]

function studentCardHtml(s: OfflineFormRosterStudent): string {
  const attButtons = ATTENDANCE_OPTIONS.map(
    (o) => `<button type="button" class="att-btn" data-att="${o.code}">${o.label}</button>`
  ).join("")

  const hifzTypeBlocks = HIFZ_TYPES.map(
    (t) => `
      <div class="hifz-type" data-type="${t.code}">
        <label class="type-toggle">
          <input type="checkbox" class="type-active-cb" />
          <span>${t.label}</span>
        </label>
        <div class="type-fields hidden">
          <div class="field-row">
            <label>من صفحة<input type="number" class="f-from" min="1" max="${MAX_MUSHAF_PAGE}" inputmode="numeric" /></label>
            <label>إلى صفحة<input type="number" class="f-to" min="1" max="${MAX_MUSHAF_PAGE}" inputmode="numeric" /></label>
          </div>
          <div class="rating-row">
            ${RATING_OPTIONS.map((r) => `<button type="button" class="rating-btn" data-rating="${r.value}">${r.label}</button>`).join("")}
          </div>
          <label class="mistakes-row">عدد الأخطاء
            <input type="number" class="f-mistakes" min="0" inputmode="numeric" value="0" />
          </label>
        </div>
      </div>`
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
      <div class="hifz-types">${hifzTypeBlocks}</div>
      <label class="note-label">ملاحظة (اختياري)
        <textarea class="note-field" maxlength="100" rows="2" placeholder="حتى 100 حرف — بدون : ; _ |"></textarea>
      </label>
      <div class="note-counter">0/100</div>
    </div>
    <div class="att-hint">اختر حالة الحضور أولاً</div>
    <div class="card-error"></div>
  </div>`
}

export function generateOfflineFormHtml(opts: OfflineFormOptions): string {
  const { teacherId, halaqaId, halaqaName, teacherName, roster, botUsername, generatedAt } = opts

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
    padding-bottom: 100px;
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
  .hifz-type { border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; margin-bottom: 8px; }
  .type-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .type-fields { margin-top: 8px; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field-row label { font-size: 12px; color: #6b7280; display: flex; flex-direction: column; gap: 4px; }
  .field-row input { height: 36px; border-radius: 8px; border: 1px solid #d1d5db; padding: 0 8px; font-size: 14px; text-align: center; }
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
  .card-error { display: none; font-size: 12px; color: #b91c1c; margin-top: 6px; font-weight: 600; }
  .hidden { display: none !important; }
  footer.submit-bar {
    position: fixed; inset-inline: 0; bottom: 0; background: #fff;
    border-top: 1px solid #e5e7eb; padding: 10px 12px; box-shadow: 0 -2px 8px rgba(0,0,0,.05);
  }
  footer.submit-bar p { margin: 0 0 8px; font-size: 12px; color: #6b7280; text-align: center; }
  #submit-btn {
    width: 100%; height: 48px; border: none; border-radius: 10px;
    background: #16a34a; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
  }
  #submit-btn:disabled { background: #9ca3af; cursor: not-allowed; }
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
    <p>بعد الضغط على إرسال، افتح تيليجرام واضغط على زر الإرسال لإكمال العملية</p>
    <button type="button" id="submit-btn">إرسال عبر تيليجرام</button>
  </footer>

<script>
(function () {
  "use strict";

  var ISTQ_PREFIX = "ISTQ|";
  var TEACHER_ID = "${escapeJsString(teacherId)}";
  var HALAQA_ID = "${escapeJsString(halaqaId)}";
  var BOT_USERNAME = "${escapeJsString(botUsername)}";
  var MAX_PAGE = ${MAX_MUSHAF_PAGE};
  var FORBIDDEN_CHARS = /[:;_|]/g;

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

  // ── Attendance buttons ──────────────────────────────────────────────
  document.querySelectorAll(".card").forEach(function (card) {
    var attRow = card.querySelector(".att-row");
    var hifzArea = card.querySelector(".hifz-area");
    var attHint = card.querySelector(".att-hint");

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

    var dnrCb = card.querySelector(".dnr-cb");
    var hifzTypes = card.querySelector(".hifz-types");
    dnrCb.addEventListener("change", function () {
      hifzTypes.classList.toggle("hidden", dnrCb.checked);
      validateAll();
    });

    card.querySelectorAll(".hifz-type").forEach(function (typeEl) {
      var cb = typeEl.querySelector(".type-active-cb");
      var fields = typeEl.querySelector(".type-fields");
      cb.addEventListener("change", function () {
        fields.classList.toggle("hidden", !cb.checked);
        validateAll();
      });

      typeEl.querySelectorAll(".rating-btn").forEach(function (rb) {
        rb.addEventListener("click", function () {
          typeEl.querySelectorAll(".rating-btn").forEach(function (b) { b.classList.remove("selected"); });
          rb.classList.add("selected");
          validateAll();
        });
      });

      typeEl.querySelectorAll(".f-from, .f-to, .f-mistakes").forEach(function (inp) {
        inp.addEventListener("input", validateAll);
      });
    });

    var noteField = card.querySelector(".note-field");
    var noteCounter = card.querySelector(".note-counter");
    noteField.addEventListener("input", function () {
      noteField.value = noteField.value.replace(FORBIDDEN_CHARS, " ").slice(0, 100);
      noteCounter.textContent = noteField.value.length + "/100";
    });
  });

  // ── Validation ───────────────────────────────────────────────────────
  function validateAll() {
    var problems = [];
    document.querySelectorAll(".card").forEach(function (card) {
      var name = card.getAttribute("data-student-name");
      var cardErrorEl = card.querySelector(".card-error");
      var cardProblems = [];

      var attBtn = card.querySelector(".att-btn.selected");
      if (!attBtn) {
        cardProblems.push("لم يُحدَّد الحضور");
      } else {
        var code = attBtn.getAttribute("data-att");
        var isPresent = code === "P" || code === "L";
        if (isPresent) {
          var dnr = card.querySelector(".dnr-cb").checked;
          if (!dnr) {
            var anyActive = false;
            card.querySelectorAll(".hifz-type").forEach(function (typeEl) {
              var active = typeEl.querySelector(".type-active-cb").checked;
              if (!active) return;
              anyActive = true;
              var from = parseInt(typeEl.querySelector(".f-from").value, 10);
              var to = parseInt(typeEl.querySelector(".f-to").value, 10);
              var ratingBtn = typeEl.querySelector(".rating-btn.selected");
              if (!from || from < 1 || from > MAX_PAGE) cardProblems.push("صفحة البداية غير صحيحة");
              if (!to || to < 1 || to > MAX_PAGE) cardProblems.push("صفحة النهاية غير صحيحة");
              if (!ratingBtn) cardProblems.push("التقييم مطلوب");
            });
            if (!anyActive) cardProblems.push('أضف تسميعاً أو اضغط "لم يُسمَع اليوم"');
          }
        }
      }

      if (cardProblems.length > 0) {
        card.classList.add("has-error");
        cardErrorEl.textContent = cardProblems.join(" — ");
        cardErrorEl.classList.remove("hidden");
        problems.push(name + ": " + cardProblems.join("، "));
      } else {
        card.classList.remove("has-error");
        cardErrorEl.classList.add("hidden");
      }
    });

    var summary = document.getElementById("error-summary");
    var list = document.getElementById("error-list");
    if (problems.length > 0) {
      list.innerHTML = problems.map(function (p) { return "<li>" + p + "</li>"; }).join("");
      summary.style.display = "block";
    } else {
      summary.style.display = "none";
    }
    document.getElementById("submit-btn").disabled = problems.length > 0;
    return problems.length === 0;
  }

  // ── Payload building ────────────────────────────────────────────────
  function buildStudentBlock(card) {
    var studentId = card.getAttribute("data-student-id");
    var attBtn = card.querySelector(".att-btn.selected");
    var attCode = attBtn.getAttribute("data-att");
    var isPresent = attCode === "P" || attCode === "L";
    var dnr = isPresent && card.querySelector(".dnr-cb").checked;

    var hifzParts = [];
    if (isPresent && !dnr) {
      card.querySelectorAll(".hifz-type").forEach(function (typeEl) {
        var active = typeEl.querySelector(".type-active-cb").checked;
        if (!active) return;
        var typeCode = typeEl.getAttribute("data-type");
        var from = typeEl.querySelector(".f-from").value;
        var to = typeEl.querySelector(".f-to").value;
        var ratingBtn = typeEl.querySelector(".rating-btn.selected");
        var rating = ratingBtn ? ratingBtn.getAttribute("data-rating") : "";
        var mistakes = typeEl.querySelector(".f-mistakes").value || "0";
        if (from && to && rating) {
          hifzParts.push([typeCode, from, to, rating, mistakes].join(":"));
        }
      });
    }

    var noteField = card.querySelector(".note-field");
    var note = (noteField.value || "").replace(FORBIDDEN_CHARS, " ").trim().slice(0, 100);

    return [studentId, attCode, hifzParts.join("_"), note].join(":");
  }

  function buildPayload() {
    var dateStr = dateInput.value;
    var blocks = [];
    document.querySelectorAll(".card").forEach(function (card) {
      blocks.push(buildStudentBlock(card));
    });
    return ISTQ_PREFIX + [TEACHER_ID, HALAQA_ID, dateStr, blocks.join(";")].join("|");
  }

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
