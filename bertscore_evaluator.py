# bertscore_evaluator.py
from bert_score import BERTScorer
import json
import sys
import torch

class BertScoreEvaluator:
    def __init__(self, model_type='distilbert-base-uncased', lang='en'):
        """
        Initialize BERTScore evaluator
        
        Args:
            model_type: The BERT model to use. 
                       'microsoft/deberta-xlarge-mnli' gives best correlation with human judgment [citation:1]
                       'roberta-large' is faster but slightly less accurate
            lang: Language code (en for English)
        """
        print("Loading BERTScore model...", file=sys.stderr)
        
        # Use CUDA if available
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        
        self.scorer = BERTScorer(
            lang=lang,
            model_type=model_type,
            device=device,
            rescale_with_baseline=True  # Makes scores more readable (0-100% range) [citation:8]
        )
        print(f"✅ BERTScore loaded on {device}", file=sys.stderr)
    
    def compute_scores(self, generated_list, expected_list):
        """
        Compute BERTScore P, R, F1 for multiple pairs
        
        Returns:
            Dictionary with precision, recall, f1 scores
        """
        if len(generated_list) != len(expected_list):
            return {'error': 'Generated and expected lists must have same length'}
        
        if len(generated_list) == 0:
            return {'error': 'No data to evaluate'}
        
        try:
            # Compute BERTScore
            P, R, F1 = self.scorer.score(generated_list, expected_list)
            
            # Convert to Python floats
            P = P.tolist()
            R = R.tolist()
            F1 = F1.tolist()
            
            # Prepare detailed results
            detailed = []
            for i, (gen, exp) in enumerate(zip(generated_list, expected_list)):
                detailed.append({
                    'id': i + 1,
                    'precision': P[i],
                    'recall': R[i],
                    'f1': F1[i],
                    'generated': gen,
                    'expected': exp
                })
            
            # Calculate averages
            avg_precision = sum(P) / len(P)
            avg_recall = sum(R) / len(R)
            avg_f1 = sum(F1) / len(F1)
            
            return {
                'average_precision': avg_precision,
                'average_recall': avg_recall,
                'average_f1': avg_f1,
                'total_pairs': len(generated_list),
                'detailed': detailed
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def compute_single(self, generated, expected):
        """Compute BERTScore for a single pair"""
        results = self.compute_scores([generated], [expected])
        if 'error' in results:
            return results
        return results['detailed'][0]

def main():
    # Use the best model for highest correlation with human judgment [citation:1]
    evaluator = BertScoreEvaluator(
        model_type='microsoft/deberta-xlarge-mnli'
    )
    
    # Read from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({'error': 'No input data provided'}))
            return
            
        data = json.loads(input_data)
        generated = data.get('generated', [])
        expected = data.get('expected', [])
        
        results = evaluator.compute_scores(generated, expected)
        
        # Output JSON
        print(json.dumps(results, indent=2, ensure_ascii=False))
        
    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON input: {str(e)}'}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == '__main__':
    main()