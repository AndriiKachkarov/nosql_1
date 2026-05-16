import os
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient
from tqdm import tqdm

load_dotenv()

MONGO_URI = os.environ["MONGO_URI"]
DB_NAME = "spotify"
CSV_PATH = "dataset.csv"
BATCH_SIZE = 1000


def parse_explicit(value: Any) -> bool:
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value

    as_text = str(value).strip().lower()
    return as_text in {"1", "true", "t", "yes", "y"}


def main() -> None:
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"CSV file not found: {CSV_PATH}. Download dataset.csv and place it in project root."
        )

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    print("Dropping existing tracks_raw for idempotent reload...")
    db["tracks_raw"].drop()

    df = pd.read_csv(CSV_PATH)
    print(f"Loaded CSV rows: {len(df)}")

    # Keep only rows with required fields.
    required_mask = (
        df["artists"].notna()
        & df["track_name"].notna()
        & (df["artists"].astype(str).str.strip() != "")
        & (df["track_name"].astype(str).str.strip() != "")
    )
    df = df[required_mask].copy()

    df["explicit"] = df["explicit"].apply(parse_explicit)

    int_cols = ["popularity", "duration_ms", "key", "mode", "time_signature"]
    for col in int_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    float_cols = [
        "danceability",
        "energy",
        "loudness",
        "speechiness",
        "acousticness",
        "instrumentalness",
        "liveness",
        "valence",
        "tempo",
    ]
    for col in float_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=int_cols + float_cols)

    for col in int_cols:
        df[col] = df[col].astype(int)
    for col in float_cols:
        df[col] = df[col].astype(float)

    records = df.to_dict("records")
    print(f"Rows ready to insert: {len(records)}")

    for i in tqdm(range(0, len(records), BATCH_SIZE), desc="Inserting batches"):
        db["tracks_raw"].insert_many(records[i : i + BATCH_SIZE], ordered=False)

    print(f"Inserted documents in tracks_raw: {db['tracks_raw'].count_documents({})}")
    print("Sample raw document:")
    print(db["tracks_raw"].find_one())

    client.close()


if __name__ == "__main__":
    main()
