
// Set llama3 as the default model globally
process.env.LOCAL_LLM_MODEL = 'llama3';

const WhisperClient = require('./client');
const WhisperNode = require('./node');

console.log('🎭 WHISPERNET HYBRID AI INITIALIZATION 🎭');
console.log('==============================================');
console.log('Entity Extraction: Gemini AI');
console.log('Response Generation: Llama3 (via Ollama)');
console.log('==============================================\n');

// Clear any existing config caches
delete require.cache[require.resolve('./config')];

// Configure and start Node 1
console.log('🧱 Setting up Node 1...');
process.env.NODE_ID = 'node1';
process.env.PORT = '4001';
process.env.NEXT_NODE_IP = 'localhost';
process.env.NEXT_NODE_PORT = '4002';

const node1 = new WhisperNode('node1', 4001);

// Configure and start Node 2  
setTimeout(() => {
    console.log('\n🧱 Setting up Node 2...');
    delete require.cache[require.resolve('./config')];
    process.env.NODE_ID = 'node2';
    process.env.PORT = '4002';
    process.env.NEXT_NODE_IP = 'localhost';
    process.env.NEXT_NODE_PORT = '4003';
    
    const node2 = new WhisperNode('node2', 4002);
    node2.start();
    console.log('✅ Node 2 started on port 4002');
}, 1000);

// Configure and start Node 3 (Exit Node)
setTimeout(() => {
    console.log('\n🧱 Setting up Node 3 (Exit Node)...');
    delete require.cache[require.resolve('./config')];
    process.env.NODE_ID = 'node3';
    process.env.PORT = '4003';
    process.env.NEXT_NODE_IP = 'localhost';
    process.env.NEXT_NODE_PORT = '4004'; // Non-existent port means exit node
    process.env.GEMINI_API_KEY = 'AIzaSyAL_0xpmqIcyHNQT3FFcG3cS5ndgjiAHv8';
    process.env.LOCAL_LLM_URL = 'http://localhost:11434';
    // LOCAL_LLM_MODEL already set to 'llama3' at the top
    
    const node3 = new WhisperNode('node3', 4003);
    node3.start();
    console.log('✅ Node 3 (Exit Node) started on port 4003');
    console.log('   AI Pipeline: Gemini → Llama3');
}, 2000);

// Configure and start Client
setTimeout(() => {
    console.log('\n🧱 Setting up Client...');
    delete require.cache[require.resolve('./config')];
    process.env.NEXT_NODE_IP = 'localhost';
    process.env.NEXT_NODE_PORT = '4001'; // Client connects to Node 1
    
    const client = new WhisperClient();
    client.start();
    
    console.log('✅ Client started on port 3000');
    
    // Display startup summary
    setTimeout(() => {
        console.log('\n✨ ======================================== ✨');
        console.log('✨      WHISPERNET STARTUP COMPLETE       ✨');
        console.log('✨ ======================================== ✨');
        console.log('\n🌐 NETWORK TOPOLOGY:');
        console.log('   Client (3000) → Node1 (4001) → Node2 (4002) → Node3 (4003) → AI');
        console.log('   Response: AI → Node3 → Node2 → Node1 → Client');
        
        console.log('\n🤖 AI PIPELINE (Node 3):');
        console.log('   Step 1: Gemini extracts entities/intents');
        console.log('   Step 2: Llama3 generates final response');
        
        console.log('\n🔗 ACCESS POINTS:');
        console.log('   Frontend:    http://localhost:3000');
        console.log('   Node 1:      http://localhost:4001/health');
        console.log('   Node 2:      http://localhost:4002/health');
        console.log('   Node 3 (AI): http://localhost:4003/health');
        
        console.log('\n⚡ STATUS: READY TO PROCESS REQUESTS ⚡');
    }, 1000);
}, 3000);

// Start Node 1 after all configuration is set
setTimeout(() => {
    node1.start();
    console.log('✅ Node 1 started on port 4001');
}, 500);
