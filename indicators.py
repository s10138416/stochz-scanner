import pandas as pd
import numpy as np


def adaptive_stochastic(df, min_len=8, max_len=34, er_len=10,
                        smooth_k=3, smooth_d=3):
    close = df['close'].astype(float)
    high = df['high'].astype(float)
    low = df['low'].astype(float)

    change = (close - close.shift(er_len)).abs()
    volatility = (close - close.shift(1)).abs().rolling(er_len).mean() * er_len
    er = np.where(volatility != 0, change / volatility, 0.0)
    er = pd.Series(er, index=df.index).fillna(0)

    safe_max = max(max_len, min_len)
    adaptive_len = (safe_max - er * (safe_max - min_len)).round().astype(int)
    adaptive_len = adaptive_len.clip(lower=min_len, upper=safe_max)
    fixed_len = int(adaptive_len.iloc[-1])

    highest_high = high.rolling(fixed_len).max()
    lowest_low = low.rolling(fixed_len).min()
    stoch_rng = highest_high - lowest_low
    raw_stoch = np.where(stoch_rng != 0,
                         (close - lowest_low) / stoch_rng * 100, 50.0)
    raw_stoch = pd.Series(raw_stoch, index=df.index)

    stoch_k = raw_stoch.rolling(smooth_k).mean()
    stoch_d = stoch_k.rolling(smooth_d).mean()
    return stoch_k, stoch_d


def fisher_zscore(stoch_k, z_len=20):
    scaled = (stoch_k - 50) / 50
    scaled = scaled.clip(-0.998, 0.998)
    fisher = 0.5 * np.log((1 + scaled) / (1 - scaled))
    mean_z = fisher.rolling(z_len).mean()
    std_z = fisher.rolling(z_len).std()
    z = (fisher - mean_z) / std_z.replace(0, np.nan)
    return z.fillna(0)
