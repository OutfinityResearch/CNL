export function renderDetails(data) {
  const container = document.getElementById('kbDetails');
  if (!data) {
    container.innerHTML = '<div class="muted">Select an item to view details.</div>';
    return;
  }

  if (data.entity) return renderEntityCard(data.entity, container);
  if (data.category) return renderCategoryCard(data.category, container);
  if (data.relationship) return renderRelationshipCard(data.relationship, container);
  if (data.rule) return renderRuleCard(data.rule, container);
  if (data.action) return renderActionCard(data.action, container);

  if (data.details) return renderLegacyDetails(data.details, container);

  container.innerHTML = '<div class="muted">Unknown data format.</div>';
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

  if (action.agent) {
    html += `<p><strong>Agent:</strong> ${JSON.stringify(action.agent)}</p>`;
  }
  if (action.precondition) {
    html += `<p><strong>Precondition:</strong> ${action.precondition}</p>`;
  }
  if (action.effect) {
    html += `<p><strong>Effect:</strong> ${action.effect}</p>`;
  }

  if (action.raw) {
    html += renderDevView('Action Definition', action.raw);
  }

  container.innerHTML = html;
}

function renderDevView(title, data) {
  return `
    <details class="dev-view">
      <summary class="muted">▶ Developer View: ${title}</summary>
      <pre>${JSON.stringify(data, null, 2)}</pre>
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
