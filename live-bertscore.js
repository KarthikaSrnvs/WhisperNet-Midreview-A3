// live-bertscore.js
const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class LiveBertScore {
    constructor() {
        this.testCases = [
            {
                id: 1,
                prompt: "What is the capital of India?",
                expected: "New Delhi is the capital of India."
            },
            {
                id: 2,
                prompt: "Explain machine learning",
                expected: "Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience."
            },
            {
                id: 3,
                prompt: "Who wrote Romeo and Juliet?",
                expected: "William Shakespeare wrote Romeo and Juliet."
            },
            {
                id: 4,
                prompt: "What is the boiling point of water?",
                expected: "The boiling point of water is 100 degrees Celsius or 212 degrees Fahrenheit at standard pressure."
            },
            {
                id: 5,
                prompt: "Tell me about photosynthesis",
                expected: "Photosynthesis is the process where plants use sunlight, water and carbon dioxide to produce oxygen and energy."
            }
        ];
    }

    async getLiveResponse(prompt) {
        try {
            console.log(`   🤖 Calling WhisperNet for: "${prompt.substring(0, 30)}..."`);
            
            const response = await fetch('http://localhost:3000/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            
            if (data.success && data.data) {
                // Extract the response from your WhisperNet structure
                const generatedResponse = data.data.response || JSON.stringify(data.data);
                console.log(`   ✅ Got response (${generatedResponse.length} chars)`);
                return generatedResponse;
            } else {
                console.log(`   ❌ Error: ${data.error || 'Unknown error'}`);
                return `[ERROR: ${data.error}]`;
            }
        } catch (error) {
            console.log(`   ❌ Connection error: ${error.message}`);
            return `[CONNECTION ERROR: ${error.message}]`;
        }
    }

    async evaluate() {
        console.log('\n🔍 LIVE BERTSCORE EVALUATION');
        console.log('========================================');
        console.log(`📝 Testing ${this.testCases.length} prompts with LIVE WhisperNet\n`);
        
        const generatedList = [];
        const expectedList = [];
        const results = [];

        // Get live responses one by one
        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i];
            
            console.log(`\n📋 Test Case ${testCase.id}:`);
            console.log(`   Prompt: "${testCase.prompt}"`);
            
            const generated = await this.getLiveResponse(testCase.prompt);
            
            console.log(`   Generated: "${generated.substring(0, 100)}..."`);
            console.log(`   Expected:  "${testCase.expected.substring(0, 100)}..."`);
            
            generatedList.push(generated);
            expectedList.push(testCase.expected);
            
            results.push({
                id: testCase.id,
                prompt: testCase.prompt,
                generated: generated,
                expected: testCase.expected
            });
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Now compute BERTScore for all responses
        console.log('\n⚡ Computing BERTScore for all responses...');
        const bertScores = await this.computeBertScore(generatedList, expectedList);
        
        // Combine results
        const finalResults = results.map((r, i) => ({
            ...r,
            bertscore: bertScores.detailed[i]
        }));
        
        finalResults.average = bertScores.average;
        
        return finalResults;
    }

    async computeBertScore(generatedList, expectedList) {
        const inputData = {
            generated: generatedList,
            expected: expectedList
        };

        // Save input temporarily
        await fs.writeFile('temp_bert_input.json', JSON.stringify(inputData));

        // Python script for BERTScore (using small model for speed)
        const pythonScript = `
import json
import sys
from bert_score import BERTScorer

# Load model
scorer = BERTScorer(
    lang='en',
    model_type='distilbert-base-uncased',  # Fast model
    rescale_with_baseline=True
)

# Read data
with open('temp_bert_input.json', 'r') as f:
    data = json.load(f)

generated = data['generated']
expected = data['expected']

# Compute scores
P, R, F1 = scorer.score(generated, expected)

# Prepare output
detailed = []
for i, (gen, exp) in enumerate(zip(generated, expected)):
    detailed.append({
        'index': i + 1,
        'f1': float(F1[i]) * 100,
        'precision': float(P[i]) * 100,
        'recall': float(R[i]) * 100
    })

output = {
    'average': float(F1.mean()) * 100,
    'detailed': detailed
}

print(json.dumps(output))
`;

        await fs.writeFile('temp_bert_compute.py', pythonScript);

        return new Promise((resolve, reject) => {
            exec('python temp_bert_compute.py', async (error, stdout, stderr) => {
                // Clean up temp files
                await fs.unlink('temp_bert_input.json').catch(() => {});
                await fs.unlink('temp_bert_compute.py').catch(() => {});

                if (error) {
                    console.error('BERTScore Error:', error);
                    reject(error);
                    return;
                }

                try {
                    const results = JSON.parse(stdout);
                    resolve(results);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    displayResults(results) {
        console.log('\n\n' + '='.repeat(70));
        console.log('📊 LIVE BERTSCORE RESULTS (WhisperNet + Llama)');
        console.log('='.repeat(70));
        
        console.log('\n📋 DETAILED RESULTS:');
        console.log('-'.repeat(70));
        
        results.filter(r => r.id).forEach(r => {
            console.log(`\n🎯 Test Case ${r.id}: "${r.prompt}"`);
            console.log(`   Generated: "${r.generated.substring(0, 150)}..."`);
            console.log(`   Expected:  "${r.expected.substring(0, 150)}..."`);
            console.log(`   📈 BERTScore F1: ${r.bertscore.f1.toFixed(2)}%`);
            console.log(`   📊 Precision:    ${r.bertscore.precision.toFixed(2)}%`);
            console.log(`   📊 Recall:       ${r.bertscore.recall.toFixed(2)}%`);
        });
        
        console.log('\n' + '='.repeat(70));
        console.log(`🎯 OVERALL AVERAGE BERTSCORE: ${results.average.toFixed(2)}%`);
        console.log('='.repeat(70));
        
        // Save to file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bertscore_live_${timestamp}.json`;
        
        fs.writeFile(filename, JSON.stringify(results, null, 2));
        console.log(`\n✅ Results saved to: ${filename}`);
    }
}

// Main execution
async function main() {
    const evaluator = new LiveBertScore();
    
    console.log('🚀 WhisperNet Live BERTScore Evaluator');
    console.log('=======================================');
    
    // Check if WhisperNet is running
    try {
        console.log('\n🔍 Checking WhisperNet connection...');
        const test = await fetch('http://localhost:3000/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'test' })
        });
        
        if (test.ok) {
            console.log('✅ WhisperNet is running on port 3000\n');
        } else {
            console.log('❌ WhisperNet returned error');
            process.exit(1);
        }
    } catch (error) {
        console.log('❌ Cannot connect to WhisperNet at http://localhost:3000');
        console.log('   Make sure your client is running (node client.js)');
        process.exit(1);
    }
    
    // Run evaluation
    const results = await evaluator.evaluate();
    evaluator.displayResults(results);
}

main().catch(console.error);