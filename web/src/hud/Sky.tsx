import {
  clockTime,
  compass,
  fogOf,
  iceOver,
  lightAt,
  moonPhase,
  pollenLevel,
  sunTimes,
  type WeatherKind,
} from "@tokenmaxxing/core/sky.ts";
import { seasonNow } from "../game/seasons.ts";
import { skyNow, weatherNow } from "../game/sky.ts";
import { useHud } from "../store.ts";
import { useTicker } from "./ui.tsx";

const MOONS = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const WEATHER_ICON: Record<WeatherKind, string> = {
  clear: "💨",
  cloudy: "☁️",
  fog: "🌫️",
  drizzle: "🌦️",
  rain: "🌧️",
  storm: "⛈️",
  snow: "🌨️",
};

/** How far you can see, in words: metres up close, kilometres beyond. */
const distance = (m: number) => (m < 1_000 ? `${Math.round(m / 50) * 50} m` : `${Math.round(m / 1_000)} km`);

/** World time and weather in the top bar: the next sun event, the temperature and the wind. Hover for the detail. */
export function Sky() {
  useHud((s) => s.weather);
  useTicker(30_000);
  const now = skyNow();
  const light = lightAt(now);
  const moon = moonPhase(now);
  const weather = weatherNow();
  const { sunrise, sunset } = sunTimes(now);
  const next =
    now < sunrise
      ? { icon: "🌅", text: `sunrise ${clockTime(sunrise)}` }
      : now < sunset
        ? { icon: "☀️", text: `sunset ${clockTime(sunset)}` }
        : {
            icon: MOONS[Math.round(moon.age * 8) % 8]!,
            text: `sunrise ${clockTime(sunTimes(now + 86_400_000).sunrise)}`,
          };
  const wind = Math.round(weather.windMs);
  const temp = Math.round(weather.tempC);
  const pollen = pollenLevel(weather.pollen);
  const detail = [
    `Season: ${seasonNow()}`,
    `Aarhus ${clockTime(now)}, ${light.phase}`,
    `Sunrise ${clockTime(sunrise)}, sunset ${clockTime(sunset)}`,
    `Moon: ${moon.name} (${Math.round(moon.lit * 100)}% lit)`,
    `${weather.kind[0]!.toUpperCase()}${weather.kind.slice(1)}, cloud ${Math.round(weather.cloud * 100)}%`,
    `${temp} °C${iceOver(weather) ? ", the pond is frozen" : ""}`,
    `Wind ${weather.windMs} m/s from ${compass(weather.windDir)}`,
    `Visibility ${distance(weather.visibilityM)}${fogOf(weather) > 0.05 && weather.kind !== "fog" ? ", misty" : ""}`,
    ...(pollen === "none" ? [] : [`Pollen: ${pollen}${pollen === "high" ? " (achoo)" : ""}`]),
  ].join("\n");
  return (
    <span className="chip sky" title={detail} role="img" aria-label={detail.replaceAll("\n", ". ")}>
      <span aria-hidden>{next.icon}</span> {next.text}
      <span className="sep" aria-hidden>
        ·
      </span>
      <span aria-hidden>{WEATHER_ICON[weather.kind]}</span> {temp}° · {wind} m/s
    </span>
  );
}
