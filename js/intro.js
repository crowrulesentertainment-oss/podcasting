(() => {
  "use strict";

  /*
   * CrowRules Podcasting
   * 3-Scene Cinematic Intro
   *
   * Scene 1:
   * YOUR VOICE
   *
   * Scene 2:
   * CREATE YOUR PODCAST
   *
   * Scene 3:
   * YOUR UNIVERSE
   *
   * After Scene 3:
   * launch.html
   */

  const intro =
    document.getElementById("intro");

  const progressBar =
    document.getElementById("progressBar");

  const status =
    document.getElementById("status");

  const skipButton =
    document.getElementById("skipIntro");

  const scenes = [
    document.getElementById("scene1"),
    document.getElementById("scene2"),
    document.getElementById("scene3")
  ];

  const dots = [
    ...document.querySelectorAll(".scene-dot")
  ];

  /*
   * Timing
   *
   * Scene 1: 5 seconds
   * Scene 2: 5 seconds
   * Scene 3: 6 seconds
   *
   * Total: 16 seconds
   */

  const sceneDurations = [
    5000,
    5000,
    6000
  ];

  const totalDuration =
    sceneDurations.reduce(
      (total, duration) =>
        total + duration,
      0
    );

  const sceneStatuses = [
    "FINDING YOUR VOICE",
    "CREATING YOUR SHOW",
    "ENTERING THE UNIVERSE"
  ];

  let currentScene = 0;

  let startedAt = 0;

  let frameId = null;

  let finishing = false;

  /* =======================================================
     ACTIVATE SCENE
  ======================================================= */

  function activateScene(index) {

    scenes.forEach(
      (scene, sceneIndex) => {

        scene.classList.remove(
          "active"
        );

        scene.classList.remove(
          "leaving"
        );

        scene.setAttribute(
          "aria-hidden",
          sceneIndex === index
            ? "false"
            : "true"
        );

        if (sceneIndex < index) {

          scene.classList.add(
            "leaving"
          );
        }
      }
    );

    scenes[index].classList.add(
      "active"
    );

    dots.forEach(
      (dot, dotIndex) => {

        dot.classList.toggle(
          "active",
          dotIndex === index
        );
      }
    );

    status.textContent =
      sceneStatuses[index];

    currentScene = index;
  }

  /* =======================================================
     FIND SCENE
  ======================================================= */

  function findScene(elapsed) {

    let accumulated = 0;

    for (
      let i = 0;
      i < sceneDurations.length;
      i++
    ) {

      accumulated +=
        sceneDurations[i];

      if (
        elapsed < accumulated
      ) {
        return i;
      }
    }

    return sceneDurations.length - 1;
  }

  /* =======================================================
     UPDATE
  ======================================================= */

  function update(timestamp) {

    if (finishing) {
      return;
    }

    const elapsed =
      timestamp - startedAt;

    const percentage =
      Math.min(
        100,
        (
          elapsed /
          totalDuration
        ) * 100
      );

    progressBar.style.width =
      `${percentage}%`;

    const nextScene =
      findScene(elapsed);

    if (
      nextScene !== currentScene
    ) {

      activateScene(
        nextScene
      );
    }

    if (
      elapsed >= totalDuration
    ) {

      finishIntro();

      return;
    }

    frameId =
      requestAnimationFrame(
        update
      );
  }

  /* =======================================================
     FINISH
  ======================================================= */

  function finishIntro() {

    if (finishing) {
      return;
    }

    finishing = true;

    if (frameId !== null) {

      cancelAnimationFrame(
        frameId
      );
    }

    progressBar.style.width =
      "100%";

    status.textContent =
      "WELCOME TO CROW RULES PODCASTING";

    intro.classList.add(
      "finishing"
    );

    /*
     * Give the final scene a brief
     * cinematic fade before navigation.
     */

    window.setTimeout(
      () => {

        window.location.replace(
          "launch.html"
        );

      },
      1100
    );
  }

  /* =======================================================
     SKIP
  ======================================================= */

  function skipIntro() {

    if (finishing) {
      return;
    }

    finishIntro();
  }

  /* =======================================================
     KEYBOARD
  ======================================================= */

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape"
      ) {

        skipIntro();
      }

    }
  );

  /* =======================================================
     SKIP BUTTON
  ======================================================= */

  skipButton.addEventListener(
    "click",
    skipIntro
  );

  /* =======================================================
     REDUCED MOTION
  ======================================================= */

  const prefersReducedMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

  if (
    prefersReducedMotion
  ) {

    /*
     * Keep the experience accessible:
     * show the final scene briefly,
     * then continue to launch.html.
     */

    activateScene(2);

    progressBar.style.width =
      "100%";

    window.setTimeout(
      finishIntro,
      800
    );

    return;
  }

  /* =======================================================
     START
  ======================================================= */

  activateScene(0);

  startedAt =
    performance.now();

  frameId =
    requestAnimationFrame(
      update
    );

})();
