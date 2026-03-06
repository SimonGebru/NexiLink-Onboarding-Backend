function uniqueBy(array, key) {
  const map = new Map();

  for (const item of array) {
    const value = item[key];
    if (!value) continue;

    if (!map.has(value)) {
      map.set(value, item);
    }
  }

  return Array.from(map.values());
}

export function mergeAnalysisResults(results) {
  const merged = {
    processes: [],
    legalReferences: [],
    responsibilities: [],
    risks: [],
  };

  for (const r of results) {
    if (!r) continue;

    if (Array.isArray(r.processes)) {
      merged.processes.push(...r.processes);
    }

    if (Array.isArray(r.legalReferences)) {
      merged.legalReferences.push(...r.legalReferences);
    }

    if (Array.isArray(r.responsibilities)) {
      merged.responsibilities.push(...r.responsibilities);
    }

    if (Array.isArray(r.risks)) {
      merged.risks.push(...r.risks);
    }
  }

  merged.processes = uniqueBy(merged.processes, "name");
  merged.legalReferences = uniqueBy(merged.legalReferences, "ref");
  merged.responsibilities = uniqueBy(merged.responsibilities, "roleOrFunction");
  merged.risks = uniqueBy(merged.risks, "risk");

  return merged;
}