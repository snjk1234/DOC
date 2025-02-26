let currentBuilding = '';
let currentData = [];
let editIndex = -1;

const comboBoxData = {
    'العمارة الكبيرة 30058543307': ['البدروم عدد2', 'شقة 4 عدد1', 'شقق 22/23/ عليها2', 'الخدمات بدون عداد'],
    'عمارة سلطانة 10075126558': ['شقة رقم 10 عدد 1','خدمات +عمال ريان بدون'],
    'عمارة المنارات 30059069267': ['يوجد عداد خدمات لحاله', 'عدد 4 شقق ب4 عدادات'],
    'عمارة السيل 30059012783': ['شقة 4 مع الخدمات بدون عداد'],
    'عمارة المكتب القديم 10074768485': ['5 محلات تجارية بعدادات', 'محل رقم 6 غير مؤجر', 'البدروم عدد3 اتفاق بينهم', 'شقة رقم 3 عداد تجاري+خدمات'],
    'عمارة التجارية 30059069178': []
};

document.addEventListener('DOMContentLoaded', function() {
    if(localStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    }
});

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if(username === 'admin' && password === 'admin') {
        // حفظ حالة تسجيل الدخول
        localStorage.setItem('isLoggedIn', 'true');
        
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    }
}

// إضافة دالة تسجيل الخروج (اختياري)
function logout() {
    localStorage.removeItem('isLoggedIn');
    location.reload();
}

function showForm(building) {
    currentBuilding = building;
    document.getElementById('buildingTitle').textContent = building;
    document.getElementById('formContainer').style.display = 'block';
    populateComboBox(building);
}

function populateComboBox(building) {
    const combo = document.getElementById('comboBox');
    combo.innerHTML = '';
    comboBoxData[building].forEach(item => {
        const option = document.createElement('option');
        option.text = item;
        combo.add(option);
    });
}

function saveData() {
    const data = {
        building: currentBuilding,
        totalBill: document.getElementById('totalBill').value,
        reading: document.getElementById('reading').value,
        valueSAR: document.getElementById('valueSAR').value,
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value,
        paymentAmount: document.getElementById('paymentAmount').value,
        combo: document.getElementById('comboBox').value
    };
    
    currentData.push(data);
    updateListView();
    clearForm();
}

function updateData() {
    if(editIndex > -1) {
        currentData[editIndex] = {
            building: currentBuilding,
            totalBill: document.getElementById('totalBill').value,
            reading: document.getElementById('reading').value,
            valueSAR: document.getElementById('valueSAR').value,
            fromDate: document.getElementById('fromDate').value,
            toDate: document.getElementById('toDate').value,
            paymentAmount: document.getElementById('paymentAmount').value,
            combo: document.getElementById('comboBox').value
        };
        updateListView();
        clearForm();
        editIndex = -1;
    }
}

function updateListView() {
    const listContent = document.getElementById('listContent');
    listContent.innerHTML = '';
    
    currentData.forEach((data, index) => {
        const row = document.createElement('tr');
        row.className = 'list-item';
        row.innerHTML = `
            <td>${data.building}</td>
            <td>${data.totalBill}</td>
            <td>${data.reading}</td>
            <td>${data.valueSAR}</td>
            <td>${data.fromDate}</td>
            <td>${data.toDate}</td>
            <td>${data.paymentAmount}</td>
            <td>${data.combo}</td>
        `;
        row.onclick = () => editEntry(index);
        listContent.appendChild(row);
    });
}

function editEntry(index) {
    editIndex = index;
    const data = currentData[index];
    showForm(data.building);
    document.getElementById('totalBill').value = data.totalBill;
    document.getElementById('reading').value = data.reading;
    document.getElementById('valueSAR').value = data.valueSAR;
    document.getElementById('fromDate').value = data.fromDate;
    document.getElementById('toDate').value = data.toDate;
    document.getElementById('paymentAmount').value = data.paymentAmount;
    document.getElementById('comboBox').value = data.combo;
}

function clearForm() {
    document.getElementById('totalBill').value = '';
    document.getElementById('reading').value = '';
    document.getElementById('valueSAR').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('paymentAmount').value = '';
}

function goBack() {
    document.getElementById('formContainer').style.display = 'none';
    clearForm();
}