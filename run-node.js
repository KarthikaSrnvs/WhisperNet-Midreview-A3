
const WhisperNode = require('./node');
const config = require('./config');

const args = process.argv.slice(2);
const nodeId = args[0] || process.env.NODE_ID || 'node2';
const port = parseInt(args[1] || process.env.PORT || 4002);

if (!['node1', 'node2', 'node3'].includes(nodeId)) {
    console.error('Usage: node run-node.js <node1|node2|node3> [port]');
    process.exit(1);
}

console.log(`\n🪐 WHISPERNET STANDALONE NODE: ${nodeId} 🪐`);
console.log('==============================================');
console.log(`Cloudflare Mode: ${config.USE_CLOUDFLARE ? 'ENABLED ✅' : 'DISABLED ❌'}`);
console.log(`DHT Topic: ${config.DHT_TOPIC_STRING}`);

const node = new WhisperNode(nodeId, port);
node.start();
