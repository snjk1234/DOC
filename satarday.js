/******************************************************************************
 * المتغيرات والثوابت العامة                               *
 * Global Variables & Constants                            *
 ******************************************************************************/
let selectedBuildingName = '';
let editingEntryId = null;
let isEditModeActive = false;
let databaseInstance;
let allEntriesData = [];
let currentlyDisplayedData = [];
let searchDebounceTimer;

const DATABASE_NAME = 'EstateDB';
const OBJECT_STORE_NAME = 'Buildings';
const DATABASE_VERSION = 1;

// بيانات القوائم المنسدلة
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

// عناصر الواجهة المستخدمة بشكل متكرر
const uiElements = {
    loader: () => document.getElementById('loadingOverlay'),
    loginContainer: () => document.getElementById('loginContainer'),
    dashboard: () => document.getElementById('dashboard'),
    formContainer: () => document.getElementById('formContainer'),
    buildingTitle: () => document.getElementById('buildingTitle'),
    totalBillInput: () => document.getElementById('totalBill'),
    readingInput: () => document.getElementById('reading'),
    valueSARInput: () => document.getElementById('valueSAR'),
    fromDateInput: () => document.getElementById('fromDate'),
    toDateInput: () => document.getElementById('toDate'),
    paymentAmountInput: () => document.getElementById('paymentAmount'),
    comboBox: () => document.getElementById('comboBox'),
    listContentBody: () => document.getElementById('listContent'),
    usernameInput: () => document.getElementById('username'),
    passwordInput: () => document.getElementById('password'),
    searchBox: () => document.querySelector('.search-box'),
};

/******************************************************************************
 * تهيئة قاعدة البيانات                             *
 * Initialize Database                             *
 ******************************************************************************/
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        openRequest.onupgradeneeded = ({ target: { result: db } }) => {
            if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
                const store = db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                ['building', 'totalBill', 'reading', 'valueSAR', 'fromDate', 'toDate', 'paymentAmount', 'combo']
                    .forEach(indexName => store.createIndex(indexName, indexName, { unique: false }));
                console.log('Object store and indexes created.');
            }
        };
        openRequest.onsuccess = ({ target: { result: db } }) => {
            databaseInstance = db;
            console.log('Database connection successful.');
            resolve(db);
        };
        openRequest.onerror = ({ target: { error } }) => {
            console.error('Database error:', error);
            reject(error);
        };
    });
}

/******************************************************************************
 * إدارة واجهة المستخدم (UI)                       *
 * UI Management                              *
 ******************************************************************************/
const showGlobalLoader = () => { uiElements.loader().style.display = 'flex'; };
const hideGlobalLoader = () => { uiElements.loader().style.display = 'none'; };

function displayInputForm(buildingName) {
    selectedBuildingName = buildingName;
    uiElements.buildingTitle().textContent = buildingName;
    uiElements.formContainer().style.display = 'block';
    uiElements.formContainer().classList.add('show');
    populateBuildingDropdown(buildingName);
    uiElements.totalBillInput().disabled = true;
}

function hideInputForm() {
    clearInputFormFields();
    uiElements.formContainer().style.display = 'none';
    uiElements.formContainer().classList.remove('show');
    resetEditState();
}

function clearInputFormFields() {
    uiElements.totalBillInput().value = '';
    uiElements.totalBillInput().disabled = true;
    uiElements.readingInput().value = '';
    uiElements.valueSARInput().value = '';
    uiElements.fromDateInput().value = '';
    uiElements.toDateInput().value = '';
    uiElements.paymentAmountInput().value = '';
    uiElements.comboBox().value = '';
}

function populateBuildingDropdown(buildingName) {
    const comboBox = uiElements.comboBox();
    comboBox.innerHTML = ''; // Clear existing options
    const options = buildingDropdownOptions[buildingName] || [];
    if (options.length > 0) {
        options.forEach(itemText => {
            const option = new Option(itemText, itemText); // Use Option constructor
            comboBox.add(option);
        });
    } else {
        comboBox.add(new Option('لا توجد خيارات متاحة', ''));
    }
}

function updateListViewDisplay() {
    const tbody = uiElements.listContentBody();
    tbody.innerHTML = ''; // Clear previous content

    if (!currentlyDisplayedData || currentlyDisplayedData.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 9; // Adjust colspan if needed
        cell.textContent = 'لا توجد بيانات لعرضها.';
        cell.className = 'text-center p-5'; // Use classes for styling
        return;
    }

    currentlyDisplayedData.forEach((entry) => {
        const row = tbody.insertRow();
        row.className = 'list-item';
        row.dataset.id = entry.id; // Use dataset for data attributes

        // Add data cells more concisely
        [
            entry.building, entry.totalBill, entry.reading, entry.valueSAR,
            entry.fromDate, entry.toDate, entry.paymentAmount, entry.combo
        ].forEach(text => {
            row.insertCell().textContent = text || '-'; // Default to '-' if null/undefined
        });

        // Actions cell
        const actionsCell = row.insertCell();
        actionsCell.innerHTML = `
            <button onclick="prepareEditEntry(${entry.id})" class="edit-btn" title="تعديل السجل">
                <i class="fas fa-edit"></i> تعديل
            </button>
            <button onclick="requestDeleteEntry(${entry.id})" class="delete-btn" title="حذف السجل">
                <i class="fas fa-trash"></i> حذف
            </button>
        `;
    });
}

function updateTotalBillDisplayForBuilding(buildingName) {
    const total = allEntriesData
        .filter(item => item.building === buildingName)
        .reduce((sum, item) => sum + parseFloat(item.totalBill || 0), 0);

    const totalBillElement = document.getElementById(`totalBill_${buildingName}`);
    if (totalBillElement) {
        totalBillElement.textContent = `${total.toFixed(2)} ريال`;
    }
}

function updateAllBuildingTotalDisplays() {
    // Use Set directly for unique names
    new Set(allEntriesData.map(item => item.building)).forEach(updateTotalBillDisplayForBuilding);
}

/******************************************************************************
 * عمليات قاعدة البيانات (CRUD)                         *
 * Database Operations (CRUD)                       *
 ******************************************************************************/
async function performDbOperation(mode, operation) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return reject(new Error('Database not initialized.'));
        const transaction = databaseInstance.transaction([OBJECT_STORE_NAME], mode);
        const store = transaction.objectStore(OBJECT_STORE_NAME);
        const request = operation(store);
        request.onsuccess = (event) => resolve(event.target.result ?? event.target.source?.key); // Handle potential differences in result/key access
        request.onerror = (event) => reject(event.target.error);
    });
}


async function loadAllEntries() {
    try {
        showGlobalLoader();
        const data = await performDbOperation('readonly', store => store.getAll());
        allEntriesData = data.map(item => ({ ...item, id: Number(item.id) }));
        currentlyDisplayedData = [...allEntriesData];
        updateListViewDisplay();
        updateAllBuildingTotalDisplays();
        console.log('All entries loaded successfully.');
    } catch (error) {
        console.error('Failed to load entries:', error);
        alert('فشل تحميل البيانات: ' + error.message);
    } finally {
        hideGlobalLoader();
    }
}

async function saveOrUpdateEntry() {
    if (!validateInputForm()) return;

    try {
        showGlobalLoader();
        const entryData = {
            building: selectedBuildingName,
            totalBill: uiElements.totalBillInput().value,
            reading: uiElements.readingInput().value,
            valueSAR: uiElements.valueSARInput().value,
            fromDate: uiElements.fromDateInput().value,
            toDate: uiElements.toDateInput().value,
            paymentAmount: uiElements.paymentAmountInput().value,
            combo: uiElements.comboBox().value
        };

        const operation = store => {
            if (isEditModeActive && editingEntryId !== null) {
                entryData.id = editingEntryId;
                console.log(`Updating entry ID: ${editingEntryId}`);
                return store.put(entryData);
            } else {
                console.log('Adding new entry.');
                return store.add(entryData);
            }
        };

        await performDbOperation('readwrite', operation);
        console.log('Save/Update successful.');
        await loadAllEntries(); // Reload all to reflect changes
        hideInputForm(); // Hide form on success

    } catch (error) {
        console.error('Save/Update failed:', error);
        alert('حدث خطأ أثناء الحفظ أو التحديث: ' + error.message);
        hideGlobalLoader(); // Ensure loader is hidden on error
    }
}

async function requestDeleteEntry(entryId) {
    const idToDelete = Number(entryId);
    if (isNaN(idToDelete) || !confirm(`هل أنت متأكد من حذف هذا السجل (ID: ${idToDelete})؟`)) {
        if (isNaN(idToDelete)) console.error('Invalid ID for deletion:', entryId);
        return;
    }

    try {
        showGlobalLoader();
        const entryToDelete = allEntriesData.find(entry => entry.id === idToDelete);
        await performDbOperation('readwrite', store => store.delete(idToDelete));
        console.log(`Entry ID: ${idToDelete} deleted successfully.`);

        // Update local data and UI
        allEntriesData = allEntriesData.filter(entry => entry.id !== idToDelete);
        currentlyDisplayedData = currentlyDisplayedData.filter(entry => entry.id !== idToDelete);
        updateListViewDisplay();

        if (entryToDelete?.building) { // Optional chaining
            updateTotalBillDisplayForBuilding(entryToDelete.building);
        }

        if (isEditModeActive && editingEntryId === idToDelete) {
            hideInputForm();
        }
    } catch (error) {
        console.error('Deletion failed:', error);
        alert('❌ فشل الحذف: ' + error.message);
    } finally {
        hideGlobalLoader();
    }
}

/******************************************************************************
 * البحث والحالة                                  *
 * Search & State Management                     *
 ******************************************************************************/
function searchEntries(searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    currentlyDisplayedData = lowerCaseSearchTerm
        ? allEntriesData.filter(entry =>
            Object.values(entry).some(value =>
                String(value).toLowerCase().includes(lowerCaseSearchTerm)
            )
          )
        : [...allEntriesData]; // Use spread for a new array copy
    updateListViewDisplay();
}

function prepareEditEntry(entryId) {
    const idToEdit = Number(entryId);
    const entryData = allEntriesData.find(item => item.id === idToEdit);

    if (!entryData) {
        console.error(`Entry not found for ID: ${idToEdit}`);
        alert('تعذر العثور على السجل المحدد للتعديل.');
        return;
    }

    displayInputForm(entryData.building); // Show form and populate dropdown

    // Populate fields
    uiElements.totalBillInput().value = entryData.totalBill || '';
    uiElements.totalBillInput().disabled = false; // Enable field for editing
    uiElements.readingInput().value = entryData.reading || '';
    uiElements.valueSARInput().value = entryData.valueSAR || '';
    uiElements.fromDateInput().value = entryData.fromDate || '';
    uiElements.toDateInput().value = entryData.toDate || '';
    uiElements.paymentAmountInput().value = entryData.paymentAmount || '';
    uiElements.comboBox().value = entryData.combo || ''; // Select correct dropdown option

    isEditModeActive = true;
    editingEntryId = idToEdit;

    console.log(`Prepared form for editing entry ID: ${idToEdit}`);
    uiElements.formContainer().scrollIntoView({ behavior: 'smooth' }); // Scroll to form
}

function resetEditState() {
    isEditModeActive = false;
    editingEntryId = null;
    selectedBuildingName = '';
    console.log('Edit state reset.');
}

/******************************************************************************
 * التحقق من الصحة والمصادقة                         *
 * Validation & Authentication                    *
 ******************************************************************************/
function validateInputForm() {
    const fields = [
        { value: uiElements.totalBillInput().value.trim(), name: 'المبلغ الكلي للفاتورة', isNumeric: true },
        { value: uiElements.readingInput().value.trim(), name: 'القراءة', isNumeric: true },
        { value: uiElements.valueSARInput().value.trim(), name: 'القيمة بالريال', isNumeric: true },
        { value: uiElements.fromDateInput().value, name: 'الفترة من' },
        { value: uiElements.toDateInput().value, name: 'الفترة إلى' },
        { value: uiElements.paymentAmountInput().value.trim(), name: 'مبلغ السداد', isNumeric: true },
        { value: uiElements.comboBox().value, name: 'العداد التجاري' }
    ];

    const emptyFields = fields.filter(f => !f.value);
    if (emptyFields.length > 0) {
        alert(`❗ الحقول التالية مطلوبة:\n${emptyFields.map(f => `- ${f.name}`).join('\n')}`);
        return false;
    }

    const invalidNumericFields = fields.filter(f => f.isNumeric && isNaN(parseFloat(f.value)));
    if (invalidNumericFields.length > 0) {
        alert(`❌ الحقول التالية يجب أن تحتوي على أرقام صالحة:\n${invalidNumericFields.map(f => `- ${f.name}`).join('\n')}`);
        return false;
    }

    const fromDate = uiElements.fromDateInput().value;
    const toDate = uiElements.toDateInput().value;
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
        alert('⚠️ تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.');
        return false;
    }

    return true; // All checks passed
}

async function attemptLogin() {
    try {
        showGlobalLoader();
        const username = uiElements.usernameInput().value;
        const password = uiElements.passwordInput().value;

        if (!username || !password) {
            alert('الرجاء إدخال اسم المستخدم وكلمة المرور.');
            return hideGlobalLoader(); // Return early after hiding loader
        }

        const hashedPasswordInput = CryptoJS.SHA256(password).toString();
        const validUsersCredentials = { admin: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' }; // '123'

        if (validUsersCredentials[username] === hashedPasswordInput) {
            console.log('Login successful.');
            sessionStorage.setItem('authToken', 'user_is_authenticated');
            location.reload(); // Reload to show dashboard
        } else {
            console.warn('Login attempt failed.');
            alert('بيانات الدخول غير صحيحة!');
            hideGlobalLoader();
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('فشل تسجيل الدخول: ' + error.message);
        hideGlobalLoader();
    }
}

const logoutUser = () => {
    sessionStorage.clear();
    location.reload(); // Reload to show login interface
    console.log('User logged out.');
};

/******************************************************************************
 * وظائف مساعدة وتصدير                           *
 * Helper & Export Functions                       *
 ******************************************************************************/
function resetListViewToAllEntries() {
    currentlyDisplayedData = [...allEntriesData];
    updateListViewDisplay();
    uiElements.searchBox().value = '';
    console.log('List view reset to show all entries.');
}

function filterListViewByBuilding(buildingName) {
    currentlyDisplayedData = allEntriesData.filter(item => item.building === buildingName);
    updateListViewDisplay();
    console.log(`List view filtered for: ${buildingName}`);
    document.getElementById('listView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exportCurrentDataToExcel() {
    if (currentlyDisplayedData.length === 0) return alert('لا توجد بيانات لتصديرها.');

    const headers = ["اسم العمارة", "المبلغ الكلي", "القراءة", "القيمة بالريال", "التاريخ من", "التاريخ إلى", "مبلغ السداد", "العداد التجاري"];
    // Escape commas and quotes within fields if necessary, using semicolon as delimiter
    const escapeCsvField = (field) => `"${String(field || '').replace(/"/g, '""')}"`;
    const rows = currentlyDisplayedData.map(item => [
        escapeCsvField(item.building), item.totalBill || 0, item.reading || 0, item.valueSAR || 0,
        item.fromDate || '', item.toDate || '', item.paymentAmount || 0, escapeCsvField(item.combo)
    ].join(";")); // Use semicolon delimiter

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(";") + "\n" + rows.join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "بيانات_العقارات.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('Data exported to CSV.');
}


/******************************************************************************
 * إعدادات ومستمعي الأحداث                           *
 * Setup and Event Listeners                          *
 ******************************************************************************/
function setupEventListeners() {
    // Enable Total Bill Button
    document.getElementById('enableTotalBill')?.addEventListener('click', () => {
        uiElements.totalBillInput().disabled = false;
        uiElements.totalBillInput().focus();
    });

    // Building Buttons (Add & Filter)
    document.querySelectorAll('.building-buttons .bttn').forEach(button => {
        const buildingNameMatch = (button.textContent || '').match(/^([^\n]+)/);
        const buildingName = buildingNameMatch ? buildingNameMatch[1].trim() : null;
        if (!buildingName) return console.warn('Could not find building name for button:', button);

        button.addEventListener('click', (event) => {
            if (!event.target.classList.contains('total-bill-display')) {
                clearInputFormFields();
                resetEditState();
                displayInputForm(buildingName);
                uiElements.formContainer().scrollIntoView({ behavior: 'smooth' });
            }
        });
        button.querySelector('.total-bill-display')?.addEventListener('click', (event) => {
            event.stopPropagation();
            filterListViewByBuilding(buildingName);
        });
    });

    // Search Box
    uiElements.searchBox()?.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => searchEntries(e.target.value), 300);
    });

    // Logout Button
    document.querySelector('.logout-btn')?.addEventListener('click', logoutUser);

    // Form Actions
    const formActions = document.querySelector('#formContainer .form-actions');
    formActions?.querySelector('button:nth-of-type(1)')?.addEventListener('click', saveOrUpdateEntry); // Save/Update
    formActions?.querySelector('button:nth-of-type(2)')?.addEventListener('click', resetListViewToAllEntries); // View All
    formActions?.querySelector('button:nth-of-type(3)')?.addEventListener('click', hideInputForm); // Cancel

    // Export Button
    document.getElementById('exportButton')?.addEventListener('click', exportCurrentDataToExcel);

    // Login Form Enter Key
    if (uiElements.loginContainer().style.display !== 'none') {
        uiElements.passwordInput()?.addEventListener('keypress', (event) => { if (event.key === 'Enter') attemptLogin(); });
        uiElements.usernameInput()?.addEventListener('keypress', (event) => { if (event.key === 'Enter') uiElements.passwordInput().focus(); });
    }

    console.log('Event listeners set up.');
}

// App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const isLoggedIn = sessionStorage.getItem('authToken') === 'user_is_authenticated';

    if (isLoggedIn) {
        try {
            showGlobalLoader();
            uiElements.loginContainer().style.display = 'none';
            uiElements.dashboard().style.display = 'block';
            await initializeDatabase();
            await loadAllEntries();
            setupEventListeners(); // Setup listeners for dashboard
        } catch (error) {
            console.error('App initialization failed after login:', error);
            alert('تعذر تهيئة التطبيق بشكل صحيح.');
            logoutUser(); // Log out if init fails
        } finally {
            hideGlobalLoader();
        }
    } else {
        uiElements.loginContainer().style.display = 'block';
        uiElements.dashboard().style.display = 'none';
        // Setup listeners only for login form elements
        document.querySelector('#loginContainer button')?.addEventListener('click', attemptLogin);
        uiElements.passwordInput()?.addEventListener('keypress', (event) => { if (event.key === 'Enter') attemptLogin(); });
        uiElements.usernameInput()?.addEventListener('keypress', (event) => { if (event.key === 'Enter') uiElements.passwordInput().focus(); });
        console.log('User not logged in. Login interface shown.');
    }
});
