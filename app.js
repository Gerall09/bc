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
const modeSelect = document.getElementById("modeSelect");
// API input removed from main UI; API will be used only for login via Settings
const productImage = document.getElementById("productImage");
const popupImage = document.getElementById("popupImage");
const products = [];
const singleResult = document.getElementById("singleResult");
const multiResults = document.getElementById("multiResults");
const multiList = document.getElementById("multiList");

// Settings elements
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
const appVersion = document.getElementById("appVersion");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

let stream = null;
let barcodeDetector = null;
let scanInterval = null;
let codeReader = null;
let detectLoopId = null;
let lastDetectTime = 0;
const detectThrottle = 150; // ms between detection calls

fetchDataButton.addEventListener("click", handleSearch);
barcodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        handleSearch();
    }
});
cameraBtn.addEventListener("click", openSettings);
closeScanner.addEventListener("click", closeScannerModal);
closePopup.addEventListener("click", () => {
    resultModal.style.display = "none";
});
closeAddModal.addEventListener("click", () => {
    addProductModal.style.display = "none";
});
addProductForm.addEventListener("submit", handleAddProduct);
navCamera.addEventListener("click", openScanner);
navHome.addEventListener("click", () => setActiveNav(navHome));
navAdd.addEventListener("click", () => {
    addProductModal.style.display = "flex";
    setActiveNav(navAdd);
});
scannerModal.addEventListener("click", (event) => {
    if (event.target === scannerModal) {
        closeScannerModal();
    }
});

// Settings modal events
if (closeSettings) closeSettings.addEventListener("click", closeSettingsModal);
if (loginBtn) loginBtn.addEventListener("click", handleLogin);
if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
if (themeToggle) themeToggle.addEventListener("change", () => applyTheme(themeToggle.checked));
if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettings);

async function handleSearch() {
    const code = barcodeInput.value.trim();
    if (!code) {
        alert("Masukkan barcode atau kata kunci pencarian terlebih dahulu.");
        return;
    }
    // Manual mode: decide search type
    // If input contains letters, perform fuzzy search on nama/kategori
    const hasLetter = /[A-Za-z]/.test(code);
    if (hasLetter) {
        handleSearchFuzzy(code);
        return;
    }

    // Otherwise treat as barcode input (either 6-digit suffix or full barcode)
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
    // If user types exactly 6 digits, match by last 6 digits of barcode
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
        return;
    }

    // Fallback: exact match on full barcode
    const item = products.find((x) => x.barcode === code);
    if (!item) {
        alert("Barcode tidak ditemukan di data manual.");
        return;
    }

    showResult(item);
}

// API lookup removed from main search. API usage is available only for login via Settings modal.

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
    // ensure single-view is visible
    if (multiResults) multiResults.style.display = "none";
    if (singleResult) singleResult.style.display = "block";
    txtBarcode.innerText = item.barcode || "-";
    txtNama.innerText = item.nama || "-";
    txtSupplier.innerText = item.supplier || "-";
    txtKategori.innerText = item.kategori || "-";
    txtHarga.innerText = item.harga !== undefined && item.harga !== null ? formatRupiah(item.harga) : "-";

    popupBarcode.innerText = item.barcode || "-";
    popupNama.innerText = item.nama || "-";
    popupSupplier.innerText = item.supplier || "-";
    popupKategori.innerText = item.kategori || "-";
    popupHarga.innerText = item.harga !== undefined && item.harga !== null ? formatRupiah(item.harga) : "-";

    // Show product image if available
    if (item.image) {
        try {
            productImage.src = item.image;
            productImage.style.display = "block";
        } catch (e) {
            productImage.style.display = "none";
        }

        try {
            popupImage.src = item.image;
            popupImage.style.display = "block";
        } catch (e) {
            popupImage.style.display = "none";
        }
    } else {
        if (productImage) productImage.style.display = "none";
        if (popupImage) popupImage.style.display = "none";
    }

    resultModal.style.display = "flex";
}

function showMultipleResults(items) {
    if (!multiResults || !multiList) {
        // fallback: show first
        showResult(items[0]);
        return;
    }

    // hide single result
    if (singleResult) singleResult.style.display = "none";
    multiList.innerHTML = "";

    items.forEach((it, idx) => {
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
    resultModal.style.display = "flex";
}

function handleAddProduct(event) {
    event.preventDefault();
    const barcode = newBarcode.value.trim();
    const nama = newName.value.trim();
    const supplier = newSupplier.value.trim();
    const stok = Number(newStock.value.trim());
    const image = newImage.value.trim();

    if (!barcode || !nama || !supplier || Number.isNaN(stok)) {
        alert("Semua field harus diisi dan stok harus berupa angka.");
        return;
    }

    products.push({ barcode, nama, supplier, stok, image: image || "" });
    newBarcode.value = "";
    newName.value = "";
    newSupplier.value = "";
    newStock.value = "";
    newImage.value = "";
    addProductModal.style.display = "none";
    alert("Produk baru berhasil ditambahkan.");
}

async function openScanner() {
    if (scannerModal) scannerModal.style.display = "flex";
    await startCamera();
}

async function startCamera() {
    // Stop previous scanner session if any
    if (detectLoopId) {
        cancelAnimationFrame(detectLoopId);
        detectLoopId = null;
    }
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    if (codeReader) {
        try {
            codeReader.reset();
        } catch (err) {
            console.warn("Gagal reset codeReader:", err);
        }
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
                formats: [
                    "code_128",
                    "code_39",
                    "ean_13",
                    "ean_8",
                    "qr_code",
                    "upc_a",
                    "upc_e",
                    "pdf417",
                ],
            });
        } catch (error) {
            barcodeDetector = null;
            console.warn("BarcodeDetector tidak dapat dibuat:", error);
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
            videoElement.srcObject = stream;
            videoElement.muted = true;
            await videoElement.play();
            scanStatus.innerText = "Scanner BarcodeDetector aktif...";
            lastDetectTime = performance.now();
            const frameLoop = (ts) => {
                if (!barcodeDetector || !videoElement.srcObject) return;
                if (ts - lastDetectTime >= detectThrottle) {
                    detectBarcode().catch(console.error);
                    lastDetectTime = ts;
                }
                detectLoopId = requestAnimationFrame(frameLoop);
            };
            detectLoopId = requestAnimationFrame(frameLoop);
            return;
        } catch (error) {
            console.error("Gagal memulai kamera native:", error);
            // fall through to ZXing if available
        }
    }

    if (hasZXing) {
        scanStatus.innerText = "Scanner ZXing aktif...";
        const reader = window.ZXing?.BrowserMultiFormatReader || window.BrowserMultiFormatReader || window.ZXingBrowser?.BrowserMultiFormatReader;
        if (!reader) {
            console.warn("ZXing global ditemukan tetapi reader tidak tersedia.");
        } else {
            try {
                codeReader = new reader();
                await codeReader.decodeFromVideoDevice(null, videoElement, (result, err) => {
                    if (result) {
                        barcodeInput.value = result.text;
                        handleSearch();
                        closeScannerModal();
                    }
                    if (err && !(err instanceof ZXing.NotFoundException)) {
                        console.warn("ZXing scan error:", err);
                    }
                });
                return;
            } catch (error) {
                console.error("ZXing gagal memulai kamera:", error);
            }
        }
    }

    alert("Browser Anda tidak mendukung scan barcode otomatis atau pemindaian gagal. Gunakan input manual.");
    closeScannerModal();
}

async function detectBarcode() {
    if (!barcodeDetector || !videoElement.srcObject) {
        return;
    }

    try {
        const barcodes = await barcodeDetector.detect(videoElement);
        if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
                barcodeInput.value = code;
                closeScannerModal();
                handleSearch();
            }
        }
    } catch (error) {
        console.warn("Gagal mendeteksi barcode:", error);
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
        // Try loading from a remote raw GitHub URL first (provided by user), then fallback to local produk.json
        const remoteUrl = "https://raw.githubusercontent.com/Gerall09/produk.json/refs/heads/main/produk.json";
        let resp = null;
        try {
            resp = await fetch(remoteUrl, { cache: "no-store" });
            if (!resp.ok) {
                console.warn("Remote produk.json tidak tersedia (status ", resp.status, "). Mencoba sumber lokal...");
                resp = null;
            } else {
                console.log("Memuat produk dari remote:", remoteUrl);
            }
        } catch (e) {
            console.warn("Gagal memuat remote produk.json:", e, "— mencoba sumber lokal...");
            resp = null;
        }

        if (!resp) {
            resp = await fetch("produk.json", { cache: "no-store" });
            if (!resp.ok) {
                console.warn("produk.json tidak ditemukan di server lokal (status ", resp.status, ")");
                return;
            }
        }

        const data = await resp.json();
        if (Array.isArray(data)) {
            products.length = 0; // kosongkan contoh produk
            data.forEach((p) => products.push(mapProductItem(p)));
            console.log(`Loaded ${products.length} products from produk.json`);
        }
    } catch (err) {
        console.warn("Gagal memuat produk.json:", err);
    }
}

// Try to load local produk.json on startup
loadLocalProducts();

// Settings helpers
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
        // default role is returan if not present
        if (roleSelect) roleSelect.value = cfg.role || "returan";
        if (divisionSelect) divisionSelect.value = cfg.division || "receiving_good";
        if (themeToggle) themeToggle.checked = cfg.theme === "dark";
        applyTheme(!!(themeToggle && themeToggle.checked));

        const auth = JSON.parse(localStorage.getItem("appAuth") || "null");
        if (auth && auth.username) {
            currentUser.innerText = `Login: ${auth.username}`;
            loginBtn.style.display = "none";
            logoutBtn.style.display = "inline-block";
        } else {
            currentUser.innerText = "Belum login";
            loginBtn.style.display = "inline-block";
            logoutBtn.style.display = "none";
        }
    } catch (e) {
        console.warn("loadSettingsToUI:", e);
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
        // store token or returned user object if available
        const auth = { username: user, data };
        localStorage.setItem("appAuth", JSON.stringify(auth));
        currentUser.innerText = `Login: ${user}`;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        alert("Login berhasil (jika API mengembalikan 200).");
    } catch (err) {
        console.error("Login error:", err);
        alert("Terjadi kesalahan saat login.");
    }
}

function handleLogout() {
    localStorage.removeItem("appAuth");
    currentUser.innerText = "Belum login";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
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

// initialize settings UI
loadSettingsToUI();

function handleAddProduct(event) {
    event.preventDefault();
    const barcode = newBarcode.value.trim();
    const nama = newName.value.trim();
    const supplier = newSupplier.value.trim();

    if (!barcode || !nama || !supplier) {
        alert("Semua field harus diisi.");
        return;
    }

    products.push({ barcode, nama, supplier });
    newBarcode.value = "";
    newName.value = "";
    newSupplier.value = "";
    addProductModal.style.display = "none";
    alert("Produk baru berhasil ditambahkan.");
}

function setActiveNav(activeButton) {
    [navCamera, navHome, navAdd].forEach((btn) => {
        btn.classList.toggle("active", btn === activeButton);
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
    videoElement.srcObject = null;
    scannerModal.style.display = "none";
}
