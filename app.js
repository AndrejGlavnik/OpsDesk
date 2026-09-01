(function () {
  const { storage, download, copy, uid, escapeHtml, toast } = globalThis.OpsTools;
  const workspaceStore = globalThis.WorkspaceStore;
  const storageNoticeKey = "opsdesk-storage-notice-v1";
  const priorityRank = { P1: 1, P2: 2, P3: 3, P4: 4 };
  const statusOrder = ["inbox", "planned", "active", "blocked", "done"];
  const statusLabels = {
    inbox: "Inbox",
    planned: "Planned",
    active: "In progress",
    blocked: "Blocked",
    done: "Done"
  };
  const typeLabels = {
    task: "Task",
    ticket: "Ticket",
    analytics: "Analytics issue",
    "follow-up": "Follow-up",
    decision: "Decision"
  };

  const templates = {
    analytics: {
      type: "analytics",
      priority: "P2",
      project: "",
      summary: "Metric / dashboard:\nAffected period:\nSource of truth:\nBusiness impact:",
      nextAction: "Reproduce the discrepancy and document the first confirmed divergence."
    },
    support: {
      type: "ticket",
      priority: "P2",
      project: "",
      summary: "Customer impact:\nEnvironment:\nFirst observed:\nCurrent workaround:",
      nextAction: "Confirm reproducible steps and prepare a clear escalation handoff."
    },
    project: {
      type: "follow-up",
      priority: "P3",
      project: "",
      summary: "Dependency:\nDecision needed:\nPeople involved:\nDelivery impact:",
      nextAction: "Confirm the owner, due date, and next measurable checkpoint."
    },
    meeting: {
      type: "decision",
      priority: "P3",
      project: "",
      summary: "Decision:\nReason:\nPeople affected:\nOpen questions:",
      nextAction: "Publish the decision, owner, and follow-up date."
    }
  };

  let workspace = workspaceStore.get();
  const state = {
    items: workspace.opsDesk.items.map(normalizeItem),
    selectedId: null,
    view: ["focus", "board", "todo", "updates"].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : ["focus", "board", "todo", "updates"].includes(workspace.opsDesk.preferences?.view)
        ? workspace.opsDesk.preferences.view
        : "focus",
    filters: { search: "", priority: "all", type: "all" },
    updateRange: ["today", "week", "all"].includes(workspace.opsDesk.preferences?.updateRange) ? workspace.opsDesk.preferences.updateRange : "week",
    activeTemplate: null
  };
  let pendingImport = null;
  let pendingDeleteId = null;

  const elements = {
    views: [...document.querySelectorAll("[data-view]")],
    viewLinks: [...document.querySelectorAll("[data-view-link]")],
    viewButtons: [...document.querySelectorAll("[data-view-button]")],
    quickForm: document.querySelector("[data-quick-form]"),
    itemModal: document.querySelector("[data-item-modal]"),
    itemForm: document.querySelector("[data-item-form]"),
    modalTitle: document.querySelector("[data-modal-title]"),
    detailPanel: document.querySelector("[data-detail-panel]"),
    detailEmpty: document.querySelector("[data-detail-empty]"),
    detailForm: document.querySelector("[data-detail-form]"),
    detailType: document.querySelector("[data-detail-type]"),
    detailUpdated: document.querySelector("[data-detail-updated]"),
    autosaveStatus: document.querySelector("[data-autosave-status]"),
    notesList: document.querySelector("[data-notes-list]"),
    noteForm: document.querySelector("[data-note-form]"),
    focusList: document.querySelector("[data-focus-list]"),
    attentionList: document.querySelector("[data-attention-list]"),
    nextList: document.querySelector("[data-next-list]"),
    board: document.querySelector("[data-board]"),
    todoForm: document.querySelector("[data-todo-form]"),
    todoGroups: document.querySelector("[data-todo-groups]"),
    search: document.querySelector("[data-search]"),
    filterPriority: document.querySelector("[data-filter-priority]"),
    filterType: document.querySelector("[data-filter-type]"),
    updateRange: document.querySelector("[data-update-range]"),
    updateRangeLabel: document.querySelector("[data-update-range-label]"),
    updatePreview: document.querySelector("[data-update-preview]"),
    decisionList: document.querySelector("[data-decision-list]"),
    archiveModal: document.querySelector("[data-archive-modal]"),
    archiveList: document.querySelector("[data-archive-list]"),
    importFile: document.querySelector("[data-import-file]"),
    importModal: document.querySelector("[data-import-modal]"),
    importSummary: document.querySelector("[data-import-summary]"),
    onboardingModal: document.querySelector("[data-onboarding-modal]"),
    storageModal: document.querySelector("[data-storage-modal]"),
    exportModal: document.querySelector("[data-export-modal]"),
    exportForm: document.querySelector("[data-export-form]"),
    exportScopeField: document.querySelector("[data-export-scope-field]"),
    exportNote: document.querySelector("[data-export-note]"),
    deleteModal: document.querySelector("[data-delete-modal]"),
    deleteSummary: document.querySelector("[data-delete-summary]")
  };

  function normalizeItem(item) {
    return {
      id: item.id || uid("work"),
      title: item.title || "Untitled work item",
      type: typeLabels[item.type] ? item.type : "task",
      status: statusLabels[item.status] ? item.status : "inbox",
      priority: priorityRank[item.priority] ? item.priority : "P3",
      due: item.due || "",
      owner: item.owner || "",
      project: item.project || "",
      tags: Array.isArray(item.tags) ? item.tags : parseTags(item.tags),
      summary: item.summary || "",
      nextAction: item.nextAction || "",
      blocker: item.blocker || "",
      expected: item.expected || "",
      actual: item.actual || "",
      links: item.links || "",
      knowledgeLinks: Array.isArray(item.knowledgeLinks) ? item.knowledgeLinks : [],
      focus: Boolean(item.focus),
      archived: Boolean(item.archived),
      notes: Array.isArray(item.notes) ? item.notes : [],
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      completedAt: item.completedAt || ""
    };
  }

  function parseTags(value) {
    if (Array.isArray(value)) return value;
    return String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  function persist() {
    workspace = workspaceStore.get();
    workspace.opsDesk = {
      items: state.items,
      preferences: { view: state.view, updateRange: state.updateRange }
    };
    workspaceStore.save(workspace);
  }

  function localDateString(date = new Date()) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function startOfWeek() {
    const date = startOfToday();
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return date;
  }

  function dateFromInput(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(value, options = { month: "short", day: "numeric" }) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en", options).format(date);
  }

  function isOverdue(item) {
    const due = dateFromInput(item.due);
    return Boolean(due && item.status !== "done" && due < startOfToday());
  }

  function isDueToday(item) {
    return item.due === localDateString() && item.status !== "done";
  }

  function wasCompletedSince(item, date) {
    if (!item.completedAt) return false;
    return new Date(item.completedAt) >= date;
  }

  function activeItems() {
    return state.items.filter((item) => !item.archived);
  }

  function openItems() {
    return activeItems().filter((item) => item.status !== "done");
  }

  function itemScore(item) {
    const priority = (5 - priorityRank[item.priority]) * 100;
    const overdue = isOverdue(item) ? 250 : 0;
    const today = isDueToday(item) ? 160 : 0;
    const blocked = item.status === "blocked" ? 80 : 0;
    const active = item.status === "active" ? 50 : 0;
    return priority + overdue + today + blocked + active;
  }

  function compareItems(a, b) {
    const score = itemScore(b) - itemScore(a);
    if (score) return score;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  }

  function priorityTone(priority) {
    return { P1: "tone-red", P2: "tone-amber", P3: "tone-blue", P4: "tone-neutral" }[priority];
  }

  function statusTone(status) {
    return { inbox: "tone-neutral", planned: "tone-blue", active: "tone-violet", blocked: "tone-red", done: "tone-green" }[status];
  }

  function dueLabel(item) {
    if (!item.due) return "No due date";
    if (isOverdue(item)) return `Overdue · ${formatDate(dateFromInput(item.due))}`;
    if (isDueToday(item)) return "Due today";
    return `Due ${formatDate(dateFromInput(item.due))}`;
  }

  function createItem(input = {}) {
    const now = new Date().toISOString();
    return normalizeItem({
      id: uid("work"),
      title: input.title?.trim() || "Untitled work item",
      type: input.type || "task",
      status: input.status || "inbox",
      priority: input.priority || "P3",
      due: input.due || "",
      owner: input.owner || "",
      project: input.project || "",
      tags: input.tags || [],
      summary: input.summary || "",
      nextAction: input.nextAction || "",
      blocker: input.blocker || "",
      expected: input.expected || "",
      actual: input.actual || "",
      links: input.links || "",
      knowledgeLinks: input.knowledgeLinks || [],
      focus: Boolean(input.focus),
      notes: input.notes || [],
      createdAt: now,
      updatedAt: now,
      completedAt: input.status === "done" ? now : ""
    });
  }

  function addItem(input, select = true) {
    const item = createItem(input);
    state.items.unshift(item);
    persist();
    if (select) state.selectedId = item.id;
    render();
    toast("Item saved locally");
    return item;
  }

  function getSelected() {
    return state.items.find((item) => item.id === state.selectedId && !item.archived) || null;
  }

  function setView(view) {
    if (!["focus", "board", "todo", "updates"].includes(view)) return;
    state.view = view;
    if (location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
    persist();
    renderViews();
    if (view === "updates") renderUpdates();
  }

  function renderViews() {
    elements.views.forEach((view) => { view.hidden = view.dataset.view !== state.view; });
    elements.viewLinks.forEach((link) => {
      if (link.dataset.viewLink === state.view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    elements.viewButtons.forEach((button) => button.classList.toggle("active", button.dataset.viewButton === state.view));
  }

  function renderMetrics() {
    const items = activeItems();
    const open = items.filter((item) => item.status !== "done");
    const focus = open.filter((item) => item.focus);
    const due = open.filter((item) => isOverdue(item) || isDueToday(item));
    const blocked = open.filter((item) => item.status === "blocked");
    const done = items.filter((item) => wasCompletedSince(item, startOfWeek()));
    document.querySelector("[data-metric-focus]").textContent = focus.length;
    document.querySelector("[data-metric-due]").textContent = due.length;
    document.querySelector("[data-metric-blocked]").textContent = blocked.length;
    document.querySelector("[data-metric-done]").textContent = done.length;
    document.querySelector("[data-count-focus]").textContent = focus.length;
    document.querySelector("[data-count-open]").textContent = open.length;
    document.querySelector("[data-count-todo]").textContent = open.filter((item) => item.type === "task" || item.type === "follow-up").length;
    document.querySelector("[data-count-done]").textContent = done.length;
    document.querySelector("[data-focus-capacity]").textContent = `${focus.length} / 3`;
    document.querySelector("[data-archive-count]").textContent = state.items.filter((item) => item.archived).length;
  }

  function workItemHtml(item, { showCheckbox = false } = {}) {
    const next = item.nextAction ? escapeHtml(item.nextAction) : escapeHtml(item.summary || "Open item to add context and next action.");
    const dueClass = isOverdue(item) ? "due-overdue" : isDueToday(item) ? "due-today" : "";
    return `
      <button class="work-item ${state.selectedId === item.id ? "selected" : ""}" type="button" data-item-id="${item.id}">
        ${showCheckbox ? `<span class="work-item-checkbox" aria-hidden="true"></span>` : `<span class="priority-chip ${priorityTone(item.priority)}">${item.priority}</span>`}
        <span class="work-item-main">
          <span class="work-item-title">${escapeHtml(item.title)}</span>
          <span class="work-item-next">${next}</span>
          <span class="work-item-meta"><span>${escapeHtml(typeLabels[item.type])}</span>${item.project ? `<span>${escapeHtml(item.project)}</span>` : ""}${item.owner ? `<span>${escapeHtml(item.owner)}</span>` : ""}</span>
        </span>
        <span class="work-item-side">
          <span class="status-chip ${statusTone(item.status)}">${escapeHtml(statusLabels[item.status])}</span>
          <span class="${dueClass}">${escapeHtml(dueLabel(item))}</span>
        </span>
      </button>`;
  }

  function renderList(target, items, emptyText, options) {
    target.innerHTML = items.length
      ? items.map((item) => workItemHtml(item, options)).join("")
      : `<div class="list-empty">${escapeHtml(emptyText)}</div>`;
  }

  function renderFocus() {
    document.querySelector("[data-date-label]").textContent = formatDate(new Date(), { weekday: "long", month: "long", day: "numeric" });
    const open = openItems().sort(compareItems);
    const focus = open.filter((item) => item.focus).slice(0, 3);
    const focusIds = new Set(focus.map((item) => item.id));
    const attention = open.filter((item) => item.status === "blocked" || isOverdue(item) || item.priority === "P1");
    const attentionIds = new Set(attention.map((item) => item.id));
    const next = open.filter((item) => !focusIds.has(item.id) && !attentionIds.has(item.id) && ["active", "planned", "inbox"].includes(item.status)).slice(0, 8);
    renderList(elements.focusList, focus, "Choose up to three items or let OpsDesk build today's focus.", { showCheckbox: true });
    renderList(elements.attentionList, attention, "No blocked, overdue, or critical items.");
    renderList(elements.nextList, next, "Capture work above or add an item from the board.");
  }

  function filteredItems() {
    const search = state.filters.search.trim().toLowerCase();
    return activeItems()
      .filter((item) => state.filters.priority === "all" || item.priority === state.filters.priority)
      .filter((item) => state.filters.type === "all" || item.type === state.filters.type)
      .filter((item) => {
        if (!search) return true;
        return [item.title, item.project, item.owner, item.summary, item.nextAction, item.blocker, item.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
  }

  function kanbanCardHtml(item) {
    const dueClass = isOverdue(item) ? "due-overdue" : isDueToday(item) ? "due-today" : "";
    return `
      <article class="kanban-card ${state.selectedId === item.id ? "selected" : ""}" draggable="true" data-item-id="${item.id}">
        <div class="kanban-card-top"><span class="priority-chip ${priorityTone(item.priority)}">${item.priority}</span><span class="status-chip tone-neutral">${escapeHtml(typeLabels[item.type])}</span></div>
        <h4>${escapeHtml(item.title)}</h4>
        ${item.nextAction ? `<p>${escapeHtml(item.nextAction)}</p>` : ""}
        <div class="kanban-card-meta"><span>${escapeHtml(item.project || "No project")}</span><span class="${dueClass}">${escapeHtml(item.due ? dueLabel(item) : "No due date")}</span></div>
      </article>`;
  }

  function renderBoard() {
    const items = filteredItems().sort(compareItems);
    elements.board.innerHTML = statusOrder.map((status) => {
      const columnItems = items.filter((item) => item.status === status);
      return `
        <section class="kanban-column" data-drop-status="${status}">
          <div class="kanban-column-header"><h3>${statusLabels[status]}</h3><span>${columnItems.length}</span></div>
          <div class="kanban-items">${columnItems.map(kanbanCardHtml).join("") || '<div class="list-empty">No items</div>'}</div>
        </section>`;
    }).join("");
    bindBoardDragAndDrop();
  }

  function todoRowHtml(item) {
    const checked = item.status === "done";
    return `
      <article class="todo-row ${checked ? "is-done" : ""}">
        <button class="todo-check" type="button" data-todo-toggle="${item.id}" aria-label="${checked ? "Reopen" : "Complete"} ${escapeHtml(item.title)}" title="${checked ? "Reopen" : "Mark complete"}">
          ${checked ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>' : ""}
        </button>
        <button class="todo-title" type="button" data-item-id="${item.id}">${escapeHtml(item.title)}</button>
        <span class="todo-meta ${isOverdue(item) ? "due-overdue" : ""}">${escapeHtml(item.due ? dueLabel(item) : item.project || typeLabels[item.type])}</span>
      </article>`;
  }

  function renderTodo() {
    const items = activeItems().filter((item) => ["task", "follow-up"].includes(item.type));
    const open = items.filter((item) => item.status !== "done").sort(compareItems);
    const today = open.filter((item) => item.focus || isOverdue(item) || isDueToday(item));
    const todayIds = new Set(today.map((item) => item.id));
    const upcoming = open.filter((item) => item.due && !todayIds.has(item.id));
    const anytime = open.filter((item) => !item.due && !todayIds.has(item.id));
    const completed = items.filter((item) => item.status === "done").sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 20);
    const groups = [
      ["Today", "Focus, due today, and overdue", today],
      ["Upcoming", "Scheduled next actions", upcoming],
      ["Anytime", "Open work without a due date", anytime],
      ["Completed", "Recently finished", completed]
    ];
    elements.todoGroups.innerHTML = groups.map(([title, subtitle, groupItems]) => `
      <section class="todo-section">
        <div class="work-section-header"><div><h3>${title}</h3><p>${subtitle}</p></div><span class="count-badge">${groupItems.length}</span></div>
        <div class="todo-list">${groupItems.length ? groupItems.map(todoRowHtml).join("") : '<div class="list-empty">No items</div>'}</div>
      </section>`).join("");
  }

  function bindBoardDragAndDrop() {
    elements.board.querySelectorAll(".kanban-card").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        card.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.dataset.itemId);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    elements.board.querySelectorAll("[data-drop-status]").forEach((column) => {
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        column.classList.remove("drag-over");
        const item = state.items.find((entry) => entry.id === event.dataTransfer.getData("text/plain"));
        if (!item) return;
        setItemStatus(item, column.dataset.dropStatus);
        item.updatedAt = new Date().toISOString();
        persist();
        render();
      });
    });
  }

  function setItemStatus(item, status) {
    const wasDone = item.status === "done";
    item.status = status;
    if (status === "done" && !wasDone) {
      item.completedAt = new Date().toISOString();
      item.focus = false;
    }
    if (status !== "done" && wasDone) item.completedAt = "";
  }

  function updateItemsForRange() {
    const items = activeItems();
    if (state.updateRange === "all") return items;
    const start = state.updateRange === "today" ? startOfToday() : startOfWeek();
    return items.filter((item) => {
      const updated = new Date(item.updatedAt) >= start;
      const completed = item.completedAt && new Date(item.completedAt) >= start;
      return updated || completed || item.status === "blocked" || item.focus;
    });
  }

  function updateSections() {
    const items = updateItemsForRange();
    return {
      done: items.filter((item) => item.status === "done").sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)),
      active: items.filter((item) => item.status === "active" || item.focus).sort(compareItems),
      blocked: items.filter((item) => item.status === "blocked").sort(compareItems),
      next: items.filter((item) => ["inbox", "planned"].includes(item.status)).sort(compareItems).slice(0, 8)
    };
  }

  function itemUpdateLine(item, mode) {
    const project = item.project ? ` [${item.project}]` : "";
    const detail = mode === "blocked" ? item.blocker : item.nextAction;
    return `${item.title}${project}${detail ? ` — ${detail}` : ""}`;
  }

  function buildUpdateText() {
    const sections = updateSections();
    const range = state.updateRange === "today" ? "Daily" : state.updateRange === "week" ? "Weekly" : "Current";
    const lines = [`# ${range} operations update`, "", `Generated ${formatDate(new Date(), { month: "long", day: "numeric", year: "numeric" })}`, ""];
    const groups = [
      ["Completed", sections.done, "done"],
      ["In progress", sections.active, "active"],
      ["Blocked / at risk", sections.blocked, "blocked"],
      ["Next", sections.next, "next"]
    ];
    groups.forEach(([title, items, mode]) => {
      lines.push(`## ${title}`);
      if (items.length) items.forEach((item) => lines.push(`- ${itemUpdateLine(item, mode)}`));
      else lines.push("- None");
      lines.push("");
    });
    return lines.join("\n").trim();
  }

  function renderUpdates() {
    const sections = updateSections();
    const label = state.updateRange === "today" ? "Today" : state.updateRange === "week" ? "Current week" : "Current workspace";
    elements.updateRangeLabel.textContent = `${label} · generated ${formatDate(new Date(), { month: "short", day: "numeric" })}`;
    const groups = [
      ["Completed", sections.done, "done"],
      ["In progress", sections.active, "active"],
      ["Blocked / at risk", sections.blocked, "blocked"],
      ["Next", sections.next, "next"]
    ];
    elements.updatePreview.innerHTML = groups.map(([title, items, mode]) => `
      <section class="update-block">
        <h4>${title}</h4>
        ${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(itemUpdateLine(item, mode))}</li>`).join("")}</ul>` : '<p class="update-empty">None</p>'}
      </section>`).join("");

    const decisions = activeItems()
      .flatMap((item) => item.notes.filter((note) => note.kind === "decision").map((note) => ({ ...note, itemTitle: item.title, itemId: item.id })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    elements.decisionList.innerHTML = decisions.length ? decisions.map((decision) => `
      <button class="decision-entry" type="button" data-item-id="${decision.itemId}">
        <span>${escapeHtml(decision.itemTitle)} · ${formatDate(decision.createdAt, { month: "short", day: "numeric" })}</span>
        <p>${escapeHtml(decision.text)}</p>
      </button>`).join("") : '<div class="list-empty">No decisions captured yet.</div>';
  }

  function fillDetailForm(item) {
    const fields = ["title", "status", "priority", "type", "project", "owner", "due", "summary", "nextAction", "blocker", "expected", "actual", "links"];
    fields.forEach((name) => {
      const input = elements.detailForm.querySelector(`[name="${name}"]`);
      if (input) input.value = item[name] || "";
    });
    elements.detailForm.querySelector('[name="tags"]').value = item.tags.join(", ");
    elements.detailForm.querySelector('[name="focus"]').checked = item.focus;
    elements.detailType.textContent = typeLabels[item.type];
    elements.detailType.className = `status-chip ${statusTone(item.status)}`;
    elements.detailUpdated.textContent = `Updated ${formatDate(item.updatedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    elements.detailEmpty.hidden = true;
    elements.detailForm.hidden = false;
    renderNotes(item);
  }

  function renderDetails() {
    const item = getSelected();
    if (!item) {
      elements.detailEmpty.hidden = false;
      elements.detailForm.hidden = true;
      return;
    }
    fillDetailForm(item);
  }

  function renderNotes(item) {
    const notes = [...item.notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    elements.notesList.innerHTML = notes.length ? notes.map((note) => `
      <article class="note-entry ${note.kind === "decision" ? "is-decision" : ""}">
        <div class="note-entry-head"><span>${note.kind === "decision" ? "Decision" : "Note"} · ${formatDate(note.createdAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><button class="text-button" type="button" data-remove-note="${note.id}">Remove</button></div>
        <p>${escapeHtml(note.text)}</p>
      </article>`).join("") : '<div class="list-empty">No notes or decisions yet.</div>';
  }

  function syncDetailToState() {
    const item = getSelected();
    if (!item) return;
    const values = {};
    elements.detailForm.querySelectorAll("[name]").forEach((input) => {
      if (input.name !== "focus") values[input.name] = input.value;
    });
    const wantsFocus = elements.detailForm.querySelector('[name="focus"]').checked;
    const otherFocusCount = openItems().filter((entry) => entry.focus && entry.id !== item.id).length;
    if (wantsFocus && otherFocusCount >= 3) {
      elements.detailForm.querySelector('[name="focus"]').checked = false;
      toast("Top focus already has three items");
    }
    const previousStatus = item.status;
    ["title", "type", "status", "priority", "project", "owner", "due", "summary", "nextAction", "blocker", "expected", "actual", "links"].forEach((key) => {
      item[key] = String(values[key] || "").trim();
    });
    item.tags = parseTags(values.tags);
    item.focus = elements.detailForm.querySelector('[name="focus"]').checked;
    if (previousStatus !== item.status) {
      item.status = previousStatus;
      setItemStatus(item, values.status);
    }
    item.updatedAt = new Date().toISOString();
    elements.autosaveStatus.textContent = "Saving…";
    persist();
    renderMetrics();
    renderFocus();
    renderBoard();
    renderUpdates();
    elements.detailType.textContent = typeLabels[item.type];
    elements.detailType.className = `status-chip ${statusTone(item.status)}`;
    elements.detailUpdated.textContent = `Updated ${formatDate(item.updatedAt, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    elements.autosaveStatus.textContent = "Saved locally";
  }

  function renderArchive() {
    const items = state.items.filter((item) => item.archived).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    elements.archiveList.innerHTML = items.length ? items.map((item) => `
      <article class="archive-item">
        <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.project || typeLabels[item.type])} · archived ${formatDate(item.updatedAt, { month: "short", day: "numeric" })}</p></div>
        <div class="archive-actions">
          <button class="button small" type="button" data-restore-item="${item.id}">Restore</button>
          <button class="icon-button danger" type="button" aria-label="Delete ${escapeHtml(item.title)} permanently" title="Delete permanently" data-delete-item="${item.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
          </button>
        </div>
      </article>`).join("") : '<div class="empty-state"><div><h3>Archive is empty</h3><p>Archived work stays recoverable here.</p></div></div>';
  }

  function render() {
    renderViews();
    renderMetrics();
    renderFocus();
    renderBoard();
    renderTodo();
    renderUpdates();
    renderDetails();
  }

  function openItem(id) {
    const item = state.items.find((entry) => entry.id === id && !entry.archived);
    if (!item) return;
    state.selectedId = id;
    render();
    if (window.innerWidth < 1180) elements.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openNewItemModal(templateName = null) {
    state.activeTemplate = templateName;
    elements.itemForm.reset();
    const template = templates[templateName] || {};
    ["type", "priority", "project", "summary", "nextAction"].forEach((name) => {
      const input = elements.itemForm.elements[name];
      if (input && template[name] !== undefined) input.value = template[name];
    });
    elements.modalTitle.textContent = templateName ? `${typeLabels[template.type]} template` : "Add item";
    elements.itemModal.showModal();
    requestAnimationFrame(() => elements.itemForm.elements.title.focus());
  }

  function scopedItems(scope) {
    const items = [...state.items];
    if (scope === "active") return items.filter((item) => !item.archived);
    if (scope === "open") return items.filter((item) => !item.archived && item.status !== "done");
    if (scope === "completed") return items.filter((item) => !item.archived && item.status === "done");
    if (scope === "archived") return items.filter((item) => item.archived);
    return items;
  }

  function reportRecord(item) {
    return {
      ID: item.id,
      Title: item.title,
      Type: typeLabels[item.type],
      Status: statusLabels[item.status],
      Priority: item.priority,
      "Project / account": item.project,
      Owner: item.owner,
      "Due date": item.due,
      Tags: item.tags.join("; "),
      Context: item.summary,
      "Next action": item.nextAction,
      Blocker: item.blocker,
      Expected: item.expected,
      Actual: item.actual,
      "Links / evidence": item.links,
      "SyncDesk links": item.knowledgeLinks.map((link) => `${link.type}:${link.id}`).join("; "),
      "Top focus": item.focus ? "Yes" : "No",
      Archived: item.archived ? "Yes" : "No",
      "Created at": item.createdAt,
      "Updated at": item.updatedAt,
      "Completed at": item.completedAt,
      "Notes / decisions": item.notes.length
    };
  }

  function reportNotes(items) {
    return items.flatMap((item) => item.notes.map((note) => ({
      "Work item ID": item.id,
      "Work item": item.title,
      Type: note.kind === "decision" ? "Decision" : "Note",
      Entry: note.text,
      "Created at": note.createdAt
    })));
  }

  function exportWorkspaceBackup() {
    persist();
    const payload = workspaceStore.exportPayload(workspaceStore.get());
    download(
      `operations-workspace-${localDateString()}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
    toast("Workspace backup downloaded");
  }

  function exportCsv(scope) {
    const records = scopedItems(scope).map(reportRecord);
    const columns = Object.keys(reportRecord(createItem()));
    const rows = records.map((record) => columns.map((column) => csvCell(record[column])).join(","));
    download(
      `opsdesk-report-${scope}-${localDateString()}.csv`,
      `\ufeff${[columns.map(csvCell).join(","), ...rows].join("\n")}`,
      "text/csv;charset=utf-8"
    );
    toast("CSV report exported");
  }

  function exportExcel(scope) {
    if (!globalThis.XLSX) {
      toast("Excel exporter is unavailable");
      return;
    }
    const items = scopedItems(scope);
    const records = items.map(reportRecord);
    const notes = reportNotes(items);
    const summary = [
      { Metric: "Report scope", Value: scope },
      { Metric: "Exported at", Value: new Date().toISOString() },
      { Metric: "Total items", Value: items.length },
      { Metric: "Open", Value: items.filter((item) => !item.archived && item.status !== "done").length },
      { Metric: "Completed", Value: items.filter((item) => !item.archived && item.status === "done").length },
      { Metric: "Blocked", Value: items.filter((item) => !item.archived && item.status === "blocked").length },
      { Metric: "Archived", Value: items.filter((item) => item.archived).length },
      { Metric: "Notes and decisions", Value: notes.length }
    ];
    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summary);
    const workSheet = XLSX.utils.json_to_sheet(records.length ? records : [{ Message: "No work items in this scope" }]);
    const notesSheet = XLSX.utils.json_to_sheet(notes.length ? notes : [{ Message: "No notes or decisions in this scope" }]);
    summarySheet["!cols"] = [{ wch: 24 }, { wch: 32 }];
    workSheet["!cols"] = Object.keys(records[0] || { Message: "" }).map((key) => ({ wch: Math.min(42, Math.max(12, key.length + 2)) }));
    notesSheet["!cols"] = [{ wch: 38 }, { wch: 34 }, { wch: 14 }, { wch: 64 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, workSheet, "Work items");
    XLSX.utils.book_append_sheet(workbook, notesSheet, "Notes and decisions");
    XLSX.writeFile(workbook, `opsdesk-report-${scope}-${localDateString()}.xlsx`, { compression: true });
    toast("Excel report exported");
  }

  function markdownReport(scope) {
    const items = scopedItems(scope).sort(compareItems);
    const lines = [
      "# OpsDesk work report",
      "",
      `Generated: ${formatDate(new Date(), { month: "long", day: "numeric", year: "numeric" })}`,
      `Scope: ${scope}`,
      "",
      "## Summary",
      `- Total items: ${items.length}`,
      `- Open: ${items.filter((item) => !item.archived && item.status !== "done").length}`,
      `- Completed: ${items.filter((item) => !item.archived && item.status === "done").length}`,
      `- Blocked: ${items.filter((item) => !item.archived && item.status === "blocked").length}`,
      `- Archived: ${items.filter((item) => item.archived).length}`,
      ""
    ];
    const groups = [
      ["In progress", items.filter((item) => !item.archived && item.status === "active")],
      ["Blocked", items.filter((item) => !item.archived && item.status === "blocked")],
      ["Planned and inbox", items.filter((item) => !item.archived && ["planned", "inbox"].includes(item.status))],
      ["Completed", items.filter((item) => !item.archived && item.status === "done")],
      ["Archive", items.filter((item) => item.archived)]
    ];
    groups.forEach(([title, groupItems]) => {
      lines.push(`## ${title}`);
      if (!groupItems.length) lines.push("- None");
      groupItems.forEach((item) => {
        const metadata = [item.priority, typeLabels[item.type], item.project, item.owner].filter(Boolean).join(" · ");
        lines.push(`- **${item.title}**${metadata ? ` — ${metadata}` : ""}`);
        if (item.nextAction) lines.push(`  - Next: ${item.nextAction}`);
        if (item.blocker) lines.push(`  - Blocker: ${item.blocker}`);
      });
      lines.push("");
    });
    return lines.join("\n").trim();
  }

  function exportMarkdown(scope) {
    download(`opsdesk-report-${scope}-${localDateString()}.md`, markdownReport(scope), "text/markdown;charset=utf-8");
    toast("Markdown report exported");
  }

  function updateExportUi() {
    const format = elements.exportForm.elements.format.value;
    const notes = {
      xlsx: ["Excel is selected.", "The workbook includes a summary plus detailed work and notes sheets."],
      csv: ["CSV is selected.", "This is a flat work-item table for analysis and reporting."],
      md: ["Markdown is selected.", "This creates a readable status report grouped by work state."],
      json: ["Workspace backup is selected.", "This complete restore file includes OpsDesk and SyncDesk data."]
    };
    elements.exportScopeField.hidden = format === "json";
    elements.exportNote.innerHTML = `<strong>${notes[format][0]}</strong> ${notes[format][1]}`;
  }

  function openExportModal() {
    if (elements.storageModal.open) elements.storageModal.close();
    elements.exportForm.reset();
    updateExportUi();
    elements.exportModal.showModal();
  }

  function acknowledgeStorageNotice() {
    storage.set(storageNoticeKey, true);
    if (elements.onboardingModal.open) elements.onboardingModal.close();
  }

  function openImportPicker() {
    elements.importFile.click();
  }

  function itemCountLabel(count) {
    return `${count} item${count === 1 ? "" : "s"}`;
  }

  function prepareImport(payload, fileName) {
    const isLegacy = payload?.app === "OpsDesk" && Array.isArray(payload?.items);
    const isWorkspace = payload?.schemaVersion === 2 && Array.isArray(payload?.opsDesk?.items);
    if (!isLegacy && !isWorkspace) throw new Error("Invalid workspace backup");
    const importedWorkspace = workspaceStore.normalize(payload);
    const items = importedWorkspace.opsDesk.items.map(normalizeItem);
    const archivedCount = items.filter((item) => item.archived).length;
    const activeCount = items.length - archivedCount;
    const exportedAt = payload.exportedAt
      ? formatDate(payload.exportedAt, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) || "unknown date"
      : "unknown date";
    importedWorkspace.opsDesk.items = items;
    const knowledgeCount = Object.values(importedWorkspace.syncDesk).reduce((sum, records) => sum + records.length, 0);
    pendingImport = { workspace: importedWorkspace, fileName };
    elements.importSummary.textContent = `${fileName} contains ${itemCountLabel(items.length)} (${activeCount} active, ${archivedCount} archived) and ${knowledgeCount} SyncDesk records, exported ${exportedAt}. Your current workspace has ${itemCountLabel(state.items.length)}.`;
    elements.importModal.showModal();
  }

  function applyImport(mode) {
    if (!pendingImport) return;
    const importedWorkspace = pendingImport.workspace;
    workspace = mode === "merge"
      ? workspaceStore.merge(workspaceStore.get(), importedWorkspace)
      : workspaceStore.normalize(importedWorkspace);
    workspace = workspaceStore.save(workspace);
    state.items = workspace.opsDesk.items.map(normalizeItem);
    const preferences = workspace.opsDesk.preferences || {};
    if (["focus", "board", "todo", "updates"].includes(preferences.view)) state.view = preferences.view;
    if (["today", "week", "all"].includes(preferences.updateRange)) state.updateRange = preferences.updateRange;
    state.selectedId = null;
    elements.updateRange.value = state.updateRange;
    history.replaceState(null, "", `#${state.view}`);
    render();
    if (elements.importModal.open) elements.importModal.close();
    const importedCount = importedWorkspace.opsDesk.items.length;
    pendingImport = null;
    toast(mode === "merge" ? `${itemCountLabel(importedCount)} merged from backup` : `${itemCountLabel(importedCount)} restored`);
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function requestDelete(id) {
    const item = state.items.find((entry) => entry.id === id);
    if (!item) return;
    pendingDeleteId = item.id;
    elements.deleteSummary.textContent = `“${item.title}” will be removed permanently.`;
    elements.deleteModal.showModal();
  }

  function deletePendingItem() {
    const item = state.items.find((entry) => entry.id === pendingDeleteId);
    if (!item) return;
    state.items = state.items.filter((entry) => entry.id !== pendingDeleteId);
    if (state.selectedId === pendingDeleteId) state.selectedId = null;
    pendingDeleteId = null;
    persist();
    if (elements.deleteModal.open) elements.deleteModal.close();
    if (elements.archiveModal.open) renderArchive();
    render();
    toast("Item deleted permanently");
  }

  elements.quickForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(elements.quickForm).entries());
    if (!values.title.trim()) return;
    addItem({ title: values.title, type: values.type, status: "inbox", priority: "P3" });
    elements.quickForm.reset();
  });

  document.addEventListener("click", (event) => {
    const viewLink = event.target.closest("[data-view-link]");
    const viewButton = event.target.closest("[data-view-button]");
    const itemTarget = event.target.closest("[data-item-id]");
    const templateButton = event.target.closest("[data-template]");

    if (viewLink) {
      event.preventDefault();
      setView(viewLink.dataset.viewLink);
    }
    if (viewButton) setView(viewButton.dataset.viewButton);
    if (itemTarget) openItem(itemTarget.dataset.itemId);
    if (templateButton) openNewItemModal(templateButton.dataset.template);
    if (event.target.closest("[data-new-item]")) openNewItemModal();
    if (event.target.closest("[data-open-board]")) setView("board");
    const todoToggle = event.target.closest("[data-todo-toggle]");
    if (todoToggle) {
      const item = state.items.find((entry) => entry.id === todoToggle.dataset.todoToggle);
      if (item) {
        setItemStatus(item, item.status === "done" ? "planned" : "done");
        item.updatedAt = new Date().toISOString();
        persist();
        render();
        toast(item.status === "done" ? "To-do completed" : "To-do reopened");
      }
    }
    if (event.target.closest("[data-modal-close]")) elements.itemModal.close();
    if (event.target.closest("[data-close-detail]")) {
      state.selectedId = null;
      render();
    }
    if (event.target.closest("[data-auto-focus]")) {
      const top = openItems().sort(compareItems).slice(0, 3);
      state.items.forEach((item) => { item.focus = top.some((entry) => entry.id === item.id); });
      persist();
      render();
      toast(top.length ? "Top focus selected" : "No open work to prioritize");
    }
    if (event.target.closest("[data-clear-filters]")) {
      state.filters = { search: "", priority: "all", type: "all" };
      elements.search.value = "";
      elements.filterPriority.value = "all";
      elements.filterType.value = "all";
      renderBoard();
    }
    if (event.target.closest("[data-export-report]")) openExportModal();
    if (event.target.closest("[data-export-workspace]")) exportWorkspaceBackup();
    if (event.target.closest("[data-export-close]")) elements.exportModal.close();
    if (event.target.closest("[data-import-trigger]")) openImportPicker();
    if (event.target.closest("[data-storage-guide]")) elements.storageModal.showModal();
    if (event.target.closest("[data-storage-close]")) elements.storageModal.close();
    if (event.target.closest("[data-onboarding-continue]")) acknowledgeStorageNotice();
    if (event.target.closest("[data-onboarding-import]")) {
      acknowledgeStorageNotice();
      openImportPicker();
    }
    if (event.target.closest("[data-import-close]")) {
      pendingImport = null;
      elements.importModal.close();
    }
    const importMode = event.target.closest("[data-import-mode]");
    if (importMode) applyImport(importMode.dataset.importMode);
    if (event.target.closest("[data-show-archive]")) {
      renderArchive();
      elements.archiveModal.showModal();
    }
    if (event.target.closest("[data-archive-close]")) elements.archiveModal.close();
    const restore = event.target.closest("[data-restore-item]");
    if (restore) {
      const item = state.items.find((entry) => entry.id === restore.dataset.restoreItem);
      if (item) {
        item.archived = false;
        item.updatedAt = new Date().toISOString();
        persist();
        renderArchive();
        render();
        toast("Item restored");
      }
    }
    const deleteItem = event.target.closest("[data-delete-item]");
    if (deleteItem) requestDelete(deleteItem.dataset.deleteItem);
    if (event.target.closest("[data-delete-selected]")) {
      const item = getSelected();
      if (item) requestDelete(item.id);
    }
    if (event.target.closest("[data-delete-close]")) {
      pendingDeleteId = null;
      elements.deleteModal.close();
    }
    if (event.target.closest("[data-confirm-delete]")) deletePendingItem();
    const removeNote = event.target.closest("[data-remove-note]");
    if (removeNote) {
      const item = getSelected();
      if (item) {
        item.notes = item.notes.filter((note) => note.id !== removeNote.dataset.removeNote);
        item.updatedAt = new Date().toISOString();
        persist();
        renderNotes(item);
        renderUpdates();
      }
    }
    if (event.target.closest("[data-archive-item]")) {
      const item = getSelected();
      if (item) {
        item.archived = true;
        item.focus = false;
        item.updatedAt = new Date().toISOString();
        state.selectedId = null;
        persist();
        render();
        toast("Item moved to archive");
      }
    }
    if (event.target.closest("[data-copy-update]")) {
      copy(buildUpdateText()).then((success) => toast(success ? "Update copied" : "Copy failed"));
    }
    if (event.target.closest("[data-download-update]")) {
      download(`opsdesk-update-${localDateString()}.md`, buildUpdateText(), "text/markdown;charset=utf-8");
      toast("Update downloaded");
    }
  });

  elements.itemForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(elements.itemForm).entries());
    addItem({ ...templates[state.activeTemplate], ...values, status: "inbox" });
    elements.itemModal.close();
    state.activeTemplate = null;
  });

  elements.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(elements.todoForm).entries());
    addItem({ title: values.title, due: values.due, type: "task", status: "planned", priority: "P3" }, false);
    elements.todoForm.reset();
  });

  elements.exportForm.addEventListener("change", updateExportUi);
  elements.exportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(elements.exportForm).entries());
    if (values.format === "json") exportWorkspaceBackup();
    if (values.format === "csv") exportCsv(values.scope);
    if (values.format === "xlsx") exportExcel(values.scope);
    if (values.format === "md") exportMarkdown(values.scope);
    elements.exportModal.close();
  });

  elements.detailForm.addEventListener("input", syncDetailToState);
  elements.detailForm.addEventListener("change", syncDetailToState);

  elements.noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const item = getSelected();
    if (!item) return;
    const text = elements.noteForm.elements.note.value.trim();
    if (!text) return;
    item.notes.push({ id: uid("note"), kind: document.querySelector("[data-note-kind]").value, text, createdAt: new Date().toISOString() });
    item.updatedAt = new Date().toISOString();
    elements.noteForm.reset();
    persist();
    renderNotes(item);
    renderUpdates();
    toast("Note saved");
  });

  elements.search.addEventListener("input", () => {
    state.filters.search = elements.search.value;
    renderBoard();
  });
  elements.filterPriority.addEventListener("change", () => {
    state.filters.priority = elements.filterPriority.value;
    renderBoard();
  });
  elements.filterType.addEventListener("change", () => {
    state.filters.type = elements.filterType.value;
    renderBoard();
  });
  elements.updateRange.addEventListener("change", () => {
    state.updateRange = elements.updateRange.value;
    persist();
    renderUpdates();
  });

  elements.importFile.addEventListener("change", async () => {
    const file = elements.importFile.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      prepareImport(payload, file.name);
    } catch {
      toast("This file is not a valid workspace backup");
    } finally {
      elements.importFile.value = "";
    }
  });

  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1);
    if (["focus", "board", "todo", "updates"].includes(next)) {
      state.view = next;
      renderViews();
      if (next === "updates") renderUpdates();
    }
  });

  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (!typing && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openNewItemModal();
    }
    if (!typing && event.key === "/") {
      event.preventDefault();
      setView("board");
      elements.search.focus();
    }
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* OpsDesk still works online when service-worker registration is unavailable. */
    });
  }

  elements.updateRange.value = state.updateRange;
  render();
  if (!storage.get(storageNoticeKey, false)) {
    requestAnimationFrame(() => elements.onboardingModal.showModal());
  }
})();
