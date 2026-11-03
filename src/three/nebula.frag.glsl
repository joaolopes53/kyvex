uniform mat4 uCameraWorld;
uniform mat4 uInverseProjection;
uniform vec3 uBandNormal;
uniform float uDrift;
uniform float uIntensity;

varying vec2 vUv;

// Matches --color-bg in global.css.
const vec3 BACKGROUND = vec3(0.012, 0.012, 0.016);
// Unresolved starlight is a neutral, slightly warm grey.
const vec3 HAZE = vec3(0.62, 0.6, 0.58);

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + 1.7;
    amplitude *= 0.5;
  }
  return value / 0.96875;
}

void main() {
  vec4 view = uInverseProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 direction = normalize((uCameraWorld * vec4(view.xyz / view.w, 0.0)).xyz);

  float latitude = dot(direction, uBandNormal);
  float band = exp(-latitude * latitude / 0.05);
  vec3 p = direction * 2.0 + vec3(uDrift, 0.0, uDrift * 0.5);
  float density = fbm(p);
  float dust = smoothstep(0.5, 0.72, fbm(p * 3.0 + 4.0)) * band;

  vec3 colour = BACKGROUND + HAZE * band * 0.05 * (0.5 + 0.5 * density) * (1.0 - dust * 0.7);
  colour = BACKGROUND + (colour - BACKGROUND) * uIntensity;

  // Dither breaks up 8-bit banding in the dark gradients.
  colour += (hash(vec3(gl_FragCoord.xy, 0.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(colour, 1.0);
}
