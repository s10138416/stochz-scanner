// ═══════════════════════════════════════════════════════
// StochZ Scanner - Frontend
// ═══════════════════════════════════════════════════════

const REPO_URL = 'https://raw.githubusercontent.com/s10138416/stochz-scanner/main/signals';

async function loadData() {
    const lastUpdateEl = document.getElementById('last-update');
    lastUpdateEl.textContent = '⏳ جاري التحميل...';
    
    document.getElementById('buy-list').innerHTML = '';
    document.getElementById('sell-list').innerHTML = '';
    
    try {
        const today = new Date();
        let data = null;
        let foundDate = null;
        
        for (let i = 0; i < 10; i++) {
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
            } catch (e) {
                continue;
            }
        }
        
        if (!data) {
            throw new Error('لا توجد بيانات حديثة');
        }
        
        renderSignals(data, foundDate);
        
    } catch (error) {
        lastUpdateEl.textContent = `⚠️ ${error.message}`;
        document.getElementById('buy-list').innerHTML = 
            '<div class="empty-state">لا توجد بيانات متاحة</div>';
        document.getElementById('sell-list').innerHTML = 
            '<div class="empty-state">حاول لاحقاً</div>';
    }
}

function renderSignals(data, date) {
    document.getElementById('last-update').textContent = 
        `📅 آخر تحديث: ${date}`;
    
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
    
    card.innerHTML = `
        <div class="symbol-badge">${signal.symbol}</div>
        <div class="signal-info">
            <div class="signal-name">${name}</div>
            <div class="signal-details">
                <span>💰 ${signal.price} ريال</span>
                <span>📅 ${signal.date}</span>
                <span>⚡ lag: ${signal.lag}</span>
            </div>
        </div>
        <div class="z-score ${zClass}">Z: ${z.toFixed(2)}</div>
    `;
    
    return card;
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 5 * 60 * 1000);
});
