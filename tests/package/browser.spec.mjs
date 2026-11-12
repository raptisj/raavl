import { expect, test } from "@playwright/test";

test("the packed library decodes, renders, plays, seeks, and disposes in a production app", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() => window.packageTest?.player.getSnapshot().waveform),
    )
    .toBe("ready");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.packageTest?.reactPlayer?.getSnapshot().waveform,
      ),
    )
    .toBe("ready");
  await expect(page.locator("canvas").first()).toBeVisible();
  const play = page.getByRole("button", { name: "Play audio", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(
    page.getByRole("button", { name: "Pause audio", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.packageTest.reactPlayer.getMediaElement().currentTime,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause audio", exact: true }).click();
  await page.getByRole("slider", { name: "Seek audio", exact: true }).focus();
  await page.keyboard.press("End");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.packageTest.reactPlayer.getMediaElement().currentTime,
      ),
    )
    .toBeGreaterThan(1);
  const disposed = await page.evaluate(() => {
    const { player, reactPlayer, dispose } = window.packageTest;
    dispose();
    return [player.getSnapshot().source, reactPlayer.getSnapshot().source];
  });
  expect(disposed).toEqual(["disposed", "disposed"]);
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(await page.evaluate(() => window.packageTest.errors)).toEqual([]);
  expect(errors).toEqual([]);
});

test("keeps zoom scrolling inside AudioPlayer and clears it on Fit", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () => window.packageTest?.reactView?.getViewport().duration,
      ),
    )
    .toBeGreaterThan(0);
  const waveform = page.locator("#react .raavl-waveform");
  const fitWidth = await waveform.evaluate((element) => element.clientWidth);
  await page.evaluate(() => {
    window.packageTest.reactView.update({ viewport: { zoom: 1200 } });
  });
  await expect
    .poll(() => waveform.evaluate((element) => element.scrollWidth))
    .toBeGreaterThan(fitWidth);
  expect(await waveform.evaluate((element) => element.clientWidth)).toBe(
    fitWidth,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await waveform.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect
    .poll(() =>
      waveform
        .locator("canvas")
        .first()
        .evaluate((canvas) => parseFloat(canvas.style.left)),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    window.packageTest.reactView.update({ viewport: { zoom: "fit" } });
  });
  await expect
    .poll(() =>
      waveform.evaluate((element) => [element.scrollLeft, element.scrollWidth]),
    )
    .toEqual([0, fitWidth]);
});

test("mute and full-track loop change icons and support keyboard activation in React and JavaScript", async ({ page }) => {
  await page.goto("/?toggles");
  for (const id of ["vanilla", "react"]) {
    const controls = page.locator(`#${id}`);
    const mute = controls.getByRole("button", { name: "Mute audio", exact: true });
    const unmute = controls.getByRole("button", { name: "Unmute audio", exact: true });
    const loop = controls.getByRole("button", { name: "Loop audio", exact: true });
    for (const toggle of [mute, loop]) {
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveText("");
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(toggle.locator("svg")).toHaveAttribute("aria-hidden", "true");
    }
    const unmutedPath = await mute.locator("path").getAttribute("d");
    const loopOffPath = await loop.locator("path").getAttribute("d");

    await mute.press("Space");
    await expect(unmute).toBeFocused();
    await expect(unmute).toHaveAttribute("aria-pressed", "true");
    await expect(unmute.locator("path")).not.toHaveAttribute("d", unmutedPath);
    await unmute.press("Enter");
    await expect(mute).toHaveAttribute("aria-pressed", "false");
    await expect(mute.locator("path")).toHaveAttribute("d", unmutedPath);

    await loop.press("Enter");
    await expect(loop).toHaveAttribute("aria-pressed", "true");
    await expect(loop.locator("path")).not.toHaveAttribute("d", loopOffPath);
    await loop.press("Space");
    await expect(loop).toHaveAttribute("aria-pressed", "false");
    await expect(loop.locator("path")).toHaveAttribute("d", loopOffPath);
  }
});

test.describe("touch waveform", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("uses the compact strip and the same picker for all regions and an overlap", async ({
    page,
  }) => {
    await page.goto("/?overlaps=30");
    const player = page.locator("#react");
    const browse = player.getByRole("button", {
      name: "Regions (30)",
      exact: true,
    });
    const picker = player.locator(".raavl-annotation-picker");
    const rows = picker.locator("[data-row-id]");
    const search = picker.getByRole("searchbox", {
      name: "Search annotations by label or time",
    });
    const time = () =>
      page.evaluate(() => window.packageTest.reactPlayer.getCurrentTime());
    await expect(browse).toBeVisible();
    await expect(rows).toHaveCount(0);
    await browse.tap();
    await expect(rows).toHaveCount(30);
    await expect(rows.first()).toHaveAttribute("data-row-id", "intro");
    expect(
      await picker
        .locator("ul")
        .evaluate((list) => list.scrollHeight > list.clientHeight),
    ).toBe(true);
    await search.fill("GUITAR");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-row-id", "guitar");
    await search.fill("0.45");
    await expect(rows).toHaveCount(3);
    await search.fill("0:00.45");
    await expect(rows).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(browse).toBeFocused();
    await expect(picker).toBeHidden();
    await browse.tap();
    await expect(search).toHaveValue("");
    const close = picker.getByRole("button", {
      name: "Close annotation picker",
    });
    await expect(close).toHaveText("×");
    await close.tap();
    await expect(picker).toBeHidden();

    const chip = player.getByRole("button", { name: /^3 overlapping regions/ });
    await chip.tap();
    await expect(rows).toHaveCount(3);
    expect(
      await rows.evaluateAll((buttons) =>
        buttons.map((button) => button.dataset.rowId),
      ),
    ).toEqual(["intro", "guitar", "vocal"]);
    expect(await time()).toBe(0);
    await search.fill("Region 30");
    await expect(rows).toHaveCount(0);
    await expect(picker.getByText("No matches.")).toBeVisible();
    await picker.getByRole("button", { name: "Show all 30" }).tap();
    await expect(search).toHaveValue("Region 30");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveText(/^Region 30 ·/);
    await search.clear();
    await expect(rows).toHaveCount(30);
    await chip.tap();
    await expect(rows).toHaveCount(3);
    await picker.getByRole("button", { name: /^Guitar melody/ }).tap();
    await expect(picker).toBeHidden();
    const guitar = player.locator(
      '.raavl-region[data-raavl-annotation="guitar"]',
    );
    const intro = player.locator(
      '.raavl-region[data-raavl-annotation="intro"]',
    );
    await expect(guitar).toHaveAttribute("data-selected", "true");
    await expect(guitar).toHaveCSS("z-index", "1");
    await expect(guitar).toHaveCSS("opacity", "1");
    await expect(intro).toHaveCSS("opacity", "0.25");
    const editor = player.getByRole("group", { name: /^Edit Guitar melody/ });
    await expect(editor.getByRole("textbox", { name: "Label" })).toBeFocused();
    const playRegion = editor.getByRole("button", {
      name: "Play region",
      exact: true,
    });
    await expect(playRegion).toBeEnabled();
    const apply = editor.getByRole("button", { name: "Apply edit" });
    const primary = player
      .getByRole("group", { name: "Playback controls" })
      .getByRole("button", { name: "Play audio", exact: true });
    const primaryColor = await primary.evaluate(
      (button) => getComputedStyle(button).backgroundColor,
    );
    await expect(apply).toHaveCSS("background-color", primaryColor);
    await expect(
      editor.getByRole("button", { name: "Delete annotation" }),
    ).not.toHaveCSS("background-color", primaryColor);
    expect(
      await apply.evaluate((button) =>
        Math.abs(
          button.getBoundingClientRect().right -
            button.closest(".raavl-annotation-actions").getBoundingClientRect()
              .right,
        ),
      ),
    ).toBeLessThan(1);
    const playBounds = await playRegion.boundingBox();
    const saveBounds = await apply.boundingBox();
    expect(playBounds.y).toBeCloseTo(saveBounds.y);
    expect(saveBounds.x - (playBounds.x + playBounds.width)).toBeCloseTo(6);
    await editor.getByRole("button", { name: "Cancel edit" }).tap();
    await expect(intro).toHaveCSS("opacity", "1");
    const badge = player.locator(".raavl-annotation-selected-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toBeFocused();
    await badge.tap();
    await expect(intro).toHaveCSS("opacity", "0.25");
    expect(await time()).toBe(0);
  });

  test("keeps Play region immediately before Save in the modal editor", async ({
    page,
  }) => {
    await page.goto("/?annotations&modal");
    const player = page.locator("#react");
    const primary = player
      .getByRole("group", { name: "Playback controls" })
      .getByRole("button", { name: "Play audio", exact: true });
    const primaryColor = await primary.evaluate(
      (button) => getComputedStyle(button).backgroundColor,
    );
    await player
      .getByRole("button", { name: "Intro · 0.30–0.65s", exact: true })
      .tap();

    const dialog = player.getByRole("dialog", { name: "Edit Intro" });
    const playRegion = dialog.getByRole("button", {
      name: "Play region",
      exact: true,
    });
    const save = dialog.getByRole("button", { name: "Apply edit" });
    await expect(save).toHaveCSS("background-color", primaryColor);
    const playBounds = await playRegion.boundingBox();
    const saveBounds = await save.boundingBox();
    expect(playBounds.y).toBeCloseTo(saveBounds.y);
    expect(saveBounds.x - playBounds.x - playBounds.width).toBeCloseTo(6);
    expect(
      await save.evaluate((button) =>
        Math.abs(
          button.getBoundingClientRect().right -
            button.closest(".raavl-annotation-actions").getBoundingClientRect()
              .right,
        ),
      ),
    ).toBeLessThan(1);

    await playRegion.tap();
    await expect
      .poll(() =>
        page.evaluate(() => window.packageTest.reactPlayer.getCurrentTime()),
      )
      .toBeCloseTo(0.65);
    await expect(dialog).toBeVisible();
  });

  test("truncates badge text at 200px and collapses the row when badges no longer fit", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 750, height: 844 });
    await page.goto("/?overlaps=3");
    const player = page.locator("#react");
    const inlineRow = player.locator(".raavl-annotation-badge-row");
    const browse = player.getByRole("button", {
      name: "Regions (3)",
      exact: true,
    });
    await expect(inlineRow).toBeVisible();
    await expect(inlineRow.getByRole("button")).toHaveCount(3);
    await expect(browse).toBeHidden();
    const intro =
      /^Introduction and opening phrase with extended instrumentation/;
    const inlineText = inlineRow
      .getByRole("button", { name: intro })
      .locator(".raavl-annotation-badge-text");
    await expect(inlineText).toHaveCSS("width", "200px");
    await expect(inlineText).toHaveCSS("text-overflow", "ellipsis");
    expect(
      await inlineText.evaluate((text) => text.scrollWidth > text.clientWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 320, height: 844 });
    await expect(browse).toBeVisible();
    await expect(inlineRow).toBeHidden();
    await expect(browse).toHaveCSS("min-height", "44px");
    await browse.tap();
    await player
      .locator(".raavl-annotation-picker")
      .getByRole("button", { name: intro })
      .tap();
    await player.getByRole("button", { name: "Cancel edit" }).tap();
    const selectedText = player
      .getByRole("button", { name: intro })
      .locator(".raavl-annotation-badge-text");
    await expect(selectedText).toHaveCSS("max-inline-size", "200px");
    await expect(selectedText).toHaveCSS("text-overflow", "ellipsis");
    expect(
      await selectedText.evaluate(
        (text) => text.scrollWidth > text.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
    await page.setViewportSize({ width: 750, height: 844 });
    await expect(browse).toBeHidden();
    await expect(inlineRow).toBeVisible();
  });

  test("pinches around the fingers without zooming the page or seeking", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    const viewport = () =>
      page.evaluate(() => window.packageTest?.reactView?.getViewport());
    await expect.poll(async () => (await viewport())?.duration).toBe(2);
    const waveform = page.locator("#react .raavl-waveform");
    const bounds = await waveform.boundingBox();
    const x = Math.round(bounds.x + bounds.width / 2);
    const y = Math.round(bounds.y + bounds.height / 2);
    const cdp = await context.newCDPSession(page);
    const touch = (type, ...xs) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: xs.map((x, id) => ({ x, y, id })),
      });

    const initial = await viewport();
    await touch("touchStart", x - 40);
    await touch("touchStart", x - 40, x + 40);
    await touch("touchMove", x - 60, x + 100);
    await expect
      .poll(async () => (await viewport()).pixelsPerSecond)
      .toBeCloseTo(initial.pixelsPerSecond * 2);
    const zoomed = await viewport();
    expect(
      zoomed.start + (x + 20 - bounds.x) / zoomed.pixelsPerSecond,
    ).toBeCloseTo((x - bounds.x) / initial.pixelsPerSecond);
    await touch("touchEnd");

    await touch("touchStart", x - 80, x + 80);
    await touch("touchMove", x - 30, x + 30);
    await touch("touchEnd");
    await expect.poll(async () => (await viewport()).end).toBe(2);
    expect((await viewport()).start).toBe(0);
    expect(await page.evaluate(() => window.visualViewport.scale)).toBe(1);
    const playbackTime = () =>
      page.evaluate(() => window.packageTest.reactPlayer.getCurrentTime());
    expect(await playbackTime()).toBe(0);
    await page.touchscreen.tap(x, y);
    await expect.poll(playbackTime).toBeCloseTo(1);

    await page.setViewportSize({ width: 320, height: 844 });
    await expect
      .poll(async () => (await viewport()).width)
      .toBeLessThan(initial.width);
    expect((await viewport()).end).toBe(2);
  });

  for (const { name, fromRegion, deltaX, deltaY } of [
    {
      name: "scrolls the page from a region body",
      fromRegion: true,
      deltaX: 0,
      deltaY: -60,
    },
    {
      name: "pans the waveform from a region body",
      fromRegion: true,
      deltaX: -100,
      deltaY: 0,
    },
    {
      name: "pans the waveform from its background",
      fromRegion: false,
      deltaX: -100,
      deltaY: 0,
    },
  ]) {
    test(name, async ({ page, context }) => {
      await page.goto("/?annotations");
      const viewport = () =>
        page.evaluate(() => window.packageTest?.reactView?.getViewport());
      await expect.poll(async () => (await viewport())?.duration).toBe(2);
      await page.evaluate(() => {
        document.body.style.minHeight = "1600px";
        window.packageTest.reactView.update({ viewport: { zoom: 480 } });
      });
      await expect
        .poll(async () => (await viewport()).pixelsPerSecond)
        .toBe(480);
      const waveform = page.locator("#react .raavl-waveform");
      const region = waveform.locator(".raavl-region-body");
      const bounds = await waveform.boundingBox();
      const regionBounds = await region.boundingBox();
      const x = Math.round(
        fromRegion
          ? regionBounds.x + regionBounds.width / 2
          : (regionBounds.x + regionBounds.width + bounds.x + bounds.width) / 2,
      );
      const y = Math.round(bounds.y + bounds.height / 2);
      await expect
        .poll(() =>
          waveform.evaluate(
            (element, point) => {
              const target = document.elementFromPoint(point.x, point.y);
              if (!element.contains(target)) return null;
              if (target.closest(".raavl-region-body")) return "region";
              return target.closest(".raavl-region") ? null : "background";
            },
            { x, y },
          ),
        )
        .toBe(fromRegion ? "region" : "background");
      const cdp = await context.newCDPSession(page);
      const touch = (type, point) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: point ? [point] : [],
        });

      await touch("touchStart", { x, y });
      for (let step = 1; step <= 5; step++) {
        const progress = step / 5;
        await touch("touchMove", {
          x: x + deltaX * progress,
          y: y + deltaY * progress,
        });
      }
      await touch("touchEnd");

      if (deltaY) {
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(0);
      } else {
        await expect
          .poll(async () => (await viewport()).start)
          .toBeGreaterThan(0);
      }
      expect(
        await page.evaluate(() => window.packageTest.reactView.getSelection()),
      ).toBeNull();
      expect(
        await page.evaluate(() =>
          window.packageTest.reactPlayer.getCurrentTime(),
        ),
      ).toBe(0);
      await expect(
        page.getByRole("button", { name: "Intro · 0.30–0.65s" }),
      ).toBeVisible();
    });
  }

  async function openDraftAtPlayhead(page) {
    await page.goto("/?annotations");
    const waveform = page.locator("#react .raavl-waveform");
    const viewport = () =>
      page.evaluate(() => window.packageTest?.reactView?.getViewport());
    const selection = () =>
      page.evaluate(() => window.packageTest.reactView.getSelection());
    const time = () =>
      page.evaluate(() => window.packageTest.reactPlayer.getCurrentTime());
    const create = page.getByRole("button", {
      name: "Create region at playhead",
    });
    await expect(create).toBeEnabled();
    await page.evaluate(() =>
      window.packageTest.reactView.update({ viewport: { zoom: "fit" } }),
    );
    await expect.poll(async () => (await viewport()).end).toBe(2);
    const { pixelsPerSecond } = await viewport();
    const bounds = await waveform.boundingBox();
    const tapX = Math.round(bounds.x + 0.8 * pixelsPerSecond);
    await page.touchscreen.tap(tapX, Math.round(bounds.y + bounds.height / 2));
    await expect.poll(time).toBeCloseTo(0.8, 1);
    const playhead = await time();
    await create.tap();
    await expect.poll(async () => (await selection())?.start).toBe(playhead);
    return { waveform, selection, playhead, pixelsPerSecond };
  }

  test("creates and saves a region using touch buttons", async ({ page }) => {
    const { selection, playhead } = await openDraftAtPlayhead(page);
    const draft = page.getByRole("group", { name: "New region" });
    const previousEnd = (await selection()).end;
    await draft
      .getByRole("button", { name: "Increase start by 0.1 seconds" })
      .tap();
    await expect
      .poll(async () => (await selection())?.start)
      .toBeCloseTo(playhead + 0.1);
    await draft
      .getByRole("button", { name: "Decrease end by 0.1 seconds" })
      .tap();
    await expect
      .poll(async () => (await selection())?.end)
      .toBeCloseTo(previousEnd - 0.1);
    await expect(
      draft.getByRole("spinbutton", { name: "End (seconds)" }),
    ).not.toBeFocused();
    await draft
      .getByRole("button", { name: "Create region from selection" })
      .tap();
    await expect(
      page.getByRole("button", { name: /New annotation.*seconds/ }).first(),
    ).toBeVisible();
    expect(await selection()).toBeNull();
  });

  test("resizes a region draft using a touch handle", async ({ page, context }) => {
    const { waveform, selection, playhead, pixelsPerSecond } =
      await openDraftAtPlayhead(page);
    const previousEnd = (await selection()).end;
    const handle = await waveform
      .locator(".raavl-selection-handle-start")
      .boundingBox();
    const x = Math.round(handle.x + handle.width / 2);
    const y = Math.round(handle.y + handle.height / 2);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - Math.round(pixelsPerSecond * 0.1), y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => (await selection())?.start)
      .toBeCloseTo(playhead - 0.1);
    expect((await selection()).end).toBe(previousEnd);
  });
});
