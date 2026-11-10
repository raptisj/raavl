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
