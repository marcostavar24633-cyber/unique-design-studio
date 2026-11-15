import { auditSiteHtml } from "./site-audit.js";

function blockingIssue(code,title,detail) {
  return {code,severity:"error",title,detail};
}

/**
 * Final static gate for downloadable, self-contained HTML.
 * Warnings remain visible but do not prevent export.
 */
export function assessExportReadiness(html = "", css = "") {
  const source = String(html ?? "");
  const report = auditSiteHtml(source,css);
  const structuralIssues = [];

  if (!source.trim()) {
    structuralIssues.push(blockingIssue("export-html-empty","HTML пустой","Сначала создайте сайт или откройте сохранённый проект."));
  } else {
    if (!/^\s*<!doctype\s+html\b/i.test(source)) {
      structuralIssues.push(blockingIssue("export-doctype-missing","Нет HTML doctype","Экспорт должен начинаться с декларации <!doctype html>."));
    }
    for (const tag of ["html","head","body"]) {
      if (!new RegExp("<" + tag + "\\b","i").test(source) || !new RegExp("</" + tag + "\\s*>","i").test(source)) {
        structuralIssues.push(blockingIssue("export-document-" + tag,"Неполная HTML-структура","Не найдены открывающий и закрывающий теги " + tag + "."));
      }
    }
    if (!/<style\b[^>]*>[\s\S]*?<\/style>/i.test(source)) {
      structuralIssues.push(blockingIssue("export-inline-css-missing","Не встроены стили","HTML-экспорт должен содержать CSS внутри документа."));
    }
  }

  const blockingIssues = [
    ...report.issues.filter(item => item.severity === "error"),
    ...structuralIssues
  ];
  const warnings = report.issues.filter(item => item.severity === "warning");
  return {
    ready:blockingIssues.length === 0,
    errors:blockingIssues.length,
    warnings:warnings.length,
    blockingIssues,
    warningsList:warnings,
    report:{
      ...report,
      errors:blockingIssues.length,
      warnings:warnings.length,
      passed:blockingIssues.length === 0,
      issues:[...blockingIssues,...warnings]
    }
  };
}
