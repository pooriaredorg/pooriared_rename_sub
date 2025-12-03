import requests
import sys
import os
import json
import base64
from urllib.parse import urlencode, quote

def convert_json_to_url(proxy_config, index, name_prefix):
    """
    تبدیل یک آبجکت پراکسی JSON (برای Clash) به یک رشته URL (برای Vmess/VLESS)
    """
    try:
        # نام‌گذاری خودکار: پیشوند + شماره
        new_name = f"{name_prefix}{index}"
        
        # تعیین نوع پروتکل
        proxy_type = proxy_config.get('type', '').lower()
        
        # --- منطق تبدیل ---
        if proxy_type == 'vmess':
            # برای Vmess، ساختار URL از یک آبجکت JSON Base64 شده است
            # (این فرمت با فرمت JSON ساب Clash کمی متفاوت است و نیاز به دقت دارد)
            
            # ساده‌سازی: اگر ساختار ساب JSON شما از قبل URLهای Vmess را نگه می‌دارد، 
            # فقط باید نام (remark) را تغییر دهیم. اما چون شما یک ساب Clash (با ساختار آبجکت) دادید، 
            # فرض می‌کنیم باید آن را به فرمت Vmess/VLESS URL تبدیل کنیم.

            # فرض می‌کنیم تمام اطلاعات لازم در پراکسی وجود دارد
            url_data = {
                'v': '2',
                'ps': new_name,  # نام جدید
                'add': proxy_config.get('server'),
                'port': int(proxy_config.get('port')),
                'id': proxy_config.get('uuid'),
                'aid': proxy_config.get('alterId', 0),
                'net': proxy_config.get('network'),
                # فیلدهای دیگر مانند security, type, host, path, tls/sni...
            }
            # این بخش تبدیل، بسته به جزئیات JSON شما، ممکن است نیاز به اصلاح داشته باشد.
            # اینجا فقط یک نمونه ساده از رایج‌ترین فیلدها آورده شده است.
            
            json_str = json.dumps(url_data)
            encoded_json = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')
            return f"vmess://{encoded_json}"
        
        elif proxy_type == 'vless' or proxy_type == 'trojan':
            # برای VLESS/Trojan، ساختار URL متفاوتی دارد
            # vless://uuid@server:port?params#remark
            
            # پارامترهای اصلی
            uuid = proxy_config.get('uuid', proxy_config.get('password'))
            server = proxy_config.get('server')
            port = proxy_config.get('port')
            
            # پارامترهای اضافی (query parameters)
            query_params = {
                'security': proxy_config.get('tls', 'none'),
                'type': proxy_config.get('network'),
                # دیگر پارامترها (host, path, sni, fp, ...): باید به دقت از JSON استخراج شوند
                'host': proxy_config.get('ws-opts', {}).get('headers', {}).get('Host'),
                'path': proxy_config.get('ws-opts', {}).get('path'),
            }
            
            # حذف پارامترهای None
            query_params = {k: v for k, v in query_params.items() if v is not None}
            
            query_string = urlencode(query_params, quote_via=quote)
            
            # ساخت URL
            url_scheme = f"{proxy_type}://{uuid}@{server}:{port}"
            return f"{url_scheme}?{query_string}#{quote(new_name)}"
            
        else:
            return None # پروتکل ناشناخته

    except Exception as e:
        print(f"Error converting config {index}: {e}")
        return None


def process_and_convert(sub_link, name_prefix):
    """
    دریافت JSON، تبدیل به URL، تغییر نام و Base64 کردن خروجی نهایی
    """
    try:
        print(f"در حال دریافت محتوای JSON از: {sub_link}")
        response = requests.get(sub_link, timeout=20) 
        response.raise_for_status() 
        data = response.json()
        
        if 'proxies' not in data or not isinstance(data['proxies'], list):
             return "ERROR: JSON structure is not recognized (missing 'proxies' list)."
             
        proxies = data['proxies']
        url_configs = []
        
        for i, proxy in enumerate(proxies):
            # تبدیل هر کانفیگ JSON به فرمت URL مورد نیاز
            url_config = convert_json_to_url(proxy, i + 1, name_prefix)
            
            if url_config:
                url_configs.append(url_config)
            
        if not url_configs:
            return "ERROR: No convertible configurations found."
            
        # 1. ترکیب همه URLها با خط جدید
        final_decoded_content = '\n'.join(url_configs)
        
        # 2. Base64 کردن کل محتوا
        final_encoded_sub = base64.b64encode(final_decoded_content.encode('utf-8')).decode('utf-8')

        return final_encoded_sub

    except requests.exceptions.RequestException as e:
        return f"ERROR: Failed to fetch subscription link: {e}"
    except json.JSONDecodeError:
        return "ERROR: Content is not valid JSON."
    except Exception as e:
        return f"ERROR: An unexpected error occurred: {e}"

# --- اجرای اسکریپت با ورودی‌های GitHub Actions ---
if __name__ == "__main__":
    
    sub_url = os.environ.get('SUB_URL')
    name_prefix = os.environ.get('NAME_PREFIX')
    output_filename = "POORIARED_sub.txt" # نام فایل خروجی جدید
    
    if not sub_url or not name_prefix:
        print("Error: SUB_URL and NAME_PREFIX must be provided.")
        sys.exit(1)

    result_content = process_and_convert(sub_url, name_prefix)
    
    if result_content.startswith("ERROR:"):
        print(result_content)
        sys.exit(1)
    else:
        # ذخیره محتوای Base64
        with open(output_filename, "w") as f:
            f.write(result_content)
        print(f"\n✅ فایل Base64 با نام '{output_filename}' با موفقیت ایجاد شد.")
