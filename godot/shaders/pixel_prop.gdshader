shader_type canvas_item;
render_mode unshaded;

uniform float source_pixel_step = 2.0;
varying vec4 vertex_tint;

void vertex() {
	vertex_tint = COLOR;
}

void fragment() {
	vec2 dimensions = vec2(textureSize(TEXTURE, 0));
	vec2 sample_uv = (floor(UV * dimensions / source_pixel_step) + vec2(0.5)) * source_pixel_step / dimensions;
	vec4 sprite = texture(TEXTURE, sample_uv);
	sprite.a = step(0.45, sprite.a);
	COLOR = vertex_tint * sprite;
}
