import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');
const start = lines.findIndex(l => l.includes('id="viewAdminDashboard"'));
const end = lines.findIndex((l, i) => i > start && l.includes('<!-- Admin Action Modals -->'));

console.log('Admin dashboard range:', start, 'to', end);

for (let i = start; i < end + 100; i++) {
  const line = lines[i];
  if (line.includes('<tbody') || line.includes('id="admin') || line.includes('id="paneAdmin') || line.includes('data-admin-tab')) {
    console.log(`${i}: ${line.trim()}`);
  }
}

