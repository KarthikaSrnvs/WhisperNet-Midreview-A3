// rouge-bridge.js
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

class RougeLEvaluator {
    constructor() {
        this.results = [];
        this.testCases = [];
    }

    // Load test cases from JSON file
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

    // Call your WhisperNet API to get response
    async getWhisperNetResponse(prompt) {
        try {
            const response = await fetch('http://localhost:3000/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();
            
            if (data.success && data.data) {
                // Extract just the response text from the data object
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

    // Run evaluation on all test cases
    async evaluateAll() {
        if (this.testCases.length === 0) {
            await this.loadTestCases();
        }

        console.log('\n🔍 Starting ROUGE-L Evaluation...');
        console.log('=================================');

        const generatedList = [];
        const expectedList = [];

        for (let i = 0; i < this.testCases.length; i++) {
            const testCase = this.testCases[i];
            console.log(`\n📝 Test Case ${i + 1}: "${testCase.prompt.substring(0, 50)}..."`);
            
            // Get response from WhisperNet
            console.log('   Generating response...');
            const generated = await this.getWhisperNetResponse(testCase.prompt);
            
            console.log(`   Generated: "${generated.substring(0, 100)}..."`);
            console.log(`   Expected:  "${testCase.expected_response.substring(0, 100)}..."`);
            
            generatedList.push(generated);
            expectedList.push(testCase.expected_response);
            
            // Small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Call Python script to compute ROUGE-L
        return await this.computeRougeL(generatedList, expectedList);
    }

    // Compute ROUGE-L using Python script
    async computeRougeL(generatedList, expectedList) {
        const inputData = {
            generated: generatedList,
            expected: expectedList
        };

        // Write input to temp file
        const tempInput = path.join(__dirname, 'temp_input.json');
        await fs.writeFile(tempInput, JSON.stringify(inputData));

        return new Promise((resolve, reject) => {
            // Use python (or python3 depending on your system)
            exec(`python rouge_evaluator.py < ${tempInput}`, { maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
                // Clean up temp file
                await fs.unlink(tempInput).catch(() => {});

                if (error) {
                    console.error('Python execution error:', error);
                    console.error('stderr:', stderr);
                    reject(error);
                    return;
                }

                try {
                    // Find the JSON part in stdout (in case there are other logs)
                    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        throw new Error('No JSON found in Python output');
                    }
                    
                    const results = JSON.parse(jsonMatch[0]);
                    
                    if (results.error) {
                        console.error('Python script error:', results.error);
                        reject(new Error(results.error));
                        return;
                    }
                    
                    this.displayResults(results);
                    resolve(results);
                } catch (e) {
                    console.error('Failed to parse Python output:', e);
                    console.error('Raw output:', stdout);
                    reject(e);
                }
            });
        });
    }

    // Display results in a nice format
    displayResults(results) {
        console.log('\n\n📊 ROUGE-L EVALUATION RESULTS');
        console.log('===============================');
        console.log(`Total Test Cases: ${results.total_pairs}`);
        console.log(`\n📈 Average ROUGE-L Score: ${(results.average_rougeL * 100).toFixed(2)}%`);
        
        console.log('\n📋 Detailed Results:');
        console.log('-------------------');
        results.detailed.forEach(item => {
            console.log(`\nTest Case ${item.id}:`);
            console.log(`  ROUGE-L: ${(item.rougeL * 100).toFixed(2)}%`);
            console.log(`  Generated: "${item.generated.substring(0, 100)}..."`);
            console.log(`  Expected:  "${item.expected.substring(0, 100)}..."`);
        });

        // Calculate additional statistics
        const scores = results.detailed.map(d => d.rougeL);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

        console.log('\n📊 Statistics:');
        console.log(`  Best Score:  ${(max * 100).toFixed(2)}%`);
        console.log(`  Worst Score: ${(min * 100).toFixed(2)}%`);
        console.log(`  Average:     ${(avg * 100).toFixed(2)}%`);
        console.log('===============================');
    }

    // Save results to file
    async saveResults(results, filename = 'evaluation_results.json') {
        await fs.writeFile(filename, JSON.stringify(results, null, 2));
        console.log(`\n✅ Results saved to ${filename}`);
    }
}

// Run evaluation
async function main() {
    const evaluator = new RougeLEvaluator();
    
    try {
        // Load test cases and evaluate
        const results = await evaluator.evaluateAll();
        
        // Save results
        await evaluator.saveResults(results);
        
        console.log('\n✅ Evaluation completed successfully!');
    } catch (error) {
        console.error('\n❌ Evaluation failed:', error.message);
    }
}

// Export for use in other files
module.exports = RougeLEvaluator;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}