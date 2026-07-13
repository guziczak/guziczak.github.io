#!/usr/bin/env node

import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const PUBLIC_DIR = join(REPO_ROOT, "public");
const OUTPUT_DIR = join(REPO_ROOT, "output", "pdf");
const TEMP_ROOT = join(REPO_ROOT, "tmp", "pdfs");

const CVS = [
  { language: "en", source: "cv-html/cv_fixed.html", output: "cv_en.pdf" },
  { language: "pl", source: "cv-html/cv_fixed_pl.html", output: "cv_pl.pdf" },
  { language: "de", source: "cv-html/cv_fixed_de.html", output: "cv_de.pdf" },
];

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const argv = process.argv.slice(2);
const publish = argv.includes("--publish");
const help = argv.includes("--help") || argv.includes("-h");
const unknownArgs = argv.filter(
  (argument) => !["--publish", "--help", "-h"].includes(argument),
);

if (help) {
  console.log(
    `Usage: npm run cv:pdf -- [--publish]\n\nOptions:\n  --publish  Also copy the generated PDFs to public/ and the repository root.\n  --help     Show this help.`,
  );
  process.exit(0);
}

if (unknownArgs.length > 0) {
  throw new Error(
    `Unknown option${unknownArgs.length === 1 ? "" : "s"}: ${unknownArgs.join(", ")}`,
  );
}

if (typeof WebSocket !== "function") {
  throw new Error(
    "This generator requires Node.js 22 or newer (the built-in WebSocket client is unavailable).",
  );
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  const lookupCommand = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(lookupCommand, [command], {
    shell: false,
    stdio: "ignore",
    timeout: 3_000,
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

async function detectChrome() {
  const explicitPath = process.env.CHROME_PATH?.trim();
  if (explicitPath) {
    if (isAbsolute(explicitPath)) {
      if (!(await fileExists(explicitPath))) {
        throw new Error(`CHROME_PATH does not exist: ${explicitPath}`);
      }
      return explicitPath;
    }
    if (!commandExists(explicitPath))
      throw new Error(`CHROME_PATH is not available on PATH: ${explicitPath}`);
    return explicitPath;
  }

  const pathCandidates = [];
  const commandCandidates = [];
  if (process.platform === "win32") {
    for (const baseDirectory of [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ]) {
      if (baseDirectory) {
        pathCandidates.push(
          join(baseDirectory, "Google", "Chrome", "Application", "chrome.exe"),
        );
      }
    }
    commandCandidates.push("chrome.exe", "chrome");
  } else if (process.platform === "darwin") {
    pathCandidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
    commandCandidates.push("google-chrome", "chromium");
  } else {
    pathCandidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    );
    commandCandidates.push(
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
    );
  }

  for (const candidate of pathCandidates) {
    if (await fileExists(candidate)) return candidate;
  }
  for (const candidate of commandCandidates) {
    if (commandExists(candidate)) return candidate;
  }

  throw new Error(
    "Google Chrome or Chromium was not found. Install it or set CHROME_PATH to its executable.",
  );
}

function createStaticServer(rootDirectory) {
  const normalizedRoot = resolve(rootDirectory);

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      let filePath = resolve(
        normalizedRoot,
        decodedPath.replace(/^[/\\]+/, ""),
      );
      const relativePath = relative(normalizedRoot, filePath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      let fileStats = await stat(filePath);
      if (fileStats.isDirectory()) {
        filePath = join(filePath, "index.html");
        fileStats = await stat(filePath);
      }
      if (!fileStats.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": fileStats.size,
        "Content-Type":
          MIME_TYPES.get(extname(filePath).toLowerCase()) ??
          "application/octet-stream",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }

      const stream = createReadStream(filePath);
      stream.on("error", (error) => response.destroy(error));
      stream.pipe(response);
    } catch (error) {
      const statusCode = error?.code === "ENOENT" ? 404 : 500;
      if (!response.headersSent) {
        response.writeHead(statusCode, {
          "Content-Type": "text/plain; charset=utf-8",
        });
      }
      response.end(statusCode === 404 ? "Not found" : "Internal server error");
    }
  });
}

async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => rejectListen(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolveListen();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the local HTTP server address.");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async connect(timeoutMs = 15_000) {
    const socket = new WebSocket(this.webSocketUrl);
    socket.binaryType = "arraybuffer";
    await new Promise((resolveConnect, rejectConnect) => {
      const timer = setTimeout(() => {
        socket.close();
        rejectConnect(
          new Error("Timed out while connecting to Chrome DevTools."),
        );
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
      };
      const onOpen = () => {
        cleanup();
        resolveConnect();
      };
      const onError = () => {
        cleanup();
        rejectConnect(new Error("Could not connect to Chrome DevTools."));
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });

    this.socket = socket;
    socket.addEventListener(
      "message",
      (event) => void this.handleMessage(event.data),
    );
    socket.addEventListener("close", () => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error("Chrome DevTools disconnected."));
      }
      this.pending.clear();
    });
  }

  async handleMessage(data) {
    let text;
    if (typeof data === "string") {
      text = data;
    } else if (data instanceof ArrayBuffer) {
      text = Buffer.from(data).toString("utf8");
    } else {
      text = await data.text();
    }

    const message = JSON.parse(text);
    if (message.id) {
      const pendingRequest = this.pending.get(message.id);
      if (!pendingRequest) return;
      clearTimeout(pendingRequest.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pendingRequest.reject(
          new Error(`${pendingRequest.method}: ${message.error.message}`),
        );
      } else {
        pendingRequest.resolve(message.result);
      }
      return;
    }

    if (!message.method) return;
    for (const handler of this.handlers.get(message.method) ?? []) {
      handler(message.params ?? {}, message.sessionId);
    }
  }

  send(method, params = {}, sessionId, timeoutMs = 30_000) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Chrome DevTools is not connected."));
    }

    const id = this.nextId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectRequest(new Error(`${method} timed out after ${timeoutMs} ms.`));
      }, timeoutMs);
      this.pending.set(id, {
        method,
        reject: rejectRequest,
        resolve: resolveRequest,
        timer,
      });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) ?? new Set();
    handlers.add(handler);
    this.handlers.set(method, handlers);
    return () => handlers.delete(handler);
  }

  close() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) {
      this.socket.close();
    }
  }
}

function createNetworkTracker(client, sessionId) {
  const activeRequests = new Map();
  const failedAssets = [];
  let lastActivity = Date.now();
  const relevantTypes = new Set([
    "Document",
    "Font",
    "Image",
    "Media",
    "Script",
    "Stylesheet",
  ]);

  client.on("Network.requestWillBeSent", (params, eventSessionId) => {
    if (eventSessionId !== sessionId) return;
    lastActivity = Date.now();
    activeRequests.set(params.requestId, {
      type: params.type,
      url: params.request?.url,
    });
  });
  client.on("Network.loadingFinished", (params, eventSessionId) => {
    if (eventSessionId !== sessionId) return;
    lastActivity = Date.now();
    activeRequests.delete(params.requestId);
  });
  client.on("Network.loadingFailed", (params, eventSessionId) => {
    if (eventSessionId !== sessionId) return;
    lastActivity = Date.now();
    const request = activeRequests.get(params.requestId);
    activeRequests.delete(params.requestId);
    if (!params.canceled && request && relevantTypes.has(request.type)) {
      failedAssets.push(`${request.url} (${params.errorText})`);
    }
  });
  client.on("Network.responseReceived", (params, eventSessionId) => {
    if (eventSessionId !== sessionId) return;
    lastActivity = Date.now();
    if (params.response?.status >= 400 && relevantTypes.has(params.type)) {
      failedAssets.push(
        `${params.response.url} (HTTP ${params.response.status})`,
      );
    }
  });

  return {
    failedAssets,
    async waitForIdle({ quietMs = 500, timeoutMs = 30_000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (activeRequests.size === 0 && Date.now() - lastActivity >= quietMs)
          return;
        await delay(50);
      }

      const pending = [...activeRequests.values()]
        .map((request) => request.url)
        .filter(Boolean)
        .slice(0, 5);
      throw new Error(
        `The page did not become network-idle.${pending.length ? ` Pending: ${pending.join(", ")}` : ""}`,
      );
    },
  };
}

async function launchChrome(chromePath, profileDirectory) {
  const args = [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--hide-scrollbars",
    "--mute-audio",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ];
  if (
    process.platform !== "win32" &&
    typeof process.geteuid === "function" &&
    process.geteuid() === 0
  ) {
    args.unshift("--no-sandbox");
  }

  const chrome = spawn(chromePath, args, {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const webSocketUrl = await new Promise((resolveUrl, rejectUrl) => {
    let diagnosticOutput = "";
    const timer = setTimeout(() => {
      chrome.kill();
      rejectUrl(
        new Error(
          `Chrome did not expose its DevTools endpoint in time.${diagnosticOutput ? `\n${diagnosticOutput.trim()}` : ""}`,
        ),
      );
    }, 15_000);

    const inspectOutput = (chunk) => {
      diagnosticOutput = `${diagnosticOutput}${chunk.toString()}`.slice(-8_000);
      const match = diagnosticOutput.match(
        /DevTools listening on (ws:\/\/\S+)/,
      );
      if (match) {
        cleanup();
        resolveUrl(match[1]);
      }
    };
    const onError = (error) => {
      cleanup();
      rejectUrl(new Error(`Could not launch Chrome: ${formatError(error)}`));
    };
    const onExit = (code) => {
      cleanup();
      rejectUrl(
        new Error(
          `Chrome exited before it was ready (code ${code ?? "unknown"}).${diagnosticOutput ? `\n${diagnosticOutput.trim()}` : ""}`,
        ),
      );
    };
    const cleanup = () => {
      clearTimeout(timer);
      chrome.stdout.off("data", inspectOutput);
      chrome.stderr.off("data", inspectOutput);
      chrome.off("error", onError);
      chrome.off("exit", onExit);
    };

    chrome.stdout.on("data", inspectOutput);
    chrome.stderr.on("data", inspectOutput);
    chrome.once("error", onError);
    chrome.once("exit", onExit);
  });

  // Keep both pipes drained after the DevTools URL has been found. Some Chrome
  // builds emit enough diagnostics to otherwise fill an unread pipe.
  chrome.stdout.resume();
  chrome.stderr.resume();

  return { chrome, webSocketUrl };
}

async function waitForDocumentReady(
  client,
  sessionId,
  expectedUrl,
  timeoutMs = 30_000,
) {
  const expectedPath = new URL(expectedUrl).pathname;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let evaluation;
    try {
      evaluation = await client.send(
        "Runtime.evaluate",
        {
          expression:
            "({ href: location.href, readyState: document.readyState })",
          returnByValue: true,
        },
        sessionId,
      );
    } catch (error) {
      // Navigation can replace the execution context between the command being
      // sent and evaluated. Retry that transient state until the page is ready.
      if (!/context|navigation|target/i.test(formatError(error))) throw error;
      await delay(100);
      continue;
    }
    const value = evaluation.result?.value;
    if (
      value?.readyState === "complete" &&
      new URL(value.href).pathname === expectedPath
    ) {
      return;
    }
    await delay(100);
  }
  throw new Error(`The document did not finish loading: ${expectedUrl}`);
}

async function waitForFontsAndImages(client, sessionId) {
  const expression = `
    (async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await new Promise((resolveImage, rejectImage) => {
            image.addEventListener('load', resolveImage, { once: true });
            image.addEventListener('error', () => rejectImage(new Error('Image failed: ' + image.currentSrc)), { once: true });
          });
        }
        if (typeof image.decode === 'function') {
          try {
            await image.decode();
          } catch (error) {
            if (image.naturalWidth === 0) throw error;
          }
        }
        if (image.naturalWidth === 0 || image.naturalHeight === 0) {
          throw new Error('Image has no decoded dimensions: ' + image.currentSrc);
        }
      }));
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
      return {
        fonts: document.fonts.status,
        imageCount: images.length,
        readyState: document.readyState,
      };
    })()
  `;

  const evaluation = await client.send(
    "Runtime.evaluate",
    { awaitPromise: true, expression, returnByValue: true },
    sessionId,
    45_000,
  );
  if (evaluation.exceptionDetails) {
    const description =
      evaluation.exceptionDetails.exception?.description ??
      evaluation.exceptionDetails.text ??
      "Unknown page error";
    throw new Error(`The CV page did not become print-ready: ${description}`);
  }

  const readiness = evaluation.result?.value;
  if (readiness?.readyState !== "complete" || readiness?.fonts !== "loaded") {
    throw new Error(
      `The CV page is not print-ready: ${JSON.stringify(readiness)}`,
    );
  }
}

async function stopChrome(client, chrome) {
  if (client) {
    try {
      await client.send("Browser.close", {}, undefined, 5_000);
    } catch {
      // Chrome may close DevTools before acknowledging Browser.close.
    }
    client.close();
  }
  if (chrome.exitCode === null && chrome.signalCode === null) {
    const exited = new Promise((resolveExit) =>
      chrome.once("exit", resolveExit),
    );
    await Promise.race([exited, delay(3_000)]);
  }
  if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill();
}

async function renderPdf({
  chromePath,
  profileDirectory,
  sourceUrl,
  targetPath,
}) {
  let chrome;
  let client;
  try {
    const launched = await launchChrome(chromePath, profileDirectory);
    chrome = launched.chrome;
    client = new CdpClient(launched.webSocketUrl);
    await client.connect();

    const { targetId } = await client.send("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await client.send("Target.attachToTarget", {
      flatten: true,
      targetId,
    });
    const network = createNetworkTracker(client, sessionId);
    await Promise.all([
      client.send("Network.enable", {}, sessionId),
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
    ]);

    const navigation = await client.send(
      "Page.navigate",
      { url: sourceUrl },
      sessionId,
    );
    if (navigation.errorText)
      throw new Error(`Navigation failed: ${navigation.errorText}`);

    await waitForDocumentReady(client, sessionId, sourceUrl);
    await network.waitForIdle();
    await waitForFontsAndImages(client, sessionId);
    if (network.failedAssets.length > 0) {
      throw new Error(
        `Some page assets failed to load:\n${[...new Set(network.failedAssets)]
          .map((failure) => `  - ${failure}`)
          .join("\n")}`,
      );
    }

    const printResult = await client.send(
      "Page.printToPDF",
      {
        displayHeaderFooter: false,
        preferCSSPageSize: true,
        printBackground: true,
        transferMode: "ReturnAsBase64",
      },
      sessionId,
      60_000,
    );
    const pdf = Buffer.from(printResult.data, "base64");
    if (
      pdf.length < 1_024 ||
      pdf.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new Error(`Chrome returned an invalid PDF (${pdf.length} bytes).`);
    }
    await writeFile(targetPath, pdf);
  } finally {
    if (chrome) await stopChrome(client, chrome);
  }
}

async function replaceFile(sourcePath, destinationPath, runToken) {
  await mkdir(dirname(destinationPath), { recursive: true });
  const filename = destinationPath.split(/[\\/]/).pop();
  const temporaryPath = join(
    dirname(destinationPath),
    `.${filename}.${runToken}.tmp`,
  );
  await copyFile(sourcePath, temporaryPath);
  await rm(destinationPath, { force: true });
  await rename(temporaryPath, destinationPath);
}

async function validateSources() {
  for (const cv of CVS) {
    const sourcePath = join(PUBLIC_DIR, ...cv.source.split("/"));
    if (!(await fileExists(sourcePath))) {
      throw new Error(`CV source is missing: ${sourcePath}`);
    }
  }
}

async function main() {
  await validateSources();
  const chromePath = await detectChrome();
  const runToken = `${Date.now()}-${process.pid}-${randomUUID()}`;
  const stagingDirectory = join(TEMP_ROOT, `generated-${runToken}`);
  const profilesDirectory = join(TEMP_ROOT, `chrome-profiles-${runToken}`);
  const server = createStaticServer(PUBLIC_DIR);

  await mkdir(stagingDirectory, { recursive: true });
  await mkdir(profilesDirectory, { recursive: true });
  console.log(`Chrome: ${chromePath}`);
  const baseUrl = await listen(server);

  try {
    for (const cv of CVS) {
      const sourceUrl = new URL(cv.source, `${baseUrl}/`).href;
      const stagingPath = join(stagingDirectory, cv.output);
      const profileDirectory = join(profilesDirectory, cv.language);
      await mkdir(profileDirectory, { recursive: true });
      console.log(`Generating ${cv.language.toUpperCase()}: ${cv.output}`);
      await renderPdf({
        chromePath,
        profileDirectory,
        sourceUrl,
        targetPath: stagingPath,
      });
    }

    for (const cv of CVS) {
      await replaceFile(
        join(stagingDirectory, cv.output),
        join(OUTPUT_DIR, cv.output),
        runToken,
      );
    }
    console.log(`Generated PDFs: ${OUTPUT_DIR}`);

    if (publish) {
      for (const cv of CVS) {
        const generatedPath = join(OUTPUT_DIR, cv.output);
        await replaceFile(generatedPath, join(PUBLIC_DIR, cv.output), runToken);
        await replaceFile(generatedPath, join(REPO_ROOT, cv.output), runToken);
      }
      console.log("Published PDFs to public/ and the repository root.");
    }
  } finally {
    await closeServer(server);
    await rm(stagingDirectory, {
      force: true,
      recursive: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    await rm(profilesDirectory, {
      force: true,
      recursive: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}

main().catch((error) => {
  console.error(`CV PDF generation failed: ${formatError(error)}`);
  process.exitCode = 1;
});
