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

// Examples Data
const EXAMPLES = [
  {
    title: "Basic Facts (Learn)",
    text: `John is a user.
The server is active.
Mary is an admin.
Admin is a role.`
  },
  {
    title: "Relationships",
    text: `John accesses the server.
Mary manages John.
The server hosts the database.`
  },
  {
    title: "Query",
    text: `Return the name of every user.
Return the number of servers.
Verify that John is a user.`
  },
  {
    title: "Rules",
    text: `If a user is an admin, then the user has access.
Verify that Mary has access.`
  }
];

function renderExamples() {
  const container = document.getElementById('examplesList');
  container.innerHTML = '';
  EXAMPLES.forEach(ex => {
    const div = document.createElement('div');
    div.className = 'example-card';
    div.innerHTML = `<h3>${ex.title}</h3><pre>${ex.text}</pre>`;
    div.onclick = () => {
      UI.input.value = ex.text;
      document.getElementById('tabChat').click(); // Switch to chat
    };
    container.appendChild(div);
  });
}

// Event Listeners
document.getElementById('sendBtn').onclick = async () => {
  const text = UI.input.value.trim();
  if (!text) return;

  UI.log(`> ${text}`, 'user');
  UI.input.value = '';

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
  renderExamples();
  await UI.updateStats();
  await refreshTree();
  UI.log('CNL Session ready.', 'system');
})();
