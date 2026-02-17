
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const OnionEncryption = require('./encryption');
const fetch = require('node-fetch');
const config = require('./config');
const Hyperswarm = require('hyperswarm');
const b4a = require('b4a');
const crypto = require('hypercore-crypto');

class WhisperClient {
    constructor() {
        this.app = express();
        this.encryption = new OnionEncryption();
        this.nodeKeys = config.NODE_KEYS.map(k => Buffer.from(k, 'hex'));

        // DHT Discovery State
        this.discoveredNodes = new Map(); // nodeId -> { port, lastSeen, isExitNode }
        this.swarm = new Hyperswarm();
        // Use crypto.hash to get a 32-byte buffer from the string
        const topicBuffer = crypto.data(b4a.from(config.DHT_TOPIC_STRING));
        this.topic = crypto.discoveryKey(topicBuffer);

        // Cloudflare Tunnel State
        this.tunnel = null;
        this.publicUrl = null;

        this.setupMiddleware();
        this.setupRoutes();

        console.log(`Client configured (Onion Routing Enabled)`);
        console.log(`DHT Topic Hash: ${b4a.toString(this.topic, 'hex')}`);
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    setupRoutes() {
        this.app.get('/', (req, res) => {
            res.sendFile(__dirname + '/public/index.html');
        });

        this.app.get('/api/nodes', (req, res) => {
            const nodes = Array.from(this.discoveredNodes.values());
            res.json({ success: true, nodes });
        });

        this.app.post('/api/process', async (req, res) => {
            try {
                const { prompt } = req.body;
                const messageId = uuidv4();

                console.log(`\n=== CLIENT: Starting request ${messageId} ===`);
                console.log(`Prompt: "${prompt}"`);

                const message = {
                    prompt: prompt,
                    timestamp: new Date().toISOString(),
                    messageId: messageId
                };

                // Use Buffer keys for onion creation
                const onionMessage = this.encryption.createOnionLayers(message, this.nodeKeys);

                // Use the first discovered node if available, otherwise fallback to config
                let nextNodeIp = config.NEXT_NODE_IP;
                let nextNodePort = config.NEXT_NODE_PORT;

                const node1 = Array.from(this.discoveredNodes.values()).find(n => n.nodeId === 'node1');
                if (node1) {
                    if (node1.publicUrl) {
                        const url = new URL(node1.publicUrl);
                        nextNodeIp = url.hostname;
                        nextNodePort = url.port || (url.protocol === 'https:' ? 443 : 80);
                        console.log(`Client routing dynamically: Client → Node 1 (PUBLIC: ${node1.publicUrl})`);
                    } else {
                        nextNodePort = node1.port;
                        console.log(`Client routing dynamically: Client → Node 1 (LOCAL: port ${nextNodePort})`);
                    }
                } else {
                    console.log(`Client routing (fallback): Client → Node 1 (port ${nextNodePort})`);
                }

                const response = await this.sendToEntryNode(onionMessage, messageId, nextNodeIp, nextNodePort);

                if (response.success && response.encryptedResponse) {
                    console.log('Received encrypted response, decrypting...');
                    const finalResponse = this.encryption.decryptResponse(
                        response.encryptedResponse,
                        this.nodeKeys[0]
                    );

                    res.json({
                        success: true,
                        data: finalResponse,
                        messageId: messageId
                    });
                } else {
                    console.error('Network error:', response.error);
                    res.status(500).json({
                        success: false,
                        error: response.error || 'Network routing failure'
                    });
                }

            } catch (error) {
                console.error('Client Error:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    async setupDiscovery() {
        console.log('Client joining DHT swarm for node discovery...');
        const discovery = this.swarm.join(this.topic, { server: false, client: true });

        this.swarm.on('connection', (socket, info) => {
            socket.on('data', (data) => {
                try {
                    const status = JSON.parse(data.toString());
                    if (status.type === 'node-status') {
                        this.discoveredNodes.set(status.nodeId, {
                            nodeId: status.nodeId,
                            port: status.port,
                            publicUrl: status.publicUrl,
                            isExitNode: status.isExitNode,
                            lastSeen: Date.now()
                        });
                        console.log(`DHT Discovery: Found Node ${status.nodeId} ${status.publicUrl ? `at ${status.publicUrl}` : `on port ${status.port}`}`);
                    }
                } catch (e) {
                    // Ignore non-json data
                }
            });
        });

        // Cleanup stale nodes
        setInterval(() => {
            const now = Date.now();
            for (const [nodeId, info] of this.discoveredNodes.entries()) {
                if (now - info.lastSeen > 30000) { // 30 seconds timeout
                    this.discoveredNodes.delete(nodeId);
                    console.log(`DHT Discovery: Node ${nodeId} timed out`);
                }
            }
        }, 10000);

        await discovery.flushed();
    }

    async sendToEntryNode(onionMessage, messageId, ip, port) {
        try {
            const protocol = port === 443 ? 'https' : 'http';
            const entryNodeUrl = `${protocol}://${ip}${port && port !== 80 && port !== 443 ? `:${port}` : ''}/process`;

            console.log(`📤 Sending to Entry Node: ${entryNodeUrl}`);

            const response = await fetch(entryNodeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    encryptedMessage: JSON.stringify(onionMessage),
                    messageId: messageId
                }),
                timeout: 240000
            });

            return await response.json();
        } catch (error) {
            console.error('Entry node connection failed:', error.message);
            return { success: false, error: `Could not reach Entry Node (${ip}:${port}) - ${error.message}` };
        }
    }

    start() {
        const port = process.env.CLIENT_PORT || 3000;
        this.app.listen(port, async () => {
            console.log(`\n🌍 WhisperClient active on http://localhost:${port}`);

            // Start Cloudflare Tunnel if enabled
            if (config.USE_CLOUDFLARE) {
                try {
                    const TunnelService = require('./tunnel-service');
                    this.tunnel = new TunnelService(port);
                    this.publicUrl = await this.tunnel.start();
                    console.log(`🚀 DASHBOARD PUBLIC URL: ${this.publicUrl}`);
                } catch (err) {
                    console.error(`Cloudflare Tunnel for client failed:`, err.message);
                }
            }

            // Start DHT discovery
            await this.setupDiscovery();
        });
    }
}

module.exports = WhisperClient;
