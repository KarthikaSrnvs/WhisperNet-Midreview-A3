
const Hyperswarm = require('hyperswarm');
const b4a = require('b4a');
const crypto = require('hypercore-crypto');
const config = require('./config');

async function testDiscovery() {
    console.log('--- DHT Discovery Test ---');
    const topicBuffer = crypto.data(b4a.from(config.DHT_TOPIC_STRING));
    const topic = crypto.discoveryKey(topicBuffer);
    console.log('Topic Hash:', b4a.toString(topic, 'hex'));

    const swarm1 = new Hyperswarm();
    const swarm2 = new Hyperswarm();

    console.log('Swarm 1 joining topic...');
    swarm1.join(topic, { server: true, client: true });

    swarm1.on('connection', (socket) => {
        console.log('[Swarm 1] New connection!');
        socket.write('hello from swarm 1');
        socket.on('data', d => console.log('[Swarm 1] Received:', d.toString()));
    });

    console.log('Swarm 2 joining topic...');
    swarm2.join(topic, { server: true, client: true });

    swarm2.on('connection', (socket) => {
        console.log('[Swarm 2] New connection!');
        socket.write('hello from swarm 2');
        socket.on('data', d => console.log('[Swarm 2] Received:', d.toString()));
    });

    console.log('Waiting for discovery (may take a few seconds)...');

    // Auto exit after 30 seconds
    setTimeout(() => {
        console.log('Test timed out. If no connections were seen, check your internet/DHT bootstrap connectivity.');
        process.exit(0);
    }, 30000);
}

testDiscovery();
