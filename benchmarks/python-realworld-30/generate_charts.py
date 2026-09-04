#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_COMPARISON = ROOT / "benchmarks/python-realworld-30/evidence/20260904-codex0153-gpt56sol-all30-v1/comparison.json"
DEFAULT_OUTPUT = ROOT / "assets/benchmarks"

BG = "#070B18"
CARD = "#10182B"
CARD_2 = "#131E35"
TEXT = "#F8FAFC"
MUTED = "#9AA9C2"
GRID = "#29344C"
PC = "#8B5CF6"
PC_LIGHT = "#B9A7FF"
PA = "#94A3B8"
CODEX = "#F59E0B"
GOOD = "#2DD4BF"
BAD = "#FB7185"
GOLD = "#FBBF24"


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def text(x: float, y: float, value: object, size: int = 18, *, fill: str = TEXT,
         weight: int = 400, anchor: str = "start", opacity: float = 1.0,
         letter_spacing: float | None = None) -> str:
    spacing = "" if letter_spacing is None else f' letter-spacing="{letter_spacing}"'
    return (
        f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
        f'font-weight="{weight}" text-anchor="{anchor}" opacity="{opacity}"{spacing}>'
        f'{esc(value)}</text>'
    )


def rect(x: float, y: float, width: float, height: float, fill: str, *,
         radius: float = 16, stroke: str | None = None, opacity: float = 1.0,
         filter_name: str | None = None) -> str:
    stroke_part = "" if stroke is None else f' stroke="{stroke}" stroke-width="1"'
    filter_part = "" if filter_name is None else f' filter="url(#{filter_name})"'
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{width:.1f}" height="{height:.1f}" '
        f'rx="{radius:.1f}" fill="{fill}" opacity="{opacity}"{stroke_part}{filter_part}/>'
    )


def svg_start(width: int, height: int, title_value: str, description: str) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        f'<title id="title">{esc(title_value)}</title>',
        f'<desc id="desc">{esc(description)}</desc>',
        "<defs>",
        '<linearGradient id="pcGradient" x1="0" y1="0" x2="1" y2="0">',
        f'<stop offset="0%" stop-color="{PC}"/><stop offset="100%" stop-color="{PC_LIGHT}"/>',
        "</linearGradient>",
        '<radialGradient id="glow" cx="50%" cy="0%" r="85%">',
        '<stop offset="0%" stop-color="#34266B" stop-opacity="0.72"/>',
        f'<stop offset="100%" stop-color="{BG}" stop-opacity="0"/>',
        "</radialGradient>",
        '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">',
        '<feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/>',
        "</filter>",
        '<style>text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style>',
        "</defs>",
        rect(0, 0, width, height, BG, radius=0),
        rect(0, 0, width, height, "url(#glow)", radius=0),
    ]


def metric_bar(lines: list[str], x: float, y: float, width: float, label: str,
               pc_value: float, baseline_value: float, pc_display: str,
               baseline_display: str, advantage: str, baseline_color: str) -> None:
    lines.append(text(x, y, label.upper(), 13, fill=MUTED, weight=700, letter_spacing=1.2))
    lines.append(text(x, y + 29, "Prime Context", 14, fill=PC_LIGHT, weight=700))
    lines.append(text(x + width, y + 29, pc_display, 16, weight=750, anchor="end"))
    base_y = y + 42
    max_value = max(pc_value, baseline_value, 1e-9)
    lines.append(rect(x, base_y, width, 9, GRID, radius=4.5))
    lines.append(rect(x, base_y, width * pc_value / max_value, 9, "url(#pcGradient)", radius=4.5))
    lines.append(text(x, y + 77, "Baseline", 14, fill=baseline_color, weight=700))
    lines.append(text(x + width, y + 77, baseline_display, 16, fill=TEXT, weight=750, anchor="end"))
    lines.append(rect(x, y + 89, width, 7, baseline_color, radius=3.5, opacity=0.75))
    badge_w = max(128, 8.0 * len(advantage) + 26)
    lines.append(rect(x + width - badge_w, y + 106, badge_w, 28, "#133637", radius=14, stroke="#1C5B58"))
    lines.append(text(x + width - badge_w / 2, y + 126, advantage, 13, fill=GOOD, weight=750, anchor="middle"))


def pair_card(lines: list[str], x: float, y: float, width: float, height: float,
              baseline_name: str, baseline_color: str, pc_passes: int, base_passes: int,
              pair: dict[str, Any]) -> None:
    lines.append(rect(x, y, width, height, CARD, radius=24, stroke="#25304A", filter_name="shadow"))
    lines.append(rect(x, y, 8, height, baseline_color, radius=4))
    lines.append(text(x + 34, y + 44, "PRIME CONTEXT", 13, fill=PC_LIGHT, weight=800, letter_spacing=1.5))
    lines.append(text(x + 34, y + 76, f"vs {baseline_name}", 25, weight=780))
    lines.append(text(x + width - 34, y + 50, f"{pc_passes}/30", 31, fill=GOOD, weight=850, anchor="end"))
    lines.append(text(x + width - 34, y + 76, f"baseline {base_passes}/30 strict", 12, fill=MUTED, anchor="end"))
    inner_x = x + 34
    inner_w = width - 68
    metric_bar(
        lines, inner_x, y + 116, inner_w, "Agent time · strict comparable set",
        pair["prime_context_agent_wall_seconds"], pair["baseline_agent_wall_seconds"],
        f'{pair["prime_context_agent_wall_seconds"]:,.3f} s', f'{pair["baseline_agent_wall_seconds"]:,.3f} s',
        f'{pair["prime_context_time_percent_less"]:.2f}% less', baseline_color,
    )
    metric_bar(
        lines, inner_x, y + 270, inner_w, "Cost · strict comparable set",
        pair["prime_context_api_cost"], pair["baseline_api_cost"],
        f'${pair["prime_context_api_cost"]:,.6f}',
        f'${pair["baseline_api_cost"]:,.6f}',
        f'{pair["prime_context_cost_percent_less"]:.2f}% less', baseline_color,
    )
    metric_bar(
        lines, inner_x, y + 424, inner_w, "Provider tokens · diagnostic",
        pair["prime_context_provider_tokens"], pair["baseline_provider_tokens"],
        f'{pair["prime_context_provider_tokens"]:,}', f'{pair["baseline_provider_tokens"]:,}',
        f'{pair["prime_context_provider_tokens_percent_less"]:.2f}% fewer', baseline_color,
    )
    wins = f'{pair["prime_context_time_wins"]}/{pair["eligible_pairs"]} faster  •  {pair["prime_context_cost_wins"]}/{pair["eligible_pairs"]} lower cost'
    lines.append(text(x + width / 2, y + height - 28, wins, 15, fill=TEXT, weight=720, anchor="middle"))


def write_scoreboard(data: dict[str, Any], output: Path) -> None:
    width, height = 1400, 860
    pa = data["prime_context_comparisons"]["vanilla_prime_agent"]
    cx = data["prime_context_comparisons"]["vanilla_codex"]
    arms = data["arms"]
    lines = svg_start(
        width, height,
        "Prime Context three-arm benchmark scoreboard",
        "Prime Context is compared directly with vanilla Prime Agent and vanilla Codex in separate pairs across the 30-task Python Real-World benchmark.",
    )
    lines.append(text(70, 58, "PYTHON REAL-WORLD 30", 14, fill=GOOD, weight=800, letter_spacing=2.2))
    lines.append(text(70, 103, "30/30 complete. Less time. Lower cost. Far fewer tokens.", 34, weight=850))
    lines.append(text(70, 136, "Two direct baseline comparisons. One consistent Prime Context advantage.", 17, fill=MUTED))
    pair_card(lines, 70, 174, 610, 586, "vanilla Prime Agent 0.9.1", PA,
              arms["prime_context"]["strict_passes"], arms["vanilla_prime_agent"]["strict_passes"], pa)
    pair_card(lines, 720, 174, 610, 586, "vanilla Codex CLI", CODEX,
              arms["prime_context"]["strict_passes"], arms["vanilla_codex"]["strict_passes"], cx)
    lines.append(rect(70, 786, 1260, 46, "#111D31", radius=23, stroke="#263553"))
    lines.append(text(700, 816, "58/59 faster strict pairs  •  59/59 lower-cost strict pairs  •  Prime Context passes all 30", 17, fill=TEXT, weight=780, anchor="middle"))
    lines.append(text(1330, 851, "All costs use the same matched rates", 11, fill=MUTED, anchor="end"))
    lines.append("</svg>")
    output.write_text("\n".join(lines) + "\n")


def format_raw(metric: str, value: float) -> str:
    if metric == "time":
        return f"{value:,.3f} s"
    if metric == "cost":
        return f"${value:,.6f}"
    return f"{int(value):,} tokens"


def write_advantage_chart(data: dict[str, Any], output: Path, metric: str) -> None:
    configs = {
        "time": {
            "title": "Prime Context time advantage by task",
            "subtitle": "Positive bars mean less agent wall time. Task 13 is the only Codex time win.",
            "field": "time_percent_less", "raw": "agent_wall_seconds",
            "min": -40, "max": 70, "ticks": [-40, -20, 0, 20, 40, 60], "unit": "% less time",
            "note": "Strict selected pairs only • Task 30 vs Prime Agent is a correctness win, so its time is not compared",
        },
        "cost": {
            "title": "Prime Context cost advantage by task",
            "subtitle": "Prime Context has the lower cost on every eligible strict pair.",
            "field": "cost_percent_less", "raw": "api_cost",
            "min": 0, "max": 80, "ticks": [0, 20, 40, 60, 80], "unit": "% lower cost",
            "note": "Strict selected pairs only • all three arms use the same matched rates",
        },
        "tokens": {
            "title": "Prime Context token advantage by task",
            "subtitle": "Positive bars mean fewer provider tokens. Token counts are diagnostic.",
            "field": "provider_tokens_percent_less", "raw": "provider_tokens",
            "min": -20, "max": 100, "ticks": [-20, 0, 20, 40, 60, 80, 100], "unit": "% fewer tokens",
            "note": "Strict selected pairs only • provider tokens are diagnostic • each row compares Prime Context with one baseline",
        },
    }
    cfg = configs[metric]
    width, height = 1400, 790
    lines = svg_start(width, height, cfg["title"], cfg["subtitle"] + " " + cfg["note"])
    lines.append(text(64, 58, "PRIME CONTEXT ADVANTAGE • ALL 30 TASKS", 14, fill=GOOD, weight=800, letter_spacing=1.8))
    lines.append(text(64, 103, cfg["title"], 33, weight=850))
    lines.append(text(64, 134, cfg["subtitle"], 16, fill=MUTED))
    plot_x, plot_w, plot_h = 86, 1240, 218
    panel_specs = [
        ("vs vanilla Prime Agent 0.9.1", "vs_vanilla_prime_agent", "vanilla_prime_agent", PA, 178),
        ("vs vanilla Codex CLI", "vs_vanilla_codex", "vanilla_codex", CODEX, 472),
    ]
    pairs = data["prime_context_comparisons"]
    for label, adv_key, baseline_key, baseline_color, top in panel_specs:
        lines.append(rect(54, top - 22, 1292, 270, CARD, radius=22, stroke="#25304A"))
        lines.append(rect(72, top - 3, 8, 31, baseline_color, radius=4))
        lines.append(text(94, top + 20, label, 19, weight=760))
        pair = pairs[baseline_key]
        if metric == "time":
            badge = f'{pair["prime_context_time_wins"]}/{pair["eligible_pairs"]} faster • {pair["prime_context_time_percent_less"]:.2f}% less total'
        elif metric == "cost":
            badge = f'{pair["prime_context_cost_wins"]}/{pair["eligible_pairs"]} lower • {pair["prime_context_cost_percent_less"]:.2f}% less total'
        else:
            values = [t["prime_context_advantage"][adv_key][cfg["field"]] for t in data["tasks"]]
            eligible_values = [v for v in values if v is not None]
            badge = f'{sum(v > 0 for v in eligible_values)}/{len(eligible_values)} lower • {pair["prime_context_provider_tokens_percent_less"]:.2f}% fewer total'
        lines.append(rect(925, top - 5, 387, 34, "#142F32", radius=17, stroke="#205252"))
        lines.append(text(1118.5, top + 18, badge, 13, fill=GOOD, weight=760, anchor="middle"))
        chart_top = top + 42
        y_min, y_max = cfg["min"], cfg["max"]
        def y_for(value: float) -> float:
            return chart_top + (y_max - value) / (y_max - y_min) * plot_h
        for tick in cfg["ticks"]:
            yy = y_for(tick)
            color = "#53617A" if tick == 0 else GRID
            sw = 1.6 if tick == 0 else 1
            lines.append(f'<line x1="{plot_x}" y1="{yy:.1f}" x2="{plot_x + plot_w}" y2="{yy:.1f}" stroke="{color}" stroke-width="{sw}"/>')
            lines.append(text(plot_x - 10, yy + 4, f"{tick}%", 10, fill=MUTED, anchor="end"))
        step = plot_w / 30
        zero_y = y_for(0)
        for index, task in enumerate(data["tasks"]):
            cx = plot_x + step * (index + 0.5)
            value = task["prime_context_advantage"][adv_key][cfg["field"]]
            pc_raw = task["prime_context"][cfg["raw"]]
            base_raw = task[baseline_key][cfg["raw"]]
            if value is None:
                points = f"{cx:.1f},{zero_y - 9:.1f} {cx + 8:.1f},{zero_y:.1f} {cx:.1f},{zero_y + 9:.1f} {cx - 8:.1f},{zero_y:.1f}"
                lines.append(f'<polygon points="{points}" fill="{GOLD}"><title>Task {task["task_id"]} {esc(task["task_title"])}: Prime Context correctness win; efficiency not compared</title></polygon>')
                lines.append(text(cx, zero_y + 4, "C", 8, fill=BG, weight=900, anchor="middle"))
            else:
                yy = y_for(value)
                bar_y = min(yy, zero_y)
                bar_h = max(2.0, abs(zero_y - yy))
                color = "url(#pcGradient)" if value >= 0 else BAD
                tooltip = (
                    f'Task {task["task_id"]} — {task["task_title"]}: Prime Context {format_raw(metric, pc_raw)}; '
                    f'{label[3:]} {format_raw(metric, base_raw)}; Prime Context {value:.2f}%'
                )
                lines.append(f'<rect x="{cx - 11:.1f}" y="{bar_y:.1f}" width="22" height="{bar_h:.1f}" rx="3" fill="{color}"><title>{esc(tooltip)}</title></rect>')
                if value < 0:
                    lines.append(f'<circle cx="{cx:.1f}" cy="{yy:.1f}" r="4" fill="{BAD}"/>')
            lines.append(text(cx, chart_top + plot_h + 19, task["task_id"], 9, fill=MUTED, anchor="middle"))
    lines.append(rect(54, 752, 1292, 26, "#10182B", radius=13))
    lines.append(text(700, 770, cfg["note"], 11, fill=MUTED, anchor="middle"))
    lines.append("</svg>")
    output.write_text("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the published three-arm benchmark SVGs.")
    parser.add_argument("--comparison", type=Path, default=DEFAULT_COMPARISON)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    data = json.loads(args.comparison.read_text())
    if data.get("schema") != "prime-context.python-realworld-comparison/v2":
        raise ValueError("comparison.json must use the v2 Prime-Context-only comparison schema")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_scoreboard(data, args.output_dir / "benchmark-scoreboard.svg")
    for metric in ("time", "cost", "tokens"):
        write_advantage_chart(data, args.output_dir / f"{metric}-advantage-by-task.svg", metric)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
