import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const API_URL = "https://jobs.bytedance.com/api/v1/search/job/posts";
const SOURCE_URL = "https://jobs.bytedance.com/experienced/position";
const PAGE_SIZE = 100;
const CHANNEL = "society";

const apiHeaders = [
  "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept: application/json, text/plain, */*",
  "Content-Type: application/json",
  "portal-channel: society",
  "portal-platform: pc",
  "website-path: society",
  "Origin: https://jobs.bytedance.com",
  "Referer: https://jobs.bytedance.com/experienced/position",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanHtml(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function deriveSignals(job) {
  const text = `${job.title} ${job.sub_title ?? ""} ${job.description ?? ""} ${job.requirement ?? ""}`.toLowerCase();
  const dictionary = [
    ["ai", ["ai", "人工智能", "大模型", "llm", "aigc", "agent", "多模态", "machine learning", "机器学习", "mlops"]],
    ["ecommerce", ["电商", "电商平台", "tiktok shop", "抖音电商", "交易", "商品", "gmv", "供应链"]],
    ["search-recommendation", ["搜索", "推荐", "召回", "排序", "广告", "用户增长"]],
    ["cloud-infrastructure", ["云平台", "云原生", "基础架构", "算力", "数据中心", "kubernetes", "k8s"]],
    ["payments-risk", ["支付", "风控", "反欺诈", "资金安全"]],
  ];
  return dictionary.filter(([, terms]) => terms.some((term) => text.includes(term))).map(([name]) => name);
}

function deriveExperience(job) {
  const text = `${job.title} ${job.description ?? ""} ${job.requirement ?? ""}`;
  const patterns = [
    /(\d+)\s*[-~至]\s*(\d+)\s*年/, /(\d+)\s*年以上/, /(\d+)\s*年及以上/, /经验[：:]?\s*(\d+)\s*年/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { min: Number(match[1]), max: match[2] ? Number(match[2]) : null, basis: "derived_from_source_text" };
  }
  return { min: null, max: null, basis: "not_disclosed" };
}

function normalizeJob(job, fetchedAt) {
  const parentCategory = job.job_category?.parent ?? null;
  const cities = (job.city_list ?? (job.city_info ? [job.city_info] : [])).map((city) => ({ code: city.code ?? "", zh: city.name ?? "", en: city.en_name ?? "" }));
  return {
    post_id: String(job.id ?? ""),
    code: job.code ?? "",
    title_zh: job.title ?? "",
    title_en: job.title ?? "",
    subtitle: job.sub_title ?? "",
    category_zh: job.job_category?.name ?? "未分类",
    category_en: job.job_category?.en_name ?? job.job_category?.name ?? "Uncategorized",
    parent_category_zh: parentCategory?.name ?? job.job_category?.name ?? "未分类",
    parent_category_en: parentCategory?.en_name ?? job.job_category?.en_name ?? "Uncategorized",
    location: cities,
    recruitment_type_zh: job.recruit_type?.name ?? "正式",
    recruitment_type_en: job.recruit_type?.en_name ?? "Regular",
    publish_time: job.publish_time ?? null,
    publish_time_iso: job.publish_time ? new Date(job.publish_time).toISOString() : null,
    description_zh: cleanHtml(job.description ?? ""),
    requirement_zh: cleanHtml(job.requirement ?? ""),
    experience: deriveExperience(job),
    signal_tags: deriveSignals(job),
    source_url: `${SOURCE_URL}/${encodeURIComponent(String(job.id ?? ""))}/detail`,
    source_api: API_URL,
    fetched_at: fetchedAt,
  };
}

async function fetchPage(offset, attempt = 1) {
  const payload = JSON.stringify({
    keyword: "",
    limit: PAGE_SIZE,
    offset,
    portal_type: 3,
    portal_entrance: 1,
    language: "zh",
    recruitment_id_list: ["101"],
  });
  try {
    const { stdout } = await execFileAsync("curl", ["-L", "--max-time", "45", "-sS", "-X", "POST", API_URL, ...apiHeaders.flatMap((header) => ["-H", header]), "--data-binary", payload], { maxBuffer: 32 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    if (result.code !== 0) throw new Error(result.message ?? `upstream code ${result.code}`);
    return result;
  } catch (error) {
    if (attempt < 3) {
      await sleep(450 * attempt);
      return fetchPage(offset, attempt + 1);
    }
    throw error;
  }
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const first = await fetchPage(0);
  const reportedTotal = Number(first.data?.count ?? 0);
  if (!reportedTotal) throw new Error("Source returned no reported total");

  const pages = new Map([[0, first.data?.job_post_list ?? []]]);
  const offsets = Array.from({ length: Math.ceil(reportedTotal / PAGE_SIZE) - 1 }, (_, index) => (index + 1) * PAGE_SIZE);
  const failures = [];
  const concurrency = 5;
  for (let cursor = 0; cursor < offsets.length; cursor += concurrency) {
    const batch = offsets.slice(cursor, cursor + concurrency);
    const results = await Promise.all(batch.map(async (offset) => {
      try {
        const result = await fetchPage(offset);
        return { offset, rows: result.data?.job_post_list ?? [] };
      } catch (error) {
        return { offset, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    for (const result of results) {
      if (result.error) failures.push(result);
      else pages.set(result.offset, result.rows);
    }
    await sleep(110);
    process.stdout.write(`Fetched ${Math.min(reportedTotal, (cursor + batch.length + 1) * PAGE_SIZE)} / ${reportedTotal}\n`);
  }

  const rawRows = [...pages.entries()].sort(([a], [b]) => a - b).flatMap(([, rows]) => rows);
  const seen = new Set();
  const normalized = [];
  let duplicateCount = 0;
  for (const row of rawRows) {
    const id = String(row.id ?? "");
    if (!id || seen.has(id)) { duplicateCount += 1; continue; }
    seen.add(id);
    normalized.push(normalizeJob(row, fetchedAt));
  }
  const manifest = {
    source_url: SOURCE_URL,
    source_api: API_URL,
    portal_channel: CHANNEL,
    recruitment_id: "101",
    fetched_at: fetchedAt,
    reported_total: reportedTotal,
    requested_pages: Math.ceil(reportedTotal / PAGE_SIZE),
    fetched_pages: pages.size,
    failed_pages: failures,
    raw_rows: rawRows.length,
    unique_rows: normalized.length,
    duplicate_rows: duplicateCount,
    missing_rows: Math.max(0, reportedTotal - normalized.length),
    complete: failures.length === 0 && normalized.length >= reportedTotal,
    validation: {
      every_row_has_id: normalized.every((job) => Boolean(job.post_id)),
      every_row_has_title: normalized.every((job) => Boolean(job.title_zh)),
      every_row_has_source_url: normalized.every((job) => Boolean(job.source_url)),
      unique_id_count_matches_rows: new Set(normalized.map((job) => job.post_id)).size === normalized.length,
    },
  };
  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/bytedance-social-jobs.json", JSON.stringify({ manifest, jobs: normalized }));
  await writeFile("public/data/bytedance-source-manifest.json", JSON.stringify(manifest, null, 2));
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
