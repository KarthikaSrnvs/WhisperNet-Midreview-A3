// compare-metrics.js
const { exec } = require('child_process');
const fs = require('fs').promises;

async function compareMetrics() {
    console.log('📊 ROUGE-L vs BERTScore Comparison');
    console.log('==================================');
    
    // Sample your actual responses from the earlier run
    const testData = {
        generated: [
            "I'd be happy to help! The capital city of India is New Delhi. It has been the capital since 1927.",
            "I'm excited to help! You want me to explain a concept related to machine learning.",
            "I'm happy to help! The author of Romeo and Juliet is William Shakespeare.",
            "The boiling point of water! The boiling point of water is 100 degrees.",
            "I'd be happy to help you with your question about photosynthesis!"
        ],
        expected: [
            "New Delhi is the capital of India.",
            "Machine learning is a subset of artificial intelligence that enables systems to learn from experience.",
            "William Shakespeare wrote Romeo and Juliet.",
            "The boiling point of water is 100 degrees Celsius at standard pressure.",
            "Photosynthesis is the process where plants use sunlight to produce oxygen and energy."
        ]
    };
    
    // Save test data
    await fs.writeFile('compare_input.json', JSON.stringify(testData));
    
    console.log('\n🔍 Running ROUGE-L...');
    exec('python rouge_evaluator.py < compare_input.json', (err, stdout) => {
        if (!err) {
            const rougeResults = JSON.parse(stdout);
            console.log(`ROUGE-L Average F1: ${(rougeResults.average_rougeL * 100).toFixed(2)}%`);
        }
    });
    
    console.log('\n🔍 Running BERTScore...');
    exec('python bertscore_evaluator.py < compare_input.json', (err, stdout) => {
        if (!err) {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const bertResults = JSON.parse(jsonMatch[0]);
                console.log(`BERTScore Average F1: ${(bertResults.average_f1 * 100).toFixed(2)}%`);
            }
        }
    });
}

compareMetrics();