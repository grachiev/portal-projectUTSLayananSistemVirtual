(function () {
  var H = 3600e3, D = 24 * H, NOW = Date.now();
  function at(days, h, m) { var d = new Date(NOW + days * D); d.setHours(h == null ? 23 : h, m == null ? 59 : m, 0, 0); return d.getTime(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }


  /* ---------- akun (disimpan di browser perangkat ini) ---------- */
  var USERS_KEY = 'pbc-users', SESSION_KEY = 'pbc-session';
  function loadUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]') || []; } catch (e) { return []; } }
  function saveUsers(list) { try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function getSession() { try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; } }
  function setSession(id) { try { if (id) localStorage.setItem(SESSION_KEY, id); else localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function hex(bytes) { return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function randomSalt() {
    var a = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
    return hex(a);
  }
  /* Kata sandi tidak disimpan apa adanya: yang disimpan hanya hash SHA-256 beserta salt acak. */
  function hashPw(pw, salt) {
    var text = salt + ':' + pw;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) { return hex(new Uint8Array(buf)); });
    }
    var h = 5381; for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return Promise.resolve('x' + h.toString(16));
  }
  function logout() { setSession(null); location.hash = ''; location.reload(); }

  function initAuth() {
    var auth = document.getElementById('auth');
    auth.hidden = false;
    var fr = document.getElementById('form-register'), fl = document.getElementById('form-login');
    function val(id) { return document.getElementById(id).value.trim(); }
    function clearErrors(f) {
      f.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
      f.querySelectorAll('.fld.bad').forEach(function (e) { e.classList.remove('bad'); });
      var al = f.querySelector('.alert'); if (al) al.textContent = '';
    }
    function setErr(f, key, msg) {
      var e = f.querySelector('.err[data-for="' + key + '"]'); if (!e) return;
      e.textContent = msg;
      var box = e.closest('.fld'); if (box) box.classList.add('bad');
    }
    function show(which) {
      fr.hidden = which !== 'register'; fl.hidden = which !== 'login';
      auth.querySelectorAll('.tabs [data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === which)); });
      clearErrors(fr); clearErrors(fl);
    }
    auth.querySelectorAll('[data-tab]').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });
    auth.querySelectorAll('[data-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var ids = b.dataset.toggle.split(','), reveal = document.getElementById(ids[0]).type === 'password';
        ids.forEach(function (id) { document.getElementById(id).type = reveal ? 'text' : 'password'; });
        b.textContent = reveal ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi';
        b.setAttribute('aria-pressed', String(reveal));
      });
    });
    function enter() { location.hash = 'beranda'; location.reload(); }
    function focusFirstBad(f) { var x = f.querySelector('.fld.bad input, .fld.bad select'); if (x) x.focus(); }

    fr.addEventListener('submit', function (ev) {
      ev.preventDefault(); clearErrors(fr);
      var v = {
        nama: val('reg-nama').replace(/\s+/g, ' '), nim: val('reg-nim'), prodi: document.getElementById('reg-prodi').value,
        email: val('reg-email').toLowerCase(), pass: document.getElementById('reg-pass').value, pass2: document.getElementById('reg-pass2').value,
        ok: document.getElementById('reg-ok').checked
      };
      var bad = 0;
      function no(k, m) { setErr(fr, k, m); bad++; }
      if (v.nama.length < 3) no('nama', 'Isi nama lengkap, minimal 3 huruf.');
      if (!/^\d{8,12}$/.test(v.nim)) no('nim', 'NIM terdiri dari 8 sampai 12 angka.');
      if (!v.prodi) no('prodi', 'Pilih program studi.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) no('email', 'Tulis alamat email yang valid, misalnya nama@email.com.');
      if (v.pass.length < 8 || !/[A-Za-z]/.test(v.pass) || !/\d/.test(v.pass)) no('pass', 'Kata sandi minimal 8 karakter dan berisi huruf serta angka.');
      else if (v.pass !== v.pass2) no('pass2', 'Ulangi kata sandi dengan isian yang sama.');
      if (!v.ok) { fr.querySelector('.err[data-for="ok"]').textContent = 'Centang persetujuan untuk melanjutkan.'; bad++; }
      if (bad) { focusFirstBad(fr); return; }
      var list = loadUsers();
      if (list.some(function (u) { return u.nim === v.nim; })) { setErr(fr, 'nim', 'NIM ini sudah terdaftar. Silakan masuk.'); focusFirstBad(fr); return; }
      if (list.some(function (u) { return u.email === v.email; })) { setErr(fr, 'email', 'Email ini sudah terdaftar. Silakan masuk.'); focusFirstBad(fr); return; }
      var salt = randomSalt();
      hashPw(v.pass, salt).then(function (h) {
        var user = { id: 'u' + Date.now().toString(36) + salt.slice(0, 4), nama: v.nama, nim: v.nim, prodi: v.prodi, email: v.email, salt: salt, hash: h, dibuat: Date.now() };
        list.push(user);
        if (!saveUsers(list)) { fr.querySelector('.alert').textContent = 'Browser menolak menyimpan akun. Matikan mode privat atau izinkan penyimpanan situs, lalu coba lagi.'; return; }
        setSession(user.id); enter();
      });
    });

    fl.addEventListener('submit', function (ev) {
      ev.preventDefault(); clearErrors(fl);
      var id = val('log-id').toLowerCase(), pass = document.getElementById('log-pass').value, bad = 0;
      if (!id) { setErr(fl, 'id', 'Isi NIM atau email.'); bad++; }
      if (!pass) { setErr(fl, 'pass', 'Isi kata sandi.'); bad++; }
      if (bad) { focusFirstBad(fl); return; }
      var user = loadUsers().filter(function (u) { return u.nim === id || u.email === id; })[0];
      var fail = function () { fl.querySelector('.alert').textContent = 'NIM, email, atau kata sandi tidak cocok. Periksa lagi atau daftar akun baru.'; };
      if (!user) { fail(); return; }
      hashPw(pass, user.salt).then(function (h) { if (h !== user.hash) fail(); else { setSession(user.id); enter(); } });
    });

    show('register');
  }

  var me = loadUsers().filter(function (u) { return u.id === getSession(); })[0];
  if (!me) { initAuth(); return; }
  document.querySelector('.app').hidden = false;
  document.getElementById('who-name').textContent = me.nama;
  document.getElementById('who-meta').textContent = 'NIM ' + me.nim + ' · ' + me.prodi;
  document.getElementById('logout').addEventListener('click', logout);
  document.getElementById('logout2').addEventListener('click', logout);

  /* ---------- data contoh ---------- */
  var courses = [
    { id: 'jarkom', kode: 'IF2101', nama: 'Jaringan Komputer', dosen: 'James Adam Seo, S.Kom., M.Kom.', sks: 3, pertemuan: [
      { t: 'Pertemuan 7 · Model OSI dan TCP/IP', items: [
        { id: 'j7a', tipe: 'PDF', judul: 'Modul 7: Lapisan OSI dan TCP/IP', meta: '24 halaman' },
        { id: 'j7b', tipe: 'VIDEO', judul: 'Rekaman kuliah: perjalanan satu paket data', meta: '42 menit' },
        { id: 'j7c', tipe: 'SLIDE', judul: 'Perbandingan OSI dan TCP/IP', meta: '31 slide' } ] },
      { t: 'Pertemuan 8 · Pengalamatan IP dan Subnetting', items: [
        { id: 'j8a', tipe: 'PDF', judul: 'Modul 8: IPv4, kelas alamat, dan CIDR', meta: '18 halaman' },
        { id: 'j8b', tipe: 'VIDEO', judul: 'Latihan subnetting langkah demi langkah', meta: '35 menit' } ] },
      { t: 'Pertemuan 9 · Routing Statis dan Dinamis', items: [
        { id: 'j9a', tipe: 'SLIDE', judul: 'Cara router memilih jalur', meta: '27 slide' },
        { id: 'j9b', tipe: 'TAUTAN', judul: 'Simulator jaringan untuk praktikum', meta: 'Tautan luar' } ] } ] },
    { id: 'basdat', kode: 'IF2103', nama: 'Cloud Computing', dosen: 'James Adam Seo, S.Kom., M.Kom.', sks: 3, pertemuan: [
      { t: 'Pertemuan 8 · Model Layanan Cloud', items: [
        { id: 'b8a', tipe: 'PDF', judul: 'Modul 8: IaaS, PaaS, dan SaaS', meta: '16 halaman' },
        { id: 'b8b', tipe: 'VIDEO', judul: 'Demo membuat mesin virtual di cloud', meta: '38 menit' } ] },
      { t: 'Pertemuan 9 · Penyimpanan dan Skalabilitas', items: [
        { id: 'b9a', tipe: 'SLIDE', judul: 'Object storage, load balancer, dan autoscaling', meta: '29 slide' },
        { id: 'b9b', tipe: 'PDF', judul: 'Kumpulan soal latihan cloud computing', meta: '10 halaman' } ] } ] },
    { id: 'spk', kode: 'IF3105', nama: 'Layanan Sistem Virtual', dosen: 'James Adam Seo, S.Kom., M.Kom.', sks: 3, pertemuan: [
      { t: 'Pertemuan 8 · Pengenalan Virtualisasi', items: [
        { id: 's8a', tipe: 'PDF', judul: 'Modul 8: Hypervisor tipe 1 dan tipe 2', meta: '20 halaman' },
        { id: 's8b', tipe: 'VIDEO', judul: 'Instalasi mesin virtual dengan VirtualBox', meta: '29 menit' } ] },
      { t: 'Pertemuan 9 · Jaringan dan Penyimpanan Virtual', items: [
        { id: 's9a', tipe: 'SLIDE', judul: 'Virtual switch, NAT, dan bridge', meta: '22 slide' } ] } ] },
    { id: 'web', kode: 'IF2107', nama: 'Pemrograman Web', dosen: 'Yoga Mahendra, S.Kom., M.Cs.', sks: 3, pertemuan: [
      { t: 'Pertemuan 8 · Formulir dan Validasi', items: [
        { id: 'w8a', tipe: 'PDF', judul: 'Modul 8: Elemen formulir HTML', meta: '14 halaman' },
        { id: 'w8b', tipe: 'VIDEO', judul: 'Membuat halaman login responsif', meta: '33 menit' } ] },
      { t: 'Pertemuan 9 · CSS Layout', items: [
        { id: 'w9a', tipe: 'SLIDE', judul: 'Flexbox dan Grid', meta: '26 slide' },
        { id: 'w9b', tipe: 'TAUTAN', judul: 'Panduan CSS dari MDN', meta: 'Tautan luar' } ] } ] }
  ];
  function cById(id) { return courses.filter(function (c) { return c.id === id; })[0]; }

  var tugas = [
    { id: 't1', c: 'spk', judul: 'Laporan Instalasi Mesin Virtual', due: at(1), desc: 'Instal satu mesin virtual Linux dengan VirtualBox atau VMware. Sertakan tangkapan layar tiap tahap dan spesifikasi yang dipilih.' },
    { id: 't2', c: 'basdat', judul: 'Perbandingan IaaS, PaaS, dan SaaS', due: at(3), desc: 'Buat tabel perbandingan tiga model layanan cloud beserta satu contoh penyedia untuk masing-masing. Kumpulkan dalam format PDF.' },
    { id: 't4', c: 'web', judul: 'Prototipe Halaman Login', due: at(5), desc: 'Buat halaman login dengan HTML dan CSS yang tampil baik di layar ponsel. Kumpulkan sebagai berkas ZIP.' },
    { id: 't5', c: 'jarkom', judul: 'Tugas 5: Konfigurasi Routing Statis', due: at(-1), desc: 'Laporan konfigurasi routing statis pada topologi tiga router.' },
    { id: 't3', c: 'spk', judul: 'Ringkasan Jenis Hypervisor', due: at(-4), desc: 'Ringkasan satu halaman tentang perbedaan hypervisor tipe 1 dan tipe 2.' }
  ];
  var baseSubs = {
    t5: { file: 'routing_statis.zip', at: at(-1, 20, 15) },
    t3: { file: 'Hypervisor.pdf', at: at(-4, 14, 5), nilai: 88, catatan: 'Penjelasan sudah runtut. Tambahkan contoh produk untuk tiap tipe hypervisor.' }
  };

  var exams = [
    { id: 'e1', c: 'jarkom', judul: 'Kuis 2: Model OSI dan TCP/IP', buka: at(-1, 8, 0), tutup: at(2), menit: 10, soal: [
      { q: 'Lapisan OSI manakah yang bertugas melakukan pengalamatan logis dan pemilihan jalur?', o: ['Data Link', 'Network', 'Transport', 'Session'], a: 1 },
      { q: 'Protokol mana yang menjamin data sampai dengan andal dan berurutan?', o: ['UDP', 'ICMP', 'TCP', 'ARP'], a: 2 },
      { q: 'Berapa nomor port bawaan untuk HTTPS?', o: ['80', '443', '21', '25'], a: 1 },
      { q: 'Perangkat apa yang meneruskan paket antar jaringan yang berbeda?', o: ['Hub', 'Switch', 'Router', 'Repeater'], a: 2 },
      { q: 'Subnet mask untuk prefiks /24 adalah...', o: ['255.0.0.0', '255.255.0.0', '255.255.255.0', '255.255.255.252'], a: 2 } ] },
    { id: 'e2', c: 'basdat', judul: 'Kuis 3: Dasar Cloud Computing', buka: at(0, 6, 0), tutup: at(4), menit: 15, soal: [
      { q: 'Model layanan cloud yang menyediakan infrastruktur seperti server dan penyimpanan adalah...', o: ['IaaS', 'PaaS', 'SaaS', 'DaaS'], a: 0 },
      { q: 'Manakah contoh SaaS?', o: ['Layanan email berbasis web', 'Mesin virtual kosong', 'Server fisik di ruang data', 'Kabel jaringan'], a: 0 },
      { q: 'Apa keuntungan utama elastisitas pada cloud?', o: ['Kapasitas dapat naik atau turun sesuai kebutuhan', 'Harga selalu tetap', 'Tidak memerlukan internet', 'Data tidak pernah hilang'], a: 0 },
      { q: 'Model penerapan cloud yang dipakai khusus untuk satu organisasi disebut...', o: ['Public cloud', 'Private cloud', 'Hybrid cloud', 'Community cloud'], a: 1 },
      { q: 'Pay-as-you-go berarti...', o: ['Bayar di muka untuk lima tahun', 'Bayar sesuai pemakaian sumber daya', 'Gratis selamanya', 'Bayar hanya saat terjadi error'], a: 1 } ] },
    { id: 'e3', c: 'basdat', judul: 'Ujian Tengah Semester Cloud Computing', buka: at(6, 9, 0), tutup: at(6, 11, 0), menit: 90, soal: [] },
    { id: 'e4', c: 'web', judul: 'Kuis 1: HTML dan CSS', buka: at(-12, 8, 0), tutup: at(-10), menit: 10, soal: [] }
  ];
  var baseResults = { e4: { skor: 85, at: at(-11, 9, 20) } };
  function eById(id) { return exams.filter(function (e) { return e.id === id; })[0]; }

  /* ---------- state ---------- */
  var KEY = 'pbc-v2-' + me.id, saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  var state = {
    route: 'beranda', course: saved.course || 'jarkom',
    done: Object.assign({ j7a: 1, j7b: 1, b8a: 1, s8a: 1, s8b: 1, w8a: 1 }, saved.done),
    subs: Object.assign({}, baseSubs, saved.subs),
    results: Object.assign({}, baseResults, saved.results),
    exam: saved.exam || null,
    draft: {}, openTask: null, filter: 'semua', review: null, confirm: false, err: null
  };
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ course: state.course, done: state.done, subs: state.subs, results: state.results, exam: state.exam })); } catch (e) {}
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- util ---------- */
  function fmt(ts) { return new Date(ts).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ':'); }
  function rel(ts) {
    var d = ts - Date.now();
    if (d < 0) return 'Sudah lewat';
    var days = Math.floor(d / D), h = Math.floor((d % D) / H);
    if (days >= 1) return days + ' hari ' + h + ' jam lagi';
    if (h >= 1) return h + ' jam lagi';
    return Math.max(1, Math.round(d / 60000)) + ' menit lagi';
  }
  function clock(ms) { ms = Math.max(0, ms); var s = Math.floor(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function progress(c) {
    var all = 0, ok = 0;
    c.pertemuan.forEach(function (p) { p.items.forEach(function (i) { all++; if (state.done[i.id]) ok++; }); });
    return { all: all, ok: ok, pct: all ? Math.round(ok / all * 100) : 0 };
  }
  function examStatus(e) {
    if (state.results[e.id]) return 'selesai';
    var n = Date.now();
    if (n < e.buka) return 'belum';
    if (n > e.tutup) return 'tutup';
    return 'buka';
  }
  function taskStatus(t) {
    var s = state.subs[t.id];
    if (s && s.nilai != null) return 'dinilai';
    if (s) return 'kumpul';
    return t.due < Date.now() ? 'lewat' : 'belum';
  }
  var PILL = {
    dinilai: ['done', 'Sudah dinilai'], kumpul: ['open', 'Menunggu nilai'], lewat: ['late', 'Tidak dikumpulkan'], belum: ['wait', 'Belum dikumpulkan'],
    selesai: ['done', 'Selesai'], belum_: ['idle', 'Belum dibuka'], tutup: ['late', 'Ditutup'], buka: ['open', 'Sedang dibuka']
  };
  function pill(key) { var p = PILL[key]; return '<span class="pill ' + p[0] + '">' + p[1] + '</span>'; }

  /* ---------- tampilan ---------- */
  function vBeranda() {
    var h = new Date().getHours();
    var sapa = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
    var pend = tugas.filter(function (t) { return taskStatus(t) === 'belum'; }).sort(function (a, b) { return a.due - b.due; });
    var open = exams.filter(function (e) { return examStatus(e) === 'buka'; });
    var run = state.exam;
    var html = '<div class="head"><span class="eyebrow">Semester Ganjil 2026/2027</span><h1>' + sapa + ', ' + esc(me.nama.split(' ')[0]) + '</h1><p>Materi, tugas, dan ujian semua mata kuliahmu ada di sini. Kerjakan dari perangkat apa saja.</p></div>';
    html += '<div class="cols"><section class="panel"><h2>Tugas yang perlu dikerjakan</h2>';
    html += pend.length ? '<ul class="rows">' + pend.map(function (t) {
      return '<li><div class="t"><b>' + esc(t.judul) + '</b><span class="sub">' + esc(cById(t.c).nama) + ' · tenggat ' + fmt(t.due) + '</span></div><span class="pill wait">' + rel(t.due) + '</span></li>';
    }).join('') + '</ul><a class="link" href="#tugas">Buka semua tugas</a>' : '<p class="empty">Semua tugas sudah terkumpul.</p>';
    html += '</section><section class="panel"><h2>Ujian</h2>';
    if (run) {
      var re = eById(run.id);
      html += '<p><b>' + esc(re.judul) + '</b></p><p class="sub">Ujianmu sedang berjalan. Sisa waktu mengikuti jam server.</p><a class="btn" style="text-align:center;text-decoration:none" href="#ujian">Lanjutkan ujian</a>';
    } else if (open.length) {
      html += '<ul class="rows">' + open.map(function (e) {
        return '<li><div class="t"><b>' + esc(e.judul) + '</b><span class="sub">' + e.menit + ' menit · ditutup ' + fmt(e.tutup) + '</span></div></li>';
      }).join('') + '</ul><a class="btn" style="text-align:center;text-decoration:none" href="#ujian">Lihat ujian</a>';
    } else html += '<p class="empty">Belum ada ujian yang dibuka.</p>';
    html += '</section></div>';
    html += '<section style="display:flex;flex-direction:column;gap:14px"><h2 style="font-size:22px">Mata kuliah saya</h2><div class="courses">' + courses.map(function (c) {
      var p = progress(c);
      return '<button class="course" type="button" data-act="goto-course" data-id="' + c.id + '"><span class="eyebrow">' + c.kode + ' · ' + c.sks + ' SKS</span><h3>' + esc(c.nama) + '</h3><span class="sub">' + esc(c.dosen) + '</span><div class="meter" role="img" aria-label="Materi selesai ' + p.pct + ' persen"><i style="width:' + p.pct + '%"></i></div><span class="mono">' + p.ok + ' dari ' + p.all + ' materi selesai</span></button>';
    }).join('') + '</div></section>';
    return html;
  }

  function vMateri() {
    var c = cById(state.course);
    var html = '<div class="head"><span class="eyebrow">Materi kuliah</span><h1>' + esc(c.nama) + '</h1><p>' + esc(c.dosen) + ' · ' + c.kode + '. Centang materi yang sudah kamu pelajari agar kemajuanmu tercatat.</p></div>';
    html += '<div class="chips" role="group" aria-label="Pilih mata kuliah">' + courses.map(function (x) {
      return '<button class="chip" type="button" data-act="course" data-id="' + x.id + '" aria-pressed="' + (x.id === c.id) + '">' + esc(x.nama) + '</button>';
    }).join('') + '</div>';
    var p = progress(c);
    html += '<div class="panel" style="flex-direction:row;align-items:center;gap:16px;flex-wrap:wrap"><div class="meter" style="flex:1;min-width:140px" role="img" aria-label="Kemajuan ' + p.pct + ' persen"><i style="width:' + p.pct + '%"></i></div><span class="mono">' + p.ok + ' / ' + p.all + ' materi selesai</span></div>';
    html += c.pertemuan.map(function (m, idx) {
      var n = m.items.filter(function (i) { return state.done[i.id]; }).length;
      return '<details class="meet"' + (idx === 0 ? ' open' : '') + '><summary><span>' + esc(m.t) + '</span><span class="mono">' + n + '/' + m.items.length + '</span></summary><ul class="rows">' + m.items.map(function (i) {
        return '<li><div class="t"><b><span class="type">' + i.tipe + '</span>' + esc(i.judul) + '</b><span class="sub">' + esc(i.meta) + '</span></div><label class="check"><input type="checkbox" data-act="done" data-id="' + i.id + '"' + (state.done[i.id] ? ' checked' : '') + '>Selesai</label></li>';
      }).join('') + '</ul></details>';
    }).join('');
    return html;
  }

  function vTugas() {
    var list = tugas.slice().sort(function (a, b) { return a.due - b.due; }).filter(function (t) {
      var s = taskStatus(t);
      return state.filter === 'semua' || (state.filter === 'belum' && s === 'belum') || (state.filter === 'kumpul' && (s === 'kumpul' || s === 'dinilai'));
    });
    var html = '<div class="head"><span class="eyebrow">Pengumpulan tugas</span><h1>Tugas</h1><p>Unggah berkas sebelum tenggat. Selama tenggat belum lewat, kamu masih bisa mengganti berkas.</p></div>';
    html += '<div class="chips" role="group" aria-label="Saring tugas">' + [['semua', 'Semua'], ['belum', 'Belum dikumpulkan'], ['kumpul', 'Sudah dikumpulkan']].map(function (f) {
      return '<button class="chip" type="button" data-act="filter" data-id="' + f[0] + '" aria-pressed="' + (state.filter === f[0]) + '">' + f[1] + '</button>';
    }).join('') + '</div>';
    html += list.length ? list.map(function (t) {
      var s = taskStatus(t), sub = state.subs[t.id], open = state.openTask === t.id, d = state.draft[t.id] || {};
      var h = '<article class="task"><div class="task-top"><div class="t"><b>' + esc(t.judul) + '</b><span class="sub">' + esc(cById(t.c).nama) + ' · tenggat ' + fmt(t.due) + (t.due > Date.now() ? ' (' + rel(t.due) + ')' : '') + '</span></div><div class="r">' + pill(s) + '<button class="btn ghost" type="button" data-act="open-task" data-id="' + t.id + '" aria-expanded="' + open + '">' + (open ? 'Tutup' : s === 'belum' ? 'Kerjakan' : 'Lihat') + '</button></div></div>';
      if (open) {
        h += '<div class="task-body"><p>' + esc(t.desc) + '</p>';
        if (sub && sub.nilai != null) h += '<div class="grade"><b>' + sub.nilai + '</b><span>' + esc(sub.catatan || '') + '</span></div>';
        if (sub) h += '<p class="sub">Berkas terkumpul: <b class="mono">' + esc(sub.file) + '</b> pada ' + fmt(sub.at) + '</p>';
        if (t.due > Date.now() && !(sub && sub.nilai != null)) {
          h += '<div class="file"><input type="file" id="f-' + t.id + '" data-act="file" data-id="' + t.id + '" accept=".pdf,.doc,.docx,.zip"><span class="sub fname" id="fn-' + t.id + '">' + (d.file ? 'Dipilih: ' + esc(d.file) : 'PDF, DOCX, atau ZIP') + '</span></div>';
          h += '<textarea id="note-' + t.id + '" data-act="note" data-id="' + t.id + '" placeholder="Catatan untuk dosen (opsional)">' + esc(d.note || '') + '</textarea>';
          if (state.err === t.id) h += '<p class="err">Pilih berkas terlebih dahulu sebelum mengumpulkan.</p>';
          h += '<div class="row"><button class="btn" type="button" data-act="submit" data-id="' + t.id + '">' + (sub ? 'Ganti berkas' : 'Kumpulkan tugas') + '</button></div>';
        } else if (!sub) h += '<p class="err">Pengumpulan sudah ditutup karena tenggat terlewat.</p>';
        h += '</div>';
      }
      return h + '</article>';
    }).join('') : '<p class="empty">Tidak ada tugas pada kategori ini.</p>';
    return html;
  }

  function vUjian() {
    if (state.exam) return vRun();
    if (state.review) return vResult(state.review);
    var html = '<div class="head"><span class="eyebrow">Ujian daring</span><h1>Ujian</h1><p>Ujian dibuka sesuai jadwal. Waktu berjalan sejak kamu menekan Mulai dan tidak berhenti walau halaman ditutup.</p></div>';
    if (state.start) {
      var e = eById(state.start);
      return html + '<section class="panel"><h2>' + esc(e.judul) + '</h2><p class="sub">' + esc(cById(e.c).nama) + ' · ' + e.soal.length + ' soal pilihan ganda · ' + e.menit + ' menit</p><ul class="rules"><li>Waktu mulai berjalan begitu kamu menekan Mulai ujian.</li><li>Kamu bisa berpindah antarsoal dan mengubah jawaban sebelum dikumpulkan.</li><li>Ujian dikumpulkan otomatis saat waktu habis.</li><li>Pastikan sambungan internet stabil.</li></ul><div class="row"><button class="btn" type="button" data-act="begin" data-id="' + e.id + '">Mulai ujian</button><button class="btn ghost" type="button" data-act="cancel-start">Kembali</button></div></section>';
    }
    return html + '<div style="display:flex;flex-direction:column;gap:12px">' + exams.slice().sort(function (a, b) { return a.buka - b.buka; }).map(function (e) {
      var s = examStatus(e), r = state.results[e.id], key = s === 'belum' ? 'belum_' : s, act = '';
      if (s === 'buka' && e.soal.length) act = '<button class="btn" type="button" data-act="start" data-id="' + e.id + '">Mulai</button>';
      if (r && e.soal.length) act = '<button class="btn ghost" type="button" data-act="review" data-id="' + e.id + '">Lihat hasil</button>';
      var info = s === 'belum' ? 'Dibuka ' + fmt(e.buka) : s === 'buka' ? 'Ditutup ' + fmt(e.tutup) : r ? 'Nilai ' + r.skor : 'Ditutup ' + fmt(e.tutup);
      return '<article class="exam"><div class="t"><b>' + esc(e.judul) + '</b><span class="sub">' + esc(cById(e.c).nama) + ' · ' + e.menit + ' menit · ' + info + '</span></div><div class="row">' + pill(key) + act + '</div></article>';
    }).join('') + '</div>';
  }

  function vRun() {
    var s = state.exam, e = eById(s.id), q = e.soal[s.idx], n = e.soal.length;
    var answered = s.answers.filter(function (a) { return a != null; }).length;
    var html = '<div class="runbar"><div><div class="eyebrow">' + esc(cById(e.c).nama) + '</div><b>' + esc(e.judul) + '</b></div><div class="timer" id="timer" role="timer" aria-label="Sisa waktu">' + clock(s.endAt - Date.now()) + '</div></div>';
    html += '<section class="panel" style="gap:18px"><span class="eyebrow">Soal ' + (s.idx + 1) + ' dari ' + n + '</span><p class="q">' + esc(q.q) + '</p><div class="opts" role="radiogroup">' + q.o.map(function (o, i) {
      var sel = s.answers[s.idx] === i;
      return '<label class="opt' + (sel ? ' sel' : '') + '"><input type="radio" name="opt" value="' + i + '" data-act="answer"' + (sel ? ' checked' : '') + '><span class="k">' + 'ABCD'[i] + '</span><span>' + esc(o) + '</span></label>';
    }).join('') + '</div><div class="row"><button class="btn ghost" type="button" data-act="prev"' + (s.idx === 0 ? ' disabled' : '') + '>Sebelumnya</button><button class="btn ghost" type="button" data-act="next"' + (s.idx === n - 1 ? ' disabled' : '') + '>Berikutnya</button></div></section>';
    html += '<section class="panel"><h2 style="font-size:18px">Navigasi soal</h2><div class="nums">' + e.soal.map(function (_, i) {
      return '<button type="button" data-act="jump" data-id="' + i + '" class="' + (s.answers[i] != null ? 'ans ' : '') + (i === s.idx ? 'cur' : '') + '" aria-label="Soal ' + (i + 1) + (s.answers[i] != null ? ', sudah dijawab' : ', belum dijawab') + '">' + (i + 1) + '</button>';
    }).join('') + '</div><p class="sub">' + answered + ' dari ' + n + ' soal terjawab.</p>';
    if (state.confirm) {
      html += '<div class="warnbox"><span>' + (answered < n ? (n - answered) + ' soal belum dijawab. ' : '') + 'Setelah dikumpulkan, jawaban tidak bisa diubah.</span><div class="row"><button class="btn danger" type="button" data-act="finish">Ya, kumpulkan sekarang</button><button class="btn ghost" type="button" data-act="cancel-finish">Lanjut mengerjakan</button></div></div>';
    } else html += '<div class="row"><button class="btn" type="button" data-act="ask-finish">Kumpulkan ujian</button></div>';
    return html + '</section>';
  }

  function vResult(id) {
    var e = eById(id), r = state.results[id];
    var html = '<div class="head"><span class="eyebrow">' + esc(cById(e.c).nama) + '</span><h1>' + esc(e.judul) + '</h1></div>';
    html += '<section class="panel"><span class="eyebrow">Nilai kamu</span><div class="score">' + r.skor + '</div><p class="sub">' + (r.benar != null ? r.benar + ' dari ' + r.total + ' soal benar' : '') + (r.auto ? ' · dikumpulkan otomatis saat waktu habis' : '') + '</p></section>';
    if (r.ans) html += e.soal.map(function (q, i) {
      return '<section class="panel"><span class="eyebrow">Soal ' + (i + 1) + (r.ans[i] === q.a ? ' · benar' : ' · salah') + '</span><p class="q" style="font-size:19px">' + esc(q.q) + '</p><div class="opts">' + q.o.map(function (o, k) {
        var cls = k === q.a ? ' right' : (k === r.ans[i] ? ' wrong' : '');
        return '<div class="opt' + cls + '"><span class="k">' + 'ABCD'[k] + '</span><span>' + esc(o) + (k === q.a ? ' (kunci)' : k === r.ans[i] ? ' (jawabanmu)' : '') + '</span></div>';
      }).join('') + '</div></section>';
    }).join('');
    return html + '<div class="row"><button class="btn ghost" type="button" data-act="back-exams">Kembali ke daftar ujian</button></div>';
  }

  /* ---------- render ---------- */
  var view = document.getElementById('view');
  var ROUTES = { beranda: vBeranda, materi: vMateri, tugas: vTugas, ujian: vUjian };
  function render() {
    document.querySelectorAll('.nav a').forEach(function (a) { if (a.dataset.r === state.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var nt = tugas.filter(function (t) { return taskStatus(t) === 'belum'; }).length;
    var ne = exams.filter(function (e) { return examStatus(e) === 'buka' && e.soal.length; }).length;
    var a = document.getElementById('n-tugas'), b = document.getElementById('n-ujian');
    a.textContent = nt; a.hidden = !nt; b.textContent = ne; b.hidden = !ne;
    view.innerHTML = ROUTES[state.route]();
  }
  function route() {
    var r = location.hash.slice(1);
    state.route = ROUTES[r] ? r : 'beranda';
    state.confirm = false;
    if (state.route !== 'ujian') { state.review = null; state.start = null; }
    render(); window.scrollTo(0, 0);
  }

  /* ---------- ujian ---------- */
  function finishExam(auto) {
    var s = state.exam; if (!s) return;
    var e = eById(s.id), benar = 0;
    e.soal.forEach(function (q, i) { if (s.answers[i] === q.a) benar++; });
    state.results[e.id] = { skor: Math.round(benar / e.soal.length * 100), benar: benar, total: e.soal.length, ans: s.answers.slice(), at: Date.now(), auto: !!auto };
    state.exam = null; state.confirm = false; state.review = e.id; state.route = 'ujian';
    persist(); render(); window.scrollTo(0, 0);
    toast(auto ? 'Waktu habis, ujian dikumpulkan otomatis' : 'Ujian berhasil dikumpulkan');
  }
  setInterval(function () {
    if (!state.exam) return;
    var left = state.exam.endAt - Date.now();
    if (left <= 0) { finishExam(true); return; }
    var t = document.getElementById('timer');
    if (t) { t.textContent = clock(left); t.classList.toggle('low', left < 60000); }
  }, 1000);

  /* ---------- peristiwa ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, id = el.dataset.id;
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio') return;
    if (act === 'goto-course') { state.course = id; persist(); location.hash = 'materi'; return; }
    if (act === 'course') { state.course = id; persist(); render(); }
    else if (act === 'filter') { state.filter = id; render(); }
    else if (act === 'open-task') { state.openTask = state.openTask === id ? null : id; state.err = null; render(); }
    else if (act === 'submit') {
      var d = state.draft[id] || {};
      var prev = state.subs[id];
      if (!d.file) { state.err = id; render(); return; }
      state.subs[id] = { file: d.file, note: d.note || '', at: Date.now() };
      delete state.draft[id]; state.err = null; state.openTask = null; persist(); render();
      toast(prev ? 'Berkas tugas diganti' : 'Tugas berhasil dikumpulkan');
    }
    else if (act === 'start') { state.start = id; render(); window.scrollTo(0, 0); }
    else if (act === 'cancel-start') { state.start = null; render(); }
    else if (act === 'begin') {
      var e = eById(id);
      state.exam = { id: id, idx: 0, answers: e.soal.map(function () { return null; }), endAt: Math.min(Date.now() + e.menit * 60000, e.tutup + 0) };
      state.exam.endAt = Date.now() + e.menit * 60000; state.start = null; persist(); render(); window.scrollTo(0, 0);
    }
    else if (act === 'prev') { state.exam.idx = Math.max(0, state.exam.idx - 1); persist(); render(); }
    else if (act === 'next') { state.exam.idx = Math.min(eById(state.exam.id).soal.length - 1, state.exam.idx + 1); persist(); render(); }
    else if (act === 'jump') { state.exam.idx = +id; persist(); render(); }
    else if (act === 'ask-finish') { state.confirm = true; render(); }
    else if (act === 'cancel-finish') { state.confirm = false; render(); }
    else if (act === 'finish') finishExam(false);
    else if (act === 'review') { state.review = id; render(); window.scrollTo(0, 0); }
    else if (act === 'back-exams') { state.review = null; render(); }
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target, act = el.dataset && el.dataset.act; if (!act) return;
    if (act === 'done') { if (el.checked) state.done[el.dataset.id] = 1; else delete state.done[el.dataset.id]; persist(); render(); }
    else if (act === 'answer') { state.exam.answers[state.exam.idx] = +el.value; persist(); render(); }
    else if (act === 'file') {
      var f = el.files && el.files[0], id = el.dataset.id;
      state.draft[id] = state.draft[id] || {};
      state.draft[id].file = f ? f.name : '';
      if (f) state.err = null;
      var fn = document.getElementById('fn-' + id);
      if (fn) fn.textContent = f ? 'Dipilih: ' + f.name : 'PDF, DOCX, atau ZIP';
    }
  });
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.dataset && el.dataset.act === 'note') { var id = el.dataset.id; state.draft[id] = state.draft[id] || {}; state.draft[id].note = el.value; }
  });
  document.getElementById('theme').addEventListener('click', function () {
    var r = document.documentElement, dark = r.getAttribute('data-theme') === 'dark' || (!r.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    r.setAttribute('data-theme', dark ? 'light' : 'dark');
  });
  window.addEventListener('hashchange', route);
  if (state.exam && state.exam.endAt <= Date.now()) { var left = state.exam; finishExam(true); }
  route();
})();