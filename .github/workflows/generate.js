const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// متغیرهای محیطی را از فایل YAML دریافت کنید
const CONFIG_URL = process.env.CONFIG_URL;
const CONFIG_SUFFIX = process.env.CONFIG_NAME_SUFFIX; 
const CONFIG_INDEX = parseInt(process.env.CONFIG_INDEX, 10); 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY.split('/')[0];
const REPO_NAME = process.env.GITHUB_REPOSITORY.split('/')[1];

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// تابع برای دانلود محتوا
async function fetchConfigs() {
    try {
        const response = await fetch(CONFIG_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const configs = text.split('\n').filter(line => line.trim() !== '');
        
        console.log(`✅ ${configs.length} configs fetched.`);
        return configs;
    } catch (error) {
        console.error("❌ Error fetching configs:", error);
        return [];
    }
}

// تابع برای ایجاد فایل و Commit در گیت‌هاب
async function createCommit(fileName, content) {
    const filePath = `output/${fileName}.txt`; // فایل‌ها در پوشه output ذخیره می‌شوند

    try {
        let sha = null;
        try {
            const { data } = await octokit.repos.getContent({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: filePath,
            });
            sha = data.sha;
        } catch (e) {
            // فایل وجود ندارد
        }

        await octokit.repos.createOrUpdateFileContents({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: filePath,
            message: `🤖 Update subscription: ${fileName}`,
            content: Buffer.from(content).toString('base64'),
            sha: sha, 
            branch: process.env.GITHUB_REF_NAME || 'main', 
        });
        
        console.log(`  ➕ Successfully committed: ${filePath}`);
    } catch (error) {
        console.error(`  ❌ Error committing ${fileName}:`, error.message);
    }
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
    
    // بررسی اعتبار ایندکس ورودی
    if (isNaN(CONFIG_INDEX) || CONFIG_INDEX <= 0 || CONFIG_INDEX > configCount) {
        console.error(`❌ Invalid CONFIG_INDEX: ${CONFIG_INDEX}. Must be between 1 and ${configCount}.`);
        return;
    }
    
    const indexToProcess = CONFIG_INDEX - 1; 
    const originalConfig = allConfigs[indexToProcess];
    
    const suffix = CONFIG_SUFFIX.replace(/[^a-zA-Z0-9]/g, ''); 
    const BASE_FILE_NAME = "POORIARED"; 
    
    console.log(`\n⚙️ Processing single config at index ${CONFIG_INDEX}...`);
    
    // 1. تعیین نام فایل بر اساس ایندکس ورودی
    let fileNamePrefix;
    if (CONFIG_INDEX === 1) {
        fileNamePrefix = BASE_FILE_NAME; 
    } else {
        // مثلاً برای index 2، POORIARED1
        fileNamePrefix = `${BASE_FILE_NAME}${CONFIG_INDEX - 1}`; 
    }
    
    // نام نهایی فایل: (POORIARED1) + (ali)
    const fileName = `${fileNamePrefix}${suffix}`;

    // 2. اصلاح کانفیگ داخلی
    const modifiedConfig = appendSuffixToConfigName(originalConfig, suffix);

    // 3. ایجاد و Commit فایل
    const content = modifiedConfig;

    console.log(`\n⏳ Creating/Updating ${fileName}.txt...`);
    await createCommit(fileName, content);
    
    console.log(`\n🎉 Done! Created single subscription file: ${fileName}.txt.`);
}

run();
