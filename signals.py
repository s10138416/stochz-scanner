import pandas as pd
import numpy as np


def find_pivots(series, left=2, right=2):
    pivots_high = [np.nan] * len(series)
    pivots_low = [np.nan] * len(series)
    arr = series.values
    for i in range(left, len(arr) - right):
        wl = arr[i - left:i]
        wr = arr[i + 1:i + right + 1]
        if arr[i] > max(wl) and arr[i] > max(wr):
            pivots_high[i] = arr[i]
        if arr[i] < min(wl) and arr[i] < min(wr):
            pivots_low[i] = arr[i]
    return (pd.Series(pivots_high, index=series.index),
            pd.Series(pivots_low, index=series.index))


def detect_latest_signal(d, z, params):
    price_ph, price_pl = find_pivots(d['high'], params['pivot_l'], params['pivot_r'])
    osc_ph, osc_pl = find_pivots(z, params['pivot_l'], params['pivot_r'])
    end = len(d) - params['pivot_r']
    start = max(params['pivot_l'], end - 60)
    for i in range(end - 1, start - 1, -1):
        if not pd.isna(price_pl.iloc[i]):
            for j in range(i, max(0, i - params['max_lag'] - 1), -1):
                if not pd.isna(osc_pl.iloc[j]) and osc_pl.iloc[j] < params['os_level']:
                    return {
                        'date': d.index[i].strftime('%Y-%m-%d'),
                        'type': 'BUY',
                        'price': round(float(d['low'].iloc[i]), 2),
                        'z_osc': round(float(z.iloc[j]), 3),
                        'lag': i - j
                    }
        if not pd.isna(price_ph.iloc[i]):
            for j in range(i, max(0, i - params['max_lag'] - 1), -1):
                if not pd.isna(osc_ph.iloc[j]) and osc_ph.iloc[j] > params['ob_level']:
                    return {
                        'date': d.index[i].strftime('%Y-%m-%d'),
                        'type': 'SELL',
                        'price': round(float(d['high'].iloc[i]), 2),
                        'z_osc': round(float(z.iloc[j]), 3),
                        'lag': i - j
                    }
    return None
