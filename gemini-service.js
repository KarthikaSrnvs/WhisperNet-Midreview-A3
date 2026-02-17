
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor(apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({model: "gemini-2.5-flash"});
        console.log('GeminiService initialized for entity extraction only');
    }

    async extractEntities(prompt) {
        console.log('[Gemini] Extracting entities from prompt:', prompt.substring(0, 100) + '...');
        
        if (!prompt) {
            throw new Error('Prompt is required');
        }
        
        const extractionPrompt = `
        Analyze this user message and extract the key information in JSON format.
        Be completely generic and unbiased - work with whatever the user provides.

        USER MESSAGE: "${prompt}"

        Return JSON with this structure:
        {
            "query_type": "brief description of what the user wants",
            "main_topic": "the primary subject matter",
            "key_details": ["list of important specifics mentioned"],
            "user_goal": "what they're trying to achieve", 
            "constraints_requirements": ["any limitations or needs mentioned"]
        }

        Extract only what is actually mentioned in the message. Be accurate and don't add information.
        Return ONLY the JSON, no other text.
        `;

        try {
            const result = await this.model.generateContent(extractionPrompt);
            const response = await result.response;
            const text = response.text();
            
            console.log('[Gemini] Raw response:', text.substring(0, 200) + '...');
            
            let entities;
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    entities = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.log('[Gemini] JSON parse failed, using fallback');
                entities = this.createGenericFallback(prompt);
            }
            
            console.log('[Gemini] Entities extracted successfully');
            return entities;
            
        } catch (error) {
            console.error('[Gemini] Error in extractEntities:', error);
            return this.createGenericFallback(prompt);
        }
    }

    createGenericFallback(prompt) {
        return {
            query_type: "user_query",
            main_topic: prompt.substring(0, 50),
            key_details: [prompt],
            user_goal: "get_assistance", 
            constraints_requirements: []
        };
    }

    // REMOVED generateResponse method - Llama will handle this
}

module.exports = GeminiService;
