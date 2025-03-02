/*****************************
 *         المتغيرات العامة         *
 *****************************/
let currentBuilding = ''; // تخزين اسم العمارة المحددة
let currentData = [];     // مصفوفة تخزن بيانات العقارات
let editIndex = -1;       // مؤشر لتحديد العنصر المراد تعديله
let isEditMode = false;   // حالة تحديد إذا كان في وضع التعديل

const firebaseConfig = {
    apiKey: "AIzaSyD8Q29wId2UKCwOJ9QvE2tXCQsCs69G_Vw",
    authDomain: "doce-27e38.firebaseapp.com",
    projectId: "doce-27e38",
    storageBucket: "doce-27e38.firebasestorage.app",
    messagingSenderId: "636383310024",
    appId: "1:636383310024:web:f3cbf688e5991ff9aa75fd",
    measurementId: "G-6ECK0BDES2"
  };

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
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
 *     أحداث تحميل الصفحة     *
 *****************************/
document.addEventListener('DOMContentLoaded', async () => {
    try {
        if (sessionStorage.getItem('authToken')) {
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            await loadDataFromFirebase();
        }
    } catch (error) {
        console.error('فشل تهيئة التطبيق:', error);
        alert('تعذر الاتصال بالنظام!');
    } finally {
        hideLoader();
    }
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

// مثال على الاستخدام في دالة تحميل البيانات
/*****************************
 *      تحميل جميع البيانات      *
 *****************************/
async function loadDataFromFirebase() {
    try {
        showLoader();

        // جلب البيانات من Firebase
        const snapshot = await database.ref('buildings').once('value');
        const data = snapshot.val();

        // تحويل البيانات إلى مصفوفة
        currentData = data ? Object.values(data) : [];

        // تحديث الواجهة
        updateListView();
    } catch (error) {
        console.error('فشل تحميل البيانات:', error);
        alert('فشل تحميل البيانات: ' + error.message);
    } finally {
        hideLoader();
    }
}

async function loadDataFromFirebase() {
    try {
        showLoader();
        const snapshot = await database.ref('buildings').once('value');
        const data = snapshot.val();
        currentData = data ? Object.values(data) : [];
        updateListView();
    } catch (error) {
        console.error('فشل تحميل البيانات:', error);
        alert('فشل تحميل البيانات: ' + error.message);
    } finally {
        hideLoader();
    }
}

/*****************************
 *      إدارة المصادقة      *
 *****************************/
async function login() {
    try {
        showLoader();
        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        sessionStorage.setItem('authToken', user.uid);
        location.reload();
    } catch (error) {
        console.error('فشل التسجيل:', error);
        alert('بيانات الدخول غير صحيحة!');
    } finally {
        hideLoader();
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        sessionStorage.clear();
        location.href = 'index.html';
    });
}

function saveDataToFirebase(data) {
    const db = firebase.database();
    db.ref('buildings').set(data);
}

/*****************************
 *      حذف سجل      *
 *****************************/
async function deleteEntry(id) {
    if (!confirm('هل أنت متأكد؟')) return;

    try {
        showLoader();

        // حذف البيانات من Firebase
        await database.ref('buildings/' + id).remove();

        // إعادة تحميل البيانات
        await loadDataFromFirebase();
        clearForm();
    } catch (error) {
        console.error('فشل الحذف:', error);
        alert('فشل الحذف: ' + error.message);
    } finally {
        hideLoader();
    }
}

/*****************************
 *   إدارة العمليات (إضافة/تعديل)   *
 *****************************/
async function handleData() {
    if (!validateForm()) return;

    try {
        showLoader();

        // تجميع بيانات النموذج
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

        // إرسال البيانات إلى Firebase
        if (isEditMode && currentData[editIndex]?.id) {
            // إذا كان في وضع التعديل، قم بتحديث البيانات
            await database.ref('buildings/' + currentData[editIndex].id).set(data);
            alert('✅ تم التعديل بنجاح');
        } else {
            // إذا كان في وضع الإضافة، قم بإضافة بيانات جديدة
            await database.ref('buildings').push(data);
            alert('✅ تمت الإضافة بنجاح');
        }

        // إعادة تحميل البيانات من Firebase
        await loadDataFromFirebase();
    } catch (error) {
        console.error('فشلت العملية:', error);
        alert('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
        hideLoader();
        clearForm();
        isEditMode = false;
        editIndex = -1;
    }
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
        showLoader();
        const snapshot = await database.ref('buildings')
            .orderByChild('building')
            .startAt(searchTerm)
            .endAt(searchTerm + '\uf8ff')
            .once('value');
        const data = snapshot.val();
        currentData = data ? Object.values(data) : [];
        updateListView();
    } catch (error) {
        console.error('فشل البحث:', error);
        alert('فشل البحث: ' + error.message);
    } finally {
        hideLoader();
    }
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

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}