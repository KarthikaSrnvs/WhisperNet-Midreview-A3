
const config = require('./config');
const fs = require('fs');
const path = require('path');

console.log('\n🤝 WHISPERNET NETWORK INVITATION 🤝');
console.log('==============================================');
console.log('Share the following details with your friend so they can join your network.\n');

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');

console.log('--- STEP 1: Copy this to their .env file ---');
console.log(envContent);
console.log('-------------------------------------------\n');

console.log('--- STEP 2: Instructions for your friend ---');
console.log('1. Install dependencies: npm install');
console.log('2. Ensure cloudflared is installed.');
console.log('3. Run a node (e.g., Node 2):');
console.log('   USE_CLOUDFLARE=true node run-node.js node2 4002');
console.log('-------------------------------------------\n');

console.log('Once they start their node, your DHT will automatically discover them!');
