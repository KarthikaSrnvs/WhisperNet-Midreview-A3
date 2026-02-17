const crypto = require('crypto');

class OnionEncryption {
    constructor() {
        this.algorithm = 'aes-256-cbc';
        this.keyLength = 32;
        this.ivLength = 16;
    }

    // Generate a random key for encryption
    generateKey() {
        return crypto.randomBytes(this.keyLength);
    }

    // Generate a random IV
    generateIV() {
        return crypto.randomBytes(this.ivLength);
    }

    encrypt(data, key, iv) {
        // Ensure key is a Buffer
        const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
        console.log(`[Crypto] Encrypting with key length: ${keyBuffer.length}`);
        const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return {
            encrypted: encrypted,
            iv: iv.toString('hex')
        };
    }

    // Decrypt data with AES-256-CBC
    decrypt(encryptedData, key, iv) {
        // Ensure key is a Buffer
        const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key, 'hex');
        const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, iv);

        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    // Create onion layers for 3 nodes - CORRECT ORDER
    createOnionLayers(message, nodeKeys) {
        let currentMessage = JSON.stringify(message);

        console.log('\nCREATING REQUEST ONION LAYERS');
        console.log('Original message:', currentMessage);

        // Create layers from innermost to outermost in CORRECT order:
        for (let i = nodeKeys.length - 1; i >= 0; i--) {
            const key = nodeKeys[i];
            const iv = this.generateIV();

            const encrypted = this.encrypt(currentMessage, key, iv);

            let nextNode;
            if (i === nodeKeys.length - 1) {
                nextNode = 'mainServer';
            } else {
                nextNode = `node${i + 2}`;
            }

            const layer = {
                encrypted: encrypted.encrypted,
                iv: encrypted.iv,
                nextNode: nextNode
            };

            console.log(`Layer for node${i + 1} (uses key ${i}):`, {
                nextNode: layer.nextNode,
                encryptedLength: layer.encrypted.length
            });

            currentMessage = JSON.stringify(layer);
        }

        const finalOnion = JSON.parse(currentMessage);
        console.log('Final onion structure:', finalOnion);
        console.log('=== REQUEST ONION CREATION COMPLETE ===\n');

        return finalOnion;
    }

    // Peel one layer of the onion
    peelOnionLayer(encryptedLayer, key) {
        try {
            const layerData = typeof encryptedLayer === 'string' ? JSON.parse(encryptedLayer) : encryptedLayer;

            console.log('Peeling request layer with structure:', Object.keys(layerData));

            const decrypted = this.decrypt(
                layerData.encrypted,
                key,
                Buffer.from(layerData.iv, 'hex')
            );

            const decryptedData = JSON.parse(decrypted);

            return {
                decrypted: decryptedData,
                nextNode: layerData.nextNode
            };
        } catch (error) {
            console.error('Failed to peel onion layer:', error);
            throw new Error(`Failed to peel onion layer: ${error.message}`);
        }
    }

    // SIMPLIFIED: Create a single response layer
    encryptResponse(response, key) {
        const iv = this.generateIV();
        const encrypted = this.encrypt(JSON.stringify(response), key, iv);

        return {
            encrypted: encrypted.encrypted,
            iv: encrypted.iv
        };
    }

    // SIMPLIFIED: Decrypt a response layer
    decryptResponse(encryptedResponse, key) {
        try {
            const responseData = typeof encryptedResponse === 'string' ? JSON.parse(encryptedResponse) : encryptedResponse;

            const decrypted = this.decrypt(
                responseData.encrypted,
                key,
                Buffer.from(responseData.iv, 'hex')
            );

            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Failed to decrypt response:', error);
            throw new Error(`Failed to decrypt response: ${error.message}`);
        }
    }
}

module.exports = OnionEncryption;