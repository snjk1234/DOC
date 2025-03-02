// ----------------------------
// 1. استيراد مكتبات Firebase
// ----------------------------
import { signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";

// ----------------------------
// 2. إعدادات التهيئة
// ----------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD8029Mu2UKCwOJ90VE2tXCQ5Cs69G_W",
  authDomain: "docc-27e38.firebaseapp.com",
  databaseURL: "https://docc-27e38-default-rtdb.firebaseio.com",
  projectId: "docc-27e38",
  storageBucket: "docc-27e38.appspot.com",
  messagingSenderId: "636383310824",
  appId: "1:636383310824:web:354665d23bb2221caa75fd",
  measurementId: "G-JL94HGJJMH"
};

// ----------------------------
// 3. تهيئة التطبيق
// ----------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // قاعدة بيانات Firestore
const auth = getAuth(app); // مصادقة Firebase
const unsubscribe = onSnapshot(collection(db, "Buildings"), (snapshot) => {
    currentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateListView();
});
// ----------------------------
// 4. المتغيرات العامة
// ----------------------------
let currentBuilding = ''; // اسم العمارة المحددة
let currentData = []; // بيانات العقارات
let editIndex = -1; // مؤشر التعديل
let isEditMode = false; // حالة التعديل

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
async function loadAllData() {
    try {
      showLoader();
      const querySnapshot = await getDocs(collection(db, "Buildings")); // ✅ Firestore
      ccurrentData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateListView();
    } catch (error) {
      Swal.fire('خطأ!', 'فشل تحميل البيانات: ' + error.message, 'error');
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
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        
        // 1. التحقق من إدخال البيانات
        if (!username || !password) {
            Swal.fire('خطأ!', 'يرجى إدخال اسم المستخدم وكلمة المرور', 'error');
            return;
        }

        // 2. تسجيل الدخول باستخدام Firebase Auth
        const email = `${username}@estate.com`; // بناء البريد الإلكتروني
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 3. حفظ التوكن في sessionStorage (اختياري)
        const token = await user.getIdToken();
        sessionStorage.setItem('authToken', token);

        // 4. تحميل البيانات وإظهار لوحة التحكم
        await loadAllData();
        document.getElementById("loginContainer").style.display = 'none';
        document.getElementById("dashboard").style.display = 'block';
    } catch (error) {
        Swal.fire('خطأ!', `فشل تسجيل الدخول: ${error.message}`, 'error');
    } finally {
        hideLoader();
    }
}


function logout() {
    // 1. مسح التوكن وجميع البيانات المؤقتة
    sessionStorage.clear(); // ✅ تصحيح الخطأ الإملائي
    
    // 2. إعادة توجيه إلى صفحة الدخول
    location.href = 'index.html';
}

/*****************************
 *      حذف سجل      *
 *****************************/
async function deleteEntry(id) {
    const result = await Swal.fire({     
        title: 'هل أنت متأكد؟',
        text: "لا يمكنك التراجع عن هذا الإجراء!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، احذف!',
        cancelButtonText: 'إلغاء'
    });
  
    if (!result.isConfirmed) return;
  
    try {
        showLoader();
        // حذف المستند من Firestore باستخدام الـ ID
        await deleteDoc(doc(db, "buildings", id));
        await loadAllData(); // إعادة تحميل البيانات
        Swal.fire('تم الحذف!', '', 'success'); // ✅ تصحيح الرسالة
    } catch (error) {
        Swal.fire('خطأ!', 'فشل الحذف: ' + error.message, 'error'); // ✅ تصحيح الرسالة
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
  
      if (isEditMode) {
        // تحديث البيانات في Firebase
        await updateDoc(doc(db, "Buildings", currentData[editIndex].id), data);
        Swal.fire('نجاح!', 'تم التعديل', 'success');
      } else {
        // إضافة جديدة إلى Firebase
        await addDoc(collection(db, "Buildings"), data);
        Swal.fire('نجاح!', 'تمت الإضافة', 'success');
      }
  
      await loadAllData();
    } catch (error) {
      Swal.fire('خطأ!', 'فشلت العملية: ' + error.message, 'error');
    } finally {
      hideLoader();
      clearForm();
      isEditMode = false;
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

function exportToExcel() {
    const data = currentData.map(item => ({
        "اسم العمارة": item.building,
        "المبلغ الكلي": item.totalBill,
        "القراءة": item.reading,
        "القيمة بالريال": item.valueSAR,
        "التاريخ من": item.fromDate,
        "التاريخ إلى": item.toDate,
        "مبلغ السداد": item.paymentAmount,
        "العداد التجاري": item.combo
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "البيانات");
    XLSX.writeFile(wb, "بيانات_العقارات.xlsx");
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
      const querySnapshot = await getDocs(collection(db, "buildings"));
      const allData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const results = allData.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
));

      currentData = results;
      updateListView();
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
function updateToDateMin() {
    const fromDate = document.getElementById('fromDate').value;
    document.getElementById('toDate').min = fromDate;
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

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}