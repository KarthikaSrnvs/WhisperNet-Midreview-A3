// llama-service.js - COMPLETE WORKING VERSION
const fetch = require('node-fetch');

class LlamaService {
    constructor(baseUrl = 'http://localhost:11434', modelName = 'llama3.2') {
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        console.log(`LlamaService initialized for model: ${this.modelName} at ${this.baseUrl}`);
    }

    cleanResponse(response) {
        if (!response) return '';
        
        let clean = response;
        
        // Aggressive greeting removal
        const greetings = [
            "I'd be happy to help",
            "I'm happy to help",
            "I'm excited to help",
            "I'd love to help",
            "Sure thing",
            "Of course",
            "Absolutely",
            "Here's what I know",
            "Let me tell you",
            "I can help with that",
            "Great question",
            "That's a good question",
            "Thanks for asking",
            "I'd be delighted to help",
            "I'm here to help",
            "Let me explain",
            "You're looking for",
            "The answer to your query is"
        ];
        
        // Remove each greeting (case insensitive)
        greetings.forEach(phrase => {
            const regex = new RegExp(`^[\\s,.!?]*${phrase}[\\s,.!?:]*`, 'i');
            clean = clean.replace(regex, '');
        });
        
        // Remove any leading punctuation or spaces
        clean = clean.replace(/^[,\s!?.•\-:]+/, '');
        
        // Capitalize first letter
        if (clean.length > 0) {
            clean = clean.charAt(0).toUpperCase() + clean.slice(1);
        }
        
        return clean.trim();
    }

    async generateResponse(entities) {
        console.log('[Llama] Generating final response...');
        
        // DIRECT prompt - no greetings allowed
        const prompt = `Answer this question directly with no greetings, no explanations, just the answer:

Question: ${entities.main_topic}
Details: ${entities.key_details ? entities.key_details.join(', ') : ''}

Answer:`;

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.1,  // Very low temperature for consistency
                        top_p: 0.9,
                        num_predict: 100
                    }
                })
            });

            const data = await response.json();
            
            // Clean the response
            const cleaned = this.cleanResponse(data.response);
            
            console.log('[Llama] Original:', data.response.substring(0, 50) + '...');
            console.log('[Llama] Cleaned:  ', cleaned.substring(0, 50) + '...');
            
            return cleaned;
            
        } catch (error) {
            console.error('[Llama] Generation failed:', error.message);
            return `Information about ${entities.main_topic}.`;
        }
    }
}

module.exports = LlamaService;