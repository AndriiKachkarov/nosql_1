const database = db.getSiblingDB("spotify");

function collectStages(node, acc = []) {
  if (!node || typeof node !== "object") {
    return acc;
  }
  if (node.stage) {
    acc.push(node.stage);
  }
  Object.keys(node).forEach((key) => {
    collectStages(node[key], acc);
  });
  return acc;
}

function explainSummary(explainResult) {
  const stats = explainResult.executionStats || {};
  const plan = explainResult.queryPlanner?.winningPlan || {};
  return {
    winningStages: [...new Set(collectStages(plan))],
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined,
    nReturned: stats.nReturned,
    executionTimeMillis: stats.executionTimeMillis
  };
}

function dropIndexIfExists(collection, indexName) {
  try {
    collection.dropIndex(indexName);
  } catch (error) {
    // Ignore "index not found" to keep script idempotent.
    if (!(error && error.codeName === "IndexNotFound")) {
      throw error;
    }
  }
}

print("=== Part 4.1: Slow query before and after index ===");
const q1Filter = {
  track_genre: "pop",
  "audio_features.danceability": { $gte: 0.7 }
};
const q1Sort = { popularity: -1 };

// Drop ALL custom indexes so the "before" measurement is a true COLLSCAN.
dropIndexIfExists(database.tracks, "idx_genre_dance_popularity");
dropIndexIfExists(database.tracks, "idx_work_music");
dropIndexIfExists(database.tracks, "idx_genre_popularity_cover");

const q1Before = database.tracks
  .find(q1Filter)
  .sort(q1Sort)
  .explain("executionStats");
print("Before index:");
printjson(explainSummary(q1Before));

print("Creating index idx_genre_dance_popularity...");
database.tracks.createIndex(
  {
    track_genre: 1,
    "audio_features.danceability": 1,
    popularity: -1
  },
  { name: "idx_genre_dance_popularity" }
);

const q1After = database.tracks
  .find(q1Filter)
  .sort(q1Sort)
  .explain("executionStats");
print("After index:");
printjson(explainSummary(q1After));

print("=== Part 4.2: Work-music index usage ===");
const q2Filter = {
  explicit: false,
  "audio_features.instrumentalness": { $gt: 0.5 },
  "audio_features.speechiness": { $lt: 0.1 }
};

dropIndexIfExists(database.tracks, "idx_work_music");
database.tracks.createIndex(
  {
    explicit: 1,
    "audio_features.instrumentalness": 1,
    "audio_features.speechiness": 1
  },
  { name: "idx_work_music" }
);

const q2Explain = database.tracks.find(q2Filter).explain("executionStats");
print("Work query explain:");
printjson(explainSummary(q2Explain));

print("=== Part 4.3: Covered query check ===");
const q3Filter = {
  track_genre: "pop",
  popularity: { $gte: 70 }
};

dropIndexIfExists(database.tracks, "idx_genre_popularity_cover");
database.tracks.createIndex(
  {
    track_genre: 1,
    popularity: 1,
    track_name: 1
  },
  { name: "idx_genre_popularity_cover" }
);

const q3NoProjection = database.tracks
  .find(q3Filter)
  .explain("executionStats");
print("Without projection (_id included by default):");
printjson(explainSummary(q3NoProjection));

const q3CoveredCandidate = database.tracks
  .find(q3Filter, { _id: 0, track_name: 1, popularity: 1, track_genre: 1 })
  .explain("executionStats");
print("With projection from index fields only:");
printjson(explainSummary(q3CoveredCandidate));
