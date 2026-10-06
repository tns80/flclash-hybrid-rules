import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import yaml from "js-yaml";

/** Probe the built Hybrid script using a live HTTP proxy-provider update.
 * TUN is disabled for this unprivileged probe; production TUN is checked by -t.
 * Inline rule fixtures isolate group membership from remote rules availability.
 */
export async function verifyHybridRuntime(kernel, distDir) {
  const node = (name) => ({
    name,
    type: "ss",
    server: "127.0.0.1",
    port: 9,
    cipher: "aes-128-gcm",
    password: "fixture",
  });
  let nodes = [
    "Canada 01",
    "London 01",
    "Manchester 01",
    "United Kingdom 01",
    "德国 01",
    "巴西 01",
    "日本 BGP1",
    "日本 BGP 6",
    "日本-BGP10",
    "香港 01",
    "剩余流量",
  ];
  const provider = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/yaml" });
    res.end(yaml.dump({ proxies: nodes.map(node) }));
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerPort = provider.address().port;
  const portReservation = createServer();
  portReservation.listen(0, "127.0.0.1");
  await once(portReservation, "listening");
  const apiPort = portReservation.address().port;
  await new Promise((resolve) => portReservation.close(resolve));
  const probeDir = mkdtempSync(path.join(distDir, "hybrid-runtime-"));
  let child;
  let logs = "";
  try {
    const raw = readFileSync(path.join(distDir, "bettbox-flclash.js"), "utf8");
    const cfg = vm.runInNewContext(
      `${raw}\nmain(${JSON.stringify({ "proxy-providers": { airport: { type: "http", url: `http://127.0.0.1:${providerPort}/airport.yaml`, path: "./airport.yaml", interval: 3600 } } })});`,
    );
    cfg.tun.enable = false;
    cfg.dns.listen = "127.0.0.1:0";
    cfg["mixed-port"] = 0;
    cfg["external-controller"] = `127.0.0.1:${apiPort}`;
    cfg.secret = "hybrid-test";
    cfg.profile["store-selected"] = false;
    for (const [key, rp] of Object.entries(cfg["rule-providers"])) {
      if (rp.type === "http")
        cfg["rule-providers"][key] = {
          type: "inline",
          behavior: rp.behavior,
          payload:
            rp.behavior === "domain" ? ["example.com"] : ["192.0.2.0/24"],
        };
    }
    const configPath = path.join(probeDir, "config.yaml");
    writeFileSync(configPath, yaml.dump(cfg, { lineWidth: -1 }));
    child = spawn(kernel, ["-d", probeDir, "-f", configPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => {
      logs += data;
    });
    child.stderr.on("data", (data) => {
      logs += data;
    });
    const api = async (route, method = "GET") => {
      const res = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
        method,
        headers: { Authorization: "Bearer hybrid-test" },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error(`${route}: HTTP ${res.status}`);
      return res.status === 204 ? undefined : res.json();
    };
    const eventually = async (check) => {
      for (let attempt = 0; attempt < 60; attempt++) {
        if (child.exitCode !== null)
          throw new Error(`Mihomo exited ${child.exitCode}\n${logs}`);
        try {
          if (await check()) return;
        } catch {
          /* startup/update is asynchronous */
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error(`Hybrid runtime timed out\n${logs}`);
    };
    let proxies;
    const refresh = async () => {
      proxies = (await api("/proxies")).proxies;
    };
    const members = (name) => proxies[name]?.all ?? [];
    const assert = (ok, message) => {
      if (!ok) throw new Error(message);
      console.log(`✓ [hybrid-runtime] ${message}`);
    };
    await eventually(async () => {
      await refresh();
      return (
        members("CA").includes("Canada 01") &&
        members("UK").includes("London 01")
      );
    });
    for (const name of ["London 01", "Manchester 01", "United Kingdom 01"]) {
      assert(
        members("UK").includes(name) &&
          !members("EU").includes(name) &&
          !members("Other").includes(name),
        `${name} enters UK only among UK/EU/Other`,
      );
    }
    assert(
      members("CA").includes("Canada 01") &&
        !members("Other").includes("Canada 01"),
      "CA excludes recognized Canada from Other",
    );
    assert(
      members("Other").includes("巴西 01"),
      "unrecognized region enters Other",
    );
    assert(!members("All").includes("剩余流量"), "information nodes excluded");
    assert(!members("AI").includes("香港 01"), "AI excludes Hong Kong");
    for (const name of ["GitHub", "Netflix", "TikTok"]) {
      assert(
        members(name).includes("main") &&
          members(name).includes("CA") &&
          members(name).includes("UK") &&
          members("GLOBAL").includes(name),
        `${name} has service exits and appears in GLOBAL`,
      );
    }
    assert(
      proxies["URL Test - CA"]?.emptyFallback === "DIRECT",
      "empty-fallback accepted by kernel",
    );
    // Update provider payload without running main again or reloading config.
    nodes = ["Vancouver NEW", "UK NEW", "巴西 NEW"];
    await api("/providers/proxies/airport", "PUT");
    await eventually(async () => {
      await refresh();
      return (
        members("CA").includes("Vancouver NEW") &&
        !members("All").includes("Canada 01") &&
        members("UK").includes("UK NEW")
      );
    });
    assert(
      !members("Other").includes("Vancouver NEW") &&
        !members("Other").includes("UK NEW"),
      "provider additions and deletions reflected without script rerun",
    );
  } finally {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await new Promise((resolve) => provider.close(resolve));
    writeFileSync(path.join(probeDir, "kernel.log"), logs);
  }
}
