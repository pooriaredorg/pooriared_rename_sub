const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// متغیرهای محیطی را از فایل YAML دریافت کنید
const CONFIG_URL = process.env.CONFIG_URL;
const BASE_NAME = process.env.BASE_NAME;
const MAX_SUBS = parseInt(process.env.MAX_SUBS, 10); // 50
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
        // فرض می‌کنیم کانفیگ‌ها هر خط یک پروکسی است
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
        // برای دریافت SHA فایل اگر وجود داشت
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
            sha: sha, // اگر فایل وجود داشت، SHA آن را برای آپدیت بفرست
            branch: process.env.GITHUB_REF_NAME || 'main', // یا master، بستگی به نام شاخه اصلی شما دارد
        });
        
        console.log(`  ➕ Successfully committed: ${filePath}`);
    } catch (error) {
        console.error(`  ❌ Error committing ${fileName}:`, error.message);
    }
}

// تابع اصلی اجرای اسکریپت
async function run() {
    const allConfigs = await fetchConfigs();

    if (allConfigs.length === 0) {
        console.log("No configs found. Exiting.");
        return;
    }

    let currentSubIndex = 1;
    let configsProcessed = 0;
    
    // تعداد کل ساب هایی که باید ساخته شود (50)
    const totalSubsToCreate = MAX_SUBS;

    for (let i = 0; i < totalSubsToCreate; i++) {
        // اگر تعداد کانفیگ‌های باقی‌مانده کمتر از تعداد کانفیگ‌های مورد نیاز برای پر کردن یک ساب باشد، متوقف شود.
        if (configsProcessed >= allConfigs.length) {
            console.log(`🛑 All ${allConfigs.length} configs have been distributed. Stopping.`);
            break;
        }

        // هر ساب شامل فقط یک کانفیگ خواهد بود
        const config = allConfigs[configsProcessed];
        if (!config) continue;
        
        // تعیین نام فایل (POORIARED1, POORIARED2, ...)
        const fileName = `${BASE_NAME}${i + 1}`; 
        
        // محتوای ساب (فقط یک کانفیگ)
        const content = config;

        console.log(`\n⏳ Creating/Updating ${fileName}...`);
        await createCommit(fileName, content);
        
        configsProcessed++;
        currentSubIndex++;
    }

    console.log(`\n🎉 Done! Created/Updated ${configsProcessed} subscription files.`);
}

run();
