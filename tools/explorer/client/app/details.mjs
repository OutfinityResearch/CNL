import { revealTreeNodeByOpen } from "./tree-navigator.mjs";

export function renderDetails(data) {
  const container = document.getElementById('kbDetails');
  if (!data) {
    container.innerHTML = '<div class="muted">Select an item to view details.</div>';
    return;
  }

  if (data.overview) return renderOverviewCard(data.overview, container);
  if (data.entity) return renderEntityCard(data.entity, container);
  if (data.category) return renderCategoryCard(data.category, container);
  if (data.relationship) return renderRelationshipCard(data.relationship, container);
  if (data.rule) return renderRuleCard(data.rule, container);
  if (data.action) return renderActionCard(data.action, container);

  if (data.details) return renderLegacyDetails(data.details, container);

  container.innerHTML = '<div class="muted">Unknown data format.</div>';
}

function renderOverviewCard(overview, container) {
  const kind = overview.kind || "overview";
  const title = overview.title || "Overview";
  const summary = overview.summary || {};
  const items = Array.isArray(overview.items) ? overview.items : [];
  let html = `<div class="details-title">${escapeHtml(title)} <span class="badge">${escapeHtml(kind)}</span></div>`;
  const summaryParts = [];

  function renderCloud(label, cloudItems = []) {
    if (!Array.isArray(cloudItems) || cloudItems.length === 0) return "";
    const weights = cloudItems.map((i) => Number(i.weight || 1)).filter((n) => Number.isFinite(n));
    const minW = weights.length ? Math.min(...weights) : 1;
    const maxW = weights.length ? Math.max(...weights) : 1;
    const denom = Math.log(maxW + 1) - Math.log(minW + 1) || 1;

    function fontSize(weight) {
      const w = Math.max(1, Number(weight || 1));
      const t = (Math.log(w + 1) - Math.log(minW + 1)) / denom;
      return (0.85 + t * 0.75).toFixed(2);
    }

    let out = `<h4>${escapeHtml(label)}</h4><div class="cloud">`;
    cloudItems.forEach((item) => {
      const openJson = escapeHtml(JSON.stringify(item.open || {}));
      const cls = item.className ? `cloud-item ${item.className}` : "cloud-item";
      out += `<button type="button" class="${cls}" data-open="${openJson}" title="${escapeHtml(
        `${item.label} (${item.weight || 1})`
      )}" style="font-size:${fontSize(item.weight)}rem;">${escapeHtml(item.label)}</button>`;
    });
    out += `</div>`;
    return out;
  }

  function bindCloudClicks() {
    container.querySelectorAll(".cloud-item[data-open]").forEach((btn) => {
      btn.onclick = () => {
        try {
          const open = JSON.parse(btn.getAttribute("data-open") || "{}");
          revealTreeNodeByOpen(open);
        } catch {
          // ignore
        }
      };
    });
  }

  function renderListView(title, innerHtml) {
    if (!innerHtml) return "";
    return `
      <details class="dev-view">
        <summary class="muted">▶ List View: ${escapeHtml(title)}</summary>
        <div>${innerHtml}</div>
      </details>
    `;
  }

  if (kind === "scoped-rules") {
    const ruleIds = Array.isArray(overview.raw?.ruleIds) ? overview.raw.ruleIds : [];
    const cloudItems = ruleIds.map((id) => ({
      label: `Rule #${id}`,
      weight: 1,
      className: "cloud-item--rule",
      open: { type: "entity", entityType: "rule", id },
    }));
    html += renderCloud("Rules", cloudItems);
    html += `<h4>${escapeHtml(summary.count)} rules found</h4>`;
    html += `<div class="connections-list">`;
    items.forEach((r) => {
      html += `<div class="connection-item">
        <div style="margin-bottom:4px; font-weight:bold;">Rule #${r.id}</div>
        <div class="mono" style="font-size:0.85rem;">${escapeHtml(r.natural)}</div>
      </div>`;
    });
    html += `</div>`;
    html += renderDevView("Scoped Overview", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "scoped-warnings") {
    const issues = Array.isArray(overview.raw?.issues) ? overview.raw.issues : [];
    const cloudItems = issues.map((i) => ({
      label: [i.kind || i.reason || "issue", i.key && i.key !== "general" ? i.key : ""].filter(Boolean).join(" · "),
      weight: i.severity === "error" ? 3 : 1,
      className: i.severity === "error" ? "cloud-item--error" : "cloud-item--warning",
      open: { type: "overview", kind: "scoped", id: i.leafId },
    }));
    html += renderCloud("Issues", cloudItems);
    html += `<h4>${escapeHtml(summary.count)} issues found</h4>`;
    html += `<div class="connections-list">`;
    items.forEach((w) => {
      const severity = w.severity === "warning" ? "⚠️" : "❌";
      html += `<div class="connection-item">
        <div>${severity} <strong>${escapeHtml(w.message)}</strong></div>
        <div class="muted" style="margin-top:2px;">Reason: ${escapeHtml(w.reason)}</div>
      </div>`;
    });
    html += `</div>`;
    html += renderDevView("Scoped Overview", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "scoped-predicate") {
    const rawConnections = Array.isArray(overview.raw?.connections) ? overview.raw.connections : [];
    const subjCounts = new Map();
    const objCounts = new Map();
    rawConnections.forEach((c) => {
      if (Number.isInteger(c.subjectId)) subjCounts.set(c.subjectId, (subjCounts.get(c.subjectId) || 0) + 1);
      if (Number.isInteger(c.objectId)) objCounts.set(c.objectId, (objCounts.get(c.objectId) || 0) + 1);
    });
    const subjCloud = [...subjCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([id, weight]) => ({
        label: rawConnections.find((c) => c.subjectId === id)?.subject || `#${id}`,
        weight,
        className: "cloud-item--thing",
        open: { type: "entity", entityType: "entity", id },
      }));
    const objCloud = [...objCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([id, weight]) => ({
        label: rawConnections.find((c) => c.objectId === id)?.object || `#${id}`,
        weight,
        className: "cloud-item--thing",
        open: { type: "entity", entityType: "entity", id },
      }));
    html += renderCloud("Subjects", subjCloud);
    html += renderCloud("Objects", objCloud);
    html += `<h4>${escapeHtml(summary.count)} connections</h4>`;
    html += `<table class="details-table"><thead><tr><th>Subject</th><th>Object</th></tr></thead><tbody>`;
    items.forEach((c) => {
      html += `<tr>
        <td>${escapeHtml(c.subject)}</td>
        <td>${escapeHtml(c.object)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    html += renderDevView("Scoped Overview", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "scoped-subject") {
    const rawObjects = Array.isArray(overview.raw?.objects) ? overview.raw.objects : [];
    const cloudItems = rawObjects.slice(0, 80).map((o) => ({
      label: o.name || `#${o.id}`,
      weight: 1,
      className: "cloud-item--thing",
      open: { type: "entity", entityType: "entity", id: o.id },
    }));
    html += renderCloud("Targets", cloudItems);
    html += `<h4>${escapeHtml(summary.count)} targets</h4>`;
    html += `<ul class="member-list">`;
    items.forEach((obj) => {
      html += `<li>${escapeHtml(obj)}</li>`;
    });
    html += `</ul>`;
    html += renderDevView("Scoped Overview", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "scoped-rel-category") {
    const rawConnections = Array.isArray(overview.raw?.connections) ? overview.raw.connections : [];
    const catId = overview.raw?.catId ?? null;
    const predId = overview.raw?.predId ?? null;
    const subjCounts = new Map();
    const objCounts = new Map();
    rawConnections.forEach((c) => {
      if (Number.isInteger(c.subjectId)) subjCounts.set(c.subjectId, (subjCounts.get(c.subjectId) || 0) + 1);
      if (Number.isInteger(c.objectId)) objCounts.set(c.objectId, (objCounts.get(c.objectId) || 0) + 1);
    });
    const headerCloud = [];
    if (Number.isInteger(predId)) {
      headerCloud.push({
        label: overview.raw?.predName || `predicate #${predId}`,
        weight: rawConnections.length || 1,
        className: "cloud-item--predicate",
        open: { type: "entity", entityType: "predicate", id: predId },
      });
    }
    if (Number.isInteger(catId)) {
      headerCloud.push({
        label: overview.raw?.catName || `concept #${catId}`,
        weight: rawConnections.length || 1,
        className: "cloud-item--concept",
        open: { type: "entity", entityType: "unary", id: catId },
      });
    }
    if (headerCloud.length) html += renderCloud("Focus", headerCloud);
    const subjCloud = [...subjCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([id, weight]) => ({
        label: rawConnections.find((c) => c.subjectId === id)?.subject || `#${id}`,
        weight,
        className: "cloud-item--thing",
        open: { type: "entity", entityType: "entity", id },
      }));
    const objCloud = [...objCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([id, weight]) => ({
        label: rawConnections.find((c) => c.objectId === id)?.object || `#${id}`,
        weight,
        className: "cloud-item--thing",
        open: { type: "entity", entityType: "entity", id },
      }));
    html += renderCloud("Subjects", subjCloud);
    html += renderCloud("Objects", objCloud);
    html += `<h4>${escapeHtml(summary.count)} connections</h4>`;
    if (summary.predicate || summary.category) {
      const meta = [summary.predicate, summary.category].filter(Boolean).join(" · ");
      html += `<p class="summary">${escapeHtml(meta)}</p>`;
    }
    html += `<table class="details-table"><thead><tr><th>Subject</th><th>Object</th></tr></thead><tbody>`;
    items.forEach((c) => {
      html += `<tr>
        <td>${escapeHtml(c.subject)}</td>
        <td>${escapeHtml(c.object)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    html += renderDevView("Scoped Overview", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "relation-fact") {
    const exists = Boolean(summary.exists);
    html += `<h4>Fact</h4>`;
    html += `<p class="summary">${escapeHtml(summary.sentence || "(unrenderable)")}</p>`;
    html += `<p class="summary">Exists in KB: <strong>${exists ? "yes" : "no"}</strong></p>`;
    html += renderDevView("Fact Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "warning-issue") {
    html += `<h4>${escapeHtml(summary.kind || "Issue")}</h4>`;
    if (summary.concept) html += `<p class="summary">Concept/term: ${escapeHtml(summary.concept)}</p>`;
    if (summary.severity) html += `<p class="summary">Severity: ${escapeHtml(summary.severity)}</p>`;
    html += `<div class="connections-list">`;
    items.forEach((i) => {
      html += `<div class="connection-item"><strong>${escapeHtml(i.message || "")}</strong></div>`;
    });
    html += `</div>`;
    html += renderDevView("Warning Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "knowledge") {
    html += `<div class="example-grid">
      <div class="card">
        <h3>👥 Things</h3>
        <p>${summary.things || 0} individuals</p>
      </div>
      <div class="card">
        <h3>🏷️ Concepts</h3>
        <p>${summary.concepts || 0} categories</p>
      </div>
      <div class="card">
        <h3>🔗 Relationships</h3>
        <p>${summary.relations || 0} predicates</p>
      </div>
      <div class="card">
        <h3>📋 Rules</h3>
        <p>${summary.rules || 0} deductive rules</p>
      </div>
      <div class="card">
        <h3>🔁 Transitions</h3>
        <p>${summary.transitions || 0} transitions</p>
      </div>
      <div class="card">
        <h3>⚡ Actions</h3>
        <p>${summary.actions || 0} action blocks</p>
      </div>
    </div>`;
    if (summary.warnings > 0) {
      html += `<div class="message message--error" style="margin-top:20px; align-self: stretch; max-width: 100%;">
        ⚠️ ${summary.warnings} potential issues detected. Check the Issues folder.
      </div>`;
    }
    html += renderDevView("Knowledge Summary", overview.raw ?? overview);
    container.innerHTML = html;
    return;
  }
  if (Number.isInteger(summary.count)) summaryParts.push(`${summary.count} total`);
  if (Number.isInteger(summary.duplicates)) summaryParts.push(`${summary.duplicates} duplicate groups`);
  if (Number.isInteger(summary.transitions)) summaryParts.push(`${summary.transitions} transitions`);
  if (summaryParts.length > 0) {
    html += `<p class="summary">${summaryParts.join(" · ")}</p>`;
  }

  if (kind === "rules") {
    const groups = Array.isArray(overview.raw?.ruleGroups) ? overview.raw.ruleGroups : [];
    const cloudItems = groups.slice(0, 120).map((g) => ({
      label: g.label || "general",
      weight: g.count || 1,
      className: "cloud-item--rule",
      open: { type: "overview", kind: "scoped", id: g.groupId },
    }));
    if (cloudItems.length > 0) {
      html += renderCloud("Rule Groups", cloudItems);
    }

    if (Array.isArray(overview.duplicates) && overview.duplicates.length > 0) {
      const dupItems = overview.duplicates
        .slice(0, 80)
        .map((d) => ({
          label: d.natural,
          weight: d.count || 2,
          className: "cloud-item--warning",
          open: { type: "overview", kind: "warnings", id: "" },
        }));
      html += renderCloud("Duplicate Rules (suspicious)", dupItems);
    } else {
      html += `<p class="muted">No duplicates detected.</p>`;
    }

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((r) => {
      listHtml += `<div class="connection-item">#${r.id}: ${escapeHtml(r.natural)}</div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Rules", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "things") {
    const cloudItems = items
      .slice()
      .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0) || String(a.name).localeCompare(String(b.name)))
      .slice(0, 160)
      .map((t) => ({
        label: t.name,
        weight: Math.max(1, t.degree ?? (t.categories?.length || 1)),
        className: "cloud-item--thing",
        open: { type: "entity", entityType: "entity", id: t.id },
      }));
    html += renderCloud("Things (size = connectivity)", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((t) => {
      const cats = Array.isArray(t.categories) && t.categories.length > 0 ? ` <span class="muted">(${t.categories.join(", ")})</span>` : "";
      const deg = Number.isFinite(t.degree) ? ` <span class="muted">[degree: ${t.degree}]</span>` : "";
      listHtml += `<div class="connection-item">#${t.id}: ${escapeHtml(t.name)}${cats}${deg}</div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Things", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "concepts") {
    const cloudItems = items
      .slice()
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || String(a.name).localeCompare(String(b.name)))
      .slice(0, 200)
      .map((c) => ({
        label: c.name,
        weight: Math.max(1, c.count ?? 1),
        className: "cloud-item--concept",
        open: { type: "entity", entityType: "unary", id: c.id },
      }));
    html += renderCloud("Concepts (size = members)", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((c) => {
      listHtml += `<div class="connection-item">#${c.id}: ${escapeHtml(c.name)} <span class="muted">(${c.count})</span></div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Concepts", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "relations") {
    const cloudItems = items
      .slice()
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || String(a.name).localeCompare(String(b.name)))
      .slice(0, 200)
      .map((p) => ({
        label: p.name,
        weight: Math.max(1, p.count ?? 1),
        className: "cloud-item--predicate",
        open: { type: "overview", kind: "scoped", id: `p-${p.id}` },
      }));
    html += renderCloud("Relations (size = links)", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((p) => {
      listHtml += `<div class="connection-item">#${p.id}: ${escapeHtml(p.name)} <span class="muted">(${p.count} links)</span></div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Relations", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "transitions") {
    const cloudItems = items.slice(0, 160).map((t) => ({
      label: t.natural,
      weight: 1,
      className: "cloud-item--rule",
      open: { type: "entity", entityType: "rule", id: t.id },
    }));
    html += renderCloud("Transitions", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((t) => {
      listHtml += `<div class="connection-item">#${t.id}: ${escapeHtml(t.natural)}</div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Transitions", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "symbols") {
    html += `<p class="summary">Symbols are constants used as objects/values (e.g. lower-case tokens, numbers, strings).</p>`;
    const cloudItems = items.slice(0, 220).map((s) => ({
      label: s.name,
      weight: 1,
      className: "cloud-item--concept",
      open: { type: "entity", entityType: "entity", id: s.id },
    }));
    html += renderCloud("Symbols", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((s) => {
      listHtml += `<div class="connection-item">#${s.id}: ${escapeHtml(s.name)}</div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Symbols", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "actions") {
    html += `<p class="summary">Actions are planning operators: an agent constraint plus preconditions and effects.</p>`;
    const cloudItems = items
      .slice()
      .sort((a, b) => {
        const aw = (a.preconditions?.length || 0) + (a.effects?.length || 0);
        const bw = (b.preconditions?.length || 0) + (b.effects?.length || 0);
        return bw - aw || String(a.name).localeCompare(String(b.name));
      })
      .slice(0, 160)
      .map((a) => ({
        label: a.name,
        weight: Math.max(1, (a.preconditions?.length || 0) + (a.effects?.length || 0)),
        className: "cloud-item--predicate",
        open: { type: "entity", entityType: "action", id: a.id },
      }));
    html += renderCloud("Actions (size = preconditions+effects)", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.slice(0, 500).forEach((a) => {
      const summary = a.summary ? ` <span class="muted">${escapeHtml(a.summary)}</span>` : "";
      listHtml += `<div class="connection-item">#${a.id}: ${escapeHtml(a.name)}${summary}</div>`;
    });
    if (items.length > 500) listHtml += `<div class="muted">…and ${items.length - 500} more</div>`;
    listHtml += `</div>`;
    html += renderListView("All Actions", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  if (kind === "warnings") {
    const errors = Number.isInteger(summary.errors) ? summary.errors : 0;
    const warnings = Number.isInteger(summary.warnings) ? summary.warnings : 0;
    html += `<p class="summary">${summary.count} total issues · ${errors} errors · ${warnings} warnings</p>`;

    const cloudItems = items
      .slice()
      .sort((a, b) => {
        const sevRank = (s) => (s === "error" ? 0 : 1);
        if (sevRank(a.severity) !== sevRank(b.severity)) return sevRank(a.severity) - sevRank(b.severity);
        if ((b.count ?? 0) !== (a.count ?? 0)) return (b.count ?? 0) - (a.count ?? 0);
        return String(a.kind).localeCompare(String(b.kind));
      })
      .slice(0, 240)
      .map((g) => ({
        label: g.kind,
        weight: Math.max(1, g.count ?? 1),
        className: g.severity === "error" ? "cloud-item--error" : "cloud-item--warning",
        open: { type: "overview", kind: "scoped", id: g.nodeId },
      }));
    html += renderCloud("Issue Types (size = count)", cloudItems);

    let listHtml = `<div class="connections-list">`;
    items.forEach((g) => {
      const sevBadge = g.severity === "error" ? "❌ error" : "⚠️ warning";
      const keys = Array.isArray(g.sampleKeys) && g.sampleKeys.length ? ` <span class="muted">(${g.sampleKeys.join(", ")})</span>` : "";
      listHtml += `<div class="connection-item"><strong>${escapeHtml(g.kind)}</strong> <span class="muted">(${sevBadge}, ${g.count})</span>${keys}</div>`;
    });
    listHtml += `</div>`;
    html += renderListView("All Issue Types", listHtml);
    html += renderDevView("Overview Raw", overview.raw ?? overview);
    container.innerHTML = html;
    bindCloudClicks();
    return;
  }

  html += renderDevView("Overview", overview);
  container.innerHTML = html;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderEntityCard(entity, container) {
  let html = `
    <div class="details-title">👤 ${entity.name} <span class="badge badge--id">ID: ${entity.id}</span></div>
  `;

  if (entity.categories && entity.categories.length > 0) {
    html += `<h4>Is A</h4><div class="tags-list">`;
    entity.categories.forEach(c => {
      const badge = c.source === 'derived' ? 'badge--derived' : 'badge--stated';
      html += `<span class="tag ${badge}">${c.name}</span>`;
    });
    html += `</div>`;
  }

  if ((entity.outgoing && entity.outgoing.length > 0) || (entity.incoming && entity.incoming.length > 0)) {
    html += `<h4>Relationships</h4><div class="relations-list">`;

    if (entity.outgoing) {
      entity.outgoing.forEach(r => {
        html += `<div class="relation-item">
          <span class="rel-subject">${entity.name}</span>
          <span class="rel-verb">${r.verb}</span>
          <span class="rel-object clickable" data-id="${r.objectId}">${r.object}</span>
        </div>`;
      });
    }

    if (entity.incoming) {
      entity.incoming.forEach(r => {
        html += `<div class="relation-item">
          <span class="rel-subject clickable" data-id="${r.subjectId}">${r.subject}</span>
          <span class="rel-verb">${r.verb}</span>
          <span class="rel-object">${entity.name}</span>
        </div>`;
      });
    }

    html += `</div>`;
  }

  if (entity.attributes && entity.attributes.length > 0) {
    html += `<h4>Attributes</h4><ul class="attr-list">`;
    entity.attributes.forEach(a => {
      html += `<li><strong>${a.name}:</strong> ${a.value}</li>`;
    });
    html += `</ul>`;
  }

  if (entity.raw) {
    html += renderDevView('Entity Data', entity.raw);
  }

  container.innerHTML = html;
}

function renderCategoryCard(category, container) {
  let html = `
    <div class="details-title">🏷️ ${category.name} <span class="badge badge--id">ID: ${category.id}</span></div>
    <p class="summary">${category.memberCount} ${category.memberCount === 1 ? 'member' : 'members'}</p>
  `;

  if (category.members && category.members.length > 0) {
    html += `<h4>Members</h4><ul class="member-list">`;
    category.members.forEach(m => {
      html += `<li class="clickable" data-type="entity" data-id="${m.id}">👤 ${m.name}</li>`;
    });
    html += `</ul>`;
  }

  if (category.raw) {
    html += renderDevView('Category Data', category.raw);
  }

  container.innerHTML = html;
}

function renderRelationshipCard(rel, container) {
  let html = `
    <div class="details-title">🔗 ${rel.name} <span class="badge badge--id">ID: ${rel.id}</span></div>
    <p class="summary">${rel.connectionCount} ${rel.connectionCount === 1 ? 'connection' : 'connections'}</p>
  `;

  if (rel.connections && rel.connections.length > 0) {
    html += `<h4>Connections</h4><div class="connections-list">`;
    rel.connections.forEach(c => {
      html += `<div class="connection-item">${c.sentence}</div>`;
    });
    html += `</div>`;

    html += `<h4>Statistics</h4>
      <p>Subjects: ${rel.subjects.join(', ')}</p>
      <p>Objects: ${rel.objects.join(', ')}</p>`;
  }

  if (rel.raw) {
    html += renderDevView('Relationship Data', rel.raw);
  }

  container.innerHTML = html;
}

function renderRuleCard(rule, container) {
  let html = `
    <div class="details-title">📋 Rule #${rule.id}</div>
    <h4>Natural Language</h4>
    <p class="rule-natural">"${rule.natural}"</p>

    <h4>Logic Flow</h4>
    <div class="flow-container">
      <div class="flow-box flow-if">
        <div class="flow-label">IF</div>
        <div class="flow-item">${rule.condition.text}</div>
      </div>
      <div class="flow-arrow">⬇</div>
      <div class="flow-box flow-then">
        <div class="flow-label">THEN</div>
        <div class="flow-item">${rule.effect.text}</div>
      </div>
    </div>
  `;

  if (rule.appliedTo && rule.appliedTo.length > 0) {
    html += `<h4>Applied To</h4><ul>`;
    rule.appliedTo.forEach(a => {
      html += `<li>${a.entity}: ${a.derived}</li>`;
    });
    html += `</ul>`;
  }

  if (rule.raw) {
    html += renderDevView('Rule Plan', rule.raw);
  }

  container.innerHTML = html;
}

function renderActionCard(action, container) {
  let html = `
    <div class="details-title">⚡ ${action.name} <span class="badge badge--id">ID: ${action.id}</span></div>
  `;

  if (action.description) {
    html += `<h4>Summary</h4><pre class="mono">${escapeHtml(action.description)}</pre>`;
  } else {
    if (action.agent) html += `<p><strong>Agent:</strong> ${escapeHtml(action.agent)}</p>`;
    if (action.intent) html += `<p><strong>Intent:</strong> ${escapeHtml(action.intent)}</p>`;
  }

  if (Array.isArray(action.preconditions) && action.preconditions.length > 0) {
    html += `<h4>Preconditions</h4><div class="connections-list">`;
    action.preconditions.forEach((p) => {
      html += `<div class="connection-item">${escapeHtml(p)}</div>`;
    });
    html += `</div>`;
  }

  if (Array.isArray(action.effects) && action.effects.length > 0) {
    html += `<h4>Effects</h4><div class="connections-list">`;
    action.effects.forEach((e) => {
      html += `<div class="connection-item">${escapeHtml(e)}</div>`;
    });
    html += `</div>`;
  }

  if (action.raw) {
    html += renderDevView('Action Definition', action.raw);
  }

  container.innerHTML = html;
}

function renderDevView(title, data) {
  let rendered = "";
  try {
    rendered = JSON.stringify(data, null, 2);
  } catch (error) {
    rendered = JSON.stringify({ error: String(error?.message || error), valueType: typeof data }, null, 2);
  }
  return `
    <details class="dev-view">
      <summary class="muted">▶ Developer View: ${title}</summary>
      <pre>${escapeHtml(rendered)}</pre>
    </details>
  `;
}

function renderLegacyDetails(data, container) {
  let html = `<div class="details-title">${data.name} <span class="badge">${data.type}</span></div>`;

  if (data.properties && data.properties.length > 0) {
    html += `<h4>Properties</h4><div class="tags-list">
      ${data.properties.map(p => `<span class="tag">${p}</span>`).join('')}
    </div>`;
  }

  if (data.relations && data.relations.length > 0) {
    html += `<h4>Relations</h4><ul>`;
    data.relations.forEach(r => {
      html += `<li>${r.direction}: ${r.predicate} → ${r.target}</li>`;
    });
    html += `</ul>`;
  }

  container.innerHTML = html;
}
