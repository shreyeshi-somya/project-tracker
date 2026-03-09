import React, { useState, useEffect } from "react";

const EFFORT_COLORS = {
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-red-100 text-red-800",
};

const CATEGORY_COLOR_POOL = [
  "bg-purple-100 text-purple-800",
  "bg-blue-100 text-blue-800",
  "bg-pink-100 text-pink-800",
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-cyan-100 text-cyan-800",
  "bg-rose-100 text-rose-800",
  "bg-lime-100 text-lime-800",
];

function getCategoryColor(category, categories) {
  const idx = categories.indexOf(category);
  if (idx >= 0) return CATEGORY_COLOR_POOL[idx % CATEGORY_COLOR_POOL.length];
  return "bg-gray-100 text-gray-800";
}

const STATUS_COLOR_POOL = [
  "bg-gray-100 text-gray-800",
  "bg-blue-100 text-blue-800",
  "bg-yellow-100 text-yellow-800",
  "bg-orange-100 text-orange-800",
  "bg-green-100 text-green-800",
  "bg-gray-200 text-gray-500",
  "bg-teal-100 text-teal-800",
  "bg-rose-100 text-rose-800",
];

function getStatusColor(status, statuses) {
  const idx = statuses.indexOf(status);
  if (idx >= 0) return STATUS_COLOR_POOL[idx % STATUS_COLOR_POOL.length];
  return "bg-gray-100 text-gray-800";
}

// --- API helpers ---

async function generatePlan(idea, feedback) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, feedback }),
  });
  if (!response.ok) throw new Error("API request failed");
  return response.json();
}

async function saveIdeaAsProject(item) {
  const response = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error("Save failed");
  return response.json();
}

async function fetchProjects() {
  const response = await fetch("/api/projects");
  if (!response.ok) throw new Error("Failed to load projects");
  return response.json();
}

async function updateProject(id, updates) {
  const response = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Update failed");
  return response.json();
}

async function deleteProject(id) {
  const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Delete failed");
  return response.json();
}

async function fetchSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) throw new Error("Failed to load settings");
  return response.json();
}

async function saveSettings(settings) {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error("Failed to save settings");
  return response.json();
}

// --- Components ---

function SettingsPanel({ settings, onSave }) {
  const [categories, setCategories] = useState(settings.categories.join(", "));
  const [efforts, setEfforts] = useState(settings.efforts.join(", "));
  const [statuses, setStatuses] = useState(settings.statuses.join(", "));
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const newCategories = categories.split(",").map((s) => s.trim()).filter(Boolean);
    const newEfforts = efforts.split(",").map((s) => s.trim()).filter(Boolean);
    const newStatuses = statuses.split(",").map((s) => s.trim()).filter(Boolean);
    if (newCategories.length === 0 || newEfforts.length === 0 || newStatuses.length === 0) return;
    await onSave({ categories: newCategories, efforts: newEfforts, statuses: newStatuses });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-500 mb-6">
        Customize the options used when generating and tracking project plans. Separate values with commas.
      </p>

      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Categories</label>
          <input
            type="text"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="e.g. Work, Personal, Side Project"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Used by Claude to classify your ideas.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Effort Levels</label>
          <input
            type="text"
            value={efforts}
            onChange={(e) => setEfforts(e.target.value)}
            placeholder="e.g. Low, Medium, High"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Used by Claude to estimate project effort.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">Statuses</label>
          <input
            type="text"
            value={statuses}
            onChange={(e) => setStatuses(e.target.value)}
            placeholder="e.g. Idea, Planning, In Progress, Done"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">The workflow stages for tracking your projects.</p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function IdeaGenerator({ onSaved, categories }) {
  const [input, setInput] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refiningId, setRefiningId] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [feedbackInputs, setFeedbackInputs] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const plan = await generatePlan(input.trim());
      const newId = Date.now();
      setIdeas((prev) => [
        {
          id: newId,
          idea: input.trim(),
          title: plan.title || input.trim().slice(0, 60),
          category: plan.category,
          effort: plan.effort,
          tags: plan.tags || [],
          project_plan: plan.project_plan,
          saved: false,
        },
        ...prev,
      ]);
      setExpandedId(newId);
      setInput("");
    } catch {
      setError("Failed to generate plan. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (item) => {
    const feedback = feedbackInputs[item.id];
    if (!feedback?.trim()) return;
    setRefiningId(item.id);
    setError(null);
    try {
      const plan = await generatePlan(item.idea, feedback.trim());
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, title: plan.title || i.title, category: plan.category, effort: plan.effort, tags: plan.tags || i.tags, project_plan: plan.project_plan }
            : i
        )
      );
      setFeedbackInputs((prev) => ({ ...prev, [item.id]: "" }));
    } catch {
      setError("Failed to refine plan. Try again.");
    } finally {
      setRefiningId(null);
    }
  };

  const handleRegenerate = async (item) => {
    setRefiningId(item.id);
    setError(null);
    try {
      const plan = await generatePlan(item.idea);
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, title: plan.title || i.title, category: plan.category, effort: plan.effort, tags: plan.tags || i.tags, project_plan: plan.project_plan }
            : i
        )
      );
    } catch {
      setError("Failed to regenerate plan. Try again.");
    } finally {
      setRefiningId(null);
    }
  };

  const handleSave = async (item) => {
    try {
      await saveIdeaAsProject(item);
      setIdeas((prev) => prev.map((i) => (i.id === item.id ? { ...i, saved: true } : i)));
      onSaved();
    } catch {
      setError("Failed to save. Make sure the server is running.");
    }
  };

  const handleDelete = (id) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div>
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Enter your idea..."
          disabled={loading}
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-y"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-400">Cmd+Enter to submit</span>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Submit"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Claude is generating your project plan...</span>
        </div>
      )}

      {error && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}

      <div className="space-y-4">
        {ideas.map((item) => {
          const isExpanded = expandedId === item.id;
          const isRefining = refiningId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition ${
                item.saved ? "border-green-300" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {item.title}
                    {item.saved && (
                      <span className="ml-2 text-xs text-green-600 font-normal">Saved to Projects</span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">{item.idea}</p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{item.tags.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(item.category, categories)}`}>
                    {item.category}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${EFFORT_COLORS[item.effort]}`}>
                    {item.effort}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {isExpanded ? "Hide Plan" : "Show Plan"}
                </button>
                {!item.saved && (
                  <>
                    <button
                      onClick={() => handleRegenerate(item)}
                      disabled={isRefining}
                      className="text-sm text-orange-600 hover:text-orange-800 font-medium disabled:opacity-50"
                    >
                      {isRefining ? "Refining..." : "Regenerate"}
                    </button>
                    <button
                      onClick={() => handleSave(item)}
                      className="text-sm text-green-600 hover:text-green-800 font-medium"
                    >
                      Save to Projects
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-sm text-red-400 hover:text-red-600 ml-auto"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4">
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {item.project_plan.map((step, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2 text-blue-500">&#8226;</span>
                        {step}
                      </li>
                    ))}
                  </ul>

                  {!item.saved && (
                    <div className="mt-4 flex gap-2">
                      <input
                        type="text"
                        value={feedbackInputs[item.id] || ""}
                        onChange={(e) =>
                          setFeedbackInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRefine(item);
                          }
                        }}
                        placeholder="Refine: e.g. 'make it more detailed' or 'focus on backend'"
                        disabled={isRefining}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
                      />
                      <button
                        onClick={() => handleRefine(item)}
                        disabled={isRefining || !feedbackInputs[item.id]?.trim()}
                        className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Refine
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {ideas.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No ideas yet. Type one above to get started!</p>
        </div>
      )}
    </div>
  );
}

function ProjectsTable({ projects, onRefresh, categories, efforts, statuses }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [effortFilter, setEffortFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesValue, setNotesValue] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState(null);

  // Collect all unique tags across projects
  const allTags = [...new Set(projects.flatMap((p) => p.tags || []))].sort();

  // Apply all filters
  const filtered = projects.filter((p) => {
    if (statusFilter !== "All" && p.status !== statusFilter) return false;
    if (categoryFilter !== "All" && p.category !== categoryFilter) return false;
    if (effortFilter !== "All" && p.effort !== effortFilter) return false;
    if (tagFilter !== "All" && !(p.tags || []).includes(tagFilter)) return false;
    return true;
  });

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = (a.title || "").localeCompare(b.title || "");
        break;
      case "category":
        cmp = (a.category || "").localeCompare(b.category || "");
        break;
      case "effort": {
        const order = efforts.reduce((acc, e, i) => ({ ...acc, [e]: i }), {});
        cmp = (order[a.effort] ?? 999) - (order[b.effort] ?? 999);
        break;
      }
      case "tags":
        cmp = ((a.tags || [])[0] || "").localeCompare(((b.tags || [])[0] || ""));
        break;
      case "status": {
        const order = statuses.reduce((acc, s, i) => ({ ...acc, [s]: i }), {});
        cmp = (order[a.status] ?? 999) - (order[b.status] ?? 999);
        break;
      }
      case "updated":
        cmp = new Date(a.updated_at) - new Date(b.updated_at);
        break;
      default:
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const activeFilterCount = [categoryFilter, effortFilter, tagFilter].filter((f) => f !== "All").length;

  const counts = {};
  statuses.forEach((s) => {
    counts[s] = projects.filter((p) => p.status === s).length;
  });

  const handleStatusChange = async (id, status) => {
    try {
      await updateProject(id, { status });
      onRefresh();
    } catch {
      setError("Failed to update status.");
    }
  };

  const handleSaveNotes = async (id) => {
    try {
      await updateProject(id, { notes: notesValue });
      setEditingNotes(null);
      onRefresh();
    } catch {
      setError("Failed to save notes.");
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await deleteProject(id);
      onRefresh();
    } catch {
      setError("Failed to delete project.");
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Status Filter Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("All")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              statusFilter === "All" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({projects.length})
          </button>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
              activeFilterCount > 0
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      {/* Collapsible Filters Panel */}
      {showFilters && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filter by</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setCategoryFilter("All"); setEffortFilter("All"); setTagFilter("All"); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Effort Filter */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Effort</label>
              <select
                value={effortFilter}
                onChange={(e) => setEffortFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Effort Levels</option>
                {efforts.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>

            {/* Tag Filter */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">Tag</label>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All Tags</option>
                {allTags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}


      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">
            {projects.length === 0 ? "No projects yet. Save ideas or add projects manually." : "No projects match this filter."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {[
                  { key: "title", label: "Project" },
                  { key: "category", label: "Category" },
                  { key: "effort", label: "Effort" },
                  { key: "tags", label: "Tags" },
                  { key: "status", label: "Status" },
                  { key: "updated", label: "Updated" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 transition"
                  >
                    {label} {sortKey === key ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((project) => (
                <React.Fragment key={project.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 text-left"
                      >
                        {project.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(project.category, categories)}`}>
                        {project.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${EFFORT_COLORS[project.effort] || "bg-gray-100 text-gray-800"}`}>
                        {project.effort}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(project.tags || []).slice(0, 2).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                            {tag}
                          </span>
                        ))}
                        {(project.tags || []).length > 2 && (
                          <span className="text-xs text-gray-400">+{project.tags.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={project.status}
                        onChange={(e) => handleStatusChange(project.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(project.status, statuses)}`}
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-red-400 hover:text-red-600 inline-flex"
                        title="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === project.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 bg-gray-50">
                        {/* Description */}
                        {project.description && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</h4>
                            <p className="text-sm text-gray-700">{project.description}</p>
                          </div>
                        )}

                        {/* All Tags */}
                        {project.tags && project.tags.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Technologies & Topics</h4>
                            <div className="flex gap-1.5 flex-wrap">
                              {project.tags.map((tag, i) => (
                                <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Project Plan */}
                        {project.project_plan && project.project_plan.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Project Plan</h4>
                            <ul className="space-y-1 text-sm text-gray-700">
                              {project.project_plan.map((step, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="mr-2 text-blue-500">&#8226;</span>
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Notes */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notes</h4>
                          {editingNotes === project.id ? (
                            <div className="flex gap-2">
                              <textarea
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                rows={3}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => handleSaveNotes(project.id)}
                                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingNotes(null)}
                                  className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNotes(project.id);
                                setNotesValue(project.notes || "");
                              }}
                              className="text-sm text-gray-600 cursor-pointer hover:bg-white rounded p-2 min-h-[2rem]"
                            >
                              {project.notes || "Click to add notes..."}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Main App ---

export default function IdeaTracker() {
  const [tab, setTab] = useState("projects");
  const [projects, setProjects] = useState([]);
  const [settings, setSettings] = useState({ categories: ["Work", "Personal", "Side Project"], efforts: ["Low", "Medium", "High"], statuses: ["Idea", "Planning", "In Progress", "On Hold", "Done", "Archived"] });

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch {
      // silently fail on initial load
    }
  };

  const loadSettings = async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch {
      // use defaults
    }
  };

  const handleSaveSettings = async (newSettings) => {
    const saved = await saveSettings(newSettings);
    setSettings(saved);
  };

  useEffect(() => {
    loadProjects();
    loadSettings();
  }, []);

  useEffect(() => {
    if (tab === "projects") loadProjects();
  }, [tab]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Project Tracker</h1>
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setTab("projects")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === "projects" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Projects ({projects.length})
            </button>
            <button
              onClick={() => setTab("ideas")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === "ideas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              New Idea
            </button>
            <button
              onClick={() => setTab("settings")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === "settings" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {tab === "ideas" ? (
          <IdeaGenerator onSaved={loadProjects} categories={settings.categories} />
        ) : tab === "settings" ? (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} />
        ) : (
          <ProjectsTable projects={projects} onRefresh={loadProjects} categories={settings.categories} efforts={settings.efforts} statuses={settings.statuses} />
        )}
      </div>
    </div>
  );
}
