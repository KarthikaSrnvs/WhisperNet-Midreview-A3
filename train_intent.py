import json
import torch
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer
)
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

MODEL_NAME = "distilbert-base-uncased"
DATASET_FILE = "intent_data.json"
MODEL_SAVE_DIR = "./intent_model"

label_list = [
    "chat",
    "summarization",
    "fact_verification",
    "explanation",
    "ai_detection",
    "unsafe_request"
]

label2id = {label: i for i, label in enumerate(label_list)}
id2label = {i: label for label, i in label2id.items()}

print("Loading dataset...")

texts = []
labels = []

with open(DATASET_FILE, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            item = json.loads(line)
            texts.append(item["input"])
            labels.append(item["output"])

dataset = Dataset.from_dict({
    "text": texts,
    "label": [label2id[label] for label in labels]
})

dataset = dataset.train_test_split(test_size=0.2)

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def preprocess(example):
    return tokenizer(
        example["text"],
        padding="max_length",
        truncation=True,
        max_length=64
    )

dataset = dataset.map(preprocess, batched=True)
dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "label"])

print("Loading model...")
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=len(label_list),
    id2label=id2label,
    label2id=label2id
)

def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average="weighted")
    acc = accuracy_score(labels, preds)
    return {
        "accuracy": acc,
        "f1": f1,
        "precision": precision,
        "recall": recall
    }

training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=5,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    logging_dir="./logs",
    load_best_model_at_end=True
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    compute_metrics=compute_metrics
)

print("Starting training...")
trainer.train()

print("Saving model...")
trainer.save_model(MODEL_SAVE_DIR)
tokenizer.save_pretrained(MODEL_SAVE_DIR)

print("Model saved successfully!")
