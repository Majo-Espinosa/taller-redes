require("dotenv").config();

const express = require("express");
const neo4j = require("neo4j-driver");

const app = express();
const PORT = process.env.EXPRESS_PORT || 3000;

app.use(express.json());

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

// ✅ GET: Listar canciones (con paginación opcional)
app.get("/songs", async (req, res) => {
  const session = driver.session();

  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 50;
  if (limit > 50) limit = 50; // Máximo 50 por página

  const skip = (page - 1) * limit;

  try {
    const result = await session.run(
      `MATCH (s:Song)-[:BY]->(a:Artist)
       RETURN s.song_title AS title, a.name AS artist, s.acousticness AS acousticness,
              s.danceability AS danceability, s.energy AS energy, s.valence AS valence
       SKIP $skip LIMIT $limit`,
      { skip: neo4j.int(skip), limit: neo4j.int(limit) }
    );

    const songs = result.records.map((record) => ({
      title: record.get("title"),
      artist: record.get("artist"),
      acousticness: record.get("acousticness"),
      danceability: record.get("danceability"),
      energy: record.get("energy"),
      valence: record.get("valence"),
    }));

    res.json({ page, limit, results: songs.length, songs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// ✅ POST: Crear una nueva canción con datos aleatorios si no se envían
app.post("/songs", async (req, res) => {
  const session = driver.session();

  let {
    song_title,
    artist,
    acousticness,
    danceability,
    energy,
    valence,
  } = req.body;

  // Generar valores aleatorios si no se envían
  if (!song_title) song_title = `Random Song ${Math.floor(Math.random() * 1000)}`;
  if (!artist) artist = `Random Artist ${Math.floor(Math.random() * 1000)}`;
  acousticness = acousticness ?? parseFloat(Math.random().toFixed(4));
  danceability = danceability ?? parseFloat(Math.random().toFixed(3));
  energy = energy ?? parseFloat(Math.random().toFixed(3));
  valence = valence ?? parseFloat(Math.random().toFixed(3));

  try {
    const result = await session.run(
      `
      MERGE (a:Artist {name: $artist})
      CREATE (s:Song {
        song_title: $song_title,
        acousticness: $acousticness,
        danceability: $danceability,
        energy: $energy,
        valence: $valence
      })
      MERGE (s)-[:BY]->(a)
      RETURN s.song_title AS title, a.name AS artist,
             s.acousticness AS acousticness,
             s.danceability AS danceability,
             s.energy AS energy,
             s.valence AS valence
      `,
      {
        song_title,
        artist,
        acousticness,
        danceability,
        energy,
        valence,
      }
    );

    const created = result.records[0];
    res.status(201).json({
      message: "✅ Canción creada exitosamente",
      song: {
        title: created.get("title"),
        artist: created.get("artist"),
        acousticness: created.get("acousticness"),
        danceability: created.get("danceability"),
        energy: created.get("energy"),
        valence: created.get("valence"),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
