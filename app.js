// Element Selection
const cameraBtn = document.getElementById("cameraBtn");
const barcodeInput = document.getElementById("barcodeInput");
const fetchDataButton = document.getElementById("fetchData");
const txtBarcode = document.getElementById("txtBarcode");
const txtNama = document.getElementById("txtNama");
const txtSupplier = document.getElementById("txtSupplier");
const txtKategori = document.getElementById("txtKategori");
const txtHarga = document.getElementById("txtHarga");
const popupBarcode = document.getElementById("popupBarcode");
const popupNama = document.getElementById("popupNama");
const popupSupplier = document.getElementById("popupSupplier");
const popupKategori = document.getElementById("popupKategori");
const popupHarga = document.getElementById("popupHarga");
const resultModal = document.getElementById("resultModal");
const scannerModal = document.getElementById("scannerModal");
const closeScanner = document.getElementById("closeScanner");
const closePopup = document.getElementById("closePopup");
const addProductModal = document.getElementById("addProductModal");
const closeAddModal = document.getElementById("closeAddModal");
const addProductForm = document.getElementById("addProductForm");
const newBarcode = document.getElementById("newBarcode");
const newName = document.getElementById("newName");
const newSupplier = document.getElementById("newSupplier");
const newStock = document.getElementById("newStock");
const newImage = document.getElementById("newImage");
const navCamera = document.getElementById("navCamera");
const navHome = document.getElementById("navHome");
const navAdd = document.getElementById("navAdd");
const videoElement = document.getElementById("video");
const scanStatus = document.getElementById("scanStatus");
const productImage = document.getElementById("productImage");
const popupImage = document.getElementById("popupImage");
const singleResult = document.getElementById("singleResult");
const multiResults = document.getElementById("multiResults");
const multiList = document.getElementById("multiList");

// Settings Elements
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const loginApiInput = document.getElementById("loginApiInput");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const currentUser = document.getElementById("currentUser");
const themeToggle = document.getElementById("themeToggle");
const roleSelect = document.getElementById("roleSelect");
const divisionSelect = document.getElementById("divisionSelect");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

// State
const products = [];
let stream = null;
let barcodeDetector = null;
let scanInterval = null;
let codeReader = null;
let detectLoopId = null;
let lastDetectTime = 0;
const detectThrottle = 150; // ms

// Event Listeners
if (fetchDataButton) fetchDataButton.addEventListener("click", handleSearch);
if (barcodeInput) {
    barcodeInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSearch();
        }
    });
}
if (cameraBtn) cameraBtn.addEventListener("click", openSettings);
if (closeScanner) closeScanner.addEventListener("click", closeScannerModal);
if (closePopup) {
    closePopup.addEventListener("click", () => {
        if (resultModal) resultModal.style.display = "none";
    });
}
if (closeAddModal) {
    closeAddModal.addEventListener("click", () => {
        if (addProductModal) addProductModal.style.display = "none";
    });
}
if (addProductForm) addProductForm.addEventListener("submit", handleAddProduct);
if (navCamera) navCamera.addEventListener("click", openScanner);
if (navHome) navHome.addEventListener("click", () => setActiveNav(navHome));
if (navAdd) {
    navAdd.addEventListener("click", () => {
        if (addProductModal) addProductModal.style.display = "flex";
        setActiveNav(navAdd);
    });
}
if (scannerModal) {
    scannerModal.addEventListener("click", (event) => {
        if (event.target === scannerModal) {
            closeScannerModal();
        }
    });
}

// Settings Modal Events
if (closeSettings) closeSettings.addEventListener("click", closeSettingsModal);
if (loginBtn) loginBtn.addEventListener("click", handleLogin);
if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
if (themeToggle) themeToggle.addEventListener("change", () => applyTheme(themeToggle.checked));
if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettings);

// Search Logic
async function handleSearch() {
    const code = barcodeInput ? barcodeInput.value.trim() : "";
    if (!code) {
        alert("Masukkan barcode atau kata kunci pencarian terlebih dahulu.");
        return;
    }
    
    // Check if input contains letters for fuzzy search
    const hasLetter = /[A-Za-z]/.test(code);
    if (hasLetter) {
        handleSearchFuzzy(code);
        return;
    }

    // Treat as barcode input
    handleSearchManual(code);
}

function handleSearchFuzzy(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        alert("Masukkan kata kunci pencarian.");
        return;
    }

    const matches = products.filter((p) => {
        const name = (p.nama || "").toString().toLowerCase();
        const kategori = (p.kategori || "").toString().toLowerCase();
        return name.includes(q) || kategori.includes(q);
    });

    if (matches.length === 0) {
        alert("Tidak ada produk yang cocok dengan pencarian.");
        return;
    }

    if (matches.length === 1) {
        showResult(matches[0]);
        return;
    }

    showMultipleResults(matches);
}

function handleSearchManual(code) {
    // If 6 digits, match by last 6 digits of barcode
    const sixDigitOnly = /^\d{6}$/.test(code);

    if (sixDigitOnly) {
        const matches = products.filter((x) => x.barcode && x.barcode.endsWith(code));
        if (matches.length === 0) {
            alert("Tidak ada produk yang memiliki 6 digit akhir tersebut.");
            return;
        }
        if (matches.length === 1) {
            showResult(matches[0]);
            return;
        }

        showMultipleResults(matches);
        return;
    }

    // Exact match
    const item = products.find((x) => x.barcode === code);
    if (!item) {
        alert("Barcode tidak ditemukan di data produk.");
        return;
    }

    showResult(item);
}

function mapProductItem(source) {
    return {
        barcode: source.barcode || source.kode || source.code || source.sku || source.id || "",
        nama: source.nama || source.name || source.product || source.title || source.description || "-",
        supplier: source.supplier || source.vendor || source.supplier_name || source.mitra || "-",
        kategori: source.kategori || source.category || source.cat || "-",
        harga: source.harga ?? source.price ?? source.cost ?? null,
        stok: source.stok ?? source.stock ?? source.qty ?? source.quantity ?? null,
        image: source.image || source.image_url || source.gambar || source.foto || source.photo || source.thumbnail || source.url || "",
    };
}

function showResult(item) {
    if (multiResults) multiResults.style.display = "none";
    if (singleResult) singleResult.style.display = "block";
    
    if (txtBarcode) txtBarcode.innerText = item.barcode || "-";
    if (txtNama) txtNama.innerText = item.nama || "-";
    if (txtSupplier) txtSupplier.innerText = item.supplier || "-";
    if (txtKategori) txtKategori.innerText = item.kategori || "-";
    if (txtHarga) txtHarga.innerText = item.harga !== undefined && item.harga !== null ? formatRupiah(item.harga) : "-";

    if (popupBarcode) popupBarcode.innerText = item.barcode || "-";
    if (popupNama) popupNama.innerText = item.nama || "-";
    if (popupSupplier) popupSupplier.innerText = item.supplier || "-";
    if (popupKategori) popupKategori.innerText = item.kategori || "-";
    if (popupHarga) popupHarga.innerText = item.harga !== undefined && item.harga !== null ? formatRupiah(item.harga) : "-";

    if (item.image) {
        if (productImage) {
            productImage.src = item.image;
            productImage.style.display = "block";
        }
        if (popupImage) {
            popupImage.src = item.image;
            popupImage.style.display = "block";
        }
    } else {
        if (productImage) productImage.style.display = "none";
        if (popupImage) popupImage.style.display = "none";
    }

    if (resultModal) resultModal.style.display = "flex";
}

function showMultipleResults(items) {
    if (!multiResults || !multiList) {
        showResult(items[0]);
        return;
    }

    if (singleResult) singleResult.style.display = "none";
    multiList.innerHTML = "";

    items.forEach((it) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "multi-item-btn";
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.style.margin = "6px 0";
        btn.textContent = `${it.nama} — ${it.barcode} — ${it.harga !== undefined && it.harga !== null ? formatRupiah(it.harga) : "-"}`;
        btn.addEventListener("click", () => {
            showResult(it);
        });
        multiList.appendChild(btn);
    });

    multiResults.style.display = "block";
    if (resultModal) resultModal.style.display = "flex";
}

function handleAddProduct(event) {
    event.preventDefault();
    const barcode = newBarcode ? newBarcode.value.trim() : "";
    const nama = newName ? newName.value.trim() : "";
    const supplier = newSupplier ? newSupplier.value.trim() : "";
    const stok = newStock ? Number(newStock.value.trim()) : 0;
    const image = newImage ? newImage.value.trim() : "";

    if (!barcode || !nama || !supplier || Number.isNaN(stok)) {
        alert("Semua field harus diisi dan stok harus berupa angka.");
        return;
    }

    products.push({ barcode, nama, supplier, stok, image: image || "", kategori: "-" });
    if (newBarcode) newBarcode.value = "";
    if (newName) newName.value = "";
    if (newSupplier) newSupplier.value = "";
    if (newStock) newStock.value = "";
    if (newImage) newImage.value = "";
    if (addProductModal) addProductModal.style.display = "none";
    alert("Produk baru berhasil ditambahkan.");
}

// Camera Scanner
async function openScanner() {
    if (scannerModal) scannerModal.style.display = "flex";
    await startCamera();
}

async function startCamera() {
    if (detectLoopId) {
        cancelAnimationFrame(detectLoopId);
        detectLoopId = null;
    }
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    if (codeReader) {
        try { codeReader.reset(); } catch (err) { console.warn(err); }
        codeReader = null;
    }
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
    }

    const hasNativeBarcode = typeof window.BarcodeDetector !== "undefined";
    const zxingGlobal = window.ZXing || window.ZXingBrowser || window.BrowserMultiFormatReader;
    const hasZXing = typeof zxingGlobal !== "undefined";

    if (hasNativeBarcode) {
        try {
            barcodeDetector = new BarcodeDetector({
                formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"]
            });
        } catch (error) {
            barcodeDetector = null;
        }
    }

    if (hasNativeBarcode && barcodeDetector) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Kamera tidak tersedia pada perangkat ini.");
            closeScannerModal();
            return;
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            });
            if (videoElement) {
                videoElement.srcObject = stream;
                videoElement.muted = true;
                await videoElement.play();
            }
            if (scanStatus) scanStatus.innerText = "Scanner BarcodeDetector aktif...";
            lastDetectTime = performance.now();
            const frameLoop = (ts) => {
                if (!barcodeDetector || !videoElement || !videoElement.srcObject) return;
                if (ts - lastDetectTime >= detectThrottle) {
                    detectBarcode().catch(console.error);
                    lastDetectTime = ts;
                }
                detectLoopId = requestAnimationFrame(frameLoop);
            };
            detectLoopId = requestAnimationFrame(frameLoop);
            return;
        } catch (error) {
            console.error("Gagal kamera native:", error);
        }
    }

    if (hasZXing) {
        if (scanStatus) scanStatus.innerText = "Scanner ZXing aktif...";
        const reader = window.ZXing?.BrowserMultiFormatReader || window.BrowserMultiFormatReader || window.ZXingBrowser?.BrowserMultiFormatReader;
        if (reader) {
            try {
                codeReader = new reader();
                await codeReader.decodeFromVideoDevice(null, videoElement, (result, err) => {
                    if (result) {
                        if (barcodeInput) barcodeInput.value = result.text;
                        handleSearch();
                        closeScannerModal();
                    }
                });
                return;
            } catch (error) {
                console.error("ZXing error:", error);
            }
        }
    }

    alert("Browser tidak mendukung scanner otomatis. Silakan gunakan opsi pencarian / input manual.");
}

async function detectBarcode() {
    if (!barcodeDetector || !videoElement || !videoElement.srcObject) return;

    try {
        const barcodes = await barcodeDetector.detect(videoElement);
        if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
                if (barcodeInput) barcodeInput.value = code;
                closeScannerModal();
                handleSearch();
            }
        }
    } catch (error) {
        console.warn("Detect barcode error:", error);
    }
}

function formatRupiah(value) {
    if (value === null || value === undefined || value === "") return "-";
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return "Rp " + num.toLocaleString("id-ID");
}

async function loadLocalProducts() {
    try {
        const remoteUrl = "https://raw.githubusercontent.com/Gerall09/produk.json/refs/heads/main/produk.json";
        let resp = null;
        try {
            resp = await fetch(remoteUrl, { cache: "no-store" });
            if (!resp.ok) resp = null;
        } catch (e) {
            resp = null;
        }

        if (!resp) {
            resp = await fetch("produk.json", { cache: "no-store" });
            if (!resp.ok) return;
        }

        const data = await resp.json();
        if (Array.isArray(data)) {
            products.length = 0;
            data.forEach((p) => products.push(mapProductItem(p)));
            console.log(`Loaded ${products.length} products`);
        }
    } catch (err) {
        console.warn("Gagal memuat data produk:", err);
    }
}

// Startup
loadLocalProducts();

// Settings Modal Helpers
function openSettings() {
    if (settingsModal) settingsModal.style.display = "flex";
    loadSettingsToUI();
}

function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = "none";
}

function loadSettingsToUI() {
    try {
        const cfg = JSON.parse(localStorage.getItem("appSettings") || "{}");
        if (loginApiInput && cfg.loginApi) loginApiInput.value = cfg.loginApi;
        if (roleSelect) roleSelect.value = cfg.role || "returan";
        if (divisionSelect) divisionSelect.value = cfg.division || "receiving_good";
        if (themeToggle) themeToggle.checked = cfg.theme === "dark";
        applyTheme(!!(themeToggle && themeToggle.checked));

        const auth = JSON.parse(localStorage.getItem("appAuth") || "null");
        if (auth && auth.username) {
            if (currentUser) currentUser.innerText = `Login: ${auth.username}`;
            if (loginBtn) loginBtn.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "inline-block";
        } else {
            if (currentUser) currentUser.innerText = "Belum login";
            if (loginBtn) loginBtn.style.display = "inline-block";
            if (logoutBtn) logoutBtn.style.display = "none";
        }
    } catch (e) {
        console.warn("loadSettingsToUI error:", e);
    }
}

async function handleLogin() {
    const url = (loginApiInput?.value || "").trim();
    const user = (loginUsername?.value || "").trim();
    const pass = (loginPassword?.value || "").trim();
    if (!url || !user || !pass) {
        alert("Isi login URL, username, dan password.");
        return;
    }

    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass }),
        });

        if (!resp.ok) {
            const txt = await resp.text();
            alert(`Login gagal: ${resp.status} ${txt}`);
            return;
        }

        const data = await resp.json();
        const auth = { username: user, data };
        localStorage.setItem("appAuth", JSON.stringify(auth));
        if (currentUser) currentUser.innerText = `Login: ${user}`;
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        alert("Login berhasil.");
    } catch (err) {
        console.error("Login error:", err);
        alert("Terjadi kesalahan saat login.");
    }
}

function handleLogout() {
    localStorage.removeItem("appAuth");
    if (currentUser) currentUser.innerText = "Belum login";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
}

function applyTheme(dark) {
    if (dark) document.body.classList.add("dark");
    else document.body.classList.remove("dark");
    const cfg = JSON.parse(localStorage.getItem("appSettings") || "{}");
    cfg.theme = dark ? "dark" : "light";
    localStorage.setItem("appSettings", JSON.stringify(cfg));
}

function saveSettings() {
    const cfg = JSON.parse(localStorage.getItem("appSettings") || "{}");
    cfg.loginApi = loginApiInput?.value || cfg.loginApi;
    cfg.role = roleSelect?.value || cfg.role || "returan";
    cfg.division = divisionSelect?.value || cfg.division || "receiving_good";
    cfg.theme = themeToggle && themeToggle.checked ? "dark" : "light";
    localStorage.setItem("appSettings", JSON.stringify(cfg));
    alert("Pengaturan tersimpan.");
    closeSettingsModal();
}

loadSettingsToUI();

function setActiveNav(activeButton) {
    [navCamera, navHome, navAdd].forEach((btn) => {
        if (btn) btn.classList.toggle("active", btn === activeButton);
    });
}

function closeScannerModal() {
    if (detectLoopId) {
        cancelAnimationFrame(detectLoopId);
        detectLoopId = null;
    }
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
    }
    if (videoElement) videoElement.srcObject = null;
    if (scannerModal) scannerModal.style.display = "none";
}
