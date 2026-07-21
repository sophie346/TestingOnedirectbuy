import { test } from "../helpers/softTest.js";

/**
 * Seller catalog, inventory, fitment upload, and bulk operations from main.csv / seller.csv.
 * These flows require an authenticated seller workspace (OneChannel Admin / seller portal),
 * which is not mounted on the public OneDirectBuy storefront.
 */
const BACKEND_ONLY_CASES = [
  ["ODB-UC-077", "Variant-level inventory per seller"],
  ["ODB-UC-081", "Update product price"],
  ["ODB-UC-082", "Prevent negative price"],
  ["ODB-UC-083", "Add sale price"],
  ["ODB-UC-087", "Add UPC/GTIN/MPN"],
  ["ODB-UC-088", "Invalid UPC validation"],
  ["ODB-UC-104", "Upload ACES fitment file"],
  ["ODB-UC-106", "Upload PIES file"],
  ["ODB-UC-107", "Invalid PIES file rejection"],
  ["ODB-UC-203", "Request existing brand approval"],
  ["ODB-UC-204", "Request new brand creation"],
  ["ODB-UC-215", "Add new product for review"],
  ["ODB-UC-219", "Upload product images"],
  ["ODB-UC-220", "Invalid product image rejection"],
  ["ODB-UC-221", "Add product specifications"],
  ["ODB-UC-227", "Resubmit rejected product"],
  ["ODB-UC-228", "Edit approved product"],
  ["ODB-UC-232", "Bulk product CSV upload"],
  ["ODB-UC-233", "Bulk price update by file"],
  ["ODB-UC-234", "Bulk inventory update by file"],
  ["ODB-UC-242", "Export seller catalog"],
  ["ODB-UC-248", "Required category attribute validation"],
  ["ODB-UC-251", "Add inventory quantity"],
  ["ODB-UC-252", "Reduce inventory quantity"],
  ["ODB-UC-253", "Prevent negative inventory"],
  ["ODB-UC-293", "Approve buyer return request"],
  ["ODB-UC-317", "Submit seller rating after order"],
  ["ODB-UC-320", "Respond to buyer review"],
  ["ODB-UC-330", "Send seller approval notification"],
  ["ODB-UC-509", "Large bulk upload performance"],
  ["ODB-UC-512", "Bulk upload recovery after failure"],
];

test.describe("OneDirectBuy — Seller catalog & inventory (backend portal)", () => {
  for (const [id, title] of BACKEND_ONLY_CASES) {
    test(`${id}: ${title} — tracked, requires seller backend`, async () => {
      test.skip(
        true,
        "Automate in OneChannel Admin / seller portal when ONEDIRECTBUY_SELLER credentials and routes are available.",
      );
    });
  }
});
