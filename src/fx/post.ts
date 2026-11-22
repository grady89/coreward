import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

/**
 * Bloom on true emissives only.
 *
 * The scene renders into a half-float, 4x MSAA target that three treats as
 * if it were the screen (the `isXRRenderTarget` flag, with an sRGB texture):
 * every material tone-maps and encodes exactly as it does drawn straight to
 * the canvas, so the shader programs are the SAME ones (no recompile when
 * bloom toggles, the boot prewarm stays valid) and every `toneMapped: false`
 * glow, vault tint and chevron keeps its exact colour. What the half-float
 * target adds is headroom above 1.0.
 *
 * Tone-mapped surfaces saturate at 1.0, so lamp-lit rock, the pod hull and
 * the strata glow can never cross the threshold. Only what is pushed past
 * display white — the HDR gains below, applied to the emissives — blooms.
 * The high pass keys on the brightest channel, not luminance, so a deep
 * red or blue emissive blooms as readily as a yellow one.
 */

/** 1 while bloom is on: the HDR gains scale with it, so bloom off is the old look exactly */
export const bloomOn = { value: 1 };

const THRESHOLD = 1.0;
const KNEE = 0.35;
const STRENGTH = 0.6;
const RADIUS = 0.4;

const HIGH_PASS = /* glsl */`
uniform sampler2D tDiffuse;
uniform float luminosityThreshold;
uniform float smoothWidth;
varying vec2 vUv;
void main() {
	vec4 texel = texture2D( tDiffuse, vUv );
	// a stray NaN/Inf pixel (an 8-bit canvas swallows it) would smear across
	// the whole frame through the blur: drop it, and cap the headroom
	if ( any( isnan( texel.rgb ) ) || any( isinf( texel.rgb ) ) ) texel.rgb = vec3( 0.0 );
	texel.rgb = min( texel.rgb, vec3( 16.0 ) );
	float v = max( texel.r, max( texel.g, texel.b ) );
	float a = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );
	gl_FragColor = vec4( texel.rgb * a, 1.0 );
}`;

type Draw = (scene: THREE.Scene, camera: THREE.Camera) => void;

export class Post {
  enabled = true;
  private composer: EffectComposer;
  private pass: RenderPass;
  private size = new THREE.Vector2();
  private w = 0;
  private h = 0;
  private pr = 0;

  /** `suppress`: frames that must keep the plain render whatever the setting */
  constructor(private renderer: THREE.WebGLRenderer, private suppress: () => boolean = () => false) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    this.composer = new EffectComposer(renderer, target);
    // render "as if to screen": tone mapping and the output encoding stay in
    // the materials (see the header)
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      (rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    }
    this.pass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), STRENGTH, RADIUS, THRESHOLD);
    (bloom.highPassUniforms as Record<string, THREE.IUniform>).smoothWidth.value = KNEE;
    bloom.materialHighPassFilter.fragmentShader = HIGH_PASS;
    bloom.materialHighPassFilter.needsUpdate = true;
    this.composer.addPass(this.pass);
    this.composer.addPass(bloom);
    this.composer.addPass(new ShaderPass(CopyShader));
  }

  setBloom(on: boolean): void {
    this.enabled = on;
  }

  /** draw a frame: through the composer with bloom on, straight to the canvas with it off */
  render: Draw = (scene, camera) => {
    const on = this.enabled && !this.suppress();
    bloomOn.value = on ? 1 : 0;
    if (!on) { this.renderer.render(scene, camera); return; }
    this.renderer.getSize(this.size);
    const pr = this.renderer.getPixelRatio();
    if (this.size.x !== this.w || this.size.y !== this.h || pr !== this.pr) {
      this.w = this.size.x; this.h = this.size.y; this.pr = pr;
      this.composer.setPixelRatio(pr);
      this.composer.setSize(this.w, this.h);
    }
    this.pass.scene = scene;
    this.pass.camera = camera;
    // count the whole frame (scene + full-screen passes), not just the last pass
    const info = this.renderer.info;
    info.reset();
    info.autoReset = false;
    this.composer.render();
    info.autoReset = true;
  };
}

/**
 * Lift an unlit (`toneMapped: false`) emissive above display white while
 * bloom is on. `gain` multiplies its colour before output; channels already
 * at 1 clip on screen, so the visible change is small and the excess is what
 * blooms.
 */
export function hdrBasic(mat: THREE.Material, gain: number): void {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  const uGain = { value: gain };
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uHdrGain = uGain;
    shader.uniforms.uBloomOn = bloomOn;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uHdrGain;\nuniform float uBloomOn;')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= mix( 1.0, uHdrGain, uBloomOn );\n#include <tonemapping_fragment>');
  };
  mat.customProgramCacheKey = () => prevKey + '|hdr-basic';
}

/**
 * Tone-mapped emissives (ore glow facets, fissure cores) saturate at 1 and
 * could never bloom. Add back the part of the emissive radiance that is
 * genuinely hot (above `knee`) after tone mapping, so only those facets
 * cross the threshold; dim self-light stays as it was.
 */
export function hdrEmissive(mat: THREE.Material, gain: number, knee = 0.8): void {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  const uGain = { value: gain };
  const uKnee = { value: knee };
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.uniforms.uHdrGain = uGain;
    shader.uniforms.uHdrKnee = uKnee;
    shader.uniforms.uBloomOn = bloomOn;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uHdrGain;\nuniform float uHdrKnee;\nuniform float uBloomOn;')
      .replace('#include <fog_fragment>', `{
		float hm = max( totalEmissiveRadiance.r, max( totalEmissiveRadiance.g, totalEmissiveRadiance.b ) );
		gl_FragColor.rgb += totalEmissiveRadiance * smoothstep( uHdrKnee, uHdrKnee * 2.0, hm ) * uHdrGain * uBloomOn;
	}
	#include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => prevKey + '|hdr-emissive';
}
