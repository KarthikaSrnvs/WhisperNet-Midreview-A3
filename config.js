
// Configuration for Decentralized WhisperNet
require('dotenv').config({ path: '../.env' }); // Fallback to look for .env in parent or local

const config = {
    // Identity of this specific instance
    NODE_ID: process.env.NODE_ID || 'node1',
    PORT: process.env.PORT || 4001,

    // Routing: Where to send the next hop
    NEXT_NODE_IP: process.env.NEXT_NODE_IP || 'localhost',
    NEXT_NODE_PORT: process.env.NEXT_NODE_PORT || 4001, // CHANGED: 4002 → 4001
    NEXT_NODE_URL: process.env.NEXT_NODE_URL || null,

    // AI Service Configuration (Only used by Node 3 / Exit Node)
    // Using hybrid approach: Gemini for extraction, Llama for generation
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

    // Llama/Ollama configuration
    LOCAL_LLM_URL: process.env.LOCAL_LLM_URL || 'http://localhost:11434',
    LOCAL_LLM_MODEL: process.env.LOCAL_LLM_MODEL || 'llama3',

    // Shared Encryption Keys (Hex encoded strings)
    NODE_KEYS: [
        (process.env.KEY1 || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').trim(),
        (process.env.KEY2 || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').trim(),
        (process.env.KEY3 || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef').trim()
    ],

    // DHT Configuration
    DHT_TOPIC_STRING: process.env.DHT_TOPIC || 'whispernet-v1-production-nodes',

    // Cloudflare Configuration
    USE_CLOUDFLARE: process.env.USE_CLOUDFLARE === 'true'
};

module.exports = config;
