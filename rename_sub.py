import base64
import requests
import sys
import os
from urllib.parse import urlparse, urlunparse, quote, unquote

def rename_configs(sub_link, new_names_input):
    """
    دریافت سابسکریپشن، تغییر نام کانفیگ‌ها و برگرداندن ساب جدید
    """
    
    # آماده‌سازی نام‌ها: جدا کردن نام‌ها با خط جدید و حذف فاصله‌های اضافی
    new_names_list = [name.strip() for name in new_names_input.split('\n') if name.strip()]
    if not new_names_list:
        return "ERROR: No new names were provided. Please provide a list of names."

    try:
        # 1. دریافت محتوای ساب اصلی
        print(f"در حال دریافت محتوای ساب از: {sub_link}")
        response = requests.get(sub_link, timeout=15)
        response.raise_for_status() 
        
        # 2. دیکد کردن محتوا (Base64)
        encoded_content = response.text.strip()
        decoded_content = base64.b64decode(encoded_content).decode('utf-8')
        
        # 3. پردازش و تغییر نام
        configs = decoded_content.split('\n')
        new_configs = []
        name_index = 0
        
        for config_url in configs:
            if not config_url.strip():
                continue
            
            # انتخاب نام جدید از لیست (اگر تعداد کانفیگ بیشتر از نام‌ها باشد، نام‌ها تکرار می‌شوند)
            new_name = new_names_list[name_index % len(new_names_list)]
            
            # منطق تغییر نام برای کانفیگ‌های URL-محور (Vmess/VLESS/Trojan)
            # نام (Remark) در بخش Fragment (بخش بعد از #) ذخیره می‌شود
            parsed_url = urlparse(config_url)
            
            # انکد کردن نام جدید برای استفاده در URL (باید URL-Safe باشد)
            encoded_new_name = quote(new_name, safe='') 
            
            # ساخت URL جدید با نام جدید به عنوان fragment
            new_config = urlunparse((
                parsed_url.scheme, 
                parsed_url.netloc, 
                parsed_url.path, 
                parsed_url.params, 
                parsed_url.query, 
                encoded_new_name
            ))
            
            new_configs.append(new_config)
            name_index += 1
            
        final_decoded_sub = '\n'.join(new_configs)
        
        # 4. انکد کردن مجدد (Base64)
        final_encoded_sub = base64.b64encode(final_decoded_sub.encode('utf-8')).decode('utf-8')
        
        return final_encoded_sub

    except Exception as e:
        return f"ERROR: An unexpected error occurred: {e}"

# --- اجرای اسکریپت با ورودی‌های GitHub Actions ---
if __name__ == "__main__":
    
    # دریافت ورودی‌ها از متغیرهای محیطی GitHub Actions
    sub_url = os.environ.get('SUB_URL')
    new_names = os.environ.get('NEW_NAMES')
    output_filename = "custom_sub.txt" 
    
    if not sub_url or not new_names:
        print("Error: SUB_URL and NEW_NAMES must be provided.")
        sys.exit(1)

    result_content = rename_configs(sub_url, new_names)
    
    if result_content.startswith("ERROR:"):
        print(result_content)
        sys.exit(1)
    else:
        # ذخیره محتوای جدید در فایلی که قرار است به GitHub Commit شود
        with open(output_filename, "w") as f:
            f.write(result_content)
        print(f"✅ فایل '{output_filename}' با موفقیت ایجاد شد و آماده Commit است.")
