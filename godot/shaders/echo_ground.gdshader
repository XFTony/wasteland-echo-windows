shader_type canvas_item;
render_mode unshaded;

uniform vec4 roads[8];
uniform sampler2D terrain_texture : filter_nearest, repeat_disable;
uniform int road_count = 0;
uniform vec4 pavements[8];
uniform int pavement_count = 0;
uniform vec4 ballast_zones[4];
uniform int ballast_count = 0;
uniform float repeat_size = 384.0;
uniform vec4 ground_tint : source_color = vec4(0.89, 0.91, 0.87, 1.0);
varying vec2 ground_position;

void vertex() {
	ground_position = VERTEX;
}

float rectangle_distance(vec2 p, vec4 rect) {
	vec2 q = abs(p - rect.xy - rect.zw * 0.5) - rect.zw * 0.5;
	return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0);
}

vec3 atlas_sample(vec2 uv, vec2 cell) {
	vec2 margin = vec2(4.0) / vec2(textureSize(terrain_texture, 0));
	return texture(terrain_texture, cell * 0.5 + margin + uv * (vec2(0.5) - margin * 2.0)).rgb;
}

vec3 material_sample(vec2 p, vec2 cell, float period) {
	vec2 uv = fract(p / period);
	vec2 weight = 0.5 - 0.5 * cos(uv * 6.2831853);
	vec3 a = atlas_sample(uv, cell);
	vec3 b = atlas_sample(fract(uv + vec2(0.5, 0.0)), cell);
	vec3 c = atlas_sample(fract(uv + vec2(0.0, 0.5)), cell);
	vec3 d = atlas_sample(fract(uv + vec2(0.5)), cell);
	return mix(mix(d, c, weight.x), mix(b, a, weight.x), weight.y);
}

void fragment() {
	vec2 p = floor(ground_position) + vec2(0.5);
	vec3 earth = material_sample(p, vec2(1.0, 0.0), repeat_size);
	vec3 paving = material_sample(p + vec2(113.0, 71.0), vec2(0.0, 1.0), repeat_size);
	vec3 asphalt = material_sample(p + vec2(37.0, 19.0), vec2(0.0, 0.0), repeat_size);
	vec3 ballast = material_sample(p + vec2(71.0, 167.0), vec2(1.0, 1.0), repeat_size);
	earth = mix(vec3(0.40, 0.35, 0.27), earth, 0.66);
	paving = mix(vec3(0.43, 0.425, 0.375), paving, 0.68);
	asphalt = mix(vec3(0.21, 0.215, 0.205), asphalt, 0.62);
	ballast = mix(vec3(0.32, 0.30, 0.255), ballast, 0.64);
	float road_distance = 100000.0;
	float paving_distance = 100000.0;
	float ballast_distance = 100000.0;
	for (int i = 0; i < 8; i++) {
		if (i < road_count) road_distance = min(road_distance, rectangle_distance(p, roads[i]));
		if (i < pavement_count) paving_distance = min(paving_distance, rectangle_distance(p, pavements[i]));
	}
	for (int i = 0; i < 4; i++) {
		if (i < ballast_count) ballast_distance = min(ballast_distance, rectangle_distance(p, ballast_zones[i]));
	}
	float wear = (earth.r - earth.b) * 18.0 + (asphalt.r - 0.25) * 12.0;
	vec3 color = mix(earth, ballast, 1.0 - smoothstep(-12.0, 22.0, ballast_distance + wear));
	color = mix(color, paving, 1.0 - smoothstep(-9.0, 18.0, paving_distance + wear));
	color = mix(color, asphalt, 1.0 - smoothstep(-4.0, 7.0, road_distance + wear * 0.35));
	COLOR = vec4(color * ground_tint.rgb, ground_tint.a);
}
