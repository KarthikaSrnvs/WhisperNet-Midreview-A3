import json
import torch
import numpy as np
from collections import defaultdict
from transformers import AutoTokenizer, AutoModel
from sklearn.metrics.pairwise import cosine_similarity

# =============================
# CONFIG
# =============================
MODEL_PATH = "./intent_model"
DATASET_FILE = "intent_data.json"
BATCH_SIZE = 32

print("Loading model...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModel.from_pretrained(MODEL_PATH)  # load base model only
model.eval()

# =============================
# LOAD DATASET
# =============================
texts = []
labels = []

with open(DATASET_FILE, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            item = json.loads(line)
            texts.append(item["input"])
            labels.append(item["output"])

print(f"Loaded {len(texts)} samples.")

# =============================
# COMPUTE EMBEDDINGS (BATCHED)
# =============================
all_embeddings = []

for i in range(0, len(texts), BATCH_SIZE):
    batch_texts = texts[i:i+BATCH_SIZE]

    inputs = tokenizer(
        batch_texts,
        padding=True,
        truncation=True,
        max_length=64,
        return_tensors="pt"
    )

    with torch.no_grad():
        outputs = model(**inputs)

    # Mean pooling (better for embedding tasks)
    embeddings = outputs.last_hidden_state.mean(dim=1)
    all_embeddings.append(embeddings)

all_embeddings = torch.cat(all_embeddings, dim=0)
all_embeddings = all_embeddings.numpy()

print("Embeddings computed.")

# =============================
# COMPUTE COSINE SIMILARITY
# =============================
similarity_matrix = cosine_similarity(all_embeddings)

print("Similarity matrix computed.")

# =============================
# INTRA / INTER CLASS ANALYSIS
# =============================
intra_similarities = []
inter_similarities = []

n = len(labels)

for i in range(n):
    for j in range(i + 1, n):
        if labels[i] == labels[j]:
            intra_similarities.append(similarity_matrix[i][j])
        else:
            inter_similarities.append(similarity_matrix[i][j])

avg_intra = np.mean(intra_similarities)
avg_inter = np.mean(inter_similarities)
gap = avg_intra - avg_inter

print("\n===== EMBEDDING EVALUATION RESULTS =====")
print(f"Average Intra-class Similarity : {avg_intra:.4f}")
print(f"Average Inter-class Similarity : {avg_inter:.4f}")
print(f"Separation Gap                 : {gap:.4f}")
