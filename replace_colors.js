const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  // Backgrounds
  { regex: /bg-\[#f9f9ff\]/g, replacement: 'bg-main-bg' },
  { regex: /dark:bg-\[#0f111a\]/g, replacement: 'dark:bg-main-bg' },
  { regex: /dark:bg-\[#12141d\]/g, replacement: 'dark:bg-main-bg' },
  { regex: /bg-white(?!\/)/g, replacement: 'bg-card-bg' }, // Avoid matching bg-white/95
  { regex: /dark:bg-\[#161925\]/g, replacement: 'dark:bg-card-bg' },

  // Text Primary
  { regex: /text-\[#151c27\]/g, replacement: 'text-main-text' },
  { regex: /dark:text-white/g, replacement: 'dark:text-main-text' },
  { regex: /text-\[#f3f4f6\]/g, replacement: 'text-main-text' },

  // Text Secondary
  { regex: /text-\[#464555\]/g, replacement: 'text-secondary-text' },
  { regex: /text-\[#777587\]/g, replacement: 'text-muted-text' },
  { regex: /dark:text-\[#9ca3af\]/g, replacement: 'dark:text-muted-text' },
  { regex: /dark:text-\[#d1d5db\]/g, replacement: 'dark:text-secondary-text' },

  // Borders
  { regex: /border-\[#e2e8f8\]/g, replacement: 'border-main-border' },
  { regex: /border-\[#dce2f3\]/g, replacement: 'border-main-border' },
  { regex: /dark:border-\[#2a2f45\]/g, replacement: 'dark:border-main-border' },

  // Brand / Accent
  { regex: /text-\[#3525cd\]/g, replacement: 'text-brand' },
  { regex: /dark:text-\[#7f75f0\]/g, replacement: 'dark:text-brand' },
  { regex: /bg-\[#3525cd\]/g, replacement: 'bg-brand' },
  { regex: /dark:bg-\[#7f75f0\]/g, replacement: 'dark:bg-brand' },
  
  // Brand Light Backgrounds
  { regex: /bg-\[#f0f3ff\]/g, replacement: 'bg-brand-light' },
  { regex: /dark:bg-\[#1e2235\]/g, replacement: 'dark:bg-brand-light' },

  // Hover states
  { regex: /hover:bg-\[#f0f3ff\]/g, replacement: 'hover:bg-brand-light' },
  { regex: /dark:hover:bg-\[#1e2235\]/g, replacement: 'dark:hover:bg-brand-light' },
  { regex: /hover:bg-\[#4f46e5\]/g, replacement: 'hover:bg-brand-hover' },
  { regex: /dark:hover:bg-\[#6b60e6\]/g, replacement: 'dark:hover:bg-brand-hover' },
  { regex: /hover:text-\[#3525cd\]/g, replacement: 'hover:text-brand' },
  { regex: /dark:hover:text-\[#7f75f0\]/g, replacement: 'dark:hover:text-brand' },
  
  // Borders Brand
  { regex: /border-\[#3525cd\]/g, replacement: 'border-brand' },
  { regex: /dark:border-\[#7f75f0\]/g, replacement: 'dark:border-brand' },
  
  // focus ring
  { regex: /focus:ring-\[#3525cd\]/g, replacement: 'focus:ring-brand' },
  { regex: /focus:border-\[#3525cd\]/g, replacement: 'focus:border-brand' },
  { regex: /dark:focus:border-\[#7f75f0\]/g, replacement: 'dark:focus:border-brand' }
];

let original = content;
for (const {regex, replacement} of replacements) {
  content = content.replace(regex, replacement);
}

// Special case: darkMode boolean logic in classNames
// ${darkMode ? 'dark bg-[#0f111a] text-[#f3f4f6]' : 'bg-[#f9f9ff] text-[#151c27]'}
content = content.replace(/\$\{darkMode \? 'dark bg-\[#0f111a\] text-\[#f3f4f6\]' : 'bg-\[#f9f9ff\] text-\[#151c27\]'\}/g, 
  "${isDarkActive ? 'dark bg-main-bg text-main-text' : 'bg-main-bg text-main-text'}"
);

if (content !== original) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated App.tsx with semantic classes.');
} else {
  console.log('No changes were made.');
}
