const fs = require('fs');

let code = fs.readFileSync('src/data.js', 'utf8');

// 1. Clean control characters and trailing punctuation in parseLotteryBarcode
if (!code.includes('replace(/[\\x00-\\x1F\\x7F]/g')) {
  code = code.replace(
    "let s = String(raw).replace(/[\\r\\n\\t]/g, '').trim();",
    "let s = String(raw).replace(/[\\x00-\\x1F\\x7F]/g, '').trim();\n  if (!s) return null;\n  s = s.replace(/[;,.]$/, '').trim();"
  );
}

// 2. Expand delimiter regexes to support slash, dot, colon
const oldPattern0 = "const fourPartMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})[-_\\s]+(\\d{1,2})[-_\\s]+(\\d{1,4})(?:[-_\\s]*[([{]?(\\d{1,4})[)\\]}]?)?$/);";
const newPattern0 = "const fourPartMatch = s.match(/^(\\d{3,5})[-_/\\s.:]+(\\d{5,8})[-_/\\s.:]+(\\d{1,2})[-_/\\s.:]+(\\d{1,4})(?:[-_/\\s.:]*[([{]?(\\d{1,4})[)\\]}]?)?$/);";
if (code.includes(oldPattern0)) {
  code = code.replace(oldPattern0, newPattern0);
}

const oldPattern1 = "const delimitedMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})[-_\\s]+(\\d{1,3})(?:[-_\\s]*[([{]?(\\d{1,4})[)\\]}]?)?$/);";
const newPattern1 = "const delimitedMatch = s.match(/^(\\d{3,5})[-_/\\s.:]+(\\d{5,8})[-_/\\s.:]+(\\d{1,3})(?:[-_/\\s.:]*[([{]?(\\d{1,4})[)\\]}]?)?$/);";
if (code.includes(oldPattern1)) {
  code = code.replace(oldPattern1, newPattern1);
}

const oldPattern1b = "const parenthesizedTixMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})[-_\\s]*[([{](\\d{1,4})[)\\]}]$/);";
const newPattern1b = "const parenthesizedTixMatch = s.match(/^(\\d{3,5})[-_/\\s.:]+(\\d{5,8})[-_/\\s.:]*[([{](\\d{1,4})[)\\]}]$/);";
if (code.includes(oldPattern1b)) {
  code = code.replace(oldPattern1b, newPattern1b);
}

const oldPattern2a = "const gamePackMatch = s.match(/^(\\d{3,5})[-_\\s]+(\\d{5,8})(?:[-_\\s]+(\\d{1,2}))?$/);";
const newPattern2a = "const gamePackMatch = s.match(/^(\\d{3,5})[-_/\\s.:]+(\\d{5,8})(?:[-_/\\s.:]+(\\d{1,2}))?$/);";
if (code.includes(oldPattern2a)) {
  code = code.replace(oldPattern2a, newPattern2a);
}

// 3. Expand leading zero stripping for 17 and 18 digit scanner outputs
const oldLeadingZeroes = `  if (digits.length === 15 && digits.startsWith('0')) {
    digits = digits.slice(1);
  } else if (digits.length === 16 && digits.startsWith('00')) {
    digits = digits.slice(2);
  }`;
const newLeadingZeroes = `  if (digits.length === 18 && digits.startsWith('0000')) {
    digits = digits.slice(4);
  } else if (digits.length === 17 && digits.startsWith('000')) {
    digits = digits.slice(3);
  } else if (digits.length === 16 && digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.length === 15 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }`;
if (code.includes(oldLeadingZeroes)) {
  code = code.replace(oldLeadingZeroes, newLeadingZeroes);
}

// 4. Update normalizePackNumber with control chars and expanded delimiters
const oldNorm = "let s = String(packStr).replace(/[\\r\\n\\t]/g, '').replace(/^\\][a-zA-Z0-9]{2,3}/, '').trim();\n  const parts = s.split(/[-_\\s]+/);";
const newNorm = "let s = String(packStr).replace(/[\\x00-\\x1F\\x7F]/g, '').replace(/^\\][a-zA-Z0-9]{2,3}/, '').trim();\n  const parts = s.split(/[-_/\\s.:]+/);";
if (code.includes(oldNorm)) {
  code = code.replace(oldNorm, newNorm);
}

fs.writeFileSync('src/data.js', code, 'utf8');
console.log('✓ Successfully hardened src/data.js barcode engine!');
