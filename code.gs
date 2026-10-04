/**
 * KEBABRIN – Google Apps Script
 * Cara pakai:
 * 1. Buka Google Spreadsheet > Extensions > Apps Script, tempel kode ini.
 * 2. Jalankan fungsi setup() sekali (izinkan akses). Sheet "Menu" dan "Pesanan" dibuat otomatis.
 * 3. Deploy > New deployment > Web app. Execute as: Me, Who has access: Anyone.
 * 4. Salin URL Web App ke API_URL di app.js.
 * Setelah mengubah kode, deploy ulang (New version).
 */
const SH_MENU = "Menu", SH_ORDER = "Pesanan";
const MENU_HEAD = ["id", "nama", "deskripsi", "harga", "rating", "kategori", "gambar", "aktif"];
const ORDER_HEAD = ["waktu", "kode", "nama", "telepon", "alamat", "catatan", "pesanan", "total", "status"];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let m = ss.getSheetByName(SH_MENU);
  if (!m) {
    m = ss.insertSheet(SH_MENU);
    m.getRange(1, 1, 1, MENU_HEAD.length).setValues([MENU_HEAD]).setFontWeight("bold");
    m.getRange(2, 1, 3, MENU_HEAD.length).setValues([
      ["K1", "Kebab Original", "Daging sapi panggang, selada, tomat, dan saus mayo.", 15000, 4.9, "biasa", "", "ya"],
      ["K2", "Kebab Pedas", "Daging sapi, sambal khas, bawang bombay, dan keju leleh.", 18000, 5.0, "pedas", "", "ya"],
      ["K3", "Kebab Ayam Keju", "Ayam panggang, mozzarella, sayur segar, saus BBQ.", 17000, 4.7, "biasa", "", "ya"]
    ]);
  }
  let o = ss.getSheetByName(SH_ORDER);
  if (!o) {
    o = ss.insertSheet(SH_ORDER);
    o.getRange(1, 1, 1, ORDER_HEAD.length).setValues([ORDER_HEAD]).setFontWeight("bold");
    o.getRange("D:D").setNumberFormat("@");
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readMenu_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_MENU);
  if (!sh) throw new Error("Sheet 'Menu' belum ada. Jalankan setup() dulu.");
  const rows = sh.getDataRange().getValues();
  const head = rows.shift().map(h => String(h).trim().toLowerCase());
  return rows.map(r => {
    const o = {}; head.forEach((h, i) => (o[h] = r[i])); return o;
  }).filter(o => o.id !== "" && o.nama !== "" && String(o.aktif).toLowerCase() !== "tidak");
}

function doGet() {
  try {
    const menu = readMenu_().map(o => ({
      id: String(o.id), nama: String(o.nama), deskripsi: String(o.deskripsi || ""),
      harga: Number(o.harga) || 0, rating: Number(o.rating) || 0,
      kategori: String(o.kategori || "").toLowerCase(), gambar: String(o.gambar || "")
    }));
    return json_({ ok: true, menu: menu });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const d = JSON.parse(e.postData.contents);
    const nama = String(d.nama || "").trim().slice(0, 60);
    const telepon = String(d.telepon || "").trim().slice(0, 16);
    const alamat = String(d.alamat || "").trim().slice(0, 200);
    const catatan = String(d.catatan || "").trim().slice(0, 150);
    if (nama.length < 2 || telepon.length < 8 || alamat.length < 5) throw new Error("Data pembeli tidak lengkap");
    if (!Array.isArray(d.items) || !d.items.length) throw new Error("Keranjang kosong");

    const menu = readMenu_(), lines = []; let total = 0;
    d.items.forEach(it => {
      const m = menu.find(x => String(x.id) === String(it.id));
      const q = Math.floor(Number(it.qty));
      if (!m || !(q > 0 && q <= 50)) throw new Error("Item tidak valid");
      total += (Number(m.harga) || 0) * q; // harga selalu dihitung ulang dari spreadsheet
      lines.push(q + "x " + m.nama);
    });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SH_ORDER);
    if (!sh) { setup(); sh = ss.getSheetByName(SH_ORDER); }
    const kode = "ORD-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyMMdd") + "-" + (sh.getLastRow()).toString().padStart(3, "0");
    const safe = s => /^[=+\-@]/.test(s) ? "'" + s : s; // cegah formula injection
    sh.appendRow([new Date(), kode, safe(nama), "'" + telepon, safe(alamat), safe(catatan), lines.join(", "), total, "Baru"]);
    return json_({ ok: true, id: kode, total: total });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
