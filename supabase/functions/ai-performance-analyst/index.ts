import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/$/, "");
const SERVICE_ROLE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

const MAX_EXPORT_ROWS = 500;

type Json = Record<string, any>;

type AnalystData = {
  students: Json[];
  history: Json[];
  faculties: Json[];
  challenges: Json[];
  challengeResults: Json[];
  codingTests: Json[];
  codingAttempts: Json[];
};

function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function number(value: any): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: any): string {
  return String(value ?? "").trim();
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysAgoIso(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function restFetchAll(table: string, params: Record<string, string> = {}): Promise<Json[]> {
  const result: Json[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set("select", params.select ?? "*");

    for (const [key, value] of Object.entries(params)) {
      if (key !== "select" && value !== "") url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${table} read failed (${response.status}): ${body.slice(0, 400)}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error(`Unexpected ${table} response.`);

    result.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;

    if (offset > 50000) throw new Error(`Too many rows while reading ${table}.`);
  }

  return result;
}

async function loadAnalystData(): Promise<AnalystData> {
  const [
    students,
    history,
    faculties,
    challenges,
    challengeResults,
    codingTests,
    codingAttempts,
  ] = await Promise.all([
    restFetchAll("student_performance_current", { select: "*" }),
    restFetchAll("student_performance_history", { select: "*", "snapshot_date": `gte.${daysAgoIso(35)}` }),
    restFetchAll("faculties", { select: "*" }),
    restFetchAll("daily_challenges", { select: "*", "challenge_date": `gte.${daysAgoIso(35)}` }),
    restFetchAll("daily_challenge_results", { select: "*", "checked_at": `gte.${daysAgoIso(40)}T00:00:00Z` }),
    restFetchAll("coding_tests", { select: "*", order: "starts_at.desc" }),
    restFetchAll("coding_attempts", { select: "*", order: "started_at.desc" }),
  ]);

  return {
    students,
    history,
    faculties,
    challenges,
    challengeResults,
    codingTests,
    codingAttempts,
  };
}

function buildChallengeStats(data: AnalystData) {
  const challengeById = new Map(data.challenges.map((row) => [String(row.id), row]));
  const byRegister = new Map<string, { completedDates: Set<string>; totalCompleted: number }>();

  for (const result of data.challengeResults) {
    if (!result.completed) continue;
    const challenge = challengeById.get(String(result.challenge_id));
    if (!challenge) continue;
    const register = normalize(result.register_number);
    if (!register) continue;

    const stats = byRegister.get(register) ?? { completedDates: new Set<string>(), totalCompleted: 0 };
    stats.completedDates.add(String(challenge.challenge_date));
    stats.totalCompleted += 1;
    byRegister.set(register, stats);
  }

  const publishedDates = data.challenges
    .map((row) => String(row.challenge_date))
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const today = todayIso();
  const weekStart = daysAgoIso(6);
  const monthStart = daysAgoIso(29);

  return (register: string) => {
    const stats = byRegister.get(register) ?? { completedDates: new Set<string>(), totalCompleted: 0 };
    const completed = stats.completedDates;

    const weekChallenges = publishedDates.filter((date) => date >= weekStart && date <= today);
    const monthChallenges = publishedDates.filter((date) => date >= monthStart && date <= today);

    const weekCompleted = weekChallenges.filter((date) => completed.has(date)).length;
    const monthCompleted = monthChallenges.filter((date) => completed.has(date)).length;

    let currentStreak = 0;
    for (const date of publishedDates) {
      if (date > today) continue;
      if (completed.has(date)) currentStreak += 1;
      else break;
    }

    return {
      challenge_today_completed: completed.has(today),
      challenge_7_completed: weekCompleted,
      challenge_7_total: weekChallenges.length,
      challenge_7_rate: weekChallenges.length ? +(weekCompleted / weekChallenges.length * 100).toFixed(1) : 0,
      challenge_30_completed: monthCompleted,
      challenge_30_total: monthChallenges.length,
      challenge_30_rate: monthChallenges.length ? +(monthCompleted / monthChallenges.length * 100).toFixed(1) : 0,
      challenge_current_streak: currentStreak,
      challenge_total_completed: stats.totalCompleted,
    };
  };
}

function buildCodingStats(data: AnalystData) {
  const testById = new Map(data.codingTests.map((row) => [String(row.id), row]));
  const grouped = new Map<string, Json[]>();

  for (const attempt of data.codingAttempts) {
    if (!["submitted", "expired"].includes(String(attempt.status))) continue;
    const register = normalize(attempt.register_number);
    if (!register) continue;
    const rows = grouped.get(register) ?? [];
    rows.push(attempt);
    grouped.set(register, rows);
  }

  return (register: string) => {
    const attempts = (grouped.get(register) ?? []).sort((a, b) =>
      String(b.submitted_at ?? b.started_at ?? "").localeCompare(String(a.submitted_at ?? a.started_at ?? ""))
    );

    const percents = attempts.map((attempt) => {
      const test = testById.get(String(attempt.test_id));
      const totalMarks = number(test?.total_marks);
      return totalMarks > 0 ? number(attempt.total_score) / totalMarks * 100 : 0;
    });

    const passed = attempts.filter((row) => row.result_status === "passed").length;
    const latest = attempts[0] ?? null;

    return {
      coding_tests_attended: attempts.length,
      coding_tests_passed: passed,
      coding_pass_rate: attempts.length ? +(passed / attempts.length * 100).toFixed(1) : 0,
      coding_average_score: percents.length ? +(percents.reduce((a, b) => a + b, 0) / percents.length).toFixed(1) : 0,
      coding_best_score: percents.length ? +Math.max(...percents).toFixed(1) : 0,
      coding_violations: attempts.reduce((sum, row) => sum + number(row.violation_count), 0),
      coding_cases_passed: attempts.reduce((sum, row) => sum + number(row.passed_cases), 0),
      coding_cases_total: attempts.reduce((sum, row) => sum + number(row.total_cases), 0),
      coding_latest_result: latest?.result_status ?? "not_attended",
      coding_latest_test: latest ? (testById.get(String(latest.test_id))?.title ?? "Coding Test") : "",
    };
  };
}

function enrichStudents(data: AnalystData): Json[] {
  const challengeFor = buildChallengeStats(data);
  const codingFor = buildCodingStats(data);

  return data.students.map((student) => ({
    register_number: normalize(student.register_number),
    student_name: normalize(student.student_name),
    section: normalize(student.section),
    leetcode_username: normalize(student.leetcode_username),
    total_solved: number(student.total_solved),
    solved_today: number(student.solved_today),
    last_7_days: number(student.last_7_days),
    last_30_days: number(student.last_30_days),
    total_submissions: number(student.total_submissions),
    easy: number(student.easy),
    medium: number(student.medium),
    hard: number(student.hard),
    last_problem: normalize(student.last_problem),
    last_solved: normalize(student.last_solved),
    status: normalize(student.status),
    overall_rank: student.overall_rank,
    section_rank: student.section_rank,
    ...challengeFor(normalize(student.register_number)),
    ...codingFor(normalize(student.register_number)),
  }));
}

const metricMap: Record<string, string> = {
  today: "solved_today",
  week: "last_7_days",
  month: "last_30_days",
  total: "total_solved",
  challenge_week: "challenge_7_rate",
  coding_pass_rate: "coding_pass_rate",
  coding_average: "coding_average_score",
};

function sortRows(rows: Json[], metric: string, order: string): Json[] {
  const field = metricMap[metric] ?? metric;
  const direction = order === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const diff = number(a[field]) - number(b[field]);
    if (diff !== 0) return diff * direction;
    return normalize(a.student_name ?? a.faculty_name).localeCompare(normalize(b.student_name ?? b.faculty_name));
  });
}

function findStudent(students: Json[], identifier: string): Json | null {
  const value = normalize(identifier).toLowerCase();
  if (!value) return null;

  return students.find((row) =>
    normalize(row.register_number).toLowerCase() === value ||
    normalize(row.leetcode_username).toLowerCase() === value ||
    normalize(row.student_name).toLowerCase() === value
  ) ?? students.find((row) => normalize(row.student_name).toLowerCase().includes(value)) ?? null;
}

function sectionSummary(students: Json[], requested: string[] = []): Json[] {
  const sectionNames = requested.length
    ? requested
    : [...new Set(students.map((row) => normalize(row.section)).filter(Boolean))].sort();

  return sectionNames.map((section) => {
    const rows = students.filter((row) => normalize(row.section).toLowerCase() === section.toLowerCase());
    const attended = rows.filter((row) => number(row.coding_tests_attended) > 0).length;
    const codingPassValues = rows.filter((row) => number(row.coding_tests_attended) > 0).map((row) => number(row.coding_pass_rate));
    const challengeRates = rows.map((row) => number(row.challenge_7_rate));

    return {
      section,
      students: rows.length,
      active_today: rows.filter((row) => number(row.solved_today) > 0).length,
      active_7_days: rows.filter((row) => number(row.last_7_days) > 0).length,
      solved_today: rows.reduce((sum, row) => sum + number(row.solved_today), 0),
      solved_7_days: rows.reduce((sum, row) => sum + number(row.last_7_days), 0),
      solved_30_days: rows.reduce((sum, row) => sum + number(row.last_30_days), 0),
      avg_7_days: rows.length ? +(rows.reduce((sum, row) => sum + number(row.last_7_days), 0) / rows.length).toFixed(2) : 0,
      challenge_7_completion_rate: challengeRates.length ? +(challengeRates.reduce((a,b)=>a+b,0)/challengeRates.length).toFixed(1) : 0,
      coding_attendance: attended,
      coding_pass_rate: codingPassValues.length ? +(codingPassValues.reduce((a,b)=>a+b,0)/codingPassValues.length).toFixed(1) : 0,
    };
  });
}

function attentionRows(students: Json[], section: string | null, limit: number): Json[] {
  let rows = students;
  if (section) rows = rows.filter((row) => normalize(row.section).toLowerCase() === section.toLowerCase());

  return rows.map((row) => {
    let score = 0;
    const reasons: string[] = [];

    if (number(row.last_7_days) === 0) { score += 4; reasons.push("No LeetCode activity in 7 days"); }
    else if (number(row.last_7_days) <= 2) { score += 2; reasons.push("Low 7-day LeetCode activity"); }

    if (number(row.last_30_days) <= 4) { score += 1; reasons.push("Low 30-day activity"); }
    if (number(row.challenge_7_total) > 0 && number(row.challenge_7_rate) < 50) { score += 2; reasons.push("Daily Challenge completion below 50%"); }
    if (number(row.coding_tests_attended) > 0 && number(row.coding_pass_rate) < 50) { score += 2; reasons.push("Coding Test pass rate below 50%"); }
    if (row.coding_latest_result === "failed") { score += 1; reasons.push("Failed latest Coding Test"); }
    if (normalize(row.status) && normalize(row.status) !== "Success") { score += 1; reasons.push(`Tracker status: ${row.status}`); }

    return { ...row, attention_score: score, attention_reasons: reasons.join("; ") || "No major concern" };
  }).filter((row) => row.attention_score > 0)
    .sort((a, b) => b.attention_score - a.attention_score || number(a.last_7_days) - number(b.last_7_days))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}

function facultyRows(data: AnalystData): Json[] {
  return data.faculties.map((row) => ({
    faculty_id: normalize(row.faculty_id),
    faculty_name: normalize(row.faculty_name),
    designation: normalize(row.designation),
    department: normalize(row.department),
    email: normalize(row.email),
    leetcode_username: normalize(row.leetcode_username),
    total_solved: number(row.total_solved),
    solved_today: number(row.solved_today),
    last_7_days: number(row.last_7_days),
    last_30_days: number(row.last_30_days),
    easy: number(row.easy),
    medium: number(row.medium),
    hard: number(row.hard),
    total_submissions: number(row.total_submissions),
    last_problem: normalize(row.last_problem),
    last_solved: normalize(row.last_solved),
    status: normalize(row.status),
  }));
}

function codingReport(data: AnalystData, students: Json[], latestOnly: boolean, resultStatus: string | null, section: string | null): Json[] {
  const studentByReg = new Map(students.map((row) => [normalize(row.register_number), row]));
  const testById = new Map(data.codingTests.map((row) => [String(row.id), row]));
  const testsSorted = [...data.codingTests].sort((a,b)=>String(b.starts_at??"").localeCompare(String(a.starts_at??"")));
  const latestId = testsSorted[0] ? String(testsSorted[0].id) : null;

  return data.codingAttempts
    .filter((attempt) => ["submitted", "expired"].includes(String(attempt.status)))
    .filter((attempt) => !latestOnly || String(attempt.test_id) === latestId)
    .map((attempt) => {
      const student = studentByReg.get(normalize(attempt.register_number)) ?? {};
      const test = testById.get(String(attempt.test_id)) ?? {};
      const totalMarks = number(test.total_marks);
      const scorePercent = totalMarks > 0 ? +(number(attempt.total_score) / totalMarks * 100).toFixed(1) : 0;
      return {
        register_number: normalize(attempt.register_number),
        student_name: normalize(student.student_name),
        section: normalize(student.section),
        test_title: normalize(test.title),
        result: normalize(attempt.result_status),
        score: number(attempt.total_score),
        total_marks: totalMarks,
        score_percent: scorePercent,
        passed_cases: number(attempt.passed_cases),
        total_cases: number(attempt.total_cases),
        violations: number(attempt.violation_count),
        submitted_at: normalize(attempt.submitted_at),
      };
    })
    .filter((row) => !resultStatus || row.result.toLowerCase() === resultStatus.toLowerCase())
    .filter((row) => !section || row.section.toLowerCase() === section.toLowerCase());
}

function challengeReport(data: AnalystData, students: Json[], period: string, completion: string, section: string | null): Json[] {
  const studentByReg = new Map(students.map((row) => [normalize(row.register_number), row]));
  const days = period === "today" ? 0 : period === "30_days" ? 29 : 6;
  const start = daysAgoIso(days);
  const end = todayIso();
  const challenges = data.challenges.filter((row) => String(row.challenge_date) >= start && String(row.challenge_date) <= end);
  const resultKey = new Set(data.challengeResults.filter((r)=>r.completed).map((r)=>`${r.challenge_id}|${normalize(r.register_number)}`));
  const rows: Json[] = [];

  for (const challenge of challenges) {
    for (const student of students) {
      if (section && normalize(student.section).toLowerCase() !== section.toLowerCase()) continue;
      const completed = resultKey.has(`${challenge.id}|${student.register_number}`);
      if (completion === "completed" && !completed) continue;
      if (completion === "pending" && completed) continue;
      rows.push({
        challenge_date: challenge.challenge_date,
        challenge: challenge.problem_title,
        difficulty: challenge.difficulty,
        register_number: student.register_number,
        student_name: student.student_name,
        section: student.section,
        completed,
      });
    }
  }

  return rows;
}

function exportRowsForArgs(args: Json, data: AnalystData, students: Json[]): Json[] {
  const limit = Math.min(Math.max(number(args.limit) || 50, 1), MAX_EXPORT_ROWS);
  const section = args.section ? normalize(args.section) : null;
  const order = args.order === "asc" ? "asc" : "desc";
  const metric = normalize(args.metric) || "week";
  const dataset = normalize(args.dataset);

  if (dataset === "top_students" || dataset === "students") {
    let rows = students;
    if (section) rows = rows.filter((row) => row.section.toLowerCase() === section.toLowerCase());
    return sortRows(rows, metric, order).slice(0, limit);
  }
  if (dataset === "attention_students") return attentionRows(students, section, limit);
  if (dataset === "faculty") {
    let rows = facultyRows(data);
    if (section) rows = rows.filter((row) => row.department.toLowerCase() === section.toLowerCase());
    const field = metricMap[metric] ?? metric;
    return [...rows].sort((a,b)=>(number(a[field])-number(b[field]))*(order==="asc"?1:-1)).slice(0, limit);
  }
  if (dataset === "sections") return sectionSummary(students, args.sections ?? []).slice(0, limit);
  if (dataset === "coding_test_results") return codingReport(data, students, Boolean(args.latest_only), args.result_status ? normalize(args.result_status) : null, section).slice(0, limit);
  if (dataset === "daily_challenge") return challengeReport(data, students, normalize(args.period)||"7_days", normalize(args.completion)||"all", section).slice(0, limit);
  if (dataset === "student_profiles") {
    const identifiers: string[] = Array.isArray(args.identifiers) ? args.identifiers : [];
    return identifiers.map((id)=>findStudent(students,id)).filter(Boolean) as Json[];
  }

  throw new Error(`Unsupported export dataset: ${dataset}`);
}

function exportFriendlyRows(rows: Json[]): Json[] {
  return rows.map((row) => {
    const output: Json = {};
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith("_") || typeof value === "object") continue;
      output[key.replaceAll("_", " ").replace(/\b\w/g, (c)=>c.toUpperCase())] = value;
    }
    return output;
  });
}

function csvEscape(value: any): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i=0;i<bytes.length;i+=chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i+chunk, bytes.length)));
  }
  return btoa(binary);
}

function makeCsv(rows: Json[]): Uint8Array {
  const friendly = exportFriendlyRows(rows);
  const columns = friendly.length ? Object.keys(friendly[0]) : ["Result"];
  const lines = [columns.map(csvEscape).join(",")];
  for (const row of friendly) lines.push(columns.map((column)=>csvEscape(row[column])).join(","));
  return new TextEncoder().encode("\uFEFF" + lines.join("\r\n"));
}

function makeXlsx(rows: Json[], title: string): Uint8Array {
  const friendly = exportFriendlyRows(rows);
  const sheet = XLSX.utils.json_to_sheet(friendly.length ? friendly : [{ Result: "No matching data" }]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Report");
  book.Props = { Title: title, Subject: "ECE AI Performance Analyst Report", Author: "ECE Coding Skills Tracker" };
  const array = XLSX.write(book, { type: "array", bookType: "xlsx" });
  return new Uint8Array(array);
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function makePdf(rows: Json[], title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const friendly = exportFriendlyRows(rows);
  const pageSize: [number, number] = [842, 595];
  const margin = 42;
  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const drawTitle = () => {
    page.drawText(title.slice(0, 95), { x: margin, y, size: 16, font: bold, color: rgb(0.08,0.14,0.26) });
    y -= 24;
    page.drawText(`Generated: ${new Date().toISOString()} | Rows: ${friendly.length}`, { x: margin, y, size: 8, font, color: rgb(.35,.4,.48) });
    y -= 20;
  };

  const newPage = () => {
    page = doc.addPage(pageSize);
    y = pageSize[1] - margin;
    drawTitle();
  };

  drawTitle();

  if (!friendly.length) {
    page.drawText("No matching data.", { x: margin, y, size: 11, font });
    return await doc.save();
  }

  for (let index=0; index<friendly.length; index++) {
    const row = friendly[index];
    const text = `${index+1}. ` + Object.entries(row).map(([k,v])=>`${k}: ${v}`).join(" | ");
    const lines = wrapText(text, 145);
    const height = lines.length * 10 + 8;
    if (y - height < margin) newPage();

    for (const line of lines) {
      page.drawText(line.slice(0, 180), { x: margin, y, size: 7.5, font, color: rgb(.12,.16,.23) });
      y -= 10;
    }
    y -= 5;
  }

  return await doc.save();
}

async function createDownload(args: Json, data: AnalystData, students: Json[]) {
  const rows = exportRowsForArgs(args, data, students);
  const format = normalize(args.format).toLowerCase();
  const title = normalize(args.title) || "ECE AI Performance Report";
  const safeTitle = title.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 70) || "ECE_AI_Report";

  let bytes: Uint8Array;
  let mime = "text/csv;charset=utf-8";
  let extension = "csv";

  if (format === "xlsx" || format === "excel") {
    bytes = makeXlsx(rows, title);
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    extension = "xlsx";
  } else if (format === "pdf") {
    bytes = await makePdf(rows, title);
    mime = "application/pdf";
    extension = "pdf";
  } else {
    bytes = makeCsv(rows);
  }

  return {
    filename: `${safeTitle}.${extension}`,
    mime_type: mime,
    data_base64: toBase64(bytes),
    description: `${rows.length} row(s) generated from current tracked data`,
    row_count: rows.length,
  };
}


// ============================================================================
// BUILT-IN SMART ANALYZER
// No OpenAI / Gemini / external LLM is required.
// The analyzer parses supported natural-language intents deterministically,
// calculates answers from Supabase data, and generates XLSX/PDF/CSV exports.
// ============================================================================

type ParsedIntent = {
  kind: string;
  metric: string;
  order: "asc" | "desc";
  limit: number;
  section: string | null;
  sections: string[];
  identifiers: string[];
  format: "xlsx" | "pdf" | "csv" | null;
  latestOnly: boolean;
  resultStatus: string | null;
  period: string;
  completion: string;
  needsDownload: boolean;
  raw: string;
};

function lower(value: any): string {
  return normalize(value).toLowerCase();
}

function containsAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function extractLimit(text: string, fallback = 10): number {
  const patterns = [
    /\btop\s+(\d{1,3})\b/i,
    /\bbottom\s+(\d{1,3})\b/i,
    /\bfirst\s+(\d{1,3})\b/i,
    /\blast\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s+(?:students?|facult(?:y|ies)|members?|performers?|rows?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Math.max(1, Math.min(Number(match[1]), MAX_EXPORT_ROWS));
  }

  return fallback;
}

function extractSection(text: string): string | null {
  const match = text.match(/\b(?:ece\s*)?([a-f])\b/i);
  if (!match) return null;

  const candidate = `ECE ${match[1].toUpperCase()}`;
  const context = lower(text);

  if (
    context.includes("section") ||
    context.includes("ece") ||
    context.includes("compare") ||
    context.includes("students") ||
    context.includes("faculty")
  ) {
    return candidate;
  }

  return null;
}

function extractSections(text: string): string[] {
  const matches = [...text.matchAll(/\b(?:ece\s*)?([a-f])\b/gi)]
    .map((match) => `ECE ${match[1].toUpperCase()}`);

  return [...new Set(matches)];
}

function extractRegisterNumbers(text: string): string[] {
  return [...new Set(
    (text.match(/\b\d{8,15}\b/g) ?? []).map((value) => value.trim())
  )];
}

function extractFormat(text: string): "xlsx" | "pdf" | "csv" | null {
  const t = lower(text);
  if (containsAny(t, ["excel", "xlsx", "spreadsheet"])) return "xlsx";
  if (t.includes("pdf")) return "pdf";
  if (t.includes("csv")) return "csv";
  return null;
}

function extractMetric(text: string): string {
  const t = lower(text);

  if (containsAny(t, ["today", "daily", "solved today"])) return "today";
  if (containsAny(t, ["30 day", "30-day", "month", "monthly", "this month"])) return "month";
  if (containsAny(t, ["7 day", "7-day", "week", "weekly", "this week"])) return "week";
  if (containsAny(t, ["challenge", "streak"])) return "challenge_week";
  if (containsAny(t, ["coding pass", "pass rate", "test pass"])) return "coding_pass_rate";
  if (containsAny(t, ["average score", "coding average", "test average"])) return "coding_average";
  if (containsAny(t, ["total solved", "overall solved", "all time", "all-time", "total"])) return "total";

  return "week";
}

function removeExportWords(text: string): string {
  return text
    .replace(/\b(?:download|export|file|report|attachment|excel|xlsx|spreadsheet|pdf|csv)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveContext(message: string, history: Json[]): string {
  const t = lower(message);
  const vague = /\b(?:this|that|it|same|above|previous|download it|export it)\b/i.test(message);
  const hasStandaloneExport = Boolean(extractFormat(message)) || containsAny(t, ["download", "export", "file", "report"]);

  if (!vague || !hasStandaloneExport) return message;

  const previousUser = [...history]
    .reverse()
    .find((item) => item?.role === "user" && normalize(item?.content));

  return previousUser
    ? `${normalize(previousUser.content)}. ${message}`
    : message;
}

function parseIntent(message: string, history: Json[]): ParsedIntent {
  const contextual = resolveContext(message, history);
  const t = lower(contextual);
  const format = extractFormat(contextual);
  const sections = extractSections(contextual);
  const section = sections.length === 1 ? sections[0] : extractSection(contextual);
  const registers = extractRegisterNumbers(contextual);
  const metric = extractMetric(contextual);
  const isBottom = containsAny(t, ["bottom", "lowest", "least", "worst", "weakest"]);
  const needsDownload = Boolean(format) || containsAny(t, ["download", "export", "file", "attachment"]);

  let kind = "help";
  let limit = extractLimit(contextual, 10);
  let resultStatus: string | null = null;
  let latestOnly = containsAny(t, ["latest", "most recent", "current test"]);
  let period = metric === "today" ? "today" : metric === "month" ? "30_days" : "7_days";
  let completion = "all";

  if (containsAny(t, ["faculty", "faculties", "teacher", "staff"])) {
    kind = "faculty_rank";
  }

  if (containsAny(t, ["coding test", "coding-test", "test result", "test failed", "failed students", "passed students"])) {
    kind = "coding_test";
    if (containsAny(t, ["fail", "failed", "not passed"])) resultStatus = "failed";
    if (containsAny(t, ["pass", "passed", "successful"])) resultStatus = "passed";
  }

  if (containsAny(t, ["daily challenge", "challenge completion", "challenge pending", "challenge completed"])) {
    kind = "daily_challenge";
    if (containsAny(t, ["pending", "not completed", "incomplete"])) completion = "pending";
    if (containsAny(t, ["completed", "finished", "done"])) completion = "completed";
  }

  if (containsAny(t, ["inactive", "not active", "no activity", "zero activity"])) {
    kind = "inactive";
    limit = extractLimit(contextual, 50);
  }

  if (containsAny(t, ["need attention", "needs attention", "requiring attention", "at risk", "weak students"])) {
    kind = "attention";
    limit = extractLimit(contextual, 20);
  }

  if (containsAny(t, ["compare section", "section comparison", "compare ece"]) || (t.includes("compare") && sections.length >= 2)) {
    kind = "compare_sections";
  }

  if (t.includes("compare") && registers.length >= 2) {
    kind = "compare_students";
  }

  if (registers.length === 1 && containsAny(t, ["strength", "weakness", "analy", "profile", "performance", "improve", "recommend", "suggest", "question"])) {
    kind = "student_analysis";
  }

  if (containsAny(t, ["suggest question", "suggest problems", "recommend question", "recommend problems", "practice question", "practice problems"])) {
    kind = registers.length ? "recommend_student" : "recommend_group";
  }

  if (containsAny(t, ["best student", "top student", "top ", "rank", "ranking", "leaderboard", "highest", "bottom", "lowest", "worst student"])) {
    if (!containsAny(t, ["faculty", "coding test", "daily challenge"])) kind = "student_rank";
  }

  if (containsAny(t, ["best section", "top section", "section rank", "section ranking", "all sections"])) {
    kind = "section_rank";
  }

  if (needsDownload && kind === "help") {
    kind = "student_rank";
  }

  return {
    kind,
    metric,
    order: isBottom ? "asc" : "desc",
    limit,
    section,
    sections,
    identifiers: registers,
    format,
    latestOnly,
    resultStatus,
    period,
    completion,
    needsDownload,
    raw: contextual,
  };
}

function metricLabel(metric: string): string {
  const labels: Record<string, string> = {
    today: "Solved Today",
    week: "Last 7 Days",
    month: "Last 30 Days",
    total: "Total Solved",
    challenge_week: "7-Day Challenge Completion",
    coding_pass_rate: "Coding Test Pass Rate",
    coding_average: "Coding Test Average Score",
  };
  return labels[metric] ?? metric;
}

function metricValue(row: Json, metric: string): number {
  const field = metricMap[metric] ?? metric;
  return number(row[field]);
}

function pct(value: any): string {
  return `${number(value).toFixed(1)}%`;
}

function studentLabel(row: Json): string {
  return `${normalize(row.student_name) || "Student"} (${normalize(row.register_number) || "–"})`;
}

function formatTopRows(rows: Json[], metric: string, maxLines = 10): string {
  if (!rows.length) return "No matching students were found.";
  const label = metricLabel(metric);
  const suffix = ["challenge_week", "coding_pass_rate", "coding_average"].includes(metric) ? "%" : "";

  return rows.slice(0, maxLines).map((row, index) =>
    `${index + 1}. **${normalize(row.student_name) || "Student"}** — ${normalize(row.register_number)} — ${normalize(row.section)} — ${label}: ${metricValue(row, metric)}${suffix}`
  ).join("\n");
}

function strengthsAndWeaknesses(student: Json): { strengths: string[]; weaknesses: string[]; suggestions: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  const week = number(student.last_7_days);
  const month = number(student.last_30_days);
  const total = number(student.total_solved);
  const easy = number(student.easy);
  const medium = number(student.medium);
  const hard = number(student.hard);
  const challengeRate = number(student.challenge_7_rate);
  const codingRate = number(student.coding_pass_rate);
  const codingAttended = number(student.coding_tests_attended);

  if (week >= 10) strengths.push(`Strong weekly consistency (${week} problems in 7 days)`);
  else if (week >= 4) strengths.push(`Steady weekly activity (${week} problems in 7 days)`);
  else weaknesses.push(`Low weekly activity (${week} problems in 7 days)`);

  if (month >= 25) strengths.push(`Good 30-day practice volume (${month} problems)`);
  else if (month <= 8) weaknesses.push(`Low 30-day practice volume (${month} problems)`);

  const diffTotal = Math.max(1, easy + medium + hard);
  const mediumRatio = medium / diffTotal;
  const hardRatio = hard / diffTotal;

  if (medium >= 10 || mediumRatio >= 0.35) strengths.push(`Good Medium-problem exposure (${medium} solved)`);
  else weaknesses.push(`Medium-problem practice can improve (${medium} solved)`);

  if (hard >= 3 || hardRatio >= 0.08) strengths.push(`Has started building Hard-problem exposure (${hard} solved)`);
  else weaknesses.push(`Very limited Hard-problem exposure (${hard} solved)`);

  if (number(student.challenge_7_total) > 0) {
    if (challengeRate >= 80) strengths.push(`Excellent Daily Challenge consistency (${pct(challengeRate)})`);
    else if (challengeRate < 50) weaknesses.push(`Daily Challenge completion is below 50% (${pct(challengeRate)})`);
  }

  if (codingAttended > 0) {
    if (codingRate >= 80) strengths.push(`Strong Coding Test pass rate (${pct(codingRate)})`);
    else if (codingRate < 50) weaknesses.push(`Coding Test pass rate needs improvement (${pct(codingRate)})`);
  }

  if (total >= 100) strengths.push(`Strong overall problem-solving base (${total} total solved)`);

  if (week <= 2) suggestions.push("Restart consistency with 1–2 Easy/Medium problems per day.");
  if (medium < 10 || mediumRatio < 0.35) suggestions.push("Prioritize Medium problems from Arrays, Hashing, Two Pointers and Sliding Window.");
  if (hard < 3) suggestions.push("After Medium consistency improves, add one introductory Hard problem each week.");
  if (challengeRate < 50 && number(student.challenge_7_total) > 0) suggestions.push("Complete the Daily Challenge before additional practice to rebuild streak consistency.");
  if (codingAttended > 0 && codingRate < 50) suggestions.push("Practice timed implementation problems and test edge cases before submission.");

  return { strengths, weaknesses, suggestions };
}

const QUESTION_BANK = [
  { title: "Two Sum", difficulty: "Easy", topics: ["array", "hashmap"], reason: "hashing fundamentals" },
  { title: "Valid Anagram", difficulty: "Easy", topics: ["string", "hashmap"], reason: "frequency-map accuracy" },
  { title: "Best Time to Buy and Sell Stock", difficulty: "Easy", topics: ["array", "greedy"], reason: "single-pass array reasoning" },
  { title: "Valid Parentheses", difficulty: "Easy", topics: ["stack"], reason: "stack fundamentals" },
  { title: "Binary Search", difficulty: "Easy", topics: ["binary-search"], reason: "boundary handling" },
  { title: "Longest Substring Without Repeating Characters", difficulty: "Medium", topics: ["sliding-window", "hashmap"], reason: "variable sliding-window reasoning" },
  { title: "3Sum", difficulty: "Medium", topics: ["two-pointers", "sorting"], reason: "two-pointer pattern" },
  { title: "Container With Most Water", difficulty: "Medium", topics: ["two-pointers"], reason: "pointer movement reasoning" },
  { title: "Subarray Sum Equals K", difficulty: "Medium", topics: ["prefix-sum", "hashmap"], reason: "prefix sum + hashmap" },
  { title: "Daily Temperatures", difficulty: "Medium", topics: ["monotonic-stack"], reason: "monotonic stack pattern" },
  { title: "Top K Frequent Elements", difficulty: "Medium", topics: ["heap", "hashmap"], reason: "frequency + selection" },
  { title: "Merge Intervals", difficulty: "Medium", topics: ["intervals", "sorting"], reason: "interval reasoning" },
  { title: "Number of Islands", difficulty: "Medium", topics: ["graph", "dfs", "bfs"], reason: "graph traversal" },
  { title: "Kth Largest Element in an Array", difficulty: "Medium", topics: ["heap", "quickselect"], reason: "selection algorithms" },
  { title: "Largest Rectangle in Histogram", difficulty: "Hard", topics: ["monotonic-stack"], reason: "advanced stack boundaries" },
  { title: "Trapping Rain Water", difficulty: "Hard", topics: ["two-pointers", "prefix"], reason: "advanced boundary reasoning" },
  { title: "Sliding Window Maximum", difficulty: "Hard", topics: ["deque", "sliding-window"], reason: "advanced window optimization" },
];

function recommendQuestions(student: Json | null, count = 5): Json[] {
  const limit = Math.max(1, Math.min(count, 15));
  if (!student) return QUESTION_BANK.slice(0, limit);

  const easy = number(student.easy);
  const medium = number(student.medium);
  const hard = number(student.hard);
  const week = number(student.last_7_days);
  const codingRate = number(student.coding_pass_rate);

  let preferred: string[];
  if (week <= 2 || easy < 20) preferred = ["Easy", "Medium"];
  else if (medium < Math.max(10, easy * 0.35)) preferred = ["Medium", "Easy"];
  else if (hard < 3 && medium >= 10) preferred = ["Medium", "Hard"];
  else preferred = ["Medium", "Hard"];

  const ordered = [...QUESTION_BANK].sort((a, b) => {
    const ai = preferred.indexOf(a.difficulty);
    const bi = preferred.indexOf(b.difficulty);
    const ar = ai < 0 ? 99 : ai;
    const br = bi < 0 ? 99 : bi;
    if (ar !== br) return ar - br;
    if (codingRate < 50 && a.topics.includes("array")) return -1;
    return 0;
  });

  return ordered.slice(0, limit);
}

function summarizeSections(rows: Json[]): string {
  if (!rows.length) return "No matching section data is available.";

  return rows.map((row) =>
    `- **${row.section}**: ${row.students} students, ${row.solved_7_days} solved in 7 days, ${row.active_7_days} active in 7 days, avg ${row.avg_7_days}/student, challenge ${pct(row.challenge_7_completion_rate)}, coding pass ${pct(row.coding_pass_rate)}`
  ).join("\n");
}

function sectionPerformanceScore(row: Json): number {
  const studentCount = Math.max(1, number(row.students));
  const activityRate = number(row.active_7_days) / studentCount * 100;
  const avg7 = number(row.avg_7_days);
  const challenge = number(row.challenge_7_completion_rate);
  const coding = number(row.coding_pass_rate);

  // Normalized, explainable internal score — used only for relative section ordering.
  return +(Math.min(avg7 / 10 * 100, 100) * 0.40
    + Math.min(activityRate, 100) * 0.25
    + Math.min(challenge, 100) * 0.20
    + Math.min(coding, 100) * 0.15).toFixed(2);
}

function makeExportArgs(intent: ParsedIntent, students: Json[]): Json {
  let dataset = "top_students";
  let title = "ECE Performance Report";

  if (intent.kind === "attention") {
    dataset = "attention_students";
    title = "Students Needing Attention";
  } else if (intent.kind === "inactive") {
    dataset = "students";
    title = "Inactive Students";
  } else if (intent.kind === "faculty_rank") {
    dataset = "faculty";
    title = "Faculty LeetCode Performance";
  } else if (["compare_sections", "section_rank"].includes(intent.kind)) {
    dataset = "sections";
    title = "ECE Section Comparison";
  } else if (intent.kind === "coding_test") {
    dataset = "coding_test_results";
    title = intent.resultStatus === "failed" ? "Coding Test Failed Students" : "Coding Test Results";
  } else if (intent.kind === "daily_challenge") {
    dataset = "daily_challenge";
    title = "Daily Challenge Report";
  } else if (["student_analysis", "compare_students", "recommend_student"].includes(intent.kind)) {
    dataset = "student_profiles";
    title = "Student Performance Profiles";
  } else {
    title = `${intent.order === "asc" ? "Bottom" : "Top"} ${intent.limit} Students - ${metricLabel(intent.metric)}`;
  }

  return {
    format: intent.format ?? "xlsx",
    dataset,
    metric: intent.metric,
    section: intent.section,
    sections: intent.sections,
    identifiers: intent.identifiers,
    limit: intent.limit,
    order: intent.order,
    result_status: intent.resultStatus,
    latest_only: intent.latestOnly,
    period: intent.period,
    completion: intent.completion,
    title,
  };
}

function buildAnswer(intent: ParsedIntent, data: AnalystData, students: Json[]): { answer: string; rows?: Json[] } {
  if (intent.kind === "student_rank") {
    let rows = students;
    if (intent.section) rows = rows.filter((row) => lower(row.section) === lower(intent.section));
    rows = sortRows(rows, intent.metric, intent.order).slice(0, intent.limit);

    if (!rows.length) return { answer: "No matching student data was found." };

    const top = rows[0];
    const mode = intent.order === "asc" ? "lowest" : "highest";
    let answer = `## ${intent.order === "asc" ? "Bottom" : "Top"} ${rows.length} — ${metricLabel(intent.metric)}\n`;
    answer += formatTopRows(rows, intent.metric, Math.min(rows.length, 15));

    if (intent.order === "desc") {
      answer += `\n\n**Best match:** ${studentLabel(top)} has the ${mode} ${metricLabel(intent.metric).toLowerCase()} value of **${metricValue(top, intent.metric)}${["challenge_week","coding_pass_rate","coding_average"].includes(intent.metric) ? "%" : ""}**.`;
      const analysis = strengthsAndWeaknesses(top);
      if (analysis.strengths.length) answer += `\n\n**Why this student stands out**\n${analysis.strengths.slice(0,3).map((x)=>`- ${x}`).join("\n")}`;
    }

    return { answer, rows };
  }

  if (intent.kind === "student_analysis" || intent.kind === "recommend_student") {
    const student = findStudent(students, intent.identifiers[0] ?? "");
    if (!student) return { answer: "I could not find that student. Use the register number, exact student name or LeetCode username." };

    const analysis = strengthsAndWeaknesses(student);
    let answer = `## ${studentLabel(student)}\n`;
    answer += `Section: **${student.section}** | Today: **${student.solved_today}** | 7 Days: **${student.last_7_days}** | 30 Days: **${student.last_30_days}** | Total: **${student.total_solved}**\n`;
    answer += `Difficulty: Easy **${student.easy}**, Medium **${student.medium}**, Hard **${student.hard}**\n`;
    answer += `Daily Challenge (7d): **${student.challenge_7_completed}/${student.challenge_7_total} (${pct(student.challenge_7_rate)})** | Coding Test pass rate: **${pct(student.coding_pass_rate)}**\n`;

    if (analysis.strengths.length) answer += `\n### Strengths\n${analysis.strengths.map((x)=>`- ${x}`).join("\n")}`;
    if (analysis.weaknesses.length) answer += `\n\n### Areas to Improve\n${analysis.weaknesses.map((x)=>`- ${x}`).join("\n")}`;
    if (analysis.suggestions.length) answer += `\n\n### Suggested Actions\n${analysis.suggestions.map((x)=>`- ${x}`).join("\n")}`;

    if (intent.kind === "recommend_student" || containsAny(lower(intent.raw), ["question", "problem", "practice"])) {
      const recs = recommendQuestions(student, extractLimit(intent.raw, 5));
      answer += `\n\n### Recommended Problems\n${recs.map((q, i)=>`${i+1}. **${q.title}** — ${q.difficulty} — ${q.reason}`).join("\n")}`;
    }

    return { answer, rows: [student] };
  }

  if (intent.kind === "compare_students") {
    const rows = intent.identifiers.map((id)=>findStudent(students, id)).filter(Boolean) as Json[];
    if (rows.length < 2) return { answer: "Please provide at least two valid student register numbers for comparison." };

    const metric = intent.metric;
    const sorted = sortRows(rows, metric, "desc");
    let answer = `## Student Comparison — ${metricLabel(metric)}\n`;
    answer += formatTopRows(sorted, metric, sorted.length);
    answer += `\n\n**Leader:** ${studentLabel(sorted[0])}.`;
    return { answer, rows: sorted };
  }

  if (intent.kind === "compare_sections" || intent.kind === "section_rank") {
    let rows = sectionSummary(students, intent.sections);
    rows = rows.map((row)=>({ ...row, performance_score: sectionPerformanceScore(row) }))
      .sort((a,b)=>number(b.performance_score)-number(a.performance_score));

    let answer = `## Section Performance Comparison\n${summarizeSections(rows)}`;
    if (rows.length) answer += `\n\n**Current strongest section by the analyzer's balanced score:** **${rows[0].section}** (score ${rows[0].performance_score}). The score combines 7-day solving, active-student rate, Daily Challenge completion and Coding Test pass rate.`;
    return { answer, rows };
  }

  if (intent.kind === "attention") {
    const rows = attentionRows(students, intent.section, intent.limit);
    if (!rows.length) return { answer: "No students currently match the attention rules." };

    const answer = `## Students Needing Attention\n${rows.slice(0,15).map((row,i)=>`${i+1}. **${studentLabel(row)}** — Score ${row.attention_score} — ${row.attention_reasons}`).join("\n")}\n\nThe attention score is rule-based and uses recent LeetCode activity, Daily Challenge completion, Coding Test pass rate, latest test result and tracker status.`;
    return { answer, rows };
  }

  if (intent.kind === "inactive") {
    let rows = students.filter((row)=>number(row.last_7_days) === 0);
    if (intent.section) rows = rows.filter((row)=>lower(row.section)===lower(intent.section));
    rows = rows.sort((a,b)=>number(a.last_30_days)-number(b.last_30_days)).slice(0,intent.limit);
    const answer = rows.length
      ? `## Inactive Students — No LeetCode activity in 7 days\n${rows.slice(0,20).map((row,i)=>`${i+1}. **${studentLabel(row)}** — ${row.section} — 30 Days: ${row.last_30_days}`).join("\n")}\n\nTotal matching: **${rows.length}**.`
      : "No matching students have zero LeetCode activity in the last 7 days.";
    return { answer, rows };
  }

  if (intent.kind === "faculty_rank") {
    const faculty = facultyRows(data);
    const field = metricMap[intent.metric] ?? "last_7_days";
    const rows = [...faculty].sort((a,b)=>(number(a[field])-number(b[field]))*(intent.order === "asc" ? 1 : -1)).slice(0,intent.limit);
    if (!rows.length) return { answer: "No faculty LeetCode profiles are available yet." };

    const answer = `## Faculty LeetCode Ranking — ${metricLabel(intent.metric)}\n${rows.slice(0,15).map((row,i)=>`${i+1}. **${row.faculty_name}** — ${row.designation || row.department} — ${metricLabel(intent.metric)}: ${number(row[field])}`).join("\n")}`;
    return { answer, rows };
  }

  if (intent.kind === "coding_test") {
    const rows = codingReport(data, students, intent.latestOnly, intent.resultStatus, intent.section).slice(0,intent.limit);
    if (!rows.length) return { answer: "No Coding Test results match that request." };

    const passed = rows.filter((row)=>row.result === "passed").length;
    const failed = rows.filter((row)=>row.result === "failed").length;
    const avg = rows.length ? rows.reduce((sum,row)=>sum+number(row.score_percent),0)/rows.length : 0;
    let answer = `## Coding Test Analysis\nMatching attempts: **${rows.length}** | Passed: **${passed}** | Failed: **${failed}** | Average score: **${avg.toFixed(1)}%**\n`;
    answer += rows.slice(0,15).map((row,i)=>`${i+1}. **${studentLabel(row)}** — ${row.test_title} — ${row.result || "–"} — ${row.score_percent}% — Cases ${row.passed_cases}/${row.total_cases}`).join("\n");
    return { answer, rows };
  }

  if (intent.kind === "daily_challenge") {
    const rows = challengeReport(data, students, intent.period, intent.completion, intent.section).slice(0,intent.limit);
    if (!rows.length) return { answer: "No Daily Challenge rows match that request." };

    const completed = rows.filter((row)=>row.completed).length;
    const pending = rows.length - completed;
    const answer = `## Daily Challenge Analysis\nRows: **${rows.length}** | Completed: **${completed}** | Pending: **${pending}**\n${rows.slice(0,15).map((row,i)=>`${i+1}. ${row.challenge_date} — **${studentLabel(row)}** — ${row.challenge} — ${row.completed ? "Completed" : "Pending"}`).join("\n")}`;
    return { answer, rows };
  }

  if (intent.kind === "recommend_group") {
    const attention = attentionRows(students, intent.section, 10);
    const target = attention[0] ?? sortRows(students, "week", "asc")[0] ?? null;
    const recs = recommendQuestions(target, extractLimit(intent.raw, 5));
    const answer = `## Suggested Practice Questions\n${recs.map((q,i)=>`${i+1}. **${q.title}** — ${q.difficulty} — ${q.reason}`).join("\n")}\n\nThese are rule-based recommendations selected from the analyzer's built-in question bank. Use a specific register number for personalized suggestions.`;
    return { answer, rows: recs };
  }

  return {
    answer: `## ECE Smart Performance Analyzer\nI can analyze the tracked data without any external AI API. Try questions such as:\n- Who is the best student this week and why?\n- Give top 50 students this week as Excel\n- Compare ECE A and ECE F\n- Analyze 922525106264 strengths and weaknesses\n- Suggest 5 questions for 922525106264\n- Show students needing attention\n- Give latest Coding Test failures as PDF\n- Give pending Daily Challenge students as CSV\n- Rank faculty this month`,
  };
}

function inactiveExportRows(students: Json[], intent: ParsedIntent): Json[] {
  let rows = students.filter((row)=>number(row.last_7_days)===0);
  if (intent.section) rows = rows.filter((row)=>lower(row.section)===lower(intent.section));
  return rows.slice(0,intent.limit);
}

async function createSmartDownload(intent: ParsedIntent, data: AnalystData, students: Json[]) {
  if (intent.kind === "inactive") {
    const rows = inactiveExportRows(students, intent);
    const format = intent.format ?? "xlsx";
    const title = "Inactive Students - 7 Days";
    const safeTitle = "Inactive_Students_7_Days";
    let bytes: Uint8Array;
    let mime = "text/csv;charset=utf-8";
    let extension = "csv";
    if (format === "xlsx") {
      bytes = makeXlsx(rows, title);
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    } else if (format === "pdf") {
      bytes = await makePdf(rows, title);
      mime = "application/pdf";
      extension = "pdf";
    } else {
      bytes = makeCsv(rows);
    }
    return { filename:`${safeTitle}.${extension}`, mime_type:mime, data_base64:toBase64(bytes), description:`${rows.length} inactive student(s)`, row_count:rows.length };
  }

  return await createDownload(makeExportArgs(intent, students), data, students);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok:false, error:"Method not allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Supabase server configuration is missing.");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ ok:false, error:"Administrator login is required." }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession:false, autoRefreshToken:false }
    });

    const jwt = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);

    if (userError || !user) {
      return jsonResponse({ ok:false, error:"Invalid administrator session." }, 401);
    }

    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError || roleRow?.role !== "admin") {
      return jsonResponse({ ok:false, error:"Administrator access required." }, 403);
    }

    const body = await req.json();
    const message = normalize(body?.message).slice(0, 1600);
    const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];

    if (!message) {
      return jsonResponse({ ok:false, error:"Question is required." }, 400);
    }

    const data = await loadAnalystData();
    const students = enrichStudents(data);

    if (!students.length) {
      return jsonResponse({
        ok:false,
        error:"Analytics data is empty. Run the Update LeetCode GitHub Action once after applying ADD_AI_PERFORMANCE_ANALYST.sql."
      }, 409);
    }

    const intent = parseIntent(message, history);
    const result = buildAnswer(intent, data, students);

    let download: any = null;
    if (intent.needsDownload) {
      download = await createSmartDownload(intent, data, students);
    }

    return jsonResponse({
      ok:true,
      answer: result.answer,
      download,
      engine: "ECE Smart Analyzer v1",
      intent: intent.kind,
      external_ai: false,
    });
  } catch (error) {
    console.error("ECE Smart Analyzer error", error);
    return jsonResponse({
      ok:false,
      error:error instanceof Error ? error.message : String(error)
    }, 500);
  }
});
