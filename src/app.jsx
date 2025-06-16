import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, query, orderBy as firestoreOrderBy } from 'firebase/firestore';
import { Truck, Settings, Plus, DollarSign, CalendarDays, Clock, MapPin, TrendingUp, FileText, ChevronDown, Trash2, Edit3, Save, X, Sun, Moon, UploadCloud, FileScan, Play, ChevronsLeft, ChevronsRight, Loader2, User, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, getWeek, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';

// --- НАСТРОЙКИ FIREBASE ---
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
const ALL_DIESEL_KEYWORDS = ["diesel", "dsl", "fuel", "reefer", "trkds", "trk dsl", "auto dsl", "trk diesel"];
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

const InputField = ({ icon: Icon, label, id, type = "text", value, onChange, placeholder, required = false, className = '' }) => (
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
                className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-slate-100 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300 shadow-inner`}
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

    const standardExpenses = settings.expenses
        ?.filter(e => e.enabled)
        .reduce((acc, curr) => acc + parseNumericInput(curr.amount), 0) || 0;

    const customExpenses = settings.customExpenses
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
    const [ocrResult, setOcrResult] = useState(null);
    const fileInputRef = React.useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageBase64(reader.result.split(',')[1]);
                setNotification({ message: '' }); 
                setOcrResult(null);
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
            // Улучшенный промпт с примерами
            const prompt = `Analyze this fuel receipt image and extract ALL fuel-related items. Return ONLY a JSON array with NO other text.

Important keywords to look for:
- Diesel keywords: "DIESEL", "DSL", "FUEL", "REEFER", "TRKDS", "TRK DSL", "AUTO DSL", "TRK DIESEL"
- DEF keywords: "DEF", "ADBLUE"

For each fuel item found, include:
{
  "productName": "exact name from receipt",
  "gallons": number (0 if not found),
  "cost": number (0 if not found)
}

Example response:
[
  {"productName": "TRK DSL", "gallons": 125.5, "cost": 435.98},
  {"productName": "DEF", "gallons": 8.0, "cost": 28.50}
]

Return empty array [] if no fuel items found.`;
            
            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/jpeg", data: imageBase64 } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json"
                }
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
                let parsedResult;
                const responseText = result.candidates[0].content.parts[0].text;
                
                try {
                    // Пытаемся распарсить ответ
                    parsedResult = JSON.parse(responseText);
                } catch (parseError) {
                    console.error("Parse error, response text:", responseText);
                    // Пытаемся извлечь JSON из текста
                    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        parsedResult = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error("Не удалось извлечь данные из ответа AI");
                    }
                }

                if (Array.isArray(parsedResult) && parsedResult.length > 0) {
                    setOcrResult(parsedResult);
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
