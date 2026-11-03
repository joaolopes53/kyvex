uniform sampler2D uScene;
uniform float uAspect;
// xy: start, z: heading in radians, w: progress from 0 to 1, negative while idle.
uniform vec4 uMeteor;

varying vec2 vUv;

const float METEOR_TRAVEL = 1.6;
const float METEOR_TAIL = 0.32;
const float METEOR_WIDTH = 0.0035;
const vec3 METEOR_COLOUR = vec3(0.75, 0.85, 1.0);

vec3 meteor(vec2 point) {
  if (uMeteor.w < 0.0) return vec3(0.0);
  vec2 heading = vec2(cos(uMeteor.z), sin(uMeteor.z));
  vec2 offset = point - (uMeteor.xy + heading * uMeteor.w * METEOR_TRAVEL);
  float along = dot(offset, -heading);
  float across = dot(offset, vec2(-heading.y, heading.x));
  float tail = clamp(1.0 - along / METEOR_TAIL, 0.0, 1.0) * step(0.0, along);
  float line = exp(-across * across / (METEOR_WIDTH * METEOR_WIDTH));
  float head = exp(-dot(offset, offset) / (METEOR_WIDTH * METEOR_WIDTH * 9.0));
  return METEOR_COLOUR * (tail * tail * line + head) * sin(3.14159 * uMeteor.w);
}

void main() {
  vec2 point = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
  gl_FragColor = vec4(texture2D(uScene, vUv).rgb + meteor(point), 1.0);
}
