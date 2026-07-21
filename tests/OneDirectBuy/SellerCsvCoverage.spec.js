import { test, expect } from "../helpers/softTest.js";
import fs from "fs";
import path from "path";
import {
  loadSellerUseCases,
  resolvedSellerCsvPath,
} from "../helpers/sellerUseCases.js";

test.describe("OneDirectBuy — seller.csv source validation", () => {
  test("seller.csv is readable and contains seller use cases", async ({ soft }) => {
    await soft("seller-csv-load", "≥60 ODB-UC-* rows from seller.csv", async () => {
      const source = resolvedSellerCsvPath();
      const useCases = loadSellerUseCases(source);
      test.info().annotations.push({ type: "source", description: source });
      expect(useCases.length).toBeGreaterThanOrEqual(60);
      expect(useCases.every((row) => /^ODB-UC-\d+/.test(row.id))).toBeTruthy();
    });
  });

  test("every seller.csv use case id is referenced in a Seller*.spec.js file", async ({
    soft,
  }) => {
    await soft("seller-csv-coverage", "All seller.csv IDs appear in Seller*.spec.js", async () => {
      const useCases = loadSellerUseCases();
      const sellerDir = path.join(process.cwd(), "tests/OneDirectBuy");
      const specText = fs
        .readdirSync(sellerDir)
        .filter((name) => name.startsWith("Seller") && name.endsWith(".spec.js"))
        .map((name) => fs.readFileSync(path.join(sellerDir, name), "utf8"))
        .join("\n");

      const missing = useCases
        .map((row) => row.id)
        .filter((id) => !specText.includes(id));

      expect(
        missing,
        `Add tests or tracked skips for: ${missing.join(", ")}`,
      ).toEqual([]);
    });
  });
});
