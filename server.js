import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data directory — set by Electron, or falls back to data/ subdir for dev
let DATA_DIR = process.env.PROJECT_TRACKER_DATA_DIR || join(__dirname, "data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// Load .env from app source directory (where it was bundled or lives in dev)
dotenv.config({ path: join(__dirname, ".env") });

export function setDataDir(dir) {
  DATA_DIR = dir;
}

function getDbPath() {
  return join(DATA_DIR, "projects.json");
}

function loadProjects() {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return [];
  return JSON.parse(readFileSync(dbPath, "utf-8"));
}

function saveProjects(projects) {
  ensureDataDir();
  writeFileSync(getDbPath(), JSON.stringify(projects, null, 2), "utf-8");
}

function getSettingsPath() {
  return join(DATA_DIR, "settings.json");
}

const DEFAULT_SETTINGS = {
  categories: ["Work", "Personal", "Side Project"],
  efforts: ["Low", "Medium", "High"],
  statuses: ["Idea", "Planning", "In Progress", "On Hold", "Done", "Archived"],
};

function loadSettings() {
  const path = getSettingsPath();
  if (!existsSync(path)) return { ...DEFAULT_SETTINGS };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  ensureDataDir();
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf-8");
}

const app = express();
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });




app.get("/api/settings", (req, res) => {
  res.json(loadSettings());
});

app.put("/api/settings", (req, res) => {
  const { categories, efforts, statuses } = req.body;
  const settings = loadSettings();
  if (categories) settings.categories = categories;
  if (efforts) settings.efforts = efforts;
  if (statuses) settings.statuses = statuses;
  saveSettings(settings);
  res.json(settings);
});

app.post("/api/generate", async (req, res) => {
  const { idea, feedback } = req.body;

  if (!idea || !idea.trim()) {
    return res.status(400).json({ error: "Idea is required" });
  }

  const settings = loadSettings();
  const categoryList = settings.categories.map((c) => `"${c}"`).join(", ");
  const effortList = settings.efforts.map((e) => `"${e}"`).join(", ");

  let prompt;
  if (feedback) {
    prompt = `Given this idea: ${idea}

The user has reviewed the previous project plan and wants these changes: ${feedback}

Return a revised JSON object with:
- title: a short descriptive project title (3-6 words)
- category: one of ${categoryList} (infer from context)
- effort: one of ${effortList}
- tags: an array of 3-5 technology/topic tags relevant to this project (e.g. "AI/LLMs", "React", "Python", "Causal Inference", "Data Engineering", "Web Scraping", "NLP", "Statistics", etc.)
- project_plan: a concise 4-6 bullet point project plan

Return only valid JSON, no markdown.`;
  } else {
    prompt = `Given this idea: ${idea}, return a JSON object with:

- title: a short descriptive project title (3-6 words)
- category: one of ${categoryList} (infer from context)
- effort: one of ${effortList}
- tags: an array of 3-5 technology/topic tags relevant to this project (e.g. "AI/LLMs", "React", "Python", "Causal Inference", "Data Engineering", "Web Scraping", "NLP", "Statistics", etc.)
- project_plan: a concise 4-6 bullet point project plan

Return only valid JSON, no markdown.`;
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    let text = message.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

app.post("/api/save", async (req, res) => {
  const { idea, title, category, effort, tags, project_plan } = req.body;

  if (!idea) {
    return res.status(400).json({ error: "Idea is required" });
  }

  const projects = loadProjects();

  const project = {
    id: Date.now().toString(),
    title: title || idea,
    description: idea,
    category,
    effort,
    tags: tags || [],
    status: "Idea",
    project_plan,
    notes: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  projects.push(project);
  saveProjects(projects);

  res.json({ saved: true, project });
});

app.get("/api/projects", (req, res) => {
  const projects = loadProjects();
  res.json(projects);
});

app.patch("/api/projects/:id", (req, res) => {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }

  const updates = req.body;

  const settings = loadSettings();
  if (updates.status && !settings.statuses.includes(updates.status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${settings.statuses.join(", ")}` });
  }

  projects[index] = {
    ...projects[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  saveProjects(projects);
  res.json(projects[index]);
});

app.delete("/api/projects/:id", (req, res) => {
  let projects = loadProjects();
  const project = projects.find((p) => p.id === req.params.id);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  projects = projects.filter((p) => p.id !== req.params.id);
  saveProjects(projects);
  res.json({ deleted: true });
});

// Export for Electron
export { app as expressApp };

export function startServer(port = 3001) {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log(`Database: ${getDbPath()}`);
      resolve(port);
    });
  });
}

// If run directly (not imported by Electron), start immediately
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startServer();
}
