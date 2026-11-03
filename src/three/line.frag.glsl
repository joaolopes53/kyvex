uniform vec3 uColour;
uniform float uIntensity;

varying float vAlpha;

void main() {
  gl_FragColor = vec4(uColour, vAlpha * uIntensity);
}
