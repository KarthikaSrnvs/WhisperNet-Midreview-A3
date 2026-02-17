# bertscore_fast.py
from bert_score import BERTScorer
import json
import sys

print("Loading BERTScore with small model...", file=sys.stderr)
scorer = BERTScorer(
    lang='en',
    model_type='distilbert-base-uncased',  # Smallest model
    rescale_with_baseline=True,
    num_layers=5  # Use fewer layers for speed
)
print("✅ Model loaded!", file=sys.stderr)

data = json.load(sys.stdin)
generated = data.get('generated', [])
expected = data.get('expected', [])

P, R, F1 = scorer.score(generated, expected)

results = {
    'average_f1': float(F1.mean()),
    'total_pairs': len(generated),
    'detailed': [
        {
            'id': i+1,
            'f1': float(F1[i]),
            'generated': generated[i],
            'expected': expected[i]
        }
        for i in range(len(generated))
    ]
}

print(json.dumps(results, indent=2))