uniform vec4 uFade;

attribute float aAlpha;

varying float vAlpha;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  float depth = -viewPosition.z;
  vAlpha = aAlpha * smoothstep(uFade.x, uFade.y, depth) * (1.0 - smoothstep(uFade.z, uFade.w, depth));
}
