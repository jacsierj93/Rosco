import { expect, test, type BrowserContext, type Page } from "@playwright/test";

interface PersistedQuestion {
  answer: string;
  correctOptionId: string;
  options: Array<{ id: string; label: string }>;
}

interface PersistedGame {
  game: {
    difficulty: string;
    phase: string;
    sequence: number;
    activeClock: { playerId: string; startedAtMs: number } | null;
    currentPlayerIndex: number;
    players: Array<{
      remainingMs: number;
      cursor: number;
      questions: PersistedQuestion[];
    }>;
  };
}

async function displaySession(display: Page) {
  await expect(display.getByText("Código de sala")).toBeVisible();
  return display.evaluate(() => {
    const raw = localStorage.getItem("rosco.displayCredential.v1");
    if (!raw) throw new Error("No display session");
    return JSON.parse(raw) as { code: string; controlToken: string };
  });
}

async function connectControl(context: BrowserContext, display: Page): Promise<{ control: Page; url: string }> {
  await display.setViewportSize({ width: 1440, height: 900 });
  const session = await displaySession(display);
  const url = `/control/${session.code}?token=${encodeURIComponent(session.controlToken)}`;
  const control = await context.newPage();
  await control.setViewportSize({ width: 390, height: 844 });
  await control.goto(url);
  await expect(control.getByRole("heading", { name: "Armemos el rosco." })).toBeVisible();
  return { control, url };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function configure(control: Page, options: { players?: string[]; duration?: number; difficulty?: "Niños" | "Fácil" | "Intermedio" | "Avanzado" } = {}) {
  await control.getByRole("button", { name: "Teocrático" }).click();
  if (options.difficulty) await control.getByRole("button", { name: options.difficulty, exact: true }).click();
  const names = options.players ?? ["Ana"];
  await control.getByLabel("Nombre del jugador 1").fill(names[0] ?? "Ana");
  for (const [index, name] of names.slice(1).entries()) {
    await control.getByRole("button", { name: "Agregar jugador" }).click();
    await control.getByLabel(`Nombre del jugador ${index + 2}`).fill(name);
  }
  if (options.duration) {
    await control.getByRole("slider", { name: /Tiempo por jugador/ }).fill(String(options.duration));
  }
  await control.getByRole("button", { name: "Preparar partida" }).click();
  await expect(control.getByRole("button", { name: "Iniciar turno" })).toBeVisible();
}

async function persisted(display: Page): Promise<PersistedGame> {
  await expect.poll(() => display.evaluate(() => Boolean(localStorage.getItem("rosco.activeGame.v1")))).toBe(true);
  return display.evaluate(() => JSON.parse(localStorage.getItem("rosco.activeGame.v1") ?? "null") as PersistedGame);
}

async function chooseCorrect(display: Page, control: Page) {
  await control.getByRole("button", { name: "Correcto", exact: true }).click();
}

async function chooseIncorrect(display: Page, control: Page) {
  await control.getByRole("button", { name: "Incorrecto", exact: true }).click();
}

test("vincula el control mediante código y token ingresados manualmente", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const session = await displaySession(display);
  const control = await context.newPage();
  await control.setViewportSize({ width: 390, height: 844 });
  await control.goto("/control");
  await control.getByLabel("Código de sala").fill(session.code);
  await control.getByLabel("Token de acceso").fill(session.controlToken);
  await control.getByRole("button", { name: "Conectar" }).click();
  await expect(control.getByRole("heading", { name: "Armemos el rosco." })).toBeVisible();
  await expect(display.getByText("Control conectado")).toBeVisible();
  await expectNoHorizontalOverflow(control);
  await context.close();
});

test("vincula TV y teléfono, configura una partida JW y recorre correcta, error y pasapalabra", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const { control } = await connectControl(context, display);
  await configure(control, { players: ["Ana", "Luis"] });
  await expectNoHorizontalOverflow(display);
  await expectNoHorizontalOverflow(control);

  await expect(display.getByRole("heading", { name: "Ana" })).toBeVisible();
  await control.getByRole("button", { name: "Iniciar turno" }).click();
  await expect(display.getByText(/Empieza con|Contiene/).first()).toBeVisible();
  await chooseCorrect(display, control);
  await expect(display.locator(".game-topbar").getByText("1", { exact: true })).toBeVisible();

  await chooseIncorrect(display, control);
  await expect(display.getByText("Respuesta correcta")).toBeVisible();
  await expect(control.getByText("Mostrando la respuesta correcta…")).toBeVisible();
  await expect(control.getByRole("button", { name: "Iniciar turno" })).toBeVisible({ timeout: 4_000 });
  await control.getByRole("button", { name: "Iniciar turno" }).click();
  await control.getByRole("button", { name: "Pasapalabra" }).click();
  await expect(control.getByRole("button", { name: "Iniciar turno" })).toBeVisible();
  await context.close();
});

test("configura y comienza un rosco JW para niños", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const { control } = await connectControl(context, display);
  await configure(control, { difficulty: "Niños" });

  const state = await persisted(display);
  expect(state.game.difficulty).toBe("infantil");
  expect(state.game.players[0]?.questions).toHaveLength(25);
  await control.getByRole("button", { name: "Iniciar turno" }).click();
  await expect(display.locator(".clue-panel h1")).toBeVisible();
  await expect(control.locator(".control-answer strong")).toBeVisible();
  await context.close();
});

test("salir desde el control devuelve ambos dispositivos a sus menús", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const { control } = await connectControl(context, display);
  await configure(control);

  control.once("dialog", (dialog) => dialog.accept());
  await control.getByRole("button", { name: "Salir al menú" }).click();

  await expect(display.getByText("Código de sala")).toBeVisible();
  await expect(control.getByRole("heading", { name: "Armemos el rosco." })).toBeVisible();
  await context.close();
});

test("marca una palabra difícil para revisión editorial", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const { control } = await connectControl(context, display);
  await configure(control);
  await control.getByRole("button", { name: "Iniciar turno" }).click();

  await control.getByRole("button", { name: "Marcar palabra o pista" }).click();
  await control.getByRole("button", { name: "Palabra demasiado difícil" }).click();

  await expect(control.getByText("Marcada para revisión editorial")).toBeVisible();
  await expect.poll(() => display.evaluate(() => {
    const reports = JSON.parse(localStorage.getItem("rosco.contentFeedback.v1") ?? "[]") as Array<{ reason?: string }>;
    return reports.at(-1)?.reason;
  })).toBe("word_difficult");
  await context.close();
});

test("pausa al desconectar, recupera la TV y reanuda desde el control", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const connected = await connectControl(context, display);
  await configure(connected.control);
  await connected.control.getByRole("button", { name: "Iniciar turno" }).click();

  const emergency = connected.control.getByRole("button", { name: "Pausa de emergencia; mantener presionado" });
  await emergency.click();
  await expect(connected.control.getByRole("button", { name: "Pasapalabra" })).toBeVisible();
  const box = await emergency.boundingBox();
  if (!box) throw new Error("Emergency button is not visible");
  await connected.control.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await connected.control.mouse.down();
  await connected.control.waitForTimeout(1_000);
  await connected.control.mouse.up();
  await expect(connected.control.getByRole("button", { name: "Reanudar" })).toBeVisible();
  await connected.control.getByRole("button", { name: "Reanudar" }).click();
  await expect(connected.control.getByRole("button", { name: "Pasapalabra" })).toBeVisible();

  await connected.control.close();
  await expect(display.getByText("Control desconectado · La partida fue pausada")).toBeVisible();

  const control = await context.newPage();
  await control.goto(connected.url);
  await expect(control.getByRole("button", { name: "Reanudar" })).toBeVisible();
  await control.getByRole("button", { name: "Reanudar" }).click();
  await expect(control.getByRole("button", { name: "Pasapalabra" })).toBeVisible();

  await display.reload();
  await expect(control.getByRole("button", { name: "Reanudar" })).toBeVisible();
  await control.getByRole("button", { name: "Reanudar" }).click();
  await expect(display.getByText(/Empieza con|Contiene/).first()).toBeVisible();
  await context.close();
});

test("agota el tiempo, muestra resultados y prepara una revancha", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.clock.install();
  await display.goto("/juego");
  const { control } = await connectControl(context, display);
  await configure(control, { duration: 30 });
  await control.getByRole("button", { name: "Iniciar turno" }).click();
  await display.clock.fastForward(30_100);
  await expect(display.getByText("Resultado final")).toBeVisible();
  await expect(control.getByRole("button", { name: "Jugar revancha" })).toBeVisible();
  await control.getByRole("button", { name: "Jugar revancha" }).click();
  await expect(control.getByRole("button", { name: "Iniciar turno" })).toBeVisible();
  await context.close();
});

test("resuelve una respuesta en revisión antes de cerrar resultados", async ({ browser }) => {
  const context = await browser.newContext();
  const display = await context.newPage();
  await display.goto("/juego");
  const { control } = await connectControl(context, display);
  await configure(control);
  await control.getByRole("button", { name: "Iniciar turno" }).click();
  await control.getByRole("button", { name: "Revisión", exact: true }).click();

  for (let index = 0; index < 24; index += 1) await chooseCorrect(display, control);

  await expect(display.getByText(/Revisión · Ana/)).toBeVisible();
  await expect(control.getByRole("button", { name: "Correcta", exact: true })).toBeVisible();
  await control.getByRole("button", { name: "Correcta", exact: true }).click();
  await expect(display.getByText("Resultado final")).toBeVisible();
  await expect(display.getByText("25", { exact: true })).toBeVisible();
  await display.locator(".results-review summary").filter({ hasText: "Ana" }).click();
  const firstSource = display.locator(".results-review__questions a").first();
  await expect(firstSource).toBeVisible();
  await expect(firstSource).toHaveAttribute("href", /^https:\/\/www\.jw\.org\//);
  await context.close();
});
