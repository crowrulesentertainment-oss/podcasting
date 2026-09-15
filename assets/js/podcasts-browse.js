(() => {
  "use strict";

  const supabase = window.crowSupabase;

  if (!supabase) {
    console.error(
      "CrowRules Podcasting: Supabase client unavailable."
    );
    return;
  }

  const $ = (selector) =>
    document.querySelector(selector);

  const escapeHtml = (value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const number = (value) =>
    new Intl.NumberFormat("en-US")
      .format(Number(value || 0));

  const date = (value) => {
    if (!value) return "";

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  };

  const placeholder = (title) => {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg"
           width="800"
           height="800">

        <defs>
          <linearGradient
            id="g"
            x1="0"
            y1="0"
            x2="1"
            y2="1">

            <stop
              offset="0"
              stop-color="#071922"/>

            <stop
              offset=".5"
              stop-color="#281451"/>

            <stop
              offset="1"
              stop-color="#05050b"/>

          </linearGradient>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="url(#g)"/>

        <text
          x="50%"
          y="46%"
          text-anchor="middle"
          fill="#00e5ff"
          font-family="Arial"
          font-size="48"
          font-weight="900">
          CROWRULES
        </text>

        <text
          x="50%"
          y="54%"
          text-anchor="middle"
          fill="#ffffff"
          font-family="Arial"
          font-size="28">
          PODCASTING
        </text>

        <text
          x="50%"
          y="64%"
          text-anchor="middle"
          fill="#9da5bd"
          font-family="Arial"
          font-size="20">
          ${escapeHtml(title || "PODCAST")}
        </text>

      </svg>
    `)}`;
  };


  let currentPage = 1;
  const pageSize = 24;

  let debounceTimer = null;


  /*
   * ----------------------------------------
   * URL STATE
   * ----------------------------------------
   */

  function readUrlState() {

    const params =
      new URLSearchParams(
        window.location.search
      );

    return {
      q:
        params.get("q") || "",

      category:
        params.get("category") || "",

      sort:
        params.get("sort") || "newest",

      page:
        Math.max(
          1,
          Number(params.get("page") || 1)
        )
    };
  }


  function updateUrl() {

    const params =
      new URLSearchParams();

    const q =
      $("#q")?.value.trim();

    const category =
      $("#category")?.value;

    const sort =
      $("#sort")?.value;

    if (q) {
      params.set("q", q);
    }

    if (category) {
      params.set(
        "category",
        category
      );
    }

    if (sort && sort !== "newest") {
      params.set("sort", sort);
    }

    if (currentPage > 1) {
      params.set(
        "page",
        currentPage
      );
    }

    const query =
      params.toString();

    const url =
      query
        ? `podcasts.html?${query}`
        : "podcasts.html";

    history.replaceState(
      {},
      "",
      url
    );
  }


  /*
   * ----------------------------------------
   * AUTH
   * ----------------------------------------
   */

  async function loadAuth() {

    const {
      data: {
        session
      }
    } =
      await supabase.auth.getSession();

    renderAuth(
      session?.user || null
    );

  }


  function renderAuth(user) {

    const area =
      $("#authArea");

    if (!area) return;

    if (user) {

      area.innerHTML = `
        <span class="nav-user">
          ${escapeHtml(
            user.email || "Member"
          )}
        </span>

        <button
          id="logoutBtn"
          class="mini-btn"
          type="button">
          Logout
        </button>
      `;

      $("#logoutBtn")
        ?.addEventListener(
          "click",
          async () => {

            await supabase.auth.signOut();

            window.location.reload();

          }
        );

    } else {

      area.innerHTML = `
        <a href="login.html">
          Login
        </a>
      `;

    }

  }


  /*
   * ----------------------------------------
   * CATEGORIES
   * ----------------------------------------
   */

  async function loadCategories() {

    const select =
      $("#category");

    const grid =
      $("#categoryGrid");

    try {

      const {
        data,
        error
      } =
        await supabase
          .from("podcast_categories")
          .select(`
            id,
            name,
            slug,
            description,
            icon,
            image_url
          `)
          .eq("is_active", true)
          .order(
            "sort_order",
            {
              ascending: true
            }
          )
          .order(
            "name",
            {
              ascending: true
            }
          );

      if (error) {
        throw error;
      }

      if (select) {

        select.innerHTML =
          `<option value="">
             All Categories
           </option>`;

        (data || []).forEach(
          category => {

            const option =
              document.createElement(
                "option"
              );

            option.value =
              category.slug;

            option.textContent =
              category.name;

            select.appendChild(
              option
            );

          }
        );

      }

      if (grid) {

        if (!data?.length) {

          grid.innerHTML = `
            <div class="empty">
              Categories will appear here
              as they are added.
            </div>
          `;

          return;
        }

        grid.innerHTML =
          data.map(category => `
            <a
              class="category-card"
              href="podcasts.html?category=${encodeURIComponent(
                category.slug
              )}">

              <div class="category-icon">
                ${
                  escapeHtml(
                    category.icon ||
                    "🎙️"
                  )
                }
              </div>

              <div>

                <div class="category-name">
                  ${escapeHtml(
                    category.name
                  )}
                </div>

                <div class="category-desc">
                  ${escapeHtml(
                    category.description ||
                    "Explore podcasts in this category."
                  )}
                </div>

              </div>

            </a>
          `).join("");

      }

    } catch (error) {

      console.error(
        "Category loading error:",
        error
      );

      if (grid) {

        grid.innerHTML = `
          <div class="error">
            Unable to load categories.
          </div>
        `;

      }

    }

  }


  /*
   * ----------------------------------------
   * PODCAST BROWSE
   * ----------------------------------------
   */

  async function loadPodcasts() {

    const grid =
      $("#podcastGrid");

    const resultCount =
      $("#resultCount");

    const pagination =
      $("#pagination");

    if (!grid) return;

    grid.innerHTML = `
      <div class="loading">
        Searching the CrowRules Podcasting library...
      </div>
    `;

    try {

      const {
        data,
        error
      } =
        await supabase.rpc(
          "get_podcast_browse",
          {
            p_query:
              $("#q")?.value.trim() ||
              null,

            p_category:
              $("#category")?.value ||
              null,

            p_sort:
              $("#sort")?.value ||
              "newest",

            p_page:
              currentPage,

            p_page_size:
              pageSize
          }
        );

      if (error) {
        throw error;
      }

      const feed =
        data || {};

      const items =
        Array.isArray(feed.items)
          ? feed.items
          : [];

      const total =
        Number(
          feed.total_count || 0
        );

      const pages =
        Number(
          feed.total_pages || 0
        );

      if (resultCount) {

        resultCount.textContent =
          total === 0
            ? "No podcasts found"
            : `${number(total)} podcast${
                total === 1
                  ? ""
                  : "s"
              } found`;

      }

      if (!items.length) {

        grid.innerHTML = `
          <div class="empty">

            <strong>
              No podcasts found.
            </strong>

            <br><br>

            Try a different search,
            category, or sorting option.

          </div>
        `;

        if (pagination) {
          pagination.innerHTML = "";
        }

        return;
      }

      grid.innerHTML =
        items.map(renderPodcast)
          .join("");

      renderPagination(pages);

      bindTrailerButtons();

    } catch (error) {

      console.error(
        "Podcast browse error:",
        error
      );

      grid.innerHTML = `
        <div class="error">

          Unable to load the podcast library.

          <br><br>

          Please try again.

        </div>
      `;

      if (resultCount) {
        resultCount.textContent =
          "Library unavailable";
      }

      if (pagination) {
        pagination.innerHTML = "";
      }

    }

  }


  /*
   * ----------------------------------------
   * PODCAST CARD
   * ----------------------------------------
   */

  function renderPodcast(podcast) {

    const artwork =
      podcast.artwork_url ||
      placeholder(
        podcast.title
      );

    return `
      <article class="card">

        <div class="art-wrap">

          <img
            class="art"
            src="${escapeHtml(
              artwork
            )}"
            alt="${escapeHtml(
              podcast.title
            )} artwork"
            loading="lazy"
          >

          ${
            podcast.is_live
              ? `
                <div class="badge live">
                  🔴 Live
                </div>
              `
              : ""
          }

          ${
            podcast.is_featured
              ? `
                <div
                  class="badge featured"
                  style="${
                    podcast.is_live
                      ? "left:80px;"
                      : ""
                  }">
                  ⭐ Featured
                </div>
              `
              : ""
          }

        </div>

        <div class="card-body">

          <div class="category">

            ${escapeHtml(
              podcast.category_name ||
              podcast.category ||
              "Podcast"
            )}

          </div>

          <h2 class="title">
            ${escapeHtml(
              podcast.title
            )}
          </h2>

          <p class="description">

            ${escapeHtml(
              podcast.description ||
              "Discover this CrowRules podcast."
            )}

          </p>

          <div class="stats">

            <span>
              ▶ ${number(
                podcast.total_plays
              )} plays
            </span>

            ${
              podcast.listener_count
                ? `
                  <span>
                    🎧 ${number(
                      podcast.listener_count
                    )} listening
                  </span>
                `
                : ""
            }

            <span>
              📅 ${date(
                podcast.updated_at ||
                podcast.created_at
              )}
            </span>

          </div>

          <div class="actions">

            <a
              class="btn"
              href="podcast.html?id=${encodeURIComponent(
                podcast.id
              )}">
              View Podcast
            </a>

            ${
              podcast.trailer_url
                ? `
                  <button
                    class="btn secondary trailer-btn"
                    type="button"
                    data-url="${escapeHtml(
                      podcast.trailer_url
                    )}"
                    data-title="${escapeHtml(
                      podcast.title
                    )}">
                    ▶ Trailer
                  </button>
                `
                : ""
            }

          </div>

        </div>

      </article>
    `;
  }


  /*
   * ----------------------------------------
   * TRAILERS
   * ----------------------------------------
   */

  function bindTrailerButtons() {

    document
      .querySelectorAll(
        ".trailer-btn"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const url =
              button.dataset.url;

            const title =
              button.dataset.title;

            if (!url) return;

            const audio =
              document.createElement(
                "audio"
              );

            audio.controls = true;
            audio.autoplay = true;
            audio.src = url;

            const popup =
              document.createElement(
                "div"
              );

            popup.style.position =
              "fixed";

            popup.style.left =
              "20px";

            popup.style.right =
              "20px";

            popup.style.bottom =
              "20px";

            popup.style.zIndex =
              "9999";

            popup.style.padding =
              "18px";

            popup.style.border =
              "1px solid rgba(0,229,255,.25)";

            popup.style.borderRadius =
              "18px";

            popup.style.background =
              "rgba(10,10,20,.97)";

            popup.style.backdropFilter =
              "blur(20px)";

            popup.innerHTML = `
              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:15px;
                  margin-bottom:10px;
                ">

                <strong>
                  ${escapeHtml(
                    title
                  )} — Trailer
                </strong>

                <button
                  class="mini-btn"
                  type="button">
                  Close
                </button>

              </div>
            `;

            popup
              .appendChild(audio);

            document.body
              .appendChild(popup);

            popup
              .querySelector("button")
              .addEventListener(
                "click",
                () => {

                  audio.pause();
                  popup.remove();

                }
              );

          }
        );

      });

  }


  /*
   * ----------------------------------------
   * PAGINATION
   * ----------------------------------------
   */

  function renderPagination(totalPages) {

    const container =
      $("#pagination");

    if (!container) return;

    if (
      !totalPages ||
      totalPages <= 1
    ) {

      container.innerHTML = "";

      return;
    }

    const buttons = [];

    if (currentPage > 1) {

      buttons.push(`
        <button
          class="mini-btn"
          data-page="${currentPage - 1}">
          ← Previous
        </button>
      `);

    }

    const start =
      Math.max(
        1,
        currentPage - 2
      );

    const end =
      Math.min(
        totalPages,
        currentPage + 2
      );

    for (
      let page = start;
      page <= end;
      page++
    ) {

      buttons.push(`
        <button
          class="mini-btn"
          data-page="${page}"
          ${
            page === currentPage
              ? 'style="color:#00e5ff;border-color:#00e5ff;"'
              : ""
          }>
          ${page}
        </button>
      `);

    }

    if (
      currentPage <
      totalPages
    ) {

      buttons.push(`
        <button
          class="mini-btn"
          data-page="${currentPage + 1}">
          Next →
        </button>
      `);

    }

    container.innerHTML = `
      ${buttons.join("")}

      <span class="page-info">
        Page ${currentPage}
        of ${totalPages}
      </span>
    `;

    container
      .querySelectorAll(
        "[data-page]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            currentPage =
              Number(
                button.dataset.page
              );

            updateUrl();

            loadPodcasts();

            window.scrollTo({
              top:0,
              behavior:"smooth"
            });

          }
        );

      });

  }


  /*
   * ----------------------------------------
   * FILTERS
   * ----------------------------------------
   */

  function setupFilters() {

    const q =
      $("#q");

    const category =
      $("#category");

    const sort =
      $("#sort");

    const clear =
      $("#clearFilters");


    const search = () => {

      clearTimeout(
        debounceTimer
      );

      debounceTimer =
        setTimeout(
          () => {

            currentPage = 1;

            updateUrl();

            loadPodcasts();

          },
          300
        );

    };


    q?.addEventListener(
      "input",
      search
    );

    category?.addEventListener(
      "change",
      () => {

        currentPage = 1;

        updateUrl();

        loadPodcasts();

      }
    );

    sort?.addEventListener(
      "change",
      () => {

        currentPage = 1;

        updateUrl();

        loadPodcasts();

      }
    );


    clear?.addEventListener(
      "click",
      () => {

        if (q) {
          q.value = "";
        }

        if (category) {
          category.value = "";
        }

        if (sort) {
          sort.value = "newest";
        }

        currentPage = 1;

        updateUrl();

        loadPodcasts();

      }
    );

  }


  /*
   * ----------------------------------------
   * INITIAL STATE
   * ----------------------------------------
   */

  function applyUrlState() {

    const state =
      readUrlState();

    const q =
      $("#q");

    const category =
      $("#category");

    const sort =
      $("#sort");

    if (q) {
      q.value = state.q;
    }

    if (category) {
      category.value =
        state.category;
    }

    if (sort) {
      sort.value =
        [
          "newest",
          "popular",
          "featured",
          "title",
          "oldest"
        ].includes(
          state.sort
        )
          ? state.sort
          : "newest";
    }

    currentPage =
      state.page;

  }


  /*
   * ----------------------------------------
   * AUTH CHANGES
   * ----------------------------------------
   */

  supabase.auth.onAuthStateChange(
    (_event, session) => {

      renderAuth(
        session?.user || null
      );

    }
  );


  /*
   * ----------------------------------------
   * INIT
   * ----------------------------------------
   */

  async function init() {

    await loadAuth();

    await loadCategories();

    applyUrlState();

    setupFilters();

    loadPodcasts();

  }


  init();

})();