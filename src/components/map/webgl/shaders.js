import { BURST_CELL_DIAMETER_FACTOR, BURST_OPACITY, BURST_STROKE_WIDTH } from '../intervalBursts';
const decimal = value => Number(value).toFixed(8);
export const vertexShader = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 position;
uniform mat4 matrix;
uniform highp sampler2D rainfall;
uniform highp sampler2D amounts;
uniform int textureWidth;
uniform int kind;
uniform int slot;
uniform bool staticRings;
uniform vec4 born;
uniform vec4 duration;
uniform float time;
uniform float threshold;
uniform float worldSize;
uniform float gaugeRadius;
uniform float centerW;
uniform vec2 viewport;
out vec2 uv;
out float radius;
out float alpha;
out float strokeSize;
flat out float value;
flat out float available;
ivec2 address(int index) { return ivec2(index % textureWidth, index / textureWidth); }
void main() {
  int index = int(position.z);
  value = 0.0; available = 1.0; alpha = 1.0; strokeSize = 0.0;
  // Rings are black and use their cohort texture; they need no rainfall lookup.
  if (kind != 2) {
    vec4 reading = texelFetch(rainfall, address(index), 0);
    value = reading.r; available = reading.g;
  }
  vec4 center = matrix * vec4(position.xy, 0.0, 1.0);
  if (kind == 0) { gl_Position = center; uv = vec2(0.0); radius = 0.0; return; }
  if (kind == 1) {
    // Viewport-aligned circles, with map pitch scaling, like the native gauge layer.
    float perspective = centerW / center.w;
    radius = gaugeRadius * perspective; strokeSize = 2.0 * perspective;
    uv = corner * (radius + strokeSize + 1.0);
    gl_Position = center + vec4(uv * vec2(2.0, -2.0) / viewport * center.w, 0.0, 0.0);
    return;
  }
  float amount = texelFetch(amounts, ivec2(index % textureWidth, index / textureWidth + slot * textureSize(rainfall, 0).y), 0).r;
  strokeSize = ${decimal(BURST_STROKE_WIDTH)};
  float scale = 1.0;
  alpha = ${decimal(BURST_OPACITY)};
  if (!staticRings) {
    float progress = duration[slot] > 0.0 ? (time - born[slot]) / duration[slot] : 1.0;
    scale = 1.0 - clamp(progress, 0.0, 1.0);
    alpha *= scale * scale;
    if (progress < 0.0 || progress >= 1.0) alpha = 0.0;
  } else if (slot != 0) alpha = 0.0;
  radius = position.w * worldSize * ${decimal(BURST_CELL_DIAMETER_FACTOR / 2)} * sqrt(clamp(amount / threshold, 0.0, 1.0)) * scale;
  available = amount > 0.0 && radius > 0.0 ? 1.0 : 0.0;
  // Clip empty/expired instances before rasterization, including their AA margin.
  if (available < 0.5 || alpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); uv = vec2(0.0); return;
  }
  uv = corner * (radius + ${decimal(BURST_STROKE_WIDTH + 2)});
  gl_Position = matrix * vec4(position.xy + uv / worldSize, 0.0, 1.0);
}`;
export const fragmentShader = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
in float radius;
in float alpha;
in float strokeSize;
flat in float value;
flat in float available;
uniform int kind;
uniform int stopCount;
uniform float stops[32];
uniform vec3 colors[32];
out vec4 color;
vec3 rainfallColor(float v) {
  vec3 result = colors[0];
  for (int i = 1; i < 32; i++) {
    if (i >= stopCount) break;
    result = mix(result, colors[i], clamp((v - stops[i-1]) / (stops[i] - stops[i-1]), 0.0, 1.0));
    if (v <= stops[i]) break;
  }
  return result;
}
void main() {
  if (available < 0.5) discard;
  float opacity = kind == 0 ? 0.8 : alpha;
  vec3 rgb = vec3(0.0);
  if (kind != 2) rgb = rainfallColor(value);
  if (kind != 0) {
    float distance = length(uv), aa = max(length(vec2(dFdx(distance), dFdy(distance))), 0.1);
    float stroke = strokeSize;
    opacity *= 1.0 - smoothstep(radius + stroke - aa, radius + stroke, distance);
    if (kind == 1) rgb = mix(rgb, vec3(1.0), smoothstep(radius - aa, radius, distance));
    else { rgb = vec3(0.0); opacity *= smoothstep(radius - aa, radius, distance); }
  }
  color = vec4(rgb * opacity, opacity);
}`;
