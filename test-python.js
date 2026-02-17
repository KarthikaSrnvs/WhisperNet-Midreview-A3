// test-python.js
const { exec } = require('child_process');

console.log('Testing Python ROUGE-L script...');

const testData = {
    generated: [
        "New Delhi is the capital of India",
        "Machine learning is AI"
    ],
    expected: [
        "The capital of India is New Delhi",
        "Machine learning is a subset of artificial intelligence"
    ]
};

const inputJson = JSON.stringify(testData);

const pythonProcess = exec('python rouge_evaluator.py', (error, stdout, stderr) => {
    if (error) {
        console.error('Error:', error);
        return;
    }
    if (stderr) {
        console.log('Python stderr:', stderr);
    }
    console.log('Python stdout:', stdout);
    
    try {
        const result = JSON.parse(stdout);
        console.log('Parsed result:', result);
    } catch (e) {
        console.error('Parse error:', e.message);
    }
});

pythonProcess.stdin.write(inputJson);
pythonProcess.stdin.end();