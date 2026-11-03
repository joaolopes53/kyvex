// xy: start, z: heading in radians, w: progress from 0 to 1.
uniform vec4 uMeteor;
uniform float uAspect;

varying vec2 vCoord;

const float METEOR_TRAVEL = 1.6;
const float METEOR_TAIL = 0.42;
const float METEOR_WIDTH = 0.015;

void main() {
  // The unit quad is laid along the trajectory in screen space: x runs from just ahead of the head to the tail end.
  vec2 heading = vec2(cos(uMeteor.z), sin(uMeteor.z));
  vec2 head = uMeteor.xy + heading * uMeteor.w * METEOR_TRAVEL;
  float along = mix(-0.06, 1.0, position.x + 0.5);
  vec2 point = head - heading * along * METEOR_TAIL + vec2(-heading.y, heading.x) * position.y * 2.0 * METEOR_WIDTH;

  vCoord = vec2(along, position.y * 2.0);
  gl_Position = vec4(point / vec2(uAspect, 1.0), 0.0, 1.0);
}
