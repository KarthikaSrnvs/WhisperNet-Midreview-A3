
const WhisperClient = require('./client');
require('dotenv').config();

console.log('\n💎 WHISPERNET DASHBOARD RUNNER 💎');
console.log('==============================================');

const client = new WhisperClient();
client.start();
