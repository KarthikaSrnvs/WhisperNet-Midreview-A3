// run-bertscore.js
const BertScoreEvaluator = require('./bertscore-bridge');

async function runEvaluation() {
    console.log('🎯 BERTScore Evaluation for WhisperNet');
    console.log('======================================');
    
    // Check if WhisperNet is running
    console.log('\n🔍 Checking if WhisperNet is accessible...');
    try {
        const fetch = require('node-fetch');
        await fetch('http://localhost:3000/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'test' })
        });
        console.log('✅ WhisperNet is running!');
    } catch (error) {
        console.log('❌ Cannot connect to WhisperNet at http://localhost:3000');
        console.log('   Please make sure your client is running on port 3000');
        process.exit(1);
    }
    
    const evaluator = new BertScoreEvaluator();
    await evaluator.loadTestCases();
    await evaluator.evaluateAll();
}

runEvaluation();