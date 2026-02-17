
const { GoogleGenerativeAI } = require('@google/generative-ai');

const NEW_API_KEY = 'AIzaSyCQtF2xRdU1v_JfCR82dmS7Cnfxqs9Iouc'; // Your new key

async function testKey() {
    try {
        console.log('🔑 Testing new Gemini API key...');
        
        const genAI = new GoogleGenerativeAI(NEW_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const prompt = "Hello, are you working?";
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log('✅ API KEY WORKS! Response:', text.substring(0, 100) + '...');
        return true;
    } catch (error) {
        console.error('❌ API KEY FAILED:', error.message);
        return false;
    }
}

testKey();
