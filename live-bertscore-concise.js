// live-bertscore-concise.js
const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs').promises;

class LiveBertScore {
    constructor() {
        // Load concise test cases
        this.testCases = [
            {
                id: 1,
                prompt: "What is the capital of India?",
                expected: "New Delhi"
            },
            {
                id: 2,
                prompt: "Explain machine learning",
                expected: "Machine learning is a subfield of artificial intelligence that involves training algorithms to make predictions or take actions based on data."
            },
            {
                id: 3,
                prompt: "Who wrote Romeo and Juliet?",
                expected: "William Shakespeare"
            },
            {
                id: 4,
                prompt: "What is the boiling point of water?",
                expected: "212°F (100°C)"
            },
            {
                id: 5,
                prompt: "Tell me about photosynthesis",
                expected: "Photosynthesis is the process by which plants convert light energy from the sun into chemical energy in the form of glucose."
            }
        ];
    }

    async getLiveResponse(prompt) {
        try {
            console.log(`   🤖 Calling WhisperNet...`);
            
            const response = await fetch('http://localhost:3000/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            
            if (data.success && data.data) {
                const generatedResponse = data.data.response || JSON.stringify(data.data);
                return generatedResponse;
            }
            return `[ERROR]`;
        } catch (error) {
            return `[CONNECTION ERROR]`;
        }
    }

    async evaluate() {
        console.log('\n🔍 LIVE BERTSCORE EVALUATION');
        console.log('========================================');
        console.log(`📝 Testing ${this.testCases.length} prompts\n`);
        
        const generatedList = [];
        const expectedList = [];
        const results = [];

        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i];
            
            console.log(`\n📋 Test Case ${testCase.id}:`);
            console.log(`   Prompt: "${testCase.prompt}"`);
            
            const generated = await this.getLiveResponse(testCase.prompt);
            
            console.log(`   Generated: "${generated.substring(0, 80)}..."`);
            console.log(`   Expected:  "${testCase.expected.substring(0, 80)}..."`);
            
            generatedList.push(generated);
            expectedList.push(testCase.expected);
            
            results.push({
                id: testCase.id,
                prompt: testCase.prompt,
                generated: generated,
                expected: testCase.expected
            });
            
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        console.log('\n⚡ Computing BERTScore...');
        const bertScores = await this.computeBertScore(generatedList, expectedList);
        
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

        await fs.writeFile('temp_bert_input.json', JSON.stringify(inputData));

        const pythonScript = `
import json
from bert_score import BERTScorer

# Load model
scorer = BERTScorer(
    lang='en',
    model_type='distilbert-base-uncased',
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
                await fs.unlink('temp_bert_input.json').catch(() => {});
                await fs.unlink('temp_bert_compute.py').catch(() => {});

                if (error) {
                    reject(error);
                    return;
                }

                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    displayResults(results) {
        console.log('\n\n' + '='.repeat(70));
        console.log('📊 LIVE BERTSCORE RESULTS (Concise Test Cases)');
        console.log('='.repeat(70));
        
        console.log('\n📋 DETAILED RESULTS:');
        console.log('-'.repeat(70));
        
        // Calculate statistics
        const scores = [];
        
        results.filter(r => r.id).forEach(r => {
            console.log(`\n🎯 Test Case ${r.id}: "${r.prompt}"`);
            console.log(`   Generated: "${r.generated.substring(0, 100)}..."`);
            console.log(`   Expected:  "${r.expected.substring(0, 100)}..."`);
            console.log(`   📈 BERTScore F1: ${r.bertscore.f1.toFixed(2)}%`);
            console.log(`   📊 Precision:    ${r.bertscore.precision.toFixed(2)}%`);
            console.log(`   📊 Recall:       ${r.bertscore.recall.toFixed(2)}%`);
            
            scores.push(r.bertscore.f1);
        });
        
        // Calculate statistics
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        console.log('\n' + '-'.repeat(70));
        console.log('📊 STATISTICS:');
        console.log(`   Best Score:  ${max.toFixed(2)}%`);
        console.log(`   Worst Score: ${min.toFixed(2)}%`);
        console.log(`   Average:     ${avg.toFixed(2)}%`);
        
        console.log('\n' + '='.repeat(70));
        console.log(`🎯 OVERALL AVERAGE BERTSCORE: ${results.average.toFixed(2)}%`);
        console.log('='.repeat(70));
        
        // Save results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bertscore_concise_${timestamp}.json`;
        
        fs.writeFile(filename, JSON.stringify(results, null, 2));
        console.log(`\n✅ Results saved to: ${filename}`);
    }
}

async function main() {
    const evaluator = new LiveBertScore();
    
    console.log('🚀 WhisperNet BERTScore Evaluator (Concise Test Cases)');
    console.log('=====================================================');
    
    // Check WhisperNet
    try {
        console.log('\n🔍 Checking WhisperNet connection...');
        const test = await fetch('http://localhost:3000/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'test' })
        });
        
        if (test.ok) {
            console.log('✅ WhisperNet is running!\n');
        } else {
            console.log('❌ WhisperNet error');
            process.exit(1);
        }
    } catch (error) {
        console.log('❌ Cannot connect to WhisperNet');
        process.exit(1);
    }
    
    const results = await evaluator.evaluate();
    evaluator.displayResults(results);
}

main().catch(console.error);