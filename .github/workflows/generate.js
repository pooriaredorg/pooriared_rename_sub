const fs = require('fs');
const path = require('path');
const https = require('https'); 

// متغیرهای محیطی را از فایل YAML دریافت کنید
const CONFIG_URL = process.env.CONFIG_URL;
const CONFIG_SUFFIX = process.env.CONFIG_NAME_SUFFIX; 
const CONFIG_INDEX = parseInt(process.env.CONFIG_INDEX, 10); 

// تابع برای دانلود محتوا
function fetchConfigs() {
    return new Promise((resolve, reject) => {
        // استفاده از https داخلی برای دانلود
        https.get(CONFIG_URL, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                const configs = data.split('\n').filter(line => line.trim() !== '');
                console.log(`✅ ${configs.length} configs fetched.`);
                resolve(configs);
            });
        }).on('error', (err) => {
            console.error("❌ Error fetching configs:", err.message);
            reject(err);
        });
    });
}

/**
 * نام کانفیگ را در یک خط پروکسی مشخص پیدا کرده و پسوند را اضافه می‌کند.
 */
function appendSuffixToConfigName(configLine, suffix) {
    const nameDelimiter = '#';
    const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, ''); 

    if (configLine.includes(nameDelimiter)) {
        const parts = configLine.split(nameDelimiter);
        const originalName = parts.pop(); 
        const newName = originalName + safeSuffix;
        const modifiedLine = parts.join(nameDelimiter) + nameDelimiter + newName;
        return modifiedLine;
    }
    return configLine;
}

// تابع اصلی اجرای اسکریپت - فقط یک کانفیگ را پردازش می‌کند
async function run() {
    const allConfigs = await fetchConfigs();
    const configCount = allConfigs.length;

    if (configCount === 0) {
        console.log("No configs found. Exiting.");
        return;
    }
    
    // 🌟 رفع خطای NaN
    if (isNaN(CONFIG_INDEX) || CONFIG_INDEX <= 0 || CONFIG_INDEX > configCount) {
        // این پیام خطا به دلیل اجرای ناموفق قبلی است، اما کد جدید تضمین می‌کند که اگر ورودی NaN باشد، متوقف شود.
        console.error(`❌ Invalid CONFIG_INDEX: ${CONFIG_INDEX}. Must be between 1 and ${configCount}.`);
        return;
    }
    
    const indexToProcess = CONFIG_INDEX - 1; 
    const originalConfig = allConfigs[indexToProcess];
    
    const suffix = CONFIG_SUFFIX.replace(/[^a-zA-Z0-9]/g, ''); 
    const BASE_FILE_NAME = "POORIARED"; 
    
    console.log(`\n⚙️ Processing single config at index ${CONFIG_INDEX}...`);
    
    let fileNamePrefix;
    if (CONFIG_INDEX === 1) {
        fileNamePrefix = BASE_FILE_NAME; 
    } else {
        fileNamePrefix = `${BASE_FILE_NAME}${CONFIG_INDEX - 1}`; 
    }
    
    const fileName = `${fileNamePrefix}${suffix}`;
    
    // ساخت مسیر فایل (output/POORIARED1ali.txt)
    const outputDir = path.join(process.cwd(), 'output');
    const filePath = path.join(outputDir, `${fileName}.txt`);

    const modifiedConfig = appendSuffixToConfigName(originalConfig, suffix);
    
    // 🌟 ساخت پوشه output و نوشتن فایل به صورت محلی
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    
    fs.writeFileSync(filePath, modifiedConfig);
    
    console.log(`\n🎉 Done! Created local file: ${filePath}`);
}

run();
