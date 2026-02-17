# rouge_evaluator.py
from evaluate import load
import json
import sys
from typing import List, Dict

class RougeLScorer:
    def __init__(self):
        """Initialize the ROUGE scorer"""
        print("Loading ROUGE metric...", file=sys.stderr)
        self.rouge = load('rouge')
        print("✅ ROUGE loaded successfully!", file=sys.stderr)
        self.results_history = []
    
    def compute_pair(self, generated: str, expected: str) -> Dict:
        """Compute ROUGE-L for a single pair"""
        results = self.rouge.compute(
            predictions=[generated],
            references=[expected],
            rouge_types=['rougeL']
        )
        return {
            'rougeL': results['rougeL'],
            'generated': generated,
            'expected': expected
        }
    
    def compute_batch(self, generated_list: List[str], expected_list: List[str]) -> Dict:
        """Compute ROUGE-L for multiple pairs"""
        if len(generated_list) != len(expected_list):
            raise ValueError("Generated and expected lists must have same length")
        
        results = self.rouge.compute(
            predictions=generated_list,
            references=expected_list,
            rouge_types=['rougeL'],
            use_aggregator=True
        )
        
        # Get individual scores
        individual = self.rouge.compute(
            predictions=generated_list,
            references=expected_list,
            rouge_types=['rougeL'],
            use_aggregator=False
        )
        
        # Prepare detailed results
        detailed = []
        for i, (gen, exp) in enumerate(zip(generated_list, expected_list)):
            detailed.append({
                'id': i + 1,
                'rougeL': float(individual['rougeL'][i]),
                'generated': gen,
                'expected': exp
            })
        
        return {
            'average_rougeL': results['rougeL'],
            'total_pairs': len(generated_list),
            'detailed': detailed
        }
    
    def evaluate_from_file(self, test_file: str, output_file: str = None):
        """Evaluate using test cases from JSON file"""
        with open(test_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        test_cases = data['test_cases']
        generated_list = []
        expected_list = []
        
        print(f"\n📝 Evaluating {len(test_cases)} test cases...", file=sys.stderr)
        
        for case in test_cases:
            # Here you would call your WhisperNet API to get generated response
            # For now, we'll use placeholder - you'll replace this with actual API call
            generated = self.call_whispernet(case['prompt'])
            generated_list.append(generated)
            expected_list.append(case['expected_response'])
        
        results = self.compute_batch(generated_list, expected_list)
        
        # Save results if output file specified
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"\n✅ Results saved to {output_file}", file=sys.stderr)
        
        return results
    
    def call_whispernet(self, prompt: str) -> str:
        """Call your WhisperNet API to get generated response"""
        import requests
        
        try:
            # Call your WhisperNet client endpoint
            response = requests.post(
                'http://localhost:3000/api/process',
                json={'prompt': prompt}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('data'):
                    return data['data'].get('response', '')
            
            return f"Error: Could not generate response for '{prompt}'"
            
        except Exception as e:
            print(f"Error calling WhisperNet: {e}", file=sys.stderr)
            return f"API Error: {str(e)}"

def main():
    scorer = RougeLScorer()
    
    # Read from stdin if data is piped
    if not sys.stdin.isatty():
        try:
            data = json.load(sys.stdin)
            generated = data.get('generated', [])
            expected = data.get('expected', [])
            
            results = scorer.compute_batch(generated, expected)
            print(json.dumps(results, indent=2))
            
        except Exception as e:
            print(json.dumps({'error': str(e)}))
    
    # Otherwise, use test file
    elif len(sys.argv) > 1:
        test_file = sys.argv[1]
        output_file = sys.argv[2] if len(sys.argv) > 2 else 'rouge_results.json'
        results = scorer.evaluate_from_file(test_file, output_file)
        print(json.dumps(results, indent=2))
    
    else:
        print("Usage:")
        print("  python rouge_evaluator.py test_dataset.json [output_file.json]")
        print("  OR")
        print("  cat data.json | python rouge_evaluator.py")

if __name__ == '__main__':
    main()