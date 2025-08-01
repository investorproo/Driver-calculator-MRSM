import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { Truck, Settings, Plus, DollarSign, CalendarDays, Clock, MapPin, TrendingUp, FileText, ChevronDown, Trash2, Edit3, Save, X, Sun, Moon, UploadCloud, FileScan, Play, ChevronsLeft, ChevronsRight, Loader2, User, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, getWeek, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

// --- НАСТРОЙКИ FIREBASE (Версия для Vercel/GitHub) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// --- ПРОВЕРКА КЛЮЧЕЙ FIREBASE ---
const areFirebaseKeysAvailable = 
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId;

// --- ИНИЦИАЛИЗАЦИЯ FIREBASE (ТОЛЬКО ЕСЛИ КЛЮЧИ ДОСТУПНЫ) ---
let app, auth, db;
if (areFirebaseKeysAvailable) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

// --- КОНСТАНТЫ ---
const DIESEL_DISCOUNT_PER_GALLON = 0.60;
const ALL_DIESEL_KEYWORDS = ["diesel", "dsl", "fuel", "reefer", "trkds", "trk dsl"];
const DEF_KEYWORDS = ["def", "adblue"];

const DEFAULT_USER_SETTINGS = {
    nickname: '',
    rentPerWeek: 0,
    percentageFromGross: 0,
    ratePerMileCompanyCharge: 0,
    expenses: [
        { name: "Топливо", enabled: true, amount: 0 },
        { name: "Дорожные сборы", enabled: true, amount: 0 },
        { name: "Ремонт", enabled: true, amount: 0 },
        { name: "Весы", enabled: true, amount: 0 },
        { name: "Парковка", enabled: true, amount: 0 },
        { name: "Штрафы", enabled: true, amount: 0 },
    ],
    customExpenses: [],
};

const INITIAL_TRIP_FORM_STATE = {
    date: format(new Date(), 'yyyy-MM-dd'),
    daysInTrip: '',
    fromLocation: '',
    toLocation: '',
    tripGross: '',
    tripMiles: '',
    notes: ''
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const parseNumericInput = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(String(value).replace(/,/g, '.'));
    return isNaN(num) ? 0 : num;
};

const formatCurrency = (value) => {
    const num = parseNumericInput(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

// --- ОСНОВНЫЕ КОМПОНЕНТЫ UI (СТИЛИЗОВАННЫЕ) ---
const Card = ({ children, className = '', ...props }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xl dark:shadow-2xl dark:shadow-black/20 ${className}`}
        {...props}
    >
        {children}
    </motion.div>
);

const InputField = ({ icon: Icon, label, id, type = "text", value, onChange, placeholder, required = false, className = '', disabled = false }) => (
    <div className={`relative ${className}`}>
        <label htmlFor={id} className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>
        <div className="relative">
            {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-400" />}
            <input
                type={type}
                id={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 shadow-inner disabled:opacity-60`}
            />
        </div>
    </div>
);

const TextareaField = ({ icon: Icon, label, id, value, onChange, placeholder, className = '' }) => (
    <div className={`relative ${className}`}>
        <label htmlFor={id} className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>
        <div className="relative">
            {Icon && <Icon className="absolute left-3 top-4 h-5 w-5 text-slate-400 dark:text-slate-400" />}
             <textarea
                id={id}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows="3"
                className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 shadow-inner`}
            />
        </div>
    </div>
);

const StyledButton = ({ children, onClick, icon: Icon, className = '', type = 'button', disabled = false }) => (
    <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`relative inline-flex items-center justify-center w-full px-6 py-3 overflow-hidden font-bold text-white rounded-xl group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform-gpu active:scale-95 ${className}`}
    >
        <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-600 to-blue-500"></span>
        <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition-all duration-500 origin-bottom-left-do transform translate-x-24 bg-blue-700 rounded-full opacity-30 group-hover:translate-x-0 ease"></span>
        <span className="relative flex items-center justify-center">
            {Icon && <Icon className="w-5 h-5 mr-2" />}
            {children}
        </span>
    </button>
);

const DestructiveButton = ({ children, onClick, icon: Icon, className = '', disabled=false }) => (
     <button
        onClick={onClick}
        disabled={disabled}
        className={`relative inline-flex items-center justify-center w-full px-6 py-3 overflow-hidden font-bold text-white rounded-xl group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform-gpu active:scale-95 ${className}`}
    >
        <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-red-600 to-rose-500"></span>
        <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition-all duration-500 origin-bottom-left-do transform translate-x-24 bg-rose-700 rounded-full opacity-30 group-hover:translate-x-0 ease"></span>
        <span className="relative flex items-center justify-center">
            {Icon && <Icon className="w-5 h-5 mr-2" />}
            {children}
        </span>
    </button>
);

const CustomToggle = ({ enabled, onChange }) => (
    <div
        onClick={onChange}
        className={`relative inline-flex items-center h-7 w-12 cursor-pointer rounded-full transition-colors duration-300 ease-in-out ${enabled ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-700'}`}
    >
        <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
    </div>
);

// --- ЛОГИКА РАСЧЕТОВ ---
const calculateTripProfit = (trip, settings) => {
    if (!trip || !settings) return {};

    const tripGross = parseNumericInput(trip.tripGross);
    const tripMiles = parseNumericInput(trip.tripMiles);
    const daysInTrip = parseNumericInput(trip.daysInTrip) || 1;

    const rentCharge = (parseNumericInput(settings.rentPerWeek) / 7) * daysInTrip;
    const percentageCharge = tripGross * (parseNumericInput(settings.percentageFromGross) / 100);
    const companyMileCharge = tripMiles * parseNumericInput(settings.ratePerMileCompanyCharge);
    const calculatedCompanyDeductions = rentCharge + percentageCharge + companyMileCharge;
    
    const standardExpensesList = trip.tripExpenses?.standard || settings.expenses;
    const customExpensesList = trip.tripExpenses?.custom || settings.customExpenses;

    const standardExpenses = standardExpensesList
        ?.filter(e => e.enabled)
        .reduce((acc, curr) => acc + parseNumericInput(curr.amount), 0) || 0;

    const customExpenses = customExpensesList
        ?.filter(e => e.enabled)
        .reduce((acc, curr) => acc + parseNumericInput(curr.amount), 0) || 0;

    const calculatedAdditionalExpenses = standardExpenses + customExpenses;

    const calculatedTotalExpenses = calculatedCompanyDeductions + calculatedAdditionalExpenses;
    const calculatedNetProfit = tripGross - calculatedTotalExpenses;
    const calculatedRatePerMile = tripMiles > 0 ? tripGross / tripMiles : 0;

    return {
        calculatedCompanyDeductions,
        calculatedAdditionalExpenses,
        calculatedTotalExpenses,
        calculatedNetProfit,
        calculatedRatePerMile,
    };
};

// --- КОМПОНЕНТЫ ПРИЛОЖЕНИЯ ---
const AppHeader = ({ theme, setTheme, userSettings }) => (
    <header className="sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-3">
                    <motion.div
                        whileHover={{ rotate: -5, scale: 1.1 }}
                        className="p-1 rounded-full bg-gradient-to-br from-indigo-600 to-blue-500"
                    >
                        <Truck className="h-6 w-6 text-white" />
                    </motion.div>
                    <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400">
                        MRSM EXPRESS INC
                    </h1>
                </div>
                <div className="flex items-center space-x-4">
                     {userSettings?.nickname && (
                        <div className="hidden sm:block text-sm font-semibold text-blue-600 dark:text-blue-300">
                             <span className="flex items-center"><User size={16} className="mr-1.5"/>{userSettings.nickname}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    </header>
);

const NavigationTabs = ({ activeTab, setActiveTab }) => {
    const tabs = [
        { id: 'entry', label: 'Ввод / Настройки' },
        { id: 'diary', label: 'Дневник / Отчеты' },
    ];

    return (
        <div className="p-2 bg-slate-200 dark:bg-slate-900 rounded-xl m-4 flex items-center space-x-2">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                        activeTab === tab.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    } relative w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2`}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                >
                    {activeTab === tab.id && (
                        <motion.span
                            layoutId="bubble"
                            className="absolute inset-0 z-10 bg-white dark:bg-gradient-to-br dark:from-slate-700 dark:to-slate-800 shadow"
                            style={{ borderRadius: 8 }}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <span className="relative z-20">{tab.label}</span>
                </button>
            ))}
        </div>
    );
};

const TripForm = ({ tripData, setTripData, onAddTrip }) => {
    
    const handleChange = (e) => {
        const { id, value } = e.target;
        setTripData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onAddTrip(tripData);
    };
    
    return (
        <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center"><Plus className="mr-2 text-green-500 dark:text-green-400"/> Ввод новой поездки</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField id="date" label="Дата" type="date" value={tripData.date} onChange={handleChange} required icon={CalendarDays} />
                    <InputField id="daysInTrip" label="Дней в поездке" type="number" value={tripData.daysInTrip} onChange={handleChange} required icon={Clock} placeholder="1" />
                    <InputField id="fromLocation" label="Откуда" type="text" value={tripData.fromLocation} onChange={handleChange} required icon={MapPin} placeholder="Город, Штат"/>
                    <InputField id="toLocation" label="Куда" type="text" value={tripData.toLocation} onChange={handleChange} required icon={MapPin} placeholder="Город, Штат"/>
                    <InputField id="tripGross" label="Gross за поездку ($)" type="number" value={tripData.tripGross} onChange={handleChange} required icon={DollarSign} placeholder="0.00"/>
                    <InputField id="tripMiles" label="Мили за поездку" type="number" value={tripData.tripMiles} onChange={handleChange} required icon={TrendingUp} placeholder="0"/>
                </div>
                <TextareaField id="notes" label="Заметки" value={tripData.notes} onChange={handleChange} icon={FileText} placeholder="Любая дополнительная информация" />
                <StyledButton type="submit" icon={Plus}>Добавить поездку</StyledButton>
            </form>
        </Card>
    );
};

const SettingsAccordion = ({ settings, onSettingsChange, onCustomExpenseChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [newCustomExpense, setNewCustomExpense] = useState('');

    const handleAddCustomExpense = () => {
        if (newCustomExpense.trim() !== '') {
            onCustomExpenseChange('add', {
                id: crypto.randomUUID(),
                name: newCustomExpense.trim(),
                enabled: true,
                amount: 0
            });
            setNewCustomExpense('');
        }
    };

    return (
        <Card>
            <div onClick={() => setIsOpen(!isOpen)} className="flex justify-between items-center cursor-pointer">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                    <Settings className="mr-2 text-blue-500 dark:text-blue-400"/>
                    Настройка условий и расходов
                </h2>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDown className="text-slate-500 dark:text-slate-400"/>
                </motion.div>
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginTop: '24px' }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-6">
                            <Card className="bg-slate-100/50 dark:bg-slate-900/50 p-4">
                                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Общие настройки</h3>
                                <InputField id="nickname" label="Ваш никнейм" type="text" value={settings.nickname || ''} onChange={e => onSettingsChange('nickname', e.target.value)} icon={User} placeholder="BigWheel Joe"/>
                            </Card>
                            
                            <Card className="bg-slate-100/50 dark:bg-slate-900/50 p-4">
                                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Условия компании</h3>
                                <div className="space-y-4">
                                    <InputField id="rentPerWeek" label="Аренда в неделю ($)" type="number" value={settings.rentPerWeek || ''} onChange={e => onSettingsChange('rentPerWeek', e.target.value)} placeholder="0.00"/>
                                    <InputField id="percentageFromGross" label="Процент от Gross (%)" type="number" value={settings.percentageFromGross || ''} onChange={e => onSettingsChange('percentageFromGross', e.target.value)} placeholder="0"/>
                                    <InputField id="ratePerMileCompanyCharge" label="За милю ($) (плата компании)" type="number" value={settings.ratePerMileCompanyCharge || ''} onChange={e => onSettingsChange('ratePerMileCompanyCharge', e.target.value)} placeholder="0.00"/>
                                </div>
                            </Card>

                            <Card className="bg-slate-100/50 dark:bg-slate-900/50 p-4">
                                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Дополнительные расходы (стандартные)</h3>
                                <div className="space-y-3">
                                    {settings.expenses?.map((expense, index) => (
                                        <div key={index} className="flex items-center justify-between space-x-2">
                                            <CustomToggle enabled={expense.enabled} onChange={() => onSettingsChange('toggleExpense', index)} />
                                            <span className="flex-1 text-slate-700 dark:text-slate-300">{expense.name}</span>
                                            <InputField id={`expense-${index}`} label="" type="number" value={expense.amount || ''} onChange={e => onSettingsChange('updateExpense', { index, value: e.target.value })} className="w-28" placeholder="0.00"/>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                            
                            <Card className="bg-slate-100/50 dark:bg-slate-900/50 p-4">
                                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Свои расходы</h3>
                                <div className="space-y-3">
                                    {settings.customExpenses?.map((expense, index) => (
                                         <div key={expense.id} className="flex items-center justify-between space-x-2">
                                            <CustomToggle enabled={expense.enabled} onChange={() => onCustomExpenseChange('toggle', index)} />
                                            <span className="flex-1 text-slate-700 dark:text-slate-300">{expense.name}</span>
                                            <InputField id={`custom-expense-${index}`} label="" type="number" value={expense.amount || ''} onChange={e => onCustomExpenseChange('update', { index, value: e.target.value })} className="w-28" placeholder="0.00"/>
                                            <button onClick={() => onCustomExpenseChange('remove', index)} className="p-2 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-full transition-colors">
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex items-center space-x-2 pt-2">
                                        <InputField id="newCustomExpense" label="" placeholder="Название нового расхода" value={newCustomExpense} onChange={e => setNewCustomExpense(e.target.value)} className="flex-1" />
                                        <button onClick={handleAddCustomExpense} className="p-3 bg-green-500 hover:bg-green-600 rounded-xl text-white transition-colors">
                                            <Plus size={20}/>
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};

const FuelCheckOCR = ({ onFuelExpenseUpdate, setNotification }) => {
    const [imageFile, setImageFile] = useState(null);
    const [imageBase64, setImageBase64] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = React.useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageBase64(reader.result.split(',')[1]);
                setNotification({ message: '' }); 
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRecognize = async () => {
        if (!imageBase64) {
            setNotification({ message: 'Пожалуйста, сначала загрузите изображение чека.', type: 'error' });
            return;
        }
        setIsLoading(true);
        setNotification({ message: '' });

        try {
            const prompt = `КРАЙНЕ ВНИМАТЕЛЬНО проанализируй это изображение чека на топливо. Твоя задача - извлечь информацию о КАЖДОЙ топливной позиции (любой дизель, включая "REEFER FUEL", "TRKDS", "TRK DSL", "AUTO DSL", и DEF/AdBlue). Верни результат СТРОГО в формате JSON массива объектов. Не добавляй никакого текста до или после этого JSON массива. Каждый объект в массиве должен представлять ОДНУ топливную позицию с чека и содержать СЛЕДУЮЩИЕ ТРИ ПОЛЯ: 1. "productName": ТОЧНОЕ название продукта, как оно указано на чеке. 2. "gallons": Количество галлонов для этой ОДНОЙ позиции (число). Если галлоны не указаны, верни 0. 3. "cost": Стоимость для этой ОДНОЙ позиции (число). Если стоимость не указана, верни 0. Если на чеке нет НИ ОДНОЙ топливной позиции, верни пустой массив []. Убедись, что все значения "gallons" и "cost" являются числами. Ответ должен быть ТОЛЬКО JSON массивом.`;
            
            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }],
                generation_config: { response_mime_type: "application/json" }
            };
            
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("API ключ для Gemini не найден. Добавьте VITE_GEMINI_API_KEY в переменные окружения.");
            }
            
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();

            if (!response.ok) {
                 console.error("API Error Body:", result);
                 throw new Error(`Ошибка API: ${result.error?.message || response.statusText}`);
            }

            if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts.length > 0) {
                const parsedResult = JSON.parse(result.candidates[0].content.parts[0].text);
                if (Array.isArray(parsedResult) && parsedResult.length > 0) {
                   processOcrResult(parsedResult);
                } else {
                   throw new Error("Не удалось распознать топливные позиции на чеке. Попробуйте сделать фото четче.");
                }
            } else {
                throw new Error("Не удалось распознать данные. Ответ от AI некорректен.");
            }

        } catch (err) {
            console.error(err);
            setNotification({ message: err.message || 'Произошла неизвестная ошибка при распознавании.', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const processOcrResult = (items) => {
        let totalAllDieselGallons = 0;
        let totalAllDieselCostBeforeDiscount = 0;
        let totalDefCost = 0;

        items.forEach(item => {
            const productNameLower = (item.productName || '').toLowerCase();
            const itemGallons = parseNumericInput(item.gallons);
            const itemCost = parseNumericInput(item.cost);
            
            if (ALL_DIESEL_KEYWORDS.some(keyword => productNameLower.includes(keyword))) {
                totalAllDieselGallons += itemGallons;
                totalAllDieselCostBeforeDiscount += itemCost;
            } else if (DEF_KEYWORDS.some(keyword => productNameLower.includes(keyword))) {
                totalDefCost += itemCost;
            }
        });
        
        let totalDiscountOnAllDiesel = 0;
        if(totalAllDieselGallons > 0 && totalAllDieselCostBeforeDiscount > 0){
             totalDiscountOnAllDiesel = totalAllDieselGallons * DIESEL_DISCOUNT_PER_GALLON;
        }
        
        const finalAllDieselCostAfterDiscount = totalAllDieselCostBeforeDiscount - totalDiscountOnAllDiesel;
        const finalCombinedExpense = (finalAllDieselCostAfterDiscount > 0 ? finalAllDieselCostAfterDiscount : 0) + totalDefCost;
        
        if (finalCombinedExpense > 0) {
            onFuelExpenseUpdate(finalCombinedExpense);
            setImageFile(null); 
            setImageBase64('');
        } else {
             setNotification({ message: "Не удалось рассчитать итоговую сумму по чеку. Убедитесь, что на фото видны стоимость и галлоны.", type: 'error' });
        }
    };
    
    return (
        <Card>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center mb-2"><FileScan className="mr-2 text-purple-400"/>Чек на топливо <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">(Экспериментально)</span></h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Загрузите фото чека. AI попытается распознать дизель и DEF, а затем применит скидку $0.60/галлон на весь дизель.</p>
            <div className="space-y-4">
                 <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                 />
                <button onClick={() => fileInputRef.current.click()} className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                     <UploadCloud className="w-8 h-8 text-slate-500 dark:text-slate-400 mb-2"/>
                     <span className="text-slate-600 dark:text-slate-300 font-semibold">
                        {imageFile ? `Выбран файл: ${imageFile.name}` : 'Нажмите, чтобы загрузить фото'}
                     </span>
                     <span className="text-xs text-slate-400 dark:text-slate-500">PNG, JPG, GIF</span>
                </button>

                {imageBase64 && (
                     <div className="flex justify-center">
                        <img src={`data:image/jpeg;base64,${imageBase64}`} alt="Превью чека" className="max-h-48 rounded-lg shadow-lg"/>
                     </div>
                )}
                
                <StyledButton onClick={handleRecognize} icon={Play} disabled={!imageBase64 || isLoading} className="bg-gradient-to-br from-purple-600 to-indigo-600">
                    {isLoading ? <><Loader2 className="animate-spin mr-2"/> Обработка...</> : "Распознать чек"}
                </StyledButton>
            </div>
        </Card>
    );
};

const PreliminaryCalculation = ({ tripData, settings }) => {
    const calc = useMemo(() => calculateTripProfit(tripData, settings), [tripData, settings]);
    
    const renderValue = (value) => (
        <AnimatePresence mode="wait">
            <motion.span
                key={value}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
            >
                {formatCurrency(value)}
            </motion.span>
        </AnimatePresence>
    );

    return (
        <Card>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Предварительный расчет</h2>
            <div className="space-y-2 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between items-center">
                    <span>Расходы компании:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{renderValue(calc.calculatedCompanyDeductions)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span>Доп. расходы (из настроек):</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{renderValue(calc.calculatedAdditionalExpenses)}</span>
                </div>
                <hr className="border-slate-300 dark:border-slate-700 my-2"/>
                <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-slate-900 dark:text-white">Всего расходов:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{renderValue(calc.calculatedTotalExpenses)}</span>
                </div>
                <div className={`flex justify-between items-center text-lg p-2 rounded-lg ${parseNumericInput(calc.calculatedNetProfit) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <span className="font-bold text-slate-900 dark:text-white">Чистая прибыль:</span>
                    <span className={`font-bold ${parseNumericInput(calc.calculatedNetProfit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{renderValue(calc.calculatedNetProfit)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                    <span className="text-sm">Rate per Mile (Gross/Miles):</span>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(calc.calculatedRatePerMile)}</span>
                </div>
            </div>
        </Card>
    );
};

const DateRangeSummary = ({ trips, title }) => {
    const summary = useMemo(() => {
        if (!trips || trips.length === 0) {
            return { totalTrips: 0, totalGross: 0, totalMiles: 0, totalProfit: 0, avgRpm: 0, avgProfitPerTrip: 0 };
        }
        
        const totalGross = trips.reduce((sum, trip) => sum + parseNumericInput(trip.tripGross), 0);
        const totalMiles = trips.reduce((sum, trip) => sum + parseNumericInput(trip.tripMiles), 0);
        const totalProfit = trips.reduce((sum, trip) => sum + parseNumericInput(trip.calculatedNetProfit), 0);
        
        return {
            totalTrips: trips.length,
            totalGross,
            totalMiles,
            totalProfit,
            avgRpm: totalMiles > 0 ? totalGross / totalMiles : 0,
            avgProfitPerTrip: trips.length > 0 ? totalProfit / trips.length : 0,
        };
    }, [trips]);

    const StatCard = ({ label, value, isCurrency = false, profitColor = false }) => (
        <div className="bg-slate-100 dark:bg-slate-900/70 p-4 rounded-xl flex-1 text-center min-w-[120px]">
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`text-xl font-bold ${profitColor ? (parseNumericInput(value) >= 0 ? 'text-green-500' : 'text-red-500') : 'text-slate-800 dark:text-white'}`}>
                {isCurrency ? formatCurrency(value) : (value?.toLocaleString('en-US') || '0')}
            </p>
        </div>
    );
    
    return (
        <Card>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center"><TrendingUp className="mr-2 text-indigo-500 dark:text-indigo-400"/>{title}</h2>
            <div className="flex flex-wrap gap-3">
                <StatCard label="Всего поездок" value={summary.totalTrips} />
                <StatCard label="Общий Gross" value={summary.totalGross} isCurrency />
                <StatCard label="Общие Мили" value={summary.totalMiles} />
                <StatCard label="Общая Прибыль" value={summary.totalProfit} isCurrency profitColor />
                <StatCard label="Общий RPM" value={summary.avgRpm} isCurrency />
                <StatCard label="Средняя прибыль/поездка" value={summary.avgProfitPerTrip} isCurrency profitColor />
            </div>
        </Card>
    );
}

const TripListItem = ({ trip, onEdit, onDelete }) => {
    const tripDate = parseISO(trip.date);
    const formattedDate = isValid(tripDate) 
        ? format(tripDate, "d MMMM yyyy 'г.'", { locale: ru })
        : "Неверная дата";

    const rpm = useMemo(() => {
        const gross = parseNumericInput(trip.tripGross);
        const miles = parseNumericInput(trip.tripMiles);
        return miles > 0 ? gross / miles : 0;
    }, [trip.tripGross, trip.tripMiles]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{trip.fromLocation} → {trip.toLocation}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formattedDate} - {trip.daysInTrip} дн.</p>
                </div>
                 <div className="flex items-center space-x-2">
                    <button onClick={() => onEdit(trip)} className="p-2 rounded-full text-blue-500 dark:text-blue-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => onDelete(trip.id)} className="p-2 rounded-full text-red-500 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors"><Trash2 size={18}/></button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
                <div className="bg-slate-200/70 dark:bg-slate-800/50 p-2 rounded-md">
                    <p className="text-xs text-slate-500 dark:text-slate-500">Gross</p>
                    <p className="font-semibold text-slate-800 dark:text-white">{formatCurrency(trip.tripGross)}</p>
                </div>
                 <div className="bg-slate-200/70 dark:bg-slate-800/50 p-2 rounded-md">
                    <p className="text-xs text-slate-500 dark:text-slate-500">Мили</p>
                    <p className="font-semibold text-slate-800 dark:text-white">{trip.tripMiles}</p>
                </div>
                <div className="bg-slate-200/70 dark:bg-slate-800/50 p-2 rounded-md">
                    <p className="text-xs text-slate-500 dark:text-slate-500">RPM</p>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(rpm)}</p>
                </div>
                 <div className={`p-2 rounded-md ${parseNumericInput(trip.calculatedNetProfit) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <p className="text-xs text-slate-500 dark:text-slate-500">Прибыль</p>
                    <p className={`font-semibold ${parseNumericInput(trip.calculatedNetProfit) >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(trip.calculatedNetProfit)}</p>
                </div>
            </div>
            {trip.notes && (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic bg-slate-200/70 dark:bg-slate-800/50 p-2 rounded-md">Заметка: {trip.notes}</p>
            )}
        </motion.div>
    )
}

const TripsByPeriod = ({ trips, onEdit, onDelete }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });

    const filteredTrips = useMemo(() => {
        return (trips || [])
            .filter(trip => {
                const tripDate = parseISO(trip.date);
                return isValid(tripDate) && tripDate >= start && tripDate <= end;
            })
            .sort((a, b) => parseISO(b.date) - parseISO(a.date));
    }, [trips, start, end]);

    const weeklySummary = useMemo(() => {
        if (!filteredTrips || filteredTrips.length === 0) {
            return null;
        }
        const totalGross = filteredTrips.reduce((sum, trip) => sum + parseNumericInput(trip.tripGross), 0);
        const totalMiles = filteredTrips.reduce((sum, trip) => sum + parseNumericInput(trip.tripMiles), 0);
        const totalProfit = filteredTrips.reduce((sum, trip) => sum + parseNumericInput(trip.calculatedNetProfit), 0);
        return {
            totalGross,
            totalMiles,
            totalProfit,
            avgRpm: totalMiles > 0 ? totalGross / totalMiles : 0,
        };
    }, [filteredTrips]);

    const StatItem = ({ label, value, isCurrency = false, profitColor = false }) => (
        <div className="bg-slate-200/70 dark:bg-slate-800/50 p-2 rounded-md">
            <p className="text-xs text-slate-500 dark:text-slate-500">{label}</p>
            <p className={`font-semibold ${profitColor ? (parseNumericInput(value) >= 0 ? 'text-green-500' : 'text-red-500') : 'text-slate-800 dark:text-white'}`}>
                {isCurrency ? formatCurrency(value) : (value?.toLocaleString('en-US') || '0')}
            </p>
        </div>
    );

    const prevWeek = () => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const nextWeek = () => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    
    return (
        <Card>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Поездки по неделям</h2>
            <div className="flex justify-between items-center mb-4 bg-slate-100 dark:bg-slate-900/70 p-2 rounded-xl">
                 <button onClick={prevWeek} className="p-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ChevronsLeft /></button>
                 <div className="text-center">
                    <p className="font-semibold text-slate-800 dark:text-white">Неделя {getWeek(currentDate, { weekStartsOn: 1 })}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{format(start, 'd MMM', { locale: ru })} - {format(end, 'd MMM yyyy', { locale: ru })}</p>
                 </div>
                 <button onClick={nextWeek} className="p-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><ChevronsRight /></button>
            </div>

            {weeklySummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm">
                    <StatItem label="Gross Недели" value={weeklySummary.totalGross} isCurrency />
                    <StatItem label="Мили Недели" value={weeklySummary.totalMiles} />
                    <StatItem label="RPM Недели" value={weeklySummary.avgRpm} isCurrency />
                    <StatItem label="Прибыль Недели" value={weeklySummary.totalProfit} isCurrency profitColor />
                </div>
            )}

            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                <AnimatePresence>
                {filteredTrips.length > 0 ? (
                    filteredTrips.map(trip => <TripListItem key={trip.id} trip={trip} onEdit={onEdit} onDelete={onDelete} />)
                ) : (
                    <motion.p layout className="text-center text-slate-500 dark:text-slate-400 py-8">Нет поездок за эту неделю.</motion.p>
                )}
                </AnimatePresence>
            </div>
        </Card>
    );
};

const DateRangePicker = ({ onDateChange, onReset }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
        if (e.target.value && endDate) {
            onDateChange(e.target.value, endDate);
        }
    };
    
    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
        if (startDate && e.target.value) {
            onDateChange(startDate, e.target.value);
        }
    };

    const handleReset = () => {
        setStartDate('');
        setEndDate('');
        onReset();
    };

    return (
        <Card>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                <CalendarDays className="mr-2 text-green-500 dark:text-green-400"/>
                Фильтр по дате
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField 
                    id="startDate" 
                    label="С" 
                    type="date" 
                    value={startDate} 
                    onChange={handleStartDateChange} 
                />
                <InputField 
                    id="endDate" 
                    label="По" 
                    type="date" 
                    value={endDate} 
                    onChange={handleEndDateChange}
                />
            </div>
            {(startDate || endDate) && (
                <div className="mt-4">
                    <DestructiveButton onClick={handleReset} icon={X}>Сбросить период</DestructiveButton>
                </div>
            )}
        </Card>
    );
};

const EditTripModal = ({ trip, onSave, onCancel, settings }) => {
    const [editData, setEditData] = useState(trip);
    
    const [tripExpenses, setTripExpenses] = useState(
        trip.tripExpenses || { 
            standard: settings.expenses.map(e => ({...e})), 
            custom: settings.customExpenses.map(e => ({...e})) 
        }
    );

    useEffect(() => {
        setEditData(trip);
        setTripExpenses(
            trip.tripExpenses || { 
                standard: settings.expenses.map(e => ({...e, amount: 0})),
                custom: settings.customExpenses.map(e => ({...e, amount: 0})) 
            }
        );
    }, [trip, settings]);

    const handleChange = (e) => {
        const { id, value } = e.target;
        setEditData(prev => ({ ...prev, [id]: value }));
    };

    const handleExpenseChange = (type, index, value) => {
        setTripExpenses(prev => {
            const newExpenses = { ...prev };
            newExpenses[type][index].amount = value;
            return newExpenses;
        });
    };

    const handleSave = () => {
        onSave({ ...editData, tripExpenses });
    };

    if (!trip) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4"
        >
            <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative"
            >
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Редактировать поездку</h2>
                <button onClick={onCancel} className="absolute top-4 right-4 p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={20}/></button>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField id="date" label="Дата" type="date" value={editData.date} onChange={handleChange} required icon={CalendarDays} />
                        <InputField id="daysInTrip" label="Дней в поездке" type="number" value={editData.daysInTrip} onChange={handleChange} required icon={Clock} placeholder="1" />
                        <InputField id="fromLocation" label="Откуда" type="text" value={editData.fromLocation} onChange={handleChange} required icon={MapPin} placeholder="Город, Штат"/>
                        <InputField id="toLocation" label="Куда" type="text" value={editData.toLocation} onChange={handleChange} required icon={MapPin} placeholder="Город, Штат"/>
                        <InputField id="tripGross" label="Gross за поездку ($)" type="number" value={editData.tripGross} onChange={handleChange} required icon={DollarSign} placeholder="0.00"/>
                        <InputField id="tripMiles" label="Мили за поездку" type="number" value={editData.tripMiles} onChange={handleChange} required icon={TrendingUp} placeholder="0"/>
                    </div>
                    <TextareaField id="notes" label="Заметки" value={editData.notes} onChange={handleChange} icon={FileText} placeholder="Любая дополнительная информация" />
                    
                    <div className="pt-4">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-3">Расходы за эту поездку</h3>
                        <div className="space-y-3">
                            {tripExpenses.standard?.map((expense, index) => (
                                <div key={`std-${index}`} className="flex items-center justify-between space-x-2">
                                    <span className="flex-1 text-slate-700 dark:text-slate-300">{expense.name}</span>
                                    <InputField id={`std-exp-${index}`} label="" type="number" value={expense.amount || ''} onChange={e => handleExpenseChange('standard', index, e.target.value)} className="w-28" placeholder="0.00" disabled={!expense.enabled}/>
                                </div>
                            ))}
                             {tripExpenses.custom?.map((expense, index) => (
                                <div key={`cst-${index}`} className="flex items-center justify-between space-x-2">
                                    <span className="flex-1 text-slate-700 dark:text-slate-300">{expense.name}</span>
                                    <InputField id={`cst-exp-${index}`} label="" type="number" value={expense.amount || ''} onChange={e => handleExpenseChange('custom', index, e.target.value)} className="w-28" placeholder="0.00" disabled={!expense.enabled}/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end items-center gap-4 mt-8">
                     <button onClick={onCancel} className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Отмена</button>
                     <StyledButton onClick={handleSave} icon={Save} className="bg-gradient-to-br from-green-600 to-teal-600">Сохранить</StyledButton>
                </div>
            </motion.div>
        </motion.div>
    );
}

const NotificationModal = ({ message, type, onConfirm, onCancel }) => {
    if(!message) return null;
    
    const icons = {
        success: <Plus className="w-8 h-8 text-green-500 dark:text-green-400"/>,
        error: <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400"/>,
        confirm: <AlertTriangle className="w-8 h-8 text-yellow-500 dark:text-yellow-400"/>
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4"
        >
             <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center"
            >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-900 mb-4">
                    {icons[type]}
                </div>
                <p className="text-slate-800 dark:text-white font-semibold mb-6">{message}</p>
                {type === 'confirm' ? (
                     <div className="flex justify-center gap-4">
                         <button onClick={onCancel} className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-1">Отмена</button>
                         <DestructiveButton onClick={onConfirm} className="flex-1">Удалить</DestructiveButton>
                     </div>
                ) : (
                    <StyledButton onClick={onCancel}>OK</StyledButton>
                )}
            </motion.div>
        </motion.div>
    )
}

// --- ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ ---
export default function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [activeTab, setActiveTab] = useState('entry');
    const [userId, setUserId] = useState(null);
    const [userSettings, setUserSettings] = useState(null);
    const [trips, setTrips] = useState([]);
    const [isAuthComplete, setIsAuthComplete] = useState(false);
    const [newTripData, setNewTripData] = useState(INITIAL_TRIP_FORM_STATE);
    const [editingTrip, setEditingTrip] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: '', onConfirm: null, onCancel: null });
    
    const [dateRange, setDateRange] = useState({ from: null, to: null });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        if (!areFirebaseKeysAvailable) return;

        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Anonymous sign-in error:", error);
                    setNotification({ message: 'Не удалось войти. Данные не будут сохраняться.', type: 'error' });
                }
            }
            setIsAuthComplete(true);
        });
    }, []);

    useEffect(() => {
        if (!userId || !areFirebaseKeysAvailable) {
            if(isAuthComplete) setUserSettings(DEFAULT_USER_SETTINGS);
            return;
        };

        const firestorePathPrefix = `artifacts/${firebaseConfig.projectId}/users/${userId}`;
        
        const settingsRef = doc(db, `${firestorePathPrefix}/settings`, 'appSettings');
        const settingsUnsub = onSnapshot(settingsRef, (docSnap) => {
            const data = docSnap.exists() ? docSnap.data() : DEFAULT_USER_SETTINGS;
            setUserSettings(data);
            if (!docSnap.exists()) {
                setDoc(settingsRef, DEFAULT_USER_SETTINGS);
            }
        }, (error) => {
            console.error("Settings loading error:", error);
            setNotification({ message: 'Ошибка загрузки настроек.', type: 'error' });
            setUserSettings(DEFAULT_USER_SETTINGS);
        });

        const tripsRef = collection(db, `${firestorePathPrefix}/trips`);
        const q = query(tripsRef, firestoreOrderBy('date', 'desc'));
        const tripsUnsub = onSnapshot(q, (querySnapshot) => {
            const tripsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTrips(tripsData);
        }, (error) => {
            console.error("Trips loading error:", error);
            setNotification({ message: 'Ошибка загрузки поездок.', type: 'error' });
        });
        
        return () => {
            settingsUnsub();
            tripsUnsub();
        };
    }, [userId, isAuthComplete]);
    
    const filteredTripsByDate = useMemo(() => {
        if (!dateRange.from || !dateRange.to) {
            return trips; 
        }
        try {
            const from = startOfDay(parseISO(dateRange.from));
            const to = endOfDay(parseISO(dateRange.to));

            if (!isValid(from) || !isValid(to)) return trips;

            return trips.filter(trip => {
                const tripDate = parseISO(trip.date);
                return isValid(tripDate) && tripDate >= from && tripDate <= to;
            });
        } catch (e) {
            return trips;
        }
    }, [trips, dateRange]);

    const handleDateChange = (startDate, endDate) => {
        setDateRange({ from: startDate, to: endDate });
    };

    const handleDateReset = () => {
        setDateRange({ from: null, to: null });
    };

    const debouncedSaveSettings = useCallback(
        debounce((newSettings) => {
            if (userId && areFirebaseKeysAvailable) {
                const settingsRef = doc(db, `artifacts/${firebaseConfig.projectId}/users/${userId}/settings`, 'appSettings');
                setDoc(settingsRef, newSettings, { merge: true }).catch(err => {
                     console.error("Settings save error:", err);
                     setNotification({ message: 'Не удалось сохранить настройки.', type: 'error' });
                });
            }
        }, 1000),
        [userId]
    );

    const handleSettingsChange = (key, value) => {
        setUserSettings(prevSettings => {
            const newSettings = JSON.parse(JSON.stringify(prevSettings));
            if (key === 'updateExpense') {
                newSettings.expenses[value.index].amount = value.value;
            } else if (key === 'toggleExpense') {
                newSettings.expenses[value].enabled = !newSettings.expenses[value].enabled;
            } else {
                newSettings[key] = value;
            }
            debouncedSaveSettings(newSettings);
            return newSettings;
        });
    };

    const handleCustomExpenseChange = (action, payload) => {
        setUserSettings(prevSettings => {
            const newSettings = JSON.parse(JSON.stringify(prevSettings));
            if(!newSettings.customExpenses) newSettings.customExpenses = [];

            switch(action) {
                case 'add':
                    newSettings.customExpenses.push(payload);
                    break;
                case 'remove':
                     newSettings.customExpenses.splice(payload, 1);
                    break;
                case 'toggle':
                    newSettings.customExpenses[payload].enabled = !newSettings.customExpenses[payload].enabled;
                    break;
                case 'update':
                    newSettings.customExpenses[payload.index].amount = payload.value;
                    break;
                default: break;
            }
            debouncedSaveSettings(newSettings);
            return newSettings;
        });
    }
    
    const handleFuelExpenseUpdate = (amount) => {
        setUserSettings(prevSettings => {
            const newSettings = JSON.parse(JSON.stringify(prevSettings));
            const fuelIndex = newSettings.expenses.findIndex(e => e.name === "Топливо");
            if(fuelIndex !== -1){
                const currentAmount = parseNumericInput(newSettings.expenses[fuelIndex].amount);
                const newAmount = currentAmount + parseNumericInput(amount);
                newSettings.expenses[fuelIndex].amount = newAmount.toFixed(2);
                
                debouncedSaveSettings(newSettings);
                setNotification({ message: `К расходу "Топливо" добавлено ${formatCurrency(amount)}`, type: 'success' });
                return newSettings;
            }
            return prevSettings;
        });
    };

    const resetAllExpenses = () => {
        setUserSettings(prevSettings => {
            const newSettings = JSON.parse(JSON.stringify(prevSettings));
            newSettings.expenses.forEach(exp => exp.amount = 0);
            if (newSettings.customExpenses) {
                newSettings.customExpenses.forEach(exp => exp.amount = 0);
            }
            debouncedSaveSettings(newSettings);
            return newSettings;
        });
    };
    
    const handleAddTrip = async (tripData) => {
        if (!userId || !areFirebaseKeysAvailable) {
             setNotification({ message: 'Вы не авторизованы. Поездка не будет сохранена.', type: 'error' });
             return;
        }
        if(!tripData.tripGross || !tripData.tripMiles){
             setNotification({ message: 'Пожалуйста, заполните поля Gross и Мили.', type: 'error' });
             return;
        }

        const tripExpenses = {
            standard: userSettings.expenses.map(e => ({...e})),
            custom: userSettings.customExpenses.map(e => ({...e}))
        };
        
        const tempTripForCalc = {...tripData, tripExpenses};
        const calculatedValues = calculateTripProfit(tempTripForCalc, userSettings);

        const newTrip = {
            ...tripData,
            tripExpenses,
            ...calculatedValues,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        try {
            const tripsRef = collection(db, `artifacts/${firebaseConfig.projectId}/users/${userId}/trips`);
            await addDoc(tripsRef, newTrip);
            setNotification({ message: 'Поездка успешно добавлена!', type: 'success' });
            setNewTripData(INITIAL_TRIP_FORM_STATE);
            resetAllExpenses();
        } catch (error) {
            console.error("Add trip error:", error);
            setNotification({ message: 'Не удалось добавить поездку.', type: 'error' });
        }
    };
    
    const handleUpdateTrip = async (updatedTrip) => {
        if(!userId || !updatedTrip.id || !areFirebaseKeysAvailable){
             setNotification({ message: 'Ошибка обновления поездки.', type: 'error' });
             return;
        }
        const calculatedValues = calculateTripProfit(updatedTrip, userSettings);
        const finalTripData = {
            ...updatedTrip,
            ...calculatedValues,
            updatedAt: serverTimestamp()
        };
        
        try {
            const tripRef = doc(db, `artifacts/${firebaseConfig.projectId}/users/${userId}/trips`, updatedTrip.id);
            await updateDoc(tripRef, finalTripData);
            setNotification({ message: 'Поездка успешно обновлена!', type: 'success' });
            setEditingTrip(null);
        } catch (error) {
            console.error("Update trip error:", error);
            setNotification({ message: 'Не удалось обновить поездку.', type: 'error' });
        }
    }
    
    const handleDeleteTrip = (tripId) => {
        setNotification({
            message: 'Вы уверены, что хотите удалить эту поездку? Это действие необратимо.',
            type: 'confirm',
            onConfirm: () => confirmDeleteAction(tripId)
        });
    }

    const confirmDeleteAction = async (tripId) => {
        closeNotification();
        if (!userId || !tripId || !areFirebaseKeysAvailable) return;
        try {
            const tripRef = doc(db, `artifacts/${firebaseConfig.projectId}/users/${userId}/trips`, tripId);
            await deleteDoc(tripRef);
            setNotification({ message: 'Поездка удалена.', type: 'success' });
        } catch (error) {
            console.error("Delete trip error:", error);
            setNotification({ message: 'Не удалось удалить поездку.', type: 'error' });
        }
    };

    const closeNotification = () => {
        setNotification({ message: '', type: '' });
    };
    
    if (!areFirebaseKeysAvailable) {
        return (
            <div className="min-h-screen bg-red-900 text-white flex flex-col justify-center items-center p-4 text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-300 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Критическая Ошибка Конфигурации</h1>
                <p className="max-w-md">Приложение не может подключиться к базе данных, потому что ключи Firebase не найдены.</p>
                <p className="mt-4 text-sm text-yellow-200 bg-red-800 p-3 rounded-lg">
                    <strong>Что делать:</strong> Пожалуйста, вернитесь на сайт Vercel, зайдите в настройки проекта (Settings -> Environment Variables) и убедитесь, что все 6 переменных `VITE_FIREBASE_...` добавлены правильно, без опечаток в именах и значениях.
                </p>
            </div>
        );
    }

    if (!isAuthComplete || !userSettings) {
        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col justify-center items-center text-slate-800 dark:text-white">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500 dark:text-indigo-400 mb-4" />
                <p className="text-lg">Подключение и аутентификация...</p>
            </div>
        );
    }

    return (
        <div className={`min-h-screen font-sans bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-blue-950 text-slate-700 dark:text-slate-300 transition-colors duration-300`}>
            <AppHeader theme={theme} setTheme={setTheme} userSettings={userSettings} />
            <main className="container mx-auto px-2 sm:px-4 lg:px-6 pb-8">
                <NavigationTabs activeTab={activeTab} setActiveTab={setActiveTab} />
                
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: activeTab === 'entry' ? -50 : 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: activeTab === 'entry' ? 50 : -50 }}
                        transition={{ duration: 0.3 }}
                    >
                        {activeTab === 'entry' && (
                            <div className="space-y-6">
                                <TripForm onAddTrip={handleAddTrip} tripData={newTripData} setTripData={setNewTripData} />
                                <PreliminaryCalculation tripData={newTripData} settings={userSettings} />
                                <FuelCheckOCR onFuelExpenseUpdate={handleFuelExpenseUpdate} setNotification={setNotification} />
                                <SettingsAccordion settings={userSettings} onSettingsChange={handleSettingsChange} onCustomExpenseChange={handleCustomExpenseChange}/>
                            </div>
                        )}

                        {activeTab === 'diary' && (
                            <div className="space-y-6">
                                <DateRangePicker onDateChange={handleDateChange} onReset={handleDateReset} />
                                <DateRangeSummary 
                                    trips={filteredTripsByDate} 
                                    title={!dateRange.from ? "Общие итоги за все время" : "Итоги за выбранный период"}
                                />
                                <TripsByPeriod trips={trips} onEdit={setEditingTrip} onDelete={handleDeleteTrip}/>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
            
            <AnimatePresence>
                {editingTrip && (
                    <EditTripModal 
                        trip={editingTrip} 
                        onSave={handleUpdateTrip} 
                        onCancel={() => setEditingTrip(null)}
                        settings={userSettings}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {notification.message && (
                    <NotificationModal 
                        message={notification.message} 
                        type={notification.type} 
                        onConfirm={notification.onConfirm}
                        onCancel={notification.onCancel || closeNotification} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
