import { describe, expect, it } from "vitest";
import { applyDns } from "../src/dns";

describe("controlled DNS inheritance", () => {
  it("removes alternate paths and replaces old resolver/mode fields", () => {
    const oldDns = {
      fallback: ["127.0.0.1:9999"],
      "fallback-filter": { domain: ["example.com"] },
      "fallback-lazy-query": true,
      "proxy-server-nameserver-policy": { "+.example.com": ["114.114.114.114"] },
      nameserver: ["114.114.114.114"],
      "default-nameserver": ["192.0.2.1"],
      "proxy-server-nameserver": ["192.0.2.2"],
      "direct-nameserver": ["192.0.2.3"],
      "direct-nameserver-follow-policy": false,
      "nameserver-policy": { "+.example.com": ["192.0.2.4"] },
      "enhanced-mode": "redir-host",
      "fake-ip-range": "198.19.0.1/16",
      "fake-ip-range6": "fd00::/64",
      "fake-ip-filter-mode": "blacklist",
      "fake-ip-filter": ["+.custom.lan", "+.custom.lan"],
      "cache-max-size": 2048,
      "fake-ip-ttl": 30,
      "ipv6-timeout": 250,
      "listen-routing-mark": 7,
    };
    const cfg = { dns: oldDns };
    const clean: Record<string, any> = {};
    applyDns(clean);
    applyDns(cfg);
    for (const key of ["fallback", "fallback-filter", "fallback-lazy-query", "proxy-server-nameserver-policy"])
      expect(cfg.dns).not.toHaveProperty(key);
    for (const key of ["nameserver", "default-nameserver", "proxy-server-nameserver", "direct-nameserver", "direct-nameserver-follow-policy", "nameserver-policy", "enhanced-mode", "fake-ip-range", "fake-ip-range6", "fake-ip-filter-mode"])
      expect((cfg.dns as Record<string, any>)[key]).toEqual(clean.dns[key]);
    expect(cfg.dns["fake-ip-filter"].filter((v) => v === "+.custom.lan")).toHaveLength(1);
    for (const key of ["cache-max-size", "fake-ip-ttl", "ipv6-timeout", "listen-routing-mark"])
      expect((cfg.dns as Record<string, any>)[key]).toBe((oldDns as Record<string, any>)[key]);
    expect(oldDns.fallback).toEqual(["127.0.0.1:9999"]);
  });

  it.each(["rule", "whitelist"])("does not reinterpret %s filters as a blacklist", (mode) => {
    const cfg: Record<string, any> = { dns: { "fake-ip-filter-mode": mode, "fake-ip-filter": ["MATCH,real-ip"] } };
    applyDns(cfg);
    expect(cfg.dns["fake-ip-filter-mode"]).toBe("blacklist");
    expect(cfg.dns["fake-ip-filter"]).not.toContain("MATCH,real-ip");
  });
});
