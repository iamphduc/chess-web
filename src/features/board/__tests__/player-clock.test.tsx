import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayerClock } from "../components/PlayerClock";

const render = (remainingMs: number, isActive = true, playerName = "Me") =>
  renderToStaticMarkup(
    <PlayerClock remainingMs={remainingMs} isActive={isActive} playerName={playerName} />
  );

/** The opening tag of the pill (the element with role="timer"). */
function timerTag(html: string): string {
  const tags = html.match(/<[a-z]+[^>]*role="timer"[^>]*>/g) ?? [];
  expect(tags, "exactly one timer").toHaveLength(1);
  return tags[0];
}

function timerClasses(html: string): string[] {
  const cls = timerTag(html).match(/class="([^"]*)"/);
  return cls ? cls[1].split(/\s+/).filter(Boolean) : [];
}

function digits(html: string): string {
  const m = html.match(/<span class="player__timer">([^<]*)<\/span>/);
  return m ? m[1] : "<missing>";
}

function handStyle(html: string): string {
  const m = html.match(/<[a-z]+[^>]*class="clock-icon__hand"[^>]*>/);
  expect(m, "hand element").not.toBeNull();
  const style = m![0].match(/style="([^"]*)"/);
  return style ? style[1] : "";
}

/** The timer element's full markup (the pill is a <div>). */
function timerElement(html: string): string {
  const start = html.indexOf(timerTag(html));
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

function alertText(html: string): string {
  const all = html.match(/<([a-z]+)[^>]*role="alert"[^>]*>([^<]*)<\/\1>/g) ?? [];
  expect(all, "exactly one alert").toHaveLength(1);
  return all[0].replace(/<[^>]+>/g, "");
}

describe("PlayerClock", () => {
  it("renders a labelled timer", () => {
    const html = render(600000);
    expect(timerTag(html)).toContain('aria-label="Clock for Me"');
    expect(timerClasses(html)).toContain("player__time");
    expect(digits(html)).toBe("10:00");
  });

  it("low-time red only on the running pill under 20s", () => {
    expect(timerClasses(render(600000, true))).toContain("player__time--running");
    expect(timerClasses(render(600000, false))).not.toContain("player__time--running");

    expect(timerClasses(render(19999, true))).toContain("player__time--low");
    expect(timerClasses(render(20000, true))).not.toContain("player__time--low");
    expect(timerClasses(render(5000, false))).not.toContain("player__time--low");
    expect(timerClasses(render(5000, false))).not.toContain("player__time--running");
  });

  it("shows tenths under 10s and 0.0 at zero", () => {
    const a = render(9800, true);
    expect(digits(a)).toBe("9.8");
    expect(timerClasses(a)).toContain("player__time--low");
    const b = render(0, true);
    expect(digits(b)).toBe("0.0");
    expect(timerClasses(b)).toContain("player__time--low");
  });

  it("hand angle follows the whole seconds", () => {
    expect(handStyle(render(600000))).toMatch(/transform:\s*rotate\(0deg\)/);
    expect(handStyle(render(599000))).toMatch(/transform:\s*rotate\(90deg\)/);
    const html = render(600000);
    const svg = html.match(/<svg[^>]*>/);
    expect(svg, "inline svg").not.toBeNull();
    expect(svg![0]).toContain('class="clock-icon"');
    expect(svg![0]).toContain('aria-hidden="true"');
    expect(html.match(/<svg/g)).toHaveLength(1);
  });

  it("one low-time alert outside the timer", () => {
    expect(alertText(render(10000))).toBe("");
    const html = render(9999);
    expect(alertText(html)).toBe("10 seconds left");
    expect(timerElement(html)).not.toContain('role="alert"');
    expect(timerElement(html)).not.toContain("10 seconds left");
  });
});
