
// ═══════════════════════════════════════════════════════
// نظام الإشعارات — Notifications System
// ═══════════════════════════════════════════════════════

let notificationsEnabled = false;
let checkInterval = null;

// طلب صلاحية الإشعارات
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('❌ المتصفح لا يدعم الإشعارات');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        console.log('✅ الإشعارات مفعّلة مسبقاً');
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
        return notificationsEnabled;
    }
    
    return false;
}

// إظهار إشعار
function showNotification(title, body, options = {}) {
    if (!notificationsEnabled) return;
    
    const defaultOptions = {
        icon: '📊',
        badge: '📊',
        tag: 'stochz-' + Date.now(),
        requireInteraction: false,
        ...options
    };
    
    try {
        const notification = new Notification(title, {
            body: body,
            ...defaultOptions
        });
        
        // إغلاق تلقائي بعد 10 ثوان
        setTimeout(() => notification.close(), 10000);
        
        // فتح التطبيق عند النقر
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch (e) {
        console.log('خطأ في الإشعار:', e);
    }
}

// فحص Watchlist وإرسال الإشعارات
function checkWatchlistForAlerts() {
    const list = getWatchlist();
    if (list.length === 0) return;
    
    const alertsSent = getAlertsSent();
    
    list.forEach(item => {
        if (item.status !== 'bought') return;
        
        const buyPrice = parseFloat(item.buyPrice);
        if (!buyPrice) return;
        
        const gap = calculateGap(item);
        const stopLoss = parseFloat(gap.stopLoss);
        const tp1 = parseFloat(gap.tp1);
        const tp2 = parseFloat(gap.tp2);
        
        const alertKey = `${item.symbol}-${item.date}`;
        
        // 1. تنبيه اقتراب من الهدف 1
        const distToTp1 = ((tp1 - buyPrice) / buyPrice * 100).toFixed(2);
        if (distToTp1 <= 0.3 && !alertsSent[`${alertKey}-tp1`]) {
            showNotification(
                `🎯 ${item.symbol} قريب من الهدف 1`,
                `${item.name_ar || item.symbol}
السعر: ${buyPrice} → الهدف: ${tp1}`,
                { tag: `${alertKey}-tp1` }
            );
            alertsSent[`${alertKey}-tp1`] = Date.now();
        }
        
        // 2. تنبيه اقتراب من الهدف 2
        const distToTp2 = ((tp2 - buyPrice) / buyPrice * 100).toFixed(2);
        if (distToTp2 <= 0.3 && !alertsSent[`${alertKey}-tp2`]) {
            showNotification(
                `🏆 ${item.symbol} قريب من الهدف 2`,
                `${item.name_ar || item.symbol}
السعر: ${buyPrice} → الهدف: ${tp2}`,
                { tag: `${alertKey}-tp2` }
            );
            alertsSent[`${alertKey}-tp2`] = Date.now();
        }
        
        // 3. تنبيه اقتراب من الوقف
        const distToStop = ((buyPrice - stopLoss) / buyPrice * 100).toFixed(2);
        if (distToStop <= 0.3 && !alertsSent[`${alertKey}-stop`]) {
            showNotification(
                `⚠️ ${item.symbol} قريب من الوقف`,
                `${item.name_ar || item.symbol}
السعر: ${buyPrice} → الوقف: ${stopLoss}`,
                { tag: `${alertKey}-stop` }
            );
            alertsSent[`${alertKey}-stop`] = Date.now();
        }
    });
    
    saveAlertsSent(alertsSent);
}

// تخزين التنبيهات المُرسلة
function getAlertsSent() {
    const stored = localStorage.getItem('stochz_alerts_sent');
    if (!stored) return {};
    
    const data = JSON.parse(stored);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // احتفظ فقط بتنbيهات آخر 24 ساعة
    const filtered = {};
    Object.keys(data).forEach(key => {
        if (data[key] > oneDayAgo) filtered[key] = data[key];
    });
    
    return filtered;
}

function saveAlertsSent(alerts) {
    localStorage.setItem('stochz_alerts_sent', JSON.stringify(alerts));
}

// بدء فحص دوري
function startNotificationChecks() {
    if (checkInterval) clearInterval(checkInterval);
    
    // فحص كل 5 دقائق
    checkInterval = setInterval(() => {
        checkWatchlistForAlerts();
    }, 5 * 60 * 1000);
    
    // فحص أولي بعد 10 ثوان
    setTimeout(checkWatchlistForAlerts, 10000);
    
    console.log('✅ بدء فحص Watchlist كل 5 دقائق');
}

// زر تفعيل الإشعارات
function toggleNotifications() {
    const btn = document.getElementById('notification-toggle');
    const status = document.getElementById('notification-status');
    
    if (notificationsEnabled) {
        notificationsEnabled = false;
        if (checkInterval) clearInterval(checkInterval);
        if (status) status.textContent = '🔕 معطّلة';
        if (btn) btn.textContent = '🔔 تفعيل';
        localStorage.removeItem('stochz_notifications');
        showToast('🔕 تم تعطيل الإشعارات');
        return;
    }
    
    // إذا كانت الصلاحية مرفوضة سابقاً
    if (Notification.permission === 'denied') {
        showNotificationHelp();
        return;
    }
    
    // اطلب الصلاحية
    requestNotificationPermission().then(enabled => {
        if (enabled) {
            if (status) {
                status.textContent = '🔔 مفعّلة';
                status.style.color = '#4ade80';
            }
            if (btn) btn.textContent = '🔕 تعطيل';
            localStorage.setItem('stochz_notifications', 'enabled');
            showToast('🔔 تم تفعيل الإشعارات');
            startNotificationChecks();
        } else {
            showNotificationHelp();
        }
    });
}

function showNotificationHelp() {
    // احذف النافذة القديمة إن وُجدت
    const old = document.getElementById('notification-help');
    if (old) old.remove();
    
    const dialog = document.createElement('div');
    dialog.id = 'notification-help';
    dialog.className = 'dialog-overlay';
    
    const isChrome = navigator.userAgent.includes('Chrome');
    const isEdge = navigator.userAgent.includes('Edg');
    const isFirefox = navigator.userAgent.includes('Firefox');
    const isSafari = navigator.userAgent.includes('Safari') && !isChrome;
    
    let stepsHTML = '';
    
    if (isChrome) {
        stepsHTML = `
            <ol class="help-steps">
                <li>انسخ هذا الرابط:<br><code class="copy-code">chrome://settings/content/notifications</code></li>
                <li>الصقه في شريط العنوان و اضغط Enter</li>
                <li>ابحث عن <strong>s10138416.github.io</strong></li>
                <li>إذا كان في <span class="red">"Not allowed"</span> → احذفه</li>
                <li>أضفه إلى <span class="green">"Allowed"</span></li>
                <li>أعد تحميل التطبيق</li>
            </ol>
        `;
    } else if (isEdge) {
        stepsHTML = `
            <ol class="help-steps">
                <li>انسخ:<br><code class="copy-code">edge://settings/content/notifications</code></li>
                <li>الصقه في العنوان واضغط Enter</li>
                <li>أضف <strong>s10138416.github.io</strong> إلى Allow</li>
                <li>أعد تحميل التطبيق</li>
            </ol>
        `;
    } else if (isFirefox) {
        stepsHTML = `
            <ol class="help-steps">
                <li>انسخ:<br><code class="copy-code">about:preferences#privacy</code></li>
                <li>اذهب إلى Notifications → Settings</li>
                <li>اسمح للموقع <strong>s10138416.github.io</strong></li>
            </ol>
        `;
    } else if (isSafari) {
        stepsHTML = `
            <ol class="help-steps">
                <li>افتح Safari → Preferences</li>
                <li>اذهب إلى Websites → Notifications</li>
                <li>اسمح للموقع <strong>s10138416.github.io</strong></li>
            </ol>
        `;
    } else {
        stepsHTML = `
            <ol class="help-steps">
                <li>افتح إعدادات المتصفح</li>
                <li>ابحث عن Notifications</li>
                <li>اسمح للموقع <strong>s10138416.github.io</strong></li>
            </ol>
        `;
    }
    
    dialog.innerHTML = `
        <div class="dialog-box">
            <div class="dialog-header">
                <h3>🔔 تفعيل الإشعارات</h3>
                <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 8px;">
                    الإشعارات محجوبة من إعدادات المتصفح
                </p>
            </div>
            
            ${stepsHTML}
            
            <div class="help-actions">
                <button class="btn-dialog-secondary" onclick="document.getElementById('notification-help').remove()">
                    إغلاق
                </button>
                <button class="btn-dialog-primary" onclick="reloadPage()">
                    🔄 إعادة تحميل التطبيق
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

function reloadPage() {
    location.reload(true);
}

// زر اختبار الإشعارات
function testNotification() {
    if (!notificationsEnabled) {
        showToast('❌ الإشعارات معطّلة — فعّلها أولاً');
        return;
    }
    
    showNotification(
        '🎉 اختبار الإشعارات',
        'إذا رأيت هذه الرسالة، الإشعارات تعمل بشكل صحيح!',
        { tag: 'test-' + Date.now() }
    );
}


// ═══════════════════════════════════════════════════════
// Gap Analysis
// ═══════════════════════════════════════════════════════

function calculateGap(signal) {
    // نستخدم سعر الإشارة كسعر مرجعي
    const signalPrice = signal.price || 0;
    const z = signal.z_osc || 0;
    const lag = signal.lag || 0;
    const absZ = Math.abs(z);
    
    // درجات الجاهزية
    let readiness = 'medium';
    let readinessLabel = '⚠️ يحتاج مراقبة';
    let readinessColor = '#fbbf24';
    let advice = '';
    
    // القوة الأساسية: Z
    if (absZ >= 2.3 && lag <= 2) {
        readiness = 'high';
        readinessLabel = '🟢 جاهز للدخول';
        readinessColor = '#4ade80';
        advice = 'إشارة قوية — راقب عند الافتتاح';
    } else if (absZ >= 1.8 && lag <= 2) {
        readiness = 'medium';
        readinessLabel = '🟡 انتظر تأكيد';
        readinessColor = '#fbbf24';
        advice = 'انتظر 30 دقيقة بعد الافتتاح';
    } else {
        readiness = 'low';
        readinessLabel = '🔴 حذر';
        readinessColor = '#ef4444';
        advice = 'قد تحتاج وقتاً أطول';
    }
    
    // حساب فروقات الأسعار المتوقعة
    const entryLow = signalPrice * 0.995;  // -0.5%
    const entryHigh = signalPrice * 1.005; // +0.5%
    const stopLoss = signal.type === 'BUY' 
        ? signalPrice * 0.98 
        : signalPrice * 1.02;
    const tp1 = signal.type === 'BUY'
        ? signalPrice * 1.02
        : signalPrice * 0.98;
    const tp2 = signal.type === 'BUY'
        ? signalPrice * 1.04
        : signalPrice * 0.96;
    
    return {
        readiness,
        readinessLabel,
        readinessColor,
        advice,
        entryLow: entryLow.toFixed(2),
        entryHigh: entryHigh.toFixed(2),
        stopLoss: stopLoss.toFixed(2),
        tp1: tp1.toFixed(2),
        tp2: tp2.toFixed(2),
        signalPrice: signalPrice.toFixed(2)
    };
}

function renderGapPanel(signals) {
    // احسب لكل سهم
    const analyzed = signals.map(s => ({
        signal: s,
        gap: calculateGap(s)
    }));
    
    // رتب: جاهز أولاً، ثم متوسط، ثم حذر
    const order = { high: 0, medium: 1, low: 2 };
    analyzed.sort((a, b) => order[a.gap.readiness] - order[b.gap.readiness]);
    
    return analyzed;
}

const REPO_URL = 'https://raw.githubusercontent.com/s10138416/stochz-scanner/main/signals';
let currentData = null;

function showTab(event, name) {
    // ابحث عن الزر الرئيسي (حتى لو كان النقر على النص أو الإيموجي)
    const btn = event.target.closest('.tab');
    if (!btn) return;
    
    // إزالة active من كل التبويبات
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // تفعيل الزر المحدد
    btn.classList.add('active');
    
    // إظهار المحتوى المقابل
    const content = document.getElementById(`tab-${name}`);
    if (content) content.classList.add('active');
    
    // تحميل الأرشيف عند الحاجة
    if (name === 'archive') {
        loadArchive();
    } else if (name === 'watchlist') {
        renderWatchlist();
    } else if (name === 'watchlist') {
        renderWatchlist();
    }
}

async function loadData() {
    const lastUpdateEl = document.getElementById('last-update');
    lastUpdateEl.textContent = '⏳ جاري التحميل...';
    
    document.getElementById('buy-list').innerHTML = '';
    document.getElementById('sell-list').innerHTML = '';
    
    try {
        const today = new Date();
        let data = null;
        let foundDate = null;
        
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            try {
                const response = await fetch(`${REPO_URL}/signals_${dateStr}.json?t=${Date.now()}`);
                if (response.ok) {
                    data = await response.json();
                    foundDate = dateStr;
                    break;
                }
            } catch (e) { continue; }
        }
        
        if (!data) throw new Error('لا توجد بيانات حديثة');
        
        currentData = data;
        renderSignals(data, foundDate);
        renderStats(data);
        
    } catch (error) {
        lastUpdateEl.textContent = `⚠️ ${error.message}`;
        document.getElementById('buy-list').innerHTML = 
            '<div class="empty-state">لا توجد بيانات متاحة</div>';
        document.getElementById('sell-list').innerHTML = 
            '<div class="empty-state">حاول لاحقاً</div>';
    }
}

function renderSignals(data, date) {
    document.getElementById('last-update').textContent = `📅 آخر تحديث: ${date}`;
    
    const signals = data.signals || [];
    const buys = signals.filter(s => s.type === 'BUY');
    const sells = signals.filter(s => s.type === 'SELL');
    
    document.getElementById('buy-count').textContent = buys.length;
    document.getElementById('sell-count').textContent = sells.length;
    
    const buyList = document.getElementById('buy-list');
    if (buys.length === 0) {
        buyList.innerHTML = '<div class="empty-state">لا توجد إشارات شراء اليوم</div>';
    } else {
        buys.forEach(s => buyList.appendChild(createCard(s, 'buy')));
    }
    
    const sellList = document.getElementById('sell-list');
    if (sells.length === 0) {
        sellList.innerHTML = '<div class="empty-state">لا توجد إشارات بيع اليوم</div>';
    } else {
        sells.forEach(s => sellList.appendChild(createCard(s, 'sell')));
    }
}

function createCard(signal, type) {
    const card = document.createElement('div');
    card.className = `signal-card ${type}`;
    
    const z = signal.z_osc || 0;
    const absZ = Math.abs(z);
    let zClass = 'weak';
    if (absZ >= 2.0) zClass = 'strong';
    else if (absZ >= 1.5) zClass = 'medium';
    
    const name = signal.name_ar || signal.name || signal.symbol;
    const price = signal.price || 0;
    const gap = calculateGap(signal);
    
    card.innerHTML = `
        <div class="signal-header">
            <div class="symbol-badge" onclick="copySymbol('${signal.symbol}')" title="انقر للنسخ">
                ${signal.symbol}
            </div>
            <div class="signal-info">
                <div class="signal-name">${name}</div>
                <div class="signal-details">
                    <span>💰 ${price} ريال</span>
                    <span>📅 ${signal.date}</span>
                    <span>⚡ lag: ${signal.lag}</span>
                </div>
            </div>
            <div class="z-score ${zClass}">Z: ${z.toFixed(2)}</div>
        </div>
        
        <div class="gap-panel" style="border-right-color: ${gap.readinessColor};">
            <div class="gap-header" style="color: ${gap.readinessColor};">
                <span class="gap-label">${gap.readinessLabel}</span>
                <span class="gap-advice">${gap.advice}</span>
            </div>
            <div class="gap-range">
                <span class="gap-range-label">نطاق الدخول الآمن:</span>
                <span class="gap-range-value">${gap.entryLow} - ${gap.entryHigh} ريال</span>
            </div>
        </div>
        
        <div class="trade-plan">
            <div class="plan-item stop">
                <span class="label">🛑 وقف</span>
                <span class="value">${gap.stopLoss}</span>
            </div>
            <div class="plan-item tp1">
                <span class="label">🎯 هدف 1</span>
                <span class="value">${gap.tp1}</span>
            </div>
            <div class="plan-item tp2">
                <span class="label">🎯 هدف 2</span>
                <span class="value">${gap.tp2}</span>
            </div>
        </div>
        
        <div class="card-actions">
            <button class="btn-watch" onclick='addToWatchlist(${JSON.stringify(signal)})'>
                👁️ أضف للمتابعة
            </button>
            <button class="btn-confirm" onclick='openConfirmDialog(${JSON.stringify(signal)})'>
                ✅ تأكيد الدخول
            </button>
        </div>
    `;
    
    return card;
}

function copySymbol(symbol) {
    navigator.clipboard.writeText(symbol).then(() => {
        showToast(`✅ تم نسخ: ${symbol}`);
    });
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

async function loadArchive() {
    const list = document.getElementById('archive-list');
    list.innerHTML = '<div class="empty-state">⏳ جاري التحميل...</div>';
    
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    const results = await Promise.all(dates.map(async (dateStr) => {
        try {
            const response = await fetch(`${REPO_URL}/signals_${dateStr}.json?t=${Date.now()}`);
            if (response.ok) return { date: dateStr, data: await response.json() };
        } catch (e) {}
        return null;
    }));
    
    const valid = results.filter(r => r !== null);
    
    if (valid.length === 0) {
        list.innerHTML = '<div class="empty-state">لا يوجد أرشيف بعد</div>';
        return;
    }
    
    list.innerHTML = `<h2 style="margin-bottom: 15px;">📚 آخر ${valid.length} يوم</h2>`;
    
    valid.forEach(item => {
        const signals = item.data.signals || [];
        const buys = signals.filter(s => s.type === 'BUY').length;
        const sells = signals.filter(s => s.type === 'SELL').length;
        
        const el = document.createElement('div');
        el.className = 'archive-item';
        el.innerHTML = `
            <span class="archive-date">📅 ${item.date}</span>
            <div class="archive-summary">
                <span class="archive-buy">🟢 ${buys}</span>
                <span class="archive-sell">🔴 ${sells}</span>
                <span style="color: #64748b;">المجموع: ${signals.length}</span>
            </div>
        `;
        list.appendChild(el);
    });
}

function renderStats(data) {
    const signals = data.signals || [];
    const buys = signals.filter(s => s.type === 'BUY').length;
    const sells = signals.filter(s => s.type === 'SELL').length;
    
    document.getElementById('stats-content').innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${signals.length}</div>
                <div class="stat-label">إجمالي الإشارات</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="background: linear-gradient(90deg, #4ade80, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${buys}</div>
                <div class="stat-label">🟢 شراء</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="background: linear-gradient(90deg, #ef4444, #dc2626); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${sells}</div>
                <div class="stat-label">🔴 بيع</div>
            </div>
        </div>
        <div style="margin-top: 30px; text-align: center; color: #94a3b8; line-height: 2;">
            <p>📊 استراتيجية Backtested</p>
            <p>Profit Factor: <strong style="color: #4ade80;">4.93</strong></p>
            <p>Win Rate: <strong style="color: #4ade80;">48.5%</strong></p>
            <p>متوسط الربح: <strong style="color: #4ade80;">+1.54%</strong></p>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 5 * 60 * 1000);
    
    // الإشعارات — حالة محفوظة
    const wasEnabled = localStorage.getItem('stochz_notifications') === 'enabled';
    if (wasEnabled && Notification.permission === 'granted') {
        notificationsEnabled = true;
        const btn = document.getElementById('notification-toggle');
        const status = document.getElementById('notification-status');
        if (btn) btn.textContent = '🔕 تعطيل الإشعارات';
        if (status) status.textContent = '🔔 مفعّلة';
        if (status) status.classList.add('enabled');
        startNotificationChecks();
    }
});

// حفظ حالة الإشعارات
const originalRequestPermission = requestNotificationPermission;
requestNotificationPermission = async function() {
    const result = await originalRequestPermission();
    if (result) {
        localStorage.setItem('stochz_notifications', 'enabled');
    } else {
        localStorage.removeItem('stochz_notifications');
    }
    return result;
};


// ═══════════════════════════════════════════════════════
// Watchlist — قائمة المتابعة
// ═══════════════════════════════════════════════════════

function getWatchlist() {
    const stored = localStorage.getItem('stochz_watchlist');
    return stored ? JSON.parse(stored) : [];
}

function saveWatchlist(list) {
    localStorage.setItem('stochz_watchlist', JSON.stringify(list));
}

function addToWatchlist(signal) {
    const list = getWatchlist();
    
    // تحقق من عدم التكرار
    if (list.some(s => s.symbol === signal.symbol && s.date === signal.date)) {
        showToast('⚠️ السهم موجود في المتابعة');
        return;
    }
    
    // أضف معلومات إضافية
    const entry = {
        ...signal,
        addedAt: new Date().toISOString(),
        status: 'watching',  // watching, bought, sold
        buyPrice: null,
        buyDate: null,
        note: ''
    };
    
    list.push(entry);
    saveWatchlist(list);
    showToast(`✅ تمت إضافة ${signal.symbol} للمتابعة`);
}

function removeFromWatchlist(symbol, date) {
    let list = getWatchlist();
    list = list.filter(s => !(s.symbol === symbol && s.date === date));
    saveWatchlist(list);
    showToast(`🗑️ تم الحذف`);
    renderWatchlist();
}

function markAsBought(symbol, date) {
    const list = getWatchlist();
    const item = list.find(s => s.symbol === symbol && s.date === date);
    if (item) {
        const price = prompt(`📝 أدخل سعر الشراء الفعلي لـ ${symbol}:`);
        if (price) {
            item.status = 'bought';
            item.buyPrice = parseFloat(price);
            item.buyDate = new Date().toISOString();
            saveWatchlist(list);
            showToast(`✅ تم تسجيل الشراء بسعر ${price} — سنتابع السعر`);
            renderWatchlist();
            
            // إشعار تأكيد
            if (notificationsEnabled) {
                showNotification(
                    `💰 تم تسجيل ${symbol}`,
                    `${item.name_ar || symbol}\nسعر الشراء: ${price}\nسننبّهك عند الهدف أو الوقف`
                );
            }
            
            // بدء الفحص
            if (notificationsEnabled) {
                startNotificationChecks();
            }
        }
    }
}

function markAsSold(symbol, date) {
    const list = getWatchlist();
    const item = list.find(s => s.symbol === symbol && s.date === date);
    if (item) {
        const price = prompt(`📝 أدخل سعر البيع الفعلي لـ ${symbol}:`);
        if (price) {
            item.status = 'sold';
            item.sellPrice = parseFloat(price);
            item.sellDate = new Date().toISOString();
            const pnl = ((item.sellPrice - item.buyPrice) / item.buyPrice * 100).toFixed(2);
            item.pnl = pnl;
            saveWatchlist(list);
            showToast(`✅ تم تسجيل البيع — ربح/خسارة: ${pnl}%`);
            renderWatchlist();
        }
    }
}

function renderWatchlist() {
    const list = getWatchlist();
    const container = document.getElementById('watchlist-content');
    
    if (!container) return;
    
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state">لا توجد أسهم في المتابعة</div>';
        return;
    }
    
    // إحصائيات
    const watching = list.filter(s => s.status === 'watching').length;
    const bought = list.filter(s => s.status === 'bought').length;
    const sold = list.filter(s => s.status === 'sold').length;
    
    let html = `
        <div class="watchlist-stats">
            <div class="stat-mini">
                <div class="stat-mini-value">${watching}</div>
                <div class="stat-mini-label">👁️ قيد المراقبة</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-value" style="color: #fbbf24;">${bought}</div>
                <div class="stat-mini-label">💰 مفتوحة</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-value" style="color: #4ade80;">${sold}</div>
                <div class="stat-mini-label">✅ مغلقة</div>
            </div>
        </div>
        <div class="watchlist-items">
    `;
    
    list.reverse().forEach(item => {
        const statusLabels = {
            'watching': '👁️ قيد المراقبة',
            'bought': '💰 صفقة مفتوحة',
            'sold': '✅ مغلقة'
        };
        const statusColors = {
            'watching': '#22d3ee',
            'bought': '#fbbf24',
            'sold': '#4ade80'
        };
        
        let actionButtons = '';
        if (item.status === 'watching') {
            actionButtons = `
                <button class="btn-action btn-buy" onclick="markAsBought('${item.symbol}', '${item.date}')">
                    💰 سجل شراء
                </button>
            `;
        } else if (item.status === 'bought') {
            actionButtons = `
                <button class="btn-action btn-sell" onclick="markAsSold('${item.symbol}', '${item.date}')">
                    ✅ سجل بيع
                </button>
            `;
        } else if (item.status === 'sold' && item.pnl) {
            const pnlNum = parseFloat(item.pnl);
            const pnlColor = pnlNum >= 0 ? '#4ade80' : '#ef4444';
            actionButtons = `
                <span style="color: ${pnlColor}; font-weight: bold;">
                    ${pnlNum >= 0 ? '+' : ''}${item.pnl}%
                </span>
            `;
        }
        
        html += `
            <div class="watchlist-item">
                <div class="watchlist-header">
                    <span class="symbol-badge">${item.symbol}</span>
                    <span class="watchlist-name">${item.name_ar || item.symbol}</span>
                    <span class="watchlist-status" style="color: ${statusColors[item.status]};">
                        ${statusLabels[item.status]}
                    </span>
                </div>
                <div class="watchlist-details">
                    <span>💰 إشارة: ${item.price} ريال</span>
                    ${item.buyPrice ? `<span>💵 شراء: ${item.buyPrice}</span>` : ''}
                    ${item.sellPrice ? `<span>💸 بيع: ${item.sellPrice}</span>` : ''}
                    <span>📅 ${item.date}</span>
                </div>
                <div class="watchlist-actions">
                    ${actionButtons}
                    <button class="btn-action btn-remove" onclick="removeFromWatchlist('${item.symbol}', '${item.date}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}


// ═══════════════════════════════════════════════════════
// تأكيد الدخول (Confirm Entry)
// ═══════════════════════════════════════════════════════

function openConfirmDialogFromButton(btn) {
    const signal = JSON.parse(btn.dataset.signal);
    openConfirmDialog(signal);
}

function openConfirmDialog(signal) {
    const gap = calculateGap(signal);
    const type = signal.type || 'BUY';
    const typeAr = type === 'BUY' ? 'شراء' : 'بيع';
    const typeColor = type === 'BUY' ? '#4ade80' : '#ef4444';
    
    // احسب النطاق
    const price = signal.price || 0;
    const entryLow = parseFloat(gap.entryLow);
    const entryHigh = parseFloat(gap.entryHigh);
    
    // احذف أي dialog قديم
    const oldDialog = document.getElementById('confirm-dialog');
    if (oldDialog) oldDialog.remove();
    
    const dialog = document.createElement('div');
    dialog.id = 'confirm-dialog';
    dialog.className = 'dialog-overlay';
    
    dialog.innerHTML = `
        <div class="dialog-box">
            <div class="dialog-header">
                <h3>
                    <span class="symbol-badge">${signal.symbol}</span>
                    ${signal.name_ar || signal.symbol}
                </h3>
                <span class="dialog-type" style="color: ${typeColor};">
                    ${typeAr} — Z: ${signal.z_osc.toFixed(2)}
                </span>
            </div>
            
            <div class="dialog-info">
                <div class="info-row">
                    <span>💰 السعر المرجعي:</span>
                    <strong>${price} ريال</strong>
                </div>
                <div class="info-row">
                    <span>🎯 نطاق الدخول:</span>
                    <strong>${entryLow} - ${entryHigh} ريال</strong>
                </div>
                <div class="info-row">
                    <span>🛑 وقف الخسارة:</span>
                    <strong style="color: #ef4444;">${gap.stopLoss} ريال</strong>
                </div>
                <div class="info-row">
                    <span>🎯 الهدف 1:</span>
                    <strong style="color: #fbbf24;">${gap.tp1} ريال</strong>
                </div>
                <div class="info-row">
                    <span>🎯 الهدف 2:</span>
                    <strong style="color: #4ade80;">${gap.tp2} ريال</strong>
                </div>
            </div>
            
            <div class="dialog-input">
                <label>📝 أدخل السعر الحالي في السوق:</label>
                <input type="number" id="current-price" step="0.01" placeholder="مثال: ${price}">
            </div>
            
            <div class="dialog-actions">
                <button class="btn-dialog-primary" onclick="checkPrice('${signal.symbol}')">
                    ✅ تحقق
                </button>
                <button class="btn-dialog-secondary" onclick="closeConfirmDialog()">
                    إلغاء
                </button>
            </div>
            
            <div id="confirm-result"></div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // اربط البيانات
    dialog.dataset.signal = JSON.stringify(signal);
    
    // ركّز على input
    setTimeout(() => {
        document.getElementById('current-price').focus();
    }, 100);
}

function checkPrice(symbol) {
    const dialog = document.getElementById('confirm-dialog');
    const signal = JSON.parse(dialog.dataset.signal);
    const input = document.getElementById('current-price');
    const result = document.getElementById('confirm-result');
    
    const currentPrice = parseFloat(input.value);
    if (!currentPrice || currentPrice <= 0) {
        result.innerHTML = `
            <div class="result-box result-warning">
                ⚠️ الرجاء إدخال سعر صحيح
            </div>
        `;
        return;
    }
    
    const gap = calculateGap(signal);
    const entryLow = parseFloat(gap.entryLow);
    const entryHigh = parseFloat(gap.entryHigh);
    const stopLoss = parseFloat(gap.stopLoss);
    const tp1 = parseFloat(gap.tp1);
    const tp2 = parseFloat(gap.tp2);
    const referencePrice = signal.price;
    const type = signal.type || 'BUY';
    
    let decision, decisionColor, decisionIcon, decisionText;
    
    if (type === 'BUY') {
        // للشراء
        if (currentPrice >= entryLow && currentPrice <= entryHigh) {
            decision = 'enter';
            decisionColor = '#4ade80';
            decisionIcon = '✅';
            decisionText = 'ادخل الآن — السعر داخل النطاق';
        } else if (currentPrice < entryLow) {
            decision = 'wait';
            decisionColor = '#fbbf24';
            decisionIcon = '⏳';
            decisionText = 'انتظر — السعر أقل من نطاق الدخول';
        } else {
            // currentPrice > entryHigh
            if (currentPrice < tp1) {
                decision = 'wait';
                decisionColor = '#fbbf24';
                decisionIcon = '⚠️';
                decisionText = 'السعر مرتفع — قد يكون فات الأوان';
            } else {
                decision = 'ignore';
                decisionColor = '#ef4444';
                decisionIcon = '🛑';
                decisionText = 'تجاهل — السعر تجاوز الهدف 1';
            }
        }
    } else {
        // للبيع (معكوس)
        if (currentPrice >= entryLow && currentPrice <= entryHigh) {
            decision = 'enter';
            decisionColor = '#4ade80';
            decisionIcon = '✅';
            decisionText = 'ادخل الآن — السعر داخل النطاق';
        } else if (currentPrice > entryHigh) {
            decision = 'wait';
            decisionColor = '#fbbf24';
            decisionIcon = '⏳';
            decisionText = 'انتظر — السعر أعلى من نطاق الدخول';
        } else {
            if (currentPrice > tp1) {
                decision = 'wait';
                decisionColor = '#fbbf24';
                decisionIcon = '⚠️';
                decisionText = 'السعر منخفض — قد يكون فات الأوان';
            } else {
                decision = 'ignore';
                decisionColor = '#ef4444';
                decisionIcon = '🛑';
                decisionText = 'تجاهل — السعر تجاوز الهدف 1';
            }
        }
    }
    
    // حساب المسافات
    const diffFromSignal = ((currentPrice - referencePrice) / referencePrice * 100).toFixed(2);
    const distToStop = ((currentPrice - stopLoss) / currentPrice * 100).toFixed(2);
    const distToTp1 = ((tp1 - currentPrice) / currentPrice * 100).toFixed(2);
    
    result.innerHTML = `
        <div class="result-box" style="border-color: ${decisionColor}; background: ${decisionColor}15;">
            <div class="result-decision" style="color: ${decisionColor};">
                ${decisionIcon} ${decisionText}
            </div>
            
            <div class="result-details">
                <div class="result-detail">
                    <span>السعر المُدخل:</span>
                    <strong>${currentPrice} ريال</strong>
                </div>
                <div class="result-detail">
                    <span>الفرق عن الإشارة:</span>
                    <strong style="color: ${Math.abs(diffFromSignal) < 1 ? '#4ade80' : '#fbbf24'};">
                        ${diffFromSignal >= 0 ? '+' : ''}${diffFromSignal}%
                    </strong>
                </div>
                <div class="result-detail">
                    <span>المسافة للوقف:</span>
                    <strong style="color: #ef4444;">${distToStop}%</strong>
                </div>
                <div class="result-detail">
                    <span>المسافة للهدف 1:</span>
                    <strong style="color: #fbbf24;">${distToTp1}%</strong>
                </div>
            </div>
            
            ${decision === 'enter' ? `
                <button class="btn-dialog-success" onclick="quickAddToWatchlist('${symbol}')">
                    👁️ أضف للمتابعة
                </button>
            ` : ''}
        </div>
    `;
}

function closeConfirmDialog() {
    const dialog = document.getElementById('confirm-dialog');
    if (dialog) dialog.remove();
}

function quickAddToWatchlist(symbol) {
    // ابحث عن السهم في currentData
    if (currentData && currentData.signals) {
        const signal = currentData.signals.find(s => s.symbol === symbol);
        if (signal) {
            addToWatchlist(signal);
            closeConfirmDialog();
        }
    }
}
