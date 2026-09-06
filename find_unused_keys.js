const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\Users\\LENOVO\\Desktop\\please do not delete\\MindStream';
const localesDir = path.join(projectRoot, 'src', 'i18n', 'locales');
const enTranslationFile = path.join(localesDir, 'en', 'translation.json');
const srcDir = path.join(projectRoot, 'src');

const enData = JSON.parse(fs.readFileSync(enTranslationFile, 'utf8'));
const keys = Object.keys(enData);

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
                callback(filePath, stat);
            }
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

const usedKeys = new Set();
const fileContents = [];

walkSync(srcDir, function(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    fileContents.push(content);
});

keys.forEach(key => {
    let isUsed = false;
    for (const content of fileContents) {
        // Checking common usage patterns like t('key'), t("key"), t(`key`), or i18nKey="key"
        if (
            content.includes(`'${key}'`) || 
            content.includes(`"${key}"`) || 
            content.includes(`\`${key}\``) ||
            content.includes(`=${key} `)
        ) {
            isUsed = true;
            break;
        }
    }
    if (isUsed) {
        usedKeys.add(key);
    }
});

const unusedKeys = keys.filter(key => !usedKeys.has(key));
console.log(JSON.stringify({ unusedKeys }, null, 2));
