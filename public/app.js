// State
let folders = [];
let selectedFolderId = null;
let searchQuery = "";
let pageLimit = 6;
let cursorStack = [null]; // stack of cursors for navigation: index 0 is page 1 (null cursor)
let currentPageIndex = 0;
let pageInfo = { hasNextPage: false, endCursor: null };
let searchDebounceTimer = null;

// ─── GraphQL Client ────────────────────────────────────────────────

async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch("/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      const firstError = result.errors[0];
      const errorMessage = firstError.message || "An unexpected error occurred.";
      showToast(errorMessage, "error");
      throw new Error(errorMessage);
    }

    return result.data;
  } catch (error) {
    if (!error.message.includes("GraphQL")) {
      console.error("Network or GraphQL Error:", error);
    }
    throw error;
  }
}

// ─── Queries & Fetching ───────────────────────────────────────────

async function fetchFolders() {
  const query = `
    query GetFolders {
      folders {
        id
        name
        createdAt
        bookmarks {
          id
        }
      }
    }
  `;

  const data = await graphqlRequest(query);
  folders = data.folders || [];
  renderFolders();
  updateFolderSelects();
}

async function fetchBookmarks() {
  const currentCursor = cursorStack[currentPageIndex] || null;

  const query = `
    query GetBookmarks($folderId: ID, $search: String, $take: Int, $cursor: String) {
      bookmarks(folderId: $folderId, search: $search, take: $take, cursor: $cursor) {
        edges {
          cursor
          node {
            id
            title
            url
            tags
            folderId
            createdAt
            folder {
              id
              name
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  `;

  const variables = {
    take: pageLimit,
    cursor: currentCursor,
    folderId: selectedFolderId,
    search: searchQuery.trim() ? searchQuery.trim() : null,
  };

  const data = await graphqlRequest(query, variables);
  const connection = data.bookmarks;

  pageInfo = connection.pageInfo;
  renderBookmarks(connection.edges.map((e) => e.node), connection.totalCount);
  renderPagination(connection.totalCount);
}

// ─── Rendering UI ─────────────────────────────────────────────────

function renderFolders() {
  const listEl = document.getElementById("folders-list");
  listEl.innerHTML = "";

  let totalCount = 0;

  folders.forEach((folder) => {
    const count = folder.bookmarks ? folder.bookmarks.length : 0;
    totalCount += count;

    const btn = document.createElement("button");
    btn.className = `nav-item ${selectedFolderId === folder.id ? "active" : ""}`;
    btn.onclick = () => selectFolder(folder.id);
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(folder.name)}</span>
      <span class="badge">${count}</span>
    `;
    listEl.appendChild(btn);
  });

  document.getElementById("total-bookmarks-count").textContent = totalCount;
}

function renderBookmarks(bookmarks, totalCount) {
  const container = document.getElementById("bookmarks-container");
  const emptyState = document.getElementById("empty-state");
  const viewTitle = document.getElementById("view-title");
  const viewSubtitle = document.getElementById("view-subtitle");
  const viewStats = document.getElementById("view-stats");

  // Update Header
  if (selectedFolderId) {
    const currentFolder = folders.find((f) => f.id === selectedFolderId);
    viewTitle.textContent = currentFolder ? currentFolder.name : "Folder";
    viewSubtitle.textContent = `Filtered by folder`;
  } else if (searchQuery.trim()) {
    viewTitle.textContent = "Search Results";
    viewSubtitle.textContent = `Matching "${searchQuery}"`;
  } else {
    viewTitle.textContent = "All Bookmarks";
    viewSubtitle.textContent = "Showing all saved bookmarks";
  }

  viewStats.textContent = `${totalCount} bookmark${totalCount === 1 ? "" : "s"}`;

  if (bookmarks.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";
  container.innerHTML = bookmarks
    .map((bm) => {
      const dateStr = new Date(Number(bm.createdAt) || bm.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const tagsHtml =
        bm.tags && bm.tags.length > 0
          ? bm.tags.map((t) => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join("")
          : "";

      const folderName = bm.folder ? bm.folder.name : "Uncategorized";

      return `
      <div class="bookmark-card">
        <div>
          <div class="card-top">
            <h3 class="card-title">${escapeHtml(bm.title)}</h3>
            <span class="card-folder-badge">📁 ${escapeHtml(folderName)}</span>
          </div>

          <a href="${escapeHtml(bm.url)}" target="_blank" rel="noopener noreferrer" class="card-url">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span>${escapeHtml(bm.url)}</span>
          </a>

          ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
        </div>

        <div class="card-actions">
          <span>${dateStr}</span>
          <div class="action-buttons">
            <button class="btn-card-action" onclick='openEditBookmarkModal(${JSON.stringify(bm).replace(/'/g, "&#39;")})' title="Edit">
              ✏️ Edit
            </button>
            <button class="btn-card-action" onclick='openMoveModal(${JSON.stringify(bm).replace(/'/g, "&#39;")})' title="Move">
              📁 Move
            </button>
            <button class="btn-card-action btn-delete" onclick="handleDeleteBookmark('${bm.id}', '${escapeHtml(bm.title)}')" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderPagination(totalCount) {
  const prevBtn = document.getElementById("btn-prev-page");
  const nextBtn = document.getElementById("btn-next-page");
  const info = document.getElementById("pagination-info");

  const pageNum = currentPageIndex + 1;
  const totalPages = Math.ceil(totalCount / pageLimit) || 1;

  info.textContent = `Page ${pageNum} of ${totalPages} (${totalCount} total)`;

  prevBtn.disabled = currentPageIndex === 0;
  nextBtn.disabled = !pageInfo.hasNextPage;
}

function updateFolderSelects() {
  const bmSelect = document.getElementById("bm-folder");
  const moveSelect = document.getElementById("move-target-folder");

  const optionsHtml = folders
    .map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`)
    .join("");

  if (bmSelect) bmSelect.innerHTML = optionsHtml;
  if (moveSelect) moveSelect.innerHTML = optionsHtml;
}

// ─── Actions & Event Handlers ─────────────────────────────────────

function selectFolder(folderId) {
  selectedFolderId = folderId;
  resetPagination();

  document.getElementById("btn-all-bookmarks").className = `nav-item ${selectedFolderId === null ? "active" : ""}`;
  renderFolders();
  fetchBookmarks();
}

function handleSearch(val) {
  searchQuery = val;
  const clearBtn = document.getElementById("search-clear-btn");
  clearBtn.style.display = val ? "block" : "none";

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    resetPagination();
    fetchBookmarks();
  }, 250);
}

function clearSearch() {
  document.getElementById("search-input").value = "";
  handleSearch("");
}

function resetPagination() {
  cursorStack = [null];
  currentPageIndex = 0;
}

function nextPage() {
  if (!pageInfo.hasNextPage || !pageInfo.endCursor) return;

  currentPageIndex++;
  cursorStack[currentPageIndex] = pageInfo.endCursor;
  fetchBookmarks();
}

function prevPage() {
  if (currentPageIndex === 0) return;

  currentPageIndex--;
  fetchBookmarks();
}

// ─── Modals & Mutations ───────────────────────────────────────────

function openCreateFolderModal() {
  document.getElementById("folder-name-input").value = "";
  openModal("modal-folder");
}

async function submitCreateFolder(event) {
  event.preventDefault();
  const nameInput = document.getElementById("folder-name-input");
  const name = nameInput.value.trim();

  if (!name) {
    showToast("Folder name cannot be empty", "error");
    return;
  }

  const mutation = `
    mutation CreateFolder($name: String!) {
      createFolder(name: $name) {
        id
        name
      }
    }
  `;

  try {
    await graphqlRequest(mutation, { name });
    closeModal("modal-folder");
    showToast(`Folder "${name}" created!`, "success");
    await fetchFolders();
  } catch (_e) {
    // Handled by graphqlRequest
  }
}

function openCreateBookmarkModal() {
  if (folders.length === 0) {
    showToast("Please create at least one folder first!", "error");
    openCreateFolderModal();
    return;
  }

  document.getElementById("modal-bookmark-title").textContent = "Add Bookmark";
  document.getElementById("bookmark-edit-id").value = "";
  document.getElementById("bm-title").value = "";
  document.getElementById("bm-url").value = "";
  document.getElementById("bm-tags").value = "";
  document.getElementById("bm-folder-group").style.display = "block";

  if (selectedFolderId) {
    document.getElementById("bm-folder").value = selectedFolderId;
  }

  openModal("modal-bookmark");
}

function openEditBookmarkModal(bm) {
  document.getElementById("modal-bookmark-title").textContent = "Edit Bookmark";
  document.getElementById("bookmark-edit-id").value = bm.id;
  document.getElementById("bm-title").value = bm.title;
  document.getElementById("bm-url").value = bm.url;
  document.getElementById("bm-tags").value = bm.tags ? bm.tags.join(", ") : "";
  document.getElementById("bm-folder-group").style.display = "none"; // folder updated via Move

  openModal("modal-bookmark");
}

async function submitBookmarkForm(event) {
  event.preventDefault();

  const editId = document.getElementById("bookmark-edit-id").value;
  const title = document.getElementById("bm-title").value.trim();
  const url = document.getElementById("bm-url").value.trim();
  const tagsRaw = document.getElementById("bm-tags").value;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : [];

  if (editId) {
    // UPDATE
    const mutation = `
      mutation UpdateBookmark($id: ID!, $title: String, $url: String, $tags: [String!]) {
        updateBookmark(id: $id, title: $title, url: $url, tags: $tags) {
          id
          title
        }
      }
    `;
    try {
      await graphqlRequest(mutation, { id: editId, title, url, tags });
      closeModal("modal-bookmark");
      showToast("Bookmark updated successfully!", "success");
      fetchBookmarks();
    } catch (_e) {
      // Handled
    }
  } else {
    // CREATE
    const folderId = document.getElementById("bm-folder").value;
    const mutation = `
      mutation CreateBookmark($title: String!, $url: String!, $tags: [String!], $folderId: ID!) {
        createBookmark(title: $title, url: $url, tags: $tags, folderId: $folderId) {
          id
          title
        }
      }
    `;
    try {
      await graphqlRequest(mutation, { title, url, tags, folderId });
      closeModal("modal-bookmark");
      showToast("Bookmark added successfully!", "success");
      await fetchFolders();
      fetchBookmarks();
    } catch (_e) {
      // Handled
    }
  }
}

function openMoveModal(bm) {
  document.getElementById("move-bm-id").value = bm.id;
  document.getElementById("move-bm-title").textContent = `Move "${bm.title}" to:`;
  document.getElementById("move-target-folder").value = bm.folderId;
  openModal("modal-move");
}

async function submitMoveBookmark(event) {
  event.preventDefault();
  const id = document.getElementById("move-bm-id").value;
  const folderId = document.getElementById("move-target-folder").value;

  const mutation = `
    mutation MoveBookmark($id: ID!, $folderId: ID!) {
      moveBookmark(id: $id, folderId: $folderId) {
        id
        folderId
        folder {
          name
        }
      }
    }
  `;

  try {
    const data = await graphqlRequest(mutation, { id, folderId });
    closeModal("modal-move");
    showToast(`Moved to "${data.moveBookmark.folder.name}"!`, "success");
    await fetchFolders();
    fetchBookmarks();
  } catch (_e) {
    // Handled
  }
}

async function handleDeleteBookmark(id, title) {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

  const mutation = `
    mutation DeleteBookmark($id: ID!) {
      deleteBookmark(id: $id) {
        id
        title
      }
    }
  `;

  try {
    await graphqlRequest(mutation, { id });
    showToast(`Bookmark "${title}" deleted`, "success");
    await fetchFolders();
    fetchBookmarks();
  } catch (_e) {
    // Handled
  }
}

// ─── Modal Helpers ────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

function closeModalOnBackdrop(event, id) {
  if (event.target.id === id) {
    closeModal(id);
  }
}

// ─── Toast Notifications ──────────────────────────────────────────

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✅" : "⚠️"}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 0.2s ease-out";
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Init ─────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  fetchFolders();
  fetchBookmarks();
});
