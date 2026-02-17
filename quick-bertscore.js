// quick-bertscore.js
const { exec } = require('child_process');
const fs = require('fs').promises;

async function getBertScore() {
    console.log('🔍 Getting BERTScore for your responses...\n');
    
    // Your actual responses from the WhisperNet run
    const testCases = [
        {
            id: 1,
            prompt: "What is the capital of India?",
            generated: "New Delhi....",
            expected: "New Delhi is the capital of India."
        },
        {
            id: 2,
            prompt: "Explain machine learning",
            generated: "Machine learning is a subset of artificial intelligence that enables computers to learn from data wi...",
            expected: "Machine learning is a subset of artificial intelligence that enables systems to learn and improve fr..."
        },
        {
            id: 3,
            prompt: "Who wrote Romeo and Juliet?",
            generated: "William Shakespeare....",
            expected: "William Shakespeare wrote Romeo and Juliet."
        },
        {
            id: 4,
            prompt: "What is the boiling point of water?",
            generated: "212°F (100°C)....",
            expected: "The boiling point of water is 100 degrees Celsius or 212 degrees Fahrenheit at standard pressure."
        },
        {
            id: 5,
            prompt: "Tell me about photosynthesis",
            generated: "The process by which plants convert sunlight into chemical energy....",
            expected: "Photosynthesis is the process where plants use sunlight, water and carbon dioxide to produce oxygen."
        }
    ];

    // Prepare data for Python
    const inputData = {
        generated: testCases.map(t => t.generated),
        expected: testCases.map(t => t.expected)
    };

    // Python script to compute BERTScore (using tiny model)
    const pythonScript = `
import json
import sys
from bert_score import BERTScorer

# Load tiny model (downloads fast)
scorer = BERTScorer(
    lang='en',
    model_type='distilbert-base-uncased',
    rescale_with_baseline=True,
    idf=False
)

# Read input
data = json.loads(sys.stdin.read())
generated = data['generated']
expected = data['expected']

# Compute scores
P, R, F1 = scorer.score(generated, expected)

# Prepare output
results = []
for i, (gen, exp) in enumerate(zip(generated, expected)):
    results.append({
        'test_case': i + 1,
        'bertscore_f1': float(F1[i]) * 100,  # Convert to percentage
        'precision': float(P[i]) * 100,
        'recall': float(R[i]) * 100
    })

# Add average
avg_f1 = float(F1.mean()) * 100

output = {
    'individual': results,
    'average_f1': avg_f1,
    'total_cases': len(generated)
}

print(json.dumps(output))
`;

    // Write Python script to temp file
    await fs.writeFile('temp_bert.py', pythonScript);
    
    // Write input data to temp file
    await fs.writeFile('temp_input.json', JSON.stringify(inputData));

    console.log('⚡ Computing BERTScore (this will take 1-2 minutes on first run)...\n');

    return new Promise((resolve, reject) => {
        exec('python temp_bert.py < temp_input.json', async (error, stdout, stderr) => {
            // Clean up temp files
            await fs.unlink('temp_bert.py').catch(() => {});
            await fs.unlink('temp_input.json').catch(() => {});

            if (error) {
                console.error('Error:', error);
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

// Run and display results
async function main() {
    console.log('='.repeat(60));
    console.log('📊 BERTSCORE RESULTS'.padStart(35));
    console.log('='.repeat(60));
    
    const results = await getBertScore();
    
    console.log('\n📋 INDIVIDUAL TEST CASES:');
    console.log('-'.repeat(60));
    
    results.individual.forEach(item => {
        console.log(`\nTest Case ${item.test_case}:`);
        console.log(`  📈 BERTScore F1: ${item.bertscore_f1.toFixed(2)}%`);
        console.log(`  📊 Precision:    ${item.precision.toFixed(2)}%`);
        console.log(`  📊 Recall:       ${item.recall.toFixed(2)}%`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 OVERALL AVERAGE BERTSCORE: ${results.average_f1.toFixed(2)}%`);
    console.log('='.repeat(60));
    
    console.log('\n📊 Comparison with ROUGE-L:');
    console.log('-'.repeat(60));
    console.log('Test Case | ROUGE-L  | BERTScore | Difference');
    console.log('-'.repeat(60));
    
    const rougeLScores = [44.44, 26.09, 50.00, 10.00, 39.02];
    
    results.individual.forEach((item, i) => {
        const diff = (item.bertscore_f1 - rougeLScores[i]).toFixed(2);
        const diffSymbol = diff > 0 ? '▲' : '▼';
        console.log(`   ${i+1}      | ${rougeLScores[i].toFixed(2)}%    | ${item.bertscore_f1.toFixed(2)}%    | ${diffSymbol} ${Math.abs(diff)}%`);
    });
    
    console.log('-'.repeat(60));
    
    // Save to file
    await fs.writeFile('bertscore_results.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Results saved to bertscore_results.json');
}

main().catch(console.error);