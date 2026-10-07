import os
from dotenv import load_dotenv

load_dotenv()

SAHMK_API_KEY = os.getenv("SAHMK_API_KEY", "")
if not SAHMK_API_KEY:
    raise ValueError("SAHMK_API_KEY missing in .env")

INDICATOR_PARAMS = {
    "min_len": 8, "max_len": 34, "er_len": 10,
    "smooth_k": 3, "smooth_d": 3, "z_len": 20,
    "os_level": -1.0, "ob_level": 1.0,
    "pivot_l": 3, "pivot_r": 2, "max_lag": 7,
}

FILTER_PARAMS = {
    "buy_z_max": -1.8,
    "sell_z_min": 1.5,
    "max_lag": 2,
    "days_lookback": 3,
}

DATA_RANGE_DAYS = 180
MIN_BARS_REQUIRED = 60
SIGNALS_DIR = "signals"
LOGS_DIR = "logs"
REQUEST_DELAY = 0.1
