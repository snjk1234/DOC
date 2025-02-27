let currentBuilding = '';
let currentData = [];
let editIndex = -1;
let isEditMode = false; // متغير لتتبع حالة التعديل

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
// تعديل دالة الحفظ لاستخدام التحقق
function saveData() {
    if (!validateForm()) return; // إيقاف الحفظ إذا فشل التحقق

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
    document.getElementById('saveBtn').disabled = true;
}

// تعديل دالة التحديث
function updateData() {
    if (isEditMode) {
        if (!validateForm()) return; // إيقاف التعديل إذا فشل التحقق
        // حفظ التعديلات
        currentData[editIndex] = { /* ... البيانات الجديدة ... */ };
        updateListView();
        clearForm();
        isEditMode = false;
        document.getElementById('saveBtn').disabled = true;
        document.getElementById('updateBtn').textContent = 'تعديل';
    } else {
        // تفعيل وضع التعديل
        isEditMode = true;
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('updateBtn').textContent = 'حفظ التعديل';
    }
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
        alert('✅ تم التعديل بنجاح');
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
        row.onclick = () => {
            editEntry(index); // تعبئة الحقول بالبيانات المحددة
            document.getElementById('saveBtn').disabled = true; // تعطيل الحفظ
            document.getElementById('updateBtn').disabled = false; // تمكين التعديل
        };
        listContent.appendChild(row);
    });
}

// دالة تعبئة الحقول ببيانات العنصر المحدد
function editEntry(index) {
    editIndex = index;
    const data = currentData[index];
    showForm(data.building); // إظهار النموذج
    
    // تعبئة الحقول بالبيانات:
    document.getElementById('totalBill').value = data.totalBill;
    document.getElementById('reading').value = data.reading;
    document.getElementById('valueSAR').value = data.valueSAR;
    document.getElementById('fromDate').value = data.fromDate;
    document.getElementById('toDate').value = data.toDate;
    document.getElementById('paymentAmount').value = data.paymentAmount;
    document.getElementById('comboBox').value = data.combo;
    
    isEditMode = false; // إعادة تعيين حالة التعديل
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

function validateForm() {
    // جلب قيم جميع الحقول
    const totalBill = document.getElementById('totalBill').value.trim();
    const reading = document.getElementById('reading').value.trim();
    const valueSAR = document.getElementById('valueSAR').value.trim();
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const paymentAmount = document.getElementById('paymentAmount').value.trim();
    const combo = document.getElementById('comboBox').value;

    // قائمة الحقول المطلوبة
    const requiredFields = [
        { value: totalBill, name: 'المبلغ الكلي' },
        { value: reading, name: 'القراءة' },
        { value: valueSAR, name: 'القيمة بالريال' },
        { value: fromDate, name: 'التاريخ من' },
        { value: toDate, name: 'التاريخ إلى' },
        { value: paymentAmount, name: 'مبلغ السداد' },
        { value: combo, name: 'العداد التجاري' }
    ];

    // التحقق من الحقول الفارغة
    const emptyFields = requiredFields.filter(field => !field.value);

    if (emptyFields.length > 0) {
        const errorMessage = 
            '❗ الحقول التالية مطلوبة:\n' +
            emptyFields.map(field => `- ${field.name}`).join('\n');
        
        alert(errorMessage);
        return false;
    }

    // التحقق من أن الحقول الرقمية تحتوي على أرقام
    const numericFields = [
        { value: totalBill, name: 'المبلغ الكلي' },
        { value: reading, name: 'القراءة' },
        { value: valueSAR, name: 'القيمة بالريال' },
        { value: paymentAmount, name: 'مبلغ السداد' }
    ];

    const invalidNumericFields = numericFields.filter(field => 
        isNaN(parseFloat(field.value))
    );

    if (invalidNumericFields.length > 0) {
        const errorMessage = 
            '❌ الحقول التالية يجب أن تحتوي على أرقام:\n' +
            invalidNumericFields.map(field => `- ${field.name}`).join('\n');
        
        alert(errorMessage);
        return false;
    }

    // التحقق من صحة التواريخ
    if (new Date(fromDate) > new Date(toDate)) {
        alert('⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية');
        return false;
    }

    return true;
}