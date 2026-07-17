#!/usr/bin/env python
"""Generate hero images for AgentHive READMEs using Playwright."""

from pathlib import Path
import base64

from playwright.sync_api import sync_playwright


REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / "docs" / "images"
SCREENSHOTS = REPO / "docs" / "assets" / "screenshots"


# Common layout shared by both language variants
HERO_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: 1280px;
  height: 640px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%);
  color: #f8fafc;
  overflow: hidden;
  position: relative;
}

/* Decorative network / hive motif */
.ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.15);
}
.dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.6);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
}
.line {
  position: absolute;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.35), transparent);
  transform-origin: left center;
}

/* Content area */
.container {
  display: flex;
  width: 100%;
  height: 100%;
  padding: 56px 64px;
  position: relative;
  z-index: 10;
}
.left {
  flex: 0 0 46%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-right: 40px;
}
.right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #a5b4fc;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.05em;
  margin-bottom: 22px;
  width: fit-content;
}

h1 {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}

h1 .accent {
  color: #818cf8;
}

.subtitle {
  font-size: 20px;
  line-height: 1.55;
  color: #cbd5e1;
  margin-bottom: 32px;
  max-width: 480px;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pill {
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 14px;
  color: #e2e8f0;
  font-weight: 500;
}

.screenshot {
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08);
  object-fit: contain;
}

.main-shot {
  width: 560px;
  border-radius: 14px;
  z-index: 2;
}

.secondary-shot {
  position: absolute;
  width: 280px;
  right: -20px;
  bottom: 40px;
  z-index: 3;
  border-radius: 12px;
}

.tertiary-shot {
  position: absolute;
  width: 220px;
  left: -30px;
  top: 60px;
  z-index: 1;
  border-radius: 12px;
  opacity: 0.85;
}

.footer-note {
  position: absolute;
  bottom: 28px;
  left: 64px;
  font-size: 13px;
  color: #64748b;
  z-index: 10;
}
</style>
</head>
<body>
  <!-- Decorative rings -->
  <div class="ring" style="width: 400px; height: 400px; top: -120px; right: -80px;"></div>
  <div class="ring" style="width: 300px; height: 300px; bottom: -90px; left: -60px;"></div>
  <div class="ring" style="width: 180px; height: 180px; top: 120px; right: 320px;"></div>
  <div class="dot" style="top: 140px; left: 520px;"></div>
  <div class="dot" style="top: 200px; left: 580px;"></div>
  <div class="dot" style="top: 170px; left: 640px;"></div>
  <div class="line" style="top: 143px; left: 528px; width: 60px; transform: rotate(18deg);"></div>
  <div class="line" style="top: 203px; left: 588px; width: 60px; transform: rotate(-12deg);"></div>

  <div class="container">
    <div class="left">
      <div class="badge">{{BADGE}}</div>
      <h1>{{TITLE}}</h1>
      <p class="subtitle">{{SUBTITLE}}</p>
      <div class="pills">
        {{PILLS}}
      </div>
    </div>
    <div class="right">
      <img class="screenshot tertiary-shot" src="{{TERTIARY_IMG}}">
      <img class="screenshot main-shot" src="{{MAIN_IMG}}">
      <img class="screenshot secondary-shot" src="{{SECONDARY_IMG}}">
    </div>
  </div>
  <div class="footer-note">{{FOOTER}}</div>
</body>
</html>
"""


def file_to_data_url(path: Path) -> str:
    suffix = path.suffix.lower()
    mime = "image/png" if suffix == ".png" else "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/svg+xml"
    data = path.read_bytes()
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def render_hero(lang: str, out_path: Path) -> None:
    if lang == "zh":
        badge = "本地优先 · 多 Agent 协作"
        title = "AgentHive — <span class=\"accent\">AI 圆桌讨论工作台</span>"
        subtitle = "把业务问题交给可配置的多角色 Agent，围绕观点、证据、风险和结论进行结构化讨论，用于决策压测与证据整理。"
        pills = ["本地运行", "隐私安全", "Next.js + React", "Agent Skill 模板"]
        footer = "Apache 2.0 ·  github.com/EthanYoQ/AgentHive"
    else:
        badge = "LOCAL-FIRST · MULTI-AGENT COLLABORATION"
        title = "AgentHive — <span class=\"accent\">AI Roundtable Workspace</span>"
        subtitle = "Give one business question to configurable agents and let them reason through views, evidence, risks, and final synthesis for decision pressure-testing."
        pills = ["Local Runtime", "Privacy-First", "Next.js + React", "Agent Skill Templates"]
        footer = "Apache 2.0 ·  github.com/EthanYoQ/AgentHive"

    main_img = file_to_data_url(SCREENSHOTS / "roundtable-discussion.png")
    secondary_img = file_to_data_url(SCREENSHOTS / "agent-registry.png")
    tertiary_img = file_to_data_url(SCREENSHOTS / "roundtable-discussion.png")

    html = HERO_HTML
    html = html.replace("{{BADGE}}", badge)
    html = html.replace("{{TITLE}}", title)
    html = html.replace("{{SUBTITLE}}", subtitle)
    html = html.replace("{{PILLS}}", "".join(f'<div class="pill">{p}</div>' for p in pills))
    html = html.replace("{{FOOTER}}", footer)
    html = html.replace("{{MAIN_IMG}}", main_img)
    html = html.replace("{{SECONDARY_IMG}}", secondary_img)
    html = html.replace("{{TERTIARY_IMG}}", tertiary_img)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 640})
        page.set_content(html)
        page.screenshot(path=str(out_path), type="png")
        browser.close()

    print(f"Saved {out_path}")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    render_hero("zh", OUTPUT / "product-hero-zh.png")
    render_hero("en", OUTPUT / "product-hero-en.png")
