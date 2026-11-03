uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uMorph;
uniform float uWordScale;
uniform vec3 uWordOrigin;
uniform vec3 uWordColor;
uniform mat4 uGalaxy;

attribute vec3 aColor;
attribute vec3 aTarget;
attribute float aSize;
attribute float aRandom;
attribute float aWord;

varying vec3 vColor;
varying float vAlpha;
varying float vHalo;

void main() {
  // Word stars are stored in the galaxy's local frame; inner stars orbit faster, which keeps the arms winding.
  float radius = length(position.xz);
  float angle = uTime * 0.18 / (0.35 + radius);
  vec3 orbit = vec3(cos(angle) * position.x - sin(angle) * position.z, position.y, sin(angle) * position.x + cos(angle) * position.z);
  vec3 start = mix(position, (uGalaxy * vec4(orbit, 1.0)).xyz, aWord);

  // Each word star starts its flight at a different moment, so the letters assemble instead of snapping.
  float morph = aWord * smoothstep(0.0, 1.0, clamp(uMorph * 1.6 - aRandom * 0.6, 0.0, 1.0));
  vec3 word = uWordOrigin + aTarget * uWordScale;
  word.xy += vec2(sin(uTime + aRandom * 20.0), cos(uTime * 0.8 + aRandom * 14.0)) * 0.03;
  vec4 viewPosition = modelViewMatrix * vec4(mix(start, word, morph), 1.0);
  gl_Position = projectionMatrix * viewPosition;

  float depth = max(-viewPosition.z, 0.001);
  float starSize = mix(aSize, 1.2 + aRandom * 0.8, morph);
  float size = min(uSize * starSize * uPixelRatio / depth, 9.0 * uPixelRatio);
  gl_PointSize = max(size, 1.0);
  vHalo = smoothstep(3.0 * uPixelRatio, 8.0 * uPixelRatio, size);

  // Sub-pixel stars dim instead of shrinking below one pixel, which keeps them from flickering.
  float twinkle = 0.8 + 0.2 * sin(uTime * (1.5 + aRandom * 2.5) + aRandom * 50.0);
  float nearFade = smoothstep(0.5, 4.0, depth);
  float farFade = 1.0 - smoothstep(110.0, 170.0, depth);
  vColor = mix(aColor, uWordColor, morph * 0.6);
  vAlpha = twinkle * min(size, 1.0) * nearFade * mix(farFade, 1.0, morph);
}
