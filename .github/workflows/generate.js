// دیگر نیازی به require یا import برای Octokit و fetch در بالای فایل نیست
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// 🌟 تابع کمکی برای ایجاد Octokit و fetch به صورت داینامیک
async function getTools() {
    // 🌟 استفاده از Dynamic Import برای Octokit
    const { Octokit } = await import('@octokit/rest');
    
    // 🌟 استفاده از fetch داخلی Node.js (اگر در v18 موجود نباشد، از node-fetch استفاده می‌کند)
    const fetch = globalThis.fetch || (await import('node-fetch')).default;
    
    return { 
        octokit: new Octokit({ auth: GITHUB_TOKEN }),
        fetch: fetch 
    };
}

// ... بقیه متغیرهای محیطی
const CONFIG_URL = process.env.CONFIG_URL;
const CONFIG_SUFFIX = process.env.CONFIG_NAME_SUFFIX; 
const CONFIG_INDEX = parseInt(process.env.CONFIG_INDEX, 10); 
const REPO_OWNER = process.env.GITHUB_REPOSITORY.split('/')[0];
const REPO_NAME = process.env.GITHUB_REPOSITORY.split('/')[1];


// تابع برای دانلود محتوا
async function fetchConfigs(fetchTool) {
    try {
        const response = await fetchTool(CONFIG_URL); 
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
async function createCommit(octokitTool, fileName, content) {
    // ... (منطق تابع ثابت است) ...
    // باید octokit را از بیرون دریافت کند
    
    const filePath = `output/${fileName}.txt`; 

    try {
        let sha = null;
        try {
            const { data } = await octokitTool.repos.getContent({
                owner: REPO_OWNER,
                repo: REPO_NAME,
                path: filePath,
            });
            sha = data.sha;
        } catch (e) {
            // فایل وجود ندارد
        }

        await octokitTool.repos.createOrUpdateFileContents({
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

// ... (تابع appendSuffixToConfigName ثابت می‌ماند) ...
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


// تابع اصلی اجرای اسکریپت
async function run() {
    // 🌟 فراخوانی ابزارها به صورت داینامیک
    const { octokit, fetch: fetchTool } = await getTools();
    
    const allConfigs = await fetchConfigs(fetchTool);
    const configCount = allConfigs.length;

    if (configCount === 0) {
        console.log("No configs found. Exiting.");
        return;
    }
    
    if (isNaN(CONFIG_INDEX) || CONFIG_INDEX <= 0 || CONFIG_INDEX > configCount) {
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
    const modifiedConfig = appendSuffixToConfigName(originalConfig, suffix);
    const content = modifiedConfig;

    console.log(`\n⏳ Creating/Updating ${fileName}.txt...`);
    await createCommit(octokit, fileName, content); // 🌟 ارسال octokit به تابع
    
    console.log(`\n🎉 Done! Created single subscription file: ${fileName}.txt.`);
}

run();
