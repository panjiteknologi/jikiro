import { tool } from "ai";
import { z } from "zod";

function isWeatherResponse(weatherData: unknown): weatherData is {
  cityName?: string;
  current: { time: string; temperature_2m: number };
  current_units: { temperature_2m: string };
  hourly: { time: string[]; temperature_2m: number[] };
  daily: { sunrise: string[]; sunset: string[] };
} {
  if (!weatherData || typeof weatherData !== "object") {
    return false;
  }

  const data = weatherData as {
    current?: { time?: string; temperature_2m?: number };
    current_units?: { temperature_2m?: string };
    hourly?: { time?: string[]; temperature_2m?: number[] };
    daily?: { sunrise?: string[]; sunset?: string[] };
  };

  return (
    typeof data.current?.time === "string" &&
    typeof data.current?.temperature_2m === "number" &&
    typeof data.current_units?.temperature_2m === "string" &&
    Array.isArray(data.hourly?.time) &&
    Array.isArray(data.hourly?.temperature_2m) &&
    Array.isArray(data.daily?.sunrise) &&
    Array.isArray(data.daily?.sunset)
  );
}

async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch {
    return null;
  }
}

export const getWeather = tool({
  description:
    "Get the current weather at a location. You can provide either coordinates or a city name.",
  inputSchema: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    city: z
      .string()
      .describe("City name (e.g., 'San Francisco', 'New York', 'London')")
      .optional(),
  }),
  execute: async (input) => {
    let latitude: number;
    let longitude: number;

    if (input.city) {
      const coords = await geocodeCity(input.city);
      if (!coords) {
        return {
          error: `Could not find coordinates for "${input.city}". Please check the city name.`,
        };
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else if (input.latitude !== undefined && input.longitude !== undefined) {
      latitude = input.latitude;
      longitude = input.longitude;
    } else {
      return {
        error:
          "Please provide either a city name or both latitude and longitude coordinates.",
      };
    }

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
      );

      if (!response.ok) {
        return {
          error: "Could not fetch weather right now. Please try again.",
        };
      }

      const weatherData = await response.json();

      if (!isWeatherResponse(weatherData)) {
        return {
          error: "Weather data came back in an unexpected format.",
        };
      }

      if (input.city) {
        weatherData.cityName = input.city;
      }

      return weatherData;
    } catch {
      return {
        error: "Could not fetch weather right now. Please try again.",
      };
    }
  },
});
