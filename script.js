const STORAGE_KEY = 'lost_items';

const seed = [
    {
        id: 1, status: 'Hilang', namaPelapor: 'Ahmad Fauzi', kontak: '081298765432',
        namaBarang: 'Dompet kulit coklat (isi STNK dan KTP)', kategori: 'Dompet & Tas',
        lokasi: 'Kawasan Malioboro, Yogyakarta', tanggal: '2026-06-01',
        deskripsi: 'Hilang di sekitar area parkir timur. Ada hadiah bagi yang menemukan.', foto: ''
    },
    {
        id: 2, status: 'Temuan', namaPelapor: 'Siti Rahma', kontak: '085612345678',
        namaBarang: 'Kunci motor Honda dan STNK', kategori: 'Dokumen',
        lokasi: 'Fakultas Teknik Kampus', tanggal: '2026-06-02',
        deskripsi: 'Ditemukan di atas meja kantin area pojok.', foto: ''
    }
];

function loadReports() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (Array.isArray(saved)) return saved;
    } catch (err) { /* data rusak atau storage tidak tersedia */ }
    return seed;
}

let reports = loadReports();
let activeStatus = '';
let query = '';
let currentImage = '';

const $ = id => document.getElementById(id);
const form = $('reportForm');
const list = $('itemsContainer');
const emptyState = $('emptyState');
const emptyText = $('emptyText');
const resultCount = $('resultCount');
const message = $('formMessage');
const fotoInput = $('fotoBarang');
const previewBox = $('imagePreviewContainer');
const previewImg = $('imagePreview');

/* Tanggal tidak boleh di masa depan */
const today = new Date();
$('tanggal').max = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/* ---------- Util ---------- */
function escapeHTML(str = '') {
    return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPhone(phone) {
    let n = phone.replace(/\D/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    return n;
}

function contactLink(item) {
    const text = encodeURIComponent('Halo, saya menghubungi terkait laporan "' + item.namaBarang + '" di CariBarang.ID');
    if (item.kontak.includes('@')) {
        return { href: `mailto:${encodeURIComponent(item.kontak)}?subject=${encodeURIComponent('Laporan ' + item.namaBarang)}`, label: 'Kirim email' };
    }
    return { href: `https://wa.me/${formatPhone(item.kontak)}?text=${text}`, label: 'Hubungi via WhatsApp' };
}

/* ---------- Gambar ---------- */
function compressImage(file, maxWidth = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = e => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function clearImage() {
    fotoInput.value = '';
    currentImage = '';
    previewImg.src = '';
    previewBox.classList.add('hidden');
}

fotoInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        currentImage = await compressImage(file);
        previewImg.src = currentImage;
        previewBox.classList.remove('hidden');
        setMessage('');
    } catch (err) {
        clearImage();
        setMessage('Foto tidak bisa dibaca. Pilih file gambar lain (JPG atau PNG).', 'error');
    }
});
$('removeImageBtn').addEventListener('click', clearImage);

/* ---------- Tampilan daftar ---------- */
function render() {
    const q = query.trim().toLowerCase();
    const rows = reports
        .filter(r => !activeStatus || r.status === activeStatus)
        .filter(r => !q || [r.namaBarang, r.lokasi, r.kategori, r.deskripsi].some(v => (v || '').toLowerCase().includes(q)))
        .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.id - a.id);

    resultCount.textContent = rows.length ? `${rows.length} laporan` : '';
    list.innerHTML = '';
    emptyState.classList.toggle('hidden', rows.length > 0);

    if (!rows.length) {
        emptyText.textContent = (q || activeStatus)
            ? 'Tidak ada laporan yang cocok. Coba kata kunci lain atau hapus filter.'
            : 'Belum ada laporan.';
        return;
    }

    list.innerHTML = rows.map(item => {
        const c = contactLink(item);
        const thumb = item.foto
            ? `<img src="${item.foto}" alt="Foto ${escapeHTML(item.namaBarang)}" loading="lazy">`
            : 'Tanpa foto';
        return `
        <article class="item">
            <div class="thumb">${thumb}</div>
            <div>
                <div class="item-head">
                    <span class="status ${item.status.toLowerCase()}">${item.status === 'Hilang' ? 'Hilang' : 'Ditemukan'}</span>
                    <time datetime="${escapeHTML(item.tanggal)}">${formatDate(item.tanggal)}</time>
                </div>
                <h3>${escapeHTML(item.namaBarang)}</h3>
                <p class="meta">${escapeHTML(item.kategori)}, di ${escapeHTML(item.lokasi)}</p>
                ${item.deskripsi ? `<p class="desc">${escapeHTML(item.deskripsi)}</p>` : ''}
                <div class="item-foot">
                    <span>Dilaporkan oleh ${escapeHTML(item.namaPelapor)}</span>
                    <a class="contact-link" href="${c.href}" target="_blank" rel="noopener noreferrer">${c.label}</a>
                </div>
            </div>
        </article>`;
    }).join('');
}

/* ---------- Filter & pencarian ---------- */
$('searchInput').addEventListener('input', e => { query = e.target.value; render(); });

document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
        activeStatus = btn.dataset.status;
        document.querySelectorAll('.chip').forEach(b => {
            const on = b === btn;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', on);
        });
        render();
    });
});

/* ---------- Form ---------- */
function setMessage(text, type = '') {
    message.textContent = text;
    message.className = 'message ' + type;
}

function isValidContact(v) {
    const value = v.trim();
    if (value.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const digits = value.replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
}

form.addEventListener('submit', e => {
    e.preventDefault();
    form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));

    const val = id => $(id).value.trim();
    const required = ['namaBarang', 'lokasi', 'tanggal', 'namaPelapor', 'kontak'];
    const missing = required.filter(id => !val(id));

    if (missing.length) {
        missing.forEach(id => $(id).classList.add('invalid'));
        $(missing[0]).focus();
        setMessage('Lengkapi kolom yang ditandai.', 'error');
        return;
    }
    if (!isValidContact(val('kontak'))) {
        $('kontak').classList.add('invalid');
        $('kontak').focus();
        setMessage('Isi nomor WhatsApp (9–15 digit) atau alamat email yang valid.', 'error');
        return;
    }

    const report = {
        id: Date.now(),
        status: val('status'),
        namaPelapor: val('namaPelapor'),
        kontak: val('kontak'),
        namaBarang: val('namaBarang'),
        kategori: val('kategori'),
        lokasi: val('lokasi'),
        tanggal: val('tanggal'),
        deskripsi: val('deskripsi'),
        foto: currentImage
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...reports, report]));
    } catch (err) {
        setMessage('Laporan tidak tersimpan karena penyimpanan browser penuh. Coba tanpa foto atau gunakan foto yang lebih kecil.', 'error');
        return;
    }

    reports.push(report);
    form.reset();
    clearImage();
    setMessage('Laporan terkirim dan sudah muncul di daftar.', 'ok');
    render();
});

render();
