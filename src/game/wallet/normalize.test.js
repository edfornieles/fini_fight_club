import { describe, it, expect } from "vitest";
import { mapFamily, mapFrequency, resolveAssetUrl, resolveAssetUrls, metadataToTraits, metadataToOwnedFini, } from "./normalize";
// Real payload shapes from api-public.finiliar.com/metadata/{id}
const META_1 = {
    id: "1",
    name: "finiliar #1",
    image: "ar://ggneCmg9gWZmdZHqWNKoHZeh26xSwd3lgZkeINli8MI/1.gif",
    animation_url: "ar://ggneCmg9gWZmdZHqWNKoHZeh26xSwd3lgZkeINli8MI/1.mp4",
    background: "#fae3eb",
    external_url: "https://finiliar.com/discover/1",
    attributes: [
        { value: "Tezos", trait_type: "Family" },
        { value: "Hourly", trait_type: "Frequency" },
        { value: "Stickies", trait_type: "Clan" },
    ],
    latestDelta: -0.3418262674905808,
    latestPrice: 0.324491,
};
const META_7777 = {
    id: "7777",
    name: "finiliar #7777",
    image: "ar://QZiv14_vNaCHiYcOv_rpm8WCnkChS3-a-L4A8343LTU/7777.gif",
    background: "#939391",
    attributes: [
        { value: "Ethereum", trait_type: "Family" },
        { value: "Hourly", trait_type: "Frequency" },
        { value: "Blades", trait_type: "Clan" },
    ],
    latestDelta: 0.05652602924478745,
    latestPrice: 2017.91,
};
describe("family mapping", () => {
    it("maps full asset names to tickers", () => {
        expect(mapFamily("Bitcoin")).toBe("BTC");
        expect(mapFamily("Ethereum")).toBe("ETH");
        expect(mapFamily("Tezos")).toBe("XTZ");
        expect(mapFamily("Dogecoin")).toBe("DOGE");
    });
    it("accepts an existing ticker", () => {
        expect(mapFamily("eth")).toBe("ETH");
    });
    it("falls back to BTC for unknown/empty", () => {
        expect(mapFamily(undefined)).toBe("BTC");
        expect(mapFamily("Nonsense")).toBe("BTC");
    });
});
describe("frequency mapping", () => {
    it("normalizes valid tiers", () => {
        expect(mapFrequency("Monthly")).toBe("Monthly");
        expect(mapFrequency("twice-daily")).toBe("Twice-Daily");
    });
    it("defaults to Hourly", () => {
        expect(mapFrequency(undefined)).toBe("Hourly");
        expect(mapFrequency("nope")).toBe("Hourly");
    });
});
describe("asset url resolution", () => {
    it("resolves ar:// to a working gateway (not arweave.net first)", () => {
        const url = resolveAssetUrl("ar://abc/1.gif");
        expect(url).toBe("https://permagate.io/abc/1.gif");
    });
    it("returns multiple ar:// gateway candidates ending in the path", () => {
        const urls = resolveAssetUrls("ar://abc/1.mp4");
        expect(urls.length).toBeGreaterThanOrEqual(2);
        expect(urls.every((u) => u.endsWith("/abc/1.mp4"))).toBe(true);
        // arweave.net is kept only as a last-resort fallback.
        expect(urls[urls.length - 1]).toContain("arweave.net");
    });
    it("resolves ipfs:// to a gateway", () => {
        expect(resolveAssetUrl("ipfs://cid/x")).toBe("https://ipfs.io/ipfs/cid/x");
    });
    it("passes through https", () => {
        expect(resolveAssetUrl("https://x.com/a.png")).toBe("https://x.com/a.png");
    });
    it("returns [] for empty input", () => {
        expect(resolveAssetUrls(undefined)).toEqual([]);
    });
});
describe("metadataToTraits", () => {
    it("normalizes #1 (Tezos/Hourly/Stickies)", () => {
        const t = metadataToTraits(META_1, 1);
        expect(t).toMatchObject({
            tokenId: 1,
            family: "XTZ",
            frequency: "Hourly",
            clan: "Stickies",
        });
        expect(t.special).toBeUndefined();
        expect(t.latestDelta).toBeCloseTo(-0.3418, 3);
    });
    it("normalizes #7777 (Ethereum/Hourly/Blades)", () => {
        const t = metadataToTraits(META_7777, 7777);
        expect(t).toMatchObject({ family: "ETH", frequency: "Hourly", clan: "Blades" });
    });
});
describe("metadataToOwnedFini", () => {
    it("resolves artwork + price into a display record", () => {
        const f = metadataToOwnedFini(META_1, 1);
        expect(f.name).toBe("finiliar #1");
        expect(f.artwork.imageUrl).toContain("/ggneCmg9gWZmdZHqWNKoHZeh26xSwd3lgZkeINli8MI/1.gif");
        expect(f.artwork.imageUrls.length).toBeGreaterThanOrEqual(2);
        expect(f.artwork.animationUrl).toContain("/ggneCmg9gWZmdZHqWNKoHZeh26xSwd3lgZkeINli8MI/1.mp4");
        expect(f.artwork.background).toBe("#fae3eb");
        expect(f.latestPrice).toBeCloseTo(0.3245, 3);
    });
});
