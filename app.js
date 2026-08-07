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

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    loadDataFromStorage();
    setupTabNavigation();
    setupFormEvents();
    setupScannerEvents();
    setupModals();
    renderAllViews();
});

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
                    // Merge local user-added products with remote products
                    const remoteBarcodeSet = new Set(remoteProducts.map(p => p.barcode));
                    const localOnly = masterProducts.filter(p => !remoteBarcodeSet.has(p.barcode));
                    masterProducts = [...remoteProducts, ...localOnly];

                    saveMasterProducts();
                    renderAllViews();
                    if (syncBadge) syncBadge.innerText = `🟢 Sync: ${remoteProducts.length} Produk`;
                    console.log(`Berhasil memuat ${remoteProducts.length} produk dari GitHub.`);
                }
            }
        }
    } catch (e) {
        console.warn("Gagal sinkronisasi data produk dari GitHub:", e);
        if (syncBadge) syncBadge.innerText = "🔴 Offline";
    }
}

function saveMasterProducts() {
    localStorage.setItem("gacor_master_products", JSON.stringify(masterProducts));
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
    // Qty +/-
    document.getElementById("btnQtyMinus").addEventListener("click", () => {
        const input = document.getElementById("returQty");
        if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
    });

    document.getElementById("btnQtyPlus").addEventListener("click", () => {
        const input = document.getElementById("returQty");
        input.value = parseInt(input.value) + 1;
    });

    // Barcode input auto-fill on input, change, and keyup
    const barcodeInput = document.getElementById("returBarcode");
    barcodeInput.addEventListener("input", (e) => handleBarcodeAutoFill(e.target.value));
    barcodeInput.addEventListener("change", (e) => handleBarcodeAutoFill(e.target.value));
    barcodeInput.addEventListener("keyup", (e) => handleBarcodeAutoFill(e.target.value));

    // Supplier input chips
    document.getElementById("returSupplier").addEventListener("input", renderSupplierChips);

    // Photo Upload Preview
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

    // Submit Retur
    document.getElementById("formRetur").addEventListener("submit", (e) => {
        e.preventDefault();
        const supplier = document.getElementById("returSupplier").value.trim();
        const barcode = document.getElementById("returBarcode").value.trim();
        const nama = document.getElementById("returNama").value.trim();
        const qty = parseInt(document.getElementById("returQty").value) || 1;
        const alasan = document.getElementById("returAlasan").value;
        const keterangan = document.getElementById("returKeterangan").value.trim();

        // Check if item with same barcode and reason already exists in returList
        const existingIndex = returList.findIndex(item => item.barcode === barcode && item.alasan === alasan);

        if (existingIndex !== -1) {
            // Accumulate quantity for double input
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

        // Reset Form
        document.getElementById("returBarcode").value = "";
        document.getElementById("returNama").value = "";
        document.getElementById("returQty").value = "1";
        document.getElementById("returKeterangan").value = "";
        document.getElementById("btnRemoveFoto").click();
    });

    // Clear All Retur with browser confirm dialog
    document.getElementById("btnClearAllRetur").addEventListener("click", () => {
        if (returList.length === 0) {
            alert("Daftar laporan retur sudah kosong.");
            return;
        }
        const confirmDelete = confirm("Apakah Anda yakin ingin menghapus SEMUA laporan retur? Data yang dihapus tidak dapat dikembalikan.");
        if (confirmDelete) {
            returList = [];
            saveReturList();
            renderReturList();
            alert("Seluruh laporan retur telah dibersihkan.");
        }
    });

    // Export Excel
    document.getElementById("btnExportExcel").addEventListener("click", exportReturToExcel);

    // Search Master Live Filter
    document.getElementById("searchMasterQuery").addEventListener("input", renderSearchResults);

    // Add Master Submit
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
}

// Render Supplier Suggestion Chips
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

// Supplier Datalist
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

// Camera Scanner Setup
function setupScannerEvents() {
    document.getElementById("btnStartScan").addEventListener("click", () => startScanner("returBarcode"));
    document.getElementById("btnScanSearch").addEventListener("click", () => startScanner("searchMasterQuery"));
    document.getElementById("btnCloseScanner").addEventListener("click", stopScanner);
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
        (errorMessage) => {
            // Scanning...
        }
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

// Modals Handling
function setupModals() {
    // 3-Dots Modal
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
                item.style.cursor = "pointer";
                item.innerHTML = `
                    <div>
                        <div style="font-weight:700; font-size:13px; color:#fff;">${p.nama}</div>
                        <div style="font-size:11px; color:#9ca3af;">Barcode: ${p.barcode} • ${p.supplier}</div>
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

    // Add Master Modal
    document.getElementById("btnOpenAddMasterModal").addEventListener("click", () => {
        document.getElementById("modalAddMaster").classList.remove("hidden");
    });
    document.getElementById("btnCloseMasterModal").addEventListener("click", () => {
        document.getElementById("modalAddMaster").classList.add("hidden");
    });
}

// Render All Views
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

// Render Retur List
function renderReturList() {
    const container = document.getElementById("returListContainer");
    container.innerHTML = "";

    if (returList.length === 0) {
        container.innerHTML = `<div class="empty-state">Belum ada laporan retur tertunda.</div>`;
        return;
    }

    returList.forEach((item, index) => {
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

// Render Search Master Results
function renderSearchResults() {
    const query = document.getElementById("searchMasterQuery").value.toLowerCase().trim();
    const container = document.getElementById("searchResultsList");
    container.innerHTML = "";

    const filtered = query 
        ? masterProducts.filter(p => p.barcode.includes(query) || p.nama.toLowerCase().includes(query) || (query.length === 6 && p.barcode.endsWith(query)))
        : masterProducts.slice(0, 10);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">Tidak ada produk ditemukan.</div>`;
        return;
    }

    filtered.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-item-card";
        card.innerHTML = `
            <div>
                <div style="font-weight:700; font-size:14px; color:#fff;">${p.nama}</div>
                <div style="font-size:12px; color:#9ca3af;">
                    Barcode: <strong style="color:#fbbf24">${p.barcode}</strong> | Kat: ${p.kategori} | Sup: ${p.supplier}
                </div>
            </div>
            <button class="btn btn-gold btn-sm" onclick="quickReturFromSearch('${p.barcode}')">
                <i class="fa-solid fa-plus"></i> Retur
            </button>
        `;
        container.appendChild(card);
    });
}

function quickReturFromSearch(barcode) {
    const product = masterProducts.find(p => p.barcode === barcode);
    if (!product) return;

    document.getElementById("returSupplier").value = product.supplier;
    document.getElementById("returBarcode").value = product.barcode;
    document.getElementById("returNama").value = product.nama;

    // Switch to retur tab
    document.querySelector('.nav-tab[data-tab="tab-retur"]').click();
}

// Render Master Table
function renderMasterTable() {
    const tbody = document.getElementById("masterTableBody");
    tbody.innerHTML = "";

    masterProducts.forEach((p, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>${p.barcode}</code></td>
            <td><strong>${p.nama}</strong></td>
            <td>${p.kategori}</td>
            <td>${p.supplier}</td>
            <td>Rp ${p.harga.toLocaleString('id-ID')}</td>
            <td>
                <button class="btn btn-outline-danger btn-sm" onclick="deleteMasterProduct(${idx})"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteMasterProduct(index) {
    if (confirm("Hapus produk ini dari Master?")) {
        masterProducts.splice(index, 1);
        saveMasterProducts();
        renderMasterTable();
    }
}

// --- FUNGSI EXPORT EXCEL SESUAI TEMPLATE ---
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
            // Buat Workbook & Worksheet baru dengan ExcelJS
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Laporan Returan");

            // Tampilkan garis sel (gridlines)
            worksheet.views = [{ showGridLines: true }];

            // --- ROW 1 ---
            worksheet.getCell("A1").value = "SATUSAMA";
            worksheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF008000" } };

            worksheet.getCell("C1").value = "LAPORAN RETURAN UNTUK SUPPLIER";
            worksheet.getCell("C1").font = { name: "Calibri", size: 12, bold: true };

            worksheet.getCell("D1").value = "S001 Landak";
            worksheet.getCell("D1").font = { name: "Calibri", size: 11, bold: true };

            // --- ROW 2 ---
            worksheet.getCell("C2").value = supplierName;
            worksheet.getCell("C2").font = { name: "Calibri", size: 12, bold: true };

            worksheet.getCell("D2").value = `TGL ${formattedDate}`;
            worksheet.getCell("D2").font = { name: "Calibri", size: 11, bold: true };

            // --- ROW 4 (HEADER TABEL) ---
            const headers = ["NO", "BARCODE", "NAMA", "QTY", "KET"];
            const headerRow = worksheet.getRow(4);

            headers.forEach((headerText, index) => {
                const cell = headerRow.getCell(index + 1);
                cell.value = headerText;
                cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF90EE90" } // Warna Hijau Terang
                };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = {
                    top: { style: "thin", color: { argb: "FF000000" } },
                    left: { style: "thin", color: { argb: "FF000000" } },
                    bottom: { style: "thin", color: { argb: "FF000000" } },
                    right: { style: "thin", color: { argb: "FF000000" } }
                };
            });

            // --- ROW 5+ (DATA BARANG RETUR) ---
            returList.forEach((item, idx) => {
                const rowIndex = 5 + idx;
                const row = worksheet.getRow(rowIndex);
                const isEven = (idx + 1) % 2 === 0;
                
                // Background hijau memudar (soft green) untuk no genap, putih untuk ganjil
                const rowBgColor = isEven ? "FFE8F5E9" : "FFFFFFFF";

                const rowData = [
                    idx + 1,
                    String(item.barcode),
                    item.nama,
                    item.qty,
                    item.keterangan || item.alasan || "-"
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

                    // Posisi Teks
                    if (colIdx === 0) cell.alignment = { horizontal: "center", vertical: "middle" };
                    else if (colIdx === 1) cell.alignment = { horizontal: "center", vertical: "middle" };
                    else if (colIdx === 2) cell.alignment = { horizontal: "left", vertical: "middle" };
                    else if (colIdx === 3) cell.alignment = { horizontal: "center", vertical: "middle" };
                    else if (colIdx === 4) cell.alignment = { horizontal: "left", vertical: "middle" };
                });
            });

            // --- FOOTER ---
            const footerRowIndex = 5 + returList.length + 1;
            
            const pelaporCell = worksheet.getCell(`B${footerRowIndex}`);
            pelaporCell.value = "ADMIN RETUR";
            pelaporCell.font = { name: "Calibri", size: 11, bold: true };

            const landakCell = worksheet.getCell(`B${footerRowIndex + 2}`);
            landakCell.value = "FROM LANDAK";
            landakCell.font = { name: "Calibri", size: 11, bold: true };

            // Lebar Kolom
            worksheet.getColumn(1).width = 8;   // NO
            worksheet.getColumn(2).width = 20;  // BARCODE
            worksheet.getColumn(3).width = 42;  // NAMA
            worksheet.getColumn(4).width = 12;  // QTY
            worksheet.getColumn(5).width = 25;  // KET

            // Proses Download File Excel
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

    // Fallback: SheetJS Export
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

    excelData.push([]);
    excelData.push(["", "", "", "TOTAL QTY RETUR:", taotalQty]);
    excelData.push([]);
    excelData.push(["Tanda Tangan Driver Supplier:", "", "", "", "Tanda Tangan Receiver Gudang:"]);
    excelData.push([]);
    excelData.push([]);
    excelData.push(["( ________________________ )", "", "", "", `( ${firstSupplier} / Staff Receiver )`]);

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Retur");

    const filename = `LAPORAN_RETUR_${firstSupplier.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
}
