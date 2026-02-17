const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OnionEncryption = require('./encryption');
const GeminiService = require('./gemini-service');
const LlamaService = require('./llama-service');
const fetch = require('node-fetch');
const Hyperswarm = require('hyperswarm');
const b4a = require('b4a');
const crypto = require('hypercore-crypto');
const TunnelService = require('./tunnel-service');
const config = require('./config');

class WhisperNode {
    constructor(nodeId = 'node1', port = 4001) {
        this.nodeId = nodeId;
        this.port = port;

        // Load config fresh for each node
        delete require.cache[require.resolve('./config')];
        const config = require('./config');

        // Convert hex keys from config to Buffers
        this.nodeKeys = config.NODE_KEYS.map(k => Buffer.from(k, 'hex'));
        this.nodeIndex = parseInt(this.nodeId.replace('node', '')) - 1;
        this.encryption = new OnionEncryption();

        // Determine next node based on node ID
        if (nodeId === 'node1') {
            this.nextNodeIp = 'localhost';
            this.nextNodePort = 4002;
            this.isExitNode = false;
        } else if (nodeId === 'node2') {
            this.nextNodeIp = 'localhost';
            this.nextNodePort = 4003;
            this.isExitNode = false;
        } else if (nodeId === 'node3') {
            // Node 3 is the exit node - no next node to forward to
            this.nextNodeIp = null;
            this.nextNodePort = null;
            this.isExitNode = true;

            // Initialize AI services for exit node
            const geminiApiKey = process.env.GEMINI_API_KEY || 'AIzaSyAL_0xpmqIcyHNQT3FFcG3cS5ndgjiAHv8';
            const llamaUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
            const llamaModel = process.env.LOCAL_LLM_MODEL || 'llama3'; // Using llama3

            this.geminiService = new GeminiService(geminiApiKey);
            this.llamaService = new LlamaService(llamaUrl, llamaModel);

            console.log(`[${this.nodeId}] Configured as EXIT NODE with Gemini+Llama hybrid`);
            console.log(`[${this.nodeId}] Entity Extraction: Gemini`);
            console.log(`[${this.nodeId}] Response Generation: ${llamaModel} at ${llamaUrl}`);
        } else {
            this.nextNodeIp = 'localhost';
            this.nextNodePort = 4002;
            this.isExitNode = false;
        }

        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // DHT Setup
        this.swarm = new Hyperswarm();
        // Use crypto.hash to get a 32-byte buffer from the string
        const topicBuffer = crypto.data(b4a.from(config.DHT_TOPIC_STRING));
        this.topic = crypto.discoveryKey(topicBuffer);

        // Cloudflare Tunnel State
        this.tunnel = null;
        this.publicUrl = null;

        console.log(`[${this.nodeId}] initialized (Index: ${this.nodeIndex})`);
        console.log(`[${this.nodeId}] DHT Topic Hash: ${b4a.toString(this.topic, 'hex')}`);
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                nodeId: this.nodeId,
                role: this.isExitNode ? 'exit (Gemini+Llama)' : 'relay',
                nextNode: this.isExitNode ? 'none' : `${this.nextNodeIp}:${this.nextNodePort}`,
                timestamp: new Date().toISOString()
            });
        });

        this.app.post('/process', async (req, res) => {
            try {
                const { encryptedMessage, messageId } = req.body;
                console.log(`\n=== [${this.nodeId}] Processing REQUEST ${messageId} ===`);

                const { decrypted, nextNode } = this.encryption.peelOnionLayer(
                    encryptedMessage,
                    this.nodeKeys[this.nodeIndex]
                );

                // Check if this is the exit node
                if (this.isExitNode) {
                    console.log(`[${this.nodeId}] Final node reached - processing with hybrid AI`);
                    const result = await this.processHybridAIRequest(decrypted);

                    const encryptedResponse = this.encryption.encryptResponse(
                        result,
                        this.nodeKeys[this.nodeIndex]
                    );

                    res.json({
                        success: true,
                        encryptedResponse: encryptedResponse,
                        messageId: messageId,
                        fromNode: this.nodeId,
                        aiPipeline: 'Gemini+Llama'
                    });
                } else {
                    // Forward to next node
                    console.log(`[${this.nodeId}] Forwarding to next hop: ${this.nextNodeIp}:${this.nextNodePort}`);
                    const nextNodeResponse = await this.forwardToNextNode(decrypted, messageId);

                    if (nextNodeResponse.success && nextNodeResponse.encryptedResponse) {
                        const decryptedResponse = this.encryption.decryptResponse(
                            nextNodeResponse.encryptedResponse,
                            this.nodeKeys[this.nodeIndex + 1]
                        );

                        const reencryptedResponse = this.encryption.encryptResponse(
                            decryptedResponse,
                            this.nodeKeys[this.nodeIndex]
                        );

                        res.json({
                            success: true,
                            encryptedResponse: reencryptedResponse,
                            messageId: messageId,
                            fromNode: this.nodeId
                        });
                    } else {
                        res.json(nextNodeResponse);
                    }
                }
            } catch (error) {
                console.error(`[${this.nodeId}] Error:`, error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    async processHybridAIRequest(message) {
        try {
            if (!message || !message.prompt) {
                throw new Error('No user prompt found in decrypted message');
            }

            console.log(`[${this.nodeId}] Hybrid AI Pipeline starting...`);
            console.log(`[${this.nodeId}] Step 1: Gemini extracting entities from: "${message.prompt.substring(0, 100)}..."`);

            // Step 1: Use Gemini for entity extraction
            const entities = await this.geminiService.extractEntities(message.prompt);

            console.log(`[${this.nodeId}] Step 2: Llama generating response...`);

            // Step 2: Use Llama for response generation
            const response = await this.llamaService.generateResponse(entities);

            console.log(`[${this.nodeId}] AI processing complete!`);

            return {
                entities: entities,
                response: response,
                timestamp: new Date().toISOString(),
                processedBy: this.nodeId,
                aiPipeline: 'Gemini (extraction) → Llama (generation)'
            };
        } catch (error) {
            console.error(`[${this.nodeId}] Hybrid AI error:`, error);

            // Fallback response
            const fallbackResponse = `I'll help you with that! Based on your query about ${message.prompt?.substring(0, 50) || "your request"}.`;

            return {
                error: error.message,
                response: fallbackResponse,
                timestamp: new Date().toISOString(),
                processedBy: this.nodeId,
                isFallback: true
            };
        }
    }

    async forwardToNextNode(message, messageId) {
        try {
            const nextNodeUrl = `http://${this.nextNodeIp}:${this.nextNodePort}/process`;
            console.log(`[${this.nodeId}] Forwarding to: ${nextNodeUrl}`);

            const response = await fetch(nextNodeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    encryptedMessage: JSON.stringify(message),
                    messageId: messageId
                })
            });
            return await response.json();
        } catch (error) {
            console.error(`[${this.nodeId}] Error forwarding to ${this.nextNodeIp}:${this.nextNodePort}:`, error.message);
            return {
                success: false,
                error: `Connection to next node (${this.nextNodeIp}:${this.nextNodePort}) failed: ${error.message}`
            };
        }
    }

    async setupDiscovery() {
        console.log(`[${this.nodeId}] Joining DHT swarm for discovery...`);

        const discovery = this.swarm.join(this.topic, { server: true, client: true });

        this.swarm.on('connection', (socket, info) => {
            const peerId = b4a.toString(info.publicKey, 'hex').substring(0, 6);
            console.log(`[${this.nodeId}] New DHT connection with peer: ${peerId}`);

            // Send our node info to new connections
            const myInfo = {
                type: 'node-status',
                nodeId: this.nodeId,
                port: this.port,
                publicUrl: this.publicUrl,
                isExitNode: this.isExitNode,
                timestamp: Date.now()
            };

            socket.write(JSON.stringify(myInfo));

            socket.on('data', (data) => {
                try {
                    const peerInfo = JSON.parse(data.toString());
                    if (peerInfo.type === 'node-status') {
                        console.log(`[${this.nodeId}] Received status from peer ${peerId}: Node ${peerInfo.nodeId} is online ${peerInfo.publicUrl ? `at ${peerInfo.publicUrl}` : `on port ${peerInfo.port}`}`);

                        // Update routing if this is the next node in our chain
                        if (this.nodeId === 'node1' && peerInfo.nodeId === 'node2') {
                            this.updateNextNodeRouting(peerInfo);
                        } else if (this.nodeId === 'node2' && peerInfo.nodeId === 'node3') {
                            this.updateNextNodeRouting(peerInfo);
                        }
                    }
                } catch (e) {
                    // Ignore non-json data
                }
            });
        });

        // Broadcast our presence periodically
        setInterval(() => {
            const status = JSON.stringify({
                type: 'node-status',
                nodeId: this.nodeId,
                port: this.port,
                publicUrl: this.publicUrl,
                isExitNode: this.isExitNode,
                timestamp: Date.now()
            });

            for (const socket of this.swarm.connections) {
                socket.write(status);
            }
        }, 10000);

        await discovery.flushed();
        console.log(`[${this.nodeId}] DHT discovery active`);
    }

    updateNextNodeRouting(peerInfo) {
        if (peerInfo.publicUrl) {
            const url = new URL(peerInfo.publicUrl);
            this.nextNodeIp = url.hostname;
            this.nextNodePort = url.port || (url.protocol === 'https:' ? 443 : 80);
            console.log(`[${this.nodeId}] ROUTING UPDATED: Next hop is now PUBLIC at ${this.nextNodeIp}:${this.nextNodePort}`);
        } else {
            console.log(`[${this.nodeId}] ROUTING: Next hop remains LOCAL on port ${peerInfo.port}`);
            this.nextNodeIp = 'localhost';
            this.nextNodePort = peerInfo.port;
        }
    }

    start() {
        this.app.listen(this.port, async () => {
            console.log(`\n🚀 [${this.nodeId}] WhisperNode active on port ${this.port}`);

            // Start Cloudflare Tunnel if enabled
            if (config.USE_CLOUDFLARE) {
                try {
                    this.tunnel = new TunnelService(this.port);
                    this.publicUrl = await this.tunnel.start();
                    console.log(`[${this.nodeId}] CLOUDFLARE TUNNEL ACTIVE: ${this.publicUrl}`);
                } catch (err) {
                    console.error(`[${this.nodeId}] Cloudflare Tunnel failed:`, err.message);
                }
            }

            // Initialize DHT discovery after server starts
            await this.setupDiscovery();

            if (this.isExitNode) {
                console.log(`🎯 EXIT NODE: Gemini+Llama hybrid AI ready`);
            } else {
                console.log(`📤 Forwarding to: ${this.nextNodeIp}:${this.nextNodePort}`);
            }
        });
    }
}

module.exports = WhisperNode;
