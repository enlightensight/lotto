import fs from 'fs';
import path from 'path';

console.log('--- Synchronizing server_data/admin_state.json with verified credentials ---');

const filePath = path.resolve('server_data/admin_state.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Verified PBKDF2 hashes from test DB
const STORE_AMIGO_HASH = 'pbkdf2$sha256$600000$c90480fc9a0f68f7e0783ed039e366d9$27c780b861fe04b85dbe957fbed7efe5d6b742632fcc42002c98af2d670e4cc6';
const ADMIN_HASH = 'pbkdf2$sha256$600000$b2d8bff519a8afde70dc23fa98d50c75$52f28b2f8ae58095e36d5687ee19c2ab292dbbbc34ef3e7f87b882c48ea717e0';

if (!Array.isArray(data.storeUsers)) data.storeUsers = [];
let amigoUser = data.storeUsers.find(u => u.username === 'amigo');
if (!amigoUser) {
  amigoUser = {
    id: 'usr_amigo_1',
    store_id: 'store_amigo',
    username: 'amigo',
    email: 'amigofoodmart2300@gmail.com',
    role: 'STORE_USER',
    account_status: 'APPROVED',
    is_active: 1
  };
  data.storeUsers.push(amigoUser);
}
amigoUser.password_hash = STORE_AMIGO_HASH;
amigoUser.account_status = 'APPROVED';
amigoUser.is_active = 1;

if (!Array.isArray(data.admins)) data.admins = [];
let adminUser = data.admins.find(a => a.username === 'admin');
if (!adminUser) {
  adminUser = {
    id: 'adm_001',
    username: 'admin',
    email: 'amigofoodmart2300@gmail.com',
    role: 'SUPER_ADMIN',
    is_active: 1
  };
  data.admins.push(adminUser);
}
adminUser.password_hash = ADMIN_HASH;
adminUser.email = 'amigofoodmart2300@gmail.com';
adminUser.is_active = 1;

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('✓ Successfully synchronized server_data/admin_state.json with verified credentials');

