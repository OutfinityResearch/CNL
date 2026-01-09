const API = {
  async getStats() {
    const res = await fetch('/api/session');
    return res.json();
  },
  async sendCommand(text) {
    const res = await fetch('/api/command', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    return res.json();
  },
  async getTree() {
    const res = await fetch('/api/tree');
    return res.json();
  },
  async getExamples() {
    const res = await fetch('/api/examples');
    return res.json();
  },
  async reset() {
    await fetch('/api/reset', { method: 'POST' });
  }
};

const UI = {
  chat: document.getElementById('chatOutput'),
  input: document.getElementById('textInput'),
  tree: document.getElementById('kbTree'),
  stats: document.getElementById('kbStats'),
  
  log(text, type = 'system') {
    const msg = document.createElement('div');
    msg.className = `message message--${type}`;
    msg.textContent = text;
    this.chat.appendChild(msg);
    this.chat.scrollTop = this.chat.scrollHeight;
  },

  renderTree(nodes, container) {
    container.innerHTML = '';
    nodes.forEach(node => {
      const el = document.createElement('div');
      el.className = 'tree-node';
      el.innerHTML = `<span class="icon">${getIcon(node.icon)}</span> ${node.text}`;
      el.onclick = () => {
        console.log('Clicked', node.id);
      };
      container.appendChild(el);
      if (node.children && node.children.length) {
        const childContainer = document.createElement('div');
        childContainer.className = 'tree-children';
        this.renderTree(node.children, childContainer);
        container.appendChild(childContainer);
      }
    });
  },

  async updateStats() {
    const data = await API.getStats();
    if (data.ok) {
      this.stats.textContent = `Entities: ${data.stats.entities} | Predicates: ${data.stats.predicates}`;
    }
  }
};

function getIcon(name) {
  switch(name) {
    case 'folder': return '📁';
    case 'user': return '👤';
    case 'tag': return '🏷️';
    default: return '📄';
  }
}

async function renderExamples() {
  const container = document.getElementById('examplesList');
  container.innerHTML = 'Loading examples...';
  
  const data = await API.getExamples();
  if (!data.suite) {
    container.innerHTML = 'Error loading examples.';
    return;
  }

  container.innerHTML = '';
  
  data.suite.forEach(ex => {
    const card = document.createElement('div');
    card.className = 'example-card';
    
    // Theory Section
    let html = `<h3>${ex.title}</h3>`;
    html += `<p class="muted">${ex.description}</p>`;
    html += `<div class="theory-block">
      <h4>Context (Theory)</h4>
      <pre>${ex.theory}</pre>
      <button class="btn btn--sm btn--secondary load-theory-btn">Load Context</button>
    </div>`;

    // Steps Table
    html += `<h4>Steps</h4>
    <table class="steps-table">
      <thead>
        <tr>
          <th>Command</th>
          <th>Expected</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>`;
    
    ex.steps.forEach((step, idx) => {
      html += `<tr>
        <td class="step-cmd mono">${step.command}</td>
        <td class="step-exp mono">${step.expected || '-'}</td>
        <td><button class="btn btn--sm btn--primary run-step-btn" data-cmd="${escapeHtml(step.command)}">Run</button></td>
      </tr>`;
    });
    
    html += `</tbody></table>`;
    
    card.innerHTML = html;
    container.appendChild(card);

    // Bind events
    const loadBtn = card.querySelector('.load-theory-btn');
    loadBtn.onclick = async () => {
      UI.log(`Loading context for: ${ex.title}...`, 'system');
      await executeCommand(ex.theory);
    };

    card.querySelectorAll('.run-step-btn').forEach(btn => {
      btn.onclick = async () => {
        const cmd = btn.getAttribute('data-cmd');
        UI.log(`> ${cmd}`, 'user');
        await executeCommand(cmd);
      };
    });
  });
}

function escapeHtml(text) {
  return text.replace(/"/g, '&quot;');
}

async function executeCommand(text) {
  try {
    const res = await API.sendCommand(text);
    if (res.ok) {
      UI.log('Success.', 'system');
      if (res.errors && res.errors.length) {
         res.errors.forEach(e => UI.log(`Warning: ${e.message}`, 'error'));
      }
    } else {
      UI.log(`Error: ${JSON.stringify(res.errors)}`, 'error');
    }
    await UI.updateStats();
    await refreshTree();
  } catch (e) {
    UI.log(`Network Error: ${e.message}`, 'error');
  }
}

// Global UI Events
document.getElementById('sendBtn').onclick = async () => {
  const text = UI.input.value.trim();
  if (!text) return;
  UI.log(`> ${text}`, 'user');
  UI.input.value = '';
  await executeCommand(text);
};

document.getElementById('resetBtn').onclick = async () => {
  if(confirm('Reset session?')) {
    await API.reset();
    UI.log('Session reset.', 'system');
    await UI.updateStats();
    await refreshTree();
  }
};

// Tabs logic
document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    document.querySelectorAll('.tabs__panel').forEach(p => p.classList.remove('tabs__panel--active'));
    
    btn.classList.add('tab--active');
    const panelId = btn.id.replace('tab', 'panel');
    document.getElementById(panelId).classList.add('tabs__panel--active');
  };
});

async function refreshTree() {
  const data = await API.getTree();
  if (data.tree) {
    UI.renderTree(data.tree, UI.tree);
  }
}

// Init
(async () => {
  await renderExamples();
  await UI.updateStats();
  await refreshTree();
  UI.log('CNL Session ready.', 'system');
})();
