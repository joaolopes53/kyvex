import { AdditiveBlending, type IUniform, ShaderMaterial } from 'three';

// Stars and lines are additive glows drawn in scene order, so they skip the depth buffer.
export function additiveMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, IUniform>,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
