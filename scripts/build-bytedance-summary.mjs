import { readFile, writeFile } from "node:fs/promises";

const snapshot = JSON.parse(await readFile("public/data/bytedance-social-jobs.json", "utf8"));
const jobs = snapshot.jobs;
const countBy = (items, getKey) => {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || "未披露";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};
const toExperienceBucket = (job) => {
  const min = job.experience?.min;
  if (min === null || min === undefined) return "未披露";
  if (min < 1) return "0-1年";
  if (min < 3) return "1-3年";
  if (min < 5) return "3-5年";
  if (min < 8) return "5-8年";
  return "8年以上";
};
const cityCounts = new Map();
for (const job of jobs) for (const city of job.location ?? []) {
  const current = cityCounts.get(city.zh) ?? { name: city.zh, name_en: city.en, value: 0 };
  current.value += 1;
  cityCounts.set(city.zh, current);
}
const tagCounts = countBy(jobs.flatMap((job) => job.signal_tags ?? []), (tag) => tag);
const aiJobs = jobs.filter((job) => (job.signal_tags ?? []).includes("ai"));
const ecommerceJobs = jobs.filter((job) => (job.signal_tags ?? []).includes("ecommerce"));
const rdJobs = jobs.filter((job) => job.parent_category_zh === "研发");
const newest = [...jobs].sort((a, b) => Number(b.publish_time ?? 0) - Number(a.publish_time ?? 0)).slice(0, 24);
const summary = {
  source: snapshot.manifest,
  dimensions: [
    { id: "parent_category", field: "parent_category_zh", label_zh: "岗位类别", label_en: "Job category", type: "categorical", source: "job_category.parent" },
    { id: "category", field: "category_zh", label_zh: "细分职能", label_en: "Function", type: "categorical", source: "job_category" },
    { id: "location", field: "location", label_zh: "工作地点", label_en: "Location", type: "multi_value", source: "city_list" },
    { id: "experience", field: "experience", label_zh: "经验要求", label_en: "Experience", type: "derived", source: "description + requirement" },
    { id: "signal_tags", field: "signal_tags", label_zh: "业务信号", label_en: "Business signals", type: "multi_value", source: "title + description + requirement" },
  ],
  metrics: { total: jobs.length, categories: new Set(jobs.map((job) => job.parent_category_zh)).size, cities: cityCounts.size, ai_jobs: aiJobs.length, ecommerce_jobs: ecommerceJobs.length },
  category_counts: countBy(jobs, (job) => job.parent_category_zh),
  function_counts: countBy(jobs, (job) => job.category_zh).slice(0, 20),
  city_counts: [...cityCounts.values()].sort((a, b) => b.value - a.value),
  experience_counts: countBy(jobs, toExperienceBucket),
  rd_experience_counts: countBy(rdJobs, toExperienceBucket),
  ai_experience_counts: countBy(aiJobs, toExperienceBucket),
  ecommerce_experience_counts: countBy(ecommerceJobs, toExperienceBucket),
  signal_counts: tagCounts,
  ai_category_counts: countBy(aiJobs, (job) => job.parent_category_zh),
  ai_city_counts: countBy(aiJobs.flatMap((job) => job.location ?? []), (city) => city.zh),
  ecommerce_category_counts: countBy(ecommerceJobs, (job) => job.parent_category_zh),
  newest,
};
await writeFile("public/data/bytedance-dashboard-summary.json", JSON.stringify(summary));
console.log(JSON.stringify({ total: summary.metrics.total, categories: summary.metrics.categories, cities: summary.metrics.cities, ai_jobs: summary.metrics.ai_jobs, bytes: Buffer.byteLength(JSON.stringify(summary)) }));
