const fetch = require('node-fetch');

class LocalLLMService {
    constructor(baseUrl = 'http://localhost:11434', modelName = 'phi3') {
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        console.log(`LocalLLMService initialized for model: ${this.modelName} at ${this.baseUrl}`);
    }

    async extractEntities(prompt) {
        console.log(`[Local AI] Extracting entities from: ${prompt.substring(0, 50)}...`);

        const systemPrompt = `Analyze this user message and extract key information in JSON format.
Return JSON ONLY:
{
    "query_type": "description",
    "main_topic": "subject",
    "key_details": ["details"],
    "user_goal": "goal", 
    "constraints_requirements": []
}`;

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: `${systemPrompt}\n\nUSER MESSAGE: "${prompt}"`,
                    stream: false,
                    format: 'json'
                })
            });

            const data = await response.json();
            const entities = JSON.parse(data.response);
            console.log('[Local AI] Entities extracted successfully');
            return entities;
        } catch (error) {
            console.error('[Local AI] Extraction failed, using fallback:', error.message);
            return {
                query_type: "user_query",
                main_topic: "general",
                key_details: [prompt],
                user_goal: "assistance",
                constraints_requirements: []
            };
        }
    }

    async generateResponse(entities) {
        console.log('[Local AI] Generating final response...');

        const prompt = `You are a helpful AI. Answer this query:
Topic: ${entities.main_topic}
Details: ${entities.key_details.join(', ')}
Goal: ${entities.user_goal}`;

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: prompt,
                    stream: false
                })
            });

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('[Local AI] Generation failed:', error.message);
            return `I encountered an error connecting to my local brain (${this.modelName}). But I know you asked about ${entities.main_topic}.`;
        }
    }
}

module.exports = LocalLLMService;
