uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

attribute vec3 aColor;
attribute float aSize;
attribute float aRandom;

varying vec3 vColor;
varying float vAlpha;
varying float vHalo;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float size = uSize * aSize * uPixelRatio;
  gl_PointSize = max(size, 1.0);

  float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + aRandom * 3.0) + aRandom * 60.0);
  vColor = aColor;
  vAlpha = twinkle * min(size, 1.0) * (0.35 + aRandom * 0.65);
  vHalo = 0.0;
}
