
const TunnelService = require('./tunnel-service');

async function test() {
    console.log('--- Cloudflare Tunnel Test ---');
    const tunnel = new TunnelService(4001);
    try {
        const url = await tunnel.start();
        console.log('✅ Success! Test URL:', url);
        tunnel.stop();
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed:', err.message);
        process.exit(1);
    }
}

test();
