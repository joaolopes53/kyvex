uniform float uLife;

varying vec2 vCoord;

const vec3 METEOR_COLOUR = vec3(0.75, 0.85, 1.0);

void main() {
  float tail = pow(clamp(1.0 - vCoord.x, 0.0, 1.0), 2.0) * step(0.0, vCoord.x);
  float line = exp(-vCoord.y * vCoord.y * 12.0);
  float head = exp(-(vCoord.x * vCoord.x * 400.0 + vCoord.y * vCoord.y * 6.0));
  gl_FragColor = vec4(METEOR_COLOUR, (tail * line * 1.3 + head * 1.5) * uLife);
}
