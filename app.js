
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
    
    // حساب Gap Analysis
    const gap = calculateGap(signal);
    
    // خطة التداول
    let stopLoss, tp1, tp2;
    if (type === 'buy') {
        stopLoss = gap.stopLoss;
        tp1 = gap.tp1;
        tp2 = gap.tp2;
    } else {
        stopLoss = gap.stopLoss;
        tp1 = gap.tp1;
        tp2 = gap.tp2;
    }
    
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
        
        <!-- Gap Analysis Panel -->
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
        
        <!-- خطة التداول -->
        <div class="trade-plan">
            <div class="plan-item stop">
                <span class="label">🛑 وقف</span>
                <span class="value">${stopLoss}</span>
            </div>
            <div class="plan-item tp1">
                <span class="label">🎯 هدف 1</span>
                <span class="value">${tp1}</span>
            </div>
            <div class="plan-item tp2">
                <span class="label">🎯 هدف 2</span>
                <span class="value">${tp2}</span>
            </div>
        </div>
        
        <!-- أزرار الإجراءات -->
        <div class="card-actions">
            <button class="btn-watch" onclick="addToWatchlist(${JSON.stringify(signal).replace(/"/g, '&quot;')})">
                👁️ أضف للمتابعة
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
});


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
            showToast(`✅ تم تسجيل الشراء بسعر ${price}`);
            renderWatchlist();
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
