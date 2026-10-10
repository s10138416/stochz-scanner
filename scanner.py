import os
import json
import time
import logging
from datetime import datetime, timedelta
import pandas as pd
from sahmk import SahmkClient

from config import (
    SAHMK_API_KEY, INDICATOR_PARAMS, FILTER_PARAMS,
    DATA_RANGE_DAYS, MIN_BARS_REQUIRED,
    SIGNALS_DIR, LOGS_DIR, REQUEST_DELAY
)
from indicators import adaptive_stochastic, fisher_zscore
from signals import detect_latest_signal
from enrichment import enrich_dataframe, calculate_trade_plan

os.makedirs(LOGS_DIR, exist_ok=True)
os.makedirs(SIGNALS_DIR, exist_ok=True)

log_file = f"{LOGS_DIR}/scanner_{datetime.now():%Y-%m-%d}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


def get_all_stocks(client):
    all_stocks = []
    offset = 0
    limit = 100
    while True:
        page = client.companies(limit=limit, offset=offset)
        results = page.get('results', [])
        if not results:
            break
        for r in results:
            if (r.get('market') == 'TASI'
                and r.get('security_type') == 'Equity'
                and r.get('is_etf') == False
                and r.get('status') == 'active'):
                all_stocks.append({
                    'symbol': r['symbol'],
                    'name_ar': r.get('name_ar', ''),
                })
        if offset + limit >= page.get('total', 0):
            break
        offset += limit
    return all_stocks


def scan_one(client, stock, from_date, to_date):
    try:
        res = client.historical(stock['symbol'], from_date=from_date,
                                 to_date=to_date, interval="1d")
        rows = getattr(res, "data", None) or res.get("data", [])
        if len(rows) < MIN_BARS_REQUIRED:
            return None

        d = pd.DataFrame(rows)
        d['date'] = pd.to_datetime(d['date'])
        d = d.set_index('date')[['open', 'high', 'low', 'close', 'volume']].astype(float)

        d = enrich_dataframe(d)
        
        # ATR
        high_low = d['high'] - d['low']
        high_close = (d['high'] - d['close'].shift()).abs()
        low_close = (d['low'] - d['close'].shift()).abs()
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        d['atr'] = tr.rolling(14).mean()

        # المؤشر الرئيسي
        sk, _ = adaptive_stochastic(
            d,
            min_len=INDICATOR_PARAMS['min_len'],
            max_len=INDICATOR_PARAMS['max_len'],
            er_len=INDICATOR_PARAMS['er_len'],
            smooth_k=INDICATOR_PARAMS['smooth_k'],
            smooth_d=INDICATOR_PARAMS['smooth_d'],
        )
        zz = fisher_zscore(sk, z_len=INDICATOR_PARAMS['z_len'])
        sig = detect_latest_signal(d, zz, INDICATOR_PARAMS)

        if not sig:
            return None

        last = d.iloc[-1]
        z_val = sig['z_osc']

        # الفلتر النهائي
        if sig['type'] == 'BUY':
            if not (FILTER_PARAMS['buy_z_min'] <= z_val <= FILTER_PARAMS['buy_z_max']):
                return None
        elif sig['type'] == 'SELL':
            if not (FILTER_PARAMS['sell_z_min'] <= z_val <= FILTER_PARAMS['sell_z_max']):
                return None

        if last['vol_ratio'] < FILTER_PARAMS['min_vol_ratio']:
            return None

        atr_pct = last['atr'] / last['close']
        if atr_pct > FILTER_PARAMS['max_atr_pct']:
            return None

        sig['rsi'] = round(float(last['rsi']), 1)
        sig['vol_ratio'] = round(float(last['vol_ratio']), 2)
        sig['atr'] = round(float(last['atr']), 2)
        sig['atr_pct'] = round(float(atr_pct * 100), 2)

        # خطة التداول
        if sig['type'] == 'BUY':
            sig['stop_loss'] = round(sig['price'] * (1 - FILTER_PARAMS['stop_pct']), 2)
            sig['target_1'] = round(sig['price'] * (1 + FILTER_PARAMS['tp1_pct']), 2)
            sig['target_2'] = round(sig['price'] * (1 + FILTER_PARAMS['tp2_pct']), 2)
        else:
            sig['stop_loss'] = round(sig['price'] * (1 + FILTER_PARAMS['stop_pct']), 2)
            sig['target_1'] = round(sig['price'] * (1 - FILTER_PARAMS['tp1_pct']), 2)
            sig['target_2'] = round(sig['price'] * (1 - FILTER_PARAMS['tp2_pct']), 2)

        sig['symbol'] = stock['symbol']
        sig['name_ar'] = stock['name_ar']
        return sig
    except Exception as e:
        log.debug(f"خطأ في {stock['symbol']}: {e}")
        return None


def apply_filter(df):
    df = df.copy()
    df['price_date'] = pd.to_datetime(df['date'])
    latest = df['price_date'].max()
    cutoff = latest - timedelta(days=FILTER_PARAMS['days_lookback'])
    
    filtered = df[
        (df['price_date'] >= cutoff) &
        (df['lag'] <= FILTER_PARAMS['max_lag'])
    ].copy()
    
    filtered = filtered.sort_values('price_date', ascending=False)
    filtered = filtered.drop_duplicates(subset=['symbol'], keep='first')
    
    filtered['score'] = filtered['z_osc'].abs() - filtered['lag'] * 0.3
    return filtered.sort_values('score', ascending=False)


def save_results(df, today):
    csv_file = f"{SIGNALS_DIR}/signals_{today}.csv"
    out = df[['symbol', 'name_ar', 'type', 'date', 'price', 'z_osc', 'lag']].copy()
    out.columns = ['symbol', 'name', 'type', 'date', 'price', 'z_score', 'lag']
    out.to_csv(csv_file, index=False, encoding='utf-8-sig')
    log.info(f"CSV: {csv_file}")

    json_file = f"{SIGNALS_DIR}/signals_{today}.json"
    data = {
        "scan_date": today,
        "scan_timestamp": datetime.now().isoformat(),
        "filter": FILTER_PARAMS,
        "summary": {
            "total_signals": len(df),
            "buy_signals": int((df['type'] == 'BUY').sum()),
            "sell_signals": int((df['type'] == 'SELL').sum()),
        },
        "signals": df[['symbol', 'name_ar', 'type', 'date',
                        'price', 'z_osc', 'lag']].to_dict('records')
    }
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log.info(f"JSON: {json_file}")

    txt_file = f"{SIGNALS_DIR}/report_{today}.txt"
    with open(txt_file, 'w', encoding='utf-8') as f:
        f.write("=" * 75 + "\n")
        f.write(f"StochZ Scanner - Saudi Market\n")
        f.write(f"Date: {datetime.now():%Y-%m-%d %H:%M}\n")
        f.write("=" * 75 + "\n\n")
        buys = df[df['type'] == 'BUY']
        sells = df[df['type'] == 'SELL']
        if len(buys) > 0:
            f.write(f"BUY Signals ({len(buys)}):\n")
            f.write("-" * 75 + "\n")
            for i, (_, r) in enumerate(buys.iterrows(), 1):
                f.write(f"{i:<4} {r['symbol']:<8} {r['name_ar'][:24]:<25} "
                        f"{r['price']:>8} Z: {r['z_osc']:>8.3f} lag: {r['lag']:>3}\n")
        if len(sells) > 0:
            f.write(f"\nSELL Signals ({len(sells)}):\n")
            f.write("-" * 75 + "\n")
            for i, (_, r) in enumerate(sells.iterrows(), 1):
                f.write(f"{i:<4} {r['symbol']:<8} {r['name_ar'][:24]:<25} "
                        f"{r['price']:>8} Z: {r['z_osc']:>8.3f} lag: {r['lag']:>3}\n")
        f.write("\n" + "=" * 75 + "\n")
        f.write(f"Total: {len(df)} signals\n")
        f.write("=" * 75 + "\n")
    log.info(f"Report: {txt_file}")


def main():
    log.info("=" * 60)
    log.info("StochZ Scanner starting")
    log.info("=" * 60)
    start_time = time.time()

    log.info("Connecting to SAHMK...")
    client = SahmkClient(SAHMK_API_KEY)

    log.info("Fetching stocks list...")
    stocks = get_all_stocks(client)
    log.info(f"Got {len(stocks)} stocks")

    today_date = datetime.now().date()
    from_date = (today_date - timedelta(days=DATA_RANGE_DAYS)).strftime("%Y-%m-%d")
    to_date = today_date.strftime("%Y-%m-%d")
    log.info(f"Data range: {from_date} -> {to_date}")

    results = []
    for idx, stock in enumerate(stocks):
        sig = scan_one(client, stock, from_date, to_date)
        if sig:
            results.append(sig)
        if (idx + 1) % 30 == 0:
            log.info(f"{idx+1}/{len(stocks)} | signals: {len(results)}")
        time.sleep(REQUEST_DELAY)

    log.info(f"Scan complete: {len(results)} raw signals")
    if not results:
        log.warning("No signals found")
        return

    df = pd.DataFrame(results)
    golden = apply_filter(df)
    log.info(f"After filter: {len(golden)} signals")
    log.info(f"BUY: {(golden['type']=='BUY').sum()}")
    log.info(f"SELL: {(golden['type']=='SELL').sum()}")

    save_results(golden, today_date.strftime("%Y-%m-%d"))
    log.info(f"Total time: {(time.time()-start_time)/60:.2f} min")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
