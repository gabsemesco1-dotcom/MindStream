const fs = require('fs');

const content = fs.readFileSync('c:/Users/LENOVO/Desktop/please do not delete/MindStream/src/App.tsx', 'utf-8');

// A very naive regex to find potential text inside JSX tags
const matches = content.match(/>([^<{}]+)</g);

if (matches) {
  const texts = matches.map(m => m.slice(1, -1).trim()).filter(m => m.length > 0);
  const uniqueTexts = [...new Set(texts)];
  console.log('Found', uniqueTexts.length, 'unique strings.');
  fs.writeFileSync('c:/Users/LENOVO/Desktop/please do not delete/MindStream/scripts/strings.txt', uniqueTexts.join('\n'));
} else {
  console.log('No matches');
}
