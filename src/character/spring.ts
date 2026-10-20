// A damped spring: the one ingredient behind every movement of Wisp.
// Each part (position, squash, gaze, arms, tail, expression) chases a target
// with its own spring, so changing a target never makes anything jump.

export interface Spring {
  value: number;
  velocity: number;
}

/**
 * One step of semi-implicit Euler: first the velocity, then the position
 * with the new velocity (stable even with a stiff spring).
 * `k` is the stiffness (how hard it pulls), `c` the damping (how fast it calms down),
 * `dt` the time step in seconds.
 */
export function step(
  value: number,
  velocity: number,
  target: number,
  k: number,
  c: number,
  dt: number,
): Spring {
  const acceleration = k * (target - value) - c * velocity;
  const nextVelocity = velocity + acceleration * dt;
  return { value: value + nextVelocity * dt, velocity: nextVelocity };
}

/** Same as `step`, but updates `spring` in place: handy inside the simulation. */
export function follow(spring: Spring, target: number, k: number, c: number, dt: number): void {
  const next = step(spring.value, spring.velocity, target, k, c, dt);
  spring.value = next.value;
  spring.velocity = next.velocity;
}

/** Stiffness and damping of one spring. */
export interface SpringConfig {
  k: number;
  c: number;
}
