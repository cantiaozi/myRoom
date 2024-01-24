#version 300 es
layout(location = 0) in vec2 a_position;

out vec2 vCoord;

void main() {
	// vCoord = a_position;
	vCoord.x = a_position.x * 0.5 + 0.5;
	vCoord.y = a_position.y * 0.5 + 0.5;
	gl_Position = vec4(a_position, 0, 1);
}