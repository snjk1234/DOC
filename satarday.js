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
let searchDebounceTimer; // مؤقت لتأخير البحث أثناء الكتابة

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
        const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        openRequest.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                const store = db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
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

        openRequest.onsuccess = (event) => {
            databaseInstance = event.target.result;
            console.log('تم الاتصال بقاعدة البيانات بنجاح.');
            resolve(databaseInstance);
        };

        openRequest.onerror = (event) => {
            console.error('خطأ في فتح قاعدة البيانات:', event.target.error);
            reject(event.target.error);
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
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'flex';
}

/**
 * إخفاء مؤشر التحميل العام.
 * Hides the global loading indicator.
 */
function hideGlobalLoader() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'none';
}

/**
 * إظهار نموذج الإدخال/التعديل لمبنى معين.
 * Shows the input/edit form for a specific building.
 * @param {string} buildingName - اسم العمارة المراد عرض نموذجها.
 */
function displayInputForm(buildingName) {
    selectedBuildingName = buildingName;
    document.getElementById('buildingTitle').textContent = buildingName;

    const formContainer = document.getElementById('formContainer');
    formContainer.classList.add('show');
    formContainer.style.display = 'block';

    populateBuildingDropdown(buildingName);
    // لا نمسح الحقول هنا، المسح يحدث عند الإخفاء أو عند الحفظ/التعديل الناجح
    // أو عند التحضير لسجل جديد (ضمن prepareEditEntry أو ما شابه)
    document.getElementById('totalBill').disabled = true; // تعطيل حقل المبلغ الكلي مبدئيًا عند العرض
}

/**
 * إخفاء نموذج الإدخال/التعديل.
 * Hides the input/edit form.
 */
function hideInputForm() {
    clearInputFormFields(); // مسح الحقول عند الإخفاء
    const formContainer = document.getElementById('formContainer');
    formContainer.style.display = 'none';
    formContainer.classList.remove('show');
    resetEditState(); // إعادة تعيين حالة التعديل
}

/**
 * مسح جميع حقول نموذج الإدخال/التعديل.
 * Clears all fields in the input/edit form.
 */
function clearInputFormFields() {
    document.getElementById('totalBill').value = '';
    document.getElementById('totalBill').disabled = true;
    document.getElementById('reading').value = '';
    document.getElementById('valueSAR').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('paymentAmount').value = '';
    document.getElementById('comboBox').value = '';
}

/**
 * ملء القائمة المنسدلة (ComboBox) بالخيارات المناسبة للعمارة المحددة.
 * Populates the dropdown (ComboBox) with options relevant to the selected building.
 * @param {string} buildingName - اسم العمارة.
 */
function populateBuildingDropdown(buildingName) {
    const comboBox = document.getElementById('comboBox');
    comboBox.innerHTML = '';
    if (buildingDropdownOptions[buildingName]) {
        buildingDropdownOptions[buildingName].forEach(itemText => {
            const option = document.createElement('option');
            option.text = itemText;
            option.value = itemText;
            comboBox.add(option);
        });
    } else {
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

    if (!currentlyDisplayedData || currentlyDisplayedData.length === 0) {
        const noDataRow = listContentBody.insertRow();
        const noDataCell = noDataRow.insertCell();
        noDataCell.colSpan = 9; // عدد الأعمدة الكلي بما في ذلك الإجراءات
        noDataCell.textContent = 'لا توجد بيانات لعرضها.';
        noDataCell.style.textAlign = 'center';
        noDataCell.style.padding = '20px';
        return;
    }

    currentlyDisplayedData.forEach((entryData) => {
        const row = listContentBody.insertRow();
        row.className = 'list-item';
        row.setAttribute('data-id', entryData.id);

        // إضافة خلايا البيانات
        row.insertCell().textContent = entryData.building || '-';
        row.insertCell().textContent = entryData.totalBill || '0';
        row.insertCell().textContent = entryData.reading || '0';
        row.insertCell().textContent = entryData.valueSAR || '0';
        row.insertCell().textContent = entryData.fromDate || '-';
        row.insertCell().textContent = entryData.toDate || '-';
        row.insertCell().textContent = entryData.paymentAmount || '0';
        row.insertCell().textContent = entryData.combo || '-';

        // إضافة خلية لأزرار الإجراءات
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button onclick="prepareEditEntry(${entryData.id})" class="edit-btn" title="تعديل السجل">
                <i class="fas fa-edit"></i> تعديل
            </button>
            <button onclick="requestDeleteEntry(${entryData.id})" class="delete-btn" title="حذف السجل">
                <i class="fas fa-trash"></i> حذف
            </button>
        `;

        // لا حاجة لمستمع النقر على الصف هنا لأن الأزرار تعالج الإجراءات
    });
}

/**
 * تحديث عرض المبلغ الإجمالي بجانب زر العمارة المحدد.
 * Updates the total bill display next to the specified building button.
 * @param {string} buildingName - اسم العمارة.
 */
function updateTotalBillDisplayForBuilding(buildingName) {
    const total = allEntriesData
        .filter(item => item.building === buildingName)
        .reduce((sum, item) => sum + parseFloat(item.totalBill || 0), 0);

    const totalBillElement = document.getElementById(`totalBill_${buildingName}`);
    if (totalBillElement) {
        totalBillElement.textContent = `${total.toFixed(2)} ريال`;
    }
}

/**
 * تحديث عرض المبالغ الإجمالية لجميع أزرار العمارات.
 * Updates the total bill display for all building buttons.
 */
function updateAllBuildingTotalDisplays() {
    const uniqueBuildingNames = [...new Set(allEntriesData.map(item => item.building))];
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
        showGlobalLoader();
        if (!databaseInstance) {
            throw new Error('قاعدة البيانات غير مهيأة.');
        }
        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], 'readonly');
        const store = transaction.objectStore(OBJECT_STORE_NAME);
        const getAllRequest = store.getAll();

        const data = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        allEntriesData = data.map(item => ({ ...item, id: Number(item.id) }));
        currentlyDisplayedData = [...allEntriesData];

        updateListViewDisplay();
        updateAllBuildingTotalDisplays();

        console.log('تم تحميل جميع السجلات بنجاح.');

    } catch (error) {
        console.error('فشل تحميل البيانات:', error);
        alert('فشل تحميل البيانات: ' + error.message);
    } finally {
        hideGlobalLoader();
    }
}

/**
 * إضافة سجل جديد أو تعديل سجل موجود في قاعدة البيانات.
 * Adds a new entry or updates an existing one in the database.
 */
async function saveOrUpdateEntry() {
    if (!validateInputForm()) return;

    try {
        showGlobalLoader();

        const entryData = {
            building: selectedBuildingName,
            totalBill: document.getElementById('totalBill').value,
            reading: document.getElementById('reading').value,
            valueSAR: document.getElementById('valueSAR').value,
            fromDate: document.getElementById('fromDate').value,
            toDate: document.getElementById('toDate').value,
            paymentAmount: document.getElementById('paymentAmount').value,
            combo: document.getElementById('comboBox').value
        };

        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(OBJECT_STORE_NAME);
        let request;

        if (isEditModeActive && editingEntryId !== null) {
            entryData.id = editingEntryId;
            request = store.put(entryData);
            console.log(`جاري تحديث السجل بالمعرف: ${editingEntryId}`);
        } else {
            request = store.add(entryData);
            console.log('جاري إضافة سجل جديد.');
        }

        await new Promise((resolve, reject) => {
            request.onsuccess = (result) => resolve(result); // تم تغيير result هنا
            request.onerror = () => reject(request.error);
        });

        console.log('تمت عملية الحفظ/التحديث بنجاح.');
        await loadAllEntries(); // إعادة تحميل الكل لتحديث الواجهة بالكامل
        // لا حاجة لتحديث الإجمالي بشكل منفصل لأن loadAllEntries يقوم بذلك
        hideInputForm(); // إخفاء النموذج بعد النجاح

    } catch (error) {
        console.error('فشلت عملية الحفظ/التحديث:', error);
        alert('حدث خطأ أثناء الحفظ أو التحديث: ' + error.message);
        hideGlobalLoader(); // التأكد من إخفاء المؤشر في حالة الخطأ
    }
    // لا حاجة لـ finally هنا لأن hideInputForm أو hideGlobalLoader يتم استدعاؤها
}


/**
 * طلب تأكيد وحذف سجل من قاعدة البيانات.
 * Requests confirmation and deletes an entry from the database.
 * @param {number} entryId - معرف السجل المراد حذفه.
 */
async function requestDeleteEntry(entryId) {
    const idToDelete = Number(entryId);
    if (isNaN(idToDelete)) {
        console.error('معرف غير صالح للحذف:', entryId);
        alert('حدث خطأ: معرف السجل غير صالح.');
        return;
    }

    if (!confirm(`هل أنت متأكد من حذف هذا السجل (ID: ${idToDelete})؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        return;
    }

    try {
        showGlobalLoader();

        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(OBJECT_STORE_NAME);

        const entryToDelete = allEntriesData.find(entry => entry.id === idToDelete);
        const buildingNameToUpdate = entryToDelete ? entryToDelete.building : null;

        const deleteRequest = store.delete(idToDelete);

        await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        });

        console.log(`تم حذف السجل بالمعرف: ${idToDelete} بنجاح.`);

        // تحديث البيانات المحلية والواجهة
        allEntriesData = allEntriesData.filter(entry => entry.id !== idToDelete);
        currentlyDisplayedData = currentlyDisplayedData.filter(entry => entry.id !== idToDelete);
        updateListViewDisplay();

        if (buildingNameToUpdate) {
            updateTotalBillDisplayForBuilding(buildingNameToUpdate);
        }

        if (isEditModeActive && editingEntryId === idToDelete) {
            hideInputForm();
        }

    } catch (error) {
        console.error('فشل حذف السجل:', error);
        alert('❌ فشل الحذف: ' + error.message);
    } finally {
        hideGlobalLoader();
    }
}

/**
 * البحث عن السجلات التي تطابق مصطلح البحث في أي حقل.
 * Searches for entries matching the search term in any field.
 * @param {string} searchTerm - النص المراد البحث عنه.
 */
function searchEntries(searchTerm) { // لم تعد async لأننا نبحث في البيانات المحلية
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

    if (!lowerCaseSearchTerm) {
        currentlyDisplayedData = [...allEntriesData];
        updateListViewDisplay();
        return;
    }

    // لا حاجة لـ try/catch أو loader هنا لأنها عملية محلية سريعة
    currentlyDisplayedData = allEntriesData.filter(entry => {
        return Object.values(entry).some(value =>
            String(value).toLowerCase().includes(lowerCaseSearchTerm)
        );
    });

    updateListViewDisplay();
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
    const entryData = allEntriesData.find(item => item.id === idToEdit);

    if (!entryData) {
        console.error(`لم يتم العثور على سجل بالمعرف: ${idToEdit}`);
        alert('تعذر العثور على السجل المحدد للتعديل.');
        return;
    }

    // عرض النموذج وملء الحقول
    displayInputForm(entryData.building); // عرض النموذج للعمارة الصحيحة وملء القائمة المنسدلة

    document.getElementById('totalBill').value = entryData.totalBill || '';
    document.getElementById('totalBill').disabled = false; // تمكين الحقل عند التعديل
    document.getElementById('reading').value = entryData.reading || '';
    document.getElementById('valueSAR').value = entryData.valueSAR || '';
    document.getElementById('fromDate').value = entryData.fromDate || '';
    document.getElementById('toDate').value = entryData.toDate || '';
    document.getElementById('paymentAmount').value = entryData.paymentAmount || '';
    document.getElementById('comboBox').value = entryData.combo || '';

    isEditModeActive = true;
    editingEntryId = idToEdit;

    console.log(`تم تجهيز النموذج لتعديل السجل بالمعرف: ${idToEdit}`);
    // الانتقال إلى النموذج لتسهيل التعديل
    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' });
}

/**
 * إعادة تعيين حالة التعديل.
 * Resets the edit mode state.
 */
function resetEditState() {
    isEditModeActive = false;
    editingEntryId = null;
    selectedBuildingName = '';
    // لا نمسح الحقول هنا، يتم مسحها عند الإخفاء أو الحفظ
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
    const totalBill = document.getElementById('totalBill').value.trim();
    const reading = document.getElementById('reading').value.trim();
    const valueSAR = document.getElementById('valueSAR').value.trim();
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;
    const paymentAmount = document.getElementById('paymentAmount').value.trim();
    const combo = document.getElementById('comboBox').value;

    const requiredFields = [
        { value: totalBill, name: 'المبلغ الكلي للفاتورة' },
        { value: reading, name: 'القراءة' },
        { value: valueSAR, name: 'القيمة بالريال' },
        { value: fromDate, name: 'الفترة من' },
        { value: toDate, name: 'الفترة إلى' },
        { value: paymentAmount, name: 'مبلغ السداد' },
        { value: combo, name: 'العداد التجاري' }
    ];

    const emptyFields = requiredFields.filter(field => !field.value);
    if (emptyFields.length > 0) {
        const errorMessage = '❗ الحقول التالية مطلوبة:\n' +
                             emptyFields.map(field => `- ${field.name}`).join('\n');
        alert(errorMessage);
        return false;
    }

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
        return false;
    }

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        alert('⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.');
        return false;
    }

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
        showGlobalLoader();
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        if (!usernameInput || !passwordInput) {
            alert('الرجاء إدخال اسم المستخدم وكلمة المرور.');
            hideGlobalLoader();
            return;
        }

        const hashedPasswordInput = CryptoJS.SHA256(passwordInput).toString();
        const validUsersCredentials = {
            admin: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' // 123
        };

        if (validUsersCredentials[usernameInput] && validUsersCredentials[usernameInput] === hashedPasswordInput) {
            console.log('تسجيل الدخول ناجح.');
            sessionStorage.setItem('authToken', 'user_is_authenticated');
            location.reload(); // إعادة التحميل لإظهار لوحة التحكم
        } else {
            console.warn('محاولة تسجيل دخول فاشلة.');
            alert('بيانات الدخول غير صحيحة!');
            hideGlobalLoader();
        }
    } catch (error) {
        console.error('حدث خطأ أثناء محاولة تسجيل الدخول:', error);
        alert('فشل تسجيل الدخول: ' + error.message);
        hideGlobalLoader();
    }
}

/**
 * تسجيل خروج المستخدم.
 * Logs out the current user.
 */
function logoutUser() {
    sessionStorage.clear();
    location.reload(); // إعادة التحميل سيعيد المستخدم لواجهة الدخول
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
    currentlyDisplayedData = [...allEntriesData];
    updateListViewDisplay();
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
    // الانتقال إلى قسم القائمة بعد التصفية
    document.getElementById('listView').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const headers = ["اسم العمارة", "المبلغ الكلي", "القراءة", "القيمة بالريال", "التاريخ من", "التاريخ إلى", "مبلغ السداد", "العداد التجاري"];
    const rows = currentlyDisplayedData.map(item => [
        `"${item.building || ''}"`,
        item.totalBill || 0,
        item.reading || 0,
        item.valueSAR || 0,
        item.fromDate || '',
        item.toDate || '',
        item.paymentAmount || 0,
        `"${item.combo || ''}"`
    ]);

    // استخدام فاصلة منقوطة لتحسين التوافق مع Excel العربي
    const csvContent = "data:text/csv;charset=utf-8," +
                       headers.join(";") + "\n" +
                       rows.map(row => row.join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "بيانات_العقارات.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('تم تصدير البيانات إلى ملف CSV.');
}

/******************************************************************************
 * إعدادات ومستمعي الأحداث                           *
 * Setup and Event Listeners                          *
 ******************************************************************************/

/**
 * إعداد جميع مستمعي الأحداث لعناصر واجهة المستخدم.
 * Sets up all event listeners for UI elements.
 */
function setupEventListeners() {
    // زر تمكين حقل المبلغ الكلي
    const enableTotalBillButton = document.getElementById('enableTotalBill');
    if (enableTotalBillButton) {
        enableTotalBillButton.addEventListener('click', () => {
            const totalBillInput = document.getElementById('totalBill');
            totalBillInput.disabled = false;
            totalBillInput.focus();
        });
    }

    // أزرار العمارات
    const buildingButtons = document.querySelectorAll('.building-buttons .bttn');
    buildingButtons.forEach(button => {
        const buttonTextContent = button.textContent || '';
        const buildingNameMatch = buttonTextContent.match(/^([^\n]+)/); // الحصول على النص قبل أول سطر جديد
        const buildingName = buildingNameMatch ? buildingNameMatch[1].trim() : null;

        if (buildingName) {
            button.addEventListener('click', (event) => {
                // التأكد من عدم النقر على span الإجمالي
                if (!event.target.classList.contains('total-bill-display')) {
                    // مسح الحقول قبل عرض النموذج لسجل جديد
                    clearInputFormFields();
                    resetEditState(); // التأكد من أننا لسنا في وضع التعديل
                    displayInputForm(buildingName);
                    document.getElementById('formContainer').scrollIntoView({ behavior: 'smooth' }); // الانتقال للنموذج
                }
            });

            const totalSpan = button.querySelector('.total-bill-display');
            if (totalSpan) {
                totalSpan.addEventListener('click', (event) => {
                    event.stopPropagation();
                    filterListViewByBuilding(buildingName);
                });
            }
        } else {
            console.warn('لم يتم العثور على اسم عمارة صالح للزر:', button);
        }
    });


    // مربع البحث
    const searchInput = document.querySelector('.search-box');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchEntries(e.target.value);
            }, 300);
        });
    }

    // زر تسجيل الخروج
    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logoutUser);
    }

    // أزرار نموذج الإدخال/التعديل
    const saveButton = document.querySelector('#formContainer .form-actions button:nth-of-type(1)');
    if (saveButton) {
        saveButton.addEventListener('click', saveOrUpdateEntry);
    }

    const viewAllButton = document.querySelector('#formContainer .form-actions button:nth-of-type(2)');
    if (viewAllButton) {
        viewAllButton.addEventListener('click', resetListViewToAllEntries);
    }

    const cancelButton = document.querySelector('#formContainer .form-actions button:nth-of-type(3)');
    if (cancelButton) {
        cancelButton.addEventListener('click', hideInputForm);
    }

    // زر تصدير إلى Excel
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportCurrentDataToExcel);
    }

    // ربط حدث الضغط على Enter في حقل كلمة المرور (لواجهة الدخول)
    const passwordInputLogin = document.getElementById('password');
    if (passwordInputLogin && document.getElementById('loginContainer').style.display !== 'none') {
        passwordInputLogin.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                attemptLogin();
            }
        });
    }
     // ربط حدث الضغط على Enter في حقل اسم المستخدم (لواجهة الدخول)
     const usernameInputLogin = document.getElementById('username');
     if (usernameInputLogin && document.getElementById('loginContainer').style.display !== 'none') {
         usernameInputLogin.addEventListener('keypress', (event) => {
             if (event.key === 'Enter') {
                 // الانتقال إلى حقل كلمة المرور أو محاولة الدخول إذا كان ممتلئًا
                 document.getElementById('password').focus();
             }
         });
     }


    console.log('تم إعداد مستمعي الأحداث.');
}

// نقطة الدخول الرئيسية للتطبيق
document.addEventListener('DOMContentLoaded', async () => {
    if (sessionStorage.getItem('authToken') === 'user_is_authenticated') {
        try {
            showGlobalLoader();
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            databaseInstance = await initializeDatabase();
            await loadAllEntries();
            setupEventListeners(); // إعداد المستمعين بعد تحميل كل شيء
        } catch (error) {
            console.error('فشل تهيئة التطبيق بعد تسجيل الدخول:', error);
            alert('تعذر تهيئة التطبيق بشكل صحيح.');
            logoutUser();
        } finally {
            hideGlobalLoader();
        }
    } else {
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
        // ربط حدث زر الدخول فقط إذا كانت واجهة الدخول ظاهرة
        const loginButton = document.querySelector('#loginContainer button');
        if (loginButton) {
            loginButton.addEventListener('click', attemptLogin);
        }
         // ربط أحداث Enter لواجهة الدخول
         setupEventListeners(); // استدعاء لإعداد مستمعي Enter
        console.log('المستخدم غير مسجل دخوله، تم عرض واجهة الدخول.');
    }
});
