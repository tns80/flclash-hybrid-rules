import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { createSocket } from "node:dgram";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import yaml from "js-yaml";
import { boundaryInput, REGION_SAMPLES, REGIONS, RESERVED_TEST_NAMES, sampleNode } from "./hybrid-fixtures.mjs";

const ADS_HOST = "ads-boundary.example.net";
const DNS_HOST = "fallback-probe.example.net";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function freePort() {
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  return port;
}

async function dnsServer(ip) {
  const socket = createSocket("udp4");
  let queries = 0;
  socket.on("message", (msg, remote) => {
    queries++;
    const answer = Buffer.concat([msg, Buffer.from([0xc0, 0x0c, 0, 1, 0, 1, 0, 0, 0, 30, 0, 4, ...ip])]);
    answer.writeUInt16BE(0x8180, 2);
    answer.writeUInt16BE(1, 6);
    socket.send(answer, remote.port, remote.address);
  });
  socket.bind(0, "127.0.0.1");
  await once(socket, "listening");
  return { socket, port: socket.address().port, count: () => queries };
}

async function queryDns(port) {
  const client = createSocket("udp4");
  const qname = Buffer.concat(DNS_HOST.split(".").map((label) => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])));
  const message = Buffer.concat([Buffer.from([0x12, 0x34, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]), qname, Buffer.from([0, 0, 1, 0, 1])]);
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("DNS probe timed out")), 4000);
      client.once("error", reject);
      client.once("message", (reply) => resolve(reply.subarray(-4).join(".")));
      client.send(message, port, "127.0.0.1");
    });
  } finally {
    clearTimeout(timer);
    client.close();
  }
}

async function getThroughProxy(port, originPort) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port, path: `http://${ADS_HOST}:${originPort}/`, headers: { Host: `${ADS_HOST}:${originPort}` } }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
    });
    req.setTimeout(4000, () => req.destroy(new Error("HTTP probe timed out")));
    req.once("error", reject);
    req.end();
  });
}

/** Local fixtures test DNS path ownership, regexp2 membership and advertising.
 * TUN is disabled; the local DNS upstream is a positive control, not a DoH/TUN test.
 */
export async function verifyHybridBoundaries(kernel, distDir) {
  const raw = readFileSync(path.join(distDir, "bettbox-flclash.js"), "utf8");
  const run = (input, advertising = true) => vm.runInNewContext(`${raw}\nObject.assign(ruleOptionsEnable, {广告拦截:${advertising}}); main(${JSON.stringify(input)});`);
  let providerNames = [...REGION_SAMPLES.map(([name]) => name), ...RESERVED_TEST_NAMES, "collision-alias"];
  const provider = createServer((_req, response) => {
    response.writeHead(200, { "Content-Type": "text/yaml" });
    response.end(yaml.dump({ proxies: providerNames.map(sampleNode) }));
  });
  let delivered = 0;
  const origin = createServer((_req, response) => { delivered++; response.end("advertising fixture"); });
  let oldDns, controlledDns;
  const result = { regions: REGION_SAMPLES.length, providerCollisionUsability: "PARTIAL" };
  try {
    const providerPort = await listen(provider);
    const originPort = await listen(origin);
    oldDns = await dnsServer([198, 51, 100, 44]);
    controlledDns = await dnsServer([203, 0, 113, 55]);

    const probe = async (advertising, check) => {
      const probeDir = mkdtempSync(path.join(distDir, "hybrid-boundaries-"));
      const input = boundaryInput(`127.0.0.1:${oldDns.port}`);
      input.proxies[1]["dialer-proxy"] = "main";
      input["proxy-providers"] = {
        airport: { type: "http", url: `http://127.0.0.1:${providerPort}/airport.yaml`, path: "./airport.yaml", interval: 3600, proxy: "DIRECT",
          override: { "proxy-name": [{ pattern: "^collision-alias$", target: "UK" }] } },
        inlineAirport: { type: "inline", payload: [sampleNode("main"), sampleNode("inline-ordinary")] },
        fileAirport: { type: "file", path: "./file-airport.yaml" },
      };
      writeFileSync(path.join(probeDir, "file-airport.yaml"), yaml.dump({ proxies: [sampleNode("GitHub"), sampleNode("file-ordinary")] }));
      const cfg = run(input, advertising);
      for (const key of ["fallback", "fallback-filter", "fallback-lazy-query", "proxy-server-nameserver-policy"])
        assert.ok(!(key in cfg.dns), `${key} must be absent before fixture changes`);
      assert.deepEqual(Array.from(cfg.rules.filter((rule) => /^MATCH,/i.test(rule))), ["MATCH,main"]);
      assert.equal(cfg.rules.at(-1), "MATCH,main");
      assert.ok(cfg.rules.includes("DOMAIN-SUFFIX,example.com,DIRECT"));
      assert.equal(cfg.rules[0], `RULE-SET,category-ads-all,${advertising ? "广告拦截" : "DIRECT"}`);
      assert.ok(cfg.proxies.every((node) => !RESERVED_TEST_NAMES.includes(node.name)));
      assert.ok(cfg.proxies.some((node) => node.name === "All_1" && node["dialer-proxy"] === "main_2"));

      const apiPort = await freePort(), mixedPort = await freePort(), dnsPort = await freePort();
      cfg.tun.enable = false;
      cfg.dns.listen = `127.0.0.1:${dnsPort}`;
      cfg.dns.nameserver = [`127.0.0.1:${controlledDns.port}`];
      cfg["mixed-port"] = mixedPort;
      cfg["external-controller"] = `127.0.0.1:${apiPort}`;
      cfg.secret = "hybrid-boundaries";
      cfg.profile["store-selected"] = false;
      cfg.hosts[ADS_HOST] = "127.0.0.1";
      for (const [key, rp] of Object.entries(cfg["rule-providers"])) {
        if (rp.type === "http") cfg["rule-providers"][key] = {
          type: "inline", behavior: rp.behavior,
          payload: rp.behavior === "domain" ? [key === "category-ads-all" ? ADS_HOST : "never-match.example.invalid"] : [key === "private-ip" ? "127.0.0.0/8" : "192.0.2.0/24"],
        };
      }
      const configPath = path.join(probeDir, "config.yaml");
      writeFileSync(configPath, yaml.dump(cfg, { lineWidth: -1 }));
      execFileSync(kernel, ["-t", "-d", probeDir, "-f", configPath], { timeout: 15000, stdio: "pipe" });
      console.log(`✓ [hybrid-boundaries] advertising ${advertising ? "ON" : "OFF"} combined fixture -t`);

      const child = spawn(kernel, ["-d", probeDir, "-f", configPath], { stdio: ["ignore", "pipe", "pipe"] });
      let logs = "", spawnError;
      child.stdout.on("data", (data) => { logs += data; });
      child.stderr.on("data", (data) => { logs += data; });
      child.on("error", (error) => { spawnError = error; });
      const api = async (route, method = "GET", body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, { method, body: body && JSON.stringify(body),
          headers: { Authorization: "Bearer hybrid-boundaries", "Content-Type": "application/json" }, signal: AbortSignal.timeout(1500) });
        assert.ok(response.ok, `${route} HTTP ${response.status}`);
        return response.status === 204 ? undefined : response.json();
      };
      const eventually = async (predicate) => {
        for (let i = 0; i < 60; i++) {
          if (spawnError) throw spawnError;
          if (child.exitCode !== null) throw new Error(`Mihomo exited ${child.exitCode}\n${logs}`);
          try { if (await predicate()) return; } catch { /* asynchronous startup/update */ }
          await wait(150);
        }
        throw new Error(`Boundary runtime timed out\n${logs}`);
      };
      try {
        await eventually(async () => (await api("/proxies")).proxies.All?.all?.includes("London"));
        await check({ api, eventually, mixedPort, dnsPort, originPort });
      } finally {
        if (child.pid && child.exitCode === null) {
          const exited = once(child, "exit");
          child.kill();
          await exited;
        }
        writeFileSync(path.join(probeDir, "kernel.log"), logs);
      }
    };

    await probe(true, async ({ api, eventually, mixedPort, dnsPort, originPort }) => {
      const { proxies } = await api("/proxies");
      const members = (group) => proxies[group]?.all || [];
      for (const [name, expected] of REGION_SAMPLES) {
        assert.ok(members("All").includes(name), `${name} missing from All`);
        const actual = [...REGIONS, "Other"].filter((group) => members(group).includes(name));
        assert.deepEqual(actual, [expected], `${name}: wrong/overlapping regexp2 region`);
      }
      console.log(`✓ [hybrid-boundaries] ${REGION_SAMPLES.length} regexp2 samples have exactly one expected region`);
      assert.ok(members("All").includes("URL Test - All"), "explicit automatic group must survive filter");
      for (const region of REGIONS) assert.ok(members(region).includes(`URL Test - ${region}`));
      for (const name of RESERVED_TEST_NAMES) assert.ok(!members("URL Test - All").includes(name), `${name}: unsafe provider name admitted`);
      for (const name of ["main_2", "UK_2", "GitHub_1", "inline-ordinary", "file-ordinary"])
        assert.ok(members("All").includes(name), `${name}: safe node lost`);
      const rawProvider = await api("/providers/proxies/airport");
      assert.ok(rawProvider.proxies.some((node) => node.name === "UK"), "collision fixture must actually reach provider");
      assert.equal(proxies.main.type, "Selector", "provider must not shadow main API group");
      await api("/proxies/All", "PUT", { name: "URL Test - All" });
      console.log("✓ [hybrid-boundaries] inline names/dialers and HTTP/file/inline provider guards; explicit group selection works");

      assert.equal(await queryDns(dnsPort), "203.0.113.55");
      assert.ok(controlledDns.count() > 0);
      await wait(150);
      assert.equal(oldDns.count(), 0, "removed fallback must receive no query");
      result.oldFallbackQueries = oldDns.count();
      assert.equal(await queryDns(oldDns.port), "198.51.100.44", "old endpoint must be a working positive control");
      console.log("✓ [hybrid-boundaries] DNS answered via fixture upstream; removed fallback queries=0; old endpoint positive control passed");

      const before = delivered;
      const status = await getThroughProxy(mixedPort, originPort);
      assert.notEqual(status, 200, "advertising ON should reject fixture traffic");
      assert.equal(delivered, before);
      result.advertisingOnStatus = status;

      providerNames = ["Vancouver NEW", "GB_99", "Business NEW", "main", "UK", "GitHub", "collision-alias"];
      await api("/providers/proxies/airport", "PUT");
      let updated;
      await eventually(async () => {
        updated = (await api("/proxies")).proxies;
        return updated.All.all.includes("Vancouver NEW") && !updated.All.all.includes("Canada");
      });
      assert.ok(updated.CA.all.includes("Vancouver NEW"));
      assert.ok(updated.UK.all.includes("GB_99"));
      assert.ok(updated.Other.all.includes("Business NEW"));
      for (const name of ["main", "UK", "GitHub"]) assert.ok(!updated["URL Test - All"].all.includes(name));
      console.log("✓ [hybrid-boundaries] provider add/remove/rename and collision guard persist without script rerun");
    });

    providerNames = [...REGION_SAMPLES.map(([name]) => name), ...RESERVED_TEST_NAMES, "collision-alias"];
    await probe(false, async ({ mixedPort, originPort }) => {
      const before = delivered;
      assert.equal(await getThroughProxy(mixedPort, originPort), 200);
      assert.equal(delivered, before + 1);
      result.advertisingOffStatus = 200;
      console.log("✓ [hybrid-boundaries] advertising OFF routes actual HTTP traffic DIRECT");
    });
    writeFileSync(path.join(distDir, "hybrid-boundaries-result.json"), JSON.stringify(result, null, 2));
  } finally {
    oldDns?.socket.close();
    controlledDns?.socket.close();
    if (provider.listening) await new Promise((resolve) => provider.close(resolve));
    if (origin.listening) await new Promise((resolve) => origin.close(resolve));
  }
}
