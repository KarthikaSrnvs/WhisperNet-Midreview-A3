const fetch = require('node-fetch');

class LlamaService {
    constructor(baseUrl = 'http://localhost:11434', modelName = 'llama3') { // Default to llama3
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        console.log(`LlamaService initialized for model: ${this.modelName} at ${this.baseUrl}`);
    }

    async generateResponse(entities) {
        console.log('[Llama] Generating final response...');
        
        const prompt = `You are a helpful AI assistant. A user has asked a question with these characteristics:

QUERY TYPE: ${entities.query_type}
MAIN TOPIC: ${entities.main_topic}
KEY DETAILS: ${entities.key_details.join(', ')}
USER GOAL: ${entities.user_goal}
CONSTRAINTS: ${entities.constraints_requirements.join(', ')}

Provide a helpful, direct response that addresses their actual question.
Be specific and provide useful information based on the query type and details provided.`;

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.7,
                        top_p: 0.9,
                        num_predict: 512
                    }
                })
            });

            const data = await response.json();
            console.log('[Llama] Response generated successfully');
            return data.response;
        } catch (error) {
            console.error('[Llama] Generation failed:', error.message);
            return `I encountered an error connecting to my local Llama model (${this.modelName}). But I know you asked about ${entities.main_topic}.`;
        }
    }
}

module.exports = LlamaService;
