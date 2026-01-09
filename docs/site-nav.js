/* UBHNL site navigation injector adapted for CNL. */

function computeDocsRoot() {
  const script = document.currentScript || document.querySelector('script[src*="site-nav.js"]');
  if (script && script.src) {
    const url = new URL(script.src, window.location.href);
    return url.href.replace(/site-nav\.js(?:\?.*)?$/, "");
  }

  const rawPath = String(window.location.pathname || "").replace(/\\/g, "/");
  const idx = rawPath.lastIndexOf("/docs/");
  const rel = idx >= 0 ? rawPath.slice(idx + "/docs/".length) : rawPath.replace(/^\/+/, "");
  const parts = rel.split("/").filter(Boolean);
  const depth = Math.max(0, parts.length - 1);
  return "../".repeat(depth);
}

function joinRoot(root, href) {
  if (!root) return href;
  if (root.endsWith("/")) return root + href;
  return root + "/" + href;
}

function normalizeHrefForCompare(href) {
  try {
    const u = new URL(href, window.location.href);
    return u.pathname.replace(/\\/g, "/") + (u.search || "");
  } catch {
    return href;
  }
}

function buildHeaderMenu(root) {
  const menu = document.createElement("nav");
  menu.className = "site-nav";

  const links = [
    ["Home", "index.html"],
    ["Theory", "theory/index.html"],
    ["Architecture", "arhitecture/index.html"],
    ["Wiki", "wiki/index.html"],
    ["Syntax", "syntax/index.html"],
    ["Specs", "specs/index.html"]
  ];

  const here = normalizeHrefForCompare(window.location.href);

  for (let i = 0; i < links.length; i++) {
    const [label, href] = links[i];
    const a = document.createElement("a");
    a.textContent = label;
    a.href = joinRoot(root, href);
    if (normalizeHrefForCompare(a.href) === here) a.className = "active";
    menu.appendChild(a);
    
    if (i < links.length - 1) {
      const sep = document.createTextNode(" · ");
      menu.appendChild(sep);
    }
  }

  return menu;
}

function injectHeaderNav() {
  const header = document.querySelector("header");
  if (!header) return;

  if (header.querySelector(".site-nav")) return;

  // Clean up old hardcoded navs if present
  const oldNav = header.querySelector(".nav");
  if (oldNav) oldNav.remove();

  const root = computeDocsRoot();
  const row = document.createElement("div");
  row.className = "site-header-row";
  row.style.marginTop = "1rem";
  
  row.appendChild(buildHeaderMenu(root));
  header.appendChild(row);
}

function injectFooter() {
  const main = document.querySelector("main");
  const existingFooter = document.querySelector("footer.site-footer");
  
  if (existingFooter) existingFooter.remove(); // Remove old footer to replace with standard one
  if (!main && !document.body) return;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-content">
        <p>Research conducted by <a href="https://www.axiologic.net">Axiologic Research</a> as part of the European research project <a href="https://www.achilles-project.eu/">Achilles</a>.</p>
        <p><strong>Disclaimer:</strong> This documentation was generated with AI assistance (LLMs) and may contain errors or hallucinations. The system is open source—verify claims by examining the code, evaluation suites, and automated tests.</p>
      </div>
    </div>
  `;
  
  // Insert after main, or at the end of body
  if (main) {
    main.parentNode.insertBefore(footer, main.nextSibling);
  } else {
    document.body.appendChild(footer);
  }
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      injectHeaderNav();
      injectFooter();
    });
  } else {
    injectHeaderNav();
    injectFooter();
  }
} catch {
  // ignore
}
