import json
import requests
import copy
import os
import base64 # 👈 اضافه شدن کتابخانه Base64

# ==========================================================
# --- تنظیمات اصلی ---
# ==========================================================
# سابسکریپشن‌ها از یک متغیر محیطی (Environment Variable) در GitHub Actions خوانده می‌شوند.
SUBSCRIPTION_LINKS_STR = os.environ.get('SUB_LINKS', '')
if not SUBSCRIPTION_LINKS_STR:
    # اگر متغیر محیطی ست نشده بود، از لینک‌های پیش‌فرض استفاده کند (فقط برای تست لوکال)
    print("متغیر محیطی SUB_LINKS ست نشده. از لینک‌های پیش‌فرض استفاده می‌شود.")
    SUBSCRIPTION_LINKS = [
        "https://pooriared.faridiosak.workers.dev/..." 
    ]
else:
    SUBSCRIPTION_LINKS = [link.strip() for link in SUBSCRIPTION_LINKS_STR.split(',') if link.strip()]

OUTPUT_FILE = "POORIARED_sub.txt" # 👈 نام فایل جدید
# ==========================================================

# --- ساختار پایه Xray و توابع کمکی (بدون تغییر) ---
BASE_XRAY_CONFIG = {
    "log": {"loglevel": "warning"},
    "inbounds": [
        {"port": 10808, "protocol": "socks", "listen": "127.0.0.1", "settings": {"auth": "noauth", "udp": True}},
        {"port": 10809, "protocol": "http", "listen": "127.0.0.1", "settings": {}}
    ],
    "outbounds": [],
    "routing": {
        "domainStrategy": "AsIs",
        "rules": [
            {"type": "field", "ip": ["geoip:private", "geoip:ir"], "outboundTag": "block"},
            {"type": "field", "network": "udp,tcp", "outboundTag": "select"} 
        ]
    }
}

def fetch_all_outbounds(url_list):
    # ... (بدنه تابع را از پاسخ قبلی کپی کنید - بدون تغییر)
    all_outbounds = []
    for i, url in enumerate(url_list):
        print(f"[{i+1}/{len(url_list)}] در حال دانلود از: {url}")
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status() 
            v2ray_config_list = response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"❌ خطا در دانلود از {url}: {e}")
            continue
        except json.JSONDecodeError:
            print(f"❌ خطا: پاسخ دریافتی از {url} یک JSON معتبر نیست.")
            continue
        
        for j, config in enumerate(v2ray_config_list):
            try:
                outbound = copy.deepcopy(config['outbounds'][0])
                tag_base = config.get('remarks', f'Proxy-{i+1}-{j+1}').replace(' ', '-')
                tag = tag_base
                counter = 1
                while tag in [ob.get('tag') for ob in all_outbounds]:
                    tag = f"{tag_base}-{counter}"
                    counter += 1
                outbound['tag'] = tag
                if 'protocol' in outbound:
                    all_outbounds.append(outbound)
            except IndexError:
                continue
                
    print(f"\n✅ مجموعاً {len(all_outbounds)} کانفیگ سرور (outbound) از تمام ساب‌ها استخراج شد.")
    return all_outbounds

def generate_xray_config_base64(outbounds_list, output_file):
    """
    کانفیگ نهایی را ساخته، آن را به Base64 تبدیل کرده و در فایل ذخیره می‌کند.
    """
    
    full_config = copy.deepcopy(BASE_XRAY_CONFIG)
    full_config['outbounds'].extend(outbounds_list)
    full_config['outbounds'].append({"protocol": "blackhole", "tag": "block"})
    full_config['outbounds'].append({"protocol": "freedom", "tag": "select", "settings": {}})
    
    # 1. تبدیل دیکشنری JSON به یک رشته JSON
    json_string = json.dumps(full_config, indent=4)
    
    # 2. انکد کردن رشته JSON به Base64
    base64_bytes = base64.b64encode(json_string.encode('utf-8'))
    base64_string = base64_bytes.decode('utf-8')
    
    try:
        # 3. ذخیره رشته Base64 در فایل TXT
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(base64_string)
            
        print(f"✅ فایل کانفیگ Base64 با موفقیت در {output_file} ایجاد شد.")
    except Exception as e:
        print(f"❌ خطا در نوشتن فایل خروجی: {e}")


# اجرای اصلی
if SUBSCRIPTION_LINKS:
    xray_outbounds = fetch_all_outbounds(SUBSCRIPTION_LINKS)
    # 👈 استفاده از تابع جدید برای Base64
    generate_xray_config_base64(xray_outbounds, OUTPUT_FILE) 
else:
    print("لیست سابسکریپشن‌ها خالی است. هیچ فایلی تولید نشد.")
