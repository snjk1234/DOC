/**
 * ==================================
 * ملف جافاسكربت رئيسي لتطبيق إدارة العقارات
 * ==================================
 * هذا الملف يحتوي على جميع الوظائف اللازمة لتشغيل التطبيق،
 * بما في ذلك التفاعل مع قاعدة البيانات IndexedDB، إدارة واجهة المستخدم،
 * المصادقة، وعمليات البيانات (إضافة، تعديل، حذف، بحث).
 */

/*****************************
 * المتغيرات العامة والثوابت      *
 *****************************/

// --- متغيرات الحالة ---
let currentBuilding = ''; // اسم العمارة المحددة حالياً في النموذج
let editId = null;        // معرّف السجل المراد تعديله (يستخدم null للإشارة إلى عدم وجود تعديل)
let db;                   // مرجع كائن قاعدة البيانات IndexedDB
let allData = [];         // مصفوفة لتخزين جميع السجلات من قاعدة البيانات
let currentData = [];     // مصفوفة لتخزين البيانات المعروضة حالياً (بعد التصفية أو البحث)

// --- ثوابت قاعدة البيانات ---
const DB_NAME = 'EstateDB';       // اسم قاعدة البيانات
const STORE_NAME = 'Buildings';   // اسم مخزن الكائنات (الجدول)
const DB_VERSION = 1;             // إصدار قاعدة البيانات

// --- بيانات القوائم المنسدلة (يمكن نقلها إلى قاعدة بيانات أو ملف تكوين لاحقاً) ---
const comboBoxData = {
    'العمارة الكبيرة 30058543307': ['البدروم عدد2', 'شقة 4 عدد1', 'شقق 22/23/ عليها2', 'الخدمات بدون عداد'],
    'عمارة سلطانة 10075126558': ['شقة رقم 10 عدد 1', 'خدمات +عمال ريان بدون'],
    'عمارة المنارات 30059069267': ['يوجد عداد خدمات لحاله', 'عدد 4 شقق ب4 عدادات'],
    'عمارة السيل 30059012783': ['شقة 4 مع الخدمات بدون عداد'],
    'عمارة المكتب القديم 10074768485': ['5 محلات تجارية بعدادات', 'محل رقم 6 غير مؤجر', 'البدروم عدد3 اتفاق بينهم', 'شقة رقم 3 عداد تجاري+خدمات'],
    'عمارة التجارية 30059069178': ['العمارة التجارية 30059069178'],
    'الاستراحة1': ['سلطان', 'عادل الزهراني', 'الافغانية', 'سعد رضا', 'المصري', 'عبد المحسن', 'ابوريان', 'الحدادين', 'استراحة المسبح'],
    'الاستراحة2': ['الاستراحة2 ']
};


/*****************************
 * تهيئة قاعدة البيانات IndexedDB   *
 *****************************/

/**
 * تهيئة قاعدة البيانات IndexedDB.
 * تقوم بفتح قاعدة البيانات وإنشاء مخزن الكائنات والفهارس إذا لم تكن موجودة.
 * @returns {Promise<IDBDatabase>} وعد يتم حله مع كائن قاعدة البيانات عند النجاح.
 */
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // طلب فتح قاعدة البيانات بالإصدار المحدد
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // يتم استدعاء هذا الحدث فقط عند إنشاء قاعدة بيانات جديدة أو عند زيادة رقم الإصدار
        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;

            // التحقق مما إذا كان مخزن الكائنات موجوداً بالفعل
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                // إنشاء مخزن الكائنات مع مفتاح أساسي يتزايد تلقائياً
                const store = dbInstance.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });

                // إنشاء فهارس للحقول لتسريع عمليات البحث والاستعلام
                // ملاحظة: الفهارس تساعد في البحث بكفاءة حسب هذه الحقول
                store.createIndex('building', 'building', { unique: false });
                store.createIndex('totalBill', 'totalBill', { unique: false });
                store.createIndex('reading', 'reading', { unique: false });
                store.createIndex('valueSAR', 'valueSAR', { unique: false });
                store.createIndex('fromDate', 'fromDate', { unique: false });
                store.createIndex('toDate', 'toDate', { unique: false });
                store.createIndex('paymentAmount', 'paymentAmount', { unique: false });
                store.createIndex('combo', 'combo', { unique: false });
                console.log(`تم إنشاء مخزن الكائنات '${STORE_NAME}' والفهارس بنجاح.`);
            }
        };

        // عند نجاح فتح قاعدة البيانات
        request.onsuccess = (event) => {
            db = event.target.result; // تخزين مرجع قاعدة البيانات في المتغير العام
            console.log(`تم فتح قاعدة البيانات '${DB_NAME}' بنجاح.`);
            resolve(db); // إرجاع كائن قاعدة البيانات
        };

        // عند حدوث خطأ أثناء فتح قاعدة البيانات
        request.onerror = (event) => {
            console.error(`خطأ في فتح قاعدة البيانات '${DB_NAME}':`, event.target.error);
            reject(`فشل فتح قاعدة البيانات: ${event.target.error}`); // رفض الوعد مع رسالة خطأ
        };
    });
}

/*****************************
 * إدارة مؤشر التحميل      *
 *****************************/

/**
 * إظهار مؤشر التحميل (الغطاء الشفاف).
 */
function showLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = 'flex';
    }
}

/**
 * إخفاء مؤشر التحميل.
 */
function hideLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = 'none';
    }
}

/*****************************
 * إدارة المصادقة (تسجيل الدخول/الخروج)      *
 *****************************/

/**
 * معالجة محاولة تسجيل الدخول للمستخدم.
 * تتحقق من اسم المستخدم وكلمة المرور المشفرة.
 */
async function login() {
    showLoader(); // إظهار المؤشر قبل البدء
    try {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // التحقق من أن الحقول ليست فارغة (اختياري ولكن جيد)
        if (!username || !password) {
             alert('الرجاء إدخال اسم المستخدم وكلمة المرور.');
             hideLoader();
             return;
        }

        // تشفير كلمة المرور المدخلة باستخدام SHA-256 للمقارنة
        // تأكد من تضمين مكتبة CryptoJS في ملف HTML الخاص بك
        // <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
        const hashedPassword = CryptoJS.SHA256(password).toString();

        // بيانات المستخدمين الصالحة (يجب تخزينها بشكل آمن في بيئة الإنتاج)
        const validUsers = {
            // كلمة المرور الأصلية '123'
            admin: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
        };

        // التحقق من تطابق اسم المستخدم وكلمة المرور المشفرة
        if (validUsers[username] && validUsers[username] === hashedPassword) {
            // تخزين رمز مميز (أو علامة) في sessionStorage للإشارة إلى أن المستخدم مسجل دخوله
            sessionStorage.setItem('authToken', 'valid_user_token'); // استخدم رمزًا أكثر أمانًا في تطبيق حقيقي
            console.log('تسجيل الدخول ناجح.');
            location.reload(); // إعادة تحميل الصفحة لإظهار لوحة التحكم
        } else {
            console.warn('محاولة تسجيل دخول فاشلة للمستخدم:', username);
            alert('اسم المستخدم أو كلمة المرور غير صحيحة!');
        }
    } catch (error) {
        console.error('حدث خطأ أثناء تسجيل الدخول:', error);
        alert('فشل تسجيل الدخول: ' + error.message);
    } finally {
        hideLoader(); // إخفاء المؤشر دائمًا بعد المحاولة
    }
}

/**
 * تسجيل خروج المستخدم الحالي.
 * تقوم بمسح بيانات الجلسة وإعادة التوجيه إلى صفحة تسجيل الدخول.
 */
function logout() {
    sessionStorage.removeItem('authToken'); // مسح علامة المصادقة
    sessionStorage.clear(); // مسح جميع بيانات الجلسة (احتياطي)
    console.log('تم تسجيل الخروج.');
    // إعادة تحميل الصفحة أو التوجيه إلى صفحة تسجيل الدخول
    location.reload(); // أو location.href = 'login.html';
}


/*****************************
 * تحميل وعرض البيانات من قاعدة البيانات   *
 *****************************/

/**
 * تحميل جميع السجلات من مخزن الكائنات في IndexedDB.
 * وتحديث المصفوفات `allData` و `currentData` وعرض البيانات في القائمة.
 * كما تقوم بتحديث إجمالي المبالغ المعروضة بجانب أزرار العمارات.
 */
async function loadAllData() {
    showLoader(); // إظهار مؤشر التحميل قبل البدء
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly'); // بدء معاملة قراءة فقط
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll(); // طلب جميع السجلات

        // استخدام Promise لانتظار انتهاء الطلب
        const data = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                console.error('خطأ في قراءة جميع البيانات:', request.error);
                reject(request.error);
            };
        });

        // تخزين البيانات وتحويل الـ ID إلى رقم لضمان التناسق
        allData = data.map(item => ({ ...item, id: Number(item.id) }));
        currentData = [...allData]; // في البداية، البيانات المعروضة هي كل البيانات

        console.log(`تم تحميل ${allData.length} سجلات.`);

        updateListView(); // تحديث عرض القائمة في واجهة المستخدم
        updateAllBuildingTotals(); // تحديث مجاميع الفواتير لجميع العمارات

    } catch (error) {
        console.error('فشل تحميل البيانات من قاعدة البيانات:', error);
        alert('فشل تحميل البيانات: ' + (error.message || error));
    } finally {
        hideLoader(); // إخفاء مؤشر التحميل بعد الانتهاء (سواء نجاح أو فشل)
    }
}

/**
 * تحديث عرض إجمالي الفواتير لجميع العمارات المعروفة.
 */
function updateAllBuildingTotals() {
    // الحصول على أسماء العمارات الفريدة من البيانات أو من comboBoxData
    const uniqueBuildings = [...new Set(allData.map(item => item.building))];
    // أو إذا كنت تريد إظهارها دائمًا حتى لو كانت فارغة:
    // const uniqueBuildings = Object.keys(comboBoxData);

    uniqueBuildings.forEach(buildingName => {
        updateTotalBillDisplay(buildingName);
    });
}

/**
 * حساب وتحديث إجمالي مبلغ الفواتير لعمارة معينة وعرضه بجانب زرها.
 * @param {string} buildingName - اسم العمارة المطلوب تحديث إجماليها.
 */
function updateTotalBillDisplay(buildingName) {
    // حساب المجموع من `allData` لضمان الحصول على الإجمالي الصحيح دائمًا
    const total = allData
        .filter(item => item.building === buildingName) // تصفية حسب العمارة
        .reduce((sum, item) => {
            // تحويل `totalBill` إلى رقم قبل الجمع، مع التعامل مع القيم غير الصالحة
            const billAmount = parseFloat(item.totalBill);
            return sum + (isNaN(billAmount) ? 0 : billAmount);
        }, 0); // القيمة الأولية للمجموع هي 0

    // العثور على العنصر المخصص لعرض الإجمالي لهذه العمارة
    // نفترض أن معرف العنصر يتبع النمط 'totalBill_اسم العمارة'
    const totalBillElement = document.getElementById(`totalBill_${buildingName}`);
    if (totalBillElement) {
        // تحديث النص داخل العنصر لعرض الإجمالي المنسق
        totalBillElement.textContent = `${total.toFixed(2)} ريال`; // تنسيق الرقم ليشمل خانتين عشريتين
        console.log(`تم تحديث إجمالي العمارة '${buildingName}' إلى: ${total.toFixed(2)}`);
    } else {
        // قد يحدث هذا إذا تم حذف عمارة أو لم يكن لها عنصر عرض مخصص
         console.warn(`لم يتم العثور على عنصر لعرض إجمالي العمارة: ${buildingName}`);
    }
}


/*****************************
 * تحديث واجهة المستخدم (القائمة والنموذج)      *
 *****************************/

/**
 * تحديث محتوى قائمة السجلات في جدول HTML بناءً على البيانات في `currentData`.
 */
function updateListView() {
    const listContent = document.getElementById('listContent');
    if (!listContent) {
        console.error('عنصر #listContent غير موجود في DOM.');
        return;
    }
    listContent.innerHTML = ''; // إفراغ القائمة الحالية

    if (currentData.length === 0) {
        // عرض رسالة إذا كانت القائمة فارغة
        listContent.innerHTML = '<tr><td colspan="9" style="text-align: center;">لا توجد بيانات لعرضها.</td></tr>';
        return;
    }

    // إنشاء صف لكل سجل في `currentData`
    currentData.forEach((data) => {
        const row = document.createElement('tr');
        row.className = 'list-item'; // إضافة كلاس للتنسيق
        row.setAttribute('data-id', data.id); // تخزين ID السجل في الصف لسهولة الوصول إليه

        // تعبئة خلايا الصف ببيانات السجل
        row.innerHTML = `
            <td>${data.building || ''}</td>
            <td>${data.totalBill || ''}</td>
            <td>${data.reading || ''}</td>
            <td>${data.valueSAR || ''}</td>
            <td>${data.fromDate || ''}</td>
            <td>${data.toDate || ''}</td>
            <td>${data.paymentAmount || ''}</td>
            <td>${data.combo || ''}</td>
            <td>
                <button onclick="prepareEdit(${data.id})" class="edit-btn" aria-label="تعديل السجل ${data.id}">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button onclick="deleteEntry(${data.id})" class="delete-btn" aria-label="حذف السجل ${data.id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
        `;

        // إضافة مستمع للنقر على الصف (باستثناء الأزرار) لتعبئة النموذج للتعديل
        // (تم استبدال هذا بزر تعديل صريح لزيادة الوضوح)
        /*
        row.addEventListener('click', (event) => {
            // التأكد من أن النقر لم يكن على زر الحذف أو التعديل
            if (!event.target.closest('button')) {
                 prepareEdit(data.id);
            }
        });
        */

        listContent.appendChild(row); // إضافة الصف إلى الجدول
    });
     console.log(`تم تحديث القائمة بـ ${currentData.length} سجلات.`);
}

/**
 * إظهار نموذج الإضافة/التعديل وتعبئة عنوانه والقائمة المنسدلة للعمارة المحددة.
 * @param {string} buildingName - اسم العمارة التي سيتم العمل عليها.
 */
function showForm(buildingName) {
    // تعيين اسم العمارة الحالية وتحديث عنوان النموذج
    currentBuilding = buildingName;
    const buildingTitle = document.getElementById('buildingTitle');
    if (buildingTitle) {
        buildingTitle.textContent = `بيانات: ${buildingName}`;
    }

    // تعبئة القائمة المنسدلة (ComboBox) بالخيارات المناسبة لهذه العمارة
    populateComboBox(buildingName);

    // إظهار حاوية النموذج
    const formContainer = document.getElementById('formContainer');
    if (formContainer) {
        formContainer.style.display = 'block';
        // يمكنك إضافة كلاس لتأثيرات الانتقال إذا أردت
        // formContainer.classList.add('show');
        console.log(`تم إظهار النموذج للعمارة: ${buildingName}`);
    } else {
         console.error('حاوية النموذج #formContainer غير موجودة.');
    }

    // إعادة تمكين حقل المبلغ الكلي (قد يكون معطلاً)
    const totalBillInput = document.getElementById('totalBill');
    if (totalBillInput) {
        totalBillInput.disabled = true; // يبدأ معطلاً افتراضياً
    }

    // التركيز على أول حقل إدخال قابل للكتابة (اختياري)
    // document.getElementById('reading')?.focus(); // حقل القراءة كمثال
}

/**
 * إخفاء نموذج الإضافة/التعديل ومسح الحقول.
 */
function hideFormAndClear() {
    const formContainer = document.getElementById('formContainer');
    if (formContainer) {
        formContainer.style.display = 'none';
        // formContainer.classList.remove('show'); // إزالة كلاس التأثير إذا استخدمته
    }
    clearForm(); // مسح حقول النموذج وحالة التعديل
     console.log('تم إخفاء النموذج ومسح الحقول.');
}

/**
 * تعبئة القائمة المنسدلة (ComboBox) بالخيارات بناءً على اسم العمارة.
 * @param {string} buildingName - اسم العمارة لتحديد خيارات القائمة.
 */
function populateComboBox(buildingName) {
    const combo = document.getElementById('comboBox');
    if (!combo) {
        console.error('العنصر #comboBox غير موجود.');
        return;
    }
    combo.innerHTML = ''; // إفراغ الخيارات الحالية

    // إضافة خيار افتراضي أو توجيهي
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.text = '-- اختر --';
    defaultOption.disabled = true; // جعله غير قابل للاختيار مباشرة
    defaultOption.selected = true; // تحديد الخيار الافتراضي
    combo.add(defaultOption);


    // الحصول على الخيارات من `comboBoxData` للعمارة المحددة
    const options = comboBoxData[buildingName] || []; // استخدام مصفوفة فارغة إذا لم تكن العمارة موجودة

    if (options.length > 0) {
        options.forEach(itemText => {
            const option = document.createElement('option');
            option.value = itemText; // استخدام النص كقيمة أيضاً (أو يمكنك تخصيص قيم مختلفة)
            option.text = itemText;
            combo.add(option);
        });
         console.log(`تم تعبئة القائمة المنسدلة للعمارة '${buildingName}' بـ ${options.length} خيارات.`);
    } else {
         console.warn(`لا توجد بيانات للقائمة المنسدلة للعمارة '${buildingName}'.`);
         // يمكنك إضافة خيار يدل على عدم وجود بيانات إذا أردت
         const noDataOption = document.createElement('option');
         noDataOption.value = '';
         noDataOption.text = 'لا توجد عدادات محددة';
         noDataOption.disabled = true;
         combo.add(noDataOption);
    }
}

/**
 * مسح جميع حقول نموذج الإدخال وإعادة تعيين حالة التعديل.
 */
function clearForm() {
    // مسح قيم الحقول
    document.getElementById('totalBill').value = '';
    document.getElementById('totalBill').disabled = true; // تعطيل حقل المبلغ الكلي مجدداً
    document.getElementById('reading').value = '';
    document.getElementById('valueSAR').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('comboBox').value = ''; // إعادة تعيين القائمة المنسدلة إلى الخيار الافتراضي

    // إعادة تعيين متغيرات الحالة
    currentBuilding = ''; // مسح اسم العمارة الحالية
    editId = null;        // تعيين معرف التعديل إلى null (وضع الإضافة)

    // إعادة تعيين أي مؤشرات بصرية لوضع التعديل (إذا كانت موجودة)
    // مثلاً، تغيير نص زر الحفظ من "تحديث" إلى "إضافة"
    const submitButton = document.querySelector('#dataForm button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'إضافة سجل';
    }

    console.log('تم مسح حقول النموذج وإعادة تعيين الحالة.');
}

/**
 * تجهيز النموذج لتعديل سجل موجود.
 * يتم استدعاؤها عند النقر على زر "تعديل" في أحد الصفوف.
 * @param {number} id - معرّف السجل المراد تعديله.
 */
function prepareEdit(id) {
    console.log(`تجهيز لتعديل السجل بالمعرف: ${id}`);
    // البحث عن السجل المطلوب في `allData` باستخدام المعرف
    const dataToEdit = allData.find(item => item.id === id);

    if (!dataToEdit) {
        console.error(`السجل بالمعرف ${id} غير موجود في البيانات المحملة.`);
        alert('خطأ: السجل المحدد غير موجود!');
        return;
    }

    // إظهار النموذج وتعبئته ببيانات السجل المحدد
    showForm(dataToEdit.building); // إظهار النموذج وتعبئة القائمة المنسدلة الصحيحة

    // تعبئة حقول النموذج بالبيانات الموجودة
    document.getElementById('totalBill').value = dataToEdit.totalBill || '';
    document.getElementById('totalBill').disabled = false; // تمكين الحقل عند التعديل
    document.getElementById('reading').value = dataToEdit.reading || '';
    document.getElementById('valueSAR').value = dataToEdit.valueSAR || '';
    document.getElementById('fromDate').value = dataToEdit.fromDate || '';
    document.getElementById('toDate').value = dataToEdit.toDate || '';
    document.getElementById('paymentAmount').value = dataToEdit.paymentAmount || '';
    document.getElementById('comboBox').value = dataToEdit.combo || '';

    // تخزين معرف السجل للإشارة إلى وضع التعديل
    editId = dataToEdit.id;

    // تغيير نص زر الإرسال للإشارة إلى التحديث (اختياري)
    const submitButton = document.querySelector('#dataForm button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'تحديث السجل';
    }

    // الانتقال إلى النموذج لتسهيل التعديل (اختياري)
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' });
}


/*****************************
 * عمليات إدارة البيانات (إضافة، تعديل، حذف)   *
 *****************************/

/**
 * إضافة سجل جديد أو تحديث سجل موجود في قاعدة البيانات.
 * يتم استدعاؤها عند إرسال النموذج.
 */
async function handleDataSubmission() {
    // 1. التحقق من صحة مدخلات النموذج
    if (!validateForm()) {
        console.warn('فشل التحقق من صحة النموذج.');
        return; // إيقاف التنفيذ إذا كانت البيانات غير صالحة
    }

    showLoader(); // إظهار مؤشر التحميل

    // 2. تجميع البيانات من حقول النموذج
    const formData = {
        building: currentBuilding, // اسم العمارة تم تعيينه عند إظهار النموذج
        totalBill: document.getElementById('totalBill').value,
        reading: document.getElementById('reading').value,
        valueSAR: document.getElementById('valueSAR').value,
        fromDate: document.getElementById('fromDate').value,
        toDate: document.getElementById('toDate').value,
        paymentAmount: document.getElementById('paymentAmount').value,
        combo: document.getElementById('comboBox').value
    };

    // 3. تحديد إذا كانت العملية إضافة أو تعديل
    const isEditMode = editId !== null;
    if (isEditMode) {
        formData.id = editId; // إضافة المعرف للسجل عند التعديل
    }

    console.log(`جاري ${isEditMode ? 'تحديث' : 'إضافة'} سجل:`, formData);

    try {
        // 4. بدء معاملة للكتابة في قاعدة البيانات
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        let request;

        // 5. تنفيذ عملية الإضافة أو التحديث
        if (isEditMode) {
            request = store.put(formData); // put يضيف أو يحدّث بناءً على المفتاح
        } else {
            // التأكد من عدم وجود 'id' عند الإضافة للسماح بالتزايد التلقائي
            delete formData.id;
            request = store.add(formData); // add يضيف سجل جديد فقط
        }

        // 6. انتظار اكتمال العملية بنجاح أو فشل
        await new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log(`تم ${isEditMode ? 'تحديث' : 'إضافة'} السجل بنجاح.`);
                resolve(request.result); // يمكن أن يكون المفتاح للسجل الجديد/المحدث
            };
            request.onerror = () => {
                console.error(`خطأ في ${isEditMode ? 'تحديث' : 'إضافة'} السجل:`, request.error);
                reject(request.error);
            };
        });

        // 7. بعد النجاح: إعادة تحميل البيانات، تحديث الواجهة، وإخفاء النموذج
        await loadAllData(); // إعادة تحميل جميع البيانات لتحديث المصفوفات والواجهة
        // updateTotalBillDisplay(currentBuilding); // تحديث إجمالي العمارة المتأثرة (سيتم تحديثه ضمن loadAllData)
        hideFormAndClear(); // إخفاء النموذج ومسح الحقول
        // alert(`✅ تم ${isEditMode ? 'تحديث' : 'حفظ'} البيانات بنجاح!`); // رسالة تأكيد (اختياري)

    } catch (error) {
        console.error(`فشل ${isEditMode ? 'تحديث' : 'إضافة'} البيانات:`, error);
        alert(`❌ فشلت العملية: ${error.message || error}`);
    } finally {
        hideLoader(); // إخفاء مؤشر التحميل دائماً في النهاية
    }
}

/**
 * حذف سجل من قاعدة البيانات بناءً على المعرف.
 * @param {number} id - معرّف السجل المراد حذفه.
 */
async function deleteEntry(id) {
    // تأكيد الحذف من المستخدم
    if (!confirm(`هل أنت متأكد من حذف هذا السجل (ID: ${id})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        console.log(`تم إلغاء حذف السجل بالمعرف: ${id}`);
        return; // إيقاف التنفيذ إذا ألغى المستخدم
    }

    console.log(`بدء حذف السجل بالمعرف: ${id}`);
    showLoader(); // إظهار مؤشر التحميل

    try {
        // 1. العثور على اسم العمارة للسجل قبل الحذف لتحديث إجماليها لاحقاً
        const entryToDelete = allData.find(item => item.id === id);
        const buildingNameToUpdate = entryToDelete ? entryToDelete.building : null;

        // 2. بدء معاملة للكتابة (الحذف يعتبر كتابة)
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id); // طلب حذف السجل بالمعرف

        // 3. انتظار اكتمال عملية الحذف
        await new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log(`تم حذف السجل بالمعرف ${id} بنجاح من قاعدة البيانات.`);
                resolve();
            };
            request.onerror = () => {
                console.error(`خطأ في حذف السجل بالمعرف ${id}:`, request.error);
                reject(request.error);
            };
        });

        // 4. تحديث البيانات في الذاكرة (allData و currentData)
        allData = allData.filter(entry => entry.id !== id);
        currentData = currentData.filter(entry => entry.id !== id);

        // 5. تحديث واجهة المستخدم (القائمة والإجماليات)
        updateListView(); // إعادة رسم القائمة بالبيانات المحدثة

        if (buildingNameToUpdate) {
            updateTotalBillDisplay(buildingNameToUpdate); // تحديث إجمالي العمارة المتأثرة
        } else {
             updateAllBuildingTotals(); // إذا لم نجد العمارة، نحدث الكل كإجراء احترازي
        }


        // 6. إذا كان النموذج يعرض السجل المحذوف، قم بإخفائه
        if (editId === id) {
             hideFormAndClear();
        }

        // alert('✅ تم الحذف بنجاح.'); // رسالة تأكيد (اختياري)

    } catch (error) {
        console.error(`فشل حذف السجل بالمعرف ${id}:`, error);
        alert(`❌ فشل الحذف: ${error.message || error}`);
    } finally {
        hideLoader(); // إخفاء مؤشر التحميل دائمًا
    }
}

/*****************************
 * البحث والتصفية      *
 *****************************/

// متغير لتخزين مؤقت البحث لتجنب الاستدعاءات المتكررة السريعة
let searchTimeout;

/**
 * إجراء بحث في البيانات بناءً على مصطلح البحث المدخل.
 * البحث يشمل جميع الحقول النصية في كل سجل.
 * @param {string} searchTerm - النص المراد البحث عنه.
 */
async function searchData(searchTerm) {
    // إلغاء أي مؤقت بحث سابق إذا كان المستخدم لا يزال يكتب
    clearTimeout(searchTimeout);

    // إعداد مؤقت جديد لتأخير البحث قليلاً (مثلاً 300 مللي ثانية)
    searchTimeout = setTimeout(async () => {
        console.log(`البحث عن: "${searchTerm}"`);
        showLoader(); // إظهار المؤشر عند بدء البحث الفعلي

        const normalizedSearchTerm = searchTerm.trim().toLowerCase(); // تطبيع مصطلح البحث

        try {
            // إذا كان حقل البحث فارغًا، عرض جميع البيانات
            if (!normalizedSearchTerm) {
                currentData = [...allData]; // استخدام نسخة من allData
                console.log('عرض جميع السجلات.');
            } else {
                // تصفية `allData` بناءً على مصطلح البحث
                // البحث في جميع قيم الخصائص لكل كائن
                currentData = allData.filter(item => {
                    // تحويل قيم الكائن إلى سلسلة والبحث ضمنها
                    return Object.values(item).some(value =>
                        String(value).toLowerCase().includes(normalizedSearchTerm)
                    );
                });
                console.log(`تم العثور على ${currentData.length} سجلات مطابقة.`);
            }

            updateListView(); // تحديث عرض القائمة بالنتائج

        } catch (error) {
            console.error('حدث خطأ أثناء البحث:', error);
            alert('خطأ أثناء البحث: ' + error.message);
            // في حالة الخطأ، قد ترغب في عرض جميع البيانات أو قائمة فارغة
            currentData = [...allData];
            updateListView();
        } finally {
            hideLoader(); // إخفاء المؤشر بعد اكتمال البحث
        }
    }, 300); // تأخير 300 مللي ثانية قبل بدء البحث
}

/**
 * تصفية البيانات لعرض السجلات الخاصة بعمارة معينة فقط.
 * @param {string} buildingName - اسم العمارة المطلوب عرض سجلاتها.
 */
function filterByBuilding(buildingName) {
    console.log(`تصفية حسب العمارة: ${buildingName}`);
    showLoader(); // إظهار المؤشر

    // تصفية `allData` بناءً على اسم العمارة
    currentData = allData.filter(item => item.building === buildingName);

    updateListView(); // تحديث القائمة لعرض البيانات المصفاة
    hideLoader(); // إخفاء المؤشر
}

/**
 * إعادة تعيين عرض القائمة لعرض جميع السجلات.
 */
function resetListView() {
    console.log('إعادة تعيين عرض القائمة لعرض جميع السجلات.');
    showLoader();
    currentData = [...allData]; // استعادة جميع البيانات إلى القائمة الحالية
    document.querySelector('.search-box').value = ''; // مسح حقل البحث (اختياري)
    updateListView(); // تحديث القائمة
    hideLoader();
}


/*****************************
 * التحقق من صحة النموذج      *
 *****************************/

/**
 * التحقق من صحة البيانات المدخلة في النموذج قبل الحفظ.
 * @returns {boolean} `true` إذا كانت البيانات صالحة، و `false` بخلاف ذلك.
 */
function validateForm() {
    let isValid = true;
    const errorMessages = [];

    // جلب قيم الحقول مع إزالة المسافات الزائدة
    const totalBill = document.getElementById('totalBill').value.trim();
    const reading = document.getElementById('reading').value.trim();
    const valueSAR = document.getElementById('valueSAR').value.trim();
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const paymentAmount = document.getElementById('paymentAmount').value.trim();
    const combo = document.getElementById('comboBox').value; // لا يحتاج trim عادةً

    // 1. التحقق من الحقول المطلوبة
    if (!currentBuilding) { // التأكد من تحديد عمارة (يجب أن يكون محدداً عند فتح النموذج)
        errorMessages.push('لم يتم تحديد العمارة.');
        isValid = false;
    }
    if (!reading) {
        errorMessages.push('حقل "القراءة" مطلوب.');
        isValid = false;
    }
    // المبلغ الكلي مطلوب فقط إذا لم يكن معطلاً (أي عند الإضافة اليدوية أو التعديل)
    if (!document.getElementById('totalBill').disabled && !totalBill) {
         errorMessages.push('حقل "المبلغ الكلي للفاتورة" مطلوب.');
         isValid = false;
    }
    if (!valueSAR) {
        errorMessages.push('حقل "القيمة بالريال" مطلوب.');
        isValid = false;
    }
    if (!fromDate) {
        errorMessages.push('حقل "التاريخ من" مطلوب.');
        isValid = false;
    }
    if (!toDate) {
        errorMessages.push('حقل "التاريخ إلى" مطلوب.');
        isValid = false;
    }
    if (!paymentAmount) {
        errorMessages.push('حقل "مبلغ السداد" مطلوب.');
        isValid = false;
    }
    if (!combo) {
        errorMessages.push('يجب اختيار قيمة من قائمة "العداد".');
        isValid = false;
    }

    // 2. التحقق من أن الحقول الرقمية تحتوي على أرقام صالحة
    // نسمح بأن يكون المبلغ الكلي فارغاً إذا كان الحقل معطلاً
    if (!document.getElementById('totalBill').disabled && totalBill && isNaN(parseFloat(totalBill))) {
        errorMessages.push('حقل "المبلغ الكلي للفاتورة" يجب أن يكون رقماً.');
        isValid = false;
    }
    if (reading && isNaN(parseFloat(reading))) {
        errorMessages.push('حقل "القراءة" يجب أن يكون رقماً.');
        isValid = false;
    }
    if (valueSAR && isNaN(parseFloat(valueSAR))) {
        errorMessages.push('حقل "القيمة بالريال" يجب أن يكون رقماً.');
        isValid = false;
    }
    if (paymentAmount && isNaN(parseFloat(paymentAmount))) {
        errorMessages.push('حقل "مبلغ السداد" يجب أن يكون رقماً.');
        isValid = false;
    }

    // 3. التحقق من صحة ترتيب التواريخ
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        errorMessages.push('تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء.');
        isValid = false;
    }

    // عرض رسائل الخطأ إذا وجدت
    if (!isValid) {
        console.warn('فشل التحقق من النموذج:', errorMessages);
        alert('الرجاء تصحيح الأخطاء التالية:\n\n' + errorMessages.join('\n'));
    } else {
        console.log('التحقق من النموذج ناجح.');
    }

    return isValid;
}


/*****************************
 * وظائف مساعدة وتصدير      *
 *****************************/

/**
 * تصدير البيانات المعروضة حالياً (`currentData`) إلى ملف CSV.
 */
function exportToExcel() {
    if (currentData.length === 0) {
        alert('لا توجد بيانات لتصديرها.');
        return;
    }

    console.log(`بدء تصدير ${currentData.length} سجلات إلى CSV.`);

    // تحديد رؤوس الأعمدة (باللغة العربية لتوافق الواجهة)
    const headers = [
        "اسم العمارة",
        "المبلغ الكلي للفاتورة",
        "القراءة",
        "القيمة بالريال",
        "من تاريخ",
        "إلى تاريخ",
        "مبلغ السداد",
        "العداد/الشقة" // تعديل حسب المعنى الأدق للقائمة المنسدلة
    ];

    // تحويل بيانات كل سجل إلى صف في CSV
    const rows = currentData.map(item => [
        item.building || '',
        item.totalBill || '',
        item.reading || '',
        item.valueSAR || '',
        item.fromDate || '',
        item.toDate || '',
        item.paymentAmount || '',
        item.combo || ''
    ]);

    // إنشاء محتوى CSV: الرؤوس ثم الصفوف، مع فاصلة كفاصل بين الأعمدة وسطر جديد للصفوف
    // إضافة BOM (Byte Order Mark) لـ UTF-8 لضمان قراءة الأحرف العربية بشكل صحيح في Excel
    let csvContent = "\uFEFF"; // BOM for UTF-8
    csvContent += headers.join(",") + "\n"
                + rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")) // تغليف الحقول بعلامات اقتباس للتعامل مع الفواصل والنصوص
                      .join("\n");

    // إنشاء رابط تنزيل الملف
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    // اقتراح اسم للملف مع تاريخ ووقت التصدير (اختياري)
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
    link.setAttribute("download", `بيانات_العقارات_${timestamp}.csv`);
    link.style.visibility = 'hidden'; // إخفاء الرابط

    // إضافته للصفحة والنقر عليه برمجياً لبدء التنزيل ثم إزالته
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // تحرير الذاكرة المستخدمة بواسطة URL الكائن

    console.log('اكتمل طلب تصدير CSV.');
}


/*****************************
 * إعدادات أولية ومستمعو الأحداث      *
 *****************************/

// يتم تنفيذه بعد تحميل محتوى DOM بالكامل
document.addEventListener('DOMContentLoaded', async () => {
    console.log('تم تحميل محتوى DOM.');

    // --- إعداد مستمعي الأحداث للعناصر الثابتة ---

    // زر تسجيل الدخول
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.addEventListener('click', login);
    } else if (document.getElementById('loginContainer')) { // التحقق من وجود حاوية الدخول
        console.warn('زر تسجيل الدخول #loginButton غير موجود.');
    }


    // زر تسجيل الخروج
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // حقل البحث (مع تأخير)
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => searchData(e.target.value));
    }

    // زر تصدير إلى Excel
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportToExcel);
    }

    // زر العودة من النموذج
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', hideFormAndClear);
    }

    // زر تمكين حقل المبلغ الكلي
    const enableTotalBillButton = document.getElementById('enableTotalBill');
    const totalBillInput = document.getElementById('totalBill');
    if (enableTotalBillButton && totalBillInput) {
        enableTotalBillButton.addEventListener('click', () => {
            totalBillInput.disabled = false; // تمكين الحقل
            totalBillInput.focus();          // وضع المؤشر داخل الحقل
            console.log('تم تمكين حقل المبلغ الكلي.');
        });
    }

     // مستمع لإرسال النموذج (إضافة/تعديل)
     const dataForm = document.getElementById('dataForm');
     if (dataForm) {
         dataForm.addEventListener('submit', (event) => {
             event.preventDefault(); // منع الإرسال الافتراضي للنموذج
             handleDataSubmission(); // استدعاء دالة المعالجة المخصصة
         });
     }


    // --- التحقق من حالة المصادقة وتهيئة التطبيق ---
    showLoader(); // إظهار المؤشر أثناء التهيئة
    try {
        // التحقق من وجود رمز المصادقة في sessionStorage
        if (sessionStorage.getItem('authToken')) {
            console.log('المستخدم مصادق عليه. جاري تهيئة لوحة التحكم...');
            // إخفاء واجهة تسجيل الدخول وإظهار لوحة التحكم
            const loginContainer = document.getElementById('loginContainer');
            const dashboard = document.getElementById('dashboard');
            if (loginContainer) loginContainer.style.display = 'none';
            if (dashboard) dashboard.style.display = 'block';

            // تهيئة قاعدة البيانات
            db = await initializeDatabase();

            // تحميل البيانات الأولية وعرضها
            await loadAllData();

            // ربط أحداث النقر لأزرار العمارات (تصفية + إظهار النموذج)
             document.querySelectorAll('.building-button').forEach(button => {
                 button.addEventListener('click', () => {
                     const buildingName = button.getAttribute('data-building');
                     if (buildingName) {
                         filterByBuilding(buildingName); // تصفية القائمة
                         // قد ترغب أيضاً في إظهار النموذج مباشرة عند النقر على الزر
                         // showForm(buildingName); // قم بإلغاء التعليق إذا أردت هذا السلوك
                     }
                 });
             });

             // ربط حدث النقر لزر "إضافة سجل جديد" العام (إذا كان موجودًا)
            const addNewRecordButton = document.getElementById('addNewRecordButton'); // افترض وجود زر بهذا ID
            if (addNewRecordButton) {
                addNewRecordButton.addEventListener('click', () => {
                    // يجب أن يقرر المستخدم أي عمارة يضيف لها
                    // ربما يفتح قائمة منسدلة لاختيار العمارة ثم يظهر النموذج؟
                    // أو يكون هناك زر إضافة داخل كل قسم عمارة؟
                    // حالياً، السلوك الافتراضي هو فتح النموذج بدون تحديد عمارة (يحتاج تعديل في showForm/clearForm)
                     alert('يرجى تحديد العمارة أولاً من الأزرار أعلاه، ثم يمكنك إضافة سجل.');
                    // أو يمكنك تعديل showForm للسماح ببدء فارغ واختيار العمارة لاحقاً
                    // clearForm(); // تأكد من أن النموذج فارغ
                    // document.getElementById('formContainer').style.display = 'block';
                    // document.getElementById('buildingTitle').textContent = 'إضافة سجل جديد';
                });
            }

              // ربط حدث النقر لزر "عرض الكل"
             const showAllButton = document.getElementById('showAllButton');
             if (showAllButton) {
                 showAllButton.addEventListener('click', resetListView);
             }


        } else {
            console.log('المستخدم غير مصادق عليه. عرض صفحة تسجيل الدخول.');
            // إظهار واجهة تسجيل الدخول وإخفاء لوحة التحكم (عادةً هذا هو الوضع الافتراضي في HTML)
            const loginContainer = document.getElementById('loginContainer');
            const dashboard = document.getElementById('dashboard');
            if (loginContainer) loginContainer.style.display = 'block';
            if (dashboard) dashboard.style.display = 'none';
        }
    } catch (error) {
        console.error('فشل تهيئة التطبيق:', error);
        alert('حدث خطأ فادح أثناء تهيئة التطبيق. الرجاء المحاولة مرة أخرى لاحقاً.');
        // يمكنك عرض رسالة خطأ أكثر تفصيلاً للمستخدم هنا
    } finally {
        hideLoader(); // إخفاء مؤشر التحميل بعد اكتمال التهيئة
        console.log('اكتملت تهيئة الصفحة.');
    }
});