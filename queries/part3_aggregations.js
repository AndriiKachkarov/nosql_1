const database = db.getSiblingDB("spotify");

print("=== Part 3.1: Top-10 artists by average popularity (min 5 tracks) ===");
const topArtists = database.tracks
  .aggregate([
    { $unwind: "$artists" },
    {
      $group: {
        _id: "$artists",
        tracks_count: { $sum: 1 },
        avg_popularity: { $avg: "$popularity" }
      }
    },
    { $match: { tracks_count: { $gte: 5 } } },
    {
      $project: {
        _id: 0,
        artist: "$_id",
        tracks_count: 1,
        avg_popularity: { $round: ["$avg_popularity", 1] }
      }
    },
    { $sort: { avg_popularity: -1, tracks_count: -1, artist: 1 } },
    { $limit: 10 }
  ])
  .toArray();
printjson(topArtists);

print("=== Part 3.2: Mood distribution by valence and energy ===");
const moodDistribution = database.tracks
  .aggregate([
    {
      $addFields: {
        mood: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gte: ["$audio_features.valence", 0.5] },
                    { $gte: ["$audio_features.energy", 0.5] }
                  ]
                },
                then: "happy"
              },
              {
                case: {
                  $and: [
                    { $lt: ["$audio_features.valence", 0.5] },
                    { $gte: ["$audio_features.energy", 0.5] }
                  ]
                },
                then: "angry"
              },
              {
                case: {
                  $and: [
                    { $gte: ["$audio_features.valence", 0.5] },
                    { $lt: ["$audio_features.energy", 0.5] }
                  ]
                },
                then: "calm"
              }
            ],
            default: "sad"
          }
        }
      }
    },
    {
      $group: {
        _id: "$mood",
        tracks_count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        mood: "$_id",
        tracks_count: 1
      }
    },
    { $sort: { tracks_count: -1, mood: 1 } }
  ])
  .toArray();
printjson(moodDistribution);

print("=== Part 3.3: Most danceable genre (min 100 tracks) ===");
const danceableGenres = database.tracks
  .aggregate([
    {
      $group: {
        _id: "$track_genre",
        tracks_count: { $sum: 1 },
        avg_danceability: { $avg: "$audio_features.danceability" },
        avg_energy: { $avg: "$audio_features.energy" },
        avg_valence: { $avg: "$audio_features.valence" }
      }
    },
    { $match: { tracks_count: { $gte: 100 } } },
    {
      $project: {
        _id: 0,
        genre: "$_id",
        tracks_count: 1,
        avg_danceability: { $round: ["$avg_danceability", 3] },
        avg_energy: { $round: ["$avg_energy", 3] },
        avg_valence: { $round: ["$avg_valence", 3] }
      }
    },
    { $sort: { avg_danceability: -1, tracks_count: -1, genre: 1 } },
    { $limit: 1 }
  ])
  .toArray();
printjson(danceableGenres);
