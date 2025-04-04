/*****************************
 *         المتغيرات العامة         *
 *****************************/
let currentBuilding = ''; // تخزين اسم العمارة المحددة
let editIndex = -1;       // مؤشر لتحديد العنصر المراد تعديله
let isEditMode = false;   // حالة تحديد إذا كان في وضع التعديل
let db;                   // المرجع الرئيسي لقاعدة البيانات
let allData = []; // جميع البيانات من قاعدة البيانات
let currentData = []; // البيانات المعروضة بعد التصفية/البحث
/*****************************
 *      ثوابت قاعدة البيانات      *
 *****************************/
const DB_NAME = 'EstateDB';       // اسم قاعدة البيانات
const STORE_NAME = 'Buildings';   // اسم مخزن البيانات
const DB_VERSION = 1;             // إصدار قاعدة البيانات

/*****************************
 *    تهيئة قاعدة البيانات     *
 *****************************/
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // فتح أو إنشاء قاعدة البيانات
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // معالجة تحديث الهيكل
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // إنشاء مخزن البيانات إذا لم يكن موجوداً
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                
                // إنشاء فهارس لجميع الحقول للبحث السريع
                store.createIndex('building', 'building', { unique: false });
                store.createIndex('totalBill', 'totalBill', { unique: false });
                store.createIndex('reading', 'reading', { unique: false });
                store.createIndex('valueSAR', 'valueSAR', { unique: false });
                store.createIndex('fromDate', 'fromDate', { unique: false });
                store.createIndex('toDate', 'toDate', { unique: false });
                store.createIndex('paymentAmount', 'paymentAmount', { unique: false });
                store.createIndex('combo', 'combo', { unique: false });
            }
        };

        // عند نجاح فتح قاعدة البيانات
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db); // إرجاع المرجع لقاعدة البيانات
        };

        // معالجة الأخطاء
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// بيانات القوائم المنسدلة لكل عمارة
const comboBoxData = {
    'العمارة الكبيرة 30058543307': ['البدروم عدد2', 'شقة 4 عدد1', 'شقق 22/23/ عليها2', 'الخدمات بدون عداد'],
    'عمارة سلطانة 10075126558': ['شقة رقم 10 عدد 1','خدمات +عمال ريان بدون'],
    'عمارة المنارات 30059069267': ['يوجد عداد خدمات لحاله', 'عدد 4 شقق ب4 عدادات'],
    'عمارة السيل 30059012783': ['شقة 4 مع الخدمات بدون عداد'],
    'عمارة المكتب القديم 10074768485': ['5 محلات تجارية بعدادات', 'محل رقم 6 غير مؤجر', 'البدروم عدد3 اتفاق بينهم', 'شقة رقم 3 عداد تجاري+خدمات'],
    'عمارة التجارية 30059069178': ['العمارة التجارية 30059069178'],

    'الاستراحة1': ['سلطان','عادل الزهراني','الافغانية','سعد رضا','المصري','عبد المحسن','ابوريان','الحدادين','استراحة المسبح',],
    'الاستراحة2': ['الاستراحة2 ']

};

/*****************************
 *     أحداث تحميل الصفحة     *
 *****************************/
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // التحقق من وجود توكن مصادقة
        if (sessionStorage.getItem('authToken')) {
            db = await initializeDatabase();
            // إخفاء واجهة الدخول وإظهار لوحة التحكم
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';

            // تحميل البيانات وعرضها
            await loadAllData();
        }
    } catch (error) {
        console.error('فشل تهيئة التطبيق:', error);
        alert('تعذر الاتصال بالنظام!');
    } finally {
        hideLoader(); // إخفاء المؤشر في جميع الحالات
    }
});

document.getElementById('enableTotalBill').addEventListener('click', function () {
    const totalBillInput = document.getElementById('totalBill');
    totalBillInput.disabled = false; // تمكين الحقل
    totalBillInput.focus(); // وضع المؤشر داخل الحقل
});

/*****************************
 *      إدارة مؤشر التحميل      *
 *****************************/
function showLoader() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoader() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}
// مثال على الاستخدام في دالة تحميل البيانات
/*****************************
 *      تحميل جميع البيانات      *
 *****************************/
async function loadAllData() {
    try {
        showLoader(); // هنا قبل بدء العملية
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        const data = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        allData = data.map(item => ({ ...item, id: Number(item.id) })); // ⬅️ تحويل الـ ID إلى رقم
        currentData = [...allData];
        updateListView();
        // تحديث المبالغ بجانب الأزرار
        const totals = {};
        data.forEach(item => {
            totals[item.building] = (totals[item.building] || 0) + parseFloat(item.totalBill || 0);
        });
        Object.entries(totals).forEach(([building, total]) => {
            updateTotalBillDisplay(building, total);
        });
    } catch (error) {
        alert('فشل تحميل البيانات: ' + error.message);
    } finally {
        hideLoader(); // هنا بعد الانتهاء من جميع العمليات
    }
}

async function loadPaginatedData(page = 1, pageSize = 10) {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    const results = [];
    let counter = 0;

    await new Promise((resolve) => {
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && counter < (page * pageSize)) {
                if (counter >= ((page - 1) * pageSize)) {
                    results.push(cursor.value);
                }
                counter++;
                cursor.continue();
            } else {
                resolve();
            }
        };
    });

    currentData = results;
    updateListView();
}

/*****************************
 *      إدارة المصادقة      *
 *****************************/
async function login() {
    try {
        showLoader(); // قبل التحقق من البيانات
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // تشفير كلمة المرور باستخدام SHA-256
        const hashedPassword = CryptoJS.SHA256(password).toString();
    
        // بيانات المستخدمين (لتغييرها في البيئة الإنتاجية)
        const validUsers = {
            admin: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' // 123
        };
    
        // التحقق من صحة البيانات
        if (validUsers[username] === hashedPassword) {
            sessionStorage.setItem('authToken', 'generated_token_here');
            location.reload(); // إعادة تحميل الصفحة لتطبيق التغييرات
        } else {
            alert('بيانات الدخول غير صحيحة!');
        }
    } catch (error) {
        alert('فشل التسجيل: ' + error.message);
    } finally {
        hideLoader(); // بعد اكتمال العملية
    }
}

// إضافة دالة تسجيل الخروج (اختياري)
function logout() {
    sessionStorage.clear(); // مسح جميع البيانات المؤقتة
    location.href = 'index.html'; // إعادة التوجيه
}


/*****************************
 *      حذف سجل      *
 *****************************/
async function deleteEntry(id) {
    const idNumber = Number(id);
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
        showLoader();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const exists = allData.some(entry => entry.id === idNumber);
        if (!exists) return alert('السجل غير موجود!');
        const request = store.delete(idNumber);
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        // البحث عن السجل المحذوف في مصفوفة currentData
        const deletedEntry = allData.find(entry => entry.id === idNumber);
        if (deletedEntry) {
            allData = allData.filter(entry => entry.id !== idNumber);
            currentData = currentData.filter(entry => entry.id !== idNumber);
            updateListView();
            updateTotalBillDisplay(deletedEntry.building); // ← التحديث هنا
        }

        // إخفاء مؤشر التحميل
        clearForm();
        hideLoader();
        // إظهار رسالة نجاح
       // alert('✅ تم الحذف بنجاح');
    } catch (error) {
        // إخفاء مؤشر التحميل في حالة الخطأ
        hideLoader();

        // إظهار رسالة الخطأ
        alert('❌ فشل الحذف: ' + error.message);
        console.error('Error Details:', error); // ⬅️ طباعة تفاصيل الخطأ
    }

}


function updateTotalBillDisplayByDeletedId(id) {
    const deletedEntry = allData.find(entry => entry.id === id);
    if (deletedEntry) {
        const remainingTotal = allData
            .filter(item => item.building === deletedEntry.building)
            .reduce((sum, item) => sum + parseFloat(item.totalBill || 0), 0);
        
        const totalBillElement = document.getElementById(`totalBill_${deletedEntry.building}`);
        if (totalBillElement) {
            totalBillElement.textContent = `${remainingTotal.toFixed(2)} ريال`;
        }
    }
}
/*****************************
 *   إدارة العمليات (إضافة/تعديل)   *
 *****************************/
async function handleData() {
    // التحقق من صحة النموذج أولاً
    if (!validateForm()) return;
    
    try {
        // إظهار مؤشر التحميل
        showLoader();
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
        if (isEditMode && editIndex !== -1) {
            data.id = editIndex; // ⬅️ استخدام editIndex الذي يحتوي على الـ ID
        }
        // بدء معاملة قاعدة البيانات
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

            if (isEditMode && data.id) { // استخدام الـ ID الموجود
                await store.put(data);
            } else {
                await store.add(data);
            }
        // إعادة تحميل البيانات وتحديث الواجهة
        await loadAllData();
        updateTotalBillDisplay(currentBuilding);
    } catch (error) {
        // معالجة الأخطاء
        console.error('فشلت العملية:', error);
        alert('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
        // إخفاء مؤشر التحميل في جميع الحالات
        clearForm();
        hideLoader();
        isEditMode = false;
        editIndex = -1;
    }
}


function populateComboBox(building) {
    const combo = document.getElementById('comboBox');
    combo.innerHTML = '';
    if (comboBoxData[building]) {
        comboBoxData[building].forEach(item => {
            const option = document.createElement('option');
            option.text = item;
            combo.add(option);
        });
    }
}

/*****************************
 *      البحث في البيانات      *
 *****************************/

let searchTimeout;
document.querySelector('.search-box').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchData(e.target.value);
    }, 300); // تأخير 300ms
});

async function searchData(searchTerm) {
    try {
        showLoader(); // هنا قبل البدء
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('building'); // ✅ استخدام الفهرس
        const results = [];
        
        await new Promise((resolve) => {
            const request = index.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const item = cursor.value;
                    // البحث في جميع الحقول
                    const match = Object.values(item).some(value => 
                        String(value).toLowerCase().includes(searchTerm.toLowerCase())
                    );
                    if (match) results.push(item);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
        
        currentData = results;
        updateListView();
    } finally {
        hideLoader(); // هنا في النهاية
    }
}

function editEntry(id) {

    const data = allData.find(item => item.id === id); // ⬅️ البحث في allData
    if (!data) return;
    showForm(data.building);
    document.getElementById('totalBill').value = data.totalBill;
    document.getElementById('reading').value = data.reading;
    document.getElementById('valueSAR').value = data.valueSAR;
    document.getElementById('fromDate').value = data.fromDate;
    document.getElementById('toDate').value = data.toDate;
    document.getElementById('paymentAmount').value = data.paymentAmount;
    document.getElementById('comboBox').value = data.combo;
        // تحديث حالة التعديل
        isEditMode = true;
        editIndex = data.id; // ⬅️ استخدام الـ ID بدلاً من الفهرس
}

function clearForm() {
    // إفراغ الحقول
    currentBuilding = '';
    document.getElementById('totalBill').value = '';
    document.getElementById('totalBill').disabled = true;
    document.getElementById('reading').value = '';
    document.getElementById('valueSAR').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('comboBox').value = ''; // إضافة هذا السطر إذا كنت تريد إفراغ القائمة المنسدلة أيضًا

    // إعادة تعيين حالة التعديل
    isEditMode = false;
    editIndex = -1;
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

/*****************************
 *      وظائف مساعدة      *
 *****************************/
function resetListView() {
    currentData = [...allData];
    updateListView(); // إعادة تعيين القائمة لعرض جميع البيانات
}

function updateListView() {
    const listContent = document.getElementById('listContent');
    listContent.innerHTML = '';
    
    currentData.forEach((data) => {
        const row = document.createElement('tr');
        row.className = 'list-item';
        row.setAttribute('data-id', data.id);
        row.innerHTML = `
            <td>${data.building}</td>
            <td>${data.totalBill}</td>
            <td>${data.reading}</td>
            <td>${data.valueSAR}</td>
            <td>${data.fromDate}</td>
            <td>${data.toDate}</td>
            <td>${data.paymentAmount}</td>
            <td>${data.combo}</td>
                <td>
        <button onclick="deleteEntry(this.closest('tr').getAttribute('data-id'))" class="delete-btn">
            <i class="fas fa-trash"></i> حذف
        </button>
    </td>
        `;
        row.addEventListener('click', () => {
            const id = parseInt(row.getAttribute('data-id')); // ⬅️ استرجاع الـ ID
            editEntry(id);
        });
        row.onclick = () => editEntry(data.id); // تمرير الـ ID بدلاً من الفهرس
        listContent.appendChild(row);
    });
}

function updateFilteredListView(filteredData) {
    const listContent = document.getElementById('listContent');
    listContent.innerHTML = ''; // إفراغ القائمة الحالية

    // عرض البيانات المصفاة
    filteredData.forEach((data) => {
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
        listContent.appendChild(row);
    });
}

function filterByBuilding(building) {
    const filteredData = allData.filter(item => item.building === building);
    currentData = filteredData;
    updateListView();

}

function showForm(building) {
    // تعيين العمارة الحالية وعنوان النموذج
    currentBuilding = building;
    document.getElementById('buildingTitle').textContent = building;

    // إظهار النموذج بتأثير
    const formContainer = document.getElementById('formContainer');
    formContainer.classList.add('show'); // إضافة تأثير (إذا كان مدعومًا)
    formContainer.style.display = 'block'; // إظهار النموذج

    // تعبئة القائمة المنسدلة (ComboBox)
    populateComboBox(building);
}

function exportToExcel() {
    const data = currentData;
    const headers = ["اسم العمارة", "المبلغ الكلي", "القراءة", "القيمة بالريال", "التاريخ من", "التاريخ إلى", "مبلغ السداد", "العداد التجاري"];
    const rows = data.map(item => [
        item.building,
        item.totalBill,
        item.reading,
        item.valueSAR,
        item.fromDate,
        item.toDate,
        item.paymentAmount,
        item.combo
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(row => row.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "عقارات.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function goBack() {
    clearForm(); // إفراغ الحقول
    document.getElementById('formContainer').style.display = 'none'; // إخفاء النموذج
}

// دالة لتحديث عرض المبلغ الكلي بجانب الزر
function updateTotalBillDisplay(building) {
    // حساب المبلغ الإجمالي من البيانات الحالية
    const total = allData
        .filter(item => item.building === building)
        .reduce((sum, item) => sum + parseFloat(item.totalBill || 0), 0);

    // تحديث العرض بجانب الزر
    const totalBillElement = document.getElementById(`totalBill_${building}`);
    if (totalBillElement) {
        totalBillElement.textContent = `${total.toFixed(2)} ريال`; // عرض المبلغ مع خانتين عشريتين
    }
}