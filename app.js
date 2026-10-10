const REPO_URL = 'https://raw.githubusercontent.com/s10138416/stochz-scanner/main/signals';
let currentData = null;

function showTab(event, name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');
    
    if (name === 'archive') {
        loadArchive();
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
    
    let stopLoss, tp1, tp2;
    if (type === 'buy') {
        stopLoss = (price * 0.98).toFixed(2);
        tp1 = (price * 1.02).toFixed(2);
        tp2 = (price * 1.04).toFixed(2);
    } else {
        stopLoss = (price * 1.02).toFixed(2);
        tp1 = (price * 0.98).toFixed(2);
        tp2 = (price * 0.96).toFixed(2);
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
