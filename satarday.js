/*****************************
 *         المتغيرات         *
 *****************************/
let currentBuilding = ''; // العمارة المحددة
let currentData = [];     // بيانات التطبيق
let editIndex = -1;       // مؤشر التعديل
let isEditMode = false;   // حالة التعديل

// بيانات القوائم المنسدلة لكل عمارة
const comboBoxData = {
    'العمارة الكبيرة 30058543307': ['البدروم عدد2', 'شقة 4 عدد1', 'شقق 22/23/ عليها2', 'الخدمات بدون عداد'],
    'عمارة سلطانة 10075126558': ['شقة رقم 10 عدد 1','خدمات +عمال ريان بدون'],
    'عمارة المنارات 30059069267': ['يوجد عداد خدمات لحاله', 'عدد 4 شقق ب4 عدادات'],
    'عمارة السيل 30059012783': ['شقة 4 مع الخدمات بدون عداد'],
    'عمارة المكتب القديم 10074768485': ['5 محلات تجارية بعدادات', 'محل رقم 6 غير مؤجر', 'البدروم عدد3 اتفاق بينهم', 'شقة رقم 3 عداد تجاري+خدمات'],
    'عمارة التجارية 30059069178': []
};

/*****************************
 *       أحداث التحميل       *
 *****************************/
document.addEventListener('DOMContentLoaded', () => {
    // تحميل البيانات من localStorage
    const encryptedData = localStorage.getItem('estateData');
    if (encryptedData) {
        currentData = JSON.parse(CryptoJS.AES.decrypt(encryptedData, 'SECRET_KEY').toString(CryptoJS.enc.Utf8));
    }

    // التحقق من تسجيل الدخول
    if (localStorage.getItem('authToken')) {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        updateListView();
    }
});

/*****************************
 *      إدارة المصادقة      *
 *****************************/
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // تشفير كلمة المرور باستخدام SHA-256
    const hashedPassword = CryptoJS.SHA256(password).toString();

    // بيانات المستخدمين (يجب تغييرها في البيئة الإنتاجية)
    const validUsers = {
        admin: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' // تشفير SHA-256 لـ "123"
    };

    if (validUsers[username] === hashedPassword) {
        localStorage.setItem('authToken', 'generated_token_here');
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    } else {
        alert('بيانات الدخول غير صحيحة!');
    }
}

/*****************************
 * دالة موحدة للحفظ والتعديل *
*****************************/
function handleData() {
    // التحقق من صحة البيانات قبل التنفيذ
    if (!validateForm()) return;

    // تجميع البيانات من النموذج
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

    // التعديل إذا كان في وضع التعديل، وإلا الإضافة
    if (isEditMode && editIndex > -1) {
        currentData[editIndex] = data;
        alert('✅ تم التعديل بنجاح');
    } else {
        currentData.push(data);
        alert('✅ تمت الإضافة بنجاح');
    }

    // حفظ البيانات في localStorage بعد التشفير
    const encryptedData = CryptoJS.AES.encrypt(
        JSON.stringify(currentData), 
        'SECRET_KEY'
    ).toString();
    localStorage.setItem('estateData', encryptedData);

    // تحديث الجدول ومسح النموذج
    updateListView();
    clearForm();
    isEditMode = false;
    editIndex = -1;
}

// إضافة دالة تسجيل الخروج (اختياري)
function logout() {
    localStorage.clear(); // مسح جميع البيانات المؤقتة
    location.href = 'index.html'; // إعادة التوجيه
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
        };
        listContent.appendChild(row);
    });
}

function editEntry(index) {
    isEditMode = true;
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
    isEditMode = false; // إلغاء وضع التعديل
    editIndex = -1; // إعادة تعيين الفهرس
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
window.onbeforeunload = function() {
    if (currentData.length > 0) return 'لديك تغييرات غير محفوظة!';
};