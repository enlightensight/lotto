import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const code = fs.readFileSync('src/main.js', 'utf8');

// Find all `const varName = document.getElementById('elemId');`
const varMap = new Map();
const assignRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*document\.getElementById\(['"]([^'"]+)['"]\)/g;
let m;
while ((m = assignRegex.exec(code)) !== null) {
  const varName = m[1];
  const id = m[2];
  const exists = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  varMap.set(varName, { id, exists });
}

console.log(`Found ${varMap.size} variables assigned from getElementById.`);
const missingVars = [];
for (const [v, data] of varMap.entries()) {
  if (!data.exists) {
    missingVars.push({ varName: v, id: data.id });
  }
}
console.log(`Missing element IDs in index.html: ${missingVars.length}`);
missingVars.forEach(mv => console.log(`  Variable: ${mv.varName} -> id="${mv.id}"`));

// Now check if any of these missing variables have .addEventListener or property access on them
const missingUsed = [];
missingVars.forEach(mv => {
  const directCall = new RegExp(`\\b${mv.varName}\\.addEventListener`, 'g');
  const propAccess = new RegExp(`\\b${mv.varName}\\.(?!addEventListener)[a-zA-Z0-9_$]+`, 'g');
  if (directCall.test(code)) {
    missingUsed.push({ varName: mv.varName, id: mv.id, type: 'addEventListener without ?.' });
  }
});

console.log(`Missing variables calling .addEventListener directly: ${missingUsed.length}`);
missingUsed.forEach(mu => console.log(`  CRITICAL: ${mu.varName} (id="${mu.id}") calls ${mu.type}`));
