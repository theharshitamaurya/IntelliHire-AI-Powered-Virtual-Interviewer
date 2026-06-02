import pickle
import os

LABEL_FILE = "chalearn_dataset/annotation_training.pkl"
VIDEO_FOLDER = "chalearn_dataset"

with open(LABEL_FILE, "rb") as f:
    annotations = pickle.load(f, encoding="latin1")

print("Total annotation entries:", len(annotations))

# Print first 5 keys
print("\nFirst 5 annotation keys:")
for i, key in enumerate(annotations.keys()):
    print(key)
    if i == 4:
        break

print("\nFirst 5 video files in folder:")
files = os.listdir(VIDEO_FOLDER)
for i, f in enumerate(files):
    if f.endswith(".pkl"):
        continue
    print(f)
    if i == 4:
        break