uniform float uTime;
uniform float uPixelRatio;
// x, y: depth where the figure fades in; z, w: depth where it fades out.
uniform vec4 uFade;

attribute float aSize;
attribute float aRandom;
attribute float aGlow;

varying vec3 vColor;
varying float vAlpha;
varying float vHalo;

const vec3 IDLE_COLOUR = vec3(0.86, 0.9, 1.0);
const vec3 LIT_COLOUR = vec3(0.72, 0.84, 1.0);

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  float depth = max(-viewPosition.z, 0.001);
  float fade = smoothstep(uFade.x, uFade.y, depth) * (1.0 - smoothstep(uFade.z, uFade.w, depth));

  gl_PointSize = (5.0 + aSize * 2.0 + aGlow * 6.0) * uPixelRatio * clamp(30.0 / depth, 0.6, 2.0);
  float twinkle = 0.85 + 0.15 * sin(uTime * (1.2 + aRandom * 2.0) + aRandom * 40.0);
  vColor = mix(IDLE_COLOUR, LIT_COLOUR, aGlow);
  vAlpha = (1.0 + 0.5 * aGlow) * twinkle * fade;
  vHalo = 0.6 + 0.4 * aGlow;
}
