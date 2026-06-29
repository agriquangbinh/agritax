/**
 * Bulk Export to Excel with QR Codes
 * Tạo file Excel danh sách thanh toán kèm mã QR
 */

import { generateBulkQRCodes } from "./vietqr-utils.js";

/**
 * Export danh sách lọc ra Excel kèm mã QR hàng loạt
 * @param {array} filteredData - Danh sách dữ liệu đã lọc
 * @param {string} bankBin - Mã BIN ngân hàng
 * @param {string} bankAccount - Số tài khoản
 * @param {function} onProgress - Callback cho progress
 */
export async function exportToExcelWithQR(filteredData, bankBin, bankAccount, onProgress) {
    if (!filteredData || filteredData.length === 0) {
        throw new Error("Không có dữ liệu để xuất");
    }

    // Kiểm tra ExcelJS library
    if (typeof ExcelJS === "undefined") {
        throw new Error("ExcelJS library not loaded. Please add: <script src='https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js'></script>");
    }

    try {
        // Bước 1: Tạo QR codes hàng loạt
        onProgress?.("Đang tạo mã QR...", 0);
        const qrResults = await generateBulkQRCodes(
            filteredData,
            bankBin,
            bankAccount,
            (current, total) => {
                const percent = Math.round((current / total) * 50); // 50% cho QR generation
                onProgress?.(`Đang tạo mã QR (${current}/${total})...`, percent);
            }
        );

        // Bước 2: Tạo Workbook Excel
        onProgress?.("Đang tạo file Excel...", 50);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Danh sách QR");

        // Setup columns
        worksheet.columns = [
            { header: "STT", key: "stt", width: 5 },
            { header: "Mã số thuế", key: "maSoThue", width: 15 },
            { header: "Họ và Tên", key: "hoTen", width: 20 },
            { header: "CCCD", key: "cccd", width: 15 },
            { header: "Phường/Xã", key: "phuongXa", width: 15 },
            { header: "Thôn/Tổ", key: "thonTo", width: 12 },
            { header: "Mã phi NN", key: "maPhiNN", width: 12 },
            { header: "Tiểu mục", key: "tieuMuc", width: 12 },
            { header: "Số tiền (đ)", key: "soTien", width: 15 },
            { header: "Mã QR", key: "qr", width: 30 },
            { header: "Nội dung", key: "noiDung", width: 25 }
        ];

        // Setup header style
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
        headerRow.alignment = { horizontal: "center", vertical: "center", wrapText: true };

        // Bước 3: Thêm dữ liệu và hình ảnh QR
        for (let i = 0; i < qrResults.length; i++) {
            const result = qrResults[i];
            const item = result.item;
            const rowNum = i + 2; // Row 1 là header

            // Thêm dữ liệu dòng
            const row = worksheet.addRow({
                stt: i + 1,
                maSoThue: item.MaSoThue || "",
                hoTen: (item.Ho || "") + " " + (item.Ten || ""),
                cccd: item.CCCD || "",
                phuongXa: item.PhuongXa || "",
                thonTo: item.ThonTo || "",
                maPhiNN: item.MaPhiNN || "",
                tieuMuc: item.TieuMuc || "",
                soTien: item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString("vi-VN") : "0",
                noiDung: result.description || ""
            });

            // Format số tiền (right align)
            row.getCell("soTien").alignment = { horizontal: "right", vertical: "center" };
            row.height = 120; // Tăng chiều cao để chứa QR

            // Thêm hình ảnh QR nếu có
            if (result.qrUrl) {
                try {
                    // Kiểm tra xem là URL hay base64
                    let imageData;
                    if (result.qrUrl.startsWith("http")) {
                        // Nếu là URL, cần fetch về base64
                        const response = await fetch(result.qrUrl);
                        const blob = await response.blob();
                        const reader = new FileReader();
                        imageData = await new Promise((resolve) => {
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    } else {
                        imageData = result.qrUrl; // Đã là base64
                    }

                    // Thêm image vào workbook
                    const imageId = workbook.addImage({
                        base64: imageData.split(",")[1] || imageData,
                        extension: "png"
                    });

                    // Insert image vào cell
                    worksheet.addImage(imageId, {
                        tl: { col: 9, row: i + 1 }, // Column J
                        ext: { width: 100, height: 100 }
                    });
                } catch (imgError) {
                    console.warn(`Không thể thêm QR image cho row ${rowNum}:`, imgError);
                    row.getCell("qr").value = "Lỗi tải QR";
                }
            } else if (result.error) {
                row.getCell("qr").value = `Lỗi: ${result.error}`;
                row.getCell("qr").font = { color: { argb: "FFEF4444" } };
            }

            onProgress?.(`Đang xử lý dữ liệu (${i + 1}/${qrResults.length})...`, 50 + Math.round((i / qrResults.length) * 50));
        }

        // Setup worksheet properties
        worksheet.pageSetup = {
            paperSize: worksheet.PAPERSIZE.A4,
            orientation: "landscape",
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 }
        };

        // Bước 4: Xuất file
        onProgress?.("Đang lưu file...", 95);
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `QR_DanhSach_${timestamp}.xlsx`;

        await workbook.xlsx.writeFile(filename);

        onProgress?.("Hoàn thành!", 100);
        return filename;
    } catch (error) {
        console.error("Lỗi export Excel:", error);
        throw error;
    }
}

/**
 * Tính tổng tiền của danh sách
 */
export function calculateTotal(items) {
    return items.reduce((sum, item) => sum + (Number(item.SoTienThuThue) || 0), 0);
}
