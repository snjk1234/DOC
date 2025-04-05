/******************************************************************************
 * المتغيرات العامة                              *
 * Global Variables                             *
 ******************************************************************************/
let selectedBuildingName = ''; // يخزن اسم العمارة المحددة حاليًا
let editingEntryId = null; // معرف السجل الذي يتم تعديله حاليًا (null يعني لا يوجد تعديل)
let isEditModeActive = false; // حالة لتحديد ما إذا كان وضع التعديل نشطًا
let databaseInstance; // المرجع الرئيسي لقاعدة بيانات IndexedDB
let allEntriesData = []; // مصفوفة لتخزين جميع السجلات من قاعدة البيانات
let currentlyDisplayedData = []; // مصفوفة لتخزين البيانات المعروضة حاليًا (بعد التصفية/البحث)

/******************************************************************************
 * ثوابت قاعدة البيانات                            *
 * Database Constants                            *
 ******************************************************************************/
const DATABASE_NAME = 'EstateDB'; // اسم قاعدة البيانات
const OBJECT_STORE_NAME = 'Buildings'; // اسم مخزن الكائنات (الجدول)
const DATABASE_VERSION = 1; // إصدار قاعدة البيانات

/******************************************************************************
 * بيانات القوائم المنسدلة                          *
 * Dropdown Data                              *
 ******************************************************************************/
// بيانات القوائم المنسدلة لكل عمارة بناءً على اسمها
const buildingDropdownOptions = {
    'العمارة الكبيرة 30058543307': ['البدروم عدد2', 'شقة 4 عدد1', 'شقق 22/23/ عليها2', 'الخدمات بدون عداد'],
    'عمارة سلطانة 10075126558': ['شقة رقم 10 عدد 1', 'خدمات +عمال ريان بدون'],
    'عمارة المنارات 30059069267': ['يوجد عداد خدمات لحاله', 'عدد 4 شقق ب4 عدادات'],
    'عمارة السيل 30059012783': ['شقة 4 مع الخدمات بدون عداد'],
    'عمارة المكتب القديم 10074768485': ['5 محلات تجارية بعدادات', 'محل رقم 6 غير مؤجر', 'البدروم عدد3 اتفاق بينهم', 'شقة رقم 3 عداد تجاري+خدمات'],
    'عمارة التجارية 30059069178': ['العمارة التجارية 30059069178'],
    'الاستراحة1': ['سلطان', 'عادل الزهراني', 'الافغانية', 'سعد رضا', 'المصري', 'عبد المحسن', 'ابوريان', 'الحدادين', 'استراحة المسبح'],
    'الاستراحة2': ['الاستراحة2 ']
};

/******************************************************************************
 * تهيئة قاعدة البيانات                             *
 * Initialize Database                             *
 ******************************************************************************/
/**
 * تهيئة وفتح اتصال بقاعدة بيانات IndexedDB.
 * Initializes and opens a connection to the IndexedDB database.
 * @returns {Promise<IDBDatabase>} وعد يتم حله مع كائن قاعدة البيانات عند النجاح.
 */
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // طلب فتح قاعدة البيانات بالإصدار المحدد
        const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        // يتم استدعاؤه عند الحاجة لترقية بنية قاعدة البيانات (إنشاء مخزن الكائنات والفهارس)
        openRequest.onupgradeneeded = (event) => {
            const db = event.target.result;
            // التحقق مما إذا كان مخزن الكائنات موجودًا بالفعل
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                // إنشاء مخزن الكائنات مع مفتاح أساسي يتزايد تلقائيًا
                const store = db.createObjectStore(OBJECT_STORE_NAME, {
                    keyPath: 'id', // تحديد 'id' كمفتاح أساسي
                    autoIncrement: true // تفعيل التزايد التلقائي للمفتاح
                });
                // إنشاء فهارس للحقول لتسريع عمليات البحث والتصفية
                store.createIndex('building', 'building', { unique: false });
                store.createIndex('totalBill', 'totalBill', { unique: false });
                store.createIndex('reading', 'reading', { unique: false });
                store.createIndex('valueSAR', 'valueSAR', { unique: false });
                store.createIndex('fromDate', 'fromDate', { unique: false });
                store.createIndex('toDate', 'toDate', { unique: false });
                store.createIndex('paymentAmount', 'paymentAmount', { unique: false });
                store.createIndex('combo', 'combo', { unique: false });
                console.log('تم إنشاء مخزن الكائنات والفهارس بنجاح.');
            }
        };

        // يتم استدعاؤه عند نجاح فتح قاعدة البيانات
        openRequest.onsuccess = (event) => {
            databaseInstance = event.target.result; // تخزين مرجع قاعدة البيانات
            console.log('تم الاتصال بقاعدة البيانات بنجاح.');
            resolve(databaseInstance); // حل الوعد مع كائن قاعدة البيانات
        };

        // يتم استدعاؤه عند حدوث خطأ أثناء فتح قاعدة البيانات
        openRequest.onerror = (event) => {
            console.error('خطأ في فتح قاعدة البيانات:', event.target.error);
            reject(event.target.error); // رفض الوعد مع الخطأ
        };
    });
}

/******************************************************************************
 * إدارة واجهة المستخدم (UI)                       *
 * UI Management                              *
 ******************************************************************************/

/**
 * إظهار مؤشر التحميل العام.
 * Shows the global loading indicator.
 */
function showGlobalLoader() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

/**
 * إخفاء مؤشر التحميل العام.
 * Hides the global loading indicator.
 */
function hideGlobalLoader() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

/**
 * إظهار نموذج الإدخال/التعديل لمبنى معين.
 * Shows the input/edit form for a specific building.
 * @param {string} buildingName - اسم العمارة المراد عرض نموذجها.
 */
function displayInputForm(buildingName) {
    selectedBuildingName = buildingName; // تحديث اسم العمارة المحددة
    document.getElementById('buildingTitle').textContent = buildingName; // تحديث عنوان النموذج

    const formContainer = document.getElementById('formContainer');
    formContainer.classList.add('show'); // إضافة كلاس لإظهار النموذج (يمكن استخدامه للتحريك)
    formContainer.style.display = 'block'; // إظهار عنصر النموذج

    populateBuildingDropdown(buildingName); // ملء القائمة المنسدلة بالخيارات المناسبة للعمارة
    clearInputFormFields(); // مسح الحقول قبل عرض النموذج (خاصة إذا كان نموذجًا جديدًا)
    document.getElementById('totalBill').disabled = true; // تعطيل حقل المبلغ الكلي مبدئيًا
}

/**
 * إخفاء نموذج الإدخال/التعديل.
 * Hides the input/edit form.
 */
function hideInputForm() {
    clearInputFormFields(); // مسح الحقول عند الإخفاء
    document.getElementById('formContainer').style.display = 'none'; // إخفاء عنصر النموذج
    document.getElementById('formContainer').classList.remove('show'); // إزالة كلاس الإظهار
    resetEditState(); // إعادة تعيين حالة التعديل
}

/**
 * مسح جميع حقول نموذج الإدخال/التعديل.
 * Clears all fields in the input/edit form.
 */
function clearInputFormFields() {
    document.getElementById('totalBill').value = '';
    document.getElementById('totalBill').disabled = true; // إعادة تعطيل حقل المبلغ الكلي
    document.getElementById('reading').value = '';
    document.getElementById('valueSAR').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('comboBox').value = ''; // إفراغ القائمة المنسدلة أيضًا
}

/**
 * ملء القائمة المنسدلة (ComboBox) بالخيارات المناسبة للعمارة المحددة.
 * Populates the dropdown (ComboBox) with options relevant to the selected building.
 * @param {string} buildingName - اسم العمارة.
 */
function populateBuildingDropdown(buildingName) {
    const comboBox = document.getElementById('comboBox');
    comboBox.innerHTML = ''; // إفراغ الخيارات الحالية
    // التحقق مما إذا كانت هناك خيارات محددة لهذه العمارة
    if (buildingDropdownOptions[buildingName]) {
        // إضافة كل خيار إلى القائمة المنسدلة
        buildingDropdownOptions[buildingName].forEach(itemText => {
            const option = document.createElement('option');
            option.text = itemText;
            option.value = itemText; // تعيين القيمة أيضًا
            comboBox.add(option);
        });
    } else {
        // إضافة خيار افتراضي إذا لم تكن هناك خيارات محددة
        const defaultOption = document.createElement('option');
        defaultOption.text = 'لا توجد خيارات متاحة';
        defaultOption.value = '';
        comboBox.add(defaultOption);
    }
}

/**
 * تحديث عرض القائمة (ListView) بالبيانات الحالية.
 * Updates the list view with the current data.
 */
function updateListViewDisplay() {
    const listContentBody = document.getElementById('listContent');
    listContentBody.innerHTML = ''; // إفراغ محتوى القائمة الحالي

    // التحقق مما إذا كانت هناك بيانات لعرضها
    if (!currentlyDisplayedData || currentlyDisplayedData.length === 0) {
        // عرض رسالة في حالة عدم وجود بيانات
        const noDataRow = listContentBody.insertRow();
        const noDataCell = noDataRow.insertCell();
        noDataCell.colSpan = 9; // دمج الأعمدة لعرض الرسالة
        noDataCell.textContent = 'لا توجد بيانات لعرضها.';
        noDataCell.style.textAlign = 'center';
        noDataCell.style.padding = '20px';
        return;
    }

    // إنشاء صف لكل سجل في البيانات الحالية
    currentlyDisplayedData.forEach((entryData) => {
        const row = listContentBody.insertRow(); // إنشاء صف جديد في الجدول
        row.className = 'list-item'; // إضافة كلاس للتنسيق
        row.setAttribute('data-id', entryData.id); // تخزين معرف السجل في الصف للوصول إليه لاحقًا

        // إضافة خلايا البيانات لكل عمود
        row.insertCell().textContent = entryData.building || 'غير متوفر';
        row.insertCell().textContent = entryData.totalBill || '0';
        row.insertCell().textContent = entryData.reading || '0';
        row.insertCell().textContent = entryData.valueSAR || '0';
        row.insertCell().textContent = entryData.fromDate || 'غير محدد';
        row.insertCell().textContent = entryData.toDate || 'غير محدد';
        row.insertCell().textContent = entryData.paymentAmount || '0';
        row.insertCell().textContent = entryData.combo || 'غير محدد';

        // إضافة خلية لأزرار الإجراءات (حذف وتعديل)
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button onclick="prepareEditEntry(${entryData.id})" class="edit-btn" title="تعديل السجل">
                <i class="fas fa-edit"></i> تعديل
            </button>
            <button onclick="requestDeleteEntry(${entryData.id})" class="delete-btn" title="حذف السجل">
                <i class="fas fa-trash"></i> حذف
            </button>
        `;

        // إضافة مستمع حدث النقر على الصف (باستثناء أزرار الإجراءات) لعرض النموذج للتعديل
        row.addEventListener('click', (event) => {
            // منع تفعيل التعديل عند النقر على أزرار الحذف أو التعديل مباشرة
            if (event.target.closest('.delete-btn') || event.target.closest('.edit-btn')) {
                return;
            }
            prepareEditEntry(entryData.id);
        });
    });
}


/**
 * تحديث عرض المبلغ الإجمالي بجانب زر العمارة المحدد.
 * Updates the total bill display next to the specified building button.
 * @param {string} buildingName - اسم العمارة.
 */
function updateTotalBillDisplayForBuilding(buildingName) {
    // حساب المبلغ الإجمالي من جميع السجلات لهذه العمارة
    const total = allEntriesData
        .filter(item => item.building === buildingName) // تصفية السجلات حسب اسم العمارة
        .reduce((sum, item) => sum + parseFloat(item.totalBill || 0), 0); // جمع المبالغ

    // العثور على عنصر عرض المبلغ الخاص بالعمارة
    const totalBillElement = document.getElementById(`totalBill_${buildingName}`);
    if (totalBillElement) {
        // تحديث النص لعرض المبلغ الإجمالي المنسق
        totalBillElement.textContent = `${total.toFixed(2)} ريال`; // عرض المبلغ مع خانتين عشريتين
    }
}

/**
 * تحديث عرض المبالغ الإجمالية لجميع أزرار العمارات.
 * Updates the total bill display for all building buttons.
 */
function updateAllBuildingTotalDisplays() {
    // الحصول على قائمة بأسماء العمارات الفريدة من جميع السجلات
    const uniqueBuildingNames = [...new Set(allEntriesData.map(item => item.building))];
    // تحديث عرض المبلغ لكل عمارة
    uniqueBuildingNames.forEach(buildingName => {
        updateTotalBillDisplayForBuilding(buildingName);
    });
}

/******************************************************************************
 * عمليات قاعدة البيانات (CRUD)                         *
 * Database Operations (CRUD)                       *
 ******************************************************************************/

/**
 * تحميل جميع السجلات من قاعدة البيانات وتحديث الواجهة.
 * Loads all entries from the database and updates the UI.
 */
async function loadAllEntries() {
    try {
        showGlobalLoader(); // إظهار مؤشر التحميل قبل بدء العملية
        if (!databaseInstance) {
            throw new Error('قاعدة البيانات غير مهيأة.');
        }
        // بدء معاملة قراءة فقط
        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], 'readonly');
        const store = transaction.objectStore(OBJECT_STORE_NAME);
        const getAllRequest = store.getAll(); // طلب جلب جميع السجلات

        // انتظار نتيجة الطلب
        const data = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        // تخزين البيانات وتحويل الـ ID إلى رقم لضمان التناسق
        allEntriesData = data.map(item => ({ ...item, id: Number(item.id) }));
        currentlyDisplayedData = [...allEntriesData]; // عرض جميع البيانات مبدئيًا

        updateListViewDisplay(); // تحديث عرض القائمة
        updateAllBuildingTotalDisplays(); // تحديث المبالغ الإجمالية بجانب الأزرار

        console.log('تم تحميل جميع السجلات بنجاح.');

    } catch (error) {
        console.error('فشل تحميل البيانات:', error);
        alert('فشل تحميل البيانات: ' + error.message);
    } finally {
        hideGlobalLoader(); // إخفاء مؤشر التحميل بعد انتهاء العملية (نجاح أو فشل)
    }
}

/**
 * إضافة سجل جديد أو تعديل سجل موجود في قاعدة البيانات.
 * Adds a new entry or updates an existing one in the database.
 */
async function saveOrUpdateEntry() {
    // التحقق من صحة البيانات في النموذج أولاً
    if (!validateInputForm()) return; // الخروج إذا كانت البيانات غير صالحة

    try {
        showGlobalLoader(); // إظهار مؤشر التحميل

        // جمع البيانات من حقول النموذج
        const entryData = {
            building: selectedBuildingName, // استخدام اسم العمارة المحدد
            totalBill: document.getElementById('totalBill').value,
            reading: document.getElementById('reading').value,
            valueSAR: document.getElementById('valueSAR').value,
            fromDate: document.getElementById('fromDate').value,
            toDate: document.getElementById('toDate').value,
            paymentAmount: document.getElementById('paymentAmount').value,
            combo: document.getElementById('comboBox').value
        };

        // بدء معاملة قراءة وكتابة
        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(OBJECT_STORE_NAME);
        let request;

        // تحديد ما إذا كان يجب إضافة سجل جديد أو تحديث سجل موجود
        if (isEditModeActive && editingEntryId !== null) {
            entryData.id = editingEntryId; // إضافة المعرف للسجل لتحديثه
            request = store.put(entryData); // استخدام put للتحديث (أو الإضافة إذا لم يكن موجودًا)
            console.log(`جاري تحديث السجل بالمعرف: ${editingEntryId}`);
        } else {
            request = store.add(entryData); // استخدام add لإضافة سجل جديد
            console.log('جاري إضافة سجل جديد.');
        }

        // انتظار نتيجة عملية الحفظ/التحديث
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        console.log('تمت عملية الحفظ/التحديث بنجاح.');

        // إعادة تحميل جميع البيانات لتحديث الواجهة بالكامل
        await loadAllEntries();
        // تحديث عرض المبلغ الإجمالي للعمارة المتأثرة
        updateTotalBillDisplayForBuilding(selectedBuildingName);
        hideInputForm(); // إخفاء النموذج بعد الحفظ/التحديث

    } catch (error) {
        console.error('فشلت عملية الحفظ/التحديث:', error);
        alert('حدث خطأ أثناء الحفظ أو التحديث: ' + error.message);
        hideGlobalLoader(); // التأكد من إخفاء المؤشر في حالة الخطأ
    } finally {
        // لا حاجة لإخفاء المؤشر هنا لأنه يتم في hideInputForm أو في catch
        resetEditState(); // إعادة تعيين حالة التعديل دائمًا
    }
}

/**
 * طلب تأكيد وحذف سجل من قاعدة البيانات.
 * Requests confirmation and deletes an entry from the database.
 * @param {number} entryId - معرف السجل المراد حذفه.
 */
async function requestDeleteEntry(entryId) {
    const idToDelete = Number(entryId); // التأكد من أن المعرف رقم
    if (isNaN(idToDelete)) {
        console.error('معرف غير صالح للحذف:', entryId);
        alert('حدث خطأ: معرف السجل غير صالح.');
        return;
    }

    // طلب تأكيد من المستخدم قبل الحذف
    if (!confirm(`هل أنت متأكد من حذف هذا السجل (ID: ${idToDelete})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        return; // الخروج إذا ألغى المستخدم
    }

    try {
        showGlobalLoader(); // إظهار مؤشر التحميل

        // بدء معاملة قراءة وكتابة
        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(OBJECT_STORE_NAME);

        // العثور على السجل قبل الحذف لتحديث الإجمالي لاحقًا
        const entryToDelete = allEntriesData.find(entry => entry.id === idToDelete);
        const buildingNameToUpdate = entryToDelete ? entryToDelete.building : null;

        // طلب حذف السجل باستخدام المعرف
        const deleteRequest = store.delete(idToDelete);

        // انتظار نتيجة عملية الحذف
        await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        });

        console.log(`تم حذف السجل بالمعرف: ${idToDelete} بنجاح.`);
        // alert('✅ تم الحذف بنجاح'); // يمكن تفعيل هذه الرسالة إذا رغبت

        // تحديث البيانات المحلية والواجهة
        allEntriesData = allEntriesData.filter(entry => entry.id !== idToDelete);
        currentlyDisplayedData = currentlyDisplayedData.filter(entry => entry.id !== idToDelete);
        updateListViewDisplay(); // تحديث عرض القائمة

        // تحديث المبلغ الإجمالي للعمارة التي تم حذف السجل منها
        if (buildingNameToUpdate) {
            updateTotalBillDisplayForBuilding(buildingNameToUpdate);
        }

        // إذا كان السجل المحذوف هو الذي يتم تعديله حاليًا، قم بإخفاء النموذج
        if (isEditModeActive && editingEntryId === idToDelete) {
            hideInputForm();
        }

    } catch (error) {
        console.error('فشل حذف السجل:', error);
        alert('❌ فشل الحذف: ' + error.message);
    } finally {
        hideGlobalLoader(); // إخفاء مؤشر التحميل
    }
}

/**
 * البحث عن السجلات التي تطابق مصطلح البحث في أي حقل.
 * Searches for entries matching the search term in any field.
 * @param {string} searchTerm - النص المراد البحث عنه.
 */
async function searchEntries(searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim(); // تحويل مصطلح البحث إلى أحرف صغيرة وإزالة المسافات

    // إذا كان مربع البحث فارغًا، عرض جميع البيانات
    if (!lowerCaseSearchTerm) {
        currentlyDisplayedData = [...allEntriesData];
        updateListViewDisplay();
        return;
    }

    try {
        showGlobalLoader(); // إظهار مؤشر التحميل أثناء البحث

        // تصفية البيانات المحلية بناءً على مصطلح البحث
        currentlyDisplayedData = allEntriesData.filter(entry => {
            // التحقق من تطابق مصطلح البحث مع أي قيمة في حقول السجل
            return Object.values(entry).some(value =>
                String(value).toLowerCase().includes(lowerCaseSearchTerm)
            );
        });

        updateListViewDisplay(); // تحديث عرض القائمة بالنتائج المصفاة

    } catch (error) {
        console.error('خطأ أثناء البحث:', error);
        alert('حدث خطأ أثناء البحث.');
        // في حالة الخطأ، يمكن اختيار عرض جميع البيانات أو ترك القائمة فارغة
        currentlyDisplayedData = [...allEntriesData];
        updateListViewDisplay();
    } finally {
        hideGlobalLoader(); // إخفاء مؤشر التحميل
    }
}


/******************************************************************************
 * إدارة الحالة                                 *
 * State Management                             *
 ******************************************************************************/

/**
 * تهيئة النموذج لعملية التعديل بناءً على معرف السجل.
 * Prepares the form for editing based on the entry ID.
 * @param {number} entryId - معرف السجل المراد تعديله.
 */
function prepareEditEntry(entryId) {
    const idToEdit = Number(entryId);
    // البحث عن السجل المطلوب في البيانات المحملة
    const entryData = allEntriesData.find(item => item.id === idToEdit);

    if (!entryData) {
        console.error(`لم يتم العثور على سجل بالمعرف: ${idToEdit}`);
        alert('تعذر العثور على السجل المحدد للتعديل.');
        return;
    }

    // عرض النموذج وملء الحقول ببيانات السجل المحدد
    displayInputForm(entryData.building); // عرض النموذج للعمارة الصحيحة

    document.getElementById('totalBill').value = entryData.totalBill || '';
    document.getElementById('totalBill').disabled = false; // تمكين حقل المبلغ الكلي عند التعديل
    document.getElementById('reading').value = entryData.reading || '';
    document.getElementById('valueSAR').value = entryData.valueSAR || '';
    document.getElementById('fromDate').value = entryData.fromDate || '';
    document.getElementById('toDate').value = entryData.toDate || '';
    document.getElementById('paymentAmount').value = entryData.paymentAmount || '';
    document.getElementById('comboBox').value = entryData.combo || ''; // تحديد الخيار الصحيح في القائمة المنسدلة

    // تفعيل وضع التعديل وتخزين معرف السجل
    isEditModeActive = true;
    editingEntryId = idToEdit; // استخدام المعرف الرقمي

    console.log(`تم تجهيز النموذج لتعديل السجل بالمعرف: ${idToEdit}`);
}

/**
 * إعادة تعيين حالة التعديل.
 * Resets the edit mode state.
 */
function resetEditState() {
    isEditModeActive = false;
    editingEntryId = null;
    selectedBuildingName = ''; // إعادة تعيين اسم العمارة المحدد أيضًا
    console.log('تم إعادة تعيين حالة التعديل.');
}

/******************************************************************************
 * التحقق من الصحة                              *
 * Validation                                *
 ******************************************************************************/

/**
 * التحقق من صحة البيانات المدخلة في النموذج.
 * Validates the data entered in the form.
 * @returns {boolean} - `true` إذا كانت البيانات صالحة، وإلا `false`.
 */
function validateInputForm() {
    // جلب قيم الحقول
    const totalBill = document.getElementById('totalBill').value.trim();
    const reading = document.getElementById('reading').value.trim();
    const valueSAR = document.getElementById('valueSAR').value.trim();
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const paymentAmount = document.getElementById('paymentAmount').value.trim();
    const combo = document.getElementById('comboBox').value;

    // قائمة الحقول المطلوبة مع أسمائها العربية للرسائل
    const requiredFields = [
        { value: totalBill, name: 'المبلغ الكلي للفاتورة' },
        { value: reading, name: 'القراءة' },
        { value: valueSAR, name: 'القيمة بالريال' },
        { value: fromDate, name: 'الفترة من' },
        { value: toDate, name: 'الفترة إلى' },
        { value: paymentAmount, name: 'مبلغ السداد' },
        { value: combo, name: 'العداد التجاري' } // التأكد من اختيار قيمة من القائمة
    ];

    // التحقق من الحقول الفارغة
    const emptyFields = requiredFields.filter(field => !field.value);
    if (emptyFields.length > 0) {
        const errorMessage = '❗ الحقول التالية مطلوبة:\n' +
                             emptyFields.map(field => `- ${field.name}`).join('\n');
        alert(errorMessage);
        return false; // إيقاف العملية إذا كانت هناك حقول فارغة
    }

    // التحقق من أن الحقول الرقمية تحتوي على أرقام صالحة
    const numericFields = [
        { value: totalBill, name: 'المبلغ الكلي للفاتورة' },
        { value: reading, name: 'القراءة' },
        { value: valueSAR, name: 'القيمة بالريال' },
        { value: paymentAmount, name: 'مبلغ السداد' }
    ];

    const invalidNumericFields = numericFields.filter(field => isNaN(parseFloat(field.value)));
    if (invalidNumericFields.length > 0) {
        const errorMessage = '❌ الحقول التالية يجب أن تحتوي على أرقام صالحة:\n' +
                             invalidNumericFields.map(field => `- ${field.name}`).join('\n');
        alert(errorMessage);
        return false; // إيقاف العملية إذا كانت هناك أرقام غير صالحة
    }

    // التحقق من صحة التواريخ (تاريخ البداية يجب أن يكون قبل أو نفس تاريخ النهاية)
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        alert('⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.');
        return false; // إيقاف العملية إذا كان ترتيب التواريخ غير صحيح
    }

    // إذا وصلت إلى هنا، فالبيانات صالحة
    return true;
}

/******************************************************************************
 * المصادقة                                 *
 * Authentication                             *
 ******************************************************************************/

/**
 * محاولة تسجيل دخول المستخدم.
 * Attempts to log in the user.
 */
async function attemptLogin() {
    try {
        showGlobalLoader(); // إظهار المؤشر قبل التحقق
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        // التحقق من عدم ترك الحقول فارغة
        if (!usernameInput || !passwordInput) {
            alert('الرجاء إدخال اسم المستخدم وكلمة المرور.');
            hideGlobalLoader();
            return;
        }

        // تشفير كلمة المرور المدخلة باستخدام SHA-256 للمقارنة الآمنة
        const hashedPasswordInput = CryptoJS.SHA256(passwordInput).toString();

        // بيانات المستخدمين الصالحة (يجب تخزينها بشكل آمن في بيئة الإنتاج)
        // كلمة المرور '123' مشفرة بـ SHA-256
        const validUsersCredentials = {
            admin: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
        };

        // التحقق مما إذا كان اسم المستخدم موجودًا وكلمة المرور المشفرة متطابقة
        if (validUsersCredentials[usernameInput] && validUsersCredentials[usernameInput] === hashedPasswordInput) {
            console.log('تسجيل الدخول ناجح.');
            // تخزين توكن أو علامة في sessionStorage للإشارة إلى أن المستخدم مسجل دخوله
            sessionStorage.setItem('authToken', 'user_is_authenticated'); // استخدام قيمة بسيطة أو توكن حقيقي
            // إعادة تحميل الصفحة لإظهار لوحة التحكم وتطبيق التغييرات
            location.reload();
        } else {
            console.warn('محاولة تسجيل دخول فاشلة.');
            alert('بيانات الدخول غير صحيحة!');
            hideGlobalLoader(); // إخفاء المؤشر في حالة فشل تسجيل الدخول
        }
    } catch (error) {
        console.error('حدث خطأ أثناء محاولة تسجيل الدخول:', error);
        alert('فشل تسجيل الدخول: ' + error.message);
        hideGlobalLoader(); // إخفاء المؤشر في حالة حدوث خطأ غير متوقع
    }
    // لا حاجة لإخفاء المؤشر هنا لأنه يتم إخفاؤه في حالات الفشل أو عند إعادة التحميل
}

/**
 * تسجيل خروج المستخدم.
 * Logs out the current user.
 */
function logoutUser() {
    sessionStorage.clear(); // مسح جميع بيانات الجلسة (بما في ذلك التوكن)
    // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول أو الصفحة الرئيسية
    // location.href = 'login.html'; // أو index.html إذا كانت هي صفحة البداية
    location.reload(); // إعادة التحميل سيعيد المستخدم لواجهة الدخول لأن التوكن غير موجود
    console.log('تم تسجيل الخروج.');
}

/******************************************************************************
 * وظائف مساعدة أخرى                             *
 * Helper Functions                              *
 ******************************************************************************/

/**
 * إعادة تعيين عرض القائمة لعرض جميع السجلات.
 * Resets the list view to display all entries.
 */
function resetListViewToAllEntries() {
    currentlyDisplayedData = [...allEntriesData]; // استعادة جميع البيانات للعرض
    updateListViewDisplay(); // تحديث الواجهة
    document.querySelector('.search-box').value = ''; // مسح مربع البحث
    console.log('تمت إعادة تعيين القائمة لعرض جميع السجلات.');
}

/**
 * تصفية عرض القائمة لعرض سجلات عمارة معينة فقط.
 * Filters the list view to show entries for a specific building only.
 * @param {string} buildingName - اسم العمارة المراد تصفية السجلات بها.
 */
function filterListViewByBuilding(buildingName) {
    currentlyDisplayedData = allEntriesData.filter(item => item.building === buildingName);
    updateListViewDisplay();
    console.log(`تم تصفية القائمة لعرض سجلات: ${buildingName}`);
}

/**
 * تصدير البيانات المعروضة حاليًا إلى ملف CSV.
 * Exports the currently displayed data to a CSV file.
 */
function exportCurrentDataToExcel() {
    if (currentlyDisplayedData.length === 0) {
        alert('لا توجد بيانات لتصديرها.');
        return;
    }

    // تحديد رؤوس الأعمدة باللغة العربية
    const headers = ["اسم العمارة", "المبلغ الكلي", "القراءة", "القيمة بالريال", "التاريخ من", "التاريخ إلى", "مبلغ السداد", "العداد التجاري"];
    // تحويل بيانات كل سجل إلى صف في CSV
    const rows = currentlyDisplayedData.map(item => [
        `"${item.building || ''}"`, // إضافة علامات اقتباس للتعامل مع الفواصل المحتملة
        item.totalBill || 0,
        item.reading || 0,
        item.valueSAR || 0,
        item.fromDate || '',
        item.toDate || '',
        item.paymentAmount || 0,
        `"${item.combo || ''}"`
    ]);

    // إنشاء محتوى CSV
    // استخدام فاصلة منقوطة (;) قد يكون أفضل للتوافق مع Excel في بعض الإعدادات الإقليمية العربية
    const csvContent = "data:text/csv;charset=utf-8," +
                       headers.join(";") + "\n" + // استخدام فاصلة منقوطة
                       rows.map(row => row.join(";")).join("\n"); // استخدام فاصلة منقوطة

    // إنشاء رابط تنزيل وهمي والنقر عليه
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "بيانات_العقارات.csv"); // اسم ملف التنزيل
    document.body.appendChild(link); // ضروري لبعض المتصفحات
    link.click();
    document.body.removeChild(link); // إزالة الرابط بعد النقر

    console.log('تم تصدير البيانات إلى ملف CSV.');
}

/******************************************************************************
 * إعدادات ومستمعي الأحداث                           *
 * Setup and Event Listeners                          *
 ******************************************************************************/
// متغير لتأخير البحث أثناء الكتابة
let searchDebounceTimer;

document.addEventListener('DOMContentLoaded', async () => {
    // التحقق مما إذا كان المستخدم مسجل دخوله عند تحميل الصفحة
    if (sessionStorage.getItem('authToken') === 'user_is_authenticated') {
        try {
            showGlobalLoader(); // إظهار المؤشر أثناء التهيئة
            // إخفاء واجهة الدخول وإظهار لوحة التحكم
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';

            // تهيئة قاعدة البيانات أولاً
            databaseInstance = await initializeDatabase();

            // ثم تحميل البيانات وعرضها
            await loadAllEntries();

            // ربط الأحداث بعناصر الواجهة
            setupEventListeners();

        } catch (error) {
            console.error('فشل تهيئة التطبيق بعد تسجيل الدخول:', error);
            alert('تعذر تهيئة التطبيق بشكل صحيح. قد تحتاج إلى إعادة تسجيل الدخول.');
            // يمكن إضافة منطق لإعادة المستخدم لصفحة الدخول هنا
            logoutUser(); // تسجيل الخروج في حالة فشل التهيئة
        } finally {
            hideGlobalLoader(); // إخفاء المؤشر دائمًا بعد محاولة التهيئة
        }
    } else {
        // إذا لم يكن المستخدم مسجل دخوله، تأكد من إظهار واجهة الدخول فقط
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        // ربط حدث زر الدخول
        const loginButton = document.querySelector('#loginContainer button');
        if (loginButton) {
            loginButton.addEventListener('click', attemptLogin);
        }
        // ربط حدث الضغط على Enter في حقل كلمة المرور
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    attemptLogin();
                }
            });
        }
        console.log('المستخدم غير مسجل دخوله، تم عرض واجهة الدخول.');
    }
});

/**
 * إعداد جميع مستمعي الأحداث لعناصر واجهة المستخدم في لوحة التحكم.
 * Sets up all event listeners for UI elements in the dashboard.
 */
function setupEventListeners() {
    // زر تمكين حقل المبلغ الكلي
    const enableTotalBillButton = document.getElementById('enableTotalBill');
    if (enableTotalBillButton) {
        enableTotalBillButton.addEventListener('click', () => {
            const totalBillInput = document.getElementById('totalBill');
            totalBillInput.disabled = false; // تمكين الحقل
            totalBillInput.focus(); // وضع المؤشر داخل الحقل
        });
    }

    // أزرار العمارات (لإظهار النموذج والتصفية)
    const buildingButtons = document.querySelectorAll('.building-buttons .bttn');
    buildingButtons.forEach(button => {
        // استخلاص اسم العمارة من النص أو من خاصية مخصصة إذا أضفتها
        // نفترض أن النص يحتوي فقط على اسم العمارة أو يمكن تعديل هذا
        const buildingName = button.textContent.trim().split('\n')[0].trim(); // محاولة استخلاص الاسم
        if (buildingName) {
            // حدث النقر على الزر الرئيسي لإظهار النموذج
            button.addEventListener('click', () => displayInputForm(buildingName));

            // حدث النقر على عنصر span لعرض الإجمالي (للتصفية)
            const totalSpan = button.querySelector('.total-bill-display');
            if (totalSpan) {
                totalSpan.addEventListener('click', (event) => {
                    event.stopPropagation(); // منع ظهور النموذج عند النقر على الإجمالي
                    filterListViewByBuilding(buildingName);
                });
            }
        } else {
            console.warn('لم يتم العثور على اسم عمارة صالح للزر:', button);
        }
    });

    // مربع البحث (مع تأخير debounce)
    const searchInput = document.querySelector('.search-box');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer); // إلغاء المؤقت السابق
            // بدء مؤقت جديد لتنفيذ البحث بعد فترة قصيرة من التوقف عن الكتابة
            searchDebounceTimer = setTimeout(() => {
                searchEntries(e.target.value);
            }, 300); // تأخير 300 مللي ثانية
        });
    }

    // زر تسجيل الخروج
    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logoutUser);
    }

    // أزرار نموذج الإدخال/التعديل
    const saveButton = document.querySelector('#formContainer button:nth-of-type(1)'); // زر الحفظ
    if (saveButton) {
        saveButton.addEventListener('click', saveOrUpdateEntry);
    }

    const viewAllButton = document.querySelector('#formContainer button:nth-of-type(2)'); // زر عرض الكل
    if (viewAllButton) {
        viewAllButton.addEventListener('click', resetListViewToAllEntries);
    }

    // يمكن إضافة زر للرجوع أو الإلغاء هنا إذا أضفته في HTML
    // مثال:
    // const backButton = document.getElementById('backButton');
    // if (backButton) {
    //     backButton.addEventListener('click', hideInputForm);
    // }

    // زر تصدير إلى Excel (إذا أضفته)
    const exportButton = document.getElementById('exportButton'); // افترض أن لديك زر بهذا الـ ID
    if (exportButton) {
        exportButton.addEventListener('click', exportCurrentDataToExcel);
    }

    console.log('تم إعداد مستمعي الأحداث.');
}

// تحذير قبل مغادرة الصفحة إذا كانت هناك تغييرات غير محفوظة (اختياري)
// window.onbeforeunload = function() {
//     // يمكن إضافة منطق للتحقق مما إذا كان النموذج مفتوحًا وبه تغييرات
//     if (isEditModeActive) { // مثال بسيط
//         return 'لديك تغييرات غير محفوظة في النموذج. هل أنت متأكد من المغادرة؟';
//     }
// };
