"""حساب المؤشرات المساعدة وخطة التداول"""
import pandas as pd
import numpy as np


def add_rsi(df, period=14):
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(period).mean()
    loss = -delta.where(delta < 0, 0).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    df['rsi'] = 100 - (100 / (1 + rs))
    return df


def add_ema(df, period=50):
    df[f'ema_{period}'] = df['close'].ewm(span=period, adjust=False).mean()
    return df


def add_volume_avg(df, period=20):
    df['vol_avg'] = df['volume'].rolling(period).mean()
    df['vol_ratio'] = df['volume'] / df['vol_avg']
    return df


def add_atr(df, period=14):
    high_low = df['high'] - df['low']
    high_close = (df['high'] - df['close'].shift()).abs()
    low_close = (df['low'] - df['close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df['atr'] = tr.rolling(period).mean()
    return df


def enrich_dataframe(df):
    df = add_rsi(df)
    df = add_ema(df, 50)
    df = add_volume_avg(df)
    df = add_atr(df)
    return df


def calculate_trade_plan(row, signal_price):
    stop_pct = signal_price * 0.975
    stop_atr = signal_price - (row['atr'] * 1.5)
    stop_loss = max(stop_pct, stop_atr)
    target_1 = signal_price * 1.05
    target_2 = signal_price * 1.10
    risk_per_share = signal_price - stop_loss
    risk_pct = (risk_per_share / signal_price) * 100
    return {
        'stop_loss': round(stop_loss, 2),
        'risk_pct': round(risk_pct, 2),
        'target_1': round(target_1, 2),
        'target_2': round(target_2, 2),
        'risk_reward_1': round((target_1 - signal_price) / risk_per_share, 2),
        'risk_reward_2': round((target_2 - signal_price) / risk_per_share, 2),
    }
