// Uses the route's road-adjusted terrain sampler, including on junctions.
function tenerifeGroundCar(car, dt, heightAt) {
  const forwardX = Math.sin(car.heading);
  const forwardZ = -Math.cos(car.heading);
  const surface = (side, along) => heightAt(
    car.x - forwardZ * side + forwardX * along,
    car.z + forwardX * side + forwardZ * along
  );
  const frontLeft = surface(-.91, 1.36);
  const frontRight = surface(.91, 1.36);
  const backLeft = surface(-.91, -1.36);
  const backRight = surface(.91, -1.36);
  const blend = 1 - Math.exp(-dt * 20);
  const limit = (angle, bound) => Math.max(-bound, Math.min(bound, angle));
  const pitch = limit(Math.atan2(frontLeft + frontRight - backLeft - backRight, 5.44), .42);
  const roll = limit(Math.atan2(frontLeft + backLeft - frontRight - backRight, 3.64), .36);
  car.pitch = (car.groundPitch ?? pitch) * (1 - blend) + pitch * blend;
  car.roll = (car.groundRoll ?? roll) * (1 - blend) + roll * blend;
  car.groundPitch = car.pitch;
  car.groundRoll = car.roll;
  const slopeAhead = Math.sin(car.pitch) * Math.cos(car.roll);
  const slopeRight = -Math.sin(car.roll);
  let floor = surface(0, 0);
  for (const side of [-.91, .91]) {
    for (const along of [-2.24, -1.36, 0, 1.36, 2.24]) {
      const chassisClearance = Math.abs(along) === 1.36 ? .015 : .15;
      floor = Math.max(floor, surface(side, along) - side * slopeRight - along * slopeAhead - chassisClearance);
    }
  }
  car.y = Math.max(floor, (car.groundY ?? floor) * (1 - blend) + floor * blend);
  car.groundY = car.y;
}

function tenerifeVehicleHits(x, z, heading, obstacles) {
  const rightX = Math.cos(heading);
  const rightZ = Math.sin(heading);
  const forwardX = rightZ;
  const forwardZ = -rightX;
  const halfWidth = 1.06;
  const halfLength = 2.35;
  return obstacles.some(obstacle => {
    const dx = obstacle.x - x;
    const dz = obstacle.z - z;
    if (Math.hypot(dx, dz) > obstacle.radius + 2.65) return false;
    const side = dx * rightX + dz * rightZ;
    const along = dx * forwardX + dz * forwardZ;
    if (!obstacle.halfX || !obstacle.halfZ) {
      return Math.hypot(Math.max(0, Math.abs(side) - halfWidth), Math.max(0, Math.abs(along) - halfLength)) < obstacle.radius;
    }
    const angle = obstacle.angle ?? 0;
    const axisX = Math.cos(angle);
    const axisZ = -Math.sin(angle);
    const cos = Math.abs(rightX * axisX + rightZ * axisZ);
    const sin = Math.abs(forwardX * axisX + forwardZ * axisZ);
    return Math.abs(side) < halfWidth + obstacle.halfX * cos + obstacle.halfZ * sin
      && Math.abs(along) < halfLength + obstacle.halfX * sin + obstacle.halfZ * cos
      && Math.abs(dx * axisX + dz * axisZ) < obstacle.halfX + halfWidth * cos + halfLength * sin
      && Math.abs(-dx * axisZ + dz * axisX) < obstacle.halfZ + halfWidth * sin + halfLength * cos;
  });
}
