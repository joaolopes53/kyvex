uniform float uIntensity;

varying vec3 vColor;
varying float vAlpha;
varying float vHalo;

void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float distanceSquared = dot(coord, coord);
  if (distanceSquared > 1.0) discard;
  float core = exp(-distanceSquared * 8.0);
  float halo = exp(-distanceSquared * 2.5) * 0.4 * vHalo;
  gl_FragColor = vec4(vColor, (core + halo) * vAlpha * uIntensity);
}
