/* ====== ISI DI SINI ======
   Tempel URL Web App dari Google Apps Script (Deploy > New deployment > Web app)
   Contoh: "https://script.google.com/macros/s/AKfycb.../exec" */
const API_URL = "PASTE_URL_WEB_APP_DI_SINI";
/* ========================= */

(function () {
  "use strict";
  const DEMO = [
    { id: "K1", nama: "Kebab Original", deskripsi: "Daging sapi panggang, selada, tomat, dan saus mayo.", harga: 15000, rating: 4.9, kategori: "biasa", gambar: "" },
    { id: "K2", nama: "Kebab Pedas", deskripsi: "Daging sapi, sambal khas, bawang bombay, dan keju leleh.", harga: 18000, rating: 5.0, kategori: "pedas", gambar: "" },
    { id: "K3", nama: "Kebab Ayam Keju", deskripsi: "Ayam panggang, mozzarella, sayur segar, saus BBQ.", harga: 17000, rating: 4.7, kategori: "biasa", gambar: "" }
  ];
  const $ = s => document.querySelector(s);
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hasApi = /^https:\/\/script\.google\.com\//.test(API_URL);
  let menu = [], cart = {}, filter = "semua", busy = false, tt;

  function toast(msg, err) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast on" + (err ? " err" : "");
    clearTimeout(tt); tt = setTimeout(() => (t.className = "toast"), 3200);
  }

  /* Animasi muncul saat scroll */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12, rootMargin: "0px 0px -40px 0px" })
    : null;
  function reveal(root) {
    (root || document).querySelectorAll(".rv:not(.in)").forEach(el => io ? io.observe(el) : el.classList.add("in"));
  }

  /* Data menu */
  async function load() {
    if (!hasApi) { menu = DEMO; toast("Mode demo: isi API_URL di app.js untuk terhubung ke spreadsheet", true); return; }
    try {
      const r = await fetch(API_URL, { redirect: "follow" });
      const d = await r.json();
      if (!d.ok || !Array.isArray(d.menu)) throw new Error(d.error || "Format data salah");
      menu = d.menu.map(m => ({ ...m, harga: Number(m.harga) || 0, rating: Number(m.rating) || 0 }));
    } catch (e) { menu = []; $("#grid").innerHTML = '<p class="note">Menu gagal dimuat. Periksa URL Web App dan pengaturan akses (Anyone).</p>'; return false; }
  }

  function icon(m) { return m.gambar ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy" onerror="this.remove()">` : '<svg viewBox="0 0 120 170" aria-hidden="true"><use href="#kb"/></svg>'; }

  function render() {
    const cats = ["semua", ...new Set(menu.map(m => String(m.kategori || "").toLowerCase()).filter(Boolean))];
    if (!cats.includes(filter)) filter = "semua";
    $("#chips").innerHTML = cats.length > 2 ? cats.map(c => `<button class="chip${c === filter ? " on" : ""}" data-c="${esc(c)}">${esc(c.charAt(0).toUpperCase() + c.slice(1))}</button>`).join("") : "";
    const list = menu.filter(m => filter === "semua" || String(m.kategori).toLowerCase() === filter);
    $("#grid").innerHTML = list.length ? list.map((m, i) => `
      <article class="card rv" style="--d:${(i % 3) * .12}s">
        <div class="im">${icon(m)}${m.rating ? `<span class="rt">${m.rating.toFixed(1)} ★</span>` : ""}</div>
        <h3>${esc(m.nama)}</h3><p>${esc(m.deskripsi)}</p>
        <div class="row"><span>${fmt(m.harga)}</span><button class="add" data-id="${esc(m.id)}" aria-label="Tambah ${esc(m.nama)}">+</button></div>
      </article>`).join("") : '<p class="note">Belum ada menu tersedia.</p>';
    reveal($("#grid"));
  }

  /* Keranjang */
  const find = id => menu.find(m => String(m.id) === String(id));
  function drawCart() {
    const ids = Object.keys(cart).filter(id => find(id));
    let total = 0, n = 0;
    $("#items").innerHTML = ids.length ? ids.map(id => {
      const m = find(id), q = cart[id]; total += m.harga * q; n += q;
      return `<div class="it"><div><b>${esc(m.nama)}</b><br>${fmt(m.harga)}</div><div class="q"><button data-m="${esc(id)}" aria-label="Kurangi">−</button><span>${q}</span><button data-p="${esc(id)}" aria-label="Tambah">+</button></div></div>`;
    }).join("") : '<p class="note" style="padding:20px 0">Keranjang masih kosong.</p>';
    $("#total").textContent = fmt(total); $("#cnt").textContent = n;
  }
  function openCart(on) {
    $("#cart").classList.toggle("on", on); $("#ov").classList.toggle("on", on);
    $("#cart").setAttribute("aria-hidden", String(!on));
    document.body.style.overflow = on ? "hidden" : "";
  }

  /* Kirim pesanan */
  async function submit(e) {
    e.preventDefault(); if (busy) return;
    const items = Object.keys(cart).filter(id => find(id)).map(id => ({ id, qty: cart[id] }));
    const nama = $("#nm").value.trim(), telepon = $("#tp").value.trim(), alamat = $("#al").value.trim(), catatan = $("#ct").value.trim();
    if (!items.length) return toast("Pilih menu terlebih dahulu", true);
    if (nama.length < 2) return toast("Isi nama dengan benar", true);
    if (!/^[0-9+\s-]{8,16}$/.test(telepon)) return toast("Nomor WhatsApp tidak valid", true);
    if (alamat.length < 5) return toast("Isi alamat pengantaran", true);
    busy = true; const b = $("#send"); b.disabled = true; b.textContent = "Mengirim…";
    try {
      if (hasApi) {
        const r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ nama, telepon, alamat, catatan, items }) });
        const d = await r.json(); if (!d.ok) throw new Error(d.error || "Gagal menyimpan");
        toast("Pesanan terkirim! Kode: " + d.id);
      } else { await new Promise(r => setTimeout(r, 600)); toast("Demo: pesanan berhasil (belum tersambung ke spreadsheet)"); }
      cart = {}; $("#f").reset(); drawCart(); openCart(false);
    } catch (err) { toast("Gagal mengirim: " + err.message, true); }
    busy = false; b.disabled = false; b.textContent = "Kirim pesanan";
  }

  document.addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.c) { filter = t.dataset.c; render(); }
    else if (t.classList.contains("add")) { cart[t.dataset.id] = (cart[t.dataset.id] || 0) + 1; drawCart(); toast("Ditambahkan ke keranjang"); }
    else if (t.dataset.p) { cart[t.dataset.p]++; drawCart(); }
    else if (t.dataset.m) { if (--cart[t.dataset.m] <= 0) delete cart[t.dataset.m]; drawCart(); }
    else if (t.dataset.r) {
      const pool = menu.filter(m => (String(m.kategori).toLowerCase() === "pedas") === (t.dataset.r === "pedas"));
      const m = pool.length ? pool[Math.floor(Math.random() * pool.length)] : menu[0];
      $("#rec").textContent = m ? `Coba ${m.nama} (${fmt(m.harga)}). ${m.deskripsi}` : "Menu belum tersedia.";
    }
  });
  $("#cartBtn").onclick = () => openCart(true);
  $("#close").onclick = $("#ov").onclick = () => openCart(false);
  document.addEventListener("keydown", e => e.key === "Escape" && openCart(false));
  $("#f").addEventListener("submit", submit);
  const hd = $("#hd"); const onScroll = () => hd.classList.toggle("sc", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  $("#yr").textContent = new Date().getFullYear();

  reveal();
  load().then(() => { if (menu.length) render(); drawCart(); });
})();
