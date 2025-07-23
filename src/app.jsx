<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Бюджетный трекер</title>
    
    <!-- Подключение Tailwind CSS для стилизации -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Подключение шрифта Inter от Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        /* Применение шрифта Inter ко всему документу */
        body {
            font-family: 'Inter', sans-serif;
        }
        /* Стили для кастомного скроллбара */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
        /* Плавный переход для кнопок и инпутов */
        .transition-all {
            transition: all 0.3s ease-in-out;
        }
    </style>
</head>
<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">

    <div class="container mx-auto p-4 md:p-8 max-w-4xl">
        
        <!-- Заголовок приложения -->
        <header class="text-center mb-8">
            <h1 class="text-4xl md:text-5xl font-bold text-indigo-600 dark:text-indigo-400">Бюджетный трекер</h1>
            <p class="text-gray-600 dark:text-gray-400 mt-2">Ваш личный финансовый помощник</p>
            <div id="auth-status" class="mt-4 text-xs text-gray-500">
                <p>Статус: <span id="user-status">Инициализация...</span></p>
                <p>ID пользователя: <span id="user-id">...</span></p>
            </div>
        </header>

        <main class="grid grid-cols-1 md:grid-cols-3 gap-8">

            <!-- Левая колонка: Баланс и форма добавления -->
            <div class="md:col-span-1 flex flex-col gap-8">
                <!-- Сводка по бюджету -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                    <h2 class="text-xl font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">Текущий баланс</h2>
                    <p id="balance" class="text-4xl font-extrabold text-center text-indigo-600 dark:text-indigo-400">$0.00</p>
                    <div class="mt-6 space-y-3">
                        <div class="flex justify-between items-center bg-green-100 dark:bg-green-900/50 p-3 rounded-lg">
                            <span class="font-semibold text-green-800 dark:text-green-300">Доходы</span>
                            <span id="total-income" class="font-bold text-green-600 dark:text-green-400">$0.00</span>
                        </div>
                        <div class="flex justify-between items-center bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">
                            <span class="font-semibold text-red-800 dark:text-red-300">Расходы</span>
                            <span id="total-expense" class="font-bold text-red-600 dark:text-red-400">$0.00</span>
                        </div>
                    </div>
                </div>

                <!-- Форма добавления новой транзакции -->
                <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                    <h2 class="text-xl font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">Добавить транзакцию</h2>
                    <form id="transaction-form" class="space-y-4">
                        <div>
                            <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Описание</label>
                            <input type="text" id="description" placeholder="Например, кофе" class="mt-1 block w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all" required>
                        </div>
                        <div>
                            <label for="amount" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Сумма ($)</label>
                            <input type="number" id="amount" placeholder="10.00" step="0.01" min="0.01" class="mt-1 block w-full bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition-all" required>
                        </div>
                        <div class="flex gap-4">
                            <button type="button" id="income-btn" class="w-full py-2 px-4 border border-green-500 text-green-500 rounded-lg hover:bg-green-500 hover:text-white font-semibold transition-all">Доход</button>
                            <button type="button" id="expense-btn" class="w-full py-2 px-4 border border-red-500 text-red-500 rounded-lg hover:bg-red-500 hover:text-white font-semibold transition-all">Расход</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Правая колонка: История транзакций -->
            <div class="md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                <h2 class="text-xl font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">История транзакций</h2>
                <div id="transaction-list-container" class="h-96 overflow-y-auto pr-2">
                    <ul id="transaction-list" class="space-y-3">
                       <!-- Элементы списка будут добавлены здесь через JS -->
                       <p id="loading-state" class="text-gray-500 text-center py-8">Загрузка транзакций...</p>
                    </ul>
                </div>
            </div>

        </main>
        
        <!-- Модальное окно для подтверждения удаления -->
        <div id="delete-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 class="text-lg font-bold mb-4">Подтвердить удаление</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">Вы уверены, что хотите удалить эту транзакцию?</p>
                <div class="flex justify-end gap-4">
                    <button id="cancel-delete" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all">Отмена</button>
                    <button id="confirm-delete" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all">Удалить</button>
                </div>
            </div>
        </div>

    </div>

    <!-- Firebase SDK -->
    <script type="module">
        // Импорт необходимых функций из Firebase SDK
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, doc, addDoc, deleteDoc, onSnapshot, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // --- КОНФИГУРАЦИЯ FIREBASE ---
        // Эти переменные будут автоматически предоставлены средой выполнения
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-budget-app';
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        
        // --- ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
        let app, auth, db, userId;
        let transactions = [];
        let transactionToDeleteId = null;

        // --- ВЫБОР ЭЛЕМЕНТОВ DOM ---
        const balanceEl = document.getElementById('balance');
        const totalIncomeEl = document.getElementById('total-income');
        const totalExpenseEl = document.getElementById('total-expense');
        const transactionListEl = document.getElementById('transaction-list');
        const form = document.getElementById('transaction-form');
        const descriptionInput = document.getElementById('description');
        const amountInput = document.getElementById('amount');
        const incomeBtn = document.getElementById('income-btn');
        const expenseBtn = document.getElementById('expense-btn');
        const loadingState = document.getElementById('loading-state');
        const userStatusEl = document.getElementById('user-status');
        const userIdEl = document.getElementById('user-id');
        
        const deleteModal = document.getElementById('delete-modal');
        const confirmDeleteBtn = document.getElementById('confirm-delete');
        const cancelDeleteBtn = document.getElementById('cancel-delete');

        // --- ОСНОВНАЯ ЛОГИКА ---

        /**
         * Инициализация Firebase и аутентификация пользователя.
         */
        async function initialize() {
            try {
                app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                db = getFirestore(app);
                
                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        // Пользователь уже вошел в систему
                        userId = user.uid;
                        userStatusEl.textContent = 'Аутентифицирован';
                        userIdEl.textContent = userId;
                        await setupFirestoreListener();
                    } else {
                        // Пользователь не вошел, пытаемся войти
                        await authenticateUser();
                    }
                });
            } catch (error) {
                console.error("Ошибка инициализации Firebase:", error);
                userStatusEl.textContent = 'Ошибка инициализации';
                loadingState.textContent = 'Не удалось подключиться к базе данных.';
            }
        }

        /**
         * Аутентификация пользователя с помощью токена или анонимно.
         */
        async function authenticateUser() {
            try {
                userStatusEl.textContent = 'Аутентификация...';
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Ошибка аутентификации:", error);
                userStatusEl.textContent = 'Ошибка аутентификации';
                loadingState.textContent = 'Не удалось войти в систему.';
            }
        }
        
        /**
         * Настройка слушателя Firestore для получения транзакций в реальном времени.
         */
        async function setupFirestoreListener() {
            if (!userId) return;
            
            const transactionsCollectionPath = `artifacts/${appId}/users/${userId}/transactions`;
            const q = query(collection(db, transactionsCollectionPath));

            onSnapshot(q, (querySnapshot) => {
                transactions = [];
                querySnapshot.forEach((doc) => {
                    transactions.push({ id: doc.id, ...doc.data() });
                });
                // Сортировка по времени создания (новые вверху)
                transactions.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
                
                updateUI();
                loadingState.style.display = 'none';
                if (transactions.length === 0) {
                    transactionListEl.innerHTML = '<p class="text-gray-500 text-center py-8">История транзакций пуста.</p>';
                }

            }, (error) => {
                console.error("Ошибка при получении данных из Firestore: ", error);
                loadingState.textContent = 'Ошибка при загрузке данных.';
            });
        }

        /**
         * Обновление всего пользовательского интерфейса (список и сводка).
         */
        function updateUI() {
            renderTransactions();
            updateSummary();
        }

        /**
         * Отображение списка транзакций в DOM.
         */
        function renderTransactions() {
            transactionListEl.innerHTML = '';
            if (transactions.length === 0) {
                 transactionListEl.innerHTML = '<p class="text-gray-500 text-center py-8">История транзакций пуста.</p>';
                 return;
            }

            transactions.forEach(transaction => {
                const sign = transaction.type === 'income' ? '+' : '-';
                const amountColor = transaction.type === 'income' ? 'text-green-500' : 'text-red-500';
                const item = document.createElement('li');
                item.classList.add('flex', 'justify-between', 'items-center', 'p-3', 'bg-gray-50', 'dark:bg-gray-700/50', 'rounded-lg', 'shadow-sm');
                
                item.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="font-semibold">${transaction.description}</span>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="font-bold ${amountColor}">${sign}$${Math.abs(transaction.amount).toFixed(2)}</span>
                        <button data-id="${transaction.id}" class="delete-btn text-gray-400 hover:text-red-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                `;
                transactionListEl.appendChild(item);
            });
        }

        /**
         * Расчет и обновление сводки (баланс, доходы, расходы).
         */
        function updateSummary() {
            const amounts = transactions.map(t => t.amount);
            
            const total = amounts.reduce((acc, item) => (acc += item), 0).toFixed(2);
            
            const income = amounts
                .filter(item => item > 0)
                .reduce((acc, item) => (acc += item), 0)
                .toFixed(2);
            
            const expense = (amounts
                .filter(item => item < 0)
                .reduce((acc, item) => (acc += item), 0) * -1)
                .toFixed(2);

            balanceEl.textContent = `$${total}`;
            totalIncomeEl.textContent = `$${income}`;
            totalExpenseEl.textContent = `$${expense}`;
        }

        /**
         * Добавление новой транзакции в Firestore.
         * @param {string} type - Тип транзакции ('income' или 'expense').
         */
        async function addTransaction(type) {
            const description = descriptionInput.value.trim();
            const amount = parseFloat(amountInput.value);

            if (description === '' || isNaN(amount) || amount <= 0) {
                // Можно добавить более изящное уведомление
                alert('Пожалуйста, введите корректное описание и сумму.');
                return;
            }

            const transaction = {
                description,
                amount: type === 'income' ? amount : -amount,
                type,
                createdAt: serverTimestamp() // Используем временную метку сервера
            };

            try {
                const transactionsCollectionPath = `artifacts/${appId}/users/${userId}/transactions`;
                await addDoc(collection(db, transactionsCollectionPath), transaction);
                
                // Очистка формы
                descriptionInput.value = '';
                amountInput.value = '';
            } catch (error) {
                console.error("Ошибка при добавлении транзакции: ", error);
                alert("Не удалось добавить транзакцию.");
            }
        }

        /**
         * Удаление транзакции из Firestore.
         * @param {string} id - ID документа транзакции.
         */
        async function removeTransaction(id) {
             if (!id) return;
             try {
                const transactionDocPath = `artifacts/${appId}/users/${userId}/transactions/${id}`;
                await deleteDoc(doc(db, transactionDocPath));
             } catch (error) {
                console.error("Ошибка при удалении транзакции: ", error);
                alert("Не удалось удалить транзакцию.");
             }
        }

        // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
        
        // Добавление дохода
        incomeBtn.addEventListener('click', () => addTransaction('income'));
        
        // Добавление расхода
        expenseBtn.addEventListener('click', () => addTransaction('expense'));

        // Обработка удаления через делегирование событий
        transactionListEl.addEventListener('click', e => {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                transactionToDeleteId = deleteButton.dataset.id;
                deleteModal.classList.remove('hidden');
            }
        });
        
        // Закрытие модального окна
        cancelDeleteBtn.addEventListener('click', () => {
            transactionToDeleteId = null;
            deleteModal.classList.add('hidden');
        });
        
        // Подтверждение удаления
        confirmDeleteBtn.addEventListener('click', async () => {
            if (transactionToDeleteId) {
                await removeTransaction(transactionToDeleteId);
                transactionToDeleteId = null;
                deleteModal.classList.add('hidden');
            }
        });


        // --- ЗАПУСК ПРИЛОЖЕНИЯ ---
        // Инициализируем приложение после полной загрузки страницы
        window.onload = initialize;

    </script>
</body>
</html>