// Run with playwright-cli run-code --filename=scripts/g5a-browser-flow.js.
// The session must be loaded from scripts/g5a-browser-session.mjs first.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- CLI evaluates a function expression.
async (page) => {
  if (!page.url().startsWith("http://localhost:3055/")) throw new Error("Local G5A app only");
  const title = "Finatext 지원동기 완성 · G5A browser";
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("http://localhost:3055/inbox");
  await page.getByRole("textbox", { name: "내용", exact: true }).fill(`할 일: ${title}`);
  await page.getByRole("button", { name: "JARVIS에 전달" }).click();
  await page.getByText(title, { exact: true }).waitFor();
  await page.screenshot({ path: "test-results/g5a-mobile-inbox.png", fullPage: true });
  const context = await page.context().browser().newContext({
    storageState: await page.context().storageState(), viewport: { width: 1440, height: 1000 },
  });
  const desktop = await context.newPage();
  desktop.on("pageerror", (e) => failures.push(e.message));
  await desktop.goto("http://localhost:3055/approvals");
  await desktop.getByText(`할 일 추가: ${title}`, { exact: true }).waitFor();
  await desktop.getByRole("button", { name: "승인하고 실행", exact: true }).click();
  await desktop.getByText("실행 완료", { exact: true }).waitFor();
  await desktop.screenshot({ path: "test-results/g5a-desktop-approvals.png", fullPage: true });
  const jobs = [];
  for (const route of ["process-system-events", "process-approved-actions", "generate-command-brief"]) {
    const result = await desktop.request.post(`http://localhost:3055/api/jobs/${route}`, {
      headers: { "x-cron-secret": "g5a-local-test-only" },
    });
    if (result.status() !== 200) throw new Error(`${route}: ${result.status()} ${await result.text()}`);
    jobs.push({ route, status: result.status(), body: await result.json() });
  }
  await page.goto("http://localhost:3055/tasks");
  await page.getByText(title, { exact: true }).waitFor();
  const layouts = [];
  for (const [target, width] of [[page, 375], [desktop, 1440]]) {
    for (const route of ["inbox", "approvals", "today"]) {
      await target.goto(`http://localhost:3055/${route}`);
      await target.locator("main h1").waitFor();
      await target.getByText(route === "approvals" ? `할 일 추가: ${title}` : title, { exact: true }).first().waitFor();
      const overflow = await target.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error(`${route} overflows at ${width}px`);
      layouts.push({ route, width, overflow });
    }
  }
  await page.screenshot({ path: "test-results/g5a-mobile-today.png", fullPage: true });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: "test-results/g5a-mobile-today-dark.png", fullPage: true });
  await context.close();
  if (failures.length) throw new Error(JSON.stringify(failures));
  return { title, capture: "375px browser", approval: "separate 1440px browser context", jobs, layouts, pageErrors: failures };
}
