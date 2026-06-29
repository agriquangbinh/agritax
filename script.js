
import { executeGenerateQr, executeVerifyAndPayChange } from "./app.js";
const BANK_BIN = "970405"; // Mã định danh BIN của Agribank
const BANK_ACCOUNT = "3800207000643"; // STK NHAN TIEN THU THUE
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5siKR793QjNv_Vd_PgqJftAbritN54CU",
  authDomain: "https://agriquangbinh.github.io/agritax/",
  databaseURL: "https://agritax-fd278-default-rtdb.firebaseio.com/",
  projectId: "agritax-fd278",
  storageBucket: "agritax-fd278.firebasestorage.app",
  messagingSenderId: "105978575824",
  appId: "1:105978575824:web:05cb743bdc2f2e2c6bd7d5",
  measurementId: "G-G3B29JB86K"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let allData = [];
let filteredData = []; 
let currentSelectedIdSum = null; 
let currentUser = JSON.parse(sessionStorage.getItem('customUser')) || null;

let currentPage = 1;
const rowsPerPage = 10;
let hasSearched = false; 

window.onload = function() {
    checkLoginStatus();
};

function checkLoginStatus() {
    const loginWrapper = document.getElementById('loginWrapper');
    const mainSection = document.getElementById('mainSection');
    const qrPopup = document.getElementById('qrPopup');
    
    if (currentUser) {
        if (loginWrapper) loginWrapper.classList.add('hidden'); 
        if (mainSection) mainSection.classList.remove('hidden'); 
        document.getElementById('txtLoginUser').innerText = "👤 " + currentUser.username;
        fetchTaxData(); 
    } else {
        if (loginWrapper) loginWrapper.classList.remove('hidden'); 
        if (mainSection) mainSection.classList.add('hidden'); 
        if (qrPopup) qrPopup.classList.add('hidden'); 
    }
}

function loginWithUsernamePassword() {
    const userInp = document.getElementById('loginUsername').value.trim();
    const passInp = document.getElementById('loginPassword').value.trim();

    if (!userInp || !passInp) {
        alert("Vui lòng nhập đầy đủ Tài khoản và Mật khẩu!");
        return;
    }

    db.ref('users/' + userInp).once('value').then((snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.password === passInp) {
            currentUser = {
                username: userData.username,
                Branch: userData.Branch
            };
            sessionStorage.setItem('customUser', JSON.stringify(currentUser));
            checkLoginStatus();
        } else {
            alert("Sai tài khoản hoặc mật khẩu. Vui lòng thử lại!");
        }
    }).catch(err => {
        alert("Lỗi kết nối cơ sở dữ liệu: " + err.message);
    });
}

function logout() {
    sessionStorage.removeItem('customUser');
    currentUser = null;
    location.reload();
}

function fetchTaxData() {
    if (!currentUser || !currentUser.Branch) return;

    db.ref('QRCodeTax').on('value', (snapshot) => {
        try {
            const data = snapshot.val();
            allData = [];
            if (data) {
                for (let id in data) {
                    let item = data[id];
                    if (!item.ID) item.ID = id; 
                    
                    if (item.Branch === currentUser.Branch || item.BranchCode === currentUser.Branch) {
                        allData.push(item);
                    }
                }
                
                allData.sort((a, b) => {
                    if (a.IDSUM && b.IDSUM) {
                        if (a.IDSUM === b.IDSUM) {
                            return new Date(b.InsertTime) - new Date(a.InsertTime);
                        }
                        return a.IDSUM.localeCompare(b.IDSUM);
                    }
                    return new Date(b.InsertTime) - new Date(a.InsertTime);
                });
            }
            initComboboxes();
            if (hasSearched) {
                searchData(true); 
            }
        } catch (error) {
            console.error(error);
        }
    });
}

function initComboboxes() {
    const phuongXaSelect = document.getElementById('filterPhuongXa');
    if (!phuongXaSelect) return;
    const currentPx = phuongXaSelect.value;
    const uniquePhuongXa = [...new Set(allData.map(item => item.PhuongXa).filter(Boolean))];
    
    phuongXaSelect.innerHTML = '<option value="">-- Tất cả Phường/Xã --</option>';
    uniquePhuongXa.forEach(px => {
        phuongXaSelect.innerHTML += "<option value='" + px + "'>" + px + "</option>";
    });
    if(uniquePhuongXa.includes(currentPx)) phuongXaSelect.value = currentPx;
    updateThonToCombobox();
}

function updateThonToCombobox() {
    const phuongXaSelect = document.getElementById('filterPhuongXa');
    const thonToSelect = document.getElementById('filterThonTo');
    if (!phuongXaSelect || !thonToSelect) return;

    const selectedPx = phuongXaSelect.value;
    const currentTt = thonToSelect.value;
    
    const filteredItems = selectedPx ? allData.filter(item => item.PhuongXa === selectedPx) : allData;
    const uniqueThonTo = [...new Set(filteredItems.map(item => item.ThonTo).filter(Boolean))];

    thonToSelect.innerHTML = '<option value="">-- Tất cả Thôn/Tổ --</option>';
    uniqueThonTo.forEach(tt => {
        thonToSelect.innerHTML += "<option value='" + tt + "'>" + tt + "</option>";
    });
    if(uniqueThonTo.includes(currentTt)) thonToSelect.value = currentTt;
}

function searchData(isRealtimeUpdate = false) {
    if (!isRealtimeUpdate) {
        hasSearched = true; 
    }

    const pxValue = document.getElementById('filterPhuongXa').value;
    const ttValue = document.getElementById('filterThonTo').value;
    const statusValue = document.getElementById('filterTrangThai').value; 
    
    const nameInp = document.getElementById('searchName').value.trim();
    const nameValueClean = removeVietnameseTones(nameInp.toLowerCase()); 

    filteredData = allData;

    if (pxValue) filteredData = filteredData.filter(item => item.PhuongXa === pxValue);
    if (ttValue) filteredData = filteredData.filter(item => item.ThonTo === ttValue);
    
    if (statusValue !== "") {
        const isPaid = statusValue === "true";
        filteredData = filteredData.filter(item => {
            const itemStatus = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1;
            return itemStatus === isPaid;
        });
    }

    if (nameValueClean) {
        filteredData = filteredData.filter(item => {
            const rawFullName = (item.Ho || '') + " " + (item.Ten || '');
            const itemFullNameClean = removeVietnameseTones(rawFullName.toLowerCase());
            return itemFullNameClean.indexOf(nameValueClean) !== -1;
        });
    }

    if (!isRealtimeUpdate) {
        currentPage = 1; 
    }
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('taxTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!hasSearched) {
        tbody.innerHTML = "<tr><td colspan='11' style='text-align:center; color: #64748b; padding: 20px;'>Vui lòng nhập điều kiện lọc và bấm nút 'Tìm kiếm' để tải dữ liệu</td></tr>";
        updatePaginationControls(0);
        return;
    }

    if (!filteredData || filteredData.length === 0) {
        tbody.innerHTML = "<tr><td colspan='11' style='text-align:center; padding: 20px;'>Không tìm thấy dữ liệu phù hợp với địa bàn của bạn</td></tr>";
        updatePaginationControls(0);
        return;
    }

    let idsumTotals = {};
    allData.forEach(item => {
        if(item.IDSUM) {
            const amt = Number(item.SoTienThuThue) || 0;
            idsumTotals[item.IDSUM] = (idsumTotals[item.IDSUM] || 0) + amt;
        }
    });

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    let idsumCountsInPage = {};
    pageData.forEach(item => {
        if (item.IDSUM) {
            idsumCountsInPage[item.IDSUM] = (idsumCountsInPage[item.IDSUM] || 0) + 1;
        }
    });
    
    let idsumRenderedMST = {};
    let idsumRenderedName = {};
    let idsumRenderedCCCD = {};
    let idsumRenderedThonTo = {};
    let idsumRenderedPhuongXa = {};
    let idsumRenderedTotal = {};
    let idsumRenderedStatus = {};
    let idsumRenderedAction = {};

    pageData.forEach(item => {
        const tr = document.createElement('tr');
        const isPaid = item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1;
        const statusText = isPaid
            ? "<b style='color:#10b981;'>Đã thanh toán</b>" 
            : "<b style='color:#ef4444;'>Chưa thanh toán</b>";
        
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedMST[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.MaSoThue || '') + "</td>";
                idsumRenderedMST[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.MaSoThue || '') + "</td>";
        }
        
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedName[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff; '>" + (item.Ho || '') + " " + (item.Ten || '') + "</td>";
                idsumRenderedName[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.Ho || '') + " " + (item.Ten || '') + "</td>";
        }

        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedCCCD[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.CCCD || '') + "</td>";
                idsumRenderedCCCD[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.CCCD || '') + "</td>";
        }

        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedThonTo[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.ThonTo || '') + "</td>";
                idsumRenderedThonTo[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.ThonTo || '') + "</td>";
        }
        
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedPhuongXa[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + (item.PhuongXa || '') + "</td>";
                idsumRenderedPhuongXa[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + (item.PhuongXa || '') + "</td>";
        }
        
        tr.innerHTML += "<td>" + (item.MaPhiNN || '') + "</td>";
        tr.innerHTML += "<td>" + (item.TieuMuc || '') + "</td>";
        tr.innerHTML += "<td>" + (item.SoTienThuThue ? Number(item.SoTienThuThue).toLocaleString('vi-VN') : 0) + " đ</td>";

        const totalGroupAmount = idsumTotals[item.IDSUM] || Number(item.SoTienThuThue) || 0;
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedTotal[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #f8fafc; font-weight: bold; color: #1e3a8a; text-align: right;'>" + totalGroupAmount.toLocaleString('vi-VN') + " đ</td>";
                idsumRenderedTotal[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td style='font-weight: bold; color: #1e3a8a; text-align: right;'>" + totalGroupAmount.toLocaleString('vi-VN') + " đ</td>";
        }

        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedStatus[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; background-color: #ffffff;'>" + statusText + "</td>";
                idsumRenderedStatus[item.IDSUM] = true;
            }
        } else {
            tr.innerHTML += "<td>" + statusText + "</td>";
        }
        
        const targetIdSum = item.IDSUM || item.ID;
        if (item.IDSUM && idsumCountsInPage[item.IDSUM] > 1) {
            if (!idsumRenderedAction[item.IDSUM]) {
                tr.innerHTML += "<td rowspan='" + idsumCountsInPage[item.IDSUM] + "' style='vertical-align: middle; text-align: center; background-color: #ffffff;'>\
                    <button class='btn-table-qr' onclick=\"openQrPopupByIdSum('" + targetIdSum + "')\">⚙ Quét QR</button>\
                </td>";
                idsumRenderedAction[item.IDSUM] = true;
            }
        } else if (!item.IDSUM || idsumCountsInPage[item.IDSUM] <= 1) {
            tr.innerHTML += "<td style='text-align: center;'>\
                <button class='btn-table-qr' onclick=\"openQrPopupByIdSum('" + targetIdSum + "')\">⚙ Quét QR</button>\
            </td>";
        }
        
        tbody.appendChild(tr);
    });

    updatePaginationControls(filteredData.length);
}

function updatePaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    document.getElementById('pageInfo').innerText = "Trang " + currentPage + " / " + totalPages;
    document.getElementById('btnPrev').disabled = (currentPage === 1);
    document.getElementById('btnNext').disabled = (currentPage === totalPages);
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

async function openQrPopupByIdSum(idsum) {
    if (!idsum) return;

    const groupRecords = allData.filter(x => x.IDSUM === idsum || x.ID === idsum);
    if (groupRecords.length === 0) return;

    currentSelectedIdSum = idsum; 

    const isAllPaid = groupRecords.every(item => item.DaThanhToan === true || item.DaThanhToan === "true" || item.DaThanhToan === 1);

    window.isUpdatingToggle = true; 
    document.getElementById('switchPaymentStatus').checked = isAllPaid;
    document.getElementById('toggleStatusLabel').innerText = isAllPaid ? "ON (Đã Nộp)" : "OFF (Chưa Nộp)";
    document.getElementById('toggleStatusLabel').style.color = isAllPaid ? "#10b981" : "#ef4444";
    window.isUpdatingToggle = false;

    executeGenerateQr(BANK_ACCOUNT, BANK_BIN, allData, idsum);
}

function verifyAndPayChange(el) {
    const dbPartnerInstance = firebase.app().database(); 
    executeVerifyAndPayChange(el, dbPartnerInstance, allData, currentSelectedIdSum, renderTable, () => {});
}

function closePopup() {
    document.getElementById('qrPopup').classList.add('hidden');
    currentSelectedIdSum = null; 
}

function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return str.trim();
}

function goToChangePassPage() {
    if (currentUser && currentUser.username) {
        db.ref('users').orderByChild('username').equalTo(currentUser.username).once('value').then((snapshot) => {
            if (snapshot.exists()) {
                let idKey = null;
                snapshot.forEach((childSnapshot) => {
                    idKey = childSnapshot.key; 
                });

                if (idKey) {
                    sessionStorage.setItem('changePassUsername', currentUser.username);
                    sessionStorage.setItem('changePassIdKey', idKey);
                    window.location.href = "changepass.html";
                } else {
                    alert("Không thể xác định mã định danh (id_key) của tài khoản!");
                }
            } else {
                alert("Tài khoản không tồn tại trên cơ sở dữ liệu!");
            }
        }).catch(err => {
            alert("Lỗi kết nối hệ thống: " + err.message);
        });
    } else {
        alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại!");
    }
}

window.isUpdatingToggle = false;
window.clearCurrentSelectedIdSum = function() { currentSelectedIdSum = null; };
window.loginWithUsernamePassword = loginWithUsernamePassword;
window.logout = logout;
window.goToChangePassPage = goToChangePassPage;
window.updateThonToCombobox = updateThonToCombobox;
window.searchData = searchData;
window.handleSearch = searchData; 
window.prevPage = prevPage;
window.nextPage = nextPage;
window.openQrPopupByIdSum = openQrPopupByIdSum;
window.verifyAndPayChange = verifyAndPayChange;
window.closePopup = closePopup;
