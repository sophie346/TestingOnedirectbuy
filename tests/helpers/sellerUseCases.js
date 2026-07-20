import fs from "fs";
import path from "path";

const CANDIDATE_PATHS = [
  process.env.ONEDIRECTBUY_SELLER_CSV,
  path.resolve("D:/DesktopWrokingShell/OneAuto/OneDirectBuy/seller.csv"),
  path.join(process.cwd(), "tests/OneDirectBuy/seller.csv"),
  path.join(process.cwd(), "tests/OneDirectBuy/seller-use-cases-from-main.tsv"),
].filter(Boolean);

function isTabSeparatedSellerCsv(content) {
  const firstLine = content.split(/\r?\n/)[0] || "";
  return firstLine.includes("Use Case ID") && firstLine.includes("\t");
}

function resolveSellerCsvPath() {
  for (const candidate of CANDIDATE_PATHS) {
    if (!fs.existsSync(candidate)) continue;
    const content = fs.readFileSync(candidate);
    if (content[0] === 0x50 && content[1] === 0x4b) continue;
    const text = content.toString("utf8");
    if (isTabSeparatedSellerCsv(text)) return candidate;
  }
  throw new Error(
    "No readable seller use-case file found. Close seller.csv in Excel and save TSV to OneDirectBuy/seller.csv."
  );
}

/** @returns {{ id: string; module: string; actor: string; useCase: string; description: string }[]} */
export function loadSellerUseCases(csvPath) {
  const filePath = csvPath || resolveSellerCsvPath();
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const [header, ...rows] = lines;
  const cols = header.split("\t");
  const idx = {
    id: cols.indexOf("Use Case ID"),
    module: cols.indexOf("Module"),
    actor: cols.indexOf("Actor"),
    useCase: cols.indexOf("Use Case"),
    description: cols.indexOf("Description"),
  };

  return rows.map((line) => {
    const parts = line.split("\t");
    return {
      id: parts[idx.id] || parts[0],
      module: parts[idx.module] || "",
      actor: parts[idx.actor] || "",
      useCase: parts[idx.useCase] || "",
      description: parts[idx.description] || "",
    };
  });
}

export function sellerUseCaseIds(csvPath) {
  return loadSellerUseCases(csvPath).map((row) => row.id);
}

export function resolvedSellerCsvPath() {
  return resolveSellerCsvPath();
}
