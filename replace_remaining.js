const fs = require('fs');
const path = require('path');

const appTsxPath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appTsxPath, 'utf8');

// The replacement mapping using regex
const replacements = [
  // Missing dark mode on bg-white
  { regex: /bg-white(?!\/| dark:| text-| border-)/g, replacement: 'bg-white dark:bg-card-bg' },
  { regex: /bg-white\/95(?! dark:)/g, replacement: 'bg-white/95 dark:bg-card-bg/95' },
  
  // Remaining brand blues/purples
  { regex: /bg-\[#e2e8f8\]/g, replacement: 'bg-brand-light' },
  { regex: /hover:bg-\[#e2e8f8\]/g, replacement: 'hover:bg-brand-light' },
  { regex: /bg-\[#e2e8f8\]\/50/g, replacement: 'bg-brand-light/50' },
  { regex: /hover:bg-\[#e2e8f8\]\/50/g, replacement: 'hover:bg-brand-light/50' },
  { regex: /dark:bg-\[#2a2f45\]/g, replacement: 'dark:bg-brand-light' },
  { regex: /dark:hover:bg-\[#2a2f45\]\/50/g, replacement: 'dark:hover:bg-brand-light/50' },
  
  { regex: /bg-\[#4f46e5\]/g, replacement: 'bg-brand-hover' },
  { regex: /bg-\[#4f46e5\]\/20/g, replacement: 'bg-brand/20' },
  { regex: /bg-\[#4f46e5\]\/5/g, replacement: 'bg-brand/5' },
  { regex: /text-\[#3323cc\]/g, replacement: 'text-brand' },
  
  { regex: /border-\[#4f46e5\]\/20/g, replacement: 'border-brand/20' },
  { regex: /border-\[#3223cc\]\/10/g, replacement: 'border-brand/10' },
  
  { regex: /bg-\[#c7c4d8\]/g, replacement: 'bg-main-border' },
  { regex: /border-\[#c7c4d8\]\/70/g, replacement: 'border-main-border' },
  
  // Also some stray #0f111a for dark main background (old theme)
  { regex: /bg-\[#0f111a\]/g, replacement: 'bg-main-bg' },
  
  // Ensure the inline google popup styles use the right colors, though less critical
  { regex: /color:#151c27;/g, replacement: 'color:#0A192F;' },
];

let matchCount = 0;
for (const { regex, replacement } of replacements) {
  const matches = content.match(regex);
  if (matches) {
    matchCount += matches.length;
    content = content.replace(regex, replacement);
  }
}

fs.writeFileSync(appTsxPath, content, 'utf8');
console.log(`Successfully replaced ${matchCount} remaining colors.`);
