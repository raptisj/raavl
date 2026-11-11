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

test.describe("touch waveform", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
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
    await expect.poll(async () => (await viewport()).width).toBeLessThan(initial.width);
    expect((await viewport()).end).toBe(2);
  });
});
