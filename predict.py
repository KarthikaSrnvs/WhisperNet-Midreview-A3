import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_DIR = "./intent_model"

tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)

def predict(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    outputs = model(**inputs)
    predicted_class_id = torch.argmax(outputs.logits, dim=1).item()
    return model.config.id2label[predicted_class_id]

if __name__ == "__main__":
    while True:
        text = input("Enter text (or type 'exit'): ")
        if text.lower() == "exit":
            break
        intent = predict(text)
        print("Predicted Intent:", intent)
