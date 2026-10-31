shader_type canvas_item;
render_mode unshaded;

uniform float atlas_stride = 313.0;
uniform float atlas_region = 312.0;
uniform float logical_pixels = 64.0;
uniform float detail_strength : hint_range(0.0, 1.0) = 0.55;
varying vec4 vertex_tint;

void vertex() {
	vertex_tint = COLOR;
}

void fragment() {
	vec2 dimensions = vec2(textureSize(TEXTURE, 0));
	vec2 pixel = UV * dimensions - vec2(1.0);
	vec2 tile = floor(pixel / atlas_stride);
	vec2 local = clamp((pixel - tile * atlas_stride) / atlas_region, vec2(0.0), vec2(0.9999));
	vec2 sample_pixel = tile * atlas_stride + vec2(1.0) + (floor(local * logical_pixels) + vec2(0.5)) / logical_pixels * atlas_region;
	vec4 surface = texture(TEXTURE, sample_pixel / dimensions);
	vec3 base = vec3(0.25, 0.27, 0.21);
	if (tile.y > 0.5 && tile.y < 1.5) base = vec3(0.43, 0.43, 0.33);
	if (tile.y > 1.5 && tile.y < 2.5) base = vec3(0.43, 0.37, 0.25);
	if (tile.y > 2.5) base = vec3(0.24, 0.25, 0.22);
	float edge = min(min(local.x, 1.0 - local.x), min(local.y, 1.0 - local.y));
	float border_blend = smoothstep(0.0, 0.10, floor(edge * logical_pixels) / logical_pixels);
	COLOR = vertex_tint * vec4(mix(base, surface.rgb, detail_strength * border_blend), surface.a);
}
