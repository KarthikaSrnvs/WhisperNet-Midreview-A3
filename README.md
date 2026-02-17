# WhisperNet - Decentralized AI Inference Platform

A privacy-preserving AI inference platform that uses onion encryption to route requests through multiple nodes, ensuring anonymity and security.

## Features

-  **Onion Encryption**: Multi-layer encryption for anonymous AI requests
-  **DISTILBERT Integration**: Entity extraction
-  **LLAMA3 Integration**: Response generation
-  **3-Node Network**: Distributed processing through multiple nodes


## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Platform**
   ```bash
   ./start.sh
   ```
   Or manually:
   ```bash
   node server.js
   ```

3. **Access the Frontend**
   Open http://localhost:3000 in your browser

## How It Works

1. **User Input**: Enter a prompt in the web interface
2. **Entity Extraction**: DISTILBERT extracts essential entities from the prompt
3. **Onion Routing**: Request is encrypted and routed through 3 nodes
4. **AI Processing**: Final node processes the request with LLAMA3
5. **Response Routing**: Response is encrypted and routed back through the nodes
6. **Result Display**: Decrypted response is shown to the user

## API Endpoints

### Client (Port 3000)
- `GET /` - Frontend interface
- `POST /api/process` - Process prompt through onion network

### Nodes (Ports 4001-4003)
- `GET /health` - Health check
- `POST /process` - Process onion message
- `POST /response` - Process response onion

## Configuration

The system uses the following configuration:
- **Node Ports**: 4001, 4002, 4003
- **Client Port**: 3000
- **Encryption**: AES-256-GCM with onion routing

## Security Features

- **Multi-layer Encryption**: Each node adds/removes an encryption layer
- **Anonymous Routing**: No single node knows the complete request path
- **Secure Communication**: All inter node communication is encrypted
- **Entity Privacy**: Only essential entities are extracted and processed

## Development

To run in development mode:
```bash
npm run dev
```

## Troubleshooting

1. **Nodes not starting**: Check if ports 4001-4003 are available
3. **Encryption errors**: Ensure all nodes have the same encryption keys

## License

MIT License - See LICENSE file for details


