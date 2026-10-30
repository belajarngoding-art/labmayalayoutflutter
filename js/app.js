const STORAGE_KEY = "flutterLearningLabMvp";
const initialState = { completed: [], quizScore: null, quizIndex: 0, quizAnswers: {}, quizSubmitted: false, projectChecks: [], materialIndex: 0, lastPage: "beranda", studentName: "", studentClass: "", certificateIssued: false };
let state = loadState();
const content = document.getElementById("konten");

function loadState() {
  try { return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return { ...initialState }; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
// Audio UI: desis singkat saat menu disorot, bip pendek saat diklik.
let uiAudioContext = null;
let activeHissSource = null;
let activeHissGain = null;
function getUiAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  // Jangan membuat AudioContext dari hover pertama: Chrome dapat memblokirnya
  // sebelum ada interaksi pengguna. Klik/tekan tombol pertama mengaktifkan audio.
  const hasUserActivation = !navigator.userActivation || navigator.userActivation.isActive;
  if (!uiAudioContext || uiAudioContext.state === "closed") {
    if (!hasUserActivation) return null;
    uiAudioContext = new AudioCtx();
  }

  if (uiAudioContext.state === "suspended" && hasUserActivation) {
    uiAudioContext.resume().catch(() => {});
  }
  return uiAudioContext;
}
function stopMenuHiss() {
  if (!uiAudioContext || !activeHissSource) return;
  try {
    const now = uiAudioContext.currentTime;
    if (activeHissGain) {
      activeHissGain.gain.cancelScheduledValues(now);
      activeHissGain.gain.setTargetAtTime(0.0001, now, 0.006);
    }
    activeHissSource.stop(now + 0.035);
  } catch (_) {}
  activeHissSource = null;
  activeHissGain = null;
}
function playUiSound(kind = "click") {
  try {
    const ctx = getUiAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === "hover") {
      // Hindari suara desis bertumpuk saat kursor bergerak di dalam kontrol.
      stopMenuHiss();
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(3600, now);
      filter.Q.setValueAtTime(0.75, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      activeHissSource = noise;
      activeHissGain = gain;
      noise.onended = () => {
        try { noise.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) {}
        if (activeHissSource === noise) { activeHissSource = null; activeHissGain = null; }
      };
      noise.start(now);
      noise.stop(now + 0.125);
      return;
    }
    if (kind !== "click") return;
    // Saat diklik, hentikan desis lebih dahulu lalu bunyikan bip saja.
    stopMenuHiss();
    const duration = 0.045;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1050, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + duration);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.005);
    osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (_) {} };
  } catch (_) { /* Audio tidak didukung atau diblokir browser. */ }
}
function playLabButtonSound() { playUiSound("click"); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function progressPercent() { return Math.round((state.completed.filter(k => ["materi", "lab", "kuis", "proyek"].includes(k)).length / 4) * 100); }
const learningOrder = ["materi", "lab", "kuis", "proyek"];
const pageForStep = { materi: "materi", lab: "lab", kuis: "kuis", proyek: "proyek" };
function canAccess(page) {
  if (page === "beranda" || page === "identitas") return true;
  if (page === "materi") return Boolean(state.studentName && state.studentClass);
  if (page === "lab") return state.completed.includes("materi");
  if (page === "kuis") return state.completed.includes("materi") && state.completed.includes("lab");
  if (page === "proyek") return state.completed.includes("materi") && state.completed.includes("lab") && state.completed.includes("kuis");
  if (page === "sertifikat") return Boolean(state.certificateIssued && state.completed.includes("proyek"));
  return false;
}
function firstUnlockedPage(page) {
  if (canAccess(page)) return page;
  if (!state.studentName || !state.studentClass) return "identitas";
  if (!state.completed.includes("materi")) return "materi";
  if (!state.completed.includes("lab")) return "lab";
  if (!state.completed.includes("kuis")) return "kuis";
  return "proyek";
}
function updateNavigationLocks() {
  document.querySelectorAll(".nav-link[data-page]").forEach(button => {
    const page = button.dataset.page;
    const locked = !canAccess(page);
    button.disabled = locked;
    button.classList.toggle("locked", locked);
    button.setAttribute("aria-disabled", String(locked));
    button.title = locked ? `Selesaikan bagian sebelumnya untuk membuka ${button.textContent.trim()}.` : "";
    const label = button.dataset.baseLabel || button.textContent.replace(/^🔒\s*/, "");
    button.dataset.baseLabel = label;
    button.textContent = locked ? `🔒 ${label}` : label;
  });
}
function markComplete(key) {
  if (!state.completed.includes(key)) state.completed.push(key);
  saveState(); render();
}
function navTo(page) {
  if (!canAccess(page)) {
    const target = firstUnlockedPage(page);
    const message = page === "lab" ? "Selesaikan Materi terlebih dahulu untuk membuka Lab Maya." :
      page === "kuis" ? "Selesaikan Materi dan Lab Maya terlebih dahulu untuk membuka Kuis." :
      page === "proyek" ? "Selesaikan Materi, Lab Maya, dan Kuis terlebih dahulu untuk membuka Proyek Mini." :
      "Selesaikan bagian sebelumnya terlebih dahulu.";
    if (page !== "beranda" && page !== "materi") alert(message);
    page = target;
  }
  state.lastPage = page; saveState();
  document.getElementById("mainNav").classList.remove("open");
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-page]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); navTo(b.dataset.page); }));
document.getElementById("mobileMenu").addEventListener("click", () => document.getElementById("mainNav").classList.toggle("open"));

function render() {
  let page = state.lastPage || "beranda";
  if (!canAccess(page)) page = firstUnlockedPage(page);
  state.lastPage = page;
  saveState();
  updateNavigationLocks();
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  const views = { beranda: homePage, identitas: identityPage, materi: materialPage, lab: labPage, kuis: quizPage, proyek: projectPage, sertifikat: certificatePage };
  content.innerHTML = (views[page] || homePage)();
  if (page === "identitas") initIdentity();
  if (page === "lab") initLab();
  if (page === "kuis") initQuiz();
  if (page === "proyek") initProject();
}
function homePage() {
  const completed = state.completed.filter(k => ["materi", "lab", "kuis", "proyek"].includes(k)).length;
  const cardButton = (page, label, key) => {
    const unlocked = canAccess(page);
    const done = state.completed.includes(key);
    return `<button class="btn ${unlocked ? "btn-light" : "btn-locked"}" data-action="${page}" ${unlocked ? "" : "disabled"} ${unlocked ? "" : "title=\"Selesaikan bagian sebelumnya terlebih dahulu.\""}>${done ? "Buka kembali" : unlocked ? label : "🔒 Terkunci"} →</button>`;
  };
  return `
  <section class="hero">
    <div><span class="eyebrow">Media Pembelajaran Interaktif · SMK</span>
      <h3>Konsentrasi Keahlian : Rekayasa Perangkat Lunak</h3>
      <h1>Belajar Flutter dengan cara mencoba (simulasi).</h1>
      <p>Pelajari layout aplikasi, eksperimen dengan simulasi, uji pemahaman, lalu buat kartu profil siswa menggunakan Flutter dan Dart.</p>
      <button class="btn btn-primary" data-action="start">Mulai Belajar <span>→</span></button>
      <div class="stat-row"><div class="stat"><strong>${completed}/4</strong><span>Aktivitas selesai</span></div><div class="stat"><strong>${state.quizScore === null ? "—" : state.quizScore + "%"}</strong><span>Nilai kuis</span></div><div class="stat"><strong>1</strong><span>Modul aktif</span></div></div>
    </div>
    <div class="hero-graphic"><div class="phone"><div class="phone-top"></div><div class="phone-block"></div><div class="phone-row"><span></span><span></span></div><div class="phone-block"></div><div class="phone-row"><span></span><span></span></div><div class="phone-block"></div></div></div>
  </section>
  <div class="section-head"><div><h2>Jalur belajar</h2><p>Selesaikan setiap bagian secara berurutan. Bagian berikutnya terbuka setelah bagian sebelumnya dituntaskan.</p></div><span class="tag">Modul 5 · Layout Flutter</span></div>
  <div class="card"><div class="section-head" style="margin:0 0 12px"><strong>Progres pembelajaran</strong><strong>${progressPercent()}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progressPercent()}%"></div></div><p style="margin:10px 0 0">Progres tersimpan di browser pada perangkat ini.</p></div>
  <div class="grid grid-4 learning-cards" style="margin-top:16px">
    <article class="card"><div class="card-icon">📘</div><span class="tag">${state.completed.includes("materi") ? "Selesai" : "Bagian 1"}</span><h3 style="margin-top:12px">Pelajari Konsep Layout</h3><p>Pahami Container, Row, Column, dan alignment.</p>${cardButton("materi","Buka materi","materi")}</article>
    <article class="card"><div class="card-icon">🧪</div><span class="tag">${state.completed.includes("lab") ? "Selesai" : "Bagian 2"}</span><h3 style="margin-top:12px">Eksperimen di Lab Maya</h3><p>Ubah arah susunan, alignment, dan jarak widget pada simulasi.</p>${cardButton("lab","Buka lab","lab")}</article>
    <article class="card"><div class="card-icon">📝</div><span class="tag">${state.completed.includes("kuis") ? "Selesai" : "Bagian 3"}</span><h3 style="margin-top:12px">Uji Pemahaman</h3><p>Jawab lima soal untuk mengukur pemahaman tentang layout Flutter.</p>${cardButton("kuis","Mulai kuis","kuis")}</article>
    <article class="card"><div class="card-icon">🧩</div><span class="tag">${state.completed.includes("proyek") ? "Selesai" : "Bagian 4"}</span><h3 style="margin-top:12px">Proyek Mini</h3><p>Praktikkan konsep dengan membuat Kartu Profil Siswa menggunakan Flutter.</p>${cardButton("proyek","Mulai proyek","proyek")}</article>
  </div>`;
}
function identityPage() {
  return `<div class="page-heading"><span class="eyebrow" style="color:var(--blue)">SELAMAT DATANG</span><h2>Identitas Peserta Didik</h2><p>Isi nama dan kelas sebelum memulai perjalanan belajar. Identitas ini akan digunakan pada sertifikat hasil pembelajaran.</p></div>
  <section class="card identity-card">
    <div class="identity-emblem">✦</div><span class="tag">FORMULIR PESERTA</span>
    <h3>Mulai perjalanan belajarmu</h3>
    <p>Masukkan identitas dengan benar agar sertifikat dapat diterbitkan atas nama Anda.</p>
    <form id="studentIdentityForm">
      <label class="field">Nama lengkap murid<input id="studentName" name="studentName" autocomplete="name" maxlength="100" required placeholder="Contoh: Siti Rahmawati" value="${escapeHtml(state.studentName || "")}"></label>
      <label class="field">Kelas<input id="studentClass" name="studentClass" maxlength="40" required placeholder="Contoh: XI RPL 1" value="${escapeHtml(state.studentClass || "")}"></label>
      <div id="identityError" class="feedback" hidden></div>
      <button class="btn btn-primary identity-submit" type="submit">Simpan & Mulai Belajar <span>→</span></button>
    </form>
    <div class="identity-privacy">♧ Identitas disimpan secara lokal di browser perangkat ini.</div>
  </section>`;
}
function initIdentity() {
  document.getElementById("studentIdentityForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const name = document.getElementById("studentName").value.trim();
    const klass = document.getElementById("studentClass").value.trim();
    if (!name || !klass) {
      const err = document.getElementById("identityError");
      err.hidden = false; err.className = "feedback bad"; err.textContent = "Nama dan kelas wajib diisi.";
      return;
    }
    state.studentName = name; state.studentClass = klass;
    state.lastPage = "materi"; saveState(); navTo("materi");
  });
}

const materialSlides = [
  {
    title: "5.1 Mengenal widget dan layout",
    body: `<p>Flutter membangun antarmuka dari komponen yang disebut <strong>widget</strong>. Widget dapat mengatur tampilan, menerima input, atau menyusun widget lain. Susunan widget membentuk <em>widget tree</em>.</p><p>Contoh: <span class="inline-code">Scaffold</span> menyediakan struktur halaman, sedangkan <span class="inline-code">Row</span> dan <span class="inline-code">Column</span> menyusun widget anak.</p><div class="callout"><strong>Tujuan pembelajaran</strong><br>Setelah mempelajari materi, siswa dapat menjelaskan fungsi Container, Row, dan Column; membedakan sumbu utama dan sumbu silang; serta membuat layout sederhana menggunakan Dart.</div>`
  },
  {
    title: "5.2 Container",
    body: `<p><span class="inline-code">Container</span> digunakan untuk mengatur area, misalnya ukuran, warna, padding, margin, dan dekorasi.</p><pre class="code">Container(
  width: 120,
  height: 80,
  padding: const EdgeInsets.all(12),
  decoration: BoxDecoration(
    color: Colors.blue,
    borderRadius: BorderRadius.circular(12),
  ),
  child: const Text('Halo Flutter'),
)</pre><p><strong>Ingat:</strong> padding adalah ruang di dalam batas widget, sedangkan margin adalah ruang di luar widget.</p>`
  },
  {
    title: "5.3 Row dan Column",
    body: `<p><span class="inline-code">Row</span> menyusun anak widget secara horizontal (mendatar). <span class="inline-code">Column</span> menyusun anak widget secara vertikal (tegak).</p><pre class="code">Row(
  mainAxisAlignment: MainAxisAlignment.center,
  children: const [
    Icon(Icons.home),
    SizedBox(width: 8),
    Text('Beranda'),
  ],
)</pre><p>Dalam Row, sumbu utama (main axis) adalah horizontal. Dalam Column, sumbu utama adalah vertikal.</p>`
  },
  {
    title: "5.4 Alignment dan jarak",
    body: `<p>Alignment mengatur posisi atau distribusi anak widget pada sumbu utama dan sumbu silang.</p><ul><li><span class="inline-code">MainAxisAlignment.start</span>: mulai dari awal sumbu utama.</li><li><span class="inline-code">MainAxisAlignment.center</span>: berkumpul di tengah.</li><li><span class="inline-code">MainAxisAlignment.spaceBetween</span>: ruang dibagi di antara anak tanpa ruang tambahan di ujung.</li><li><span class="inline-code">CrossAxisAlignment.center</span>: meratakan anak di tengah sumbu silang.</li><li><span class="inline-code">SizedBox</span>: memberi jarak atau ukuran tertentu.</li></ul><div class="callout"><strong>Petunjuk:</strong> mainAxisAlignment mengikuti arah Row atau Column, sedangkan crossAxisAlignment mengatur arah yang menyilanginya.</div>`
  },
  {
    title: "5.5 Tips saat terjadi error",
    body: `<p>Ketika kode Flutter mengalami error, lakukan pemeriksaan secara bertahap.</p><ol><li>Pastikan tanda kurung buka dan tutup sudah berpasangan.</li><li>Periksa penggunaan koma pada daftar parameter dan children.</li><li>Pastikan widget ditempatkan pada properti yang tepat.</li><li>Jika memakai <span class="inline-code">const</span>, pastikan nilai yang digunakan memang konstan.</li><li>Baca pesan error dan periksa baris kode yang ditunjukkan terminal.</li></ol><p>Perbaiki satu masalah terlebih dahulu, kemudian jalankan kembali program untuk memastikan hasilnya.</p>`
  },
  {
    title: "Ringkasan materi",
    body: `<ul><li><strong>Widget</strong> adalah komponen pembangun antarmuka Flutter.</li><li><strong>Container</strong> mengatur tampilan dan ruang suatu area.</li><li><strong>Row</strong> menyusun widget secara horizontal.</li><li><strong>Column</strong> menyusun widget secara vertikal.</li><li><strong>Alignment</strong> mengatur posisi anak widget.</li><li><strong>SizedBox</strong> dapat digunakan untuk memberi jarak.</li></ul><div class="callout"><strong>Refleksi singkat</strong><br>Dapatkah kamu menjelaskan perbedaan Row dan Column serta kapan menggunakan Container? Pikirkan satu contoh penerapannya pada aplikasi yang kamu gunakan sehari-hari.</div>`
  }
];
function materialPage() {
  const index = Math.max(0, Math.min(Number(state.materialIndex) || 0, materialSlides.length - 1));
  state.materialIndex = index;
  const slide = materialSlides[index];
  const last = index === materialSlides.length - 1;
  const done = state.completed.includes("materi");
  return `<div class="page-heading"><span class="eyebrow" style="color:var(--blue)">MODUL 5 · MATERI</span><h2>Memahami Layout Flutter</h2><p>Pelajari materi secara bertahap. Setiap halaman menampilkan satu pokok bahasan.</p></div>
    <article class="card material-card"><div class="material-card-top"><span class="tag">BAGIAN ${index + 1}</span><span class="material-counter">${index + 1}/${materialSlides.length}</span></div><h3>${slide.title}</h3><div class="material-body">${slide.body}</div></article>
    <div class="material-progress-wrap"><div class="material-progress-head"><strong>Progres Materi: ${index + 1} dari ${materialSlides.length}</strong><span>${Math.round(((index + 1) / materialSlides.length) * 100)}%</span></div><div class="progress-track material-progress"><div class="progress-fill" style="width:${((index + 1) / materialSlides.length) * 100}%"></div></div></div>
    <div class="material-navigation">${index > 0 ? `<button class="btn btn-outline" data-action="material-prev">← Materi Sebelumnya</button>` : `<span></span>`}${last ? `<button class="btn btn-primary" data-action="complete-material">${done ? "Materi Selesai ✓" : "Tandai Materi Selesai ✓"}</button>` : `<button class="btn btn-primary" data-action="material-next">Materi Selanjutnya →</button>`}</div>
    ${last ? `<p class="material-hint">Setelah menandai materi selesai, bagian Lab Maya akan terbuka.</p>` : `<p class="material-hint">Selesaikan membaca halaman ini, lalu pilih Materi Selanjutnya.</p>`}`;
}
function labPage() {
  return `<div class="page-heading"><span class="eyebrow" style="color:var(--blue)">LAB MAYA</span><h2>Eksperimen Layout</h2><p>Ubah kontrol di sebelah kiri. Pratinjau di ponsel akan menampilkan simulasi susunan widget. Ini simulasi visual web, bukan compiler Flutter.</p></div>
  <div class="lab-layout">
    <aside class="card controls">
      <h3>Pengaturan layout</h3>
      <label class="field">Jenis susunan<select id="direction"><option value="row">Row · Horizontal</option><option value="column">Column · Vertikal</option></select></label>
      <label class="field">Main axis alignment<select id="mainAlign"><option value="center">Center</option><option value="start">Start</option><option value="end">End</option><option value="space-between">Space Between</option><option value="space-around">Space Around</option><option value="space-evenly">Space Evenly</option></select></label>
      <label class="field">Cross axis alignment<select id="crossAlign"><option value="center">Center</option><option value="start">Start</option><option value="end">End</option><option value="stretch">Stretch (simulasi)</option></select></label>
      <label class="field">Jarak antarwidget: <output id="gapOut">12</output> px<input id="gap" type="range" min="0" max="36" value="12"></label>
      <label class="field">Padding area: <output id="padOut">12</output> px<input id="pad" type="range" min="0" max="32" value="12"></label>
      <button class="btn btn-outline" id="resetLab">Atur ulang</button>
      <button class="btn btn-primary" id="checkLab">Periksa pemahaman</button>
      <div id="labFeedback" aria-live="polite"></div>
    </aside>
    <section class="card"><div class="section-head" style="margin-top:0"><div><h3>Pratinjau aplikasi</h3><p>Contoh tiga widget berwarna.</p></div><span class="tag">Live preview</span></div>
      <div class="preview-wrap"><div class="preview-phone"><div class="preview-title">CONTOH LAYOUT</div><div id="previewCanvas" class="preview-canvas"><div class="demo-box">A</div><div class="demo-box">B</div><div class="demo-box">C</div></div></div></div>
      <div class="callout"><strong>Amati:</strong> Row mengubah susunan ke arah mendatar, sedangkan Column mengubahnya ke arah tegak. Main axis mengikuti arah susunan.</div>
      <button class="btn btn-light" data-action="complete-lab">Tandai lab selesai ✓</button>
    </section>
  </div>`;
}
const questions = [
  {q:"Widget manakah yang menyusun anak widget secara horizontal?",opts:["Column","Row","Scaffold","Center"],a:1,why:"Row menyusun anak widget sepanjang sumbu horizontal."},
  {q:"Properti apa yang digunakan untuk memberi ruang di dalam area Container?",opts:["margin","padding","alignment","decoration"],a:1,why:"Padding adalah ruang di dalam batas widget, sedangkan margin berada di luar."},
  {q:"Pada Column, arah sumbu utama adalah ...",opts:["Horizontal","Diagonal","Vertikal","Tidak memiliki arah"],a:2,why:"Column menyusun anak secara vertikal sehingga sumbu utamanya vertikal."},
  {q:"Apa fungsi mainAxisAlignment?",opts:["Mengubah warna widget","Mengatur distribusi anak pada sumbu utama","Menambahkan gambar","Membuat aplikasi menjadi APK"],a:1,why:"mainAxisAlignment mengatur posisi atau distribusi anak sepanjang sumbu utama."},
  {q:"Widget sederhana apa yang dapat digunakan untuk membuat jarak tetap antara dua widget?",opts:["SizedBox","MaterialApp","Scaffold","IconTheme"],a:0,why:"SizedBox dapat diberi width atau height untuk menyediakan ukuran atau jarak."}
];
function quizPage() {
  const index = Math.max(0, Math.min(Number(state.quizIndex) || 0, questions.length - 1));
  state.quizIndex = index;
  const q = questions[index];
  const selected = state.quizAnswers[index];
  const submitted = !!state.quizSubmitted;
  const last = index === questions.length - 1;
  const answered = Object.keys(state.quizAnswers || {}).length;
  return `<div class="page-heading"><span class="eyebrow" style="color:var(--blue)">KUIS</span><h2>Uji Pemahaman Layout Flutter</h2><p>Jawab lima soal secara berurutan. Setiap halaman menampilkan satu soal. Jawaban akan tersimpan saat berpindah halaman.</p></div>
    <form id="quizForm"><fieldset class="card quiz-question quiz-single-card"><div class="material-card-top"><span class="tag">SOAL ${index + 1}</span><span class="material-counter">${index + 1}/${questions.length}</span></div><legend>${index + 1}. ${q.q}</legend>${q.opts.map((o,j)=>`<label class="option"><input type="radio" name="currentAnswer" value="${j}" ${String(selected)===String(j)?"checked":""} ${submitted?"disabled":""} required><span>${escapeHtml(o)}</span></label>`).join("")}${submitted?`<div class="feedback ${Number(selected)===q.a?"good":"bad"}">${Number(selected)===q.a?"Tepat. ":"Belum tepat. "}${q.why}</div>`:""}</fieldset>
    <div class="material-progress-wrap"><div class="material-progress-head"><strong>Progres Kuis: ${index + 1} dari ${questions.length} soal</strong><span>${Math.round(((index + 1) / questions.length) * 100)}%</span></div><div class="progress-track material-progress"><div class="progress-fill" style="width:${((index + 1) / questions.length) * 100}%"></div></div><p class="material-hint">${answered} dari ${questions.length} soal telah dijawab.</p></div>
    <div class="material-navigation">${index>0?`<button class="btn btn-outline" type="button" data-action="quiz-prev" ${submitted?"disabled":""}>← Soal Sebelumnya</button>`:`<span></span>`}${!last?`<button class="btn btn-primary" type="button" data-action="quiz-next" ${submitted?"disabled":""}>Soal Selanjutnya →</button>`:submitted?`<button class="btn btn-primary" type="button" data-action="quiz-retry">Ulangi Kuis</button>`:`<button class="btn btn-primary" type="submit">Kumpulkan Jawaban ✓</button>`}</div></form><div id="quizResult" aria-live="polite">${submitted?quizResultMarkup():""}</div>`;
}
function quizResultMarkup() {
  const score = questions.filter((q,i)=>Number(state.quizAnswers[i])===q.a).length;
  const pct = Math.round(score / questions.length * 100);
  return `<div class="result-panel"><div class="score">${pct}/100</div><h3>${score} dari ${questions.length} jawaban benar</h3><p>${pct>=80?"Bagus! Anda siap melanjutkan proyek mini.":"Pelajari pembahasan, buka kembali materi, lalu coba lagi."}</p><button type="button" class="btn btn-light" data-action="quiz-goto-project">Ke proyek praktik →</button></div>`;
}
function initQuiz() {
  const form = document.getElementById("quizForm");
  form.addEventListener("change", e => {
    if (e.target.name === "currentAnswer") {
      state.quizAnswers[state.quizIndex] = Number(e.target.value);
      saveState();
      const hint = document.querySelector(".material-hint");
      if (hint) hint.textContent = `${Object.keys(state.quizAnswers).length} dari ${questions.length} soal telah dijawab.`;
    }
  });
  form.addEventListener("submit", e => {
    e.preventDefault();
    if (Object.keys(state.quizAnswers).length !== questions.length) {
      alert("Jawab seluruh soal terlebih dahulu sebelum mengumpulkan jawaban."); return;
    }
    state.quizSubmitted = true;
    const score = questions.filter((q,i)=>Number(state.quizAnswers[i])===q.a).length;
    state.quizScore = Math.round(score / questions.length * 100);
    if (!state.completed.includes("kuis")) state.completed.push("kuis");
    saveState(); updateNavigationLocks(); render();
  });
}

function projectPage() {
  const tasks = [
    "Buat proyek Flutter baru dan jalankan aplikasi awal.",
    "Buat Container dengan padding, warna, dan sudut membulat.",
    "Tampilkan avatar dan nama siswa menggunakan Column.",
    "Gunakan Row untuk menampilkan ikon dan informasi keahlian.",
    "Jalankan di emulator atau perangkat Android dan periksa hasilnya."
  ];
  return `<div class="page-heading"><span class="eyebrow" style="color:var(--blue)">PROYEK PRAKTIK</span><h2>Proyek Mini: Kartu Profil Siswa</h2><p>Ikuti empat halaman secara berurutan: pahami target produk, pelajari kode awal Flutter, praktik di DartPad, lalu periksa pekerjaan melalui checklist.</p></div>
  <div class="project-scene-progress" aria-label="Urutan halaman proyek"><span class="project-page-dot active" data-page-dot="1">1. Target Produk</span><span class="project-page-dot" data-page-dot="2">2. Kode Awal</span><span class="project-page-dot" data-page-dot="3">3. Editor DartPad</span><span class="project-page-dot" data-page-dot="4">4. Checklist</span></div>

  <section class="project-scene active" id="projectScene1" data-project-page="1" aria-labelledby="scene1Title">
    <div class="scene-heading"><span class="tag">HALAMAN 1 DARI 4</span><p>Pahami hasil akhir yang akan dibuat sebelum mulai menulis kode.</p></div>
    <section class="card target-product-card"><h3>Target Produk: Kartu Profil Siswa</h3><p>Buat sebuah kartu profil sederhana menggunakan Flutter dengan ketentuan berikut:</p><ul><li>Avatar siswa berada di bagian atas.</li><li>Nama dan kelas ditampilkan dengan jelas.</li><li>Informasi keahlian ditampilkan bersama ikon menggunakan <span class="inline-code">Row</span>.</li><li>Kartu memiliki jarak dalam (<span class="inline-code">padding</span>), warna latar, dan sudut membulat.</li><li>Susunan utama menggunakan <span class="inline-code">Container</span>, <span class="inline-code">Column</span>, <span class="inline-code">Row</span>, dan <span class="inline-code">SizedBox</span>.</li></ul><div class="callout"><strong>Hasil yang diharapkan</strong><br>Sebuah kartu profil yang rapi, mudah dibaca, dan dapat dijalankan di DartPad dalam mode Flutter.</div></section>
    <div class="scene-navigation"><span class="scene-step-note">Halaman 1 · Target Produk</span><button type="button" class="btn btn-primary" data-go-scene="2">Halaman Berikutnya: Kode Awal →</button></div>
  </section>

  <section class="project-scene" id="projectScene2" data-project-page="2" aria-labelledby="scene2Title" hidden>
    <div class="scene-heading"><span class="tag">HALAMAN 2 DARI 4</span><h3 id="scene2Title">Kode Awal Flutter</h3><p>Baca kode awal berikut. Salin kode ini sebelum berpindah ke editor DartPad.</p></div>
    <section class="card starter-code-panel"><div class="section-head"><div><h3>Kode Awal Flutter</h3><p>Salin seluruh kode dan tempelkan ke editor DartPad pada halaman berikutnya.</p></div><button type="button" class="btn btn-primary btn-small" id="copyCode">Salin Kode Awal</button></div><pre class="dartpad-source"><code id="dartpadSourceCode">${escapeHtml(projectCode)}</code></pre><div id="copyStatus" class="feedback" role="status" aria-live="polite">Tekan “Salin Kode Awal” untuk menyalin kode.</div><div class="dartpad-actions"><button type="button" class="btn btn-outline btn-small" id="downloadDartCode">Unduh main.dart</button></div></section>
    <div class="scene-navigation"><button type="button" class="btn btn-outline" data-go-scene="1">← Kembali ke Target Produk</button><span class="scene-step-note">Halaman 2 · Kode Awal</span><button type="button" class="btn btn-primary" data-go-scene="3">Halaman Berikutnya: Editor DartPad →</button></div>
  </section>

  <section class="project-scene" id="projectScene3" data-project-page="3" aria-labelledby="scene3Title" hidden>
    <div class="scene-heading"><span class="tag">HALAMAN 3 DARI 4</span><h3 id="scene3Title">Editor DartPad</h3><p>Tempelkan kode awal ke editor, lalu tekan <strong>Run</strong> untuk menjalankan aplikasi Flutter. Jika hasil (output) yang dihasilkan membutuhkan waktu yang lama untuk ditampilkan karena terkendala jaringan internet, direkomendasikan untuk menjalankan kode awal menggunakan IDE Android Studio atau Visual Studio Code tersediri tanpa menggunakan jaringan internet</p></div>
    <section class="card dartpad-card"><div class="dartpad-heading"><span class="tag">DartPad · Flutter</span><span class="dartpad-note">Editor ditampilkan di halaman Lab Maya ini. Pemuatan memerlukan koneksi internet dan akses ke dartpad.dev.</span></div><div class="dartpad-actions"><button type="button" class="btn btn-outline btn-small" id="reloadDartPad">Muat ulang editor</button></div><div class="dartpad-container" id="dartpadContainer"><iframe id="dartpadFrame" title="Editor DartPad Flutter Lab Maya" src="https://dartpad.dev/?channel=stable&embed=true&mode=flutter" loading="lazy" allow="clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div id="dartpadStatus" class="feedback" aria-live="polite">Editor DartPad sedang dimuat. Tempelkan kode awal yang sudah disalin, lalu tekan Run.</div></section>
    <div class="scene-navigation"><button type="button" class="btn btn-outline" data-go-scene="2">← Kembali ke Kode Awal</button><span class="scene-step-note">Halaman 3 · Praktik</span><button type="button" class="btn btn-primary" data-go-scene="4">Halaman Terakhir: Checklist →</button></div>
  </section>

  <section class="project-scene" id="projectScene4" data-project-page="4" aria-labelledby="scene4Title" hidden>
    <div class="scene-heading"><span class="tag">HALAMAN 4 DARI 4</span><h3 id="scene4Title">Checklist Pengerjaan</h3><p>Centang setiap tugas setelah selesai dilakukan. Gunakan checklist ini untuk mengevaluasi hasil praktik.</p></div>
    <section class="card checklist-project-card"><h3>Checklist Pengerjaan</h3><p>Pastikan semua langkah berikut telah dikerjakan.</p><div id="projectChecklist"></div><div class="progress-track"><div id="projectProgress" class="progress-fill"></div></div><p id="projectProgressText" style="margin-top:8px"></p><button class="btn btn-primary" id="finishProject">Tandai Proyek Selesai</button><div id="certificateContainer"></div><div class="callout" style="margin-top:18px"><strong>Penilaian mandiri</strong><br>Susunan widget (40%), kerapian tampilan (25%), keberhasilan aplikasi dijalankan (25%), dan modifikasi kreatif (10%).</div></section>
    <div class="scene-navigation"><button type="button" class="btn btn-outline" data-go-scene="3">← Kembali ke Editor DartPad</button><span class="scene-step-note">Halaman 4 · Checklist</span><button type="button" class="btn btn-primary" data-go-scene="1">Kembali ke Awal ↺</button></div>
  </section>`;
}
function certificatePage() {
  if (!state.certificateIssued || !state.studentName || !state.studentClass) {
    return `<div class="page-heading"><h2>Sertifikat belum tersedia</h2><p>Selesaikan seluruh tahapan pembelajaran dan checklist Proyek Mini terlebih dahulu.</p><button class="btn btn-primary" data-action="proyek">Kembali ke Proyek Mini</button></div>`;
  }
  const checklistScore = Math.round((state.projectChecks || []).length / 5 * 70);
  const score = Math.max(0, Math.min(100, Math.round(checklistScore + (Number(state.quizScore) || 0) * 0.3)));
  const predicate = score >= 90 ? "Sangat Baik" : score >= 80 ? "Baik" : score >= 70 ? "Cukup" : "Perlu Penguatan";
  const issued = state.certificateDate || new Date().toLocaleDateString("id-ID", {day:"numeric",month:"long",year:"numeric"});
  return `<div class="page-heading"><span class="eyebrow" style="color:var(--blue)">APRESIASI PEMBELAJARAN</span><h2>Sertifikat Hasil Pembelajaran</h2><p>Selamat atas penyelesaian Proyek Mini Lab Maya.</p></div>
  <article class="certificate-card" id="certificatePrintable"><div class="certificate-border">
  <div class="certificate-topline">LAB MAYA <span>•</span> SERTIFIKAT PEMBELAJARAN</div>
  <div class="certificate-ribbon" aria-hidden="true"><span>🎖️</span></div>
  <div class="certificate-kicker">SERTIFIKAT HASIL PEMBELAJARAN</div><h3>Penghargaan Penyelesaian Proyek Mini</h3>
  <p class="certificate-intro">Diberikan dengan apresiasi kepada</p><div class="certificate-student">${escapeHtml(state.studentName)}</div>
  <div class="certificate-class">Kelas ${escapeHtml(state.studentClass)}</div><div class="certificate-divider"></div>
  <p class="certificate-description">Atas keberhasilan menyelesaikan pembelajaran <strong>Layout Flutter</strong> dan Proyek Mini <strong>Kartu Profil Siswa</strong>.</p>
  <div class="certificate-score"><div><span>SKOR AKHIR</span><strong>${score}<small>/100</small></strong></div><div class="certificate-grade"><span>PREDIKAT</span><strong>${predicate}</strong></div></div>
  <div class="certificate-footer"><span>📅 ${issued}</span><span>✓ PROYEK SELESAI</span></div><div class="certificate-signature">LAB MAYA <small>Media Pembelajaran Interaktif</small></div>
  </div></article>
  <div class="certificate-actions"><button class="btn btn-primary" id="downloadCertificatePdf">⬇ Unduh Sertifikat PDF</button><button class="btn btn-outline" data-action="proyek">← Kembali ke Proyek Mini</button></div>
  <p class="material-hint">PDF dibuat di perangkat ini. Koneksi internet diperlukan untuk memuat pustaka pembuat PDF.</p>`;
}
const projectCode = `import 'package:flutter/material.dart';

void main() {
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: ProfilSiswa(),
  ));
}

class ProfilSiswa extends StatelessWidget {
  const ProfilSiswa({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil Siswa')),
      body: Center(
        child: Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircleAvatar(
                radius: 36,
                child: Icon(Icons.person, size: 40),
              ),
              const SizedBox(height: 12),
              const Text(
                'Nama Siswa',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Text('Kelas XII RPL'),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.code),
                  const SizedBox(width: 8),
                  const Text('Belajar Flutter'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}`;
function initProject() {
  const tasks = [
    "Buat proyek Flutter baru dan jalankan aplikasi awal.",
    "Buat Container dengan padding, warna, dan sudut membulat.",
    "Tampilkan avatar dan nama siswa menggunakan Column.",
    "Gunakan Row untuk menampilkan ikon dan informasi keahlian.",
    "Jalankan di emulator atau perangkat Android dan periksa hasilnya."
  ];
  const checklist = document.getElementById("projectChecklist");
  checklist.innerHTML = tasks.map((task, i) => `<label class="option"><input type="checkbox" data-task="${i}" ${state.projectChecks.includes(i) ? "checked" : ""}><span>${task}</span></label>`).join("");
  function updateChecklist() {
    state.projectChecks = [...checklist.querySelectorAll("input:checked")].map(input => Number(input.dataset.task));
    saveState();
    document.getElementById("projectProgress").style.width = `${state.projectChecks.length / tasks.length * 100}%`;
    document.getElementById("projectProgressText").textContent = `${state.projectChecks.length} dari ${tasks.length} tugas selesai`;
  }
  checklist.addEventListener("change", updateChecklist);
  updateChecklist();

  document.getElementById("finishProject").addEventListener("click", () => {
    if (state.projectChecks.length === tasks.length) {
      if (!state.completed.includes("proyek")) state.completed.push("proyek");
      state.certificateIssued = true;
      state.certificateDate = new Date().toLocaleDateString("id-ID", {day:"numeric", month:"long", year:"numeric"});
      saveState();
      updateNavigationLocks();
      navTo("sertifikat");
    } else {
      alert("Selesaikan dan centang semua tugas checklist terlebih dahulu.");
    }
  });

  const scenes = [...document.querySelectorAll("[data-project-page]")];
  const dots = [...document.querySelectorAll("[data-page-dot]")];
  function showScene(pageNumber) {
    scenes.forEach(scene => {
      const active = Number(scene.dataset.projectPage) === pageNumber;
      scene.hidden = !active;
      scene.classList.toggle("active", active);
    });
    dots.forEach(dot => {
      const active = Number(dot.dataset.pageDot) === pageNumber;
      dot.classList.toggle("active", active);
      if (active) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });
    window.scrollTo({ top: document.querySelector(".page-heading").offsetTop, behavior: "smooth" });
    if (pageNumber === 3) {
      const status = document.getElementById("dartpadStatus");
      if (status && status.textContent.includes("sedang dimuat")) status.textContent = "Tempelkan kode awal yang sudah disalin dari halaman 2 ke editor, lalu tekan Run.";
    }
  }
  document.querySelectorAll("[data-go-scene]").forEach(button => {
    button.addEventListener("click", () => showScene(Number(button.dataset.goScene)));
  });

  const status = document.getElementById("dartpadStatus");
  const copyStatus = document.getElementById("copyStatus");
  const codeElement = document.getElementById("dartpadSourceCode");
  const frame = document.getElementById("dartpadFrame");
  document.getElementById("copyCode")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(projectCode);
      copyStatus.className = "feedback good";
      copyStatus.textContent = "Kode Flutter berhasil disalin. Lanjutkan ke halaman Editor DartPad dan tempelkan dengan Ctrl+V.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(codeElement);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.className = "feedback";
      copyStatus.textContent = "Clipboard otomatis tidak tersedia. Kode sudah dipilih; tekan Ctrl+C, lalu tempelkan ke editor DartPad.";
    }
  });

  document.getElementById("reloadDartPad")?.addEventListener("click", () => {
    status.className = "feedback";
    status.textContent = "Memuat ulang editor DartPad...";
    frame.src = "https://dartpad.dev/?channel=stable&embed=true&mode=flutter";
  });
  frame?.addEventListener("load", () => {
    status.className = "feedback good";
    status.textContent = "Halaman DartPad berhasil dimuat. Tempelkan kode awal dari halaman 2, lalu tekan Run. Jika editor tidak terlihat, periksa akses jaringan ke dartpad.dev.";
  });
  frame?.addEventListener("error", () => {
    status.className = "feedback bad";
    status.textContent = "DartPad tidak dapat dimuat. Periksa koneksi, VPN/proxy, firewall, atau pemblokir konten.";
  });
  document.getElementById("downloadDartCode")?.addEventListener("click", () => {
    const blob = new Blob([projectCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "main.dart";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    copyStatus.className = "feedback good";
    copyStatus.textContent = "Berkas main.dart berhasil disiapkan untuk diunduh.";
  });
}
function initLab() {
  const canvas=document.getElementById("previewCanvas");
  const direction=document.getElementById("direction"), main=document.getElementById("mainAlign"), cross=document.getElementById("crossAlign");
  const gap=document.getElementById("gap"), pad=document.getElementById("pad");
  function update() {
    const row=direction.value==="row";
    canvas.style.flexDirection=row?"row":"column";
    canvas.style.justifyContent=main.value==="space-between"?"space-between":main.value==="space-around"?"space-around":main.value==="space-evenly"?"space-evenly":main.value;
    canvas.style.alignItems=cross.value==="stretch"?"stretch":cross.value;
    canvas.style.gap=gap.value+"px"; canvas.style.padding=pad.value+"px";
    document.getElementById("gapOut").textContent=gap.value; document.getElementById("padOut").textContent=pad.value;
    canvas.querySelectorAll(".demo-box").forEach(b=>{b.style.width=row?"54px":"54px";b.style.height=cross.value==="stretch"&&row?"auto":"54px";});
  }
  [direction,main,cross,gap,pad].forEach(x=>x.addEventListener("input",update)); update();
  document.getElementById("resetLab").addEventListener("click",()=>{direction.value="row";main.value="center";cross.value="center";gap.value=12;pad.value=12;update();document.getElementById("labFeedback").innerHTML="";});
  document.getElementById("checkLab").addEventListener("click",()=>{
    const fb=document.getElementById("labFeedback");
    fb.innerHTML=`<div class="feedback good">Coba jelaskan dengan kata-kata sendiri: bagaimana tampilan berubah ketika Row diganti menjadi Column? Jika sudah memahami perbedaannya, tandai lab selesai.</div>`;
  });
}
// Sorotan menu memicu desis; klik menghentikan desis dan hanya memainkan bip.
const UI_SOUND_SELECTOR = "button:not(:disabled), a[href], [role=button]:not([aria-disabled=\"true\"]), input:not(:disabled), select:not(:disabled), summary";
document.addEventListener("pointerover", e => {
  const control = e.target.closest(UI_SOUND_SELECTOR);
  if (control && !control.contains(e.relatedTarget)) playUiSound("hover");
});
document.addEventListener("click",e=>{
  const clickedControl = e.target.closest(UI_SOUND_SELECTOR);
  if (clickedControl) playUiSound("click");
  if (e.target.closest("#downloadCertificatePdf")) {
    const button = e.target.closest("#downloadCertificatePdf");
    const certificate = document.getElementById("certificatePrintable");
    if (!certificate) { alert("Desain sertifikat tidak ditemukan. Buka kembali halaman sertifikat."); return; }
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Menyiapkan PDF…";
    const loadScript = (src, ready) => {
      if (ready()) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => ready() ? resolve() : reject(new Error("Pustaka tidak tersedia"));
        script.onerror = () => reject(new Error("Gagal memuat pustaka PDF"));
        document.head.appendChild(script);
      });
    };
    (async () => {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", () => typeof window.html2canvas === "function");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => Boolean(window.jspdf && window.jspdf.jsPDF));
        // Render elemen sertifikat yang asli, bukan menggambar ulang teks dan warna secara terpisah.
        // Dengan begitu gradien, bingkai, tipografi, medali, jarak, dan warna mengikuti tampilan Lab Maya.
        const canvas = await window.html2canvas(certificate, {
          scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
          backgroundColor: null,
          useCORS: true,
          logging: false,
          width: certificate.scrollWidth,
          height: certificate.scrollHeight,
          windowWidth: Math.max(document.documentElement.clientWidth, certificate.scrollWidth)
        });
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 8;
        const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
        const imageW = canvas.width * ratio;
        const imageH = canvas.height * ratio;
        const x = (pageW - imageW) / 2;
        const y = (pageH - imageH) / 2;
        doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y, imageW, imageH, undefined, "FAST");
        const safeName = (state.studentName || "Peserta-Didik").normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
        doc.save("Sertifikat-Lab-Maya-" + (safeName || "Peserta-Didik") + ".pdf");
      } catch (err) {
        console.error(err);
        alert("PDF belum berhasil dibuat. Pastikan koneksi internet tersedia, lalu coba lagi.");
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    })();
    return;
  }
  const b=e.target.closest("[data-action]"); if(!b)return;
  const a=b.dataset.action;
  if(a==="start") {
    state.completed = [];
    state.quizScore = null; state.quizIndex = 0; state.quizAnswers = {}; state.quizSubmitted = false;
    state.projectChecks = []; state.materialIndex = 0; state.certificateIssued = false; state.certificateDate = "";
    state.studentName = ""; state.studentClass = "";
    state.lastPage = "identitas";
    saveState();
    navTo("identitas");
  }
  if(a==="materi") navTo("materi");
  if(a==="lab") navTo("lab");
  if(a==="kuis") navTo("kuis");
  if(a==="proyek") navTo("proyek");
  if(a==="material-next") { state.materialIndex = Math.min((Number(state.materialIndex) || 0) + 1, materialSlides.length - 1); saveState(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if(a==="material-prev") { state.materialIndex = Math.max((Number(state.materialIndex) || 0) - 1, 0); saveState(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if (a === "quiz-prev") { state.quizIndex = Math.max(0, state.quizIndex - 1); saveState(); render(); }
  if (a === "quiz-next") {
    if (state.quizAnswers[state.quizIndex] === undefined) { alert("Pilih jawaban terlebih dahulu sebelum melanjutkan."); return; }
    state.quizIndex = Math.min(questions.length - 1, state.quizIndex + 1); saveState(); render();
  }
  if (a === "quiz-retry") { state.quizIndex = 0; state.quizAnswers = {}; state.quizSubmitted = false; state.quizScore = null; state.completed = state.completed.filter(k => k !== "kuis"); saveState(); render(); }
  if (a === "quiz-goto-project") navTo("proyek");
  if(a==="complete-material") { if(!state.completed.includes("materi")) state.completed.push("materi"); saveState(); navTo("lab"); }
  if(a==="complete-lab") { if(!state.completed.includes("lab")) state.completed.push("lab"); saveState(); render(); }
});
render();
