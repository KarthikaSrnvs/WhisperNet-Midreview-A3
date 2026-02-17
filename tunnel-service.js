
const { spawn } = require('child_process');

class TunnelService {
    constructor(port) {
        this.port = port;
        this.process = null;
        this.url = null;
    }

    async start() {
        return new Promise((resolve, reject) => {
            console.log(`[Tunnel] Starting cloudflared tunnel for port ${this.port}...`);

            this.process = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${this.port}`]);

            const timeout = setTimeout(() => {
                if (!this.url) {
                    this.stop();
                    reject(new Error('Timed out waiting for Cloudflare URL'));
                }
            }, 30000);

            this.process.stderr.on('data', (data) => {
                const output = data.toString();
                // console.log(`[cloudflared] ${output}`); // Debug

                const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                if (match && !this.url) {
                    this.url = match[0];
                    console.log(`[Tunnel] Public URL generated: ${this.url}`);
                    clearTimeout(timeout);
                    resolve(this.url);
                }
            });

            this.process.on('close', (code) => {
                if (code !== 0 && !this.url) {
                    reject(new Error(`cloudflared exited with code ${code}`));
                }
            });

            this.process.on('error', (err) => {
                reject(err);
            });
        });
    }

    stop() {
        if (this.process) {
            this.process.kill();
            console.log(`[Tunnel] cloudflared for port ${this.port} stopped.`);
        }
    }
}

module.exports = TunnelService;
