/**
 * VietQR Utility - Tạo mã QR thanh toán theo chuẩn VietQR
 * Sử dụng API VietQR của ngân hàng
 */

const VIETQR_API = "https://api.vietqr.io/api/generate";

/**
 * Tạo mã QR sử dụng API VietQR
 * @param {string} bankBin - Mã BIN ngân hàng (ví dụ: 970405 cho Agribank)
 * @param {string} bankAccount - Số tài khoản ngân hàng
 * @param {number} amount - Số tiền (VND)
 * @param {string} description - Nội dung chuyển khoản
 * @returns {Promise<string>} URL của hình ảnh QR
 */
export async function generateVietQRCode(bankBin, bankAccount, amount, description) {
    try {
        const payload = {
            bankBin: bankBin,
            accountNo: bankAccount,
            amount: Math.round(amount),
            addInfo: description || "Nop tien thue",
            accountName: "AGRIBANK"
        };

        const response = await fetch(VIETQR_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.code === "00" && data.data) {
            return data.data; // Trả về URL hoặc base64 của QR
        } else {
            throw new Error(data.message || "Lỗi tạo mã QR");
        }
    } catch (error) {
        console.error("Lỗi VietQR:", error);
        throw error;
    }
}

/**
 * Tạo QR từ dữ liệu text trực tiếp (fallback nếu API không hoạt động)
 * @param {string} text - Text cần mã hóa QR
 * @returns {string} Data URL của QR (PNG base64)
 */
export function generateQRLocal(text) {
    return new Promise((resolve, reject) => {
        try {
            // Kiểm tra xem QRCode.js có được load không
            if (typeof QRCode === "undefined") {
                reject(new Error("QRCode library not loaded"));
                return;
            }

            const container = document.createElement("div");
            const qr = new QRCode(container, {
                text: text,
                width: 200,
                height: 200,
                correctLevel: QRCode.CorrectLevel.H
            });

            // Chờ QR được render
            setTimeout(() => {
                const canvas = container.querySelector("canvas");
                if (canvas) {
                    const dataUrl = canvas.toDataURL("image/png");
                    resolve(dataUrl);
                } else {
                    reject(new Error("Failed to generate QR code"));
                }
            }, 100);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Format nội dung thanh toán
 * @param {object} item - Dữ liệu người nộp thuế
 * @returns {string} Nội dung chuyển khoản
 */
export function formatPaymentDescription(item) {
    const maSoThue = (item.MaSoThue || "").substring(0, 10);
    const hoTen = (item.Ho || "") + " " + (item.Ten || "");
    const maPhiNN = (item.MaPhiNN || "").substring(0, 10);
    
    // Giới hạn độ dài nội dung (thường 34 ký tự)
    const description = `${maSoThue} ${maPhiNN} ${hoTen}`.substring(0, 34);
    return description;
}

/**
 * Batch generate QR codes
 * @param {array} items - Danh sách dữ liệu
 * @param {string} bankBin - Mã BIN ngân hàng
 * @param {string} bankAccount - Số tài khoản
 * @param {function} onProgress - Callback cho progress (index, total)
 * @returns {Promise<array>} Mảy chứa {item, qrUrl, description}
 */
export async function generateBulkQRCodes(items, bankBin, bankAccount, onProgress) {
    const results = [];
    const delayBetweenRequests = 500; // Delay 500ms giữa các request để tránh rate limit

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        try {
            const description = formatPaymentDescription(item);
            const amount = Number(item.SoTienThuThue) || 0;

            // Thử dùng API VietQR trước
            let qrUrl;
            try {
                qrUrl = await generateVietQRCode(bankBin, bankAccount, amount, description);
            } catch (apiError) {
                console.warn("VietQR API failed, using local QR generation:", apiError);
                // Fallback: tạo QR local
                const qrData = `00020126360014COM.VIETQR0111${bankAccount}${bankBin}5802VN5913AGRIBANK6009QUANG BINH62370015A000000067701240014AGRIBANK QR63040000`;
                qrUrl = await generateQRLocal(qrData);
            }

            results.push({
                item: item,
                qrUrl: qrUrl,
                description: description,
                amount: amount
            });

            if (onProgress) {
                onProgress(i + 1, items.length);
            }

            // Delay trước request tiếp theo
            if (i < items.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            }
        } catch (error) {
            console.error(`Lỗi tạo QR cho item ${i}:`, error);
            results.push({
                item: item,
                qrUrl: null,
                error: error.message,
                description: formatPaymentDescription(item)
            });
        }
    }

    return results;
}
