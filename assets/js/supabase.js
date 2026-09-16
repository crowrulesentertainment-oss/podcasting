/*
 * ============================================================
 * CrowRules Podcasting
 * Universal Supabase Client
 * ============================================================
 *
 * File:
 * /assets/js/supabase.js
 *
 * This file is designed to work across the ENTIRE
 * CrowRules Podcasting website.
 *
 * Examples:
 *
 * /login.html
 * /signup.html
 * /index.html
 *
 * /creator/dashboard.html
 * /creator/my-podcasts.html
 * /creator/my-episodes.html
 * /creator/upload-episode.html
 * /creator/settings.html
 * /creator/analytics.html
 *
 * /podcast.html
 * /episode.html
 * /browse.html
 * /search.html
 *
 * ============================================================
 */

(function () {

  "use strict";


  /*
   * ==========================================================
   * CONFIGURATION
   * ==========================================================
   */

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  /*
   * Browser-safe publishable key.
   *
   * NEVER place a service_role / secret key here.
   */
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";


  /*
   * ==========================================================
   * GLOBAL CONFIGURATION
   * ==========================================================
   */

  window.CrowRulesSupabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY
  };


  /*
   * ==========================================================
   * SINGLETON CLIENT
   * ==========================================================
   *
   * Only ONE Supabase client is created.
   */

  let client = null;


  function createClient() {

    /*
     * Supabase JS must already be loaded.
     */

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {

      console.error(
        "[CrowRules] Supabase JS library is not loaded."
      );

      return null;
    }


    try {

      client =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_PUBLISHABLE_KEY,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              flowType: "pkce"
            }
          }
        );


      return client;

    } catch (error) {

      console.error(
        "[CrowRules] Supabase initialization failed:",
        error
      );

      return null;
    }
  }


  /*
   * ==========================================================
   * INITIALIZE
   * ==========================================================
   */

  client = createClient();


  /*
   * ==========================================================
   * GLOBAL CLIENT NAMES
   * ==========================================================
   *
   * Multiple names are retained for compatibility with
   * existing CrowRules pages.
   */

  window.crowSupabase =
    client;

  window.supabaseClient =
    client;


  /*
   * ==========================================================
   * UNIVERSAL CLIENT ACCESS
   * ==========================================================
   */

  window.getSupabaseClient =
    function () {

      if (client) {
        return client;
      }


      /*
       * Try again if Supabase JS loaded after this file.
       */

      if (
        window.supabase &&
        typeof window.supabase.createClient === "function"
      ) {

        client = createClient();

        window.crowSupabase =
          client;

        window.supabaseClient =
          client;

      }


      if (!client) {

        throw new Error(
          "Supabase is not configured. " +
          "Check that @supabase/supabase-js loads " +
          "before assets/js/supabase.js."
        );

      }


      return client;

    };


  /*
   * Existing CrowRules pages use this function.
   */

  window.loadSupabase =
    async function () {

      return window.getSupabaseClient();

    };


  /*
   * ==========================================================
   * LEGACY CROW CLIENT
   * ==========================================================
   */

  window.Crow =
    window.Crow || {};


  window.Crow.client =
    function () {

      return window.getSupabaseClient();

    };


  /*
   * ==========================================================
   * SITE PATH HELPERS
   * ==========================================================
   *
   * These automatically work whether the current page is:
   *
   * /index.html
   * /creator/dashboard.html
   * /creator/upload-episode.html
   *
   * No hard-coded "/podcasting/" path is required.
   */

  function siteRoot() {

    /*
     * Determine the GitHub Pages site root.
     */

    const path =
      window.location.pathname;


    const marker =
      "/podcasting/";


    const index =
      path.indexOf(marker);


    if (index >= 0) {

      return (
        window.location.origin +
        marker
      );

    }


    /*
     * Fallback for another hosting configuration.
     */

    return (
      window.location.origin +
      "/"
    );

  }


  function siteUrl(path) {

    path =
      String(path || "")
        .replace(/^\/+/, "");


    return (
      siteRoot() +
      path
    );

  }


  window.CrowRulesPaths = {

    root:
      function (path) {
        return siteUrl(path);
      },


    login:
      function () {
        return siteUrl("login.html");
      },


    signup:
      function () {
        return siteUrl("signup.html");
      },


    home:
      function () {
        return siteUrl("index.html");
      },


    dashboard:
      function () {
        return siteUrl(
          "creator/dashboard.html"
        );
      },


    myPodcasts:
      function () {
        return siteUrl(
          "creator/my-podcasts.html"
        );
      },


    myEpisodes:
      function () {
        return siteUrl(
          "creator/my-episodes.html"
        );
      },


    uploadEpisode:
      function () {
        return siteUrl(
          "creator/upload-episode.html"
        );
      },


    analytics:
      function () {
        return siteUrl(
          "creator/analytics.html"
        );
      },


    settings:
      function () {
        return siteUrl(
          "creator/settings.html"
        );
      }

  };


  /*
   * ==========================================================
   * AUTHENTICATION
   * ==========================================================
   */

  window.CrowRulesAuth = {


    client:
      function () {

        return window.getSupabaseClient();

      },


    /*
     * Get current session.
     */

    async getSession() {

      const c =
        this.client();

      return await c.auth.getSession();

    },


    /*
     * Get authenticated user.
     */

    async getUser() {

      const c =
        this.client();

      return await c.auth.getUser();

    },


    /*
     * Require a logged-in user.
     *
     * Returns:
     *
     * user object
     *
     * or
     *
     * null after redirect.
     */

    async requireUser(options = {}) {

      const {
        redirect = true,
        redirectTo = this.getLoginUrl()
      } = options;


      const {
        data,
        error
      } =
        await this.getSession();


      if (error) {

        console.error(
          "[CrowRules] Authentication error:",
          error
        );


        if (redirect) {

          window.location.replace(
            redirectTo
          );

        }


        return null;
      }


      if (!data || !data.session) {

        if (redirect) {

          window.location.replace(
            redirectTo
          );

        }


        return null;
      }


      return data.session.user;

    },


    /*
     * Optional authentication check.
     */

    async isLoggedIn() {

      try {

        const {
          data
        } =
          await this.getSession();


        return !!(
          data &&
          data.session
        );

      } catch (error) {

        console.error(
          "[CrowRules] isLoggedIn error:",
          error
        );

        return false;

      }

    },


    /*
     * Redirect authenticated user.
     */

    async redirectIfLoggedIn(
      destination
    ) {

      const loggedIn =
        await this.isLoggedIn();


      if (loggedIn) {

        window.location.replace(
          destination ||
          this.getDashboardUrl()
        );

        return true;

      }


      return false;

    },


    /*
     * Sign out.
     */

    async signOut(
      redirect = true
    ) {

      const c =
        this.client();


      const {
        error
      } =
        await c.auth.signOut();


      if (error) {

        console.error(
          "[CrowRules] Sign-out error:",
          error
        );

      }


      if (redirect) {

        window.location.replace(
          this.getLoginUrl()
        );

      }


      return !error;

    },


    /*
     * Navigation helpers.
     */

    getLoginUrl() {

      return (
        window.CrowRulesPaths.login()
      );

    },


    getSignupUrl() {

      return (
        window.CrowRulesPaths.signup()
      );

    },


    getDashboardUrl() {

      return (
        window.CrowRulesPaths.dashboard()
      );

    },


    getUploadEpisodeUrl() {

      return (
        window.CrowRulesPaths.uploadEpisode()
      );

    }

  };


  /*
   * ==========================================================
   * CREATOR HELPERS
   * ==========================================================
   *
   * Centralizes the relationship:
   *
   * auth.users
   *      ↓
   * members
   *      ↓
   * creators
   *      ↓
   * podcasts
   *      ↓
   * podcast_episodes
   */

  window.CrowRulesCreator = {


    /*
     * Get member record for current user.
     */

    async getMember() {

      const c =
        window.getSupabaseClient();


      const {
        data: authData,
        error: authError
      } =
        await c.auth.getUser();


      if (authError) {

        throw authError;

      }


      if (!authData.user) {

        return null;

      }


      const {
        data,
        error
      } =
        await c
          .from("members")
          .select("*")
          .eq(
            "user_id",
            authData.user.id
          )
          .maybeSingle();


      if (error) {

        throw error;

      }


      return data || null;

    },


    /*
     * Get creator record for current user.
     */

    async getCreator() {

      const c =
        window.getSupabaseClient();


      const member =
        await this.getMember();


      if (!member) {

        return null;

      }


      /*
       * Existing CrowRules architecture uses
       * members → creators.
       */

      if (member.creator_id) {

        const {
          data,
          error
        } =
          await c
            .from("creators")
            .select("*")
            .eq(
              "id",
              member.creator_id
            )
            .maybeSingle();


        if (error) {

          throw error;

        }


        return data || null;

      }


      /*
       * Fallback through creator_profiles.
       */

      const {
        data: profile,
        error: profileError
      } =
        await c
          .from("creator_profiles")
          .select("*")
          .eq(
            "user_id",
            member.user_id
          )
          .maybeSingle();


      if (profileError) {

        throw profileError;

      }


      if (
        profile &&
        profile.creator_id
      ) {

        const {
          data,
          error
        } =
          await c
            .from("creators")
            .select("*")
            .eq(
              "id",
              profile.creator_id
            )
            .maybeSingle();


        if (error) {

          throw error;

        }


        return data || null;

      }


      return null;

    },


    /*
     * Get both member and creator.
     */

    async getContext() {

      const member =
        await this.getMember();


      if (!member) {

        return {
          member: null,
          creator: null
        };

      }


      const creator =
        await this.getCreator();


      return {
        member,
        creator
      };

    }

  };


  /*
   * ==========================================================
   * PODCAST HELPERS
   * ==========================================================
   */

  window.CrowRulesPodcast = {


    /*
     * Get podcasts owned by current creator.
     */

    async getMine() {

      const c =
        window.getSupabaseClient();


      const creator =
        await window.CrowRulesCreator
          .getCreator();


      if (!creator) {

        return {
          data: [],
          error: null
        };

      }


      return await c
        .from("podcasts")
        .select("*")
        .eq(
          "creator_id",
          creator.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    },


    /*
     * Get one podcast.
     */

    async getById(id) {

      const c =
        window.getSupabaseClient();


      return await c
        .from("podcasts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    },


    /*
     * Get episodes belonging to a podcast.
     */

    async getEpisodes(podcastId) {

      const c =
        window.getSupabaseClient();


      return await c
        .from("podcast_episodes")
        .select("*")
        .eq(
          "podcast_id",
          podcastId
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    }

  };


  /*
   * ==========================================================
   * STORAGE HELPERS
   * ==========================================================
   */

  window.CrowRulesStorage = {


    /*
     * Upload podcast audio.
     */

    async uploadAudio(
      file,
      path
    ) {

      const c =
        window.getSupabaseClient();


      if (!file) {

        throw new Error(
          "No audio file was selected."
        );

      }


      if (!path) {

        throw new Error(
          "Storage path is required."
        );

      }


      const {
        data,
        error
      } =
        await c.storage
          .from("podcast-audio")
          .upload(
            path,
            file,
            {
              cacheControl: "3600",
              upsert: false
            }
          );


      if (error) {

        throw error;

      }


      return data;

    },


    /*
     * Get public URL.
     */

    getPublicUrl(
      bucket,
      path
    ) {

      const c =
        window.getSupabaseClient();


      return c.storage
        .from(bucket)
        .getPublicUrl(path)
        .data
        .publicUrl;

    },


    /*
     * Delete a storage object.
     */

    async remove(
      bucket,
      paths
    ) {

      const c =
        window.getSupabaseClient();


      const list =
        Array.isArray(paths)
          ? paths
          : [paths];


      return await c.storage
        .from(bucket)
        .remove(list);

    }

  };


  /*
   * ==========================================================
   * DIAGNOSTICS
   * ==========================================================
   */

  window.CrowRulesSupabaseReady =
    !!client;


  window.CrowRulesSupabaseTest =
    async function () {

      try {

        const c =
          window.getSupabaseClient();


        const {
          data,
          error
        } =
          await c.auth.getSession();


        return {

          configured: true,

          initialized: true,

          connected: !error,

          authenticated:
            !!(
              data &&
              data.session
            ),

          user:
            data &&
            data.session
              ? data.session.user
              : null,

          error:
            error || null

        };

      } catch (error) {

        return {

          configured: false,

          initialized: false,

          connected: false,

          authenticated: false,

          user: null,

          error

        };

      }

    };


  /*
   * ==========================================================
   * AUTH STATE LISTENER
   * ==========================================================
   *
   * Pages can optionally listen for:
   *
   * CrowRulesAuthStateChanged
   */

  if (client) {

    client.auth.onAuthStateChange(
      function (
        event,
        session
      ) {

        window.dispatchEvent(
          new CustomEvent(
            "CrowRulesAuthStateChanged",
            {
              detail: {
                event,
                session
              }
            }
          )
        );

      }
    );

  }


  /*
   * ==========================================================
   * FINAL DIAGNOSTIC
   * ==========================================================
   */

  if (client) {

    console.log(
      "[CrowRules] Supabase initialized successfully."
    );

  } else {

    console.warn(
      "[CrowRules] Supabase is NOT initialized."
    );

  }

})();
