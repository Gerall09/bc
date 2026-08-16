// Gacor King Web Application JavaScript Engine

// Initial Fallback Master Product Database
const DEFAULT_PRODUCTS = [
    { barcode: "8999999001014", nama: "Indomie Goreng Spesial 85g", kategori: "Sembako", supplier: "PT Indofood CBP Sukses Makmur", harga: 3100 },
    { barcode: "8991001202391", nama: "Minyak Goreng Filma Refill 2L", kategori: "Sembako", supplier: "PT SMART Tbk", harga: 34500 },
    { barcode: "8998866200112", nama: "Sabun Ekonomi Putih 500g", kategori: "Sabun", supplier: "Wings Group Indonesia", harga: 8500 },
    { barcode: "8992761001188", nama: "Kopi Kapal Api Mantap 165g", kategori: "Minuman", supplier: "PT Santos Jaya Abadi", harga: 14200 },
    { barcode: "8991001111005", nama: "Teh Pucuk Harum Botol 350ml", kategori: "Minuman", supplier: "Mayora Group", harga: 3500 },
    { barcode: "8992753000018", nama: "Susu Dancow Fortigro Cokelat 800g", kategori: "Susu", supplier: "Nestle Indonesia", harga: 98000 }
];

const GITHUB_JSON_URL = "https://raw.githubusercontent.com/Gerall09/produk.json/refs/heads/main/produk.json";

// App State
let masterProducts = [];
let returList = [];
let html5QrCode = null;
let currentFotoBase64 = "";
let searchIndex = [];
let selectedDetailProduct = null;
const MAX_SEARCH_RESULTS = 50;
const SEARCH_DEBOUNCE_MS = 200;

// Cache gambar agar tidak melakukan fetch berulang
const imageCache = {};
const DEFAULT_IMAGE_PLACEHOLDER = "https://via.placeholder.com/60/272c3d/ffffff?text=No+Img";
// Pending promises to avoid duplicate network calls
const pendingImageRequests = {};
// Queue for scheduled image fetches (to limit concurrency)
const imageFetchQueue = [];
let imageFetchActive = 0;
const IMAGE_FETCH_CONCURRENCY = 4;

function scheduleImageFetch(barcode, imgId) {
    if (!barcode) return;
    // If already cached, update immediately
    if (imageCache[barcode]) {
        const el = document.getElementById(imgId);
        if (el) el.src = imageCache[barcode];
        return;
    }

    // If already pending, attach a then handler to update element when ready
    if (pendingImageRequests[barcode]) {
        pendingImageRequests[barcode].then(url => {
            const el = document.getElementById(imgId);
            if (el) el.src = url;
        }).catch(() => {});
        return;
    }

    // Add to queue
    imageFetchQueue.push({ barcode, imgId });
    processImageQueue();
}

function processImageQueue() {
    while (imageFetchActive < IMAGE_FETCH_CONCURRENCY && imageFetchQueue.length > 0) {
        const job = imageFetchQueue.shift();
        imageFetchActive++;
        const { barcode, imgId } = job;

        const p = getProductImage(barcode)
            .then(url => {
                const el = document.getElementById(imgId);
                if (el) el.src = url;
            })
            .catch(() => {})
            .finally(() => {
                imageFetchActive--;
                processImageQueue();
            });

        // store pending so duplicate jobs can subscribe
        pendingImageRequests[barcode] = p;
        p.finally(() => { delete pendingImageRequests[barcode]; });
    }
}

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadDataFromStorage();
    setupTabNavigation();
    setupFormEvents();
    setupScannerEvents();
    setupModals();
    setupDetailModalEvents();
    renderAllViews();
});

// Theme Toggle Logic
function initTheme() {
    const savedTheme = localStorage.getItem("gacor_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        updateThemeIcon(true);
    } else {
        document.body.classList.remove("light-theme");
        updateThemeIcon(false);
    }

    const btnToggle = document.getElementById("btnToggleTheme");
    if (btnToggle) {
        btnToggle.addEventListener("click", () => {
            const isLight = document.body.classList.toggle("light-theme");
            localStorage.setItem("gacor_theme", isLight ? "light" : "dark");
            updateThemeIcon(isLight);
        });
    }
}

function updateThemeIcon(isLight) {
    const icon = document.getElementById("themeIcon");
    if (icon) {
        if (isLight) {
            icon.className = "fa-solid fa-sun";
            icon.style.color = "#f59e0b";
        } else {
            icon.className = "fa-solid fa-moon";
            icon.style.color = "";
        }
    }
}

// Toast Notifikasi
function showToast(msg) {
    const toast = document.getElementById("toastNotification");
    const toastMsg = document.getElementById("toastMessage");
    if (toast && toastMsg) {
        toastMsg.innerText = msg;
        toast.classList.remove("hidden");
        setTimeout(() => {
            toast.classList.add("hidden");
        }, 2000);
    }
}

// Copy to Clipboard Helper
function copyToClipboard(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} berhasil disalin!`);
    }).catch(err => {
        // Fallback
        const tempInput = document.createElement("input");
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        showToast(`${label} berhasil disalin!`);
    });
}

// Load Data from LocalStorage and Fetch GitHub Data
function loadDataFromStorage() {
    const savedProducts = localStorage.getItem("gacor_master_products");
    if (savedProducts) {
        masterProducts = JSON.parse(savedProducts);
    } else {
        masterProducts = [...DEFAULT_PRODUCTS];
    }

    const savedRetur = localStorage.getItem("gacor_retur_list");
    if (savedRetur) {
        returList = JSON.parse(savedRetur);
    }

    // Auto fetch from raw GitHub JSON
    fetchGitHubProducts();
    buildSearchIndex();
}

function buildSearchIndex() {
    searchIndex = masterProducts.map(p => ({
        barcode: p.barcode || "",
        barcodeLower: (p.barcode || "").toLowerCase(),
        namaLower: (p.nama || "").toLowerCase(),
        original: p
    }));
}

function debounce(fn, wait) {
    let t = null;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

async function fetchGitHubProducts() {
    const syncBadge = document.getElementById("syncStatusBadge");
    if (syncBadge) syncBadge.innerText = "Syncing...";

    try {
        const response = await fetch(GITHUB_JSON_URL);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const remoteProducts = data.map(item => ({
                    barcode: String(item.barcode || item.kode || item.sku || "").trim(),
                    nama: String(item.nama || item.name || item.product || "Tanpa Nama").trim(),
                    supplier: String(item.supplier || item.vendor || item.supplier_name || "-").trim(),
                    kategori: String(item.kategori || item.category || "Umum").trim(),
                    harga: Number(item.harga) || 0
                })).filter(p => p.barcode);

                if (remoteProducts.length > 0) {
                    const remoteBarcodeSet = new Set(remoteProducts.map(p => p.barcode));
                    const localOnly = masterProducts.filter(p => !remoteBarcodeSet.has(p.barcode));
                    masterProducts = [...remoteProducts, ...localOnly];

                    saveMasterProducts();
                    renderAllViews();
                    if (syncBadge) syncBadge.innerText = `🟢 Sync: ${remoteProducts.length} Produk`;
                }
            }
        }
    } catch (e) {
        console.warn("Gagal sinkronisasi data produk dari GitHub:", e);
        if (syncBadge) syncBadge.innerText = "🔴 Offline";
    }
    buildSearchIndex();
}

function saveMasterProducts() {
    localStorage.setItem("gacor_master_products", JSON.stringify(masterProducts));
    buildSearchIndex();
}

function saveReturList() {
    localStorage.setItem("gacor_retur_list", JSON.stringify(returList));
    updateReturBadge();
}

// Tab Navigation
function setupTabNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            const targetId = tab.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active");
        });
    });
}

// Auto-fill barcode logic
function handleBarcodeAutoFill(query) {
    query = query.trim();
    if (!query) return;

    const found = masterProducts.find(p => p.barcode === query || (query.length === 6 && p.barcode.endsWith(query)));
    if (found) {
        document.getElementById("returNama").value = found.nama;
        if (found.supplier && found.supplier !== "-") {
            document.getElementById("returSupplier").value = found.supplier;
            renderSupplierChips();
        }
    }
}

// Setup Forms & Event Listeners
function setupFormEvents() {
    document.getElementById("btnQtyMinus").addEventListener("click", () => {
        const input = document.getElementById("returQty");
        if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
    });

    document.getElementById("btnQtyPlus").addEventListener("click", () => {
        const input = document.getElementById("returQty");
        input.value = parseInt(input.value) + 1;
    });

    const barcodeInput = document.getElementById("returBarcode");
    barcodeInput.addEventListener("input", (e) => handleBarcodeAutoFill(e.target.value));
    barcodeInput.addEventListener("change", (e) => handleBarcodeAutoFill(e.target.value));
    barcodeInput.addEventListener("keyup", (e) => handleBarcodeAutoFill(e.target.value));

    document.getElementById("returSupplier").addEventListener("input", renderSupplierChips);

    document.getElementById("returFoto").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                currentFotoBase64 = event.target.result;
                document.getElementById("fotoPreview").src = currentFotoBase64;
                document.getElementById("fotoPreviewContainer").classList.remove("hidden");
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById("btnRemoveFoto").addEventListener("click", () => {
        currentFotoBase64 = "";
        document.getElementById("returFoto").value = "";
        document.getElementById("fotoPreviewContainer").classList.add("hidden");
    });

    document.getElementById("formRetur").addEventListener("submit", (e) => {
        e.preventDefault();
        const supplier = document.getElementById("returSupplier").value.trim();
        const barcode = document.getElementById("returBarcode").value.trim();
        const nama = document.getElementById("returNama").value.trim();
        const qty = parseInt(document.getElementById("returQty").value) || 1;
        const alasan = document.getElementById("returAlasan").value;
        const keterangan = document.getElementById("returKeterangan").value.trim();

        const existingIndex = returList.findIndex(item => item.barcode === barcode && item.alasan === alasan);

        if (existingIndex !== -1) {
            returList[existingIndex].qty += qty;
            if (supplier && returList[existingIndex].supplier === "-") {
                returList[existingIndex].supplier = supplier;
            }
            if (keterangan) {
                returList[existingIndex].keterangan = keterangan;
            }
            if (currentFotoBase64) {
                returList[existingIndex].foto = currentFotoBase64;
            }
            returList[existingIndex].timestamp = new Date().toLocaleString("id-ID");
            alert(`Jumlah QTY retur untuk "${returList[existingIndex].nama}" berhasil ditambahkan! Total QTY sekarang: ${returList[existingIndex].qty}`);
        } else {
            const newItem = {
                id: Date.now(),
                supplier,
                barcode,
                nama,
                qty,
                alasan,
                keterangan,
                foto: currentFotoBase64,
                timestamp: new Date().toLocaleString("id-ID")
            };
            returList.unshift(newItem);
            alert("Barang retur berhasil ditambahkan ke laporan!");
        }

        saveReturList();
        renderReturList();

        document.getElementById("returBarcode").value = "";
        document.getElementById("returNama").value = "";
        document.getElementById("returQty").value = "1";
        document.getElementById("returKeterangan").value = "";
        document.getElementById("btnRemoveFoto").click();
    });

    document.getElementById("btnClearAllRetur").addEventListener("click", () => {
        if (returList.length === 0) {
            alert("Daftar laporan retur sudah kosong.");
            return;
        }
        if (confirm("Apakah Anda yakin ingin menghapus SEMUA laporan retur?")) {
            returList = [];
            saveReturList();
            renderReturList();
            alert("Seluruh laporan retur telah dibersihkan.");
        }
    });

    document.getElementById("btnExportExcel").addEventListener("click", exportReturToExcel);
    const btnPdf = document.getElementById("btnExportPDF");
    if (btnPdf) btnPdf.addEventListener("click", exportReturToPDF);
    const btnWord = document.getElementById("btnExportWord");
    if (btnWord) btnWord.addEventListener("click", exportReturToWord);

    const debouncedSearch = debounce(renderSearchResults, SEARCH_DEBOUNCE_MS);
    const searchEl = document.getElementById("searchMasterQuery");
    if (searchEl) searchEl.addEventListener("input", debouncedSearch);

    document.getElementById("formAddMaster").addEventListener("submit", (e) => {
        e.preventDefault();
        const barcode = document.getElementById("newBarcode").value.trim();
        const nama = document.getElementById("newNama").value.trim();
        const kategori = document.getElementById("newKategori").value.trim() || "Umum";
        const supplier = document.getElementById("newSupplier").value.trim();
        const harga = parseFloat(document.getElementById("newHarga").value) || 0;

        masterProducts.push({ barcode, nama, kategori, supplier, harga });
        saveMasterProducts();
        renderMasterTable();
        renderSupplierDatalist();

        document.getElementById("modalAddMaster").classList.add("hidden");
        document.getElementById("formAddMaster").reset();
        alert("Produk berhasil ditambahkan ke Master!");
    });

    document.getElementById("btnRefresh").addEventListener("click", () => {
        fetchGitHubProducts();
    });

    setupPhotoEvents();
}

// Event handlers untuk Modal Detail Produk
function setupDetailModalEvents() {
    const modal = document.getElementById("modalProductDetail");
    const btnClose = document.getElementById("btnCloseProductDetailModal");
    const btnCopyNama = document.getElementById("btnCopyNama");
    const btnCopyBarcode = document.getElementById("btnCopyBarcode");
    const btnQuickRetur = document.getElementById("btnDetailQuickRetur");

    if (btnClose) {
        btnClose.addEventListener("click", () => modal.classList.add("hidden"));
    }

    if (btnCopyNama) {
        btnCopyNama.addEventListener("click", () => {
            const val = document.getElementById("detailProductNama").value;
            copyToClipboard(val, "Nama Produk");
        });
    }

    if (btnCopyBarcode) {
        btnCopyBarcode.addEventListener("click", () => {
            const val = document.getElementById("detailProductBarcode").value;
            copyToClipboard(val, "Barcode");
        });
    }

    if (btnQuickRetur) {
        btnQuickRetur.addEventListener("click", () => {
            if (selectedDetailProduct) {
                quickReturFromSearch(selectedDetailProduct.barcode);
                modal.classList.add("hidden");
            }
        });
    }
}

// Buka Pop-up Detail Produk
function openProductDetailModal(product) {
    selectedDetailProduct = product;
    const modal = document.getElementById("modalProductDetail");

    document.getElementById("detailProductNama").value = product.nama || "";
    document.getElementById("detailProductBarcode").value = product.barcode || "";
    document.getElementById("detailProductKategori").innerText = product.kategori || "-";
    document.getElementById("detailProductSupplier").innerText = product.supplier || "-";
    document.getElementById("detailProductHarga").innerText = product.harga ? `Rp ${product.harga.toLocaleString('id-ID')}` : "Rp 0";

    const imgEl = document.getElementById("detailProductImg");
    imgEl.src = product.image || imageCache[product.barcode] || DEFAULT_IMAGE_PLACEHOLDER;

    if (!product.image && !imageCache[product.barcode]) {
        scheduleImageFetch(product.barcode, 'detailProductImg');
    }

    modal.classList.remove("hidden");
}

function renderSupplierChips() {
    const inputVal = document.getElementById("returSupplier").value.toLowerCase().trim();
    const chipsContainer = document.getElementById("supplierChips");
    chipsContainer.innerHTML = "";

    const allSuppliers = [...new Set(masterProducts.map(p => p.supplier).filter(s => s && s !== "-"))];
    const filtered = inputVal ? allSuppliers.filter(s => s.toLowerCase().includes(inputVal)) : allSuppliers.slice(0, 5);

    filtered.forEach(sup => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerText = sup;
        chip.addEventListener("click", () => {
            document.getElementById("returSupplier").value = sup;
            renderSupplierChips();
        });
        chipsContainer.appendChild(chip);
    });
}

function renderSupplierDatalist() {
    const datalist = document.getElementById("supplierList");
    datalist.innerHTML = "";
    const allSuppliers = [...new Set(masterProducts.map(p => p.supplier).filter(s => s && s !== "-"))];
    allSuppliers.forEach(sup => {
        const opt = document.createElement("option");
        opt.value = sup;
        datalist.appendChild(opt);
    });
}

function setupScannerEvents() {
    document.getElementById("btnStartScan").addEventListener("click", () => startScanner("returBarcode"));
    document.getElementById("btnScanSearch").addEventListener("click", () => startScanner("searchMasterQuery"));
    document.getElementById("btnCloseScanner").addEventListener("click", stopScanner);
}

let photoStream = null;
function setupPhotoEvents() {
    const btnOpen = document.getElementById('btnOpenCameraPhoto');
    const btnClose = document.getElementById('btnClosePhotoModal');
    const btnCancel = document.getElementById('btnCancelPhoto');
    const btnCapture = document.getElementById('btnCapturePhoto');

    if (btnOpen) btnOpen.addEventListener('click', openPhotoModal);
    if (btnClose) btnClose.addEventListener('click', closePhotoModal);
    if (btnCancel) btnCancel.addEventListener('click', closePhotoModal);
    if (btnCapture) btnCapture.addEventListener('click', capturePhoto);

    const fileInput = document.getElementById('returFoto');
    if (fileInput) {
        fileInput.removeEventListener('change', null);
        fileInput.addEventListener('change', handleFileSelect);
    }
}

function openPhotoModal() {
    const modal = document.getElementById('modalPhotoCapture');
    modal.classList.remove('hidden');
    const video = document.getElementById('photoVideo');
    const constraints = { video: { facingMode: 'environment' }, audio: false };
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        photoStream = stream;
        video.srcObject = stream;
        video.play();
    }).catch(err => {
        alert('Tidak dapat mengakses kamera: ' + err);
        modal.classList.add('hidden');
    });
}

function closePhotoModal() {
    const modal = document.getElementById('modalPhotoCapture');
    modal.classList.add('hidden');
    if (photoStream) {
        photoStream.getTracks().forEach(t => t.stop());
        photoStream = null;
    }
}

function capturePhoto() {
    const video = document.getElementById('photoVideo');
    const canvas = document.getElementById('photoCanvas');
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    const ts = new Date().toLocaleString('id-ID');
    const padding = 12;
    ctx.font = `${Math.round(w/40)}px Arial`;
    ctx.textBaseline = 'bottom';
    const textWidth = ctx.measureText(ts).width;
    const x = w - textWidth - padding;
    const y = h - padding;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 8, y - Math.round(w/40) - 8, textWidth + 16, Math.round(w/40) + 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(ts, x, y);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    currentFotoBase64 = dataUrl;
    document.getElementById('fotoPreview').src = currentFotoBase64;
    document.getElementById('fotoPreviewContainer').classList.remove('hidden');
    closePhotoModal();
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('photoCanvas');
            const maxW = 1280;
            const scale = Math.min(1, maxW / img.width);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const ts = new Date().toLocaleString('id-ID');
            const padding = 12;
            ctx.font = `${Math.round(canvas.width/40)}px Arial`;
            ctx.textBaseline = 'bottom';
            const textWidth = ctx.measureText(ts).width;
            const x = canvas.width - textWidth - padding;
            const y = canvas.height - padding;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x - 8, y - Math.round(canvas.width/40) - 8, textWidth + 16, Math.round(canvas.width/40) + 12);
            ctx.fillStyle = '#fff';
            ctx.fillText(ts, x, y);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            currentFotoBase64 = dataUrl;
            document.getElementById('fotoPreview').src = currentFotoBase64;
            document.getElementById('fotoPreviewContainer').classList.remove('hidden');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
}

function startScanner(targetInputId) {
    const modal = document.getElementById("scannerModal");
    modal.classList.remove("hidden");

    if (html5QrCode) {
        stopScanner();
    }

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
            document.getElementById(targetInputId).value = decodedText;
            document.getElementById(targetInputId).dispatchEvent(new Event("input"));
            stopScanner();
        },
        () => {}
    ).catch(err => {
        alert("Tidak dapat mengakses kamera: " + err);
        stopScanner();
    });
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            document.getElementById("scannerModal").classList.add("hidden");
        }).catch(() => {
            document.getElementById("scannerModal").classList.add("hidden");
        });
    } else {
        document.getElementById("scannerModal").classList.add("hidden");
    }
}

function setupModals() {
    document.getElementById("btnOpenSupplierProducts").addEventListener("click", () => {
        const currentSup = document.getElementById("returSupplier").value.trim().toLowerCase();
        const modal = document.getElementById("modalSupplierProducts");
        const listContainer = document.getElementById("supplierProductsList");
        const title = document.getElementById("modalSupplierTitle");

        title.innerText = currentSup ? `Produk Supplier (${currentSup})` : "Daftar Semua Produk Master";
        listContainer.innerHTML = "";

        const filtered = currentSup 
            ? masterProducts.filter(p => p.supplier.toLowerCase().includes(currentSup))
            : masterProducts;

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="empty-state">Tidak ada produk terdaftar untuk supplier ini.</div>`;
        } else {
            filtered.forEach(p => {
                const item = document.createElement("div");
                item.className = "product-item-card";
                item.style.marginBottom = "8px";
                item.innerHTML = `
                    <div>
                        <div style="font-weight:700; font-size:13px; color:var(--text-main);">${p.nama}</div>
                        <div style="font-size:11px; color:var(--text-muted);">Barcode: ${p.barcode} • ${p.supplier}</div>
                    </div>
                    <button class="btn btn-gold btn-sm"><i class="fa-solid fa-check"></i> Pilih</button>
                `;
                item.addEventListener("click", () => {
                    document.getElementById("returBarcode").value = p.barcode;
                    document.getElementById("returNama").value = p.nama;
                    if (!document.getElementById("returSupplier").value && p.supplier) {
                        document.getElementById("returSupplier").value = p.supplier;
                    }
                    modal.classList.add("hidden");
                });
                listContainer.appendChild(item);
            });
        }

        modal.classList.remove("hidden");
    });

    document.getElementById("btnCloseSupplierModal").addEventListener("click", () => {
        document.getElementById("modalSupplierProducts").classList.add("hidden");
    });

    document.getElementById("btnOpenAddMasterModal").addEventListener("click", () => {
        document.getElementById("modalAddMaster").classList.remove("hidden");
    });
    document.getElementById("btnCloseMasterModal").addEventListener("click", () => {
        document.getElementById("modalAddMaster").classList.add("hidden");
    });
}

function renderAllViews() {
    renderReturList();
    renderSupplierDatalist();
    renderSupplierChips();
    renderSearchResults();
    renderMasterTable();
    updateReturBadge();
}

function updateReturBadge() {
    document.getElementById("returBadgeCount").innerText = returList.length;
}

function renderReturList() {
    const container = document.getElementById("returListContainer");
    container.innerHTML = "";

    if (returList.length === 0) {
        container.innerHTML = `<div class="empty-state">Belum ada laporan retur tertunda.</div>`;
        return;
    }

    returList.forEach((item) => {
        const card = document.createElement("div");
        card.className = "retur-card";
        card.innerHTML = `
            <div class="retur-card-info">
                <h3>${item.nama} <span class="retur-badge">${item.qty} Qty</span></h3>
                <div class="retur-meta">
                    <strong>Barcode:</strong> ${item.barcode} | <strong>Supplier:</strong> ${item.supplier}<br>
                    <strong>Alasan:</strong> ${item.alasan} ${item.keterangan ? `(${item.keterangan})` : ''}
                </div>
            </div>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteReturItem(${item.id})">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(card);
    });
}

function deleteReturItem(id) {
    returList = returList.filter(item => item.id !== id);
    saveReturList();
    renderReturList();
}

// Render Pencarian Produk Master (Bila dipencet akan membuka Pop-Up Detail)
function renderSearchResults() {
    const qEl = document.getElementById("searchMasterQuery");
    const query = (qEl ? qEl.value : "").toLowerCase().trim();
    const container = document.getElementById("searchResultsList");
    container.innerHTML = "";

    let results = [];
    if (!query) {
        results = masterProducts.slice(0, 10);
    } else if (searchIndex && searchIndex.length) {
        for (let i = 0; i < searchIndex.length; i++) {
            const si = searchIndex[i];
            if (si.barcodeLower.includes(query) || si.namaLower.includes(query) || (query.length === 6 && si.barcodeLower.endsWith(query))) {
                results.push(si.original);
                if (results.length >= MAX_SEARCH_RESULTS) break;
            }
        }
    } else {
        results = masterProducts.filter(p => p.barcode.toLowerCase().includes(query) || p.nama.toLowerCase().includes(query)).slice(0, MAX_SEARCH_RESULTS);
    }

    if (results.length === 0) {
        container.innerHTML = `<div class="empty-state">Tidak ada produk ditemukan.</div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    results.forEach((p, idx) => {
        const card = document.createElement("div");
        card.className = "product-item-card";
        const imgId = `img-search-${p.barcode}-${idx}`;
        const initialImg = p.image || imageCache[p.barcode] || DEFAULT_IMAGE_PLACEHOLDER;

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                <img id="${imgId}" src="${initialImg}" class="product-thumb" alt="${p.nama}">
                <div>
                    <div style="font-weight:700; font-size:14px; color:var(--text-main);">${p.nama}</div>
                    <div style="font-size:12px; color:var(--text-muted);">
                        Barcode: <strong style="color:var(--primary-gold)">${p.barcode}</strong> | Kat: ${p.kategori || '-'} | Sup: ${p.supplier || '-'}
                    </div>
                </div>
            </div>
            <button class="btn btn-gold btn-sm" onclick="event.stopPropagation(); quickReturFromSearch('${p.barcode}')">
                <i class="fa-solid fa-plus"></i> Retur
            </button>
        `;

        // Klik pada kartu produk memicu Pop-Up Detail Produk
        card.addEventListener("click", () => {
            openProductDetailModal(p);
        });

        frag.appendChild(card);

        if (!p.image && !imageCache[p.barcode]) {
            scheduleImageFetch(p.barcode, imgId);
        }
    });

    container.appendChild(frag);
}

function quickReturFromSearch(barcode) {
    const product = masterProducts.find(p => p.barcode === barcode);
    if (!product) return;

    document.getElementById("returSupplier").value = product.supplier;
    document.getElementById("returBarcode").value = product.barcode;
    document.getElementById("returNama").value = product.nama;

    document.querySelector('.nav-tab[data-tab="tab-retur"]').click();
}

function renderMasterTable() {
    const tbody = document.getElementById("masterTableBody");
    tbody.innerHTML = "";
    const limit = 100;
    const total = masterProducts.length;

    if (total === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "text-muted";
        td.innerText = "Tidak ada produk di Master.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    const count = Math.min(limit, total);
    for (let i = 0; i < count; i++) {
        const p = masterProducts[i];
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>${p.barcode}</code></td>
            <td><strong>${p.nama}</strong></td>
            <td>${p.kategori || ''}</td>
            <td>${p.supplier || ''}</td>
            <td>${p.harga != null ? 'Rp ' + p.harga.toLocaleString('id-ID') : ''}</td>
            <td>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteMasterProduct(${i})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    }

    if (total > limit) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "text-muted";
        td.style.paddingTop = "10px";
        td.innerText = `Menampilkan ${count} dari ${total} produk. Gunakan pencarian untuk menemukan item lain.`;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}

function deleteMasterProduct(index) {
    if (confirm("Hapus produk ini dari Master?")) {
        masterProducts.splice(index, 1);
        saveMasterProducts();
        renderMasterTable();
    }
}

async function exportReturToExcel() {
    if (returList.length === 0) { 
        alert("Belum ada barang retur yang diinput."); 
        return; 
    }
    
    const supplierInput = document.getElementById("returSupplier");
    const supplierName = ((supplierInput ? supplierInput.value : "").trim() || (returList[0]?.supplier || "SUPPLIER")).toUpperCase();
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

    if (typeof ExcelJS !== "undefined") {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Laporan Returan");
            worksheet.views = [{ showGridLines: true }];

            worksheet.getCell("A1").value = "SATUSAMA";
            worksheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF008000" } };

            worksheet.getCell("C1").value = "LAPORAN RETURAN UNTUK SUPPLIER";
            worksheet.getCell("C1").font = { name: "Calibri", size: 12, bold: true };

            worksheet.getCell("D1").value = "S001 Landak";
            worksheet.getCell("D1").font = { name: "Calibri", size: 11, bold: true };

            worksheet.getCell("C2").value = supplierName;
            worksheet.getCell("C2").font = { name: "Calibri", size: 12, bold: true };

            worksheet.getCell("D2").value = `TGL ${formattedDate}`;
            worksheet.getCell("D2").font = { name: "Calibri", size: 11, bold: true };

            const headers = ["NO", "BARCODE", "NAMA BARANG", "SUPPLIER", "QTY RETUR", "ALASAN RETUR", "KETERANGAN TAMBAHAN"];
            const headerRow = worksheet.getRow(4);

            headers.forEach((headerText, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.value = headerText;
                cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF90EE90" }
                };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = {
                    top: { style: "thin", color: { argb: "FF000000" } },
                    left: { style: "thin", color: { argb: "FF000000" } },
                    bottom: { style: "thin", color: { argb: "FF000000" } },
                    right: { style: "thin", color: { argb: "FF000000" } }
                };
            });

            returList.forEach((item, idx) => {
                const rowIndex = 5 + idx;
                const row = worksheet.getRow(rowIndex);
                const isEven = (idx + 1) % 2 === 0;
                const rowBgColor = isEven ? "FFE8F5E9" : "FFFFFFFF";

                const rowData = [
                    idx + 1,
                    String(item.barcode),
                    item.nama,
                    item.supplier || "-",
                    item.qty,
                    item.alasan || "-",
                    item.keterangan || "-"
                ];

                rowData.forEach((val, colIdx) => {
                    const cell = row.getCell(colIdx + 1);
                    cell.value = val;
                    cell.font = { name: "Calibri", size: 11 };
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: rowBgColor }
                    };
                    cell.border = {
                        top: { style: "thin", color: { argb: "FF000000" } },
                        left: { style: "thin", color: { argb: "FF000000" } },
                        bottom: { style: "thin", color: { argb: "FF000000" } },
                        right: { style: "thin", color: { argb: "FF000000" } }
                    };

                    if (colIdx === 0 || colIdx === 1 || colIdx === 4) cell.alignment = { horizontal: "center", vertical: "middle" };
                    else cell.alignment = { horizontal: "left", vertical: "middle" };
                });
            });

            worksheet.getColumn(1).width = 8;
            worksheet.getColumn(2).width = 20;
            worksheet.getColumn(3).width = 42;
            worksheet.getColumn(4).width = 30;
            worksheet.getColumn(5).width = 12;
            worksheet.getColumn(6).width = 18;
            worksheet.getColumn(7).width = 30;

            const fileDateStr = today.toISOString().slice(0, 10);
            const fileName = `Returan_${supplierName.replace(/\s+/g, "_")}_${fileDateStr}.xlsx`;

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
            return;
        } catch (err) {
            console.error("ExcelJS export failed, falling back to SheetJS:", err);
        }
    }

    const firstSupplier = supplierName || "UMUM";
    const dateStr = new Date().toLocaleDateString("id-ID");

    const excelData = [
        ["LAPORAN RETUR SUPPLIER - GACOR KING"],
        [`Nama Supplier: ${firstSupplier}`],
        [`Tanggal Penerimaan: ${dateStr}`],
        [],
        ["NO", "BARCODE", "NAMA BARANG", "SUPPLIER", "QTY RETUR", "ALASAN RETUR", "KETERANGAN TAMBAHAN", "WAKTU SCAN"]
    ];

    let totalQty = 0;
    returList.forEach((item, index) => {
        excelData.push([
            index + 1,
            item.barcode,
            item.nama,
            item.supplier,
            item.qty,
            item.alasan,
            item.keterangan || "-",
            item.timestamp
        ]);
        totalQty += item.qty;
    });

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Retur");

    const filename = `LAPORAN_RETUR_${firstSupplier.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
}

function exportReturToPDF() {
    if (returList.length === 0) { alert("Belum ada barang retur yang diinput."); return; }
    const supplier = (document.getElementById("returSupplier").value || returList[0]?.supplier || "").toUpperCase();
    const dateStr = new Date().toLocaleDateString('id-ID');
    let html = `<html><head><title>Laporan Retur</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#000}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:6px;text-align:left}th{background:#eee}</style></head><body>`;
    html += `<h2>LAPORAN RETUR SUPPLIER - ${supplier}</h2><div>Tanggal: ${dateStr}</div><br/>`;
    html += `<table><thead><tr><th>No</th><th>Barcode</th><th>Nama Barang</th><th>Supplier</th><th>Qty</th><th>Alasan</th><th>Keterangan</th></tr></thead><tbody>`;
    returList.forEach((it, idx) => {
        html += `<tr><td>${idx+1}</td><td>${it.barcode}</td><td>${it.nama}</td><td>${it.supplier}</td><td>${it.qty}</td><td>${it.alasan}</td><td>${it.keterangan||''}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up diblokir. Izinkan pop-up untuk melakukan ekspor PDF.'); return; }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
}

function exportReturToWord() {
    if (returList.length === 0) { alert("Belum ada barang retur yang diinput."); return; }
    const supplier = (document.getElementById("returSupplier").value || returList[0]?.supplier || "").toUpperCase();
    const dateStr = new Date().toLocaleDateString('id-ID');
    let html = `<html><head><meta charset="utf-8"><title>Laporan Retur</title></head><body>`;
    html += `<h2>LAPORAN RETUR SUPPLIER - ${supplier}</h2><div>Tanggal: ${dateStr}</div><br/>`;
    html += `<table border="1" style="border-collapse:collapse;">`;
    html += `<tr><th>No</th><th>Barcode</th><th>Nama Barang</th><th>Supplier</th><th>Qty</th><th>Alasan</th><th>Keterangan</th></tr>`;
    returList.forEach((it, idx) => {
        html += `<tr><td>${idx+1}</td><td>${it.barcode}</td><td>${it.nama}</td><td>${it.supplier}</td><td>${it.qty}</td><td>${it.alasan}</td><td>${it.keterangan||''}</td></tr>`;
    });
    html += `</table></body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LAPORAN_RETUR_${supplier.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function getProductImage(barcode) {
    if (!barcode) return DEFAULT_IMAGE_PLACEHOLDER;
    // Return cached if available (as Promise)
    if (imageCache[barcode]) return Promise.resolve(imageCache[barcode]);

    // If a pending request exists, return it
    if (pendingImageRequests[barcode]) return pendingImageRequests[barcode];

    // Create fetch promise and store in pending map
    const fetchPromise = (async () => {
        try {
            // try Open Food Facts
            const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, { cache: 'force-cache' });
            if (response.ok) {
                const data = await response.json();
                if (data && data.status === 1 && data.product) {
                    const imgUrl = data.product.image_front_small_url || data.product.image_small_url || data.product.image_url;
                    if (imgUrl) {
                        imageCache[barcode] = imgUrl;
                        return imgUrl;
                    }
                }
            }
        } catch (e) {
            console.warn("Gagal mengambil gambar dari Open Food Facts:", e);
        }

        // fallback
        imageCache[barcode] = DEFAULT_IMAGE_PLACEHOLDER;
        return DEFAULT_IMAGE_PLACEHOLDER;
    })();

    pendingImageRequests[barcode] = fetchPromise;
    // when done, remove pending (handled by caller processImageQueue), but also ensure deletion here
    fetchPromise.finally(() => { if (pendingImageRequests[barcode] === fetchPromise) delete pendingImageRequests[barcode]; });
    return fetchPromise;
}
