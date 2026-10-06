/** Independent acceptance samples; expected regions are product requirements. */
export const REGIONS = ["HK", "TW", "JP", "SG", "KR", "US", "CA", "UK", "EU", "AU", "AS"];
export const RESERVED_TEST_NAMES = [
  "main", "All", "GLOBAL", "AI", "Google", "YouTube", "GitHub", "Netflix",
  "TikTok", "Telegram", "Steam", "Apple", "Microsoft", "Spotify", "广告拦截",
  "Other", "info", "全部", "自动测速", "AI 自动测速", "Telegram - Fallback",
  ...REGIONS,
  ...["All", "AI", "Other", ...REGIONS].map((name) => `URL Test - ${name}`),
  "DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE",
];

const required = [
  ...["United Kingdom", "UK 01", "UK_01", "GB 01", "GB_01", "GBR", "London", "Manchester", "LHR"].map((n) => [n, "UK"]),
  ["Australia", "AU"], ["Australia 01", "AU"], ["Business", "Other"], ["Business 01", "Other"], ["mainland", "Other"], ["mainland 01", "Other"],
  ...["Canada", "Toronto", "Vancouver", "Montreal", "YYZ", "YVR"].map((n) => [n, "CA"]),
  ["香港 01", "HK"], ["台湾 01", "TW"], ["日本 BGP1", "JP"], ["新加坡 01", "SG"], ["韩国 01", "KR"],
  ["美国 01", "US"], ["德国 01", "EU"], ["澳大利亚 01", "AU"], ["印度 01", "AS"], ["巴西 01", "Other"],
  ["HONG KONG 01", "HK"], ["TAIWAN 01", "TW"], ["TOKYO 01", "JP"], ["SINGAPORE 01", "SG"], ["SEOUL 01", "KR"],
  ["NEW YORK 01", "US"], ["FRANKFURT 01", "EU"], ["MELBOURNE 01", "AU"], ["VIETNAM 01", "AS"],
  ["🇭🇰 02", "HK"], ["🇹🇼 02", "TW"], ["🇯🇵 02", "JP"], ["🇸🇬 02", "SG"], ["🇰🇷 02", "KR"],
  ["🇺🇸 02", "US"], ["🇨🇦 02", "CA"], ["🇬🇧 02", "UK"], ["🇩🇪 02", "EU"], ["🇦🇺 02", "AU"], ["🇮🇳 02", "AS"],
];
const shortCodes = {
  HK: ["HK", "HKG"], TW: ["TW", "TWN"], JP: ["JP", "JPN"], SG: ["SG", "SGP"], KR: ["KR", "KOR"],
  US: ["US", "USA"], CA: ["YYZ", "YVR"], UK: ["UK", "GB", "GBR", "LHR"],
  EU: ["EU", "DE", "FR", "NL", "RU", "IT", "ES", "SE", "CH", "PL", "FI", "TR", "IE", "AT"],
  AU: ["AU", "AUS"], AS: ["VN", "TH", "MY", "ID", "PH", "IN"], Other: ["CA"],
};
for (const [region, codes] of Object.entries(shortCodes)) {
  for (const code of codes) {
    for (const name of [`${code} 03`, `${code}-03`, `${code}_03`, `|${code}|03`, `[${code}]03`, `(${code})03`, `${code}03`])
      required.push([name, region]);
    // Letters on either side invalidate a short ASCII token.
    required.push([`x${code}x 04`, "Other"]);
  }
}
export const REGION_SAMPLES = [...new Map(required.map(([name, region]) => [name, [name, region]])).values()];

export const sampleNode = (name) => ({ name, type: "ss", server: "127.0.0.1", port: 9, cipher: "aes-128-gcm", password: "fixture" });

export const DIRECT_INPUT_RULES = [
  ...["DIRECT", "Direct", "direct", "dIrEcT"].map((target) => `DOMAIN-SUFFIX,growingio.com,${target}`),
  "IP-CIDR,192.0.2.0/24,Direct,no-resolve",
  "DOMAIN-KEYWORD,DIRECT,main",
  "AND,((DOMAIN-SUFFIX,growingio.com),(NETWORK,tcp)),Direct",
  "OR,((DOMAIN,growingio.com),(DOMAIN,www.growingio.com)),direct",
  "NOT,((DOMAIN,never.example.invalid)),dIrEcT",
  "MATCH,Direct", "MATCH,direct", "MATCH,dIrEcT",
];
export const DIRECT_OUTPUT_RULES = [
  "DOMAIN-SUFFIX,growingio.com,DIRECT", "IP-CIDR,192.0.2.0/24,DIRECT,no-resolve",
  "AND,((DOMAIN-SUFFIX,growingio.com),(NETWORK,tcp)),DIRECT",
  "OR,((DOMAIN,growingio.com),(DOMAIN,www.growingio.com)),DIRECT",
  "NOT,((DOMAIN,never.example.invalid)),DIRECT",
];

export const boundaryInput = (oldFallback = "127.0.0.1:9") => ({
  proxies: [...RESERVED_TEST_NAMES.map(sampleNode), sampleNode("main_1"), sampleNode("UK_1")],
  rules: ["DOMAIN-SUFFIX,example.com,DIRECT", "IP-CIDR,192.0.2.0/24,DIRECT,no-resolve", "MATCH,DIRECT", "MATCH,REJECT", "MATCH,OldGroup", ...DIRECT_INPUT_RULES],
  dns: {
    fallback: [oldFallback], "fallback-filter": { geoip: false, domain: ["fallback-probe.example.net"] },
    "fallback-lazy-query": true,
    "proxy-server-nameserver-policy": { "+.old.example": [oldFallback] },
    "fake-ip-filter": ["fallback-probe.example.net"], "cache-max-size": 2048, "fake-ip-ttl": 30,
  },
});
