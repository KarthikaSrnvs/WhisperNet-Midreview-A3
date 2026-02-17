/**
 * WhisperNet Decentralized Launcher
 * Use this to start a specific component on a remote machine.
 * 
 * Usage:
 * NODE_ID=node1 PORT=4001 NEXT_NODE_IP=192.168.1.10 node start-node.js
 * AI_TYPE=local NODE_ID=node3 node start-node.js
 */

const WhisperNode = require('./node');
const WhisperClient = require('./client');
const config = require('./config');

const mode = process.env.MODE || 'node'; // 'node' or 'client'

if (mode === 'client') {
    console.log('--- WHISPERNET CLIENT MODE ---');
    const client = new WhisperClient();
    client.start();
} else {
    console.log(`--- WHISPERNET NODE MODE: ${config.NODE_ID} ---`);
    const node = new WhisperNode();
    node.start();
}
