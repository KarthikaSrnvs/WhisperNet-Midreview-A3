// bertscore-bridge.js
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

class BertScoreEvaluator {
    constructor() {
        this.testCases = [];
    }

    async loadTestCases(filePath = 'test_dataset.json') {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            this.testCases = JSON.parse(data).test_cases;
            console.log(`✅ Loaded ${this.testCases.length} test cases`);
            return this.testCases;
        } catch (error) {
            console.error('Error loading test cases:', error.message);
            return [];
        }
    }

    async getWhisperNetResponse(prompt) {
        try {
            const response = await fetch('http://localhost:3000/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            
            if (data.success && data.data) {
                if (typeof data.data === 'object' && data.data.response) {
                    return data.data.response;
                }
                return JSON.stringify(data.data);
            }
            return `Error: ${data.error || 'Unknown error'}`;
        } catch (error) {
            console.error(`API call failed for prompt "${prompt}":`, error.message);
            return `API Error: ${error.message}`;
        }
    }

    async evaluateAll() {
        if (this.testCases.length === 0) {
            await this.loadTestCases();
        }

        console.log('\n🔍 Starting BERTScore Evaluation...');
        console.log('===================================');

        const generatedList = [];
        const expectedList = [];

        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i];
            console.log(`\n📝 Test Case ${i + 1}: "${testCase.prompt.substring(0, 50)}..."`);
            
            console.log('   Generating response...');
            const generated = await this.getWhisperNetResponse(testCase.prompt);
            
            console.log(`   Generated: "${generated.substring(0, 100)}..."`);
            console.log(`   Expected:  "${testCase.expected_response.substring(0, 100)}..."`);
            
            generatedList.push(generated);
            expectedList.push(testCase.expected_response);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return await this.computeBertScore(generatedList, expectedList);
    }

    async computeBertScore(generatedList, expectedList) {
        const inputData = {
            generated: generatedList,
            expected: expectedList
        };

        const tempInput = path.join(__dirname, 'temp_bert_input.json');
        await fs.writeFile(tempInput, JSON.stringify(inputData));

        return new Promise((resolve, reject) => {
           exec(`python bertscore_faster.py < ${tempInput}`, { maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
                await fs.unlink(tempInput).catch(() => {});

                if (error) {
                    console.error('Python error:', error);
                    console.error('stderr:', stderr);
                    reject(error);
                    return;
                }

                try {
                    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        throw new Error('No JSON found in output');
                    }
                    
                    const results = JSON.parse(jsonMatch[0]);
                    
                    if (results.error) {
                        console.error('Python error:', results.error);
                        reject(new Error(results.error));
                        return;
                    }
                    
                    this.displayResults(results);
                    resolve(results);
                } catch (e) {
                    console.error('Failed to parse output:', e);
                    console.error('Raw output:', stdout);
                    reject(e);
                }
            });
        });
    }

    displayResults(results) {
        console.log('\n\n📊 BERTSCORE EVALUATION RESULTS');
        console.log('=================================');
        console.log(`Total Test Cases: ${results.total_pairs}`);
        console.log(`\n📈 Average Scores:`);
        console.log(`   Precision: ${(results.average_precision * 100).toFixed(2)}%`);
        console.log(`   Recall:    ${(results.average_recall * 100).toFixed(2)}%`);
        console.log(`   F1 Score:  ${(results.average_f1 * 100).toFixed(2)}%`);
        
        console.log('\n📋 Detailed Results:');
        console.log('-------------------');
        results.detailed.forEach(item => {
            console.log(`\nTest Case ${item.id}:`);
            console.log(`  F1: ${(item.f1 * 100).toFixed(2)}%`);
            console.log(`  Generated: "${item.generated.substring(0, 100)}..."`);
            console.log(`  Expected:  "${item.expected.substring(0, 100)}..."`);
        });

        // Calculate statistics
        const scores = results.detailed.map(d => d.f1);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

        console.log('\n📊 Statistics:');
        console.log(`  Best F1:   ${(max * 100).toFixed(2)}%`);
        console.log(`  Worst F1:  ${(min * 100).toFixed(2)}%`);
        console.log(`  Average:   ${(avg * 100).toFixed(2)}%`);
        console.log('=================================');
    }

    async saveResults(results, filename = 'bertscore_results.json') {
        await fs.writeFile(filename, JSON.stringify(results, null, 2));
        console.log(`\n✅ Results saved to ${filename}`);
    }
}

// Run evaluation
async function main() {
    const evaluator = new BertScoreEvaluator();
    
    try {
        const results = await evaluator.evaluateAll();
        await evaluator.saveResults(results);
        console.log('\n✅ Evaluation completed successfully!');
    } catch (error) {
        console.error('\n❌ Evaluation failed:', error.message);
    }
}

module.exports = BertScoreEvaluator;

if (require.main === module) {
    main().catch(console.error);
}